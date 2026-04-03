import { useState, useRef } from 'react'
import { Sparkles, ArrowUp, CheckCircle2, Paperclip, X } from 'lucide-react'
import { API_URL } from '../api.js'
import './ChatPanel.css'

function buildSuggestions(currentPlan, tripContext) {
  const suggestions = []
  const days = currentPlan?.days || []
  const weatherArr = currentPlan?.weather || []
  const destinations = tripContext?.destinations || []
  const tripType = tripContext?.tripType || 'Leisure'
  const totalItems = currentPlan?.totalItems || 0
  const limit = currentPlan?.carryOnLimit || 20

  // Weather-based — check daily forecast data if available
  let rainDays = 0, hotDays = 0, coldDays = 0
  weatherArr.forEach(w => {
    if (w.dailyData?.length) {
      w.dailyData.forEach(d => {
        if ((d.precipProb ?? 0) >= 50) rainDays++
        if (d.high >= 85) hotDays++
        if (d.high <= 50) coldDays++
      })
    } else if (w.weather) {
      if (/rain|drizzle|shower/i.test(w.weather)) rainDays += 2
      if (/snow|freeze|frigid/i.test(w.weather)) coldDays += 2
      const m = w.weather.match(/(\d+)°F/)
      if (m && parseInt(m[1]) >= 85) hotDays += 2
    }
  })
  if (rainDays >= 2) suggestions.push('Add a packable rain jacket')
  else if (coldDays >= 2) suggestions.push('More layers for cold days')
  else if (hotDays >= 2) suggestions.push('Lighter fabrics for the heat')

  // Activity-based — scan day event labels
  const allEvents = days.map(d => d.events || '').join(' ')
  const cityNames = destinations.map(d => d.city).join(' ')
  const combined = (allEvents + ' ' + cityNames + ' ' + (tripContext?.itinerary || '')).toLowerCase()

  const hasBeach = /beach|snorkel|swim|ocean|pool|surf/i.test(combined)
  const hasFormal = /dinner|gala|wedding|cocktail|reception|formal/i.test(combined)
  const hasHike = /hike|hiking|trail|trek/i.test(combined)
  const hasBusiness = /meeting|interview|conference|presentation|offsite/i.test(combined)
  const hasDayTrips = destinations.some(d => d.stopType === 'Day trip')

  if (hasFormal && suggestions.length < 4) {
    const formalDay = days.find(d => /dinner|gala|cocktail|formal|reception/i.test(d.events || ''))
    const label = formalDay?.label?.split(',')[0] || 'the evening'
    suggestions.push(`Dress up more for ${label}`)
  }
  if (hasBeach && suggestions.length < 4) suggestions.push('Add more swimwear options')
  if (hasHike && suggestions.length < 4) suggestions.push('Gear up more for the hike')
  if (hasBusiness && !hasFormal && suggestions.length < 4) suggestions.push('Add a backup formal look')

  // Day trip-specific
  if (hasDayTrips && suggestions.length < 4) {
    const dt = destinations.find(d => d.stopType === 'Day trip')
    const name = dt?.city?.split(',')[0] || 'day trip'
    suggestions.push(`Casual look for ${name}`)
  }

  // Packing volume
  if (totalItems > limit && suggestions.length < 4) {
    suggestions.push(`Trim ${totalItems - limit} items to fit carry-on`)
  } else if (totalItems < Math.round(limit * 0.65) && suggestions.length < 4) {
    suggestions.push('Add more outfit variety')
  }

  // Trip type fallbacks
  if (suggestions.length < 3) {
    if (tripType === 'Business' || tripType === 'Conference') suggestions.push('Swap one formal for smart casual')
    else if (tripType === 'Beach') suggestions.push('More casual beach looks')
    else if (tripType === 'Adventure') suggestions.push('More weather-adaptable layers')
    else if (tripType === 'Wedding') suggestions.push('Add a backup ceremony outfit')
    else suggestions.push('Switch to a more casual overall vibe')
  }
  if (suggestions.length < 3) suggestions.push('Minimize to 3 outfit bases')
  if (suggestions.length < 3) suggestions.push('Add a versatile layer')

  return suggestions.slice(0, 4)
}

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.gif,.webp'

