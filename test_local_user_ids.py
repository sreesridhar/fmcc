import requests
import time

BASE_URL = 'http://localhost:8000/api/v1'

def create_user(session, username, role, org_id=None):
    data = {'username': username, 'password': 'password123', 'role': role}
    if org_id:
        data['org_id'] = org_id
    res = session.post(f'{BASE_URL}/users', json=data)
    if res.status_code != 200:
        print(f"Failed to create user {username}: {res.text}")
        return None
    return res.json()['id']

def get_user(session, user_id):
    # This endpoint returns all users, we find filter.
    # Optimally we'd have GET /users/:id but let's list.
    res = session.get(f'{BASE_URL}/users')
    users = res.json()
    for u in users:
        if str(u['id']) == str(user_id):
            return u
    return None

# 1. Login as Org Admin (sridhar) - Org ID 1
sridhar_sess = requests.Session()
res = sridhar_sess.post(f'{BASE_URL}/login', json={'username': 'sridhar', 'password': 'password123'})
if res.status_code != 200:
    print(f"Sridhar Login Failed: {res.text}")
    exit(1)
print("Sridhar Login Success")

# Check existing max local_id for Org 1
# From DB check, it was 2.
print("Testing Org 1 (sridhar)...")
u1_id = create_user(sridhar_sess, f'u1_org1_{time.time()}', 'staff')
if not u1_id: exit(1)

u1 = get_user(sridhar_sess, u1_id)
if not u1: 
    print("Failed to fetch user 1")
    exit(1)
print(f"User 1 Object: {u1}")
print(f"User 1 Local ID: {u1.get('local_id')}")

u2_id = create_user(sridhar_sess, f'u2_org1_{time.time()}', 'staff')
if not u2_id: exit(1)
u2 = get_user(sridhar_sess, u2_id)
print(f"User 2 Object: {u2}")
print(f"User 2 Local ID: {u2.get('local_id')}")

l1 = u1.get('local_id')
l2 = u2.get('local_id')

if isinstance(l1, int) and isinstance(l2, int) and l2 == l1 + 1:
    print(f"SUCCESS: Org 1 sequencing correct ({l1} -> {l2}).")
else:
    print(f"FAILURE: Org 1 sequencing incorrect. Got {l1}, {l2}")

# 2. Login as Super Admin to create new Org
admin_sess = requests.Session()
res = admin_sess.post(f'{BASE_URL}/login', json={'username': 'admin', 'password': 'admin123'})
if res.status_code != 200:
    print(f"Admin Login Failed: {res.text}")
    exit(1)

# Create New Org
res = admin_sess.post(f'{BASE_URL}/orgs', json={'name': 'Local ID Test Org ' + str(time.time())}) # Unique name
if res.status_code != 200:
    print(f"Org Create Failed: {res.text}")
    exit(1)
new_org_id = res.json()['id']
print(f"Created New Org ID: {new_org_id}")

# Create Users for New Org (as Super Admin)
print("Testing New Org...")
nu1_id = create_user(admin_sess, f'nu1_{time.time()}', 'org_admin', new_org_id)
if not nu1_id: exit(1)
nu1 = get_user(admin_sess, nu1_id) # Admin can see all
print(f"New User 1 Local ID: {nu1.get('local_id')}")

nu2_id = create_user(admin_sess, f'nu2_{time.time()}', 'manager', new_org_id)
if not nu2_id: exit(1)
nu2 = get_user(admin_sess, nu2_id)
print(f"New User 2 Local ID: {nu2.get('local_id')}")

if nu1.get('local_id') == 1 and nu2.get('local_id') == 2:
    print("SUCCESS: New Org sequencing correct.")
else:
    print(f"FAILURE: New Org sequencing incorrect. Got {nu1.get('local_id')}, {nu2.get('local_id')}")
