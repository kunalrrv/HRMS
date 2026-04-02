from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, File, UploadFile, Depends, Query
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
import uuid
import asyncio
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr, ConfigDict
from pathlib import Path
from enum import Enum

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'hrms_saas')]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = "HS256"

# Storage Configuration
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "hrms-saas"
storage_key = None

# Create the main app
app = FastAPI(title="TalentOps HRMS SaaS API")

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class FeatureGateMiddleware(BaseHTTPMiddleware):
    """Middleware to enforce plan-based feature gating and trial expiry"""
    GATED_PREFIXES = {
        "/api/payroll": "payroll",
        "/api/jobs": "recruitment",
        "/api/candidates": "recruitment",
        "/api/timesheets": "timesheets",
        "/api/projects": "projects",
        "/api/audit-logs": "audit_logs",
    }
    EXEMPT_PATHS = [
        "/api/auth", "/api/subscription", "/api/organizations", "/api/dashboard",
        "/api/profile", "/api/employees", "/api/attendance", "/api/leaves",
        "/api/calendar", "/api/payroll/states", "/api/health", "/api/upload",
        "/api/admin",
    ]

    async def dispatch(self, request, call_next):
        path = request.url.path
        
        # Skip non-API routes and exempt paths
        if not path.startswith("/api/") or any(path.startswith(e) for e in self.EXEMPT_PATHS):
            return await call_next(request)
        
        # Check if this path is gated
        feature = None
        for prefix, feat in self.GATED_PREFIXES.items():
            if path.startswith(prefix):
                feature = feat
                break
        
        if not feature:
            return await call_next(request)
        
        # Try to get user's org from cookie
        try:
            token = request.cookies.get("access_token")
            if not token:
                return await call_next(request)
            
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            user = await db.users.find_one({"id": payload.get("sub")}, {"_id": 0})
            if not user or not user.get("org_id"):
                return await call_next(request)
            
            plan_info = await get_org_plan(user["org_id"])
            
            if plan_info["expired"]:
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Your free trial has expired. Please upgrade to continue.", "code": "TRIAL_EXPIRED"}
                )
            
            if feature not in plan_info["limits"]["features"]:
                return JSONResponse(
                    status_code=403,
                    content={"detail": f"This feature requires a higher plan. Please upgrade.", "code": "PLAN_UPGRADE_REQUIRED", "feature": feature}
                )
        except Exception:
            pass
        
        return await call_next(request)

app.add_middleware(FeatureGateMiddleware)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# ===================== ENUMS =====================
class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    HR = "hr"
    EMPLOYEE = "employee"

class LeaveType(str, Enum):
    CASUAL = "CL"
    SICK = "SL"
    PRIVILEGE = "PL"

class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class SubscriptionPlan(str, Enum):
    FREE_TRIAL = "free_trial"
    STARTER = "starter"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"

# ===================== PLAN LIMITS & FEATURE GATING =====================
PLAN_LIMITS = {
    "free_trial": {"max_employees": 5, "features": ["employees", "attendance", "leaves", "calendar", "profile", "dashboard"]},
    "starter": {"max_employees": 25, "features": ["employees", "attendance", "leaves", "calendar", "profile", "dashboard", "payroll"]},
    "professional": {"max_employees": 100, "features": ["employees", "attendance", "leaves", "calendar", "profile", "dashboard", "payroll", "recruitment", "timesheets", "projects", "reports", "bulk_payroll"]},
    "enterprise": {"max_employees": 999999, "features": ["employees", "attendance", "leaves", "calendar", "profile", "dashboard", "payroll", "recruitment", "timesheets", "projects", "reports", "bulk_payroll", "audit_logs", "custom_integrations"]},
}

FEATURE_ROUTE_MAP = {
    "/api/payroll": "payroll",
    "/api/jobs": "recruitment",
    "/api/candidates": "recruitment",
    "/api/timesheets": "timesheets",
    "/api/projects": "projects",
    "/api/audit-logs": "audit_logs",
}

async def get_org_plan(org_id: str) -> dict:
    """Get org's current plan and check trial expiry"""
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        return {"plan": "free_trial", "expired": False, "limits": PLAN_LIMITS["free_trial"]}
    
    plan = org.get("subscription_plan", "free_trial")
    expired = False
    
    if plan == "free_trial" and org.get("trial_ends_at"):
        trial_end = datetime.fromisoformat(org["trial_ends_at"])
        if datetime.now(timezone.utc) > trial_end:
            expired = True
    
    return {"plan": plan, "expired": expired, "limits": PLAN_LIMITS.get(plan, PLAN_LIMITS["free_trial"]), "org": org}

async def check_employee_limit(org_id: str, plan: str) -> bool:
    """Check if org can add more employees"""
    current_count = await db.employees.count_documents({"org_id": org_id})
    max_allowed = PLAN_LIMITS.get(plan, {}).get("max_employees", 5)
    return current_count < max_allowed

async def check_feature_access(org_id: str, feature: str) -> bool:
    """Check if org's plan includes the feature"""
    plan_info = await get_org_plan(org_id)
    if plan_info["expired"]:
        return False
    return feature in plan_info["limits"]["features"]

async def log_audit(org_id: str, user_id: str, user_email: str, action: str, resource_type: str, resource_id: str = None, details: str = None):
    """Log an audit event (always logs, but only viewable on Enterprise)"""
    await db.audit_logs.insert_one({
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "user_id": user_id,
        "user_email": user_email,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })

class CandidateStage(str, Enum):
    APPLIED = "applied"
    SCREENING = "screening"
    INTERVIEW = "interview"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"

# ===================== MODELS =====================
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.EMPLOYEE

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: UserRole = UserRole.EMPLOYEE
    org_id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    org_id: Optional[str] = None
    employee_id: Optional[str] = None
    created_at: str

class OrganizationCreate(BaseModel):
    name: str
    domain: Optional[str] = None
    industry: Optional[str] = None

class OrganizationResponse(BaseModel):
    id: str
    name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    subscription_plan: SubscriptionPlan
    trial_ends_at: Optional[str] = None
    created_at: str

class EmployeeCreate(BaseModel):
    user_id: str
    department: str
    designation: str
    date_of_joining: str
    reporting_manager_id: Optional[str] = None
    employee_code: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    state_code: Optional[str] = None

class EmployeeResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    user_email: str
    org_id: str
    department: str
    designation: str
    date_of_joining: str
    employee_code: Optional[str] = None
    phone: Optional[str] = None
    reporting_manager_id: Optional[str] = None
    state_code: Optional[str] = None
    salary_basic: Optional[float] = None
    salary_hra: Optional[float] = None
    salary_allowances: Optional[float] = None
    created_at: str

class AttendanceCreate(BaseModel):
    action: str  # "clock_in" or "clock_out"

class AttendanceResponse(BaseModel):
    id: str
    employee_id: str
    org_id: str
    date: str
    clock_in: Optional[str] = None
    clock_out: Optional[str] = None
    total_hours: Optional[float] = None
    status: str

class LeaveApplicationCreate(BaseModel):
    leave_type: LeaveType
    start_date: str
    end_date: str
    reason: str

class LeaveApplicationResponse(BaseModel):
    id: str
    employee_id: str
    org_id: str
    leave_type: LeaveType
    start_date: str
    end_date: str
    reason: str
    status: LeaveStatus
    approved_by: Optional[str] = None
    created_at: str

class LeaveBalanceResponse(BaseModel):
    employee_id: str
    org_id: str
    casual_leave: int
    sick_leave: int
    privilege_leave: int
    year: int

class SalaryStructure(BaseModel):
    basic: float
    hra: float
    allowances: float
    pf_contribution: Optional[float] = None
    esi_contribution: Optional[float] = None

class PayrollCreate(BaseModel):
    employee_id: str
    month: int
    year: int

class BulkPayrollCreate(BaseModel):
    month: int
    year: int

