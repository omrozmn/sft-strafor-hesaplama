const form = document.getElementById('calcForm');
const emptyState = document.getElementById('emptyState');
const resultsDashboard = document.getElementById('resultsDashboard');

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Animate Button
    const btn = form.querySelector('.hero-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<div class="spinner-sm"></div> İşleniyor...';
    btn.style.opacity = '0.8';

    const formData = new FormData(form);
    const data = {};
    for (let [key, value] of formData.entries()) {
        if (value.trim() === '') continue;
        const num = parseFloat(value);
        data[key] = isNaN(num) ? value : num;
    }

    // Integers
    ['top_cap_count', 'bottom_cap_count', 'req_boxes'].forEach(k => {
        if (data[k]) data[k] = parseInt(data[k]);
    });

    try {
        const response = await fetch('/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error('Failed');

        const result = await response.json();
        renderDashboard(result);

        // Transition
        emptyState.classList.add('hidden');
        resultsDashboard.classList.remove('hidden');

    } catch (err) {
        alert('Hesaplama Hatası: ' + err.message);
    } finally {
        btn.innerHTML = originalText;
        btn.style.opacity = '1';
    }
});

function renderDashboard(res) {
    // KPI Counters (Simple animation placeholder)
    document.getElementById('resBlocks').innerText = res.blocks_needed;

    // Format Currency
    const fmt = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
    document.getElementById('resPrice').innerText = fmt.format(res.pricing.total_price);

    const layout = res.details.layout_2d;
    const rotText = layout.rotation === "Normal" ? "Normal" : "Çevrilmiş";
    document.getElementById('resEff').innerText = `${layout.sira_adedi} Sıra / ${rotText}`;

    // Table
    const tbody = document.getElementById('productionTable');
    tbody.innerHTML = '';

    const items = [
        { label: 'Kutu', key: 'boxes' },
        { label: 'Üst Kapak', key: 'top_caps' },
        { label: 'Alt Kapak', key: 'bottom_caps' }
    ];

    items.forEach(i => {
        const perBlock = res.per_block[i.key];
        const total = perBlock * res.blocks_needed;
        const req = res.required ? res.required[i.key] : '-';
        const exc = res.excess ? res.excess[i.key] : total;

        let statusHtml = '<span class="status-badge ok">TAMAM</span>';
        if (exc > 0 && req !== '-') statusHtml = `<span class="status-badge excess">+${exc} FAZLA</span>`;

        tbody.innerHTML += `
            <tr>
                <td><span style="font-weight:500; color:white">${i.label}</span></td>
                <td class="mono">${perBlock}</td>
                <td class="mono" style="color:var(--primary)">${total}</td>
                <td class="mono">${req}</td>
                <td>${statusHtml}</td>
            </tr>
        `;
    });

    // Tech Details
    document.getElementById('techBlockDim').innerText = res.details.block_cm.join(' × ');

    let axisRole = res.details.rule_44cm.axis_202_role;
    // Basic translation for role
    if (axisRole.includes('table')) axisRole = 'TABLA';
    if (axisRole.includes('height')) axisRole = 'YÜKSEKLİK';

    document.getElementById('tech202Axis').innerText = axisRole;
    document.getElementById('techEffH').innerText = res.details.rule_44cm.h_eff + ' cm';

    // Footprint Viz
    const fp = res.details.cut_dims_cm.footprint;
    const fpVisual = document.getElementById('fpVisual');
    document.getElementById('fpText').innerText = `${fp[0]} × ${fp[1]}`;

    // Scaling visual box (simple CSS)
    const scale = 0.8;
    fpVisual.style.width = (fp[0] * scale) + 'px';
    fpVisual.style.height = (fp[1] * scale) + 'px';

    document.getElementById('techLayoutInfo').innerText =
        `Kutu:${res.details.sira_plan.box_sira} | Üst:${res.details.sira_plan.top_cap_sira} | Alt:${res.details.sira_plan.bottom_cap_sira}`;
}
