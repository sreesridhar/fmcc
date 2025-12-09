import requests
import time

BASE_URL = 'http://localhost:8000/api/v1'

# 1. Login as Admin
session = requests.Session()
res = session.post(f'{BASE_URL}/login', json={'username': 'admin', 'password': 'admin123'})
if res.status_code != 200:
    print("Login failed")
    exit(1)

# 2. Create Org to Delete
res = session.post(f'{BASE_URL}/orgs', json={'name': f'Delete Me {time.time()}'})
if res.status_code != 200:
    print("Creation failed")
    exit(1)
org_id = res.json()['id']
print(f"Created Org: {org_id}")

# 3. Delete Org
res = session.delete(f'{BASE_URL}/orgs/{org_id}')
print(f"Delete Status: {res.status_code}")

# 4. Verify
res = session.get(f'{BASE_URL}/orgs')
orgs = res.json()
found = any(str(o['id']) == str(org_id) for o in orgs)

if not found:
    print("SUCCESS: Org deleted.")
else:
    print("FAILURE: Org still exists.")
