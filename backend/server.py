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
    pf_employee: float
    pf_employer: float
    esi_employee: float
    esi_employer: float
    professional_tax: float
    tds: float
    total_deductions: float
    net_salary: float
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

# India Payroll Calculations
def calculate_pf(basic: float) -> tuple:
    """Calculate PF contributions (employee and employer)"""
    pf_base = min(basic, 15000)  # PF ceiling
    employee_pf = pf_base * 0.12
    employer_pf = pf_base * 0.12
    return round(employee_pf, 2), round(employer_pf, 2)

def calculate_esi(gross: float) -> tuple:
    """Calculate ESI contributions if applicable"""
    if gross > 21000:  # ESI not applicable above 21k
        return 0, 0
    employee_esi = gross * 0.0075
    employer_esi = gross * 0.0325
    return round(employee_esi, 2), round(employer_esi, 2)

def calculate_professional_tax(gross: float) -> float:
    """Calculate Professional Tax (Karnataka rates)"""
    if gross <= 15000:
        return 0
    elif gross <= 20000:
        return 150
    else:
        return 200

def calculate_tds(annual_income: float) -> float:
    """Calculate TDS based on new tax regime"""
    if annual_income <= 300000:
        return 0
    elif annual_income <= 700000:
        return (annual_income - 300000) * 0.05
    elif annual_income <= 1000000:
        return 20000 + (annual_income - 700000) * 0.10
    elif annual_income <= 1200000:
        return 50000 + (annual_income - 1000000) * 0.15
    elif annual_income <= 1500000:
        return 80000 + (annual_income - 1200000) * 0.20
    else:
        return 140000 + (annual_income - 1500000) * 0.30

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
        "salary_basic": 0,
        "salary_hra": 0,
        "salary_allowances": 0,
        "documents": [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.employees.insert_one(employee)
    
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
@api_router.post("/payroll/generate", response_model=PayrollResponse)
async def generate_payroll(data: PayrollCreate, request: Request):
    user = await get_current_user(request)
    if user["role"] not in [UserRole.ADMIN.value, UserRole.HR.value]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    employee = await db.employees.find_one({"id": data.employee_id, "org_id": user["org_id"]}, {"_id": 0})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    emp_user = await db.users.find_one({"id": employee["user_id"]}, {"_id": 0})
    
    # Check if payroll already exists
    existing = await db.payroll.find_one({
        "employee_id": data.employee_id,
        "month": data.month,
        "year": data.year
    })
    if existing:
        raise HTTPException(status_code=400, detail="Payroll already generated for this month")
    
    basic = employee.get("salary_basic", 0)
    hra = employee.get("salary_hra", 0)
    allowances = employee.get("salary_allowances", 0)
    gross = basic + hra + allowances
    
    # Calculate deductions
    pf_employee, pf_employer = calculate_pf(basic)
    esi_employee, esi_employer = calculate_esi(gross)
    professional_tax = calculate_professional_tax(gross)
    
    annual_income = gross * 12
    annual_tds = calculate_tds(annual_income)
    monthly_tds = round(annual_tds / 12, 2)
    
    total_deductions = pf_employee + esi_employee + professional_tax + monthly_tds
    net_salary = round(gross - total_deductions, 2)
    
    payroll_id = str(uuid.uuid4())
    payroll = {
        "id": payroll_id,
        "employee_id": data.employee_id,
        "employee_name": emp_user["name"] if emp_user else "Unknown",
        "org_id": user["org_id"],
        "month": data.month,
        "year": data.year,
        "basic": basic,
        "hra": hra,
        "allowances": allowances,
        "gross_salary": gross,
        "pf_employee": pf_employee,
        "pf_employer": pf_employer,
        "esi_employee": esi_employee,
        "esi_employer": esi_employer,
        "professional_tax": professional_tax,
        "tds": monthly_tds,
        "total_deductions": total_deductions,
        "net_salary": net_salary,
        "status": "generated",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payroll.insert_one(payroll)
    
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
    return [PayrollResponse(**p) for p in payrolls]

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
    
    return PayrollResponse(**payroll)

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
        SubscriptionPlan.STARTER.value: 999,
        SubscriptionPlan.PROFESSIONAL.value: 2499,
        SubscriptionPlan.ENTERPRISE.value: 4999
    }
    
    return {
        "order_id": order_id,
        "amount": plan_prices.get(data.plan.value, 0) * 100,  # In paise
        "currency": "INR",
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
    
    return {"message": "Subscription activated", "plan": plan}

@api_router.get("/subscription/plans")
async def get_plans():
    return {
        "plans": [
            {
                "id": SubscriptionPlan.FREE_TRIAL.value,
                "name": "Free Trial",
                "price": 0,
                "duration": "14 days",
                "features": ["Up to 10 employees", "Basic attendance", "Leave management"]
            },
            {
                "id": SubscriptionPlan.STARTER.value,
                "name": "Starter",
                "price": 999,
                "duration": "monthly",
                "features": ["Up to 25 employees", "Full attendance", "Leave management", "Basic payroll"]
            },
            {
                "id": SubscriptionPlan.PROFESSIONAL.value,
                "name": "Professional",
                "price": 2499,
                "duration": "monthly",
                "features": ["Up to 100 employees", "All Starter features", "Full payroll", "Recruitment ATS", "Email notifications"]
            },
            {
                "id": SubscriptionPlan.ENTERPRISE.value,
                "name": "Enterprise",
                "price": 4999,
                "duration": "monthly",
                "features": ["Unlimited employees", "All Professional features", "Custom integrations", "Priority support", "Audit logs"]
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
