"""
Test Employee Self-Service Profile APIs
Tests for /api/profile and /api/profile/history endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://talent-ops-12.preview.emergentagent.com').rstrip('/')

# Test credentials
EMPLOYEE_EMAIL = "john.doe@acmecorp.com"
EMPLOYEE_PASSWORD = "employee123"
HR_ADMIN_EMAIL = "hr@acmecorp.com"
HR_ADMIN_PASSWORD = "password123"


class TestEmployeeLogin:
    """Test employee login and authentication"""
    
    def test_employee_login_success(self):
        """Test 1: Login as employee"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EMPLOYEE_EMAIL, "password": EMPLOYEE_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert data.get("email") == EMPLOYEE_EMAIL
        assert data.get("role") == "employee"
        assert data.get("employee_id") is not None
        print(f"✓ Employee login successful: {data.get('name')}")


class TestProfileAPI:
    """Test /api/profile endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session cookies"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EMPLOYEE_EMAIL, "password": EMPLOYEE_PASSWORD}
        )
        assert response.status_code == 200, "Login failed"
    
    def test_get_profile_returns_employee_data(self):
        """Test 11: GET /api/profile returns employee data with phone, address, state_code"""
        response = self.session.get(f"{BASE_URL}/api/profile")
        assert response.status_code == 200, f"GET profile failed: {response.text}"
        
        data = response.json()
        # Verify required fields exist
        assert "phone" in data, "phone field missing"
        assert "address" in data, "address field missing"
        assert "state_code" in data, "state_code field missing"
        assert "department" in data, "department field missing"
        assert "designation" in data, "designation field missing"
        assert "employee_code" in data, "employee_code field missing"
        assert "emergency_contact" in data, "emergency_contact field missing"
        
        print(f"✓ GET /api/profile returns: phone={data.get('phone')}, state_code={data.get('state_code')}")
    
    def test_update_profile_phone(self):
        """Test 12: PUT /api/profile with phone updates successfully"""
        # Update phone
        update_response = self.session.put(
            f"{BASE_URL}/api/profile",
            json={"phone": "(555) 123-4567"}
        )
        assert update_response.status_code == 200, f"PUT profile failed: {update_response.text}"
        assert update_response.json().get("message") == "Profile updated"
        
        # Verify update persisted
        get_response = self.session.get(f"{BASE_URL}/api/profile")
        assert get_response.status_code == 200
        assert get_response.json().get("phone") == "(555) 123-4567"
        
        # Restore original phone
        self.session.put(
            f"{BASE_URL}/api/profile",
            json={"phone": "(415) 555-0123"}
        )
        print("✓ PUT /api/profile updates phone successfully")
    
    def test_update_profile_address(self):
        """Test profile address update"""
        original = self.session.get(f"{BASE_URL}/api/profile").json().get("address")
        
        # Update address
        update_response = self.session.put(
            f"{BASE_URL}/api/profile",
            json={"address": "456 Test Ave, Test City, CA 90210"}
        )
        assert update_response.status_code == 200
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/profile")
        assert get_response.json().get("address") == "456 Test Ave, Test City, CA 90210"
        
        # Restore original
        self.session.put(f"{BASE_URL}/api/profile", json={"address": original})
        print("✓ PUT /api/profile updates address successfully")
    
    def test_update_profile_emergency_contact(self):
        """Test profile emergency contact update"""
        original = self.session.get(f"{BASE_URL}/api/profile").json().get("emergency_contact")
        
        # Update emergency contact
        update_response = self.session.put(
            f"{BASE_URL}/api/profile",
            json={"emergency_contact": "Test Contact - (555) 999-8888"}
        )
        assert update_response.status_code == 200
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/profile")
        assert get_response.json().get("emergency_contact") == "Test Contact - (555) 999-8888"
        
        # Restore original
        self.session.put(f"{BASE_URL}/api/profile", json={"emergency_contact": original})
        print("✓ PUT /api/profile updates emergency_contact successfully")
    
    def test_update_profile_state_code(self):
        """Test profile state code update"""
        original = self.session.get(f"{BASE_URL}/api/profile").json().get("state_code")
        
        # Update state code
        update_response = self.session.put(
            f"{BASE_URL}/api/profile",
            json={"state_code": "TX"}
        )
        assert update_response.status_code == 200
        
        # Verify update
        get_response = self.session.get(f"{BASE_URL}/api/profile")
        assert get_response.json().get("state_code") == "TX"
        
        # Restore original
        self.session.put(f"{BASE_URL}/api/profile", json={"state_code": original})
        print("✓ PUT /api/profile updates state_code successfully")


class TestProfileHistoryAPI:
    """Test /api/profile/history endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get session cookies"""
        self.session = requests.Session()
        response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": EMPLOYEE_EMAIL, "password": EMPLOYEE_PASSWORD}
        )
        assert response.status_code == 200, "Login failed"
    
    def test_get_profile_history_returns_arrays(self):
        """Test 13: GET /api/profile/history returns attendance, leaves, payrolls arrays"""
        response = self.session.get(f"{BASE_URL}/api/profile/history")
        assert response.status_code == 200, f"GET profile/history failed: {response.text}"
        
        data = response.json()
        # Verify required arrays exist
        assert "attendance" in data, "attendance array missing"
        assert "leaves" in data, "leaves array missing"
        assert "payrolls" in data, "payrolls array missing"
        assert "leave_balance" in data, "leave_balance missing"
        
        # Verify arrays are lists
        assert isinstance(data["attendance"], list), "attendance should be a list"
        assert isinstance(data["leaves"], list), "leaves should be a list"
        assert isinstance(data["payrolls"], list), "payrolls should be a list"
        
        print(f"✓ GET /api/profile/history returns: {len(data['attendance'])} attendance, {len(data['leaves'])} leaves, {len(data['payrolls'])} payrolls")
    
    def test_attendance_history_structure(self):
        """Test attendance history has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/profile/history")
        data = response.json()
        
        if len(data["attendance"]) > 0:
            record = data["attendance"][0]
            assert "date" in record, "attendance record missing date"
            assert "clock_in" in record, "attendance record missing clock_in"
            assert "clock_out" in record, "attendance record missing clock_out"
            assert "total_hours" in record, "attendance record missing total_hours"
            print(f"✓ Attendance record structure valid: date={record.get('date')}")
    
    def test_leaves_history_structure(self):
        """Test leaves history has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/profile/history")
        data = response.json()
        
        if len(data["leaves"]) > 0:
            record = data["leaves"][0]
            assert "leave_type" in record, "leave record missing leave_type"
            assert "start_date" in record, "leave record missing start_date"
            assert "end_date" in record, "leave record missing end_date"
            assert "status" in record, "leave record missing status"
            print(f"✓ Leave record structure valid: type={record.get('leave_type')}, status={record.get('status')}")
    
    def test_payrolls_history_structure(self):
        """Test payrolls history has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/profile/history")
        data = response.json()
        
        if len(data["payrolls"]) > 0:
            record = data["payrolls"][0]
            assert "month" in record, "payroll record missing month"
            assert "year" in record, "payroll record missing year"
            assert "gross_salary" in record, "payroll record missing gross_salary"
            assert "net_salary" in record, "payroll record missing net_salary"
            assert "total_deductions" in record, "payroll record missing total_deductions"
            print(f"✓ Payroll record structure valid: {record.get('month')}/{record.get('year')}, gross=${record.get('gross_salary')}")
    
    def test_leave_balance_structure(self):
        """Test leave balance has correct structure"""
        response = self.session.get(f"{BASE_URL}/api/profile/history")
        data = response.json()
        
        balance = data.get("leave_balance")
        if balance:
            assert "casual_leave" in balance, "leave_balance missing casual_leave"
            assert "sick_leave" in balance, "leave_balance missing sick_leave"
            assert "privilege_leave" in balance, "leave_balance missing privilege_leave"
            print(f"✓ Leave balance: CL={balance.get('casual_leave')}, SL={balance.get('sick_leave')}, PL={balance.get('privilege_leave')}")


class TestProfileAccessControl:
    """Test profile access control - employees can only access their own profile"""
    
    def test_profile_requires_authentication(self):
        """Test that profile endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/profile")
        assert response.status_code == 401, "Profile should require authentication"
        print("✓ Profile endpoint requires authentication")
    
    def test_profile_history_requires_authentication(self):
        """Test that profile history endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/profile/history")
        assert response.status_code == 401, "Profile history should require authentication"
        print("✓ Profile history endpoint requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
