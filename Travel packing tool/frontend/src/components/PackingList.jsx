import { useState, useEffect } from 'react'
import {
  Briefcase, CheckCircle, AlertCircle, Package,
  ListChecks, Shirt, Layers, Footprints, Gem, Plane,
  Copy, Check,
} from 'lucide-react'
import './PackingList.css'

function getCategoryIcon(cat) {
  const c = (cat || '').toLowerCase()
  if (c.includes('suit') || c.includes('jacket') || c.includes('top') || c.includes('shirt') || c.includes('blouse')) return Shirt
  if (c.includes('bottom') || c.includes('pant') || c.includes('jean') || c.includes('skirt') || c.includes('trouser')) return Layers
  if (c.includes('shoe') || c.includes('heel') || c.includes('sneaker') || c.includes('loafer') || c.includes('boot') || c.includes('footwear')) return Footprints
  if (c.includes('access') || c.includes('jewelry') || c.includes('bag') || c.includes('belt') || c.includes('scarf')) return Gem
  if (c.includes('travel') || c.includes('transit')) return Plane
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
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

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

  async function copyList() {
    if (!packingList || packingList.length === 0) return
    const dest = originalRequest?.destinations?.map(d => d.city).join(', ') || ''
    const lines = [`Packing List${dest ? ' — ' + dest : ''}`, '─'.repeat(36)]
    for (const cat of packingList) {
      lines.push('', cat.category.toUpperCase())
      for (const item of cat.items) {
        lines.push(`- ${item.qty} × ${item.name}`)
      }
    }
    lines.push('', '─'.repeat(36))
    lines.push(`${totalItems} items · ${isCheckedBag ? 'Checked bag' : carryOnFeasible ? 'Fits carry-on' : 'Check bag'}`)
    const text = lines.join('\n')
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Packing List', text })
      } else {
        await navigator.clipboard.writeText(text)
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 2000)
    }
  }

  const days = currentPlan?.days || []
  const totalOutfits = days.reduce((sum, d) => sum + (d.outfits?.length || 0), 0)
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="panel">

      {/* ── Trip summary strip ─────────────────────────────────────────── */}
      {!hideSummary && (
        <div className="summary-strip">
          <Briefcase size={11} className="summary-strip-icon" />
          <span className="summary-stat"><span className="ss-val">{totalItems}</span> items</span>
          <span className="summary-sep">·</span>
          <span className="summary-stat"><span className="ss-val">{totalOutfits}</span> outfits</span>
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
        </div>
      )}

      {/* ── Packing list ───────────────────────────────────────────────── */}
      <div className={`packing-scroll${multiColumn ? ' packing-scroll--multi' : ''}`}>
        <div className="packing-header">
          <div className="packing-title-row">
            <ListChecks size={13} />
            <span className="packing-title">Packing List</span>
          </div>
          <div className="packing-header-right">
            {checkedCount > 0 && (
              <span className="packed-count">{checkedCount}/{totalItems} packed</span>
            )}
            <button
              className={`copy-btn${(!packingList || packingList.length === 0) ? ' copy-btn--disabled' : ''}`}
              onClick={copyList}
              disabled={!packingList || packingList.length === 0}
              title="Copy packing list"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copyFailed ? 'Copy failed' : copied ? '✓ Copied' : 'Copy list'}
            </button>
          </div>
        </div>

        {packingList.map(category => {
          const CatIcon = getCategoryIcon(category.category)
          return (
            <div key={category.category}>
              <div className="cat-label">
                <CatIcon size={11} />
                {category.category}
              </div>
              {(category.items || []).map(item => {
                const key = `${category.category}-${item.name}`
                return (
                  <label
                    key={key}
                    className={`pack-item ${checked[key] ? 'pack-checked' : ''}`}
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
