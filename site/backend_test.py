#!/usr/bin/env python3
"""
Anthea Backend API Testing Suite
Tests all API endpoints for the fitness app for couples
"""

import requests
import sys
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class AntheaAPITester:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
        # Test tracking
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Auth state
        self.access_token = None
        self.current_user = None
        
        # Test data storage
        self.test_exercise_id = None
        self.test_workout_id = None
        self.test_session_id = None

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if success:
            self.tests_passed += 1
        else:
            self.failed_tests.append(f"{name}: {details}")
        print()

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200, use_auth: bool = True) -> tuple[bool, Dict]:
        """Make API request and validate response"""
        url = f"{self.base_url}/api{endpoint}"
        headers = {}
        
        if use_auth and self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'
        
        try:
            if method == 'GET':
                response = self.session.get(url, headers=headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = self.session.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=headers)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
            
            if not success:
                print(f"    Expected status {expected_status}, got {response.status_code}")
                print(f"    Response: {response_data}")
            
            return success, response_data
            
        except Exception as e:
            print(f"    Request failed: {str(e)}")
            return False, {"error": str(e)}

    def test_auth_register(self):
        """Test user registration"""
        test_username = f"testuser_{datetime.now().strftime('%H%M%S')}"
        data = {
            "username": test_username,
            "password": "test123",
            "display_name": "Test User",
            "fitness_level": "intermediate"
        }
        
        success, response = self.make_request('POST', '/auth/register', data, use_auth=False)
        
        if success and 'id' in response:
            self.log_test("POST /api/auth/register", True, f"Created user: {response.get('username')}")
            return True
        else:
            self.log_test("POST /api/auth/register", False, f"Failed to create user: {response}")
            return False

    def test_auth_login(self):
        """Test user login with test credentials"""
        data = {
            "username": "testuser",
            "password": "test123"
        }
        
        success, response = self.make_request('POST', '/auth/login', data, use_auth=False)
        
        if success and 'id' in response:
            self.current_user = response
            # Try to extract token from cookies or response
            self.log_test("POST /api/auth/login", True, f"Logged in as: {response.get('username')}")
            return True
        else:
            self.log_test("POST /api/auth/login", False, f"Login failed: {response}")
            return False

    def test_auth_me(self):
        """Test getting current user profile"""
        success, response = self.make_request('GET', '/auth/me')
        
        if success and 'id' in response:
            self.current_user = response
            self.log_test("GET /api/auth/me", True, f"Got profile for: {response.get('username')}")
            return True
        else:
            self.log_test("GET /api/auth/me", False, f"Failed to get profile: {response}")
            return False

    def test_auth_profile_update(self):
        """Test updating user profile"""
        data = {
            "display_name": "Updated Test User",
            "bio": "Test bio for API testing",
            "fitness_level": "advanced",
            "theme": "girly"
        }
        
        success, response = self.make_request('PUT', '/auth/profile', data)
        
        if success and response.get('display_name') == data['display_name']:
            self.log_test("PUT /api/auth/profile", True, "Profile updated successfully")
            return True
        else:
            self.log_test("PUT /api/auth/profile", False, f"Profile update failed: {response}")
            return False

    def test_exercises_get(self):
        """Test getting exercise library"""
        success, response = self.make_request('GET', '/exercises')
        
        if success and isinstance(response, list):
            system_exercises = [ex for ex in response if ex.get('is_system')]
            self.log_test("GET /api/exercises", True, f"Got {len(response)} exercises ({len(system_exercises)} system)")
            return True
        else:
            self.log_test("GET /api/exercises", False, f"Failed to get exercises: {response}")
            return False

    def test_exercises_create(self):
        """Test creating custom exercise"""
        data = {
            "name": "Test Custom Exercise",
            "description": "A test exercise created by API testing",
            "category": "test",
            "exercise_type": "reps",
            "default_reps": 15,
            "default_rest": 45
        }
        
        success, response = self.make_request('POST', '/exercises', data, expected_status=200)
        
        if success and 'id' in response:
            self.test_exercise_id = response['id']
            self.log_test("POST /api/exercises", True, f"Created exercise: {response.get('name')}")
            return True
        else:
            self.log_test("POST /api/exercises", False, f"Failed to create exercise: {response}")
            return False

    def test_workouts_create(self):
        """Test creating a scheduled workout"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        data = {
            "title": "Test API Workout",
            "description": "Workout created via API testing",
            "scheduled_date": tomorrow,
            "scheduled_time": "10:00",
            "difficulty": "medium",
            "blocks": [
                {
                    "block_type": "warmup",
                    "exercises": [
                        {
                            "exercise_id": "test_id",
                            "name": "Jumping Jacks",
                            "exercise_type": "duration",
                            "duration": 60,
                            "rest_after": 15,
                            "order": 0,
                            "tts_enabled": True
                        }
                    ]
                },
                {
                    "block_type": "main",
                    "exercises": [
                        {
                            "exercise_id": "test_id2",
                            "name": "Push-ups",
                            "exercise_type": "reps",
                            "reps": 15,
                            "rest_after": 45,
                            "order": 0,
                            "tts_enabled": True
                        }
                    ]
                }
            ]
        }
        
        success, response = self.make_request('POST', '/workouts', data, expected_status=200)
        
        if success and 'id' in response:
            self.test_workout_id = response['id']
            self.log_test("POST /api/workouts", True, f"Created workout: {response.get('title')}")
            return True
        else:
            self.log_test("POST /api/workouts", False, f"Failed to create workout: {response}")
            return False

    def test_workouts_today(self):
        """Test getting today's workouts"""
        success, response = self.make_request('GET', '/workouts/today')
        
        if success and isinstance(response, list):
            self.log_test("GET /api/workouts/today", True, f"Got {len(response)} workouts for today")
            return True
        else:
            self.log_test("GET /api/workouts/today", False, f"Failed to get today's workouts: {response}")
            return False

    def test_sessions_create(self):
        """Test creating a workout session"""
        if not self.test_workout_id:
            self.log_test("POST /api/sessions", False, "No workout ID available for session creation")
            return False
            
        data = {
            "workout_id": self.test_workout_id,
            "total_time": 1800,  # 30 minutes
            "pause_time": 120,   # 2 minutes pause
            "exercises_completed": 5,
            "exercises_total": 6,
            "status": "completed",
            "fatigue_before": 3,
            "fatigue_after": 7,
            "difficulty_felt": 6,
            "mood": "energized",
            "notes": "Great workout session!"
        }
        
        success, response = self.make_request('POST', '/sessions', data, expected_status=200)
        
        if success and 'id' in response:
            self.test_session_id = response['id']
            self.log_test("POST /api/sessions", True, f"Created session for workout: {response.get('workout_title')}")
            return True
        else:
            self.log_test("POST /api/sessions", False, f"Failed to create session: {response}")
            return False

    def test_sessions_get(self):
        """Test getting workout sessions history"""
        success, response = self.make_request('GET', '/sessions')
        
        if success and isinstance(response, list):
            self.log_test("GET /api/sessions", True, f"Got {len(response)} sessions")
            return True
        else:
            self.log_test("GET /api/sessions", False, f"Failed to get sessions: {response}")
            return False

    def test_duo_stats(self):
        """Test getting duo statistics"""
        success, response = self.make_request('GET', '/duo/stats')
        
        if success and 'streak' in response:
            self.log_test("GET /api/duo/stats", True, f"Streak: {response.get('streak')}, Total workouts: {response.get('total_workouts_together')}")
            return True
        else:
            self.log_test("GET /api/duo/stats", False, f"Failed to get duo stats: {response}")
            return False

    def test_root_endpoint(self):
        """Test API root endpoint"""
        success, response = self.make_request('GET', '', use_auth=False)
        
        if success and 'message' in response:
            self.log_test("GET /api", True, f"API message: {response.get('message')}")
            return True
        else:
            self.log_test("GET /api", False, f"Root endpoint failed: {response}")
            return False

    def run_all_tests(self):
        """Run all API tests in sequence"""
        print("🚀 Starting Anthea API Testing Suite")
        print("=" * 50)
        print()
        
        # Test API root
        self.test_root_endpoint()
        
        # Test authentication flow
        print("🔐 Testing Authentication...")
        self.test_auth_register()
        login_success = self.test_auth_login()
        
        if login_success:
            self.test_auth_me()
            self.test_auth_profile_update()
        else:
            print("⚠️  Skipping authenticated tests due to login failure")
            return self.generate_summary()
        
        # Test exercises
        print("💪 Testing Exercises...")
        self.test_exercises_get()
        self.test_exercises_create()
        
        # Test workouts
        print("🏃 Testing Workouts...")
        self.test_workouts_create()
        self.test_workouts_today()
        
        # Test sessions
        print("📊 Testing Sessions...")
        self.test_sessions_create()
        self.test_sessions_get()
        
        # Test duo features
        print("👫 Testing Duo Features...")
        self.test_duo_stats()
        
        return self.generate_summary()

    def generate_summary(self):
        """Generate test summary"""
        print("=" * 50)
        print("📋 TEST SUMMARY")
        print("=" * 50)
        print(f"Total tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Tests failed: {self.tests_run - self.tests_passed}")
        print(f"Success rate: {(self.tests_passed / self.tests_run * 100):.1f}%")
        
        if self.failed_tests:
            print("\n❌ FAILED TESTS:")
            for failure in self.failed_tests:
                print(f"  - {failure}")
        
        print()
        return {
            "total_tests": self.tests_run,
            "passed_tests": self.tests_passed,
            "failed_tests": self.tests_run - self.tests_passed,
            "success_rate": self.tests_passed / self.tests_run * 100 if self.tests_run > 0 else 0,
            "failures": self.failed_tests
        }

def main():
    """Main test execution"""
    tester = AntheaAPITester()
    results = tester.run_all_tests()
    
    # Return appropriate exit code
    return 0 if results["failed_tests"] == 0 else 1

if __name__ == "__main__":
    sys.exit(main())