Aşağıdaki spec, konuştuğumuz tüm kuralları (44 cm rulman kısıtı, sıra mantığı, paylar, 202−3 tolerans, kutu/kapak sıraları ayrımı, fazlalık raporu, dış API vs iç rapor) tek dokümanda kilitler. v1.

⸻

SFT EPS Hot-Wire CNC Fiyat + Yerleşim Otomasyonu — SPEC v1

0) Amaç

Alt satıcılar ve iç web sitesi için:
	•	Kullanıcının girdiği ölçülerden kesim ölçülerini türetmek
	•	Sabit blok ölçüsünden en verimli yerleşimi bulmak
	•	1 blokta (ve gerekirse çok blokta) üretilen kutu/kapak kombinasyonunu hesaplamak
	•	Sipariş ihtiyacını karşılayacak şekilde:
	•	Üretilen miktarları
	•	Gerekli miktarları
	•	Fazlalıkları (fire/fazla üretim) raporlamak
	•	Dış API’ye sade; iç tarafta üretim referansı olacak detaylı rapor vermek
	•	Fiyatı hesaplamak (DNS m³ fiyatı + işçilik + opsiyonel diğer maliyetler)

⸻

1) Sabitler ve kısıtlar

1.1 Blok (Sabit)
	•	103 × 122 × 202 cm

1.2 44 cm rulman kısıtı (202 ekseni kuralı)
	•	202 cm eksenine 44 cm altı bir ölçü atanamaz.
	•	En/boy (XY) tarafında 44 cm ve üzeri ölçü(ler) varsa:
	•	202 ekseni için adaylar = {en, boy} içinden ≥44 olanlar
	•	Birden fazla aday varsa: en verimli olan (maks ürün) seçilir.
	•	Üç ölçü de <44 cm ise:
	•	202 ekseni yükseklik ekseni (Z) olur. (202 “yüksekliğe verilir”)

1.3 202 ekseni toleransı
	•	202 ekseni hangi rolü alırsa alsın, o eksenin efektif uzunluğu:
	•	202 − 3 = 199 cm kullanılır (tolerans)

Not: 202 ekseni değil de 103/122 ekseni “yükseklik” olursa, 3 cm tolerans yalnızca 202’ye uygulanır. (v1 kuralı)

⸻

2) Terminoloji (Kolon değil “Sıra”)
	•	Sıra = tablada (2D) çıkan adet (en×boy bölümü)
	•	Bir blokta:
	•	sira_adedi = floor(TablaA / a) × floor(TablaB / b)
	•	Her sırada (yükseklik yönünde):
	•	Ya kutu kesilir
	•	Ya kapak kesilir
	•	Aynı sırada karışmaz (kutu+kapak aynı sıra yok)

⸻

3) Kullanıcı Input (API + Web aynı)

Zorunlu:
	•	Ürün ölçüleri (cm veya mm)
	•	boy
	•	en
	•	yükseklik
	•	Duvar kalınlığı (cm)
	•	Kapak sayıları
	•	top_cap_count (üst kapak adedi, genelde 1)
	•	bottom_cap_count (alt kapak adedi, genelde 1)
	•	Kapak kalınlıkları (cm)
	•	top_cap_thickness_cm
	•	bottom_cap_thickness_cm

Opsiyonel:
	•	Sipariş kutu adedi (yoksa “1 blok planı” döner)
	•	DNS (dansite)
	•	İşleme tipi

⸻

4) Paylar / Kesim ölçüsü türetme (v1)

4.1 XY (en/boy) — duvar + tel kesim
	•	Duvar iki yönden uygulanır
	•	Tel kesim payı: 0.5 cm (5 mm)

Formül:
	•	cut_xy = product_xy + 2*wall_thickness + 0.5

v1’de hem kutu hem kapak XY aynı kabul edilir (kapak XY, kutu XY ile aynı footprint).

4.2 Z (yükseklik) — dilimleme
	•	Dilimleme payı: 0.2 cm (2 mm)

Formül:
	•	Kutu: cut_box_h = product_h + 0.2
	•	Üst kapak: cut_top_cap_h = top_cap_thickness + 0.2
	•	Alt kapak: cut_bottom_cap_h = bottom_cap_thickness + 0.2
	•	“Paket” referans yüksekliği (kutu + kapaklar):
