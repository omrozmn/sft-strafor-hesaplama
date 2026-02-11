from src.logic import EPSLogic
from src.models import EPSInput, ExtraPart

def audit_logic():
    engine = EPSLogic()
    # Test Case: Standard Box + Caps
    # En: 50, Boy: 50, Yuk: 50
    # Parts: Top Cap (2cm), Bottom Cap (2cm)
    # Req: 100 boxes
    data = EPSInput(
        boy=50, en=50, yukseklik=50,
        wall_thickness=2.0, dns=10,
        extra_parts=[
            ExtraPart(name="Ust Kapak", count=1, thickness_cm=2.0),
            ExtraPart(name="Alt Kapak", count=1, thickness_cm=2.0)
        ],
        req_boxes=100
    )
    
    print("\n--- INPUT DATA ---")
    print(data)
    
    # Run Calc
    result = engine.calculate(data)
    
    print("\n--- OUTPUT RESULT ---")
    print(f"Blocks Needed: {result.blocks_needed}")
    print(f"Per Block: {result.per_block}")
    print(f"Excess: {result.excess}")
    print(f"Details: {result.details}")
    
    # Manual Validation of Logic Trace
    # Check Cuts
    # En=50 + 2*2(wall) + 0.2(tol) = 54.2
    # Boy=50 + 2*2(wall) + 0.2(tol) = 54.2
    # H = 50 + 0.5(tol) = 50.5
    
    # Axis Selection (44cm Rule)
    # 54.2 > 44 -> 202 axis is X or Y possible.
    # If 202 is on Table (X or Y):
    #   Table = [202, 122] -> H_eff = 103
    #   Rows = floor(199/54.2) * floor(122/54.2) = 3 * 2 = 6 rows
    #   H_eff 103 -> Box(50.5) = 2 per row
    #   Total = 6 * 2 = 12 boxes per block
    
    # If 202 is Height:
    #   Table = [103, 122]
    #   Rows = floor(103/54.2) * floor(122/54.2) = 1 * 2 = 2 rows
    #   H_eff 199 -> Box(50.5) = 3 per row
    #   Total = 2 * 3 = 6 boxes per block (Inferior)
    
    # Expected: 202 assigned to X/Y Table (Mod A). 
    # Check result.details.rule_44cm
    
    print("\n--- AUDIT CHECKS ---")
    r44 = result.details.rule_44cm
    print(f"44cm Rule applied: {r44}")
    
    if r44['axis_202_role'] not in ['table_x', 'table_y']:
        print("❌ FAIL: Should have chosen Table Axis for higher yield.")
    else:
        print("✅ PASS: Chosen Table Axis.")
        
if __name__ == "__main__":
    audit_logic()
