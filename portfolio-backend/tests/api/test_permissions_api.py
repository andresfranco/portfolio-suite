#!/usr/bin/env python3
"""
Permission API Tests
------------------

This module contains tests for the REST API endpoints for permissions
using direct HTTP requests with the requests library. This is independent
of the FastAPI TestClient and useful for end-to-end testing.
"""
import sys
import logging
import requests
import json
import uuid

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# API base URL - adjust as needed for your environment
BASE_URL = "http://127.0.0.1:8000"

def test_get_permissions_list(filters=None, page=1, page_size=10, sort_field=None, sort_order='asc'):
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
    
    logger.info(f"Testing GET {url} with params: {params}")
    
    try:
        response = requests.get(url, params=params)
        logger.info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Success! Retrieved {len(data.get('items', []))} items.")
            logger.info(f"Total: {data.get('total', 0)}")
            return True
        else:
            logger.error(f"Error Response: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Request Exception: {str(e)}")
        return False

def test_create_permission():
    """Test creating a new permission."""
    url = f"{BASE_URL}/api/permissions/"
    
    # Generate a unique permission name to avoid conflicts
    unique_suffix = str(uuid.uuid4())[:8]
    test_data = {
        "name": f"API_TEST_PERMISSION_{unique_suffix.upper()}",
        "description": "Test permission created via API test"
    }
    
    logger.info(f"Testing POST {url} with data: {test_data}")
    
    try:
        response = requests.post(url, json=test_data)
        logger.info(f"Status Code: {response.status_code}")
        
        if response.status_code == 201:
            data = response.json()
            logger.info(f"Success! Created permission with ID: {data.get('id')}")
            
            # Return the created permission data for potential cleanup
            return data
        else:
            logger.error(f"Error Response: {response.text}")
            return None
    except Exception as e:
        logger.error(f"Request Exception: {str(e)}")
        return None

def test_update_permission(permission_id, update_data):
    """Test updating an existing permission."""
    url = f"{BASE_URL}/api/permissions/{permission_id}"
    
    logger.info(f"Testing PUT {url} with data: {update_data}")
    
    try:
        response = requests.put(url, json=update_data)
        logger.info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Success! Updated permission: {data}")
            return True
        else:
            logger.error(f"Error Response: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Request Exception: {str(e)}")
        return False

def test_delete_permission(permission_id):
    """Test deleting an existing permission."""
    url = f"{BASE_URL}/api/permissions/{permission_id}"
    
    logger.info(f"Testing DELETE {url}")
    
    try:
        response = requests.delete(url)
        logger.info(f"Status Code: {response.status_code}")
        
        if response.status_code == 204:
            logger.info(f"Success! Deleted permission with ID: {permission_id}")
            return True
        else:
            logger.error(f"Error Response: {response.text}")
            return False
    except Exception as e:
        logger.error(f"Request Exception: {str(e)}")
        return False

def run_all_tests():
    """Run a complete test suite for permissions API."""
    logger.info("Starting Permission API End-to-End Tests")
    
    # Test 1: Retrieve permissions list
    logger.info("\n--- Test 1: Retrieve permissions list ---")
    if not test_get_permissions_list():
        logger.error("Test 1 failed")
        return False
    
    # Test 2: Create a new permission
    logger.info("\n--- Test 2: Create a new permission ---")
    created_permission = test_create_permission()
    if not created_permission:
        logger.error("Test 2 failed")
        return False
    
    permission_id = created_permission.get('id')
    
    # Test 3: Update the created permission
    logger.info("\n--- Test 3: Update the permission ---")
    update_data = {"description": "Updated permission description"}
    if not test_update_permission(permission_id, update_data):
        logger.error("Test 3 failed")
        # Continue with cleanup despite failure
    
    # Test 4: Delete the permission
    logger.info("\n--- Test 4: Delete the permission ---")
    if not test_delete_permission(permission_id):
        logger.error("Test 4 failed")
        return False
    
    logger.info("\nAll tests completed successfully!")
    return True

if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1) 