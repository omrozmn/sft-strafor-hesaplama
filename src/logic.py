import math
import itertools
from typing import List, Tuple, Dict, Optional
from .models import (
    EPSInput, EPSOutput, DetailedReport, CutDims, Layout2D, 
    Pricing, BLOCK_DIMS, TOLERANCE_202, EFFECTIVE_202, RULE_44_LIMIT,
    WIRE_THICKNESS, SLICE_THICKNESS
)

# Checklist Constants
# 3. Paylar & Toleranslar
# En + Boy -> Total 2mm (0.2 cm)
# Yükseklik -> Total 5mm (0.5 cm)
# Note: These values replace the generic WIRE_THICKNESS usage for primary cuts.
TOLERANCE_XY = 0.2  # cm
TOLERANCE_Z = 0.5   # cm

class EPSLogic:
    def calculate(self, data: EPSInput) -> EPSOutput:
        # 1. Calculate Cutting Dimensions (Paylar)
        # Checklist: En + Boy için toplam 2 mm (1+1)
        # Assumption: Inputs are OUTER dimensions. Wall thickness describes the product, not the footprint.
        cut_x = data.en + TOLERANCE_XY
        cut_y = data.boy + TOLERANCE_XY
        
        # Checklist: Yükseklik için toplam 5 mm (2.5+2.5)
        cut_box_h = data.yukseklik + TOLERANCE_Z
        
        # Parts Heights
        parts_h = {}
        for p in data.extra_parts:
            # Apply Z tolerance to each part
            parts_h[p.name] = p.thickness_cm + TOLERANCE_Z
        
        # 2. Axis Assignment (Eksen Atama)
        # Checklist 4: 202 Eksen Atama Kuralı
        # - En verimli olan atanır.
        # - 44 cm altı ASLA atanmaz.
        # - 3cm tolerance applied (EFFECTIVE_202 = 199)
        
        candidates_for_202 = []
        if cut_x >= RULE_44_LIMIT: candidates_for_202.append('x')
        if cut_y >= RULE_44_LIMIT: candidates_for_202.append('y')
        
        configs = []
        
        # Scenario 1: 202 is Height (Mod B / Default fallback)
        # Table = 103, 122. Height = 199 (eff)
        # This is valid ONLY if we don't violate ANY logic constraints?
        # The 44cm rule applies to the ITEM assigned to 202 axis. 
        # If 202 is Height, then the effective height of the block is 199. 
        # Items are stacked vertically. Is there a min height constraint? Not strictly 44.
        
        configs.append({
            'table': [103, 122],
            'h_eff': EFFECTIVE_202,
            'role_202': 'height',
        })
        
        # Scenario 2: 202 is on Table (Mod A)
        # Only allowed if dimension >= 44cm
        
        if cut_x >= RULE_44_LIMIT:
             # 202 axis is X. 
             # Table becomes [199, 122] or [199, 103]
             # Remaining dims assign to Height [103 or 122]
             configs.append({'table': [EFFECTIVE_202, 122], 'h_eff': 103.0, 'role_202': 'table_x'})
             configs.append({'table': [EFFECTIVE_202, 103], 'h_eff': 122.0, 'role_202': 'table_x'})
             
        if cut_y >= RULE_44_LIMIT:
             # 202 axis is Y.
             configs.append({'table': [103, EFFECTIVE_202], 'h_eff': 122.0, 'role_202': 'table_y'})
             configs.append({'table': [122, EFFECTIVE_202], 'h_eff': 103.0, 'role_202': 'table_y'})

        # Checklist 6: Maksimim Verim Hesabı
        # "En yüksek adet veren yerleşim seçiliyor mu?"
        
        selected_config = None
        selected_layout = None
        current_max_items_per_block = -1
        
        for cfg in configs:
            T1, T2 = cfg['table']
            
            # Rotations (Checklist 6)
            # R1: X->T1, Y->T2
            r1 = math.floor(T1 / cut_x) * math.floor(T2 / cut_y)
            # R2: X->T2, Y->T1
            r2 = math.floor(T2 / cut_x) * math.floor(T1 / cut_y)
            
            sira = max(r1, r2)
            rot_desc = "Normal" if r1 >= r2 else "Rotated"
            
            h_eff = cfg['h_eff']
            
            # Box capacity per "Sira"
            box_per_sira_col = math.floor(h_eff / cut_box_h)
            
            total_boxes_theoretical = sira * box_per_sira_col
            
            if total_boxes_theoretical > current_max_items_per_block:
                current_max_items_per_block = total_boxes_theoretical
                selected_config = cfg
                selected_layout = {
                    'sira_adedi': sira,
                    'rotation': rot_desc,
                    'table_axes': cfg['table']
                }

        # Fallback (Scenario: dimensions > block)
        if not selected_config:
            selected_config = {'table': [103, 122], 'h_eff': EFFECTIVE_202, 'role_202': 'height'}
            selected_layout = {'sira_adedi': 0, 'rotation': 'N/A', 'table_axes': [103, 122]}
            
        # 3. Calculate Per Sira (Items per row for Box and Parts)
        h_eff = selected_config['h_eff']
        per_sira_map = {}
        per_sira_map['Box'] = math.floor(h_eff / cut_box_h)
        for p in data.extra_parts:
            per_sira_map[p.name] = math.floor(h_eff / parts_h[p.name])
        
        # 4. Plan Production
        sira_max = selected_layout['sira_adedi']
        req_boxes = data.req_boxes
        
        is_order = req_boxes is not None and req_boxes > 0
        part_names = [p.name for p in data.extra_parts]
        part_ratios = {p.name: p.count for p in data.extra_parts}
        
        per_block_counts = {}
        blocks_needed = 0
        
        if not is_order:
             # Strategy: Report MAX SET capability in 1 Block
             # Similar to previous logic: Find mix of rows maximizing full sets.
             best_sets = -1
             best_plan_rows = {'Box': sira_max}
             for name in part_names: best_plan_rows[name] = 0
             
             # Brute force valid row combinations
             # Optimization scope limiter: If N parts is large this is slow. 
             # For N=1..3 it's instant.
             
             def generate_plans_iter(remaining, index, current_plan):
                 if index == len(part_names):
                     # Last is Box
                     yield current_plan + [remaining]
                     # Also allow not using all rows? Checklist says max verim -> use all rows usually.
                     # But maybe optimal set ratio requires wasted rows.
                     # We only iterate "used all rows" or "up to"?
                     # Strict partitions is faster.
                     pass 
                 # Iterative refactor for simplicity:
                 
             # Simple 3-nested loop for typical Box + 2 caps case
             # Generic approach:
             import itertools
             
             # Valid combinations of rows summing to <= sira_max
             # We want to Maximize min(out_box, out_p1/k, out_p2/k...)
             
             valid_range = range(sira_max + 1)
             
             # Limit search space: Box rows usually dominant if parts are thin?
             # Or Parts are thin so fewer rows needed?
             # Let's use a smarter generator
             
             def partitions(n, k):
                 # Generate all partitions of n items into k bins
                 if k == 1:
                     yield [n]
                     return
                 for i in range(n + 1):
                     for p in partitions(n - i, k - 1):
                         yield [i] + p
                         
             # We apply partition to "Used Rows". 
             # We might not use all rows if ratio is perfect with fewer? 
             # No, usually using more rows = more items.
             # So we iterate partitions of sira_max
             
             # Map indices to components: 0->Box, 1..N->Parts
             comps = ['Box'] + part_names
             
             for p in partitions(sira_max, len(comps)):
                 # p is list of row counts
                 # Calc yield
                 current_yield = {}
                 for i, name in enumerate(comps):
                     current_yield[name] = p[i] * per_sira_map[name]
                 
                 # Calc sets
                 limit = current_yield['Box']
                 valid = True
                 for name in part_names:
                     req = part_ratios[name]
                     if req > 0:
                         limit = min(limit, current_yield[name] // req)
                     else:
                         # 0 requirement? Just ignore
                         pass
                 
                 if limit > best_sets:
                     best_sets = limit
                     # Store plan
                     plan = {}
                     for i, name in enumerate(comps):
                         plan[name] = p[i]
                     best_plan_rows = plan
                     
             blocks_needed = 1
             for k, v in best_plan_rows.items():
                 per_block_counts[k] = v * per_sira_map[k]

        else:
            # Checklist 8: Siparişe Uygun Seçim - Minimum Kombinasyon
            # "Sistem en çok çıkan kombinasyonu değil, siparişi karşılayan minimum kombinasyonu mu seçiyor?"
            
            # Logic: We need TOTAL production >= REQ
            # Blocks * Output_Per_Block >= Req.
            # But Output_Per_Block can vary! We can have Block Type A, Block Type B...
            # Spec 7 says "Aynı planı blok sayısı kadar ölçekle". 
            # This implies Uniform Block content.
            # So we find ONE optimal block configuration, then multiply by N.
            
            # Optimal configuration for Order = A configuration that matches the ORDER RATIO best,
            # so that when scaled to N blocks, waste is minimized.
            
            req_vals_abs = {'Box': req_boxes}
            for p in data.extra_parts:
                req_vals_abs[p.name] = req_boxes * p.count
                
            # Iterate all row permutations again.
            # For each permutation, calc output vector V.
            # We need K * V >= Req.
            # K = ceil( max(Req_i / V_i) ) for all i.
            # Minimize K * Cost? Or Minimize Excess?
            # Goal is likely Minimum Blocks (Cost).
            
            best_blocks_needed = 999999
            best_plan_rows = None
            best_excess_score = 99999999 # Secondary optimization
            
            comps = ['Box'] + part_names
            
            # Helper to generator partitions
            def partitions(n, k):
                 if k == 1:
                     yield [n]
                     return
                 for i in range(n + 1):
                     for p in partitions(n - i, k - 1):
                         yield [i] + p

            for p in partitions(sira_max, len(comps)):
                 current_yield = {}
                 for i, name in enumerate(comps):
                     current_yield[name] = p[i] * per_sira_map[name]
                     
                 # Check if this valid plan produces ANYTHING (prevent div/0)
                 if any(v > 0 for v in current_yield.values()):
                     # Calc needed blocks for this pattern
                     k_needed = 0
                     for cat, req_amt in req_vals_abs.items():
                         prod = current_yield.get(cat, 0)
                         if req_amt > 0:
                             if prod == 0:
                                 k_needed = 999999 # Impossible plan
                                 break
                             needed = math.ceil(req_amt / prod)
                             k_needed = max(k_needed, needed)
                     
                     if k_needed < best_blocks_needed:
                         best_blocks_needed = k_needed
                         # Store
                         plan = {}
                         for i, name in enumerate(comps): plan[name] = p[i]
                         best_plan_rows = plan
                         
                         # Note: Could calculate excess here to break ties
            
            if best_blocks_needed > 900000:
                # Fallback?
                blocks_needed = 0
                per_block_counts = {c: 0 for c in comps}
            else:
                blocks_needed = best_blocks_needed
                for k, v in best_plan_rows.items():
                    per_block_counts[k] = v * per_sira_map[k]

        # 5. Compile Results
        total_produced = {k: v * blocks_needed for k, v in per_block_counts.items()}
        
        req_vals = None
        excess = None
        
        if is_order:
            req_vals = {}
            req_vals['Box'] = req_boxes
            for p in data.extra_parts:
                req_vals[p.name] = req_boxes * p.count
            
            excess = {}
            for k in total_produced:
                req = req_vals.get(k, 0)
                excess[k] = total_produced[k] - req
        else:
            excess = total_produced.copy()
            
        # 6. Pricing Engine (Checklist 10)
        # - USD Kuru
        # - Kur Risk Payı (%30)
        # - Ticari Çarpan (%20)
        # - Blok Fiyatı (Ham vs Karlı?)
        # - KDV (%20)
        
        # Hardcoded Settings (Should be in config)
        USD_RATE = 32.0 
        RISK_MARGIN = 1.30
        TRADE_MARGIN = 1.20
        VAT_RATE = 1.20
        
        # Block Base Price
        # Checklist 11: Adet Aralığı Fiyatı Logic can be added here
        base_block_usd = 120.0 
        if data.dns:
            base_block_usd += (data.dns - 10) * 5
            
        block_cost_tl = base_block_usd * USD_RATE
        
        # Apply Multipliers
        # Base -> Risk -> Trade
        # Price = Cost * 1.30 * 1.20
        sell_price_block = block_cost_tl * RISK_MARGIN * TRADE_MARGIN
        
        # Processing Cost (Kesim İşçiliği)
        # Checklist 12: İşlem Tipi Fiyatı
        # Assuming Standard Cut
        proc_cost_total = sum(total_produced.values()) * 0.5 # 0.5 TL per piece
        
        # Total Excl VAT
        total_price_ex_vat = (blocks_needed * sell_price_block) + proc_cost_total
        
        # Shipping (Checklist 10)
        shipping = 0 # Default 0
        total_price_ex_vat += shipping
        
        # VAT
        total_price_inc_vat = total_price_ex_vat * VAT_RATE
        
        # Unit Price
        divider = req_boxes if req_boxes else total_produced.get('Box', 1)
        if divider == 0: divider = 1
        unit_price = total_price_inc_vat / divider

        # Details Report
        details = DetailedReport(
            block_cm=BLOCK_DIMS,
            rule_44cm={
                "applied": True,
                "axis_202_role": selected_config.get('role_202', 'N/A'),
                "h_eff": selected_config.get('h_eff', 0)
            },
            cut_dims_cm=CutDims(
                footprint=[cut_x, cut_y],
                box_h=cut_box_h,
                parts_h=parts_h
            ),
            layout_2d=selected_layout,
            per_sira=per_sira_map,
            sira_plan=best_plan_rows if best_plan_rows else {}
        )

        return EPSOutput(
            blocks_needed=blocks_needed,
            per_block=per_block_counts,
            required=req_vals,
            excess=excess,
            pricing=Pricing(
                unit_price=round(unit_price, 2), 
                total_price=round(total_price_inc_vat, 2)
            ),
            details=details
        )
