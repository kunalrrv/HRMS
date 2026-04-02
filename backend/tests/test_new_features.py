"""
Test suite for TalentOps HRMS new features:
- US Payroll with state tax
- Bulk payroll generation
- Dashboard analytics
- Calendar integration
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://talent-ops-12.preview.emergentagent.com').rstrip('/')

class TestHealthAndBasics:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        print("✓ API health check passed")

    def test_api_root(self):
        """Test API root endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "TalentOps" in data.get("message", "")
        print("✓ API root endpoint passed")


class TestUSPayrollStates:
    """Test US payroll states endpoint"""
    
    def test_get_us_states(self):
        """Test GET /api/payroll/states returns list of US states with tax rates"""
        response = requests.get(f"{BASE_URL}/api/payroll/states")
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list)
        assert len(data) > 0
        
        # Each state should have code, name, tax_rate
        for state in data:
            assert "code" in state
            assert "name" in state
            assert "tax_rate" in state
            assert isinstance(state["tax_rate"], (int, float))
        
        # Check California specifically (9.3% rate)
        ca_state = next((s for s in data if s["code"] == "CA"), None)
        assert ca_state is not None
        assert ca_state["name"] == "California"
        assert ca_state["tax_rate"] == 0.093
        
        # Check Texas (no state tax)
        tx_state = next((s for s in data if s["code"] == "TX"), None)
        assert tx_state is not None
        assert tx_state["tax_rate"] == 0.0
        
        print(f"✓ US states endpoint returned {len(data)} states with tax rates")


class TestAuthentication:
    """Test authentication flows"""
    
    @pytest.fixture
    def session(self):
        return requests.Session()
    
    def test_hr_login(self, session):
        """Test HR admin login"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@acmecorp.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == "hr@acmecorp.com"
        assert data.get("role") in ["hr", "admin"]
        print(f"✓ HR login successful: {data.get('name')}")
        return session
    
    def test_employee_login(self, session):
        """Test employee login"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "john.doe@acmecorp.com",
            "password": "employee123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == "john.doe@acmecorp.com"
        print(f"✓ Employee login successful: {data.get('name')}")


class TestDashboardAnalytics:
    """Test dashboard analytics endpoint"""
    
    @pytest.fixture
    def hr_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@acmecorp.com",
            "password": "password123"
        })
        assert response.status_code == 200
        return session
    
    def test_dashboard_stats(self, hr_session):
        """Test GET /api/dashboard/stats"""
        response = hr_session.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 200
        data = response.json()
        
        # Should have all required fields
        assert "total_employees" in data
        assert "present_today" in data
        assert "pending_leaves" in data
        assert "open_positions" in data
        
        print(f"✓ Dashboard stats: {data}")
    
    def test_dashboard_analytics(self, hr_session):
        """Test GET /api/dashboard/analytics returns chart data"""
        response = hr_session.get(f"{BASE_URL}/api/dashboard/analytics")
        assert response.status_code == 200
        data = response.json()
        
        # Should have all analytics sections
        assert "attendance_trend" in data
        assert "leave_distribution" in data
        assert "payroll_trend" in data
        assert "recruitment_pipeline" in data
        
        # Attendance trend should have 7 days
        assert isinstance(data["attendance_trend"], list)
        assert len(data["attendance_trend"]) == 7
        for day in data["attendance_trend"]:
            assert "date" in day
            assert "day" in day
            assert "present" in day
            assert "absent" in day
        
        # Leave distribution should have leave types
        assert isinstance(data["leave_distribution"], list)
        for leave in data["leave_distribution"]:
            assert "type" in leave
            assert "total" in leave
        
        # Payroll trend should have 6 months
        assert isinstance(data["payroll_trend"], list)
        assert len(data["payroll_trend"]) == 6
        for month in data["payroll_trend"]:
            assert "month" in month
            assert "gross" in month
            assert "net" in month
        
        # Recruitment pipeline should have stages
        assert isinstance(data["recruitment_pipeline"], list)
        
        print(f"✓ Dashboard analytics returned all chart data")
        print(f"  - Attendance trend: {len(data['attendance_trend'])} days")
        print(f"  - Leave distribution: {len(data['leave_distribution'])} types")
        print(f"  - Payroll trend: {len(data['payroll_trend'])} months")
        print(f"  - Recruitment pipeline: {len(data['recruitment_pipeline'])} stages")


class TestPayroll:
    """Test payroll endpoints"""
    
    @pytest.fixture
    def hr_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@acmecorp.com",
            "password": "password123"
        })
        assert response.status_code == 200
        return session
    
    def test_list_payroll(self, hr_session):
        """Test GET /api/payroll returns payroll records with US tax fields"""
        response = hr_session.get(f"{BASE_URL}/api/payroll")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        if len(data) > 0:
            payroll = data[0]
            # Check US payroll fields
            assert "employee_name" in payroll
            assert "gross_salary" in payroll
            assert "federal_tax" in payroll
            assert "state_tax" in payroll
            assert "social_security_employee" in payroll
            assert "medicare_employee" in payroll
            assert "net_salary" in payroll
            assert "state_code" in payroll
            assert "status" in payroll
            
            print(f"✓ Payroll list returned {len(data)} records")
            print(f"  - Sample: {payroll.get('employee_name')} - Gross: ${payroll.get('gross_salary')}, Net: ${payroll.get('net_salary')}")
        else:
            print("✓ Payroll list returned (empty - no payroll records yet)")
    
    def test_bulk_payroll_generate(self, hr_session):
        """Test POST /api/payroll/generate-bulk"""
        # Use a future month to avoid conflicts
        response = hr_session.post(f"{BASE_URL}/api/payroll/generate-bulk", json={
            "month": 6,
            "year": 2026
        })
        assert response.status_code == 200
        data = response.json()
        
        assert "generated" in data
        assert "skipped" in data
        assert "total_employees" in data
        
        print(f"✓ Bulk payroll generation: {data.get('generated')} generated, {data.get('skipped')} skipped")


class TestCalendarData:
    """Test calendar-related endpoints"""
    
    @pytest.fixture
    def hr_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "hr@acmecorp.com",
            "password": "password123"
        })
        assert response.status_code == 200
        return session
    
    def test_attendance_list(self, hr_session):
        """Test GET /api/attendance returns attendance records"""
        response = hr_session.get(f"{BASE_URL}/api/attendance")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Attendance list returned {len(data)} records")
    
    def test_leaves_list(self, hr_session):
        """Test GET /api/leaves returns leave records"""
        response = hr_session.get(f"{BASE_URL}/api/leaves")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        
        # Check for approved leave (Apr 10-11)
        approved_leaves = [l for l in data if l.get("status") == "approved"]
        print(f"✓ Leaves list returned {len(data)} records ({len(approved_leaves)} approved)")


class TestEmployeeAccess:
    """Test employee-specific access"""
    
    @pytest.fixture
    def employee_session(self):
        session = requests.Session()
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "john.doe@acmecorp.com",
            "password": "employee123"
        })
        assert response.status_code == 200
        return session
    
    def test_employee_dashboard_stats(self, employee_session):
        """Test employee can access their dashboard stats"""
        response = employee_session.get(f"{BASE_URL}/api/dashboard/employee-stats")
        assert response.status_code == 200
        data = response.json()
        
        assert "has_employee_record" in data
        print(f"✓ Employee dashboard stats: {data}")
    
    def test_employee_payroll(self, employee_session):
        """Test employee can view their payroll"""
        response = employee_session.get(f"{BASE_URL}/api/payroll")
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Employee payroll: {len(data)} records")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
