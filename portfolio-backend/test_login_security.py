#!/usr/bin/env python3
"""
Login Security Test Script

This script tests the enhanced login security features including:
- Rate limiting
- Security audit logging
- SystemAdmin privileges
- Error handling

Usage:
    python test_login_security.py
"""

import requests
import time
import json
from datetime import datetime
from typing import Dict, List, Optional

# Configuration
BASE_URL = "http://localhost:8000"
LOGIN_URL = f"{BASE_URL}/api/auth/login"
USERS_URL = f"{BASE_URL}/api/users"

# Test credentials
VALID_CREDENTIALS = {
    "username": "systemadmin",
    "password": "SystemAdmin123!"
}

INVALID_CREDENTIALS = {
    "username": "systemadmin",
    "password": "wrong_password"
}

class LoginSecurityTester:
    """Test suite for login security features"""
    
    def __init__(self):
        self.session = requests.Session()
        self.test_results = []
        self.access_token = None
    
    def log_test_result(self, test_name: str, success: bool, details: str = ""):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}")
        if details:
            print(f"    Details: {details}")
        print()
    
    def test_successful_login(self):
        """Test successful login with valid credentials"""
        print("Testing successful login...")
        
        try:
            response = self.session.post(LOGIN_URL, data=VALID_CREDENTIALS)
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data.get("access_token")
                user_info = data.get("user", {})
                
                # Verify response structure
                if (self.access_token and 
                    user_info.get("username") == "systemadmin" and
                    user_info.get("is_systemadmin") == True):
                    
                    self.log_test_result(
                        "Successful Login",
                        True,
                        f"Token received, user: {user_info.get('username')}"
                    )
                else:
                    self.log_test_result(
                        "Successful Login",
                        False,
                        "Invalid response structure"
                    )
            else:
                self.log_test_result(
                    "Successful Login",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test_result(
                "Successful Login",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_failed_login(self):
        """Test failed login with invalid credentials"""
        print("Testing failed login...")
        
        try:
            response = self.session.post(LOGIN_URL, data=INVALID_CREDENTIALS)
            
            if response.status_code == 401:
                self.log_test_result(
                    "Failed Login",
                    True,
                    "Correctly rejected invalid credentials"
                )
            else:
                self.log_test_result(
                    "Failed Login",
                    False,
                    f"Unexpected HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test_result(
                "Failed Login",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_login_rate_limiting(self):
        """Test login rate limiting (10 attempts per 15 minutes)"""
        print("Testing login rate limiting...")
        
        try:
            successful_attempts = 0
            rate_limited = False
            
            # Make 12 login attempts
            for i in range(12):
                response = self.session.post(LOGIN_URL, data=VALID_CREDENTIALS)
                
                if response.status_code == 200:
                    successful_attempts += 1
                elif response.status_code == 429:
                    rate_limited = True
                    break
                else:
                    print(f"    Attempt {i+1}: HTTP {response.status_code}")
                
                time.sleep(0.5)  # Small delay between attempts
            
            # Rate limiting should kick in around 10 attempts
            if rate_limited and successful_attempts >= 8:
                self.log_test_result(
                    "Login Rate Limiting",
                    True,
                    f"Rate limited after {successful_attempts} successful attempts"
                )
            else:
                self.log_test_result(
                    "Login Rate Limiting",
                    False,
                    f"Expected rate limiting, got {successful_attempts} attempts"
                )
                
        except Exception as e:
            self.log_test_result(
                "Login Rate Limiting",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_failed_login_rate_limiting(self):
        """Test failed login rate limiting (5 attempts per 15 minutes)"""
        print("Testing failed login rate limiting...")
        
        try:
            failed_attempts = 0
            rate_limited = False
            
            # Make 7 failed attempts
            for i in range(7):
                response = self.session.post(LOGIN_URL, data=INVALID_CREDENTIALS)
                
                if response.status_code == 401:
                    failed_attempts += 1
                elif response.status_code == 429:
                    rate_limited = True
                    break
                else:
                    print(f"    Failed attempt {i+1}: HTTP {response.status_code}")
                
                time.sleep(0.5)  # Small delay between attempts
            
            # Rate limiting should kick in around 5 failed attempts
            if rate_limited and failed_attempts >= 3:
                self.log_test_result(
                    "Failed Login Rate Limiting",
                    True,
                    f"Rate limited after {failed_attempts} failed attempts"
                )
            else:
                self.log_test_result(
                    "Failed Login Rate Limiting",
                    False,
                    f"Expected rate limiting, got {failed_attempts} failed attempts"
                )
                
        except Exception as e:
            self.log_test_result(
                "Failed Login Rate Limiting",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_systemadmin_bypass(self):
        """Test that systemadmin can access protected endpoints"""
        print("Testing systemadmin bypass...")
        
        if not self.access_token:
            self.log_test_result(
                "SystemAdmin Bypass",
                False,
                "No access token available"
            )
            return
        
        try:
            headers = {"Authorization": f"Bearer {self.access_token}"}
            response = self.session.get(USERS_URL, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, dict) and "items" in data:
                    self.log_test_result(
                        "SystemAdmin Bypass",
                        True,
                        f"Successfully accessed users endpoint, got {len(data['items'])} users"
                    )
                else:
                    self.log_test_result(
                        "SystemAdmin Bypass",
                        True,
                        "Successfully accessed users endpoint"
                    )
            else:
                self.log_test_result(
                    "SystemAdmin Bypass",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test_result(
                "SystemAdmin Bypass",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_token_validation(self):
        """Test token validation with invalid token"""
        print("Testing token validation...")
        
        try:
            # Use invalid token
            headers = {"Authorization": "Bearer invalid_token_here"}
            response = self.session.get(USERS_URL, headers=headers)
            
            if response.status_code == 401:
                self.log_test_result(
                    "Token Validation",
                    True,
                    "Correctly rejected invalid token"
                )
            else:
                self.log_test_result(
                    "Token Validation",
                    False,
                    f"Unexpected HTTP {response.status_code}: {response.text}"
                )
                
        except Exception as e:
            self.log_test_result(
                "Token Validation",
                False,
                f"Exception: {str(e)}"
            )
    
    def test_server_availability(self):
        """Test if server is running and responding"""
        print("Testing server availability...")
        
        try:
            response = self.session.get(f"{BASE_URL}/health")
            
            if response.status_code == 200:
                self.log_test_result(
                    "Server Availability",
                    True,
                    "Server is running and responding"
                )
                return True
            else:
                self.log_test_result(
                    "Server Availability",
                    False,
                    f"HTTP {response.status_code}: {response.text}"
                )
                return False
                
        except Exception as e:
            self.log_test_result(
                "Server Availability",
                False,
                f"Exception: {str(e)}"
            )
            return False
    
    def run_all_tests(self):
        """Run all security tests"""
        print("🔒 Login Security Test Suite")
        print("=" * 50)
        
        # Check server availability first
        if not self.test_server_availability():
            print("❌ Server is not available. Please start the backend server.")
            return False
        
        # Wait a moment for rate limits to reset
        print("Waiting for rate limits to reset...")
        time.sleep(2)
        
        # Run tests
        self.test_successful_login()
        self.test_failed_login()
        self.test_token_validation()
        self.test_systemadmin_bypass()
        
        # Rate limiting tests (run separately to avoid interference)
        print("Starting rate limiting tests...")
        print("⚠️  These tests may take a few moments...")
        
        self.test_login_rate_limiting()
        
        # Wait before failed login rate limiting test
        print("Waiting before failed login rate limiting test...")
        time.sleep(3)
        
        self.test_failed_login_rate_limiting()
        
        # Print summary
        self.print_summary()
        
        return all(result["success"] for result in self.test_results)
    
    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 50)
        print("TEST SUMMARY")
        print("=" * 50)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  ❌ {result['test']}: {result['details']}")
        
        print("\nTest Results Details:")
        for result in self.test_results:
            status = "✅" if result["success"] else "❌"
            print(f"  {status} {result['test']}")
            if result["details"]:
                print(f"      {result['details']}")
        
        print("\n" + "=" * 50)

def main():
    """Main function"""
    tester = LoginSecurityTester()
    
    print("Login Security Test Script")
    print("This script will test the enhanced login security features.")
    print("Make sure the backend server is running on localhost:8000")
    print()
    
    input("Press Enter to start tests... ")
    
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Login security is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Please check the backend implementation.")
    
    return success

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1) 