from fastapi.testclient import TestClient
from src.main import app
from src.models import EPSInput

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_calculate_no_order():
    # Test case roughly matching spec example intent (no order size)
    data = {
        "boy": 22.5, # +1 = 23.5 footprint
        "en": 18.5,  # +1 = 19.5 footprint  -> Fits 103/122 table.
        "yukseklik": 16.4, # +0.2 = 16.6
        "wall_thickness": 0.5, # 2*0.5 = 1cm + 0.5 wire = 1.5 added to dims? 
        # Wait, spec says: cut_xy = product + 2*wall + 0.5.
        # My inputs: 22.5 + 1.0 + 0.5 = 24.0.  18.5 + 1.0 + 0.5 = 20.0
        "top_cap_count": 1,
        "bottom_cap_count": 1,
        "top_cap_thickness_cm": 1.0,
        "bottom_cap_thickness_cm": 1.5
    }
    response = client.post("/calculate", json=data)
    assert response.status_code == 200
    res = response.json()
    assert res['blocks_needed'] == 1
    # Check details exist
    assert res['details']['rule_44cm']['applied'] == True

def test_calculate_with_order():
    data = {
        "boy": 50, 
        "en": 50,
        "yukseklik": 50,
        "wall_thickness": 1,
        "top_cap_thickness_cm": 2,
        "bottom_cap_thickness_cm": 2,
        "req_boxes": 100
    }
    response = client.post("/calculate", json=data)
    assert response.status_code == 200
    res = response.json()
    assert res['blocks_needed'] > 0
    assert res['required']['boxes'] == 100
