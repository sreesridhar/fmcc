import requests
import json
import time

BASE_URL = 'http://localhost:8000/api/v1'

# 1. Login as Super Admin (assuming admin user exists, or I need to create one if not?)
# I'll use the user 'admin' which was reset in Step 106.
session = requests.Session()
login_res = session.post(f'{BASE_URL}/login', json={'username': 'admin', 'password': 'admin123'})
print(f"Login: {login_res.status_code}")
if login_res.status_code != 200:
    print(login_res.text)
    # Try resetting admin pass if failed?
    # Assuming it works as per Step 106 usage.
    exit(1)

# 2. Create Org
new_org_name = f'Test Org {time.time()}'
res = session.post(f'{BASE_URL}/orgs', json={'name': new_org_name, 'status': 'active'})
print(f"Create Org: {res.status_code}")
if res.status_code != 200:
    print(res.text)
    exit(1)
    
org_id = res.json()['id']
print(f"Created Org ID: {org_id}")

# 3. Update Org
updated_name = f'{new_org_name} UPDATED'
res = session.put(f'{BASE_URL}/orgs/{org_id}', json={'name': updated_name, 'status': 'active'})
print(f"Update Org: {res.status_code}")
print(res.text)

# 4. Verify Update
res = session.get(f'{BASE_URL}/orgs')
orgs = res.json()
found = False
for org in orgs:
    if str(org['id']) == str(org_id):
        if org['name'] == updated_name:
            print("SUCCESS: Org name updated correctly.")
            found = True
        else:
            print(f"FAILURE: Org name mismatch. Expected '{updated_name}', got '{org['name']}'")
        break

if not found:
    print("FAILURE: Org not found in list.")