class PayrollResponse(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    org_id: str
    month: int
    year: int
    basic: float
    hra: float
    allowances: float
    gross_salary: float
    federal_tax: float
    state_tax: float
    social_security_employee: float
    social_security_employer: float
    medicare_employee: float
    medicare_employer: float
    total_deductions: float
    net_salary: float
    state_code: Optional[str] = None
    status: str
    created_at: str

class JobPostingCreate(BaseModel):
    title: str
    department: str
    location: str
    employment_type: str
    description: str
    requirements: str
    salary_range_min: Optional[float] = None
    salary_range_max: Optional[float] = None

class JobPostingResponse(BaseModel):
    id: str
    org_id: str
    title: str
    department: str
    location: str
    employment_type: str
    description: str
    requirements: str
    salary_range_min: Optional[float] = None
    salary_range_max: Optional[float] = None
    is_active: bool
    created_at: str

class CandidateCreate(BaseModel):
    job_id: str
    name: str
    email: EmailStr
    phone: Optional[str] = None
    resume_url: Optional[str] = None

class CandidateResponse(BaseModel):
    id: str
    job_id: str
    org_id: str
    name: str
    email: str
    phone: Optional[str] = None
    resume_url: Optional[str] = None
    stage: CandidateStage
    notes: Optional[str] = None
    created_at: str

class CandidateStageUpdate(BaseModel):
    stage: CandidateStage
    notes: Optional[str] = None

class SubscriptionUpdate(BaseModel):
    plan: SubscriptionPlan
    payment_id: Optional[str] = None

# ===================== PROJECT & TIMESHEET MODELS =====================
class ProjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True

class ProjectResponse(BaseModel):
    id: str
    org_id: str
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool
    created_at: str

class TimesheetEntryCreate(BaseModel):
    project_id: str
    week_start_date: str  # Monday of the week (YYYY-MM-DD)
    monday_hours: float = 0
    tuesday_hours: float = 0
    wednesday_hours: float = 0
    thursday_hours: float = 0
    friday_hours: float = 0
    saturday_hours: float = 0
    sunday_hours: float = 0
    notes: Optional[str] = None

class TimesheetEntryResponse(BaseModel):
    id: str
    employee_id: str
    org_id: str
    project_id: str
    project_name: str
    week_start_date: str
    monday_hours: float
    tuesday_hours: float
    wednesday_hours: float
    thursday_hours: float
    friday_hours: float
    saturday_hours: float
    sunday_hours: float
    total_hours: float
    notes: Optional[str] = None
    status: str  # draft, submitted, approved, rejected
    created_at: str

class TimesheetStatusUpdate(BaseModel):
    status: str  # submitted, approved, rejected
    feedback: Optional[str] = None

# ===================== HELPER FUNCTIONS =====================
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

def get_jwt_secret() -> str:
    return JWT_SECRET

def create_access_token(user_id: str, email: str, role: str, org_id: str = None) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "org_id": org_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60),
        "type": "access"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh"
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("_id", None)
        user.pop("password_hash", None)
        
        # Check if org is suspended (skip for super admin)
        if user.get("org_id") and user["role"] != UserRole.SUPER_ADMIN.value:
            org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
            if org and org.get("is_active") is False:
                raise HTTPException(status_code=403, detail="Your organization has been suspended. Contact support.")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(*roles: UserRole):
    async def checker(request: Request):
        user = await get_current_user(request)
        if user["role"] not in [r.value for r in roles]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user
    return checker

# Storage functions
def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    if not EMERGENT_KEY:
        logger.warning("EMERGENT_LLM_KEY not set, storage disabled")
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        storage_key = resp.json()["storage_key"]
        return storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str) -> tuple:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage not available")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# US Payroll Calculations
US_STATE_TAX_RATES = {
    "AL": 0.050, "AK": 0.000, "AZ": 0.025, "AR": 0.055, "CA": 0.093,
    "CO": 0.044, "CT": 0.069, "DE": 0.066, "FL": 0.000, "GA": 0.055,
    "HI": 0.110, "ID": 0.058, "IL": 0.049, "IN": 0.032, "IA": 0.060,
    "KS": 0.057, "KY": 0.045, "LA": 0.042, "ME": 0.071, "MD": 0.057,
    "MA": 0.050, "MI": 0.042, "MN": 0.098, "MS": 0.050, "MO": 0.049,
    "MT": 0.068, "NE": 0.068, "NV": 0.000, "NH": 0.000, "NJ": 0.108,
    "NM": 0.059, "NY": 0.109, "NC": 0.045, "ND": 0.029, "OH": 0.040,
    "OK": 0.048, "OR": 0.099, "PA": 0.031, "RI": 0.059, "SC": 0.064,
    "SD": 0.000, "TN": 0.000, "TX": 0.000, "UT": 0.047, "VT": 0.088,
    "VA": 0.057, "WA": 0.000, "WV": 0.065, "WI": 0.076, "WY": 0.000,
    "DC": 0.105,
}

US_STATE_NAMES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
}

def calculate_federal_tax(annual_income: float) -> float:
    """Calculate US Federal Income Tax (2026 brackets, single filer)"""
    if annual_income <= 0:
        return 0
    brackets = [
        (11600, 0.10), (47150, 0.12), (100525, 0.22),
        (191950, 0.24), (243725, 0.32), (609350, 0.35), (float('inf'), 0.37)
    ]
    tax = 0
    prev = 0
    for limit, rate in brackets:
        taxable = min(annual_income, limit) - prev
        if taxable <= 0:
            break
        tax += taxable * rate
        prev = limit
    return round(tax, 2)

def calculate_social_security(annual_income: float) -> tuple:
    """Social Security: 6.2% employee + 6.2% employer on first $168,600"""
    ss_wage_base = 168600
    taxable = min(annual_income, ss_wage_base)
    employee_ss = round(taxable * 0.062, 2)
    employer_ss = round(taxable * 0.062, 2)
    return employee_ss, employer_ss

def calculate_medicare(annual_income: float) -> tuple:
    """Medicare: 1.45% + additional 0.9% over $200k"""
    employee_medicare = round(annual_income * 0.0145, 2)
    if annual_income > 200000:
        employee_medicare += round((annual_income - 200000) * 0.009, 2)
    employer_medicare = round(annual_income * 0.0145, 2)
    return employee_medicare, employer_medicare

def calculate_state_tax(annual_income: float, state_code: str) -> float:
    """Calculate state income tax using flat effective rate"""
    rate = US_STATE_TAX_RATES.get(state_code, 0)
    return round(annual_income * rate, 2)

def generate_payroll_for_employee(employee: dict, emp_user: dict, org_id: str, month: int, year: int, state_code: str = None) -> dict:
    """Generate a single payroll record for an employee"""
    basic = employee.get("salary_basic", 0)
    hra = employee.get("salary_hra", 0)
    allowances = employee.get("salary_allowances", 0)
    gross = basic + hra + allowances
    annual_income = gross * 12

    emp_state = state_code or employee.get("state_code") or "CA"

    annual_fed = calculate_federal_tax(annual_income)
    monthly_fed = round(annual_fed / 12, 2)

    annual_state = calculate_state_tax(annual_income, emp_state)
    monthly_state = round(annual_state / 12, 2)

    annual_ss_emp, annual_ss_er = calculate_social_security(annual_income)
    monthly_ss_emp = round(annual_ss_emp / 12, 2)
    monthly_ss_er = round(annual_ss_er / 12, 2)

    annual_med_emp, annual_med_er = calculate_medicare(annual_income)
    monthly_med_emp = round(annual_med_emp / 12, 2)
    monthly_med_er = round(annual_med_er / 12, 2)

    total_deductions = monthly_fed + monthly_state + monthly_ss_emp + monthly_med_emp
    net_salary = round(gross - total_deductions, 2)

    payroll_id = str(uuid.uuid4())
    return {
        "id": payroll_id,
        "employee_id": employee["id"],
        "employee_name": emp_user["name"] if emp_user else "Unknown",
        "org_id": org_id,
        "month": month,
        "year": year,
        "basic": basic,
        "hra": hra,
        "allowances": allowances,
        "gross_salary": gross,
        "federal_tax": monthly_fed,
        "state_tax": monthly_state,
        "social_security_employee": monthly_ss_emp,
        "social_security_employer": monthly_ss_er,
        "medicare_employee": monthly_med_emp,
        "medicare_employer": monthly_med_er,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "state_code": emp_state,
        "status": "generated",
        "created_at": datetime.now(timezone.utc).isoformat()
    }

