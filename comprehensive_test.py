#!/usr/bin/env python3
"""
Comprehensive HRMS Testing for hr@acmecorp.com user
Tests all features mentioned in the review request
"""

import requests
import sys
import json
from datetime import datetime, timedelta

class HRMSComprehensiveTester:
    def __init__(self):
        self.base_url = "https://talent-ops-12.preview.emergentagent.com/api"
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
        # Test credentials from review request
        self.hr_credentials = {"email": "hr@acmecorp.com", "password": "password123"}
        
        # Test results tracking
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_data = {}

    def log_test(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append(f"{test_name}: {details}")
        print()

    def make_request(self, method: str, endpoint: str, data: dict = None, expected_status: int = 200) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data)
            else:
                return False, {"error": f"Unsupported method: {method}"}, 0

            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
                
            return success, response_data, response.status_code
            
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_hr_login(self):
        """Test HR admin login"""
        success, data, status = self.make_request('POST', '/auth/login', self.hr_credentials)
        if success and 'id' in data:
            self.test_data['hr_user'] = data
            self.log_test("HR Admin Login", True, f"Logged in as: {data.get('name')} ({data.get('role')}) - Org: {data.get('org_id')}")
            return True
        else:
            self.log_test("HR Admin Login", False, f"Status: {status}, Response: {data}")
            return False

    def test_dashboard_stats(self):
        """Test dashboard statistics display"""
        success, data, status = self.make_request('GET', '/dashboard/stats')
        if success:
            self.test_data['dashboard_stats'] = data
            self.log_test("Dashboard Stats", True, 
                f"Total Employees: {data.get('total_employees')}, Present Today: {data.get('present_today')}, "
                f"Pending Leaves: {data.get('pending_leaves')}, Open Positions: {data.get('open_positions')}")
            return True
        else:
            self.log_test("Dashboard Stats", False, f"Status: {status}, Response: {data}")
            return False

    def test_clock_in(self):
        """Test clock in functionality"""
        success, data, status = self.make_request('POST', '/attendance', {"action": "clock_in"})
        if success and 'id' in data:
            self.test_data['clock_in'] = data
            self.log_test("Clock In", True, f"Clocked in at: {data.get('clock_in')}")
            return True
        else:
            self.log_test("Clock In", False, f"Status: {status}, Response: {data}")
            return False

    def test_clock_out(self):
        """Test clock out functionality"""
        success, data, status = self.make_request('POST', '/attendance', {"action": "clock_out"})
        if success and data.get('total_hours'):
            self.test_data['clock_out'] = data
            self.log_test("Clock Out", True, f"Clocked out, Total hours: {data.get('total_hours')}")
            return True
        else:
            self.log_test("Clock Out", False, f"Status: {status}, Response: {data}")
            return False

    def test_add_employee(self):
        """Test adding new employee with all fields"""
        # First register user
        timestamp = datetime.now().strftime("%H%M%S")
        user_data = {
            "name": "Test Employee",
            "email": f"test.emp.{timestamp}@acmecorp.com",
            "password": "password123",
            "role": "employee"
        }
        
        success, user_resp, status = self.make_request('POST', '/auth/register', user_data)
        if not success:
            self.log_test("Add Employee - User Registration", False, f"Status: {status}, Response: {user_resp}")
            return False
        
        # Then create employee record
        employee_data = {
            "user_id": user_resp['id'],
            "department": "Engineering",
            "designation": "Software Engineer",
            "date_of_joining": datetime.now().strftime("%Y-%m-%d"),
            "phone": "+91-9876543210",
            "address": "123 Test Street, Bangalore",
            "emergency_contact": "+91-9876543211"
        }
        
        success, emp_resp, status = self.make_request('POST', '/employees', employee_data)
        if success and 'id' in emp_resp:
            self.test_data['employee'] = emp_resp
            self.log_test("Add Employee", True, f"Added: {emp_resp.get('user_name')} (Code: {emp_resp.get('employee_code')})")
            return True
        else:
            self.log_test("Add Employee", False, f"Status: {status}, Response: {emp_resp}")
            return False

    def test_employee_detail_page(self):
        """Test employee detail page access"""
        if 'employee' not in self.test_data:
            self.log_test("Employee Detail Page", False, "No employee to view details for")
            return False
            
        employee_id = self.test_data['employee']['id']
        success, data, status = self.make_request('GET', f'/employees/{employee_id}')
        if success and 'id' in data:
            self.log_test("Employee Detail Page", True, f"Retrieved details for: {data.get('user_name')}")
            return True
        else:
            self.log_test("Employee Detail Page", False, f"Status: {status}, Response: {data}")
            return False

    def test_attendance_history(self):
        """Test attendance page - displays attendance history"""
        success, data, status = self.make_request('GET', '/attendance')
        if success and isinstance(data, list):
            self.log_test("Attendance History", True, f"Retrieved {len(data)} attendance records")
            return True
        else:
            self.log_test("Attendance History", False, f"Status: {status}, Response: {data}")
            return False

    def test_apply_leave(self):
        """Test leaves page - Apply for leave functionality"""
        leave_data = {
            "leave_type": "CL",
            "start_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
            "end_date": (datetime.now() + timedelta(days=8)).strftime("%Y-%m-%d"),
            "reason": "Personal work"
        }
        
        success, data, status = self.make_request('POST', '/leaves', leave_data)
        if success and 'id' in data:
            self.test_data['leave_application'] = data
            self.log_test("Apply Leave", True, f"Applied for {data.get('leave_type')} from {data.get('start_date')} to {data.get('end_date')}")
            return True
        else:
            self.log_test("Apply Leave", False, f"Status: {status}, Response: {data}")
            return False

    def test_generate_payroll(self):
        """Test payroll page - Generate payroll for employee"""
        if 'employee' not in self.test_data:
            self.log_test("Generate Payroll", False, "No employee to generate payroll for")
            return False
        
        # First update employee salary
        employee_id = self.test_data['employee']['id']
        salary_data = {
            "basic": 50000,
            "hra": 20000,
            "allowances": 10000
        }
        
        salary_success, _, _ = self.make_request('PUT', f'/employees/{employee_id}/salary', salary_data)
        if not salary_success:
            self.log_test("Generate Payroll - Update Salary", False, "Failed to update employee salary")
            return False
        
        # Generate payroll
        payroll_data = {
            "employee_id": employee_id,
            "month": datetime.now().month,
            "year": datetime.now().year
        }
        
        success, data, status = self.make_request('POST', '/payroll/generate', payroll_data)
        if success and 'id' in data:
            self.test_data['payroll'] = data
            self.log_test("Generate Payroll", True, f"Generated payroll: Net salary ₹{data.get('net_salary')}")
            return True
        else:
            self.log_test("Generate Payroll", False, f"Status: {status}, Response: {data}")
            return False

    def test_create_job_posting(self):
        """Test recruitment page - Create new job posting"""
        job_data = {
            "title": "Senior Software Engineer",
            "department": "Engineering",
            "location": "Bangalore, India",
            "employment_type": "Full-time",
            "description": "We are looking for a senior software engineer to join our team...",
            "requirements": "5+ years of experience in Python/JavaScript, strong problem-solving skills...",
            "salary_range_min": 1200000,
            "salary_range_max": 1800000
        }
        
        success, data, status = self.make_request('POST', '/jobs', job_data)
        if success and 'id' in data:
            self.test_data['job'] = data
            self.log_test("Create Job Posting", True, f"Created job: {data.get('title')} (ID: {data.get('id')})")
            return True
        else:
            self.log_test("Create Job Posting", False, f"Status: {status}, Response: {data}")
            return False

    def test_add_candidate(self):
        """Test recruitment page - Add candidate to job"""
        if 'job' not in self.test_data:
            self.log_test("Add Candidate", False, "No job to add candidate to")
            return False
            
        candidate_data = {
            "job_id": self.test_data['job']['id'],
            "name": "Jane Smith",
            "email": "jane.smith@example.com",
            "phone": "+91-9876543211"
        }
        
        success, data, status = self.make_request('POST', '/candidates', candidate_data)
        if success and 'id' in data:
            self.test_data['candidate'] = data
            self.log_test("Add Candidate", True, f"Added candidate: {data.get('name')} (Stage: {data.get('stage')})")
            return True
        else:
            self.log_test("Add Candidate", False, f"Status: {status}, Response: {data}")
            return False

    def test_update_organization(self):
        """Test settings page - Update organization details"""
        org_data = {
            "name": "Acme Corporation Updated",
            "domain": "acmecorp.com",
            "industry": "Technology"
        }
        
        success, data, status = self.make_request('PUT', '/organizations/current', org_data)
        if success:
            self.log_test("Update Organization", True, f"Organization updated: {data.get('message', 'Success')}")
            return True
        else:
            self.log_test("Update Organization", False, f"Status: {status}, Response: {data}")
            return False

    def test_subscription_plans(self):
        """Test subscription page - View subscription plans"""
        success, data, status = self.make_request('GET', '/subscription/plans')
        if success and 'plans' in data:
            plans = data['plans']
            self.log_test("View Subscription Plans", True, f"Retrieved {len(plans)} subscription plans")
            return True
        else:
            self.log_test("View Subscription Plans", False, f"Status: {status}, Response: {data}")
            return False

    def run_comprehensive_tests(self):
        """Run all comprehensive tests"""
        print("🚀 Starting Comprehensive HRMS Testing for hr@acmecorp.com")
        print("=" * 70)
        
        # Login first
        if not self.test_hr_login():
            print("❌ HR login failed - stopping tests")
            return self.get_summary()
        
        # Test all features from review request
        self.test_dashboard_stats()
        self.test_clock_in()
        self.test_clock_out()
        self.test_add_employee()
        self.test_employee_detail_page()
        self.test_attendance_history()
        self.test_apply_leave()
        self.test_generate_payroll()
        self.test_create_job_posting()
        self.test_add_candidate()
        self.test_update_organization()
        self.test_subscription_plans()
        
        return self.get_summary()

    def get_summary(self):
        """Get test summary"""
        print("=" * 70)
        print("📊 COMPREHENSIVE TEST SUMMARY")
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {len(self.failed_tests)}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%" if self.tests_run > 0 else "0%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  - {failure}")
        
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": len(self.failed_tests),
            "success_rate": (self.tests_passed/self.tests_run*100) if self.tests_run > 0 else 0,
            "failures": self.failed_tests
        }

def main():
    """Main test runner"""
    tester = HRMSComprehensiveTester()
    summary = tester.run_comprehensive_tests()
    
    return 0 if summary["failed_tests"] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())