"""
Test Suite for Free Trial Plan Feature Gating
Tests: Feature blocking on free_trial plan, 403 responses, employee limit enforcement
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
HR_EMAIL = "hr@acmecorp.com"
HR_PASSWORD = "password123"
ORG_ID = "95e97e99-55d5-4f38-bcbd-72fdcebe3fbb"


class TestFreeTrial_FeatureGating:
    """Test feature gating when org is on free_trial plan"""
    
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
    
    def test_01_verify_free_trial_plan(self):
        """Verify org is on free_trial plan"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/subscription/current")
        assert response.status_code == 200
        data = response.json()
        assert data["plan"] == "free_trial", f"Expected free_trial, got {data['plan']}"
        print(f"✓ Org is on free_trial plan")
        print(f"✓ Features: {data['limits']['features']}")
    
    def test_02_payroll_blocked_on_free_trial(self):
        """Test 10: POST /api/payroll blocked with 403 PLAN_UPGRADE_REQUIRED"""
        self.login_as_hr()
        
        # Try to generate payroll
        response = self.session.post(f"{BASE_URL}/api/payroll/generate", json={
            "employee_id": "test-emp-id",
            "month": 4,
            "year": 2026
        })
        
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("code") == "PLAN_UPGRADE_REQUIRED", f"Expected PLAN_UPGRADE_REQUIRED, got {data}"
        print(f"✓ Payroll blocked with 403 PLAN_UPGRADE_REQUIRED")
    
    def test_03_payroll_list_blocked_on_free_trial(self):
        """Test: GET /api/payroll blocked on free_trial"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/payroll")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Payroll list blocked with 403")
    
    def test_04_audit_logs_blocked_on_free_trial(self):
        """Test 13: Audit logs blocked on free_trial (requires Enterprise)"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/audit-logs")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("code") == "PLAN_UPGRADE_REQUIRED"
        print(f"✓ Audit logs blocked with 403 PLAN_UPGRADE_REQUIRED")
    
    def test_05_recruitment_jobs_blocked_on_free_trial(self):
        """Test 14: Recruitment (jobs) blocked on free_trial (requires Professional)"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        data = response.json()
        assert data.get("code") == "PLAN_UPGRADE_REQUIRED"
        print(f"✓ Jobs blocked with 403 PLAN_UPGRADE_REQUIRED")
    
    def test_06_recruitment_candidates_blocked_on_free_trial(self):
        """Test: Candidates blocked on free_trial"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/candidates")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Candidates blocked with 403")
    
    def test_07_timesheets_blocked_on_free_trial(self):
        """Test 11: Timesheets blocked on free_trial"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/timesheets")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Timesheets blocked with 403")
    
    def test_08_projects_blocked_on_free_trial(self):
        """Test 11: Projects blocked on free_trial"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 403, f"Expected 403, got {response.status_code}"
        print(f"✓ Projects blocked with 403")
    
    def test_09_dashboard_still_accessible(self):
        """Test 15: Dashboard still accessible on free_trial"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200, f"Dashboard should be accessible: {response.text}"
        print(f"✓ Dashboard accessible on free_trial")
    
    def test_10_employees_still_accessible(self):
        """Test 15: Employees still accessible on free_trial"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200, f"Employees should be accessible: {response.text}"
        print(f"✓ Employees accessible on free_trial")
    
    def test_11_attendance_still_accessible(self):
        """Test 15: Attendance still accessible on free_trial"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/attendance")
        assert response.status_code == 200, f"Attendance should be accessible: {response.text}"
        print(f"✓ Attendance accessible on free_trial")
    
    def test_12_leaves_still_accessible(self):
        """Test 15: Leaves still accessible on free_trial"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/leaves")
        assert response.status_code == 200, f"Leaves should be accessible: {response.text}"
        print(f"✓ Leaves accessible on free_trial")
    
    def test_13_employee_limit_check(self):
        """Test 16: Check employee limit on free_trial (5 max)"""
        self.login_as_hr()
        response = self.session.get(f"{BASE_URL}/api/subscription/current")
        assert response.status_code == 200
        data = response.json()
        
        assert data["limits"]["max_employees"] == 5, f"Free trial should have 5 max employees"
        print(f"✓ Free trial max employees: 5")
        print(f"✓ Current employee count: {data['employee_count']}")
        
        # Currently 1 employee, should be able to add more (up to 5)
        can_add = data["employee_count"] < data["limits"]["max_employees"]
        print(f"✓ Can add more employees: {can_add}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
