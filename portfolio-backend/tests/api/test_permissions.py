import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_get_permissions(filters=None, page=1, page_size=10, sort_field=None, sort_order='asc'):
    """Test retrieving permissions with various parameters."""
    url = f"{BASE_URL}/api/permissions/"
    params = {
        'page': page,
        'page_size': page_size
    }
    
    if sort_field:
        params['sort_field'] = sort_field
        params['sort_order'] = sort_order
    
    if filters:
        params['filters'] = json.dumps(filters)
    
    print(f"\nTesting GET {url} with params: {params}")
    
    try:
        response = requests.get(url, params=params)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Success! Retrieved {len(data.get('items', []))} items.")
            print(f"Total: {data.get('total', 0)}")
            return True
        else:
            print(f"Error Response: {response.text}")
            return False
    except Exception as e:
        print(f"Request Exception: {str(e)}")
        return False

def main():
    print("Testing Permission API...")
    
    # Test 1: Basic retrieval without filters
    test_get_permissions()
    
    # Test 2: With sorting
    test_get_permissions(sort_field='name', sort_order='asc')
    
    # Test 3: With name filter
    filters = [
        {"field": "name", "value": "CREATE", "operator": "contains"}
    ]
    test_get_permissions(filters=filters)
    
    # Test 4: With exact match filter
    filters = [
        {"field": "name", "value": "CREATE_USER", "operator": "eq"}
    ]
    test_get_permissions(filters=filters)
    
    # Test 5: With pagination
    test_get_permissions(page=1, page_size=5)
    
    print("\nTests completed!")

if __name__ == "__main__":
    main() 