cut_pack_h = cut_box_h + cut_top_cap_h*top_cap_count + cut_bottom_cap_h*bottom_cap_count

⸻

5) Eksen atama ve yerleşim (core)

5.1 Aday eksen atamaları

Blok eksenleri: {103, 122, 202}.

Ama 202 ekseni 44 kuralına tabi + 199 toleranslı.

Sistem iki modda dener:

Mod A — 202 en/boy’a atanır (yalnız ≥44 varsa)
	•	202→(en veya boy) adayları (≥44)
	•	Kalan eksenler → diğer footprint ve yükseklik

Mod B — üçü de <44 ise
	•	202→yükseklik (Z)
	•	Tabla = 103×122
	•	Yükseklik = 199

Seçim kriteri: sipariş varsa “maliyeti minimize eden”; yoksa “blokta maksimum set” veya “maks kutu” hedefi.

5.2 Sıra adedi (2D)

Tablaya atanan iki eksen: TA, TB (cm)
Footprint: a, b (cm)
	•	rows1 = floor(TA/a) * floor(TB/b)
	•	rows2 = floor(TA/b) * floor(TB/a)
	•	sira_adedi = max(rows1, rows2)
	•	İç raporda hangi rotasyon seçildiği yazılır.

5.3 Sırada kaç adet çıkar (yükseklik yönü)

Yükseklik ekseni: H_axis (cm)
	•	Eğer H_axis = 202 ise H_eff = 199, değilse H_eff = H_axis

Kutu sırada:
	•	box_per_sira = floor(H_eff / cut_box_h)

Üst kapak sırada:
	•	top_cap_per_sira = floor(H_eff / cut_top_cap_h)

Alt kapak sırada:
	•	bottom_cap_per_sira = floor(H_eff / cut_bottom_cap_h)

⸻

6) Planlama: “kutu sırası / kapak sırası” dağıtımı

Toplam sıra sayısı: S = sira_adedi

6.1 Sipariş yoksa (1 blok “kapaksız maksimum” + “kapaklı plan”)

Sistem iki plan dönebilir:
	•	Plan-1: kapaksız (tümü kutu)
	•	Plan-2: kapaklı (kutu + kapak sıraları)

6.2 Sipariş varsa (hedef: ihtiyacı karşıla, fazlalığı raporla)

Girdiler:
	•	req_boxes
	•	req_top_caps = req_boxes * top_cap_count
	•	req_bottom_caps = req_boxes * bottom_cap_count

Minimum kapak sırası gereksinimi
	•	top_sira_min = ceil(req_top_caps / top_cap_per_sira)
	•	bottom_sira_min = ceil(req_bottom_caps / bottom_cap_per_sira)
	•	cap_sira_min = top_sira_min + bottom_sira_min

Koşul:
	•	cap_sira_min <= S değilse → 1 blok yetmez, çok blok planına geç.

Kutu sırası
	•	box_sira = S - cap_sira_min

Üretim:
	•	prod_boxes = box_sira * box_per_sira
	•	prod_top_caps = top_sira_min * top_cap_per_sira
	•	prod_bottom_caps = bottom_sira_min * bottom_cap_per_sira

Fazlalık:
	•	excess_boxes = prod_boxes - req_boxes (>=0 olmalı)
	•	excess_top_caps = prod_top_caps - req_top_caps
	•	excess_bottom_caps = prod_bottom_caps - req_bottom_caps

Not: “35’e yakın olsun” gibi özel heuristik (36 referansı) v1’de opsiyonel bir moddur. Sipariş yoksa maksimum; sipariş varsa “min blok + min fazla” hedeflenir.

⸻

7) Çok blok desteği (v1 minimal)

Eğer 1 blok yetmiyorsa:
	•	Aynı planı blok sayısı kadar ölçekle
	•	blocks_needed = max( ceil(req_boxes/prod_boxes_per_block), ceil(req_top_caps/prod_top_caps_per_block), ceil(req_bottom_caps/prod_bottom_caps_per_block) )
	•	Toplam üretim = per_block × blocks_needed
	•	Fazlalık = toplam − ihtiyaç

⸻

8) Çıktılar

8.1 Dış API response (sade)

