import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Layers, Scissors, Settings, Activity, DollarSign, Package, Plus, X, TrendingUp, RefreshCw, Tag } from 'lucide-react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { EPSCalculator, type EPSInput, type PricingSettings } from './logic/eps'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface ExtraPart {
  name: string
  count: number
  thickness_cm: number
}

// EPSInput interface is now imported from './logic/eps'
// interface EPSInput {
//   boy: number
//   en: number
//   yukseklik: number
//   wall_thickness: number
//   dns?: number
//   extra_parts: ExtraPart[]
//   req_boxes?: number
// }



// System Hard Defaults - EXACT MATCH with Excel screenshot
const SYSTEM_PRICING_DEFAULTS: PricingSettings = {
  block_volume_m3: 2.55,
  base_price_usd_per_m3: 2.35,
  usd_rate: 32.0,
  usd_spread_tl: 0.30,
  exchange_risk_percent: 1.00,
  profit_multiplier: 3.00,
  discount_rate_high_vol: 0.0625,   // Excel: %6.25 iskonto
  op_cost_slice_multiplier: 0.85,  // Excel: 0.85 katsayı
  op_cost_paste_multiplier: 1.00,  // Excel: 1.00 katsayı
  vat_multiplier: 1.20,
  shipping_cost_per_block: 400,
  processing_cost_per_item: 0.0
}

