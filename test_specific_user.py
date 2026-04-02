#!/usr/bin/env python3
"""
Test specific user credentials mentioned in review request
"""

import requests
import sys
import json
from datetime import datetime

def test_specific_credentials():
    """Test the specific credentials mentioned in the review request"""
    base_url = "https://talent-ops-12.preview.emergentagent.com/api"
    
    # Test credentials from review request
    credentials = {"email": "hr@acmecorp.com", "password": "password123"}
    
    session = requests.Session()
    session.headers.update({'Content-Type': 'application/json'})
    
    print("🔍 Testing specific user credentials from review request")
    print("=" * 60)
    
    # Test login
    try:
        response = session.post(f"{base_url}/auth/login", json=credentials)
        print(f"Login attempt - Status: {response.status_code}")
        
        if response.status_code == 200:
            user_data = response.json()
            print(f"✅ Login successful!")
            print(f"   User: {user_data.get('name')} ({user_data.get('email')})")
            print(f"   Role: {user_data.get('role')}")
            print(f"   Org ID: {user_data.get('org_id')}")
            
            # Test getting current user info
            me_response = session.get(f"{base_url}/auth/me")
            print(f"\n/auth/me - Status: {me_response.status_code}")
            if me_response.status_code == 200:
                print("✅ Session persistence working")
            else:
                print(f"❌ Session persistence failed: {me_response.text}")
            
            # Test dashboard stats
            stats_response = session.get(f"{base_url}/dashboard/stats")
            print(f"\nDashboard stats - Status: {stats_response.status_code}")
            if stats_response.status_code == 200:
                stats = stats_response.json()
                print(f"✅ Dashboard accessible")
                print(f"   Total Employees: {stats.get('total_employees')}")
                print(f"   Present Today: {stats.get('present_today')}")
                print(f"   Pending Leaves: {stats.get('pending_leaves')}")
                print(f"   Open Positions: {stats.get('open_positions')}")
            else:
                print(f"❌ Dashboard not accessible: {stats_response.text}")
                
            # Test organization info
            org_response = session.get(f"{base_url}/organizations/current")
            print(f"\nOrganization info - Status: {org_response.status_code}")
            if org_response.status_code == 200:
                org = org_response.json()
                print(f"✅ Organization found: {org.get('name')}")
            else:
                print(f"❌ No organization found: {org_response.text}")
                
        else:
            print(f"❌ Login failed: {response.text}")
            
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    test_specific_credentials()