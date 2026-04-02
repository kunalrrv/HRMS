#!/usr/bin/env python3
"""
HRMS SaaS Backend API Testing Suite
Tests all major API endpoints and workflows
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class HRMSAPITester:
    def __init__(self, base_url: str = "https://talent-ops-12.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
        # Test data
        self.admin_credentials = {"email": "admin@talentops.com", "password": "admin123"}
        self.test_org_data = {
            "name": "Test Organization",
            "domain": "testorg.com", 
            "industry": "Technology"
        }
        # Use timestamp to make email unique
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.test_employee_data = {
            "name": "John Doe",
            "email": f"john.doe.{timestamp}@testorg.com",
            "password": "testpass123",
            "department": "Engineering",
            "designation": "Software Engineer",
            "phone": "+91-9876543210"
        }
        
        # Test results tracking
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_data = {}  # Store created entities for cleanup/reference

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

    def make_request(self, method: str, endpoint: str, data: Dict = None, expected_status: int = 200) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url)
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

    def test_health_check(self):
        """Test basic API health"""
        success, data, status = self.make_request('GET', '/')
        if success:
            self.log_test("Health Check", True, f"API is running: {data.get('message', '')}")
        else:
            self.log_test("Health Check", False, f"Status: {status}, Response: {data}")

    def test_admin_login(self):
        """Test admin login and store session"""
        success, data, status = self.make_request('POST', '/auth/login', self.admin_credentials)
        if success and 'id' in data:
            self.test_data['admin_user'] = data
            self.log_test("Admin Login", True, f"Logged in as: {data.get('name')} ({data.get('role')})")
            return True
        else:
            self.log_test("Admin Login", False, f"Status: {status}, Response: {data}")
            return False

    def test_create_organization(self):
        """Test organization creation"""
        success, data, status = self.make_request('POST', '/organizations', self.test_org_data)
        if success and 'id' in data:
            self.test_data['organization'] = data
            # Re-login to get updated token with org_id and admin role
            self.test_admin_login()
            self.log_test("Create Organization", True, f"Created org: {data.get('name')} (ID: {data.get('id')})")
            return True
        else:
            self.log_test("Create Organization", False, f"Status: {status}, Response: {data}")
            return False

    def test_get_current_organization(self):
        """Test getting current organization"""
        success, data, status = self.make_request('GET', '/organizations/current')
        if success and 'id' in data:
            self.log_test("Get Current Organization", True, f"Retrieved org: {data.get('name')}")
            return True
        else:
            self.log_test("Get Current Organization", False, f"Status: {status}, Response: {data}")
            return False

    def test_register_employee_user(self):
        """Test registering a new employee user"""
        user_data = {
            "name": self.test_employee_data["name"],
            "email": self.test_employee_data["email"], 
            "password": self.test_employee_data["password"],
            "role": "employee"
        }
        success, data, status = self.make_request('POST', '/auth/register', user_data)
        if success and 'id' in data:
            self.test_data['employee_user'] = data
            self.log_test("Register Employee User", True, f"Registered: {data.get('name')} (ID: {data.get('id')})")
            return True
        else:
            self.log_test("Register Employee User", False, f"Status: {status}, Response: {data}")
            return False

    def test_create_employee_record(self):
        """Test creating employee record"""
        if 'employee_user' not in self.test_data:
            self.log_test("Create Employee Record", False, "No employee user to create record for")
            return False
            
        employee_data = {
            "user_id": self.test_data['employee_user']['id'],
            "department": self.test_employee_data["department"],
            "designation": self.test_employee_data["designation"],
            "date_of_joining": datetime.now().strftime("%Y-%m-%d"),
            "phone": self.test_employee_data["phone"]
        }
        
        success, data, status = self.make_request('POST', '/employees', employee_data)
        if success and 'id' in data:
            self.test_data['employee'] = data
            self.log_test("Create Employee Record", True, f"Created employee: {data.get('user_name')} (Code: {data.get('employee_code')})")
            return True
        else:
            self.log_test("Create Employee Record", False, f"Status: {status}, Response: {data}")
            return False

    def test_list_employees(self):
        """Test listing employees"""
        success, data, status = self.make_request('GET', '/employees')
        if success and isinstance(data, list):
            self.log_test("List Employees", True, f"Retrieved {len(data)} employees")
            return True
        else:
            self.log_test("List Employees", False, f"Status: {status}, Response: {data}")
            return False

    def test_attendance_clock_in(self):
        """Test attendance clock in"""
        success, data, status = self.make_request('POST', '/attendance', {"action": "clock_in"})
        if success and 'id' in data:
            self.test_data['attendance'] = data
            self.log_test("Attendance Clock In", True, f"Clocked in at: {data.get('clock_in')}")
            return True
        else:
            self.log_test("Attendance Clock In", False, f"Status: {status}, Response: {data}")
            return False

    def test_attendance_today_status(self):
        """Test getting today's attendance status"""
        success, data, status = self.make_request('GET', '/attendance/today')
        if success:
            self.log_test("Today's Attendance Status", True, f"Clocked in: {data.get('clocked_in')}, Clocked out: {data.get('clocked_out')}")
            return True
        else:
            self.log_test("Today's Attendance Status", False, f"Status: {status}, Response: {data}")
            return False

    def test_attendance_clock_out(self):
        """Test attendance clock out"""
        success, data, status = self.make_request('POST', '/attendance', {"action": "clock_out"})
        if success and data.get('total_hours'):
            self.log_test("Attendance Clock Out", True, f"Clocked out, Total hours: {data.get('total_hours')}")
            return True
        else:
            self.log_test("Attendance Clock Out", False, f"Status: {status}, Response: {data}")
            return False

    def test_leave_balance(self):
        """Test getting leave balance"""
        success, data, status = self.make_request('GET', '/leaves/balance')
        if success and 'casual_leave' in data:
            self.log_test("Leave Balance", True, f"CL: {data.get('casual_leave')}, SL: {data.get('sick_leave')}, PL: {data.get('privilege_leave')}")
            return True
        else:
            self.log_test("Leave Balance", False, f"Status: {status}, Response: {data}")
            return False

    def test_apply_leave(self):
        """Test applying for leave"""
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

    def test_approve_leave(self):
        """Test approving leave (admin action)"""
        if 'leave_application' not in self.test_data:
            self.log_test("Approve Leave", False, "No leave application to approve")
            return False
            
        leave_id = self.test_data['leave_application']['id']
        success, data, status = self.make_request('PUT', f'/leaves/{leave_id}/approve', {})
        if success:
            self.log_test("Approve Leave", True, f"Leave approved: {data.get('message')}")
            return True
        else:
            self.log_test("Approve Leave", False, f"Status: {status}, Response: {data}")
            return False

    def test_update_employee_salary(self):
        """Test updating employee salary"""
        if 'employee' not in self.test_data:
            self.log_test("Update Employee Salary", False, "No employee to update salary for")
            return False
            
        employee_id = self.test_data['employee']['id']
        salary_data = {
            "basic": 50000,
            "hra": 20000,
            "allowances": 10000
        }
        
        success, data, status = self.make_request('PUT', f'/employees/{employee_id}/salary', salary_data)
        if success:
            self.log_test("Update Employee Salary", True, f"Salary updated: {data.get('message')}")
            return True
        else:
            self.log_test("Update Employee Salary", False, f"Status: {status}, Response: {data}")
            return False

    def test_generate_payroll(self):
        """Test generating payroll"""
        if 'employee' not in self.test_data:
            self.log_test("Generate Payroll", False, "No employee to generate payroll for")
            return False
            
        payroll_data = {
            "employee_id": self.test_data['employee']['id'],
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
        """Test creating job posting"""
        job_data = {
            "title": "Senior Software Engineer",
            "department": "Engineering",
            "location": "Bangalore, India",
            "employment_type": "Full-time",
            "description": "We are looking for a senior software engineer...",
            "requirements": "5+ years of experience in Python/JavaScript...",
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
        """Test adding candidate to job"""
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

    def test_update_candidate_stage(self):
        """Test updating candidate stage"""
        if 'candidate' not in self.test_data:
            self.log_test("Update Candidate Stage", False, "No candidate to update")
            return False
            
        candidate_id = self.test_data['candidate']['id']
        stage_data = {
            "stage": "interview",
            "notes": "Moved to interview round"
        }
        
        success, data, status = self.make_request('PUT', f'/candidates/{candidate_id}/stage', stage_data)
        if success:
            self.log_test("Update Candidate Stage", True, f"Stage updated: {data.get('message')}")
            return True
        else:
            self.log_test("Update Candidate Stage", False, f"Status: {status}, Response: {data}")
            return False

    def test_subscription_plans(self):
        """Test getting subscription plans"""
        success, data, status = self.make_request('GET', '/subscription/plans')
        if success and 'plans' in data:
            plans = data['plans']
            self.log_test("Subscription Plans", True, f"Retrieved {len(plans)} subscription plans")
            return True
        else:
            self.log_test("Subscription Plans", False, f"Status: {status}, Response: {data}")
            return False

    def test_mock_subscription_checkout(self):
        """Test mock subscription checkout"""
        checkout_data = {
            "plan": "starter"
        }
        
        success, data, status = self.make_request('POST', '/subscription/checkout', checkout_data)
        if success and 'order_id' in data:
            self.test_data['checkout'] = data
            self.log_test("Mock Subscription Checkout", True, f"Created order: {data.get('order_id')} (Amount: ₹{data.get('amount', 0)/100})")
            return True
        else:
            self.log_test("Mock Subscription Checkout", False, f"Status: {status}, Response: {data}")
            return False

    def test_mock_payment_verification(self):
        """Test mock payment verification"""
        if 'checkout' not in self.test_data:
            self.log_test("Mock Payment Verification", False, "No checkout to verify")
            return False
            
        verify_data = {
            "plan": "starter",
            "payment_id": "pay_mock_test123",
            "amount": self.test_data['checkout'].get('amount', 99900)
        }
        
        success, data, status = self.make_request('POST', '/subscription/verify', verify_data)
        if success:
            self.log_test("Mock Payment Verification", True, f"Payment verified: {data.get('message')}")
            return True
        else:
            self.log_test("Mock Payment Verification", False, f"Status: {status}, Response: {data}")
            return False

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        success, data, status = self.make_request('GET', '/dashboard/stats')
        if success:
            self.log_test("Dashboard Stats", True, f"Employees: {data.get('total_employees')}, Present: {data.get('present_today')}, Pending leaves: {data.get('pending_leaves')}")
            return True
        else:
            self.log_test("Dashboard Stats", False, f"Status: {status}, Response: {data}")
            return False

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting HRMS SaaS Backend API Tests")
        print("=" * 50)
        
        # Basic connectivity
        self.test_health_check()
        
        # Authentication flow
        if not self.test_admin_login():
            print("❌ Admin login failed - stopping tests")
            return self.get_summary()
        
        # Organization setup
        self.test_create_organization()
        self.test_get_current_organization()
        
        # Employee management
        self.test_register_employee_user()
        self.test_create_employee_record()
        self.test_list_employees()
        self.test_update_employee_salary()
        
        # Attendance management
        self.test_attendance_clock_in()
        self.test_attendance_today_status()
        self.test_attendance_clock_out()
        
        # Leave management
        self.test_leave_balance()
        self.test_apply_leave()
        self.test_approve_leave()
        
        # Payroll
        self.test_generate_payroll()
        
        # Recruitment
        self.test_create_job_posting()
        self.test_add_candidate()
        self.test_update_candidate_stage()
        
        # Subscription (mocked)
        self.test_subscription_plans()
        self.test_mock_subscription_checkout()
        self.test_mock_payment_verification()
        
        # Dashboard
        self.test_dashboard_stats()
        
        return self.get_summary()

    def get_summary(self):
        """Get test summary"""
        print("=" * 50)
        print("📊 TEST SUMMARY")
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
    tester = HRMSAPITester()
    summary = tester.run_all_tests()
    
    # Exit with error code if tests failed
    return 0 if summary["failed_tests"] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())