export default function ChatPanel({ originalRequest, currentPlan, onRegenerate }) {
  const [chatInput, setChatInput] = useState('')
  const [chatLog, setChatLog] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attachedFile, setAttachedFile] = useState(null)
  const [attachLoading, setAttachLoading] = useState(false)
  const fileInputRef = useRef(null)

  const suggestions = buildSuggestions(currentPlan, originalRequest)

  async function handleFileAttach(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setAttachLoading(true)
    setError('')
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch(`${API_URL}/api/extract-file`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, mimetype: file.type, content: base64 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'File extraction failed')
      setAttachedFile({ name: file.name, extractedText: data.text })
    } catch (err) {
      setError(err.message)
    } finally {
      setAttachLoading(false)
    }
  }

  async function sendEdit(instruction) {
    if ((!instruction.trim() && !attachedFile) || loading) return
    setLoading(true)
    setError('')
    const fullInstruction = attachedFile
      ? `Itinerary from attached file (${attachedFile.name}):\n${attachedFile.extractedText}${instruction.trim() ? '\n\n' + instruction : '\n\nPlease update my packing plan based on this itinerary.'}`
      : instruction
    try {
      const res = await fetch(`${API_URL}/api/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalRequest, editInstruction: fullInstruction, currentPlan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      const logText = attachedFile
        ? `📎 ${attachedFile.name}${instruction.trim() ? ' — ' + instruction : ''}`
        : instruction
      setChatInput('')
      setAttachedFile(null)
      setChatLog(prev => [...prev, { text: logText, ts: Date.now() }])
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

  return (
    <div className="chat-panel-wrap">
      {/* Header */}
      <div className="chat-panel-header">
        <Sparkles size={13} className="chat-panel-icon" />
        <span className="chat-panel-title">Ask Packwise</span>
        <span className="chat-panel-hint">edit in plain English</span>
      </div>

      {/* Scrollable body */}
      <div className="chat-panel-body">
        {/* Suggestion cards */}
        {suggestions.length > 0 && (
          <div className="chat-suggestions">
            {suggestions.map(s => (
              <button
                key={s}
                className="chat-suggestion-card"
                onClick={() => sendEdit(s)}
                disabled={loading}
              >
                <span className="suggestion-plus">+</span>
                <span className="suggestion-text">{s}</span>
              </button>
            ))}
          </div>
        )}

        {/* Sent message history */}
        {chatLog.length > 0 && (
          <div className="chat-history-list">
            {chatLog.map((entry, i) => (
              <div key={i} className="chat-sent-row">
                <CheckCircle2 size={12} className="chat-sent-check" />
                <div className="chat-sent-bubble">{entry.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Attached file strip */}
      {attachedFile && (
        <div className="chat-attach-strip">
          <Paperclip size={10} className="chat-attach-strip-icon" />
          <span className="chat-attach-strip-name">{attachedFile.name}</span>
          <button className="chat-attach-strip-remove" onClick={() => setAttachedFile(null)}>
            <X size={9} />
          </button>
        </div>
      )}

      {error && <p className="chat-error-text">{error}</p>}

      {/* Input area */}
      <div className="chat-input-area">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          onChange={handleFileAttach}
          style={{ display: 'none' }}
        />
        <button
          className="chat-attach-icon-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || attachLoading}
          title="Attach itinerary"
        >
          {attachLoading
            ? <span className="chat-loading-dots"><span /><span /><span /></span>
            : <Paperclip size={12} />
          }
        </button>
        <input
          className="chat-text-input"
          type="text"
          value={chatInput}
          onChange={e => { setChatInput(e.target.value); setError('') }}
          onKeyDown={handleKeyDown}
          placeholder={attachedFile ? 'Add a note or just send…' : 'Ask Packwise to edit…'}
          disabled={loading}
        />
        <button
          className="chat-send-btn"
          onClick={() => sendEdit(chatInput)}
          disabled={loading || (!chatInput.trim() && !attachedFile)}
        >
          {loading
            ? <span className="chat-loading-dots" style={{ color: '#fff' }}><span /><span /><span /></span>
            : <ArrowUp size={14} className="chat-send-icon" />
          }
        </button>
      </div>
    </div>
  )
}
