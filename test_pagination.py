import requests
import json
import sys

BASE_URL = 'http://localhost:8000/api/v1'

def run_tests():
    s = requests.Session()
    
    # Login
    print("Testing Login...")
    try:
        resp = s.post(f'{BASE_URL}/login', json={'username': 'admin', 'password': 'admin123'})
        if resp.status_code != 200:
            print(f"Login failed: {resp.status_code} {resp.text}")
            return False
    except Exception as e:
        print(f"Connection failed: {e}")
        return False
        
    print("Login Successful.")
    
    endpoints = [
        ('users', '/users'),
        ('clients', '/clients'),
        ('sites', '/sites'),
        ('transactions', '/transactions?type=income'), # Validates income specifically
        ('transactions_exp', '/transactions?type=expense'),
    ]
    
    all_passed = True
    
    for name, endpoint in endpoints:
        print(f"\n--- Testing {name} ---")
        
        # Test 1: Limit
        print(f"  Fetching limit=2...")
        sep = '&' if '?' in endpoint else '?'
        url_limit = f'{BASE_URL}{endpoint}{sep}limit=2'
        
        r = s.get(url_limit)
        if r.status_code != 200:
            print(f"  FAILED: Status {r.status_code}")
            all_passed = False
            continue
            
        data_resp = r.json()
        if isinstance(data_resp, dict) and 'data' in data_resp:
             data = data_resp['data']
             total = data_resp.get('total')
             print(f"  Received {len(data)} items (Total: {total})")
        elif isinstance(data_resp, list):
             data = data_resp
             print(f"  Received {len(data)} items (Legacy List)")
        else:
            print(f"  FAILED: Response is not list or {data, total} dict")
            all_passed = False
            continue
        if len(data) > 2:
            print(f"  FAILED: Received more than 2 items")
            all_passed = False
            
        # Test 2: Offset
        if len(data) > 0:
            first_item_id = data[0].get('id')
            print(f"  First item ID: {first_item_id}")
            
            # Fetch with offset 1
            print(f"  Fetching limit=2&offset=1...")
            url_offset = f'{url_limit}&offset=1'
            r_off = s.get(url_offset)
            data_off_resp = r_off.json()
            if isinstance(data_off_resp, dict) and 'data' in data_off_resp:
                data_off = data_off_resp['data']
            else:
                data_off = data_off_resp
            
            if len(data_off) > 0:
                print(f"  Offset item ID: {data_off[0].get('id')}")
                if data_off[0].get('id') == first_item_id:
                     print(f"  FAILED: Offset 1 returned same first item")
                     all_passed = False
                else:
                     print(f"  Verified offset works (IDs differ)")
            else:
                print("  (Not enough data to fully verify offset shift, but received empty or less, which implies offset worked or end reached)")
        else:
            print("  (No data to test offset)")

    return all_passed

if __name__ == '__main__':
    if run_tests():
        print("\nAll Pagination Tests Passed!")
        sys.exit(0)
    else:
        print("\nSome Tests Failed.")
        sys.exit(1)
