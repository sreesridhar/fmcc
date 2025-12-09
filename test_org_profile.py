import requests
import json
import os

BASE_URL = 'http://localhost:8000/api/v1'

# 1. Login
session = requests.Session()
login_res = session.post(f'{BASE_URL}/login', json={'username': 'sridhar', 'password': 'password123'})
print(f"Login: {login_res.status_code}")
if login_res.status_code != 200:
    print(login_res.text)
    exit(1)

# 2. Get Profile
res = session.get(f'{BASE_URL}/my-org')
print(f"Get Profile: {res.status_code}")
print(res.text)
org = res.json()
print(f"Current Name: {org.get('name')}")

# 3. Update Profile
# Create dummy image
with open('test_logo.png', 'wb') as f:
    f.write(b'fake_image_content')

new_name = 'Updated Demo Org ' + str(os.getpid())
files = {'logo': ('test_logo.png', open('test_logo.png', 'rb'), 'image/png')}
data = {'name': new_name}

res = session.post(f'{BASE_URL}/my-org', data=data, files=files)
print(f"Update Profile: {res.status_code}")
print(res.text)

# 4. Verify
res = session.get(f'{BASE_URL}/my-org')
org = res.json()
print(f"New Name: {org.get('name')}")
print(f"Logo Path: {org.get('logo')}")

if org.get('name') == new_name and org.get('logo'):
    print("SUCCESS: Profile updated.")
else:
    print("FAILURE: Profile not updated correctly.")
