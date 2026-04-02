#!/usr/bin/env python3
"""
Debug session and permissions for hr@acmecorp.com
"""

import requests
import json

def debug_session():
    base_url = "https://talent-ops-12.preview.emergentagent.com/api"
    credentials = {"email": "hr@acmecorp.com", "password": "password123"}
    
    session = requests.Session()
    session.headers.update({'Content-Type': 'application/json'})
    
    print("🔍 Debugging Session and Permissions")
    print("=" * 50)
    
    # Login
    login_resp = session.post(f"{base_url}/auth/login", json=credentials)
    print(f"Login Status: {login_resp.status_code}")
    if login_resp.status_code == 200:
        user_data = login_resp.json()
        print(f"User Data: {json.dumps(user_data, indent=2)}")
        
        # Check current user via /auth/me
        me_resp = session.get(f"{base_url}/auth/me")
        print(f"\n/auth/me Status: {me_resp.status_code}")
        if me_resp.status_code == 200:
            me_data = me_resp.json()
            print(f"Current User Data: {json.dumps(me_data, indent=2)}")
        else:
            print(f"Error: {me_resp.text}")
        
        # Check organization
        org_resp = session.get(f"{base_url}/organizations/current")
        print(f"\nOrganization Status: {org_resp.status_code}")
        if org_resp.status_code == 200:
            org_data = org_resp.json()
            print(f"Organization: {json.dumps(org_data, indent=2)}")
        
        # Try to create an employee with detailed error
        print(f"\n🧪 Testing Employee Creation")
        test_user_data = {
            "name": "Debug Test User",
            "email": "debug.test@acmecorp.com",
            "password": "password123",
            "role": "employee"
        }
        
        register_resp = session.post(f"{base_url}/auth/register", json=test_user_data)
        print(f"Register User Status: {register_resp.status_code}")
        print(f"Register Response: {register_resp.text}")
        
        if register_resp.status_code == 200:
            user_id = register_resp.json()['id']
            
            employee_data = {
                "user_id": user_id,
                "department": "Engineering",
                "designation": "Test Engineer",
                "date_of_joining": "2024-01-01",
                "phone": "+91-9876543210"
            }
            
            emp_resp = session.post(f"{base_url}/employees", json=employee_data)
            print(f"Create Employee Status: {emp_resp.status_code}")
            print(f"Create Employee Response: {emp_resp.text}")
        
        # Try job creation
        print(f"\n🧪 Testing Job Creation")
        job_data = {
            "title": "Debug Test Job",
            "department": "Engineering",
            "location": "Bangalore",
            "employment_type": "Full-time",
            "description": "Test job",
            "requirements": "Test requirements"
        }
        
        job_resp = session.post(f"{base_url}/jobs", json=job_data)
        print(f"Create Job Status: {job_resp.status_code}")
        print(f"Create Job Response: {job_resp.text}")
        
        # Try organization update
        print(f"\n🧪 Testing Organization Update")
        org_update_data = {
            "name": "Acme Corporation",
            "domain": "acmecorp.com",
            "industry": "Technology"
        }
        
        org_update_resp = session.put(f"{base_url}/organizations/current", json=org_update_data)
        print(f"Update Organization Status: {org_update_resp.status_code}")
        print(f"Update Organization Response: {org_update_resp.text}")

if __name__ == "__main__":
    debug_session()