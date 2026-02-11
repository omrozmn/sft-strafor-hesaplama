export interface ExtraPart {
    name: string
    count: number
    thickness_cm: number
}

export interface PricingSettings {
    // Blok Özellikleri
    block_volume_m3: number            // M³ (Excel: 2.55)
    base_price_usd_per_m3: number      // Çarpan (Excel: $2.35)

    // Döviz & Risk
    usd_rate: number             // Kur
    usd_spread_tl: number        // Sabit Makas (+0.30₺)
    exchange_risk_percent: number // Yüzdesel Risk

    // İşlem Tipleri & İskonto
    profit_multiplier: number        // Baz Kar Çarpanı (Excel: 3.00)
    discount_rate_high_vol: number   // 10+ İskontosu (%5)
    op_cost_slice_multiplier: number // Dilimleme Çarpanı (Excel: 0.85)
    op_cost_paste_multiplier: number // Yapıştırma Çarpanı (Excel: 1.00)

    // KDV & Nakliye & İşçilik
    vat_multiplier: number           // KDV Çarpanı (%20 -> 1.20)
    shipping_cost_per_block: number
    processing_cost_per_item: number
}

export type OperationType = 'cut' | 'cut_slice' | 'cut_paste'

export interface ManufacturingSettings {
    // 🟢 Makine & Blok (Fiziksel)
    block_x: number                    // 103 cm
    block_y: number                    // 122 cm
    block_z: number                    // 202 cm
    tolerance_axis_202: number         // 3.0 cm (202 - 3 = 199)
    bearing_limit_44: number           // 44.0 cm (rulman kısıt)

    // 🔵 Kesim Payları (Üretim)
    cut_allowance_xy: number           // 0.5 cm (tel kesim payı)
    cut_allowance_z: number            // 0.2 cm (dilimleme payı)

    // 🟠 Optimizasyon (Motor)
    default_order_qty: number          // 1000 adet (sipariş yoksa simülasyon)
    max_loop_limit: number             // 900.000 (güvenlik sınırı)
    scoring_weight_qty: number         // 1000 (adet önceliği katsayısı)
}

export interface EPSInput {
    boy: number
    en: number
    yukseklik: number
    wall_thickness: number
    dns?: number
    extra_parts: ExtraPart[]
    req_boxes?: number
    operation_type?: OperationType
    pricing?: PricingSettings          // Ticari Ayarlar
    manufacturing?: ManufacturingSettings // Üretim Ayarları
}

export interface EPSOutput {
    blocks_needed: number
    per_block: Record<string, number>
    required?: Record<string, number>
    excess?: Record<string, number>
    pricing: {
        unit_price: number
        total_price: number
        details: {
            ham_blok_tl_per_block: number
            karli_blok_tl_per_block: number
            total_shipping_cost: number
            total_processing_cost: number
            is_discounted: boolean
        }
    }
    details: {
        block_cm: number[]
        rule_44cm: {
            applied: boolean
            axis_202_role: string
            h_eff: number
        }
        cut_dims_cm: {
            footprint: [number, number]
            box_h: number
            parts_h: Record<string, number>
        }
        layout_2d: {
            sira_adedi: number
            rotation: string
            table_axes: number[]
        }
        per_sira: Record<string, number>
        sira_plan: Record<string, number>
    }
}

// Constants
// Default Constants (Fallback)
const DEFAULT_MFG: ManufacturingSettings = {
    block_x: 103,
    block_y: 122,
    block_z: 202,
    tolerance_axis_202: 3.0,
    bearing_limit_44: 44.0,
    cut_allowance_xy: 0.5,
    cut_allowance_z: 0.2,
    default_order_qty: 1000,
    max_loop_limit: 900000,
    scoring_weight_qty: 1000
}

export class EPSCalculator {
    calculate(data: EPSInput): EPSOutput {
        // Helper to handle both dot and comma strings from UI
        const safeNum = (val: any, fallback = 0) => {
            if (val === undefined || val === null || val === '') return fallback
            if (typeof val === 'string') {
                const processed = val.replace(',', '.')
                const num = parseFloat(processed)
                return isNaN(num) ? fallback : num
            }
            return typeof val === 'number' ? val : fallback
        }

        // 0. Load Manufacturing Settings (defaults if missing)
        const mfg = { ...DEFAULT_MFG, ...(data.manufacturing || {}) }
        const EFFECTIVE_Z = safeNum(mfg.block_z) - safeNum(mfg.tolerance_axis_202)

        // 1. Calculate Cutting Dimensions (Paylar) - Spec Sections 4.1 & 4.2

        // XY (En/Boy): Ürün + (2 × Duvar) + Tel Kesim Payı
        // Spec 4.1: cut_xy = product_xy + 2*wall_thickness + 0.5
        const cut_x = safeNum(data.en) + (2 * safeNum(data.wall_thickness)) + safeNum(mfg.cut_allowance_xy)
        const cut_y = safeNum(data.boy) + (2 * safeNum(data.wall_thickness)) + safeNum(mfg.cut_allowance_xy)

        // Z (Yükseklik): Ürün + Dilimleme Payı
        // Spec 4.2: cut_box_h = product_h + 0.2
        const cut_box_h = safeNum(data.yukseklik) + safeNum(mfg.cut_allowance_z)

        // Kapaklar: Kalınlık + Dilimleme Payı
        // Spec 4.2: cut_cap_h = cap_thickness + 0.2
        const parts_h: Record<string, number> = {}
        data.extra_parts.forEach((p) => {
            parts_h[p.name] = safeNum(p.thickness_cm) + safeNum(mfg.cut_allowance_z)
        })

        // 2. Axis Assignment (Eksen Atama)
        // 44cm Rule: Only assign 202 to Table if cut >= 44
        const configs: Array<any> = []

        // Scenario 1: Z-axis is Height (Mod B - Vertical)
        configs.push({
            table: [safeNum(mfg.block_x), safeNum(mfg.block_y)],
            h_eff: EFFECTIVE_Z,
            role_202: 'height',
        })

        // Scenario 2: Z-axis is on Table (Mod A - Horizontal)
        if (cut_x >= safeNum(mfg.bearing_limit_44)) {
            configs.push({ table: [EFFECTIVE_Z, safeNum(mfg.block_y)], h_eff: safeNum(mfg.block_x), role_202: 'table_x' })
            configs.push({ table: [EFFECTIVE_Z, safeNum(mfg.block_x)], h_eff: safeNum(mfg.block_y), role_202: 'table_x' })
        }
        if (cut_y >= safeNum(mfg.bearing_limit_44)) {
            configs.push({ table: [safeNum(mfg.block_x), EFFECTIVE_Z], h_eff: safeNum(mfg.block_y), role_202: 'table_y' })
            configs.push({ table: [safeNum(mfg.block_y), EFFECTIVE_Z], h_eff: safeNum(mfg.block_x), role_202: 'table_y' })
        }

        // Find Best Layout
        let selected_config: any = null
        let selected_layout: any = null
        let max_score = -1 // Use score to break ties (Items * 1000 + Rows)

        configs.forEach((cfg) => {
            const [T1, T2] = cfg.table

            // 202cm constraint check for each rotation
            // Logic: If a table axis is the 202 axis (EFFECTIVE_Z), 
            // the product dimension assigned to it must be >= 44cm.

            // Rotation 1: T1 -> cut_x, T2 -> cut_y
            let r1 = 0
            const t1_is_202 = T1 === EFFECTIVE_Z
            const t2_is_202 = T2 === EFFECTIVE_Z

            const r1_t1_ok = !t1_is_202 || cut_x >= safeNum(mfg.bearing_limit_44)
            const r1_t2_ok = !t2_is_202 || cut_y >= safeNum(mfg.bearing_limit_44)

            if (r1_t1_ok && r1_t2_ok) {
                r1 = Math.floor(T1 / cut_x) * Math.floor(T2 / cut_y)
            }

            // Rotation 2: T1 -> cut_y, T2 -> cut_x
            let r2 = 0
            const r2_t1_ok = !t1_is_202 || cut_y >= safeNum(mfg.bearing_limit_44)
            const r2_t2_ok = !t2_is_202 || cut_x >= safeNum(mfg.bearing_limit_44)

            if (r2_t1_ok && r2_t2_ok) {
                r2 = Math.floor(T1 / cut_y) * Math.floor(T2 / cut_x)
            }

            const sira = Math.max(r1, r2)
            if (sira === 0) return // Skip invalid config

            const rot = r1 >= r2 ? 'Normal' : 'Rotated'

            const h_eff = cfg.h_eff
            const box_per_sira_col = Math.floor(h_eff / cut_box_h)

            const total_boxes = sira * box_per_sira_col

            // Scoring: Primary = Total Items. Secondary = Sira Count (More rows = better mix)
            const score = (total_boxes * safeNum(mfg.scoring_weight_qty)) + sira

            if (score > max_score) {
                max_score = score
                selected_config = cfg
                selected_layout = {
                    sira_adedi: sira,
                    rotation: rot,
                    table_axes: cfg.table
                }
            }
        })

        // Fallback
        if (!selected_config) {
            // Should not happen as Mod B is always added
            selected_config = configs[0]
            selected_layout = { sira_adedi: 0, rotation: 'N/A', table_axes: [103, 122] }
        }

        // 3. Per Sira Defaults
        const h_eff = selected_config.h_eff
        const per_sira_map: Record<string, number> = {}
        per_sira_map['Box'] = Math.floor(h_eff / cut_box_h)
        data.extra_parts.forEach(p => {
            per_sira_map[p.name] = Math.floor(h_eff / parts_h[p.name])
        })

        // 4. Optimization Engine
        // Brute Force Row Partitioning to meet demand requirements
        const sira_max = selected_layout.sira_adedi
        const part_names = data.extra_parts.map(p => p.name)
        const comps = ['Box', ...part_names]

        // Ratios
        const req_vals: Record<string, number> = {}
        const is_order = data.req_boxes && safeNum(data.req_boxes) > 0
        const target_boxes = safeNum(data.req_boxes) || safeNum(mfg.default_order_qty)

        req_vals['Box'] = target_boxes
        data.extra_parts.forEach(p => {
            req_vals[p.name] = target_boxes * safeNum(p.count)
        })

        // Partition Generator
        function* partitions(n: number, k: number): Generator<number[]> {
            if (k === 1) {
                yield [n]
                return
            }
            for (let i = 0; i <= n; i++) {
                for (const p of partitions(n - i, k - 1)) {
                    yield [i, ...p]
                }
            }
        }

        let best_blocks = 999999
        let best_plan_rows: Record<string, number> = {}
        comps.forEach(c => best_plan_rows[c] = 0)
        best_plan_rows['Box'] = sira_max // Default

        // If simulating order: Find K blocks.
        // Loop through all row configurations (partitions of sira_max)
        // For each config: Output = V_vector.
        // Needed K = Max(Req_i / V_i)
        // Minimize K.

        for (const p of partitions(sira_max, comps.length)) {
            // p is array of row counts for [Box, P1, P2...]
            const current_yield: Record<string, number> = {}
            let valid = false

            comps.forEach((name, idx) => {
                const count = p[idx] * per_sira_map[name]
                current_yield[name] = count
                if (count > 0) valid = true
            })

            if (!valid) continue

            let k_needed = 0
            let possible = true

            for (const [name, req] of Object.entries(req_vals)) {
                if (req > 0) {
                    const prod = current_yield[name] || 0
                    if (prod === 0) { possible = false; break }
                    const needed = Math.ceil(req / prod)
                    k_needed = Math.max(k_needed, needed)
                }
            }

            if (possible && k_needed < best_blocks) {
                best_blocks = k_needed
                comps.forEach((name, idx) => {
                    best_plan_rows[name] = p[idx]
                })
            }
        }

        if (best_blocks > 900000) best_blocks = 0 // Fail safe

        // 5. Results Compile
        const per_block_counts: Record<string, number> = {}
        comps.forEach(c => {
            per_block_counts[c] = (best_plan_rows[c] || 0) * per_sira_map[c]
        })

        // Totals
        const total_produced: Record<string, number> = {}
        if (is_order) {
            for (const k in per_block_counts) total_produced[k] = per_block_counts[k] * best_blocks
        } else {
            // Unit mode (1 block)
            best_blocks = 1
            for (const k in per_block_counts) total_produced[k] = per_block_counts[k]
        }

        const excess: Record<string, number> = {}
        if (is_order && best_blocks > 0) {
            for (const k in total_produced) {
                excess[k] = total_produced[k] - (req_vals[k] || 0)
            }
        } else {
            for (const k in total_produced) excess[k] = total_produced[k]
        }

        // 6. Pricing Engine - Spec Section 9 + Excel Photo

        // Pricing settings defaults - Sync with Excel logic
        const defaults = {
            block_volume_m3: 2.55,
            base_price_usd_per_m3: 2.35,
            usd_rate: 32.0,
            usd_spread_tl: 0.30,
            exchange_risk_percent: 1.00,
            profit_multiplier: 3.00,
            discount_rate_high_vol: 0.0625, // Excel sub-table: 10+ Blok %6.25 (0.9375 çarpanı)
            op_cost_slice_multiplier: 0.85,  // Excel: Kes-Dilimle %85
            op_cost_paste_multiplier: 1.00,  // Excel: Kes-Yapıştır %100
            vat_multiplier: 1.20,
            shipping_cost_per_block: 400,
            processing_cost_per_item: 0.0
        }
        const pricing = { ...defaults, ...(data.pricing || {}) }

        // 1. Kur Hesabı (Spread Dahil)
        const effective_usd = safeNum(pricing.usd_rate) + safeNum(pricing.usd_spread_tl)
        const dns_val = safeNum(data.dns) || 16

        // Ham Blok = M³ × DNS × Çarpan × Dolar
        const ham_blok_usd = safeNum(pricing.block_volume_m3) * dns_val * safeNum(pricing.base_price_usd_per_m3)
        const ham_blok_tl = ham_blok_usd * effective_usd * safeNum(pricing.exchange_risk_percent)

        // Karlı Blok = Ham × Kar Çarpanı
        const karli_blok_tl = ham_blok_tl * safeNum(pricing.profit_multiplier)

        // Excel Mantığı: Nakliye KARLI fiyata eklenir, sonra operasyon çarpanı uygulanır.
        const shipping_per_block = safeNum(pricing.shipping_cost_per_block)
        const base_total_per_block = karli_blok_tl + shipping_per_block

        // İşlem Tipi Çarpanı (Excel bottom table coefficients)
        let op_multiplier = 0.80 // Default: Kes-Ver (Cut) = %80
        if (data.operation_type === 'cut_slice') op_multiplier = 0.85
        if (data.operation_type === 'cut_paste') op_multiplier = 1.00

        // İskonto Çarpanı (10+ Blok)
        let discount_mult = 1.0
        if (best_blocks >= 10) {
            discount_mult = 1.0 - safeNum(pricing.discount_rate_high_vol, 0.0625)
        }

        // Toplam Hesaplama
        const block_total_ex_vat = best_blocks * base_total_per_block * op_multiplier * discount_mult
        const processing_total = Object.values(total_produced).reduce((a, b) => a + b, 0) * safeNum(pricing.processing_cost_per_item)

        const total_ex_vat = block_total_ex_vat + processing_total
        const total_inc_vat = total_ex_vat * safeNum(pricing.vat_multiplier)

        // Birim Fiyat
        let unit_div = is_order && safeNum(data.req_boxes) > 0 ? safeNum(data.req_boxes) : total_produced['Box']
        if (unit_div === 0) unit_div = 1
        const unit_price = total_inc_vat / unit_div

        return {
            blocks_needed: best_blocks,
            per_block: per_block_counts,
            required: is_order ? req_vals : undefined,
            excess: excess,
            pricing: {
                total_price: parseFloat(total_inc_vat.toFixed(2)),
                unit_price: parseFloat(unit_price.toFixed(2)),
                details: {
                    ham_blok_tl_per_block: parseFloat(ham_blok_tl.toFixed(2)),
                    karli_blok_tl_per_block: parseFloat(karli_blok_tl.toFixed(2)),
                    total_shipping_cost: parseFloat((best_blocks * shipping_per_block).toFixed(2)),
                    total_processing_cost: parseFloat(processing_total.toFixed(2)),
                    is_discounted: best_blocks >= 10
                }
            },
            details: {
                block_cm: [mfg.block_x, mfg.block_y, mfg.block_z],
                rule_44cm: {
                    applied: true,
                    axis_202_role: selected_config.role_202,
                    h_eff: selected_config.h_eff
                },
                cut_dims_cm: {
                    footprint: [cut_x, cut_y],
                    box_h: cut_box_h,
                    parts_h: parts_h
                },
                layout_2d: selected_layout,
                per_sira: per_sira_map,
                sira_plan: best_plan_rows
            }
        }
    }
}
