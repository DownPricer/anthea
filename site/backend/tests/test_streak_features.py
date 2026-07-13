#!/usr/bin/env python3
"""
Anthea Streak Features Test Suite
Tests the new streak-related features:
- POST /api/streak/rest-day - Mark a date as rest day
- POST /api/streak/skip-day - Mark a date as skip day  
- GET /api/streak/days - Get rest/skip days in range
- DELETE /api/streak/day/{date} - Remove a rest/skip day marker
- Streak calculation: rest days should NOT break streak, skip days SHOULD break streak
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get(
    "BACKEND_URL",
    os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000"),
)

# Test credentials
TEST_USERNAME = "testuser"
TEST_PASSWORD = "test123"


@pytest.fixture(scope="module")
def api_session():
    """Create a session with authentication cookies"""
    session = requests.Session()
    session.headers.update({'Content-Type': 'application/json'})
    
    # Login to get auth cookies
    try:
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
            timeout=3,
        )
    except requests.RequestException as e:
        pytest.skip(f"Backend indisponible ({BASE_URL}) : {e}")
    
    if login_response.status_code != 200:
        pytest.skip(f"Login failed: {login_response.text}")
    
    return session


@pytest.fixture
def today_date():
    """Get today's date in YYYY-MM-DD format"""
    return datetime.now().strftime('%Y-%m-%d')


@pytest.fixture
def yesterday_date():
    """Get yesterday's date in YYYY-MM-DD format"""
    return (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')


@pytest.fixture
def week_dates():
    """Get start and end dates for current week"""
    today = datetime.now()
    # Monday of current week
    start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=6)
    return {
        "start": start.strftime('%Y-%m-%d'),
        "end": end.strftime('%Y-%m-%d')
    }


class TestAuthEndpoints:
    """Test authentication is working before streak tests"""
    
    def test_login_success(self, api_session):
        """Verify login works with test credentials"""
        response = api_session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["username"] == TEST_USERNAME
        print(f"Authenticated as: {data['username']}")


