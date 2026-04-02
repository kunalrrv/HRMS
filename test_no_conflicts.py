#!/usr/bin/env python3
"""
Test HRMS functionality without session conflicts
"""

import requests
import json
from datetime import datetime, timedelta

def test_without_conflicts():
    base_url = "https://talent-ops-12.preview.emergentagent.com/api"
    credentials = {"email": "hr@acmecorp.com", "password": "password123"}
    
    session = requests.Session()
    session.headers.update({'Content-Type': 'application/json'})
    
    print("🔍 Testing HRMS Functionality (Avoiding Session Conflicts)")
    print("=" * 60)
    
    # Login
    login_resp = session.post(f"{base_url}/auth/login", json=credentials)
    print(f"✅ Login Status: {login_resp.status_code}")
    
    # Test 1: Dashboard Stats
    stats_resp = session.get(f"{base_url}/dashboard/stats")
    print(f"✅ Dashboard Stats: {stats_resp.status_code}")
    if stats_resp.status_code == 200:
        stats = stats_resp.json()
        print(f"   Stats: {stats}")
    
    # Test 2: Job Creation (without registering new users first)
    print(f"\n🎯 Testing Job Creation")
    job_data = {
        "title": "Senior Software Engineer",
        "department": "Engineering", 
        "location": "Bangalore, India",
        "employment_type": "Full-time",
        "description": "We are looking for a senior software engineer...",
        "requirements": "5+ years experience in Python/JavaScript...",
        "salary_range_min": 1200000,
        "salary_range_max": 1800000
    }
    
    job_resp = session.post(f"{base_url}/jobs", json=job_data)
    print(f"Job Creation Status: {job_resp.status_code}")
    print(f"Job Response: {job_resp.text}")
    
    if job_resp.status_code == 200:
        job_id = job_resp.json()['id']
        print(f"✅ Job created successfully: {job_id}")
        
        # Test 3: Add Candidate to Job
        print(f"\n👤 Testing Candidate Addition")
        candidate_data = {
            "job_id": job_id,
            "name": "Jane Smith",
            "email": "jane.smith@example.com",
            "phone": "+91-9876543211"
        }
        
        candidate_resp = session.post(f"{base_url}/candidates", json=candidate_data)
        print(f"Candidate Creation Status: {candidate_resp.status_code}")
        print(f"Candidate Response: {candidate_resp.text}")
    
    # Test 4: Organization Update
    print(f"\n🏢 Testing Organization Update")
    org_data = {
        "name": "Acme Corporation",
        "domain": "acmecorp.com", 
        "industry": "Technology"
    }
    
    org_resp = session.put(f"{base_url}/organizations/current", json=org_data)
    print(f"Organization Update Status: {org_resp.status_code}")
    print(f"Organization Response: {org_resp.text}")
    
    # Test 5: Subscription Plans
    print(f"\n💳 Testing Subscription Plans")
    plans_resp = session.get(f"{base_url}/subscription/plans")
    print(f"Subscription Plans Status: {plans_resp.status_code}")
    if plans_resp.status_code == 200:
        plans = plans_resp.json()
        print(f"✅ Found {len(plans.get('plans', []))} subscription plans")
    
    # Test 6: Mock Subscription Checkout
    print(f"\n💰 Testing Mock Subscription Checkout")
    checkout_data = {"plan": "starter"}
    checkout_resp = session.post(f"{base_url}/subscription/checkout", json=checkout_data)
    print(f"Checkout Status: {checkout_resp.status_code}")
    print(f"Checkout Response: {checkout_resp.text}")
    
    # Test 7: List existing employees
    print(f"\n👥 Testing Employee List")
    emp_resp = session.get(f"{base_url}/employees")
    print(f"Employee List Status: {emp_resp.status_code}")
    if emp_resp.status_code == 200:
        employees = emp_resp.json()
        print(f"✅ Found {len(employees)} existing employees")
    else:
        print(f"Employee List Response: {emp_resp.text}")
    
    # Test 8: Attendance without employee record
    print(f"\n⏰ Testing Attendance (HR user without employee record)")
    clock_resp = session.post(f"{base_url}/attendance", json={"action": "clock_in"})
    print(f"Clock In Status: {clock_resp.status_code}")
    print(f"Clock In Response: {clock_resp.text}")
    
    # Test 9: Leave balance without employee record
    print(f"\n🏖️ Testing Leave Balance (HR user without employee record)")
    balance_resp = session.get(f"{base_url}/leaves/balance")
    print(f"Leave Balance Status: {balance_resp.status_code}")
    print(f"Leave Balance Response: {balance_resp.text}")

if __name__ == "__main__":
    test_without_conflicts()