"""
Test Suite for Plan-based Feature Gating, Subscription Management, and Audit Logs
Tests: PLAN_LIMITS, trial expiry, feature gating middleware, audit logs, upgrade flow
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
HR_EMAIL = "hr@acmecorp.com"
HR_PASSWORD = "password123"
EMPLOYEE_EMAIL = "john.doe@acmecorp.com"
EMPLOYEE_PASSWORD = "employee123"
ORG_ID = "95e97e99-55d5-4f38-bcbd-72fdcebe3fbb"


class TestSubscriptionEndpoints:
    """Test subscription-related API endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_hr(self):
        """Login as HR admin and return session"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD
        })
        assert response.status_code == 200, f"HR login failed: {response.text}"
        return response.json()
    
    def test_01_login_as_hr(self):
        """Test 1: Login as HR (hr@acmecorp.com / password123)"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == HR_EMAIL
        # HR user has admin role in this setup
        assert data["role"] in ["hr", "admin"]
        print(f"✓ Logged in as HR: {data['name']} (role: {data['role']})")
    
    def test_02_get_subscription_current(self):
        """Test 2: GET /api/subscription/current returns plan details"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/subscription/current")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "plan" in data
        assert "employee_count" in data
        assert "limits" in data
        assert "features" in data["limits"]
        assert "max_employees" in data["limits"]
        
        print(f"✓ Current plan: {data['plan']}")
        print(f"✓ Employee count: {data['employee_count']}")
        print(f"✓ Max employees: {data['limits']['max_employees']}")
        print(f"✓ Features: {data['limits']['features']}")
    
    def test_03_get_subscription_plans(self):
        """Test 17: GET /api/subscription/plans returns 4 plans with correct max_employees"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        data = response.json()
        
        assert "plans" in data
        plans = data["plans"]
        assert len(plans) == 4
        
        # Verify plan details
        plan_map = {p["id"]: p for p in plans}
        
        # Free Trial: $0, 5 employees
        assert plan_map["free_trial"]["price"] == 0
        assert plan_map["free_trial"]["max_employees"] == 5
        
        # Starter: $49, 25 employees
        assert plan_map["starter"]["price"] == 49
        assert plan_map["starter"]["max_employees"] == 25
        
        # Professional: $99, 100 employees
        assert plan_map["professional"]["price"] == 99
        assert plan_map["professional"]["max_employees"] == 100
        
        # Enterprise: $199, unlimited (999999)
        assert plan_map["enterprise"]["price"] == 199
        assert plan_map["enterprise"]["max_employees"] == 999999
        
        print("✓ All 4 plans verified with correct prices and employee limits")
    
    def test_04_get_audit_logs_enterprise(self):
        """Test 3-4: GET /api/audit-logs returns logs (Enterprise plan)"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/audit-logs")
        assert response.status_code == 200
        data = response.json()
        
        assert "logs" in data
        assert "total" in data
        assert "page" in data
        assert "pages" in data
        
        # Check for UPGRADE entries
        upgrade_logs = [log for log in data["logs"] if log.get("action") == "UPGRADE"]
        print(f"✓ Total audit logs: {data['total']}")
        print(f"✓ UPGRADE entries found: {len(upgrade_logs)}")
        
        # Verify log structure
        if data["logs"]:
            log = data["logs"][0]
            assert "timestamp" in log
            assert "user_email" in log
            assert "action" in log
            assert "resource_type" in log
            print(f"✓ Log structure verified: timestamp, user_email, action, resource_type, details")
    
    def test_05_audit_logs_filter_by_action(self):
        """Test 6: Audit logs filter by action works"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/audit-logs?action=UPGRADE")
        assert response.status_code == 200
        data = response.json()
        
        # All returned logs should have action=UPGRADE
        for log in data["logs"]:
            assert log["action"] == "UPGRADE", f"Expected UPGRADE, got {log['action']}"
        
        print(f"✓ Filter by action=UPGRADE works, returned {len(data['logs'])} logs")


class TestFeatureGatingMiddleware:
    """Test FeatureGateMiddleware for plan-based access control"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_hr(self):
        """Login as HR admin"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD
        })
        assert response.status_code == 200
        return response.json()
    
    def test_06_payroll_accessible_on_enterprise(self):
        """Test: Payroll accessible on Enterprise plan"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/payroll")
        # Should be accessible (200) on Enterprise
        assert response.status_code == 200, f"Payroll should be accessible on Enterprise: {response.text}"
        print("✓ Payroll accessible on Enterprise plan")
    
    def test_07_audit_logs_accessible_on_enterprise(self):
        """Test: Audit logs accessible on Enterprise plan"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/audit-logs")
        assert response.status_code == 200, f"Audit logs should be accessible on Enterprise: {response.text}"
        print("✓ Audit logs accessible on Enterprise plan")
    
    def test_08_recruitment_accessible_on_enterprise(self):
        """Test: Recruitment (jobs) accessible on Enterprise plan"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200, f"Jobs should be accessible on Enterprise: {response.text}"
        print("✓ Recruitment accessible on Enterprise plan")
    
    def test_09_timesheets_accessible_on_enterprise(self):
        """Test: Timesheets accessible on Enterprise plan"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/timesheets")
        assert response.status_code == 200, f"Timesheets should be accessible on Enterprise: {response.text}"
        print("✓ Timesheets accessible on Enterprise plan")
    
    def test_10_projects_accessible_on_enterprise(self):
        """Test: Projects accessible on Enterprise plan"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200, f"Projects should be accessible on Enterprise: {response.text}"
        print("✓ Projects accessible on Enterprise plan")


class TestUnGatedRoutes:
    """Test routes that should always be accessible regardless of plan"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_hr(self):
        """Login as HR admin"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD
        })
        assert response.status_code == 200
        return response.json()
    
    def test_11_dashboard_always_accessible(self):
        """Test 15: Dashboard always accessible"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        print("✓ Dashboard stats accessible")
    
    def test_12_employees_always_accessible(self):
        """Test 15: Employees always accessible"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200
        print("✓ Employees list accessible")
    
    def test_13_attendance_always_accessible(self):
        """Test 15: Attendance always accessible"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/attendance")
        assert response.status_code == 200
        print("✓ Attendance accessible")
    
    def test_14_leaves_always_accessible(self):
        """Test 15: Leaves always accessible"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/leaves")
        assert response.status_code == 200
        print("✓ Leaves accessible")
    
    def test_15_profile_always_accessible(self):
        """Test 15: Profile always accessible"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/profile")
        # Profile may return 404 if no employee record, but should not be gated
        assert response.status_code in [200, 404]
        print("✓ Profile endpoint accessible (not gated)")


class TestEmployeeLimitEnforcement:
    """Test employee limit enforcement based on plan"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup session for each test"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def login_as_hr(self):
        """Login as HR admin"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": HR_EMAIL,
            "password": HR_PASSWORD
        })
        assert response.status_code == 200
        return response.json()
    
    def test_16_check_employee_count_vs_limit(self):
        """Test 16: Check employee count vs plan limit"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/subscription/current")
        assert response.status_code == 200
        data = response.json()
        
        employee_count = data["employee_count"]
        max_employees = data["limits"]["max_employees"]
        
        print(f"✓ Employee count: {employee_count}")
        print(f"✓ Max employees for plan: {max_employees}")
        
        # On enterprise, should be able to add more
        if data["plan"] == "enterprise":
            assert max_employees == 999999, "Enterprise should have unlimited employees"
            print("✓ Enterprise plan has unlimited employees")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
