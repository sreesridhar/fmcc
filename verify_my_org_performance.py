
import requests
import time

BASE_URL = 'http://localhost:8000'

def test_performance():
    s = requests.Session()
    
    # Login
    print("Logging in...")
    resp = s.post(f'{BASE_URL}/login', json={'username': 'admin', 'password': 'password'})
    if resp.status_code != 200:
        print(f"Login failed: {resp.status_code} {resp.text}")
        return

    print("Logged in. Testing /api/v1/my-org latency...")
    
    start = time.time()
    resp = s.get(f'{BASE_URL}/api/v1/my-org')
    end = time.time()
    
    duration = end - start
    print(f"Status: {resp.status_code}")
    print(f"Duration: {duration:.4f} seconds")
    print(f"Response: {resp.text}")

if __name__ == '__main__':
    test_performance()
