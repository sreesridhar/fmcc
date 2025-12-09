
import requests
import sys

# Config
BASE_URL = 'http://localhost:8000/api/v1'
ADMIN_USER = 'admin'
ADMIN_PASS = 'admin123'

s = requests.Session()

def login():
    try:
        r = s.post(f'{BASE_URL}/login', json={'username': ADMIN_USER, 'password': ADMIN_PASS})
        if r.status_code == 200:
            print("Login Successful")
            return True
        else:
            print(f"Login Failed: {r.status_code} {r.text}")
            return False
    except Exception as e:
        print(f"Connection Error: {e}")
        return False

def test_crud_org():
    print("\n--- Testing Org CRUD ---")
    
    # 1. Create
    org_name = "Test Org Actions"
    r = s.post(f'{BASE_URL}/orgs', json={'name': org_name, 'status': 'active'})
    if r.status_code != 200:
        print(f"Create Failed: {r.status_code} {r.text}")
        return False
    
    org_id = r.json().get('id')
    print(f"Created Org ID: {org_id}")
    
    # 2. Update (Simulate Edit Save)
    r = s.put(f'{BASE_URL}/orgs/{org_id}', json={'name': f"{org_name} Updated", 'status': 'active'})
    if r.status_code != 200:
         print(f"Update Failed: {r.status_code} {r.text}")
         return False
    print("Update Successful")

    # 3. Delete
    r = s.delete(f'{BASE_URL}/orgs/{org_id}')
    if r.status_code != 200:
         print(f"Delete Failed: {r.status_code} {r.text}")
         return False
    print("Delete Successful")

    return True

if __name__ == '__main__':
    if not login():
        sys.exit(1)
    
    if test_crud_org():
        print("\nAll Action Tests Passed")
        sys.exit(0)
    else:
        sys.exit(1)
