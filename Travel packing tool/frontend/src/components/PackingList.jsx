import { useState, useEffect } from 'react'
import {
  Briefcase, CheckCircle, AlertCircle,
  ListChecks, Shirt, Layers, Footprints, Gem, Plane,
  Sparkles, ArrowUp, Copy, Check,
} from 'lucide-react'
import './PackingList.css'
import { API_URL } from '../api.js'

const CHAT_SUGGESTIONS = [
  'More casual Thursday',
  'Add dinner Friday',
  'Gym Saturday',
  'Cut to 10 items',
  "It'll rain all weekend",
]

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
  onRegenerate,
}) {
  // Stable signature for this specific plan — used to scope persisted checkboxes
  // Uses totalItems + first 3 item names across first 2 categories to avoid false matches
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
  const [chatInput, setChatInput] = useState('')
  const [chatLog, setChatLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  // Restore checked state for this exact plan on mount / plan change
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
    lines.push(`${totalItems} items · ${carryOnFeasible ? 'Fits carry-on' : 'Check bag'}`)
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

  async function sendEdit(instruction) {
    if (!instruction.trim() || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalRequest, editInstruction: instruction, currentPlan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setChecked({})
      localStorage.removeItem(CHECKED_KEY)
      setChatInput('')
      setChatLog(prev => [...prev, { text: instruction, ts: Date.now() }])
      onRegenerate(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendEdit(chatInput) }
  }

  const days = currentPlan?.days || []
  const totalOutfits = days.reduce((sum, d) => sum + (d.outfits?.length || 0), 0)
  const checkedCount = Object.values(checked).filter(Boolean).length

  return (
    <div className="panel">

      {/* ── Trip summary card ──────────────────────────────────────────── */}
      <div className="trip-summary-wrap">
        <div className="trip-summary">
          <div className="summary-heading">
            <Briefcase size={11} />
            Trip Summary
          </div>
          <div className="summary-stats">
            <div className="summary-row">
              <span className="s-label">Items</span>
              <span className="s-val">{totalItems}</span>
            </div>
            <div className="summary-row">
              <span className="s-label">Outfits</span>
              <span className="s-val">{totalOutfits}</span>
            </div>
            <div className="summary-row">
              <span className="s-label">Bag</span>
              <span className="s-val">{carryOnFeasible ? 'Carry-on' : 'Check bag'}</span>
            </div>
            <div className="summary-row">
              <span className="s-label">Days</span>
              <span className="s-val">{days.length}</span>
            </div>
          </div>
          <div className={`summary-carry ${carryOnFeasible ? '' : 'summary-carry--over'}`}>
            {carryOnFeasible
              ? <><CheckCircle size={11} /> Fits carry-on</>
              : <><AlertCircle size={11} /> Over carry-on limit</>
            }
            <span className="carry-count">{totalItems} / {carryOnLimit}</span>
          </div>
        </div>
      </div>

      {/* ── Packing list ───────────────────────────────────────────────── */}
      <div className="packing-scroll">
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

      {/* ── Ask Packwise chat card ─────────────────────────────────────── */}
      <div className="panel-chat-wrap">
        <div className="panel-chat">
          <div className="panel-chat-header">
            <Sparkles size={13} className="chat-sparkles" />
            <span className="panel-chat-label">Ask Packwise</span>
            <span className="panel-chat-hint">edit anything in plain English</span>
          </div>

          {/* Chat history */}
          {chatLog.length > 0 && (
            <div className="chat-history">
              {chatLog.map((entry, i) => (
                <div key={i} className="chat-log-entry">
                  <Check size={9} className="chat-log-check" />
                  <span className="chat-log-text">{entry.text}</span>
                </div>
              ))}
            </div>
          )}

          <div className="chat-chips">
            {CHAT_SUGGESTIONS.map(s => (
              <button
                key={s}
                className="chat-chip"
                onClick={() => sendEdit(s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="chat-input-row">
            <input
              className="chat-input"
              type="text"
              value={chatInput}
              onChange={e => { setChatInput(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              placeholder="Ask Packwise to edit your plan…"
              disabled={loading}
            />
            <button
              className="chat-send"
              onClick={() => sendEdit(chatInput)}
              disabled={loading || !chatInput.trim()}
            >
              {loading ? (
                <span className="send-dots"><span /><span /><span /></span>
              ) : (
                <ArrowUp size={13} className="send-icon" />
              )}
            </button>
          </div>

          {error && <p className="chat-error">{error}</p>}
        </div>
      </div>

    </div>
  )
}