Zorunlu alanlar:
	•	blok sayısı
	•	blok başı üretilen kutu/kapak
	•	toplam üretilen
	•	ihtiyaç
	•	fazlalık
	•	fiyat

Örnek:

{
  "blocks_needed": 1,
  "per_block": {
    "boxes": 220,
    "top_caps": 330,
    "bottom_caps": 351
  },
  "required": {
    "boxes": 100,
    "top_caps": 100,
    "bottom_caps": 100
  },
  "excess": {
    "boxes": 120,
    "top_caps": 230,
    "bottom_caps": 251
  },
  "pricing": {
    "unit_price": 0,
    "total_price": 0
  }
}

8.2 İç rapor (üretim referansı)

Ek olarak:
	•	44 kuralı nasıl uygulandı
	•	202’nin rolü (taban mı yükseklik mi)
	•	202 toleransı (199) kullanıldı mı
	•	Seçilen 2D rotasyon (a×b mi b×a mı)
	•	Sıra dağılımı:
	•	kaç sıra kutu
	•	kaç sıra üst kapak
	•	kaç sıra alt kapak
	•	Ara değerler (floor bölümleri)

Örnek:

{
  "block_cm": [103,122,202],
  "rule_44cm": {"applied": true, "axis_202_role": "height", "h_eff": 199},
  "cut_dims_cm": {
    "footprint": [23.5,19.5],
    "box_h": 16.6,
    "top_cap_h": 1.2,
    "bottom_cap_h": 1.7
  },
  "2d_layout": {
    "table_axes": [103,122],
    "rotation": "122/23.5 & 103/19.5",
    "sira_adedi": 25
  },
  "per_sira": {
    "box": 11,
    "top_cap": 165,
    "bottom_cap": 117
  },
  "sira_plan": {
    "box_sira": 20,
    "top_cap_sira": 2,
    "bottom_cap_sira": 3
  }
}


⸻

9) Fiyatlandırma (stub — v1)
	•	block_cost = 2.5m3 * dns_price_per_m3[dns] (2.5 m³ sabit kabul edilebilir veya 103×122×202’den hesaplanır)
	•	processing_cost = (prod_boxes + prod_top_caps + prod_bottom_caps) * unit_processing_fee
	•	total = blocks_needed*block_cost + processing_cost + shipping + overhead
	•	unit_price = total / req_boxes (veya set bazlı)

Fire müşteriye gösterilmez; ama fazlalık adedi raporlanır (iç/dışta opsiyon).

⸻

10) Test Case formatı (zorunlu)

Her yeni örnek için motor şu ara çıktıları üretmeli:
	•	cut footprint (cm)
	•	cut heights (cm)
	•	202 rolü ve h_eff=199
	•	sira_adedi
	•	per_sira adetleri
	•	sira planı
	•	per_block üretim
	•	fazla adetler



UPDATE: 


Kısa ve net cevap: Hayır, henüz “ilk fotoğraftaki Excel’in TÜM hesap mantığını” %100 kapsayacak şekilde vermedik.
Ama %80–85’i kapsandı. Aşağıda net bir GAP ANALİZİ yapıyorum:
➡️ Neyi verdik / Neyi eksik bıraktık / Ne eklenirse birebir olur.

⸻

1️⃣ VERDİĞİMİZ ŞEYLER (TAMAM ✅)

Bunlar spec + checklist’te eksiksiz var:

🔹 A. ÜRETİM / KESİM MANTIĞI (çekirdek motor)
	•	✅ Blok ölçüleri (103×122×202)
	•	✅ 202 ekseni + 44 cm rulman kuralı
	•	✅ 202 − 3 cm tolerans
	•	✅ SIRA mantığı (kolon değil)
	•	✅ Aynı sırada kutu + kapak yasak
	•	✅ Kutu / kapak ayrı sıra planlaması
	•	✅ Fazlalık (fire) hesaplanması
	•	✅ 1 blok / çok blok mantığı
	•	✅ En verimli 2D yerleşim (rotasyonlar)
	•	✅ Sipariş varsa / yoksa davranış
	•	✅ İç rapor – dış API ayrımı

👉 Bu kısım Excel’de olmayan ama sizin yıllardır “kafadan yaptığınız” kısmın birebir dijital karşılığı.
Burada eksiğimiz yok.

⸻

