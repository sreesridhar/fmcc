import requests
import os

BASE_URL = "http://localhost:8000/api/v1"
TEST_IMG = "test_logo.png"

# Create a dummy image
if not os.path.exists(TEST_IMG):
    with open(TEST_IMG, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")

def login(username, password):
    s = requests.Session()
    res = s.post(f"{BASE_URL}/login", json={"username": username, "password": password})
    if res.status_code != 200:
        print(f"Login failed: {res.text}")
        return None
    return s

def test_logo_lifecycle():
    # Valid credentials from setup_db.php or previous context
    s = login('admin', 'admin123') 
    if not s: return

    # 1. Create Organization
    res = s.post(f"{BASE_URL}/orgs", json={"name": "Logo Test Org"})
    if res.status_code != 200:
        print(f"Failed to create org: {res.text}")
        return
    org_id = res.json()['id']
    print(f"Created Org ID: {org_id}")
    
    # Create Org Admin
    res = s.post(f"{BASE_URL}/users", json={
        "username": f"orgadmin_{org_id}",
        "password": "password",
        "role": "org_admin",
        "org_id": org_id
    })
    
    # Login as new Org Admin
    s = login(f"orgadmin_{org_id}", "password")
    if not s: return
    print("Logged in as Org Admin")

    # 2. Upload Logo
    with open(TEST_IMG, 'rb') as f:
        files = {'logo': (TEST_IMG, f, 'image/png')}
        res = s.post(f"{BASE_URL}/my-org", data={'name': 'Logo Test Org Updated'}, files=files)
        print(f"Upload Response: {res.text}")
    
    # Verify Upload
    res = s.get(f"{BASE_URL}/my-org")
    org = res.json()
    if not org.get('logo'):
        print("Error: Logo not uploaded")
        return
    print(f"Logo confirmed at: {org['logo']}")

    # 3. Delete Logo
    res = s.post(f"{BASE_URL}/my-org", data={'name': 'Logo Test Org No Logo', 'delete_logo': '1'})
    print(f"Delete Response: {res.text}")

    # Verify Deletion
    res = s.get(f"{BASE_URL}/my-org")
    org = res.json()
    if org.get('logo'):
        print(f"Error: Logo still exists: {org['logo']}")
    else:
        print("Success: Logo deleted from DB record")

if __name__ == "__main__":
    test_logo_lifecycle()