const SYSTEM_MANUFACTURING_DEFAULTS = {
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

function App() {
  const [usdRate, setUsdRate] = useState<number>(32.0)
  const [usdLoading, setUsdLoading] = useState<boolean>(false)
  const [usdLastUpdate, setUsdLastUpdate] = useState<string>('')

  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<'pricing' | 'parameters'>('pricing')

  // Load Initial Data from localStorage or System Defaults
  const getInitialFormData = (): EPSInput => {
    const savedPricing = localStorage.getItem('sft_user_pricing')
    const savedMfg = localStorage.getItem('sft_user_mfg')

    return {
      boy: 0, en: 0, yukseklik: 0,
      wall_thickness: 1.0, dns: undefined,
      extra_parts: [
        { name: 'Üst Kapak', count: 1, thickness_cm: 2.0 },
        { name: 'Alt Kapak', count: 1, thickness_cm: 2.0 }
      ],
      req_boxes: undefined,
      operation_type: 'cut',
      pricing: savedPricing ? JSON.parse(savedPricing) : SYSTEM_PRICING_DEFAULTS,
      manufacturing: savedMfg ? JSON.parse(savedMfg) : SYSTEM_MANUFACTURING_DEFAULTS
    }
  }

  const [formData, setFormData] = useState<EPSInput>(getInitialFormData())

  // UI Feedback States
  const [toast, setToast] = useState<{ message: string, show: boolean }>({ message: '', show: false })
  const [confirm, setConfirm] = useState<{ show: boolean, title: string, message: string, onConfirm: () => void } | null>(null)

  const showToast = (msg: string) => {
    setToast({ message: msg, show: true })
    setTimeout(() => setToast({ message: '', show: false }), 3000)
  }

  // Persist "Save as Default" Logic
  const saveAsDefault = () => {
    setConfirm({
      show: true,
      title: 'Varsayılanlarak Kaydet',
      message: 'Mevcut ayarlar uygulama her açıldığında aktif olacak şekilde kaydedilsin mi?',
      onConfirm: () => {
        localStorage.setItem('sft_user_pricing', JSON.stringify(formData.pricing))
        localStorage.setItem('sft_user_mfg', JSON.stringify(formData.manufacturing))
        showToast('Ayarlar başarıyla kaydedildi.')
        setConfirm(null)
      }
    })
  }

  const resetToSystemDefaults = () => {
    setConfirm({
      show: true,
      title: 'Fabrika Ayarlarına Dön',
      message: 'Tüm kişiselleştirilmiş ayarlarınız silinecek ve sistem orijinal değerlerine dönecek. Emin misiniz?',
      onConfirm: () => {
        localStorage.removeItem('sft_user_pricing')
        localStorage.removeItem('sft_user_mfg')
        setFormData(prev => ({
          ...prev,
          pricing: SYSTEM_PRICING_DEFAULTS,
          manufacturing: SYSTEM_MANUFACTURING_DEFAULTS
        }))
        showToast('Sistem varsayılanlara sıfırlandı.')
        setConfirm(null)
      }
    })
  }

  const [result, setResult] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Fetch USD Rate from API
  const fetchUsdRate = async () => {
    setUsdLoading(true)
    try {
      // Frankfurter API is more reliable for free tier
      const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY')
      if (!response.ok) throw new Error('API yanıt vermedi')

      const data = await response.json()
      const rate = data.rates.TRY

      if (!rate) throw new Error('Kur verisi bulunamadı')

      setUsdRate(rate)
      setUsdLastUpdate(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))

      setFormData(prev => ({
        ...prev,
        pricing: {
          ...prev.pricing!,
          usd_rate: rate
        }
      }))
    } catch (err) {
      console.error('USD kuru alınamadı:', err)
      setError('USD kuru güncellenemedi. Lütfen manuel giriniz.')
    } finally {
      setUsdLoading(false)
    }
  }

  useEffect(() => {
    fetchUsdRate()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    // Store as string to allow typing decimals (dot/comma)
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Dynamic Parts Handling
  const handlePartChange = (index: number, field: keyof ExtraPart, value: any) => {
    const newParts = [...formData.extra_parts]
    let finalVal = value

    if (typeof value === 'string') {
      const processed = value.replace(',', '.')
      if (processed !== '' && !isNaN(Number(processed))) {
        finalVal = parseFloat(processed)
      }
    }

    newParts[index] = { ...newParts[index], [field]: finalVal }
    setFormData(prev => ({ ...prev, extra_parts: newParts }))
  }

  const addPart = () => {
    setFormData(prev => ({
      ...prev,
      extra_parts: [...prev.extra_parts, { name: 'Yeni Parça', count: 1, thickness_cm: 1.0 }]
    }))
  }

  const removePart = (index: number) => {
    setFormData(prev => ({
      ...prev,
      extra_parts: prev.extra_parts.filter((_, i) => i !== index)
    }))
  }

  const handlePricingChange = (field: keyof PricingSettings, value: string) => {
    setFormData(prev => ({
      ...prev,
      pricing: {
        ...prev.pricing!,
        [field]: value
      }
    }))
  }

  const handleManufacturingChange = (field: keyof any, value: string) => {
    setFormData(prev => ({
      ...prev,
      manufacturing: {
        ...prev.manufacturing!,
        [field]: value
      }
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Simulate async for effect
    setTimeout(() => {
      try {
        const engine = new EPSCalculator()
        const res = engine.calculate(formData)
        setResult(res)
      } catch (err: any) {
        console.error(err)
        setError('Hesaplama Hatası: ' + err.message)
      } finally {
        setLoading(false)
      }
    }, 600)
  }

  // Custom localized validation message
  const handleInvalid = (e: React.FormEvent<HTMLInputElement>) => {
    e.currentTarget.setCustomValidity('Lütfen bu alanı doldurunuz.')
  }
  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    e.currentTarget.setCustomValidity('')
  }

  return (
    <div className="min-h-screen p-4 md:p-8 lg:p-12 relative overflow-hidden font-sans">
      {/* Background Mesh */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-background to-background"></div>

      <header className="mb-8 md:mb-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Box className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              SFT <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Strafor Hesaplama</span>
            </h1>
            <p className="text-xs text-zinc-500 font-mono">v1.3 NEXT-GEN</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* USD Rate Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 backdrop-blur-xl border border-emerald-500/20 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-lg hover:shadow-emerald-500/20 transition-all group"
          >
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="text-emerald-400" size={20} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-bold">USD/TRY</div>
                <div className="text-lg font-bold text-white font-mono">
                  {usdLoading ? (
                    <div className="w-16 h-5 bg-white/10 animate-pulse rounded"></div>
                  ) : (
                    `₺${usdRate.toFixed(2)}`
                  )}
                </div>
                {usdLastUpdate && (
                  <div className="text-[9px] text-zinc-500">{usdLastUpdate}</div>
                )}
              </div>
            </div>
            <button
              onClick={fetchUsdRate}
              disabled={usdLoading}
              className="p-2 hover:bg-emerald-500/10 rounded-lg transition-colors disabled:opacity-50"
              title="Kuru Yenile"
            >
              <RefreshCw className={cn("text-emerald-400", usdLoading && "animate-spin")} size={16} />
            </button>
          </motion.div>

          {/* Settings Button */}
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-3 bg-zinc-800/50 hover:bg-zinc-700/50 border border-white/10 rounded-xl transition-all flex items-center gap-2 group"
            title="Ayarlar"
          >
            <Settings className="text-zinc-400 group-hover:text-white group-hover:rotate-90 transition-all" size={20} />
          </button>

          <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></div>
            Sistem Hazır
          </div>
        </div>
      </header>

      <main className="grid lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
        {/* Input Form */}
        <div className="lg:col-span-4 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl"
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              <Section title="Ürün Ölçüleri (cm)" icon={<Box size={16} />}>
                <div className="grid grid-cols-3 gap-3">
                  <Input label="Boy" name="boy" value={formData.boy || ''} onChange={handleChange} onInvalid={handleInvalid} onInput={handleInput} required />
                  <Input label="En" name="en" value={formData.en || ''} onChange={handleChange} onInvalid={handleInvalid} onInput={handleInput} required />
                  <Input label="Yükseklik" name="yukseklik" value={formData.yukseklik || ''} onChange={handleChange} onInvalid={handleInvalid} onInput={handleInput} required />
                </div>
              </Section>

              <Section title="Özellikler" icon={<Settings size={16} />}>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Duvar Kalınlığı" name="wall_thickness" value={formData.wall_thickness} onChange={handleChange} step={0.1} required />
                  <Input label="DNS (Opsiyonel)" name="dns" value={formData.dns || ''} placeholder="Oto" onChange={handleChange} />
                </div>
              </Section>

              <Section title="Ek Parçalar / Kapaklar" icon={<Layers size={16} />}>
                <div className="space-y-3">
                  {formData.extra_parts.map((part, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/5 rounded-xl p-3 relative group transition-all hover:bg-white/10">
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          className="bg-transparent text-sm font-medium text-white focus:outline-none w-full border-b border-transparent focus:border-indigo-500 placeholder-zinc-500"
                          value={part.name}
                          onChange={(e) => handlePartChange(idx, 'name', e.target.value)}
                          placeholder="Parça Adı"
                        />
                        <button type="button" onClick={() => removePart(idx)} className="text-zinc-600 hover:text-red-400 transition-colors p-1">
                          <X size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-zinc-500 uppercase">Adet</label>
                          <div className="mt-1 relative">
                            <input
                              type="number"
                              className="w-full bg-zinc-950/50 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-white/5"
                              value={part.count}
                              onChange={(e) => handlePartChange(idx, 'count', parseInt(e.target.value))}
                            />
                          </div>
                        </div>
                        <span className="text-zinc-600 pt-4">×</span>
                        <div className="flex-1">
                          <label className="text-[10px] text-zinc-500 uppercase">Kalınlık (cm)</label>
                          <div className="mt-1 relative">
                            <input
                              type="number" step="0.1"
                              className="w-full bg-zinc-950/50 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500 border border-white/5"
                              value={part.thickness_cm}
                              onChange={(e) => handlePartChange(idx, 'thickness_cm', parseFloat(e.target.value))}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={addPart}
                    className="w-full py-2 border border-dashed border-zinc-700 text-zinc-500 rounded-xl text-sm hover:border-indigo-500 hover:text-indigo-400 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Parça Ekle
                  </button>
                </div>
              </Section>

              <Section title="Sipariş & İşlem Detayları" icon={<Package size={16} />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div className="flex flex-col gap-2 w-full">
                    <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">İşlem Tipi</label>
                    <div className="relative">
                      <select
                        className="w-full bg-zinc-950/50 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm focus:ring-1 focus:ring-indigo-500 outline-none appearance-none text-white hover:border-white/20 transition-all"
                        value={formData.operation_type || 'cut'}
                        onChange={(e) => setFormData(prev => ({ ...prev, operation_type: e.target.value as any }))}
                      >
                        <option value="cut">Sadece Kesim (Standart)</option>
                        <option value="cut_slice">Kesim + Dilimleme (%85)</option>
                        <option value="cut_paste">Kesim + Yapıştırma (%100)</option>
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                        <Settings size={14} />
                      </div>
                    </div>
                  </div>
                  <Input label="Hedef Kutu Adedi (İsteğe Bağlı)" name="req_boxes" type="number" onChange={handleChange} placeholder="Örn: 1000" />
                </div>

                <div className="mt-4 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-start gap-3">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 mt-0.5">
                    <Tag size={14} />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-400 mb-0.5">Otomatik İskonto</h4>
                    <p className="text-[11px] text-emerald-500/70">
                      10 blok ve üzeri siparişlerde birim fiyata otomatik <strong>%6.25 miktar iskontosu</strong> uygulanır.
                    </p>
                  </div>
                </div>
              </Section>

              <button
                type="submit"
                disabled={loading}
                className="w-full relative overflow-hidden bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white font-semibold py-4 rounded-xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 group shadow-xl shadow-indigo-500/20"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>HESAPLA & OPTİMİZE ET</span>
                    <Scissors size={18} className="group-hover:rotate-12 transition-transform" />
                  </>
                )}
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
              </button>

              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-start gap-2">
                  <Activity className="shrink-0 mt-0.5" size={16} />
                  {error}
                </div>
              )}
            </form>
          </motion.div>
        </div>

        {/* Results Area */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="h-full flex flex-col items-center justify-center text-zinc-600 border-2 border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20 backdrop-blur-sm min-h-[500px] p-8"
              >
                <div className="relative mb-6">
                  <div className="w-24 h-24 bg-zinc-800/50 rounded-full flex items-center justify-center animate-pulse">
                    <Box size={40} className="opacity-20" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Activity size={32} className="text-indigo-500 opacity-80" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-zinc-300">Veri Girişi Bekleniyor</h2>
                <p className="max-w-xs text-center mt-3 text-zinc-500">
                  Sol panelden ürün ölçülerini giriniz. Sistem otomatik olarak en verimli kesim planını oluşturacaktır.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KPICard title="Blok İhtiyacı" value={result.blocks_needed} icon={<Box />} gradient="from-indigo-500 to-blue-500" delay={0.1} />
                  <KPICard title="Toplam Maliyet" value={`${result.pricing.total_price.toLocaleString('tr-TR')} ₺`} icon={<DollarSign />} gradient="from-emerald-500 to-teal-500" delay={0.2} />
                  <KPICard title="Birim Maliyet" value={`${result.pricing.unit_price.toFixed(2)} ₺`} sub="/ parça" icon={<Activity />} gradient="from-violet-500 to-purple-500" delay={0.3} />
                </div>

                {/* Details Pane */}
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Production Table */}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                    className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 shadow-xl"
                  >
                    <h3 className="text-lg font-medium mb-6 flex items-center gap-2 text-white"><Settings size={18} className="text-zinc-400" /> Üretim Detayları</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-zinc-500 border-b border-white/5 uppercase tracking-wider text-xs">
                          <tr>
                            <th className="pb-3 pl-2">Parça</th>
                            <th className="pb-3 text-right">Blok/Adet</th>
                            <th className="pb-3 text-right">Toplam</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {Object.entries(result.per_block).map(([key, val]) => (
                            <Row
                              key={key}
                              label={key === 'Box' ? 'Kutu' : key}
                              per={val}
                              total={result.required && result.required[key] ? result.required[key] : '-'}
                              isBox={key === 'Box'}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>

                  {/* Tech Details */}
                  <motion.div
                    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                    className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 shadow-xl flex flex-col"
                  >
                    <h3 className="text-lg font-medium mb-6 flex items-center gap-2 text-white"><Scissors size={18} className="text-zinc-400" /> Kesim Mantığı</h3>
                    <div className="space-y-4 text-sm text-zinc-400 flex-1">
                      <DetailRow label="Eksen Rolü (202cm)" value={result.details.rule_44cm.axis_202_role === 'height' ? 'Yükseklik' : 'Taban Alanı'} />
                      <DetailRow label="Efektif Yükseklik" value={`${result.details.rule_44cm.h_eff} cm`} />
                      <DetailRow label="Blok Ölçüsü" value={result.details.block_cm.join(' × ')} mono />

                      <div className="mt-8 pt-6 border-t border-white/5">
                        <div className="text-xs uppercase tracking-wider mb-3 text-zinc-500 font-semibold">Sıra Düzeni (Rows)</div>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(result.details.sira_plan).map(([key, val]) => (
                            <Badge key={key} label={key === 'Box' ? 'Kutu' : key} val={val} />
                          ))}
                        </div>
                      </div>

                      <div className="mt-8 pt-6 border-t border-white/5">
                        <div className="text-xs uppercase tracking-wider mb-3 text-zinc-500 font-semibold">Ticari Özet (Blok Başı/Toplam)</div>
                        <div className="space-y-2">
                          <DetailRow label="Ham Blok Fiyatı" value={`${result.pricing.details.ham_blok_tl_per_block.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`} />
                          <DetailRow label="Karlı Blok Fiyatı" value={`${result.pricing.details.karli_blok_tl_per_block.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`} />
                          <DetailRow label="Toplam Nakliye Bedeli" value={`${result.pricing.details.total_shipping_cost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`} />
                          <div className="pt-2 mt-2 border-t border-white/5">
                            <DetailRow label="KDV Dahil Satış (Birim Blok)" value={`${((result.pricing.details.karli_blok_tl_per_block + (result.pricing.details.total_shipping_cost / result.blocks_needed)) * 1.2).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺`} />
                          </div>
                          {result.pricing.details.is_discounted && (
                            <div className="flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded w-fit mt-2">
                              <Tag size={10} /> 10+ Blok İskontosu Uygulandı (-%{(formData.pricing?.discount_rate_high_vol! * 100).toFixed(0)})
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {settingsOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSettingsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl pointer-events-auto overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                      <Settings className="text-indigo-400" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Sistem Ayarları</h2>
                      <p className="text-xs text-zinc-500">Fiyatlandırma ve hesaplama parametreleri</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <X className="text-zinc-400" size={20} />
                  </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5 px-6">
                  <button
                    onClick={() => setActiveTab('pricing')}
                    className={cn(
                      "px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px",
                      activeTab === 'pricing'
                        ? "text-indigo-400 border-indigo-500"
                        : "text-zinc-500 border-transparent hover:text-zinc-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <DollarSign size={16} />
                      Fiyatlandırma
                    </div>
                  </button>
                  <button
                    onClick={() => setActiveTab('parameters')}
                    className={cn(
                      "px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px",
                      activeTab === 'parameters'
                        ? "text-indigo-400 border-indigo-500"
                        : "text-zinc-500 border-transparent hover:text-zinc-300"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Settings size={16} />
                      Parametreler
                    </div>
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                  {activeTab === 'pricing' && (
                    <div className="space-y-4">
                      {/* Grup 1: Temel Değerler */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp size={12} />
                            Kur & Baz Değerler
                          </h4>
                          <button
                            onClick={fetchUsdRate}
                            disabled={usdLoading}
                            className="flex items-center gap-1.5 text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                          >
                            <RefreshCw size={10} className={usdLoading ? "animate-spin" : ""} />
                            {usdLoading ? 'Güncelleniyor...' : 'Kuru Yenile'}
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="USD Kuru"
                            value={formData.pricing?.usd_rate || ''}
                            onChange={(e: any) => handlePricingChange('usd_rate', e.target.value)}
                            step={0.01}
                          />
                          <div className="relative">
                            <Input
                              label="Kur Makası (₺)"
                              value={formData.pricing?.usd_spread_tl || ''}
                              onChange={(e: any) => handlePricingChange('usd_spread_tl', e.target.value)}
                              step={0.01}
                              placeholder="+0.30"
                            />
                            <div className="absolute right-2 top-8 text-[10px] text-emerald-500 font-mono">
                              +{(formData.pricing?.usd_spread_tl || 0).toFixed(2)}₺
                            </div>
                          </div>
                          <Input
                            label="Fiyat Çarpanı ($)"
                            value={formData.pricing?.base_price_usd_per_m3 || ''}
                            onChange={(e: any) => handlePricingChange('base_price_usd_per_m3', e.target.value)}
                            step={0.01}
                          />
                          <Input
                            label="Blok Hacmi (m³)"
                            value={formData.pricing?.block_volume_m3 || ''}
                            onChange={(e: any) => handlePricingChange('block_volume_m3', e.target.value)}
                            step={0.01}
                          />
                        </div>
                      </div>

                      <div className="border-t border-white/5 my-4"></div>

                      {/* Grup 2: Kar & Risk */}
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                          <Activity size={12} />
                          Kar, Risk & İskontolar
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Kar Çarpanı (Örn: 3.00)"
                            value={formData.pricing?.profit_multiplier || ''}
                            onChange={(e: any) => handlePricingChange('profit_multiplier', e.target.value)}
                            step={0.01}
                          />
                          <Input
                            label="Risk Çarpanı (Opsiyonel)"
                            value={formData.pricing?.exchange_risk_percent || ''}
                            onChange={(e: any) => handlePricingChange('exchange_risk_percent', e.target.value)}
                            step={0.01}
                          />
                          <div className="col-span-2">
                            <Input
                              label="10+ Blok İskontosu (Örn: 0.05 = %5)"
                              value={formData.pricing?.discount_rate_high_vol || ''}
                              onChange={(e: any) => handlePricingChange('discount_rate_high_vol', e.target.value)}
                              step={0.01}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-white/5 my-4"></div>

                      {/* Grup 3: İşlem Maliyet Çarpanları */}
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                          <Scissors size={12} />
                          İşlem Maliyet Çarpanları
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Dilimleme Çarpanı (Excel: 0.85)"
                            value={formData.pricing?.op_cost_slice_multiplier || ''}
                            onChange={(e: any) => handlePricingChange('op_cost_slice_multiplier', e.target.value)}
                            step={0.01}
                          />
                          <Input
                            label="Yapıştırma Çarpanı (Excel: 1.00)"
                            value={formData.pricing?.op_cost_paste_multiplier || ''}
                            onChange={(e: any) => handlePricingChange('op_cost_paste_multiplier', e.target.value)}
                            step={0.01}
                          />
                        </div>
                        <p className="mt-2 text-[9px] text-zinc-600 italic">
                          * Kesim çarpanı sistem tarafından %80 (0.80) olarak sabit alınır.
                        </p>
                      </div>

                      <div className="border-t border-white/5 my-4"></div>

                      {/* Grup 4: Diğer Giderler */}
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                          <Package size={12} />
                          Diğer Giderler
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="İşçilik (₺/Parça)"
                            value={formData.pricing?.processing_cost_per_item || ''}
                            onChange={(e: any) => handlePricingChange('processing_cost_per_item', e.target.value)}
                            step={0.1}
                          />
                          <Input
                            label="Nakliye (₺/Blok)"
                            value={formData.pricing?.shipping_cost_per_block || ''}
                            onChange={(e: any) => handlePricingChange('shipping_cost_per_block', e.target.value)}
                            step={1}
                          />
                          <div className="col-span-2">
                            <Input
                              label="KDV Çarpanı (1.20)"
                              value={formData.pricing?.vat_multiplier || ''}
                              onChange={(e: any) => handlePricingChange('vat_multiplier', e.target.value)}
                              step={0.01}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-lg">
                        <p className="text-[10px] text-indigo-400/80 leading-relaxed space-y-1">
                          <div>💡 <strong>Fiyat Çarpanı ($2.35)</strong> ve <strong>Kar Çarpanı (3.00)</strong> Excel tablosuyla tam uyumludur.</div>
                          <div>💡 <strong>Risk Çarpanı</strong> varsayılan olarak kapalıdır (1.0). İsteğe bağlı artırılabilir.</div>
                          <div>💡 <strong>DNS (Dansite)</strong> seçimi ana ekrandaki "Ürün Özellikleri" bölümünden yapılır ve fiyatı direkt etkiler.</div>
                        </p>
                      </div>

                      {/* Canlı Fiyat Önizleme Tablosu */}
                      <div className="mt-6 border-t border-white/5 pt-4">
                        <h4 className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                          <Activity size={12} />
                          Canlı Fiyat Önizleme (Referans)
                        </h4>
                        <div className="overflow-x-auto rounded-lg border border-white/5">
                          <table className="w-full text-[9px] text-left">
                            <thead className="bg-zinc-900/50 text-zinc-400 font-medium">
                              <tr>
                                <th className="px-2 py-2">DNS</th>
                                <th className="px-2 py-2">Ham</th>
                                <th className="px-2 py-2">Karlı</th>
                                <th className="px-2 py-2">Karlı+Nak.</th>
                                <th className="px-2 py-2 text-right">KDV Hariç</th>
                                <th className="px-2 py-2 text-right">KDV Dahil</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {[10, 12, 14, 16, 18, 20, 22, 24, 26, 30].map(dns => {
                                // Excel Logic Sync
                                const safeNum = (val: any, fallback = 0) => {
                                  if (!val) return fallback;
                                  if (typeof val === 'string') return parseFloat(val.replace(',', '.')) || fallback;
                                  return val;
                                };

                                const vol = safeNum(formData.pricing?.block_volume_m3, 2.55);
                                const base = safeNum(formData.pricing?.base_price_usd_per_m3, 2.35);
                                const rate = safeNum(formData.pricing?.usd_rate, 32) + safeNum(formData.pricing?.usd_spread_tl, 0);
                                const risk = safeNum(formData.pricing?.exchange_risk_percent, 1.0);
                                const profit = safeNum(formData.pricing?.profit_multiplier, 3.0);
                                const vat = safeNum(formData.pricing?.vat_multiplier, 1.2);
                                const ship = safeNum(formData.pricing?.shipping_cost_per_block, 400);

                                // Multiplier Logic from Excel Sub-tables
                                let op_multiplier = 0.80; // Kes-Ver %80
                                if (formData.operation_type === 'cut_slice') op_multiplier = safeNum(formData.pricing?.op_cost_slice_multiplier, 0.85);
                                if (formData.operation_type === 'cut_paste') op_multiplier = safeNum(formData.pricing?.op_cost_paste_multiplier, 1.00);

                                const ham = dns * vol * base * rate * risk;
                                const karli = ham * profit;
                                const karli_nak = karli + ship;
                                const satis_ex_vat = karli_nak * op_multiplier;
                                const satis_inc_vat = satis_ex_vat * vat;

                                return (
                                  <tr key={dns} className="hover:bg-white/5 transition-colors">
                                    <td className="px-2 py-1.5 font-medium text-indigo-400">{dns} DNS</td>
                                    <td className="px-2 py-1.5 text-zinc-500">{ham.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</td>
                                    <td className="px-2 py-1.5 text-zinc-500">{karli.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</td>
                                    <td className="px-2 py-1.5 text-zinc-400 font-medium">{karli_nak.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</td>
                                    <td className="px-2 py-1.5 text-right text-zinc-300 font-semibold">{satis_ex_vat.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</td>
                                    <td className="px-2 py-1.5 text-right text-emerald-400 font-bold">{satis_inc_vat.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="mt-2 text-[10px] text-zinc-600 text-center">
                          * Bu tablo sadece referans amaçlıdır. Nihai fiyat işlem tipine göre değişebilir.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeTab === 'parameters' && (
                    <div className="space-y-6">

                      {/* Makine & Blok */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Makine & Blok Özellikleri</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <Input
                            label="Blok En (X)"
                            value={formData.manufacturing?.block_x || ''}
                            onChange={(e: any) => handleManufacturingChange('block_x', e.target.value)}
                          />
                          <Input
                            label="Blok Boy (Y)"
                            value={formData.manufacturing?.block_y || ''}
                            onChange={(e: any) => handleManufacturingChange('block_y', e.target.value)}
                          />
                          <Input
                            label="Blok Yük. (Z)"
                            value={formData.manufacturing?.block_z || ''}
                            onChange={(e: any) => handleManufacturingChange('block_z', e.target.value)}
                          />
                          <Input
                            label="Z Eks. Tolerans"
                            value={formData.manufacturing?.tolerance_axis_202 || ''}
                            onChange={(e: any) => handleManufacturingChange('tolerance_axis_202', e.target.value)}
                            step={0.1}
                          />
                          <Input
                            label="Rulman Limit (44cm)"
                            value={formData.manufacturing?.bearing_limit_44 || ''}
                            onChange={(e: any) => handleManufacturingChange('bearing_limit_44', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="border-t border-white/5"></div>

                      {/* Kesim Payları */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Kesim Payları & Toleranslar</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="XY Tel Kesim Payı (cm)"
                            value={formData.manufacturing?.cut_allowance_xy || ''}
                            onChange={(e: any) => handleManufacturingChange('cut_allowance_xy', e.target.value)}
                            step={0.05}
                          />
                          <Input
                            label="Z Dilimleme Payı (cm)"
                            value={formData.manufacturing?.cut_allowance_z || ''}
                            onChange={(e: any) => handleManufacturingChange('cut_allowance_z', e.target.value)}
                            step={0.05}
                          />
                        </div>
                      </div>

                      <div className="border-t border-white/5"></div>

                      {/* Optimizasyon */}
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">Optimizasyon Motoru</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Vars. Sipariş Adedi"
                            value={formData.manufacturing?.default_order_qty || ''}
                            onChange={(e: any) => handleManufacturingChange('default_order_qty', e.target.value)}
                          />
                          <Input
                            label="Puanlama: Adet Katsayısı"
                            value={formData.manufacturing?.scoring_weight_qty || ''}
                            onChange={(e: any) => handleManufacturingChange('scoring_weight_qty', e.target.value)}
                          />
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">
                          * Puanlama katsayısı yerleşim algoritmasının "Sıra Azlığı" ile "Ürün Çokluğu" arasındaki tercihini belirler. Yüksek değer (1000) ürün adedini önceliklendirir.
                        </p>
                      </div>

                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 bg-zinc-900/50">
                  <div className="flex gap-2">
                    <button
                      onClick={resetToSystemDefaults}
                      className="px-3 py-2 text-[10px] uppercase tracking-wider font-bold text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all border border-red-500/10 hover:border-red-500/30"
                    >
                      Fabrika Ayarlarına Dön
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={saveAsDefault}
                      className="px-4 py-2 text-[10px] uppercase tracking-wider font-bold text-zinc-400 hover:text-zinc-200 hover:bg-white/5 rounded-lg transition-all border border-white/5 hover:border-white/10"
                    >
                      Varsayılan Olarak Kaydet
                    </button>
                    <button
                      onClick={() => setSettingsOpen(false)}
                      className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all text-sm font-medium"
                    >
                      Kapat
                    </button>
                    <button
                      onClick={() => {
                        showToast('Değişiklikler başarıyla uygulandı.')
                      }}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 transition-all text-sm font-bold flex items-center gap-2"
                    >
                      <Activity size={16} />
                      Değişiklikleri Uygula
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Custom Dialogs */}
      <AnimatePresence mode="wait">
        {toast.show && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm border border-indigo-400/50"
          >
            <Activity size={18} className="animate-pulse" />
            {toast.message}
          </motion.div>
        )}

        {confirm && confirm.show && (
          <React.Fragment key="confirm">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] pointer-events-auto"
              onClick={() => setConfirm(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-[120] pointer-events-none"
            >
              <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl pointer-events-auto">
                <h3 className="text-xl font-bold text-white mb-2">{confirm.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-8">{confirm.message}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirm(null)}
                    className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl transition-all font-bold text-sm"
                  >
                    İptal
                  </button>
                  <button
                    onClick={() => {
                      confirm.onConfirm();
                      setConfirm(null);
                    }}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all font-bold text-sm shadow-lg shadow-indigo-500/20"
                  >
                    Evet, Onayla
                  </button>
                </div>
              </div>
            </motion.div>
          </React.Fragment>
        )}
      </AnimatePresence>
    </div>
  )
}

// UI Components
const Input = ({ label, className, ...props }: any) => (
  <div className="flex flex-col gap-2 w-full">
    {label && <label className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">{label}</label>}
    <input
      className={cn("bg-zinc-950/50 border border-white/10 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-white placeholder-zinc-700 hover:border-white/20", className)}
      {...props}
    />
  </div>
)

const Section = ({ title, icon, children }: any) => (
  <div className="space-y-4">
    <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-widest">
      {icon} {title}
    </div>
    {children}
  </div>
)

const KPICard = ({ title, value, sub, icon, gradient, delay }: any) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }}
    className="bg-zinc-900/60 border border-white/10 rounded-2xl p-6 relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300"
  >
    <div className={cn("absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full opacity-10 -mr-10 -mt-10 bg-gradient-to-br", gradient)}></div>
    <div className="flex justify-between items-start relative z-10">
      <div>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">{title}</p>
        <h4 className="text-3xl font-bold text-white mt-2 tracking-tight">{value} <span className="text-sm font-normal text-zinc-600 block">{sub}</span></h4>
      </div>
      <div className="p-3 bg-white/5 rounded-xl text-zinc-400 group-hover:text-white transition-colors border border-white/5 group-hover:border-white/10">
        {icon}
      </div>
    </div>
  </motion.div>
)

const Row = ({ label, per, total, isBox }: any) => (
  <tr className="group hover:bg-white/5 transition-colors">
    <td className={cn("py-3 pl-2 font-medium flex items-center gap-2", isBox ? "text-white" : "text-zinc-400")}>
      {isBox && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow shadow-indigo-500/50"></div>}
      {label}
    </td>
    <td className="text-right font-mono text-zinc-300">{per}</td>
    <td className="text-right font-mono text-white/50">{total}</td>
  </tr>
)

const DetailRow = ({ label, value, mono }: any) => (
  <div className="flex justify-between items-center py-1">
    <span className="text-zinc-500">{label}</span>
    <span className={cn("text-zinc-300", mono && "font-mono")}>{value}</span>
  </div>
)

const Badge = ({ label, val }: any) => (
  <div className="bg-zinc-800/50 rounded-lg px-3 py-1.5 text-xs border border-white/5 flex items-center gap-2 hover:bg-zinc-800 transition-colors">
    <span className="text-zinc-500">{label}</span>
    <span className="text-indigo-400 font-mono font-bold bg-indigo-500/10 px-1.5 rounded">{val}</span>
  </div>
)

export default App