# ===================== AUTH ROUTES =====================
@api_router.post("/auth/register")
async def register(data: UserCreate, response: Response):
    email = data.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user = {
        "id": user_id,
        "email": email,
        "name": data.name,
        "password_hash": hash_password(data.password),
        "role": data.role.value,
        "org_id": data.org_id,
        "employee_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    
    access_token = create_access_token(user_id, email, user["role"], user["org_id"])
    refresh_token = create_refresh_token(user_id)
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    
    return {"id": user_id, "email": email, "name": data.name, "role": user["role"], "org_id": user["org_id"]}

@api_router.post("/auth/login")
async def login(data: UserLogin, response: Response, request: Request):
    email = data.email.lower()
    
    # Check brute force
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"identifier": identifier})
    if attempt and attempt.get("count", 0) >= 5:
        lockout_time = attempt.get("locked_until")
        if lockout_time and datetime.fromisoformat(lockout_time) > datetime.now(timezone.utc):
            raise HTTPException(status_code=429, detail="Account locked. Try again in 15 minutes.")
        else:
            await db.login_attempts.delete_one({"identifier": identifier})
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        # Increment failed attempts
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {
                "$inc": {"count": 1},
                "$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()}
            },
            upsert=True
        )
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Clear failed attempts on success
    await db.login_attempts.delete_one({"identifier": identifier})
    
    access_token = create_access_token(user["id"], email, user["role"], user.get("org_id"))
    refresh_token = create_refresh_token(user["id"])
    
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "org_id": user.get("org_id"),
        "employee_id": user.get("employee_id")
    }

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out successfully"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    refresh = request.cookies.get("refresh_token")
    if not refresh:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = jwt.decode(refresh, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        access_token = create_access_token(user["id"], user["email"], user["role"], user.get("org_id"))
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
        return {"message": "Token refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

class GoogleCallbackRequest(BaseModel):
    session_id: str

@api_router.post("/auth/google/callback")
async def google_oauth_callback(data: GoogleCallbackRequest, response: Response):
    """Handle Google OAuth callback - exchange session_id for user data"""
    try:
        # Call Emergent Auth to get session data
        auth_response = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": data.session_id},
            timeout=30
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        session_data = auth_response.json()
        email = session_data.get("email", "").lower()
        name = session_data.get("name", "")
        picture = session_data.get("picture", "")
        session_token = session_data.get("session_token", "")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not provided by Google")
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": email})
        
        if existing_user:
            # Update existing user
            user_id = existing_user["id"]
            await db.users.update_one(
                {"email": email},
                {"$set": {
                    "name": name or existing_user.get("name"),
                    "picture": picture,
                    "google_session_token": session_token,
                    "last_login": datetime.now(timezone.utc).isoformat()
                }}
            )
            user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            user = {
                "id": user_id,
                "email": email,
                "name": name or email.split("@")[0],
                "password_hash": None,  # No password for Google users
                "role": UserRole.EMPLOYEE.value,
                "org_id": None,
                "employee_id": None,
                "picture": picture,
                "google_session_token": session_token,
                "auth_provider": "google",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user)
            user.pop("_id", None)
            user.pop("password_hash", None)
        
        # Store session in database
        await db.user_sessions.update_one(
            {"user_id": user_id},
            {
                "$set": {
                    "session_token": session_token,
                    "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
            },
            upsert=True
        )
        
        # Create JWT tokens
        access_token = create_access_token(user_id, email, user.get("role", UserRole.EMPLOYEE.value), user.get("org_id"))
        refresh_token_val = create_refresh_token(user_id)
        
        # Set cookies
        response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=3600, path="/")
        response.set_cookie(key="refresh_token", value=refresh_token_val, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
        response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
        
        return {
            "id": user_id,
            "email": email,
            "name": user.get("name"),
            "role": user.get("role"),
            "org_id": user.get("org_id"),
            "employee_id": user.get("employee_id"),
            "picture": picture
        }
        
    except requests.RequestException as e:
        logger.error(f"Google OAuth error: {e}")
        raise HTTPException(status_code=500, detail="Failed to verify Google session")

# ===================== ORGANIZATION ROUTES =====================
@api_router.post("/organizations", response_model=OrganizationResponse)
async def create_organization(data: OrganizationCreate, request: Request):
    user = await get_current_user(request)
    
    org_id = str(uuid.uuid4())
    trial_ends = datetime.now(timezone.utc) + timedelta(days=14)
    
    org = {
        "id": org_id,
        "name": data.name,
        "domain": data.domain,
        "industry": data.industry,
        "subscription_plan": SubscriptionPlan.FREE_TRIAL.value,
        "trial_ends_at": trial_ends.isoformat(),
        "owner_id": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.insert_one(org)
    
    # Update user with org_id and make them admin
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"org_id": org_id, "role": UserRole.ADMIN.value}}
    )
    
    # Create default leave policy
    await db.leave_policies.insert_one({
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "casual_leave": 12,
        "sick_leave": 12,
        "privilege_leave": 15,
        "year": datetime.now(timezone.utc).year,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return OrganizationResponse(**{k: v for k, v in org.items() if k != "_id"})

@api_router.get("/organizations/current", response_model=OrganizationResponse)
async def get_current_organization(request: Request):
    user = await get_current_user(request)
    if not user.get("org_id"):
        raise HTTPException(status_code=404, detail="No organization found")
    
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    return OrganizationResponse(**org)

@api_router.put("/organizations/current")
async def update_organization(data: OrganizationCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    await db.organizations.update_one(
        {"id": user["org_id"]},
        {"$set": {"name": data.name, "domain": data.domain, "industry": data.industry}}
    )
    
    org = await db.organizations.find_one({"id": user["org_id"]}, {"_id": 0})
    return OrganizationResponse(**org)

# ===================== EMPLOYEE ROUTES =====================
@api_router.post("/employees", response_model=EmployeeResponse)
async def create_employee(data: EmployeeCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Check employee limit
    plan_info = await get_org_plan(user["org_id"])
    if plan_info["expired"]:
        raise HTTPException(status_code=403, detail="Your free trial has expired. Please upgrade to continue.")
    can_add = await check_employee_limit(user["org_id"], plan_info["plan"])
    if not can_add:
        max_emp = plan_info["limits"]["max_employees"]
        raise HTTPException(status_code=403, detail=f"Employee limit reached ({max_emp}). Please upgrade your plan.")
    
    target_user = await db.users.find_one({"id": data.user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    employee_id = str(uuid.uuid4())
    employee = {
        "id": employee_id,
        "user_id": data.user_id,
        "org_id": user["org_id"],
        "department": data.department,
        "designation": data.designation,
        "date_of_joining": data.date_of_joining,
        "employee_code": data.employee_code or f"EMP{str(uuid.uuid4())[:8].upper()}",
        "phone": data.phone,
        "address": data.address,
        "emergency_contact": data.emergency_contact,
        "reporting_manager_id": data.reporting_manager_id,
        "state_code": data.state_code or "CA",
        "salary_basic": 0,
        "salary_hra": 0,
        "salary_allowances": 0,
        "documents": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.employees.insert_one(employee)
    
    # Audit log
    await log_audit(user["org_id"], user["id"], user["email"], "CREATE", "employee", employee_id, f"Created employee {target_user['name']}")
    
    # Update user with employee_id
    await db.users.update_one({"id": data.user_id}, {"$set": {"employee_id": employee_id, "org_id": user["org_id"]}})
    
    # Create leave balance for current year
    policy = await db.leave_policies.find_one({"org_id": user["org_id"], "year": datetime.now(timezone.utc).year})
    await db.leave_balances.insert_one({
        "id": str(uuid.uuid4()),
        "employee_id": employee_id,
        "org_id": user["org_id"],
        "casual_leave": policy["casual_leave"] if policy else 12,
        "sick_leave": policy["sick_leave"] if policy else 12,
        "privilege_leave": policy["privilege_leave"] if policy else 15,
        "year": datetime.now(timezone.utc).year,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return EmployeeResponse(
        id=employee_id,
        user_id=data.user_id,
        user_name=target_user["name"],
        user_email=target_user["email"],
        org_id=user["org_id"],
        department=data.department,
        designation=data.designation,
        date_of_joining=data.date_of_joining,
        employee_code=employee["employee_code"],
        phone=data.phone,
        reporting_manager_id=data.reporting_manager_id,
        created_at=employee["created_at"]
    )

@api_router.get("/employees", response_model=List[EmployeeResponse])
async def list_employees(request: Request, department: Optional[str] = None, search: Optional[str] = None):
    user = await get_current_user(request)
    if not user.get("org_id"):
        raise HTTPException(status_code=400, detail="No organization")
    
    query = {"org_id": user["org_id"]}
    if department:
        query["department"] = department
    
    employees = await db.employees.find(query, {"_id": 0}).to_list(1000)
    
    result = []
    for emp in employees:
        emp_user = await db.users.find_one({"id": emp["user_id"]}, {"_id": 0})
        if emp_user:
            if search and search.lower() not in emp_user["name"].lower() and search.lower() not in emp_user["email"].lower():
                continue
            result.append(EmployeeResponse(
                id=emp["id"],
                user_id=emp["user_id"],
                user_name=emp_user["name"],
                user_email=emp_user["email"],
                org_id=emp["org_id"],
                department=emp["department"],
                designation=emp["designation"],
                date_of_joining=emp["date_of_joining"],
                employee_code=emp.get("employee_code"),
                phone=emp.get("phone"),
                reporting_manager_id=emp.get("reporting_manager_id"),
                state_code=emp.get("state_code"),
                salary_basic=emp.get("salary_basic"),
                salary_hra=emp.get("salary_hra"),
                salary_allowances=emp.get("salary_allowances"),
                created_at=emp["created_at"]
            ))
    
    return result

@api_router.get("/employees/{employee_id}", response_model=EmployeeResponse)
async def get_employee(employee_id: str, request: Request):
    user = await get_current_user(request)
    
    employee = await db.employees.find_one({"id": employee_id, "org_id": user["org_id"]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    emp_user = await db.users.find_one({"id": employee["user_id"]}, {"_id": 0})
    
    return EmployeeResponse(
        id=employee["id"],
        user_id=employee["user_id"],
        user_name=emp_user["name"] if emp_user else "Unknown",
        user_email=emp_user["email"] if emp_user else "unknown@email.com",
        org_id=employee["org_id"],
        department=employee["department"],
        designation=employee["designation"],
        date_of_joining=employee["date_of_joining"],
        employee_code=employee.get("employee_code"),
        phone=employee.get("phone"),
        reporting_manager_id=employee.get("reporting_manager_id"),
        state_code=employee.get("state_code"),
        salary_basic=employee.get("salary_basic"),
        salary_hra=employee.get("salary_hra"),
        salary_allowances=employee.get("salary_allowances"),
        created_at=employee["created_at"]
    )

@api_router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    body = await request.json()
    update_data = {k: v for k, v in body.items() if k not in ["id", "user_id", "org_id", "created_at"]}
    
    await db.employees.update_one(
        {"id": employee_id, "org_id": user["org_id"]},
        {"$set": update_data}
    )
    
    return {"message": "Employee updated"}

@api_router.put("/employees/{employee_id}/salary")
async def update_employee_salary(employee_id: str, data: SalaryStructure, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    await db.employees.update_one(
        {"id": employee_id, "org_id": user["org_id"]},
        {"$set": {
            "salary_basic": data.basic,
            "salary_hra": data.hra,
            "salary_allowances": data.allowances
        }}
    )
    
    return {"message": "Salary updated"}

class ProfileUpdate(BaseModel):
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    state_code: Optional[str] = None

@api_router.get("/profile")
async def get_my_profile(request: Request):
    user = await get_current_user(request)
    employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    return {k: v for k, v in employee.items() if k != "_id"}

@api_router.put("/profile")
async def update_my_profile(data: ProfileUpdate, request: Request):
    user = await get_current_user(request)
    employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    
    update = {}
    if data.phone is not None:
        update["phone"] = data.phone
    if data.address is not None:
        update["address"] = data.address
    if data.emergency_contact is not None:
        update["emergency_contact"] = data.emergency_contact
    if data.state_code is not None:
        update["state_code"] = data.state_code
    
    if update:
        await db.employees.update_one({"id": employee["id"]}, {"$set": update})
    
    return {"message": "Profile updated"}

@api_router.get("/profile/history")
async def get_my_history(request: Request):
    user = await get_current_user(request)
    employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee profile not found")
    
    attendance = await db.attendance.find(
        {"employee_id": employee["id"]}, {"_id": 0}
    ).sort("date", -1).to_list(90)
    
    leaves = await db.leaves.find(
        {"employee_id": employee["id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    payrolls_raw = await db.payroll.find(
        {"employee_id": employee["id"]}, {"_id": 0}
    ).sort([("year", -1), ("month", -1)]).to_list(24)
    
    payrolls = []
    for p in payrolls_raw:
        p.setdefault("federal_tax", p.get("tds", 0))
        p.setdefault("state_tax", 0)
        p.setdefault("social_security_employee", p.get("pf_employee", 0))
        p.setdefault("social_security_employer", p.get("pf_employer", 0))
        p.setdefault("medicare_employee", p.get("esi_employee", 0))
        p.setdefault("medicare_employer", p.get("esi_employer", 0))
        p.setdefault("state_code", None)
        payrolls.append({k: v for k, v in p.items() if k != "_id"})
    
    balance = await db.leave_balances.find_one(
        {"employee_id": employee["id"], "year": datetime.now(timezone.utc).year}, {"_id": 0}
    )
    
    return {
        "attendance": attendance,
        "leaves": leaves,
        "payrolls": payrolls,
        "leave_balance": {k: v for k, v in balance.items() if k != "_id"} if balance else None
    }

# ===================== ATTENDANCE ROUTES =====================
@api_router.post("/attendance", response_model=AttendanceResponse)
async def clock_action(data: AttendanceCreate, request: Request):
    user = await get_current_user(request)
    
    employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=400, detail="Employee record not found")
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    now = datetime.now(timezone.utc).isoformat()
    
    existing = await db.attendance.find_one({
        "employee_id": employee["id"],
        "org_id": user["org_id"],
        "date": today
    })
    
    if data.action == "clock_in":
        if existing and existing.get("clock_in"):
            raise HTTPException(status_code=400, detail="Already clocked in today")
        
        if existing:
            await db.attendance.update_one(
                {"id": existing["id"]},
                {"$set": {"clock_in": now, "status": "present"}}
            )
            attendance_id = existing["id"]
        else:
            attendance_id = str(uuid.uuid4())
            await db.attendance.insert_one({
                "id": attendance_id,
                "employee_id": employee["id"],
                "org_id": user["org_id"],
                "date": today,
                "clock_in": now,
                "clock_out": None,
                "total_hours": None,
                "status": "present",
                "created_at": now
            })
    
    elif data.action == "clock_out":
        if not existing or not existing.get("clock_in"):
            raise HTTPException(status_code=400, detail="Not clocked in yet")
        if existing.get("clock_out"):
            raise HTTPException(status_code=400, detail="Already clocked out today")
        
        clock_in_time = datetime.fromisoformat(existing["clock_in"])
        clock_out_time = datetime.now(timezone.utc)
        total_hours = round((clock_out_time - clock_in_time).total_seconds() / 3600, 2)
        
        await db.attendance.update_one(
            {"id": existing["id"]},
            {"$set": {"clock_out": now, "total_hours": total_hours}}
        )
        attendance_id = existing["id"]
    else:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    record = await db.attendance.find_one({"id": attendance_id}, {"_id": 0})
    return AttendanceResponse(**record)

@api_router.get("/attendance/today")
async def get_today_attendance(request: Request):
    user = await get_current_user(request)
    
    employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    if not employee:
        return {"clocked_in": False, "clocked_out": False}
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    record = await db.attendance.find_one({
        "employee_id": employee["id"],
        "date": today
    }, {"_id": 0})
    
    if not record:
        return {"clocked_in": False, "clocked_out": False}
    
    return {
        "clocked_in": record.get("clock_in") is not None,
        "clocked_out": record.get("clock_out") is not None,
        "clock_in": record.get("clock_in"),
        "clock_out": record.get("clock_out"),
        "total_hours": record.get("total_hours")
    }

@api_router.get("/attendance", response_model=List[AttendanceResponse])
async def list_attendance(
    request: Request,
    employee_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    user = await get_current_user(request)
    
    query = {"org_id": user["org_id"]}
    
    if user["role"] == UserRole.EMPLOYEE.value:
        employee = await db.employees.find_one({"user_id": user["id"]})
        if employee:
            query["employee_id"] = employee["id"]
    elif employee_id:
        query["employee_id"] = employee_id
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    records = await db.attendance.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    return [AttendanceResponse(**r) for r in records]

# ===================== LEAVE ROUTES =====================
@api_router.post("/leaves", response_model=LeaveApplicationResponse)
async def apply_leave(data: LeaveApplicationCreate, request: Request):
    user = await get_current_user(request)
    
    employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=400, detail="Employee record not found")
    
    # Check leave balance
    balance = await db.leave_balances.find_one({
        "employee_id": employee["id"],
        "year": datetime.now(timezone.utc).year
    })
    
    start = datetime.strptime(data.start_date, "%Y-%m-%d")
    end = datetime.strptime(data.end_date, "%Y-%m-%d")
    days = (end - start).days + 1
    
    if balance:
        if data.leave_type == LeaveType.CASUAL and balance["casual_leave"] < days:
            raise HTTPException(status_code=400, detail="Insufficient casual leave balance")
        elif data.leave_type == LeaveType.SICK and balance["sick_leave"] < days:
            raise HTTPException(status_code=400, detail="Insufficient sick leave balance")
        elif data.leave_type == LeaveType.PRIVILEGE and balance["privilege_leave"] < days:
            raise HTTPException(status_code=400, detail="Insufficient privilege leave balance")
    
    leave_id = str(uuid.uuid4())
    leave = {
        "id": leave_id,
        "employee_id": employee["id"],
        "org_id": user["org_id"],
        "leave_type": data.leave_type.value,
        "start_date": data.start_date,
        "end_date": data.end_date,
        "days": days,
        "reason": data.reason,
        "status": LeaveStatus.PENDING.value,
        "approved_by": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.leaves.insert_one(leave)
    
    return LeaveApplicationResponse(**{k: v for k, v in leave.items() if k != "_id" and k != "days"})

@api_router.get("/leaves", response_model=List[LeaveApplicationResponse])
async def list_leaves(request: Request, status: Optional[str] = None):
    user = await get_current_user(request)
    
    query = {"org_id": user["org_id"]}
    
    if user["role"] == UserRole.EMPLOYEE.value:
        employee = await db.employees.find_one({"user_id": user["id"]})
        if employee:
            query["employee_id"] = employee["id"]
    
    if status:
        query["status"] = status
    
    leaves = await db.leaves.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [LeaveApplicationResponse(**{k: v for k, v in l.items() if k != "days"}) for l in leaves]

@api_router.put("/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    leave = await db.leaves.find_one({"id": leave_id, "org_id": user["org_id"]})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave application not found")
    
    if leave["status"] != LeaveStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Leave already processed")
    
    # Update leave status
    await db.leaves.update_one(
        {"id": leave_id},
        {"$set": {"status": LeaveStatus.APPROVED.value, "approved_by": user["id"]}}
    )
    
    # Deduct from balance
    balance_field = {
        LeaveType.CASUAL.value: "casual_leave",
        LeaveType.SICK.value: "sick_leave",
        LeaveType.PRIVILEGE.value: "privilege_leave"
    }.get(leave["leave_type"])
    
    if balance_field:
        await db.leave_balances.update_one(
            {"employee_id": leave["employee_id"], "year": datetime.now(timezone.utc).year},
            {"$inc": {balance_field: -leave["days"]}}
        )
    
    return {"message": "Leave approved"}

@api_router.put("/leaves/{leave_id}/reject")
async def reject_leave(leave_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    leave = await db.leaves.find_one({"id": leave_id, "org_id": user["org_id"]})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave application not found")
    
    await db.leaves.update_one(
        {"id": leave_id},
        {"$set": {"status": LeaveStatus.REJECTED.value, "approved_by": user["id"]}}
    )
    
    await log_audit(user["org_id"], user["id"], user["email"], "REJECT", "leave", leave_id, f"Rejected leave for employee {leave['employee_id']}")
    
    return {"message": "Leave rejected"}

@api_router.get("/leaves/balance", response_model=LeaveBalanceResponse)
async def get_leave_balance(request: Request):
    user = await get_current_user(request)
    
    employee = await db.employees.find_one({"user_id": user["id"]})
    if not employee:
        raise HTTPException(status_code=400, detail="Employee record not found")
    
    balance = await db.leave_balances.find_one({
        "employee_id": employee["id"],
        "year": datetime.now(timezone.utc).year
    }, {"_id": 0})
    
    if not balance:
        raise HTTPException(status_code=404, detail="Leave balance not found")
    
    return LeaveBalanceResponse(**balance)

# ===================== PAYROLL ROUTES =====================
@api_router.get("/payroll/states")
async def get_us_states():
    """Return list of US states with their tax rates"""
    return [{"code": k, "name": v, "tax_rate": US_STATE_TAX_RATES[k]} for k, v in US_STATE_NAMES.items()]

@api_router.post("/payroll/generate", response_model=PayrollResponse)
async def generate_payroll(data: PayrollCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    employee = await db.employees.find_one({"id": data.employee_id, "org_id": user["org_id"]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    emp_user = await db.users.find_one({"id": employee["user_id"]}, {"_id": 0})
    
    existing = await db.payroll.find_one({
        "employee_id": data.employee_id,
        "month": data.month,
        "year": data.year
    })
    if existing:
        raise HTTPException(status_code=400, detail="Payroll already generated for this month")
    
    payroll = generate_payroll_for_employee(employee, emp_user, user["org_id"], data.month, data.year)
    await db.payroll.insert_one(payroll)
    
    await log_audit(user["org_id"], user["id"], user["email"], "GENERATE", "payroll", payroll["id"], f"Generated payroll for {emp_user['name']} - {data.month}/{data.year}")
    
    return PayrollResponse(**{k: v for k, v in payroll.items() if k != "_id"})

@api_router.post("/payroll/generate-bulk")
async def generate_bulk_payroll(data: BulkPayrollCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    employees = await db.employees.find({"org_id": user["org_id"]}, {"_id": 0}).to_list(1000)
    
    generated = 0
    skipped = 0
    errors = []
    
    for emp in employees:
        existing = await db.payroll.find_one({
            "employee_id": emp["id"],
            "month": data.month,
            "year": data.year
        })
        if existing:
            skipped += 1
            continue
        
        gross = emp.get("salary_basic", 0) + emp.get("salary_hra", 0) + emp.get("salary_allowances", 0)
        if gross <= 0:
            skipped += 1
            continue
        
        emp_user = await db.users.find_one({"id": emp["user_id"]}, {"_id": 0})
        payroll = generate_payroll_for_employee(emp, emp_user, user["org_id"], data.month, data.year)
        await db.payroll.insert_one(payroll)
        generated += 1
    
    return {
        "message": f"Bulk payroll complete",
        "generated": generated,
        "skipped": skipped,
        "total_employees": len(employees)
    }
    
    return PayrollResponse(**{k: v for k, v in payroll.items() if k != "_id"})

@api_router.get("/payroll", response_model=List[PayrollResponse])
async def list_payroll(
    request: Request,
    employee_id: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None
):
    user = await get_current_user(request)
    
    query = {"org_id": user["org_id"]}
    
    if user["role"] == UserRole.EMPLOYEE.value:
        employee = await db.employees.find_one({"user_id": user["id"]})
        if employee:
            query["employee_id"] = employee["id"]
    elif employee_id:
        query["employee_id"] = employee_id
    
    if month:
        query["month"] = month
    if year:
        query["year"] = year
    
    payrolls = await db.payroll.find(query, {"_id": 0}).sort([("year", -1), ("month", -1)]).to_list(1000)
    result = []
    for p in payrolls:
        p.setdefault("federal_tax", p.get("tds", 0))
        p.setdefault("state_tax", 0)
        p.setdefault("social_security_employee", p.get("pf_employee", 0))
        p.setdefault("social_security_employer", p.get("pf_employer", 0))
        p.setdefault("medicare_employee", p.get("esi_employee", 0))
        p.setdefault("medicare_employer", p.get("esi_employer", 0))
        p.setdefault("state_code", None)
        result.append(PayrollResponse(**{k: v for k, v in p.items() if k in PayrollResponse.__fields__}))
    return result

@api_router.get("/payroll/{payroll_id}", response_model=PayrollResponse)
async def get_payroll(payroll_id: str, request: Request):
    user = await get_current_user(request)
    
    query = {"id": payroll_id, "org_id": user["org_id"]}
    if user["role"] == UserRole.EMPLOYEE.value:
        employee = await db.employees.find_one({"user_id": user["id"]})
        if employee:
            query["employee_id"] = employee["id"]
    
    payroll = await db.payroll.find_one(query, {"_id": 0})
    if not payroll:
        raise HTTPException(status_code=404, detail="Payroll not found")
    
    payroll.setdefault("federal_tax", payroll.get("tds", 0))
    payroll.setdefault("state_tax", 0)
    payroll.setdefault("social_security_employee", payroll.get("pf_employee", 0))
    payroll.setdefault("social_security_employer", payroll.get("pf_employer", 0))
    payroll.setdefault("medicare_employee", payroll.get("esi_employee", 0))
    payroll.setdefault("medicare_employer", payroll.get("esi_employer", 0))
    payroll.setdefault("state_code", None)
    return PayrollResponse(**{k: v for k, v in payroll.items() if k in PayrollResponse.__fields__})

# ===================== RECRUITMENT ROUTES =====================
@api_router.post("/jobs", response_model=JobPostingResponse)
async def create_job(data: JobPostingCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "org_id": user["org_id"],
        "title": data.title,
        "department": data.department,
        "location": data.location,
        "employment_type": data.employment_type,
        "description": data.description,
        "requirements": data.requirements,
        "salary_range_min": data.salary_range_min,
        "salary_range_max": data.salary_range_max,
        "is_active": True,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.jobs.insert_one(job)
    
    return JobPostingResponse(**{k: v for k, v in job.items() if k not in ["_id", "created_by"]})

@api_router.get("/jobs", response_model=List[JobPostingResponse])
async def list_jobs(request: Request, active_only: bool = True):
    user = await get_current_user(request)
    
    query = {"org_id": user["org_id"]}
    if active_only:
        query["is_active"] = True
    
    jobs = await db.jobs.find(query, {"_id": 0, "created_by": 0}).sort("created_at", -1).to_list(1000)
    return [JobPostingResponse(**j) for j in jobs]

@api_router.put("/jobs/{job_id}")
async def update_job(job_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    body = await request.json()
    update_data = {k: v for k, v in body.items() if k not in ["id", "org_id", "created_at", "created_by"]}
    
    await db.jobs.update_one(
        {"id": job_id, "org_id": user["org_id"]},
        {"$set": update_data}
    )
    
    return {"message": "Job updated"}

@api_router.post("/candidates", response_model=CandidateResponse)
async def create_candidate(data: CandidateCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    job = await db.jobs.find_one({"id": data.job_id, "org_id": user["org_id"]})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    candidate_id = str(uuid.uuid4())
    candidate = {
        "id": candidate_id,
        "job_id": data.job_id,
        "org_id": user["org_id"],
        "name": data.name,
        "email": data.email,
        "phone": data.phone,
        "resume_url": data.resume_url,
        "stage": CandidateStage.APPLIED.value,
        "notes": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.candidates.insert_one(candidate)
    
    return CandidateResponse(**{k: v for k, v in candidate.items() if k != "_id"})

@api_router.get("/candidates", response_model=List[CandidateResponse])
async def list_candidates(request: Request, job_id: Optional[str] = None, stage: Optional[str] = None):
    user = await get_current_user(request)
    
    query = {"org_id": user["org_id"]}
    if job_id:
        query["job_id"] = job_id
    if stage:
        query["stage"] = stage
    
    candidates = await db.candidates.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [CandidateResponse(**c) for c in candidates]

@api_router.put("/candidates/{candidate_id}/stage")
async def update_candidate_stage(candidate_id: str, data: CandidateStageUpdate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    update_data = {"stage": data.stage.value}
    if data.notes:
        update_data["notes"] = data.notes
    
    result = await db.candidates.update_one(
        {"id": candidate_id, "org_id": user["org_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Candidate not found")
    
    return {"message": "Candidate stage updated"}

# ===================== PROJECT ROUTES =====================
@api_router.post("/projects", response_model=ProjectResponse)
async def create_project(data: ProjectCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Only admins can create projects")
    
    if not user.get("org_id"):
        raise HTTPException(status_code=400, detail="No organization")
    
    project_id = str(uuid.uuid4())
    project = {
        "id": project_id,
        "org_id": user["org_id"],
        "name": data.name,
        "code": data.code or data.name[:3].upper() + str(uuid.uuid4())[:4].upper(),
        "description": data.description,
        "is_active": data.is_active,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.projects.insert_one(project)
    
    return ProjectResponse(**{k: v for k, v in project.items() if k not in ["_id", "created_by"]})

@api_router.get("/projects", response_model=List[ProjectResponse])
async def list_projects(request: Request, active_only: bool = True):
    user = await get_current_user(request)
    
    if not user.get("org_id"):
        return []
    
    query = {"org_id": user["org_id"]}
    if active_only:
        query["is_active"] = True
    
    projects = await db.projects.find(query, {"_id": 0, "created_by": 0}).sort("name", 1).to_list(1000)
    return [ProjectResponse(**p) for p in projects]

@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, data: ProjectCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Only admins can update projects")
    
    result = await db.projects.update_one(
        {"id": project_id, "org_id": user["org_id"]},
        {"$set": {
            "name": data.name,
            "code": data.code,
            "description": data.description,
            "is_active": data.is_active
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project updated"}

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Only admins can delete projects")
    
    # Soft delete - just mark as inactive
    result = await db.projects.update_one(
        {"id": project_id, "org_id": user["org_id"]},
        {"$set": {"is_active": False}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project deleted"}

# ===================== TIMESHEET ROUTES =====================
def get_week_start(date_str: str) -> str:
    """Get the Monday of the week for a given date"""
    date = datetime.strptime(date_str, "%Y-%m-%d")
    monday = date - timedelta(days=date.weekday())
    return monday.strftime("%Y-%m-%d")

@api_router.post("/timesheets", response_model=TimesheetEntryResponse)
async def create_timesheet_entry(data: TimesheetEntryCreate, request: Request):
    user = await get_current_user(request)
    
    # Get employee record
    employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=400, detail="Employee record not found")
    
    # Verify project exists
    project = await db.projects.find_one({"id": data.project_id, "org_id": user["org_id"], "is_active": True})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Normalize week start to Monday
    week_start = get_week_start(data.week_start_date)
    
    # Check if entry already exists for this project and week
    existing = await db.timesheets.find_one({
        "employee_id": employee["id"],
        "project_id": data.project_id,
        "week_start_date": week_start
    })
    
    total_hours = (data.monday_hours + data.tuesday_hours + data.wednesday_hours + 
                   data.thursday_hours + data.friday_hours + data.saturday_hours + data.sunday_hours)
    
    if existing:
        # Update existing entry
        await db.timesheets.update_one(
            {"id": existing["id"]},
            {"$set": {
                "monday_hours": data.monday_hours,
                "tuesday_hours": data.tuesday_hours,
                "wednesday_hours": data.wednesday_hours,
                "thursday_hours": data.thursday_hours,
                "friday_hours": data.friday_hours,
                "saturday_hours": data.saturday_hours,
                "sunday_hours": data.sunday_hours,
                "total_hours": total_hours,
                "notes": data.notes,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        timesheet_id = existing["id"]
    else:
        # Create new entry
        timesheet_id = str(uuid.uuid4())
        timesheet = {
            "id": timesheet_id,
            "employee_id": employee["id"],
            "org_id": user["org_id"],
            "project_id": data.project_id,
            "week_start_date": week_start,
            "monday_hours": data.monday_hours,
            "tuesday_hours": data.tuesday_hours,
            "wednesday_hours": data.wednesday_hours,
            "thursday_hours": data.thursday_hours,
            "friday_hours": data.friday_hours,
            "saturday_hours": data.saturday_hours,
            "sunday_hours": data.sunday_hours,
            "total_hours": total_hours,
            "notes": data.notes,
            "status": "draft",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.timesheets.insert_one(timesheet)
    
    # Fetch and return the entry
    entry = await db.timesheets.find_one({"id": timesheet_id}, {"_id": 0})
    return TimesheetEntryResponse(**entry, project_name=project["name"])

@api_router.get("/timesheets", response_model=List[TimesheetEntryResponse])
async def list_timesheets(
    request: Request,
    week_start_date: Optional[str] = None,
    employee_id: Optional[str] = None,
    status: Optional[str] = None
):
    user = await get_current_user(request)
    
    query = {"org_id": user["org_id"]}
    
    # Employees can only see their own timesheets
    if user["role"] == UserRole.EMPLOYEE.value:
        employee = await db.employees.find_one({"user_id": user["id"]})
        if employee:
            query["employee_id"] = employee["id"]
        else:
            return []
    elif employee_id:
        query["employee_id"] = employee_id
    
    if week_start_date:
        query["week_start_date"] = get_week_start(week_start_date)
    
    if status:
        query["status"] = status
    
    entries = await db.timesheets.find(query, {"_id": 0}).sort("week_start_date", -1).to_list(1000)
    
    # Enrich with project names
    result = []
    for entry in entries:
        project = await db.projects.find_one({"id": entry["project_id"]}, {"_id": 0})
        entry["project_name"] = project["name"] if project else "Unknown Project"
        result.append(TimesheetEntryResponse(**entry))
    
    return result

@api_router.get("/timesheets/week/{week_start_date}")
async def get_week_timesheets(week_start_date: str, request: Request):
    """Get all timesheet entries for a specific week for current user"""
    user = await get_current_user(request)
    
    employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    if not employee:
        return {"entries": [], "total_hours": 0}
    
    week_start = get_week_start(week_start_date)
    
    entries = await db.timesheets.find({
        "employee_id": employee["id"],
        "week_start_date": week_start
    }, {"_id": 0}).to_list(100)
    
    # Enrich with project names and calculate totals
    result = []
    total_hours = 0
    for entry in entries:
        project = await db.projects.find_one({"id": entry["project_id"]}, {"_id": 0})
        entry["project_name"] = project["name"] if project else "Unknown Project"
        total_hours += entry.get("total_hours", 0)
        result.append(entry)
    
    return {
        "week_start_date": week_start,
        "entries": result,
        "total_hours": total_hours
    }

@api_router.put("/timesheets/{timesheet_id}/submit")
async def submit_timesheet(timesheet_id: str, request: Request):
    user = await get_current_user(request)
    
    employee = await db.employees.find_one({"user_id": user["id"]})
    if not employee:
        raise HTTPException(status_code=400, detail="Employee record not found")
    
    result = await db.timesheets.update_one(
        {"id": timesheet_id, "employee_id": employee["id"], "status": "draft"},
        {"$set": {"status": "submitted", "submitted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Timesheet not found or already submitted")
    
    return {"message": "Timesheet submitted for approval"}

@api_router.put("/timesheets/{timesheet_id}/status")
async def update_timesheet_status(timesheet_id: str, data: TimesheetStatusUpdate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    update_data = {
        "status": data.status,
        "reviewed_by": user["id"],
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }
    if data.feedback:
        update_data["feedback"] = data.feedback
    
    result = await db.timesheets.update_one(
        {"id": timesheet_id, "org_id": user["org_id"]},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Timesheet not found")
    
    return {"message": f"Timesheet {data.status}"}

@api_router.delete("/timesheets/{timesheet_id}")
async def delete_timesheet(timesheet_id: str, request: Request):
    user = await get_current_user(request)
    
    employee = await db.employees.find_one({"user_id": user["id"]})
    if not employee:
        raise HTTPException(status_code=400, detail="Employee record not found")
    
    # Only allow deletion of draft timesheets
    result = await db.timesheets.delete_one({
        "id": timesheet_id,
        "employee_id": employee["id"],
        "status": "draft"
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Timesheet not found or cannot be deleted")
    
    return {"message": "Timesheet deleted"}

# ===================== FILE UPLOAD ROUTES =====================
@api_router.post("/upload")
async def upload_file(request: Request, file: UploadFile = File(...)):
    user = await get_current_user(request)
    
    ext = file.filename.split(".")[-1] if "." in file.filename else "bin"
    path = f"{APP_NAME}/uploads/{user['org_id']}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    
    result = put_object(path, data, file.content_type or "application/octet-stream")
    
    file_record = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "org_id": user["org_id"],
        "uploaded_by": user["id"],
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.files.insert_one(file_record)
    
    return {"file_id": file_record["id"], "path": result["path"], "filename": file.filename}

@api_router.get("/files/{file_id}")
async def get_file(file_id: str, request: Request):
    user = await get_current_user(request)
    
    file_record = await db.files.find_one({
        "id": file_id,
        "org_id": user["org_id"],
        "is_deleted": False
    })
    
    if not file_record:
        raise HTTPException(status_code=404, detail="File not found")
    
    data, content_type = get_object(file_record["storage_path"])
    
    return Response(
        content=data,
        media_type=file_record.get("content_type", content_type),
        headers={"Content-Disposition": f"attachment; filename={file_record['original_filename']}"}
    )

# ===================== SUBSCRIPTION ROUTES (MOCKED) =====================
@api_router.post("/subscription/checkout")
async def create_checkout(data: SubscriptionUpdate, request: Request):
    user = await get_current_user(request)
    if user["role"] != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Only admins can manage subscriptions")
    
    # Mock Razorpay checkout
    order_id = f"order_{uuid.uuid4().hex[:16]}"
    
    plan_prices = {
        SubscriptionPlan.STARTER.value: 49,
        SubscriptionPlan.PROFESSIONAL.value: 99,
        SubscriptionPlan.ENTERPRISE.value: 199
    }
    
    return {
        "order_id": order_id,
        "amount": plan_prices.get(data.plan.value, 0) * 100,
        "currency": "USD",
        "plan": data.plan.value,
        "key_id": "rzp_test_mock"
    }

@api_router.post("/subscription/verify")
async def verify_payment(request: Request):
    user = await get_current_user(request)
    body = await request.json()
    
    # Mock verification - always succeeds
    plan = body.get("plan", SubscriptionPlan.STARTER.value)
    
    await db.organizations.update_one(
        {"id": user["org_id"]},
        {"$set": {
            "subscription_plan": plan,
            "trial_ends_at": None,
            "subscription_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log subscription
    await db.subscription_logs.insert_one({
        "id": str(uuid.uuid4()),
        "org_id": user["org_id"],
        "plan": plan,
        "payment_id": body.get("payment_id", f"pay_mock_{uuid.uuid4().hex[:12]}"),
        "amount": body.get("amount", 0),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_audit(user["org_id"], user["id"], user["email"], "UPGRADE", "subscription", None, f"Upgraded to {plan}")
    
    return {"message": "Subscription activated", "plan": plan}

@api_router.get("/subscription/current")
async def get_current_subscription(request: Request):
    """Get current org plan details with limits and feature access"""
    user = await get_current_user(request)
    if not user.get("org_id"):
        return {"plan": "free_trial", "expired": False, "limits": PLAN_LIMITS["free_trial"], "employee_count": 0}
    
    plan_info = await get_org_plan(user["org_id"])
    employee_count = await db.employees.count_documents({"org_id": user["org_id"]})
    
    return {
        "plan": plan_info["plan"],
        "expired": plan_info["expired"],
        "limits": plan_info["limits"],
        "employee_count": employee_count,
        "trial_ends_at": plan_info["org"].get("trial_ends_at") if plan_info.get("org") else None
    }

# ===================== AUDIT LOGS =====================
@api_router.get("/audit-logs")
async def get_audit_logs(request: Request, page: int = 1, limit: int = 50, action: str = None, resource_type: str = None):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    query = {"org_id": user["org_id"]}
    if action:
        query["action"] = action
    if resource_type:
        query["resource_type"] = resource_type
    
    total = await db.audit_logs.count_documents(query)
    skip = (page - 1) * limit
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "logs": logs,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/subscription/plans")
async def get_plans():
    return {
        "plans": [
            {
                "id": SubscriptionPlan.FREE_TRIAL.value,
                "name": "Free Trial",
                "price": 0,
                "duration": "14 days",
                "max_employees": 5,
                "features": ["Up to 5 employees", "Basic attendance tracking", "Leave management", "Calendar view"]
            },
            {
                "id": SubscriptionPlan.STARTER.value,
                "name": "Starter",
                "price": 49,
                "duration": "monthly",
                "max_employees": 25,
                "features": ["Up to 25 employees", "All Free Trial features", "US Payroll with tax calculations", "PDF pay stubs"]
            },
            {
                "id": SubscriptionPlan.PROFESSIONAL.value,
                "name": "Professional",
                "price": 99,
                "duration": "monthly",
                "max_employees": 100,
                "features": ["Up to 100 employees", "All Starter features", "Recruitment ATS", "Timesheet management", "Bulk payroll", "Reports & exports"]
            },
            {
                "id": SubscriptionPlan.ENTERPRISE.value,
                "name": "Enterprise",
                "price": 199,
                "duration": "monthly",
                "max_employees": 999999,
                "features": ["Unlimited employees", "All Professional features", "Audit logs", "Custom integrations", "Priority support"]
            }
        ]
    }

# ===================== DASHBOARD STATS =====================
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request):
    user = await get_current_user(request)
    
    if not user.get("org_id"):
        return {
            "total_employees": 0,
            "present_today": 0,
            "pending_leaves": 0,
            "open_positions": 0
        }
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    total_employees = await db.employees.count_documents({"org_id": user["org_id"]})
    present_today = await db.attendance.count_documents({
        "org_id": user["org_id"],
        "date": today,
        "clock_in": {"$ne": None}
    })
    pending_leaves = await db.leaves.count_documents({
        "org_id": user["org_id"],
        "status": LeaveStatus.PENDING.value
    })
    open_positions = await db.jobs.count_documents({
        "org_id": user["org_id"],
        "is_active": True
    })
    
    return {
        "total_employees": total_employees,
        "present_today": present_today,
        "pending_leaves": pending_leaves,
        "open_positions": open_positions
    }

@api_router.get("/dashboard/employee-stats")
async def get_employee_dashboard_stats(request: Request):
    user = await get_current_user(request)
    
    employee = await db.employees.find_one({"user_id": user["id"]}, {"_id": 0})
    if not employee:
        return {"has_employee_record": False}
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get attendance for current month
    month_start = datetime.now(timezone.utc).replace(day=1).strftime("%Y-%m-%d")
    attendance_count = await db.attendance.count_documents({
        "employee_id": employee["id"],
        "date": {"$gte": month_start},
        "clock_in": {"$ne": None}
    })
    
    # Get leave balance
    leave_balance = await db.leave_balances.find_one({
        "employee_id": employee["id"],
        "year": datetime.now(timezone.utc).year
    }, {"_id": 0})
    
    # Get pending leaves
    pending_leaves = await db.leaves.count_documents({
        "employee_id": employee["id"],
        "status": LeaveStatus.PENDING.value
    })
    
    return {
        "has_employee_record": True,
        "employee": employee,
        "attendance_this_month": attendance_count,
        "leave_balance": leave_balance,
        "pending_leaves": pending_leaves
    }

@api_router.get("/dashboard/analytics")
async def get_dashboard_analytics(request: Request):
    """Get comprehensive analytics for admin dashboard with charts data"""
    user = await get_current_user(request)
    if user["role"] not in [UserRole.SUPER_ADMIN.value, UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    org_id = user.get("org_id")
    if not org_id:
        return {"attendance_trend": [], "leave_distribution": [], "payroll_trend": [], "recruitment_pipeline": []}
    
    now = datetime.now(timezone.utc)
    
    # Attendance trend (last 7 days)
    attendance_trend = []
    total_employees = await db.employees.count_documents({"org_id": org_id})
    for i in range(6, -1, -1):
        d = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        present = await db.attendance.count_documents({"org_id": org_id, "date": d, "clock_in": {"$ne": None}})
        attendance_trend.append({
            "date": d,
            "day": (now - timedelta(days=i)).strftime("%a"),
            "present": present,
            "absent": max(0, total_employees - present),
            "total": total_employees
        })
    
    # Leave distribution (by type + status)
    leave_types = {"CL": "Casual", "SL": "Sick", "PL": "Privilege"}
    leave_distribution = []
    for code, name in leave_types.items():
        count = await db.leaves.count_documents({"org_id": org_id, "leave_type": code})
        approved = await db.leaves.count_documents({"org_id": org_id, "leave_type": code, "status": "approved"})
        pending = await db.leaves.count_documents({"org_id": org_id, "leave_type": code, "status": "pending"})
        rejected = await db.leaves.count_documents({"org_id": org_id, "leave_type": code, "status": "rejected"})
        leave_distribution.append({"type": name, "code": code, "total": count, "approved": approved, "pending": pending, "rejected": rejected})
    
    # Payroll trend (last 6 months)
    payroll_trend = []
    for i in range(5, -1, -1):
        m = now.month - i
        y = now.year
        while m <= 0:
            m += 12
            y -= 1
        month_payrolls = await db.payroll.find({"org_id": org_id, "month": m, "year": y}, {"_id": 0}).to_list(1000)
        total_gross = sum(p.get("gross_salary", 0) for p in month_payrolls)
        total_net = sum(p.get("net_salary", 0) for p in month_payrolls)
        total_deductions = sum(p.get("total_deductions", 0) for p in month_payrolls)
        month_names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
        payroll_trend.append({
            "month": month_names[m - 1],
            "year": y,
            "gross": total_gross,
            "net": total_net,
            "deductions": total_deductions,
            "count": len(month_payrolls)
        })
    
    # Recruitment pipeline
    jobs = await db.jobs.find({"org_id": org_id, "is_active": True}, {"_id": 0}).to_list(100)
    pipeline_stages = {"applied": 0, "screening": 0, "interview": 0, "offer": 0, "hired": 0, "rejected": 0}
    for job in jobs:
        candidates = await db.candidates.find({"job_id": job["id"]}, {"_id": 0}).to_list(1000)
        for c in candidates:
            stage = c.get("stage", "applied")
            if stage in pipeline_stages:
                pipeline_stages[stage] += 1
    
    recruitment_pipeline = [{"stage": k.capitalize(), "count": v} for k, v in pipeline_stages.items() if k != "rejected"]
    
    return {
        "attendance_trend": attendance_trend,
        "leave_distribution": leave_distribution,
        "payroll_trend": payroll_trend,
        "recruitment_pipeline": recruitment_pipeline,
        "summary": {
            "total_employees": total_employees,
            "total_payroll_this_month": sum(p.get("net_salary", 0) for p in await db.payroll.find({"org_id": org_id, "month": now.month, "year": now.year}, {"_id": 0}).to_list(1000)),
            "open_positions": len(jobs),
            "total_candidates": sum(pipeline_stages.values())
        }
    }

# ===================== SUPER ADMIN - TENANT MANAGEMENT =====================
class CreateTenantRequest(BaseModel):
    company_name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    admin_name: str
    admin_email: str
    admin_password: str
    plan: str = "free_trial"

@api_router.get("/admin/tenants")
async def list_all_tenants(request: Request):
    user = await get_current_user(request)
    if user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    orgs = await db.organizations.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    result = []
    for org in orgs:
        emp_count = await db.employees.count_documents({"org_id": org["id"]})
        user_count = await db.users.count_documents({"org_id": org["id"]})
        admin_user = await db.users.find_one({"org_id": org["id"], "role": {"$in": ["admin", "hr"]}}, {"_id": 0, "password_hash": 0})
        result.append({
            "id": org["id"],
            "name": org.get("name", ""),
            "domain": org.get("domain", ""),
            "industry": org.get("industry", ""),
            "subscription_plan": org.get("subscription_plan", "free_trial"),
            "trial_ends_at": org.get("trial_ends_at"),
            "is_active": org.get("is_active", True),
            "employee_count": emp_count,
            "user_count": user_count,
            "admin_email": admin_user["email"] if admin_user else None,
            "admin_name": admin_user["name"] if admin_user else None,
            "created_at": org.get("created_at", ""),
        })
    return result

@api_router.get("/admin/tenants/{org_id}")
async def get_tenant_details(org_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    employees = await db.employees.find({"org_id": org_id}, {"_id": 0}).to_list(1000)
    users = await db.users.find({"org_id": org_id}, {"_id": 0, "password_hash": 0}).to_list(1000)
    
    emp_count = len(employees)
    payroll_count = await db.payroll.count_documents({"org_id": org_id})
    leave_count = await db.leaves.count_documents({"org_id": org_id})
    job_count = await db.jobs.count_documents({"org_id": org_id})
    
    plan_info = await get_org_plan(org_id)
    
    return {
        "organization": org,
        "users": users,
        "employee_count": emp_count,
        "payroll_count": payroll_count,
        "leave_count": leave_count,
        "job_count": job_count,
        "plan_info": {
            "plan": plan_info["plan"],
            "expired": plan_info["expired"],
            "max_employees": plan_info["limits"]["max_employees"],
            "features": plan_info["limits"]["features"]
        }
    }

@api_router.post("/admin/tenants")
async def create_tenant(data: CreateTenantRequest, request: Request):
    user = await get_current_user(request)
    if user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    # Check if admin email already exists
    existing_user = await db.users.find_one({"email": data.admin_email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Admin email already exists")
    
    # Create organization
    org_id = str(uuid.uuid4())
    trial_ends = datetime.now(timezone.utc) + timedelta(days=14)
    org = {
        "id": org_id,
        "name": data.company_name,
        "domain": data.domain or "",
        "industry": data.industry or "",
        "subscription_plan": data.plan,
        "trial_ends_at": trial_ends.isoformat() if data.plan == "free_trial" else None,
        "is_active": True,
        "owner_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.organizations.insert_one(org)
    
    # Create admin user for this org
    admin_id = str(uuid.uuid4())
    admin_user = {
        "id": admin_id,
        "email": data.admin_email,
        "name": data.admin_name,
        "password_hash": hash_password(data.admin_password),
        "role": UserRole.ADMIN.value,
        "org_id": org_id,
        "employee_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(admin_user)
    
    # Update owner
    await db.organizations.update_one({"id": org_id}, {"$set": {"owner_id": admin_id}})
    
    # Create default leave policy
    await db.leave_policies.insert_one({
        "id": str(uuid.uuid4()),
        "org_id": org_id,
        "casual_leave": 12,
        "sick_leave": 12,
        "privilege_leave": 15,
        "year": datetime.now(timezone.utc).year,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    await log_audit(None, user["id"], user["email"], "CREATE", "tenant", org_id, f"Created tenant: {data.company_name} with admin {data.admin_email}")
    
    return {"message": "Tenant created", "org_id": org_id, "admin_email": data.admin_email}

@api_router.put("/admin/tenants/{org_id}/status")
async def toggle_tenant_status(org_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    new_status = not org.get("is_active", True)
    await db.organizations.update_one({"id": org_id}, {"$set": {"is_active": new_status}})
    
    action = "ACTIVATE" if new_status else "DEACTIVATE"
    await log_audit(None, user["id"], user["email"], action, "tenant", org_id, f"{action} tenant: {org['name']}")
    
    return {"message": f"Tenant {'activated' if new_status else 'deactivated'}", "is_active": new_status}

@api_router.put("/admin/tenants/{org_id}/plan")
async def change_tenant_plan(org_id: str, request: Request):
    user = await get_current_user(request)
    if user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    body = await request.json()
    plan = body.get("plan")
    if plan not in [p.value for p in SubscriptionPlan]:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    update = {"subscription_plan": plan}
    if plan == "free_trial":
        update["trial_ends_at"] = (datetime.now(timezone.utc) + timedelta(days=14)).isoformat()
    else:
        update["trial_ends_at"] = None
    
    await db.organizations.update_one({"id": org_id}, {"$set": update})
    await log_audit(None, user["id"], user["email"], "UPDATE", "tenant", org_id, f"Changed plan for {org['name']} to {plan}")
    
    return {"message": f"Plan updated to {plan}"}

@api_router.post("/admin/impersonate/{org_id}")
async def impersonate_org_admin(org_id: str, request: Request, response: Response):
    user = await get_current_user(request)
    if user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    org = await db.organizations.find_one({"id": org_id}, {"_id": 0})
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    
    # Find the org admin
    admin_user = await db.users.find_one({"org_id": org_id, "role": {"$in": ["admin", "hr"]}}, {"_id": 0})
    if not admin_user:
        raise HTTPException(status_code=404, detail="No admin user found for this organization")
    
    # Create tokens as the org admin
    access_token = create_access_token(admin_user["id"], admin_user["email"], admin_user["role"], org_id)
    refresh_token = create_refresh_token(admin_user["id"])
    
    is_preview = ".preview.emergentagent.com" in str(request.base_url) or ".emergentagent.com" in str(request.base_url)
    
    response.set_cookie("access_token", access_token, httponly=True, secure=True, samesite="none", max_age=3600)
    response.set_cookie("refresh_token", refresh_token, httponly=True, secure=True, samesite="none", max_age=604800)
    
    await log_audit(None, user["id"], user["email"], "IMPERSONATE", "tenant", org_id, f"Impersonated admin of {org['name']}")
    
    return {
        "message": f"Now logged in as {admin_user['email']} ({org['name']})",
        "id": admin_user["id"],
        "email": admin_user["email"],
        "name": admin_user["name"],
        "role": admin_user["role"],
        "org_id": org_id,
        "employee_id": admin_user.get("employee_id"),
        "impersonated": True
    }

@api_router.get("/admin/stats")
async def get_platform_stats(request: Request):
    user = await get_current_user(request)
    if user["role"] != UserRole.SUPER_ADMIN.value:
        raise HTTPException(status_code=403, detail="Super admin access required")
    
    total_orgs = await db.organizations.count_documents({})
    active_orgs = await db.organizations.count_documents({"is_active": {"$ne": False}})
    total_users = await db.users.count_documents({})
    total_employees = await db.employees.count_documents({})
    
    plan_dist = {}
    for plan in ["free_trial", "starter", "professional", "enterprise"]:
        plan_dist[plan] = await db.organizations.count_documents({"subscription_plan": plan})
    
    return {
        "total_orgs": total_orgs,
        "active_orgs": active_orgs,
        "total_users": total_users,
        "total_employees": total_employees,
        "plan_distribution": plan_dist
    }

# ===================== HEALTH CHECK =====================
@api_router.get("/")
async def root():
    return {"message": "TalentOps HRMS API", "status": "running"}

@api_router.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

# CORS Configuration
frontend_url = os.environ.get('FRONTEND_URL', 'https://talent-ops-12.preview.emergentagent.com')
cors_origins = os.environ.get('CORS_ORIGINS', frontend_url)
origins = [o.strip() for o in cors_origins.split(',') if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup():
    logger.info("Starting TalentOps HRMS API...")
    
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.organizations.create_index("id", unique=True)
    await db.employees.create_index("id", unique=True)
    await db.employees.create_index([("org_id", 1), ("user_id", 1)])
    await db.attendance.create_index([("employee_id", 1), ("date", 1)])
    await db.leaves.create_index([("org_id", 1), ("status", 1)])
    await db.payroll.create_index([("employee_id", 1), ("month", 1), ("year", 1)], unique=True)
    await db.jobs.create_index([("org_id", 1), ("is_active", 1)])
    await db.candidates.create_index([("org_id", 1), ("job_id", 1)])
    await db.login_attempts.create_index("identifier")
    
    # Initialize storage
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.warning(f"Storage init failed: {e}")
    
    # Seed admin user
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@talentops.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id,
            "email": admin_email,
            "name": "Super Admin",
            "password_hash": hash_password(admin_password),
            "role": UserRole.SUPER_ADMIN.value,
            "org_id": None,
            "employee_id": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user created: {admin_email}")
    
    # Write test credentials
    Path("/app/memory").mkdir(exist_ok=True)
    with open("/app/memory/test_credentials.md", "w") as f:
        f.write(f"""# Test Credentials

## Super Admin
- Email: {admin_email}
- Password: {admin_password}
- Role: super_admin

## Auth Endpoints
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/refresh
""")
    
    logger.info("TalentOps HRMS API started successfully")

@app.on_event("shutdown")
async def shutdown():
    client.close()
    logger.info("Database connection closed")
