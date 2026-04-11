import { useState, useEffect } from 'react'
import {
  CheckCircle, AlertCircle, Package,
  ListChecks, Shirt, Layers, Footprints, Gem, Plane,
  Droplets, Zap, Sparkles, ShieldCheck, Heart,
} from 'lucide-react'
import './PackingList.css'

const PILL_CLASS = {
  'Formal': 'opl-pill-formal', 'Conservative Formal': 'opl-pill-formal',
  'Semi-Formal': 'opl-pill-formal', 'Cocktail': 'opl-pill-formal', 'Black Tie': 'opl-pill-formal',
  'Business': 'opl-pill-business', 'Business Casual': 'opl-pill-business',
  'Smart Casual': 'opl-pill-smart', 'Resort Casual': 'opl-pill-smart', 'Smart': 'opl-pill-smart',
  'Casual': 'opl-pill-casual', 'Beach Casual': 'opl-pill-casual', 'Daytime': 'opl-pill-casual',
  'Transit': 'opl-pill-transit', 'Travel': 'opl-pill-transit',
  'Activewear': 'opl-pill-active', 'Athletic': 'opl-pill-active', 'Workout': 'opl-pill-active',
}
function outfitPillClass(type) {
  if (!type) return 'opl-pill-transit'
  if (PILL_CLASS[type]) return PILL_CLASS[type]
  const t = type.toLowerCase()
  if (t.includes('formal') || t.includes('cocktail')) return 'opl-pill-formal'
  if (t.includes('business')) return 'opl-pill-business'
  if (t.includes('smart') || t.includes('resort')) return 'opl-pill-smart'
  if (t.includes('casual') || t.includes('beach')) return 'opl-pill-casual'
  if (t.includes('transit') || t.includes('travel')) return 'opl-pill-transit'
  if (t.includes('active') || t.includes('workout')) return 'opl-pill-active'
  return 'opl-pill-casual'
}
const isTravelDayCat = cat => /travel.?day|transit/i.test(cat)
const isExtrasCat = cat => /toiletri|electron|tech|makeup|beauty|cosmetic|essential|document|undergar|underwear|lingerie/i.test(cat)

function getCategoryIcon(cat) {
  const c = (cat || '').toLowerCase()
  if (c.includes('travel') || c.includes('transit')) return Plane
  if (c.includes('toiletri') || c.includes('skincare') || c.includes('hygiene')) return Droplets
  if (c.includes('electron') || c.includes('tech') || c.includes('gadget') || c.includes('charger')) return Zap
  if (c.includes('makeup') || c.includes('beauty') || c.includes('cosmetic')) return Sparkles
  if (c.includes('essential') || c.includes('document') || c.includes('passport') || c.includes('health')) return ShieldCheck
  if (c.includes('undergar') || c.includes('underwear') || c.includes('lingerie') || c.includes('intimat')) return Heart
  if (c.includes('suit') || c.includes('jacket') || c.includes('top') || c.includes('shirt') || c.includes('blouse')) return Shirt
  if (c.includes('bottom') || c.includes('pant') || c.includes('jean') || c.includes('skirt') || c.includes('trouser')) return Layers
  if (c.includes('shoe') || c.includes('heel') || c.includes('sneaker') || c.includes('loafer') || c.includes('boot') || c.includes('footwear')) return Footprints
  if (c.includes('access') || c.includes('jewelry') || c.includes('bag') || c.includes('belt') || c.includes('scarf')) return Gem
  return Shirt
}

const CHECKED_KEY = 'packwise-checked'

