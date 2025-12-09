
import requests
import json

BASE_URL = 'http://localhost:8000'

def test_users_api():
    s = requests.Session()
    
    # Login as admin
    print("Logging in as admin...")
    resp = s.post(f'{BASE_URL}/api/v1/login', json={'username': 'admin', 'password': 'password'})
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} {resp.text}")
        return

    print("Logged in. Fetching /api/v1/users...")
    resp = s.get(f'{BASE_URL}/api/v1/users')
    
    print(f"Status: {resp.status_code}")
    try:
        data = resp.json()
        print(f"Users found: {len(data)}")
        # print first user to check structure
        if len(data) > 0:
            print(f"Sample User: {data[0]}")
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        print(f"Response text: {resp.text[:500]}")

if __name__ == '__main__':
    test_users_api()