class TestStreakRestDay:
    """Tests for POST /api/streak/rest-day endpoint"""
    
    def test_mark_rest_day_success(self, api_session, today_date):
        """Test marking a date as rest day"""
        response = api_session.post(
            f"{BASE_URL}/api/streak/rest-day",
            json={"date": today_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["date"] == today_date
        assert data["type"] == "rest"
        print(f"Marked {today_date} as rest day")
    
    def test_mark_rest_day_replaces_skip(self, api_session, yesterday_date):
        """Test that marking rest day replaces existing skip day"""
        # First mark as skip
        api_session.post(
            f"{BASE_URL}/api/streak/skip-day",
            json={"date": yesterday_date}
        )
        
        # Then mark as rest (should replace)
        response = api_session.post(
            f"{BASE_URL}/api/streak/rest-day",
            json={"date": yesterday_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "rest"
        
        # Verify it's now rest, not skip
        week_start = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        week_end = datetime.now().strftime('%Y-%m-%d')
        
        get_response = api_session.get(
            f"{BASE_URL}/api/streak/days",
            params={"start_date": week_start, "end_date": week_end}
        )
        
        days = get_response.json()
        day_entry = next((d for d in days if d["date"] == yesterday_date), None)
        assert day_entry is not None
        assert day_entry["type"] == "rest"
        print(f"Verified {yesterday_date} is now rest day (replaced skip)")
    
    def test_mark_rest_day_unauthenticated(self, today_date):
        """Test that unauthenticated request fails"""
        session = requests.Session()
        response = session.post(
            f"{BASE_URL}/api/streak/rest-day",
            json={"date": today_date}
        )
        
        assert response.status_code == 401
        print("Unauthenticated request correctly rejected")


class TestStreakSkipDay:
    """Tests for POST /api/streak/skip-day endpoint"""
    
    def test_mark_skip_day_success(self, api_session):
        """Test marking a date as skip day"""
        # Use a date 3 days ago to avoid conflicts with other tests
        test_date = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
        
        response = api_session.post(
            f"{BASE_URL}/api/streak/skip-day",
            json={"date": test_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["date"] == test_date
        assert data["type"] == "skip"
        print(f"Marked {test_date} as skip day")
    
    def test_mark_skip_day_replaces_rest(self, api_session):
        """Test that marking skip day replaces existing rest day"""
        test_date = (datetime.now() - timedelta(days=4)).strftime('%Y-%m-%d')
        
        # First mark as rest
        api_session.post(
            f"{BASE_URL}/api/streak/rest-day",
            json={"date": test_date}
        )
        
        # Then mark as skip (should replace)
        response = api_session.post(
            f"{BASE_URL}/api/streak/skip-day",
            json={"date": test_date}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "skip"
        print(f"Verified {test_date} is now skip day (replaced rest)")


class TestGetStreakDays:
    """Tests for GET /api/streak/days endpoint"""
    
    def test_get_streak_days_success(self, api_session, week_dates):
        """Test getting streak days for a date range"""
        response = api_session.get(
            f"{BASE_URL}/api/streak/days",
            params={"start_date": week_dates["start"], "end_date": week_dates["end"]}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify structure of returned data
        for day in data:
            assert "date" in day
            assert "type" in day
            assert day["type"] in ["rest", "skip"]
        
        print(f"Got {len(data)} streak days for range {week_dates['start']} to {week_dates['end']}")
    
    def test_get_streak_days_empty_range(self, api_session):
        """Test getting streak days for a range with no data"""
        # Use dates far in the future
        future_start = (datetime.now() + timedelta(days=365)).strftime('%Y-%m-%d')
        future_end = (datetime.now() + timedelta(days=370)).strftime('%Y-%m-%d')
        
        response = api_session.get(
            f"{BASE_URL}/api/streak/days",
            params={"start_date": future_start, "end_date": future_end}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
        print("Empty range correctly returns empty list")
    
    def test_get_streak_days_unauthenticated(self, week_dates):
        """Test that unauthenticated request fails"""
        session = requests.Session()
        response = session.get(
            f"{BASE_URL}/api/streak/days",
            params={"start_date": week_dates["start"], "end_date": week_dates["end"]}
        )
        
        assert response.status_code == 401
        print("Unauthenticated request correctly rejected")


class TestRemoveStreakDay:
    """Tests for DELETE /api/streak/day/{date} endpoint"""
    
    def test_remove_streak_day_success(self, api_session):
        """Test removing a streak day marker"""
        test_date = (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d')
        
        # First create a rest day
        api_session.post(
            f"{BASE_URL}/api/streak/rest-day",
            json={"date": test_date}
        )
        
        # Then remove it
        response = api_session.delete(f"{BASE_URL}/api/streak/day/{test_date}")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["date"] == test_date
        print(f"Successfully removed streak day marker for {test_date}")
    
    def test_remove_nonexistent_day_fails(self, api_session):
        """Test that removing a non-existent day returns 404"""
        # Use a date that definitely doesn't have a marker
        test_date = (datetime.now() + timedelta(days=100)).strftime('%Y-%m-%d')
        
        response = api_session.delete(f"{BASE_URL}/api/streak/day/{test_date}")
        
        assert response.status_code == 404
        print("Removing non-existent day correctly returns 404")
    
    def test_remove_streak_day_unauthenticated(self, today_date):
        """Test that unauthenticated request fails"""
        session = requests.Session()
        response = session.delete(f"{BASE_URL}/api/streak/day/{today_date}")
        
        assert response.status_code == 401
        print("Unauthenticated request correctly rejected")


class TestStreakCalculation:
    """Tests for streak calculation with rest/skip days"""
    
    def test_duo_stats_returns_streak(self, api_session):
        """Test that duo stats endpoint returns streak value"""
        response = api_session.get(f"{BASE_URL}/api/duo/stats")
        
        assert response.status_code == 200
        data = response.json()
        assert "streak" in data
        assert isinstance(data["streak"], int)
        assert data["streak"] >= 0
        print(f"Current streak: {data['streak']}")
    
    def test_rest_day_preserves_streak_concept(self, api_session):
        """Test that rest days are designed to preserve streak (conceptual test)"""
        # This is more of a documentation test - the actual streak calculation
        # depends on workout sessions and partner data
        
        # Mark today as rest day
        today = datetime.now().strftime('%Y-%m-%d')
        response = api_session.post(
            f"{BASE_URL}/api/streak/rest-day",
            json={"date": today}
        )
        
        assert response.status_code == 200
        assert response.json()["type"] == "rest"
        
        # Get duo stats - streak should still be calculated
        stats_response = api_session.get(f"{BASE_URL}/api/duo/stats")
        assert stats_response.status_code == 200
        
        # Note: testuser has no partner, so streak will be 0
        # But the endpoint should work without errors
        print("Rest day marked and duo stats retrieved successfully")
    
    def test_skip_day_breaks_streak_concept(self, api_session):
        """Test that skip days are designed to break streak (conceptual test)"""
        # Mark a day as skip
        test_date = (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d')
        response = api_session.post(
            f"{BASE_URL}/api/streak/skip-day",
            json={"date": test_date}
        )
        
        assert response.status_code == 200
        assert response.json()["type"] == "skip"
        
        # Get duo stats - should work without errors
        stats_response = api_session.get(f"{BASE_URL}/api/duo/stats")
        assert stats_response.status_code == 200
        
        print("Skip day marked and duo stats retrieved successfully")


class TestStreakDayDataIntegrity:
    """Tests for data integrity of streak days"""
    
    def test_create_verify_delete_flow(self, api_session):
        """Test complete flow: create -> verify -> delete -> verify deleted"""
        test_date = (datetime.now() - timedelta(days=6)).strftime('%Y-%m-%d')
        week_start = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        week_end = datetime.now().strftime('%Y-%m-%d')
        
        # 1. Create rest day
        create_response = api_session.post(
            f"{BASE_URL}/api/streak/rest-day",
            json={"date": test_date}
        )
        assert create_response.status_code == 200
        
        # 2. Verify it exists
        get_response = api_session.get(
            f"{BASE_URL}/api/streak/days",
            params={"start_date": week_start, "end_date": week_end}
        )
        days = get_response.json()
        assert any(d["date"] == test_date and d["type"] == "rest" for d in days)
        
        # 3. Delete it
        delete_response = api_session.delete(f"{BASE_URL}/api/streak/day/{test_date}")
        assert delete_response.status_code == 200
        
        # 4. Verify it's gone
        get_response2 = api_session.get(
            f"{BASE_URL}/api/streak/days",
            params={"start_date": week_start, "end_date": week_end}
        )
        days2 = get_response2.json()
        assert not any(d["date"] == test_date for d in days2)
        
        print(f"Complete CRUD flow verified for {test_date}")


# Cleanup fixture to remove test data after all tests
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(api_session):
    """Cleanup test streak days after tests complete"""
    yield
    
    # Clean up any test data created
    test_dates = [
        datetime.now().strftime('%Y-%m-%d'),
        (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d'),
        (datetime.now() - timedelta(days=2)).strftime('%Y-%m-%d'),
        (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d'),
        (datetime.now() - timedelta(days=4)).strftime('%Y-%m-%d'),
        (datetime.now() - timedelta(days=5)).strftime('%Y-%m-%d'),
        (datetime.now() - timedelta(days=6)).strftime('%Y-%m-%d'),
    ]
    
    for date in test_dates:
        try:
            api_session.delete(f"{BASE_URL}/api/streak/day/{date}")
        except:
            pass
    
    print("Test data cleanup completed")