export default function PackingList({
  packingList,
  totalItems,
  carryOnFeasible,
  carryOnLimit,
  originalRequest,
  currentPlan,
  hideSummary = false,
  multiColumn = false,
  hideOutfitSummary = false,
}) {
  const planSig = (() => {
    const names = []
    for (const cat of (packingList || [])) {
      for (const item of (cat.items || [])) {
        names.push(item.name)
        if (names.length >= 3) break
      }
      if (names.length >= 3) break
    }
    return `${totalItems}-${names.join('|')}`
  })()

  const [checked, setChecked] = useState({})

  const isCheckedBag = originalRequest?.bagType === 'Checked bag'

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHECKED_KEY)
      if (saved) {
        const { sig, data } = JSON.parse(saved)
        setChecked(sig === planSig ? data : {})
      } else {
        setChecked({})
      }
    } catch {
      setChecked({})
    }
  }, [planSig])

  function toggleCheck(key) {
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        localStorage.setItem(CHECKED_KEY, JSON.stringify({ sig: planSig, data: next }))
      } catch {}
      return next
    })
  }

  const days = currentPlan?.days || []
  const totalOutfits = days.reduce((sum, d) => sum + (d.outfits?.length || 0), 0)
  const checkedCount = Object.values(checked).filter(Boolean).length

  // Travel Day floats to top; extras sink to bottom
  const sortedList = [...(packingList || [])].sort((a, b) => {
    const rank = cat => isTravelDayCat(cat) ? 0 : isExtrasCat(cat) ? 2 : 1
    return rank(a.category) - rank(b.category)
  })

  return (
    <div className="panel">

      {/* ── Packing list ───────────────────────────────────────────────── */}
      <div className={`packing-scroll${multiColumn ? ' packing-scroll--multi' : ''}`}>
        <div className="packing-header">
          <span className="packing-col-label">
            <ListChecks size={11} />
            Packing List
          </span>
          {!hideSummary && (
            <div className="packing-header-meta">
              <span className="summary-stat"><span className="ss-val">{totalItems}</span> items</span>
              <span className="summary-sep">·</span>
              <span className="summary-stat"><span className="ss-val">{days.length}</span> days</span>
              <span className="summary-sep">·</span>
              {isCheckedBag ? (
                <span className="summary-bag-status">
                  <Package size={10} /> Checked bag · {totalItems}/{carryOnLimit}
                </span>
              ) : (
                <span className={`summary-bag-status${carryOnFeasible ? '' : ' summary-bag-status--over'}`}>
                  {carryOnFeasible
                    ? <><CheckCircle size={10} /> Fits carry-on · {totalItems}/{carryOnLimit}</>
                    : <><AlertCircle size={10} /> Over limit · {totalItems}/{carryOnLimit}</>
                  }
                </span>
              )}
              {checkedCount > 0 && (
                <>
                  <span className="summary-sep">·</span>
                  <span className="packed-count">{checkedCount}/{totalItems} packed</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Outfit summary by day (only when not in split layout) ──── */}
        {!hideOutfitSummary && days.length > 0 && (
          <div className="outfit-summary-section">
            <div className="outfit-summary-title">Outfit Plan</div>
            {days.map((day, i) => {
              const outfits = (day.outfits || []).filter(o => !/activewear|workout/i.test(o.type || ''))
              if (!outfits.length) return null
              let dow = '', dateLabel = day.label || `Day ${i + 1}`
              if (day.date) {
                const d = new Date(day.date + 'T12:00:00')
                dow = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
                dateLabel = `${dow} ${d.getDate()}`
              }
              return (
                <div key={day.date || i} className="outfit-day-row">
                  <span className="outfit-day-label">{dateLabel}</span>
                  <div className="outfit-day-outfits">
                    {outfits.map((o, j) => (
                      <div key={j} className="outfit-day-entry">
                        <span className={`opl-pill ${outfitPillClass(o.type)}`}>{o.type}</span>
                        <span className="outfit-day-items">{(o.items || []).slice(0, 3).join(', ')}{o.items?.length > 3 ? '…' : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {sortedList.map(category => {
          const CatIcon = getCategoryIcon(category.category)
          const isTravel = isTravelDayCat(category.category)
          return (
            <div key={category.category}>
              <div className={`cat-label${isTravel ? ' cat-label--travel' : ''}`}>
                <CatIcon size={11} />
                {category.category.replace(/\s*\(worn,?\s*not\s*packed\)/i, '')}
                {isTravel && <span className="travel-worn-tag">worn, not packed</span>}
              </div>
              {(category.items || []).map(item => {
                const key = `${category.category}-${item.name}`
                return (
                  <label
                    key={key}
                    className={`pack-item${checked[key] ? ' pack-checked' : ''}${isTravel ? ' pack-item--travel' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={!!checked[key]}
                      onChange={() => toggleCheck(key)}
                    />
                    <span className="iname">{item.name}</span>
                    <span className="iqty">×{item.qty}</span>
                  </label>
                )
              })}
            </div>
          )
        })}
      </div>

    </div>
  )
}
