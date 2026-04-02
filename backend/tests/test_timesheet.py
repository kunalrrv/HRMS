"""
Timesheet API Tests
Tests for timesheet management endpoints including:
- Employee timesheet entry
- Admin approval workflow
- Status filtering
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
HR_ADMIN_EMAIL = "hr@acmecorp.com"
HR_ADMIN_PASSWORD = "password123"
EMPLOYEE_EMAIL = "john.doe@acmecorp.com"
EMPLOYEE_PASSWORD = "employee123"

# Known test data IDs from seed
SUBMITTED_TIMESHEET_ID = "38651c0f-c28b-4445-9639-5134c7bdf267"
APPROVED_TIMESHEET_ID = "258b17f7-2a9d-467b-b004-830641353817"


@pytest.fixture(scope="module")
def hr_session():
    """Create authenticated session for HR admin"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": HR_ADMIN_EMAIL,
        "password": HR_ADMIN_PASSWORD
    })
    
    if response.status_code != 200:
        pytest.skip(f"HR Admin login failed: {response.status_code} - {response.text}")
    
    return session


@pytest.fixture(scope="module")
def employee_session():
    """Create authenticated session for employee"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": EMPLOYEE_EMAIL,
        "password": EMPLOYEE_PASSWORD
    })
    
    if response.status_code != 200:
        pytest.skip(f"Employee login failed: {response.status_code} - {response.text}")
    
    return session


class TestTimesheetEmployeeFlow:
    """Tests for employee timesheet operations"""
    
    def test_get_projects(self, employee_session):
        """Test that employee can fetch available projects"""
        response = employee_session.get(f"{BASE_URL}/api/projects")
        
        assert response.status_code == 200, f"Failed to get projects: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Projects should be a list"
        print(f"Found {len(data)} projects")
    
    def test_get_week_timesheets(self, employee_session):
        """Test fetching timesheets for current week"""
        response = employee_session.get(f"{BASE_URL}/api/timesheets/week/2026-03-30")
        
        assert response.status_code == 200, f"Failed to get week timesheets: {response.text}"
        
        data = response.json()
        assert "entries" in data, "Response should have entries field"
        assert "total_hours" in data, "Response should have total_hours field"
        print(f"Week has {len(data['entries'])} entries, total {data['total_hours']} hours")
    
    def test_get_all_timesheets_employee(self, employee_session):
        """Test that employee can list their timesheets"""
        response = employee_session.get(f"{BASE_URL}/api/timesheets")
        
        assert response.status_code == 200, f"Failed to get timesheets: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Timesheets should be a list"
        print(f"Employee has {len(data)} timesheet entries")


class TestTimesheetAdminFlow:
    """Tests for admin timesheet approval workflow"""
    
    def test_get_submitted_timesheets(self, hr_session):
        """Test fetching submitted timesheets for approval"""
        response = hr_session.get(f"{BASE_URL}/api/timesheets?status=submitted")
        
        assert response.status_code == 200, f"Failed to get submitted timesheets: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Timesheets should be a list"
        print(f"Found {len(data)} submitted timesheets")
        
        # Verify structure of timesheet entries
        if len(data) > 0:
            ts = data[0]
            assert "id" in ts, "Timesheet should have id"
            assert "employee_id" in ts, "Timesheet should have employee_id"
            assert "project_name" in ts, "Timesheet should have project_name"
            assert "total_hours" in ts, "Timesheet should have total_hours"
            assert "status" in ts, "Timesheet should have status"
            print(f"First submitted timesheet: {ts['project_name']}, {ts['total_hours']}h, status: {ts['status']}")
    
    def test_get_approved_timesheets(self, hr_session):
        """Test fetching approved timesheets"""
        response = hr_session.get(f"{BASE_URL}/api/timesheets?status=approved")
        
        assert response.status_code == 200, f"Failed to get approved timesheets: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Timesheets should be a list"
        print(f"Found {len(data)} approved timesheets")
        
        # Verify all returned entries are approved
        for ts in data:
            assert ts["status"] == "approved", f"Expected approved status, got {ts['status']}"
    
    def test_get_employees_list(self, hr_session):
        """Test that admin can fetch employees list"""
        response = hr_session.get(f"{BASE_URL}/api/employees")
        
        assert response.status_code == 200, f"Failed to get employees: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Employees should be a list"
        print(f"Found {len(data)} employees")
    
    def test_get_projects_admin(self, hr_session):
        """Test that admin can fetch all projects"""
        response = hr_session.get(f"{BASE_URL}/api/projects?active_only=false")
        
        assert response.status_code == 200, f"Failed to get projects: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Projects should be a list"
        print(f"Found {len(data)} projects")


class TestTimesheetApprovalWorkflow:
    """Tests for the approval/rejection workflow"""
    
    def test_approve_timesheet(self, hr_session):
        """Test approving a submitted timesheet"""
        # First check if there's a submitted timesheet to approve
        response = hr_session.get(f"{BASE_URL}/api/timesheets?status=submitted")
        assert response.status_code == 200
        
        submitted = response.json()
        if len(submitted) == 0:
            pytest.skip("No submitted timesheets to approve")
        
        timesheet_id = submitted[0]["id"]
        print(f"Approving timesheet: {timesheet_id}")
        
        # Approve the timesheet
        response = hr_session.put(f"{BASE_URL}/api/timesheets/{timesheet_id}/status", json={
            "status": "approved",
            "feedback": "Approved via automated test"
        })
        
        assert response.status_code == 200, f"Failed to approve timesheet: {response.text}"
        
        data = response.json()
        assert "message" in data, "Response should have message"
        print(f"Approval response: {data['message']}")
        
        # Verify it's now in approved list
        response = hr_session.get(f"{BASE_URL}/api/timesheets?status=approved")
        assert response.status_code == 200
        
        approved = response.json()
        approved_ids = [ts["id"] for ts in approved]
        assert timesheet_id in approved_ids, "Approved timesheet should appear in approved list"
        print(f"Verified timesheet {timesheet_id} is now approved")


class TestTimesheetDataIntegrity:
    """Tests for data integrity and validation"""
    
    def test_timesheet_hours_calculation(self, hr_session):
        """Verify total hours calculation is correct"""
        response = hr_session.get(f"{BASE_URL}/api/timesheets?status=approved")
        assert response.status_code == 200
        
        timesheets = response.json()
        for ts in timesheets:
            expected_total = (
                ts.get("monday_hours", 0) +
                ts.get("tuesday_hours", 0) +
                ts.get("wednesday_hours", 0) +
                ts.get("thursday_hours", 0) +
                ts.get("friday_hours", 0) +
                ts.get("saturday_hours", 0) +
                ts.get("sunday_hours", 0)
            )
            assert ts["total_hours"] == expected_total, f"Total hours mismatch for {ts['id']}"
        
        print(f"Verified hours calculation for {len(timesheets)} timesheets")
    
    def test_unauthorized_access(self):
        """Test that unauthenticated requests are rejected"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/timesheets")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Unauthorized access correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
