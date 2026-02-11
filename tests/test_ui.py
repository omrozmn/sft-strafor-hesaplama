import re
import pytest
from playwright.sync_api import Page, expect

def test_sft_calculator_ui(page: Page):
    # 1. Navigate to App
    page.goto("http://localhost:6098/")
    
    # 2. Check Title or Header
    # Header <h1> says "SFT Strafor Hesaplaa"
    expect(page.get_by_text("SFT Strafor Hesaplaa")).to_be_visible()
    
    # 3. Fill Form
    # Inputs by name in React App
    page.locator("input[name='boy']").fill("50")
    page.locator("input[name='en']").fill("50")
    page.locator("input[name='yukseklik']").fill("50")
    
    # Optional Inputs
    page.locator("input[name='req_boxes']").fill("100")

    # 4. Verify Dynamic Parts (Defaults: Top & Bottom Cap)
    # Check that inputs exist with values
    # "Üst Kapak" is present in input value
    expect(page.locator("input[value='Üst Kapak']")).to_be_visible()
    expect(page.locator("input[value='Alt Kapak']")).to_be_visible()
    
    # Test Adding a New Part
    page.get_by_role("button", name="Parça Ekle").click()
    expect(page.locator("input[value='Yeni Parça']")).to_be_visible()
    
    # Rename New Part
    page.locator("input[value='Yeni Parça']").fill("Ara Levha")
    
    # 5. Submit
    # Button has text "HESAPLA & OPTİMİZE ET"
    page.get_by_role("button", name="HESAPLA & OPTİMİZE ET").click()
    
    # 6. Verify Results
    # Wait for KPI Card "Blok İhtiyacı"
    expect(page.get_by_text("Blok İhtiyacı")).to_be_visible(timeout=10000)
    
    # Check for "Ara Levha" in results - Use first match or specific cell
    # "Ara Levha" appears in Table and Badges. Just checking if it exists is enough.
    expect(page.get_by_text("Ara Levha").first).to_be_visible()

    print("\n✅ React Dynamic UI Test Passed: Calculation flow verified.")
