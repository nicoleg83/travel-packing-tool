import { useState } from 'react'
import './OutfitSlot.css'
import { API_URL } from '../api.js'

const TYPE_CLASS = {
  'Formal':             'pill-formal',
  'Business Casual':    'pill-business',
  'Business':           'pill-business',
  'Casual':             'pill-casual',
  'Transit':            'pill-transit',
  'Activewear':         'pill-active',
  'Conservative Formal':'pill-formal',
}

export default function OutfitSlot({ outfit, dayIndex, originalRequest, currentPlan, onRegenerate }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegenerate() {
    setLoading(true)
    setError('')
    try {
      const instruction = `Please suggest a different outfit for the ${outfit.time} slot of Day ${dayIndex + 1}`
      const res = await fetch(`${API_URL}/api/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalRequest,
          editInstruction: instruction,
          currentPlan,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Regeneration failed')
      onRegenerate(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const pillClass = TYPE_CLASS[outfit.type] || 'pill-transit'

  return (
    <div className={`outfit-slot ${loading ? 'slot-loading' : ''}`}>
      <div className="slot-header">
        <span className="slot-time">{outfit.time}</span>
        <span className={`outfit-pill ${pillClass}`}>{outfit.type}</span>
      </div>

      {loading ? (
        <div className="slot-skeleton">
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" style={{ width: '80%' }} />
          <div className="skeleton skeleton-line" style={{ width: '60%' }} />
        </div>
      ) : (
        <ul className="outfit-items">
          {outfit.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}

      {error && <p className="slot-error">{error}</p>}

      <button
        className="slot-regen"
        onClick={handleRegenerate}
        disabled={loading}
        title="Regenerate this outfit"
      >
        ↻ {loading ? 'Regenerating…' : 'Try another'}
      </button>
    </div>
  )
}
