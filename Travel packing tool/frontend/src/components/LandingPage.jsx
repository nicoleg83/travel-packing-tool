import { useState, useRef } from 'react'
import { API_URL } from '../api.js'
import { ArrowRight, Paperclip, X } from 'lucide-react'
import './LandingPage.css'

const GENDER_OPTIONS = ['Male', 'Female', 'Other']
const BAG_OPTIONS = ['Carry-on', 'Checked bag']

const ACCEPTED_FILE_TYPES = '.pdf,.jpg,.jpeg,.png,.gif,.webp'

export default function LandingPage({ input, onInputChange, onParsed }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gender, setGender] = useState('Male')
  const [bagType, setBagType] = useState('Carry-on')
  const [attachedFile, setAttachedFile] = useState(null)
  const [attachLoading, setAttachLoading] = useState(false)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)

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

  async function submit(text) {
    const t = (text || input).trim()
    if (!t || loading) return
    setLoading(true)
    setError('')
    try {
      const parseRes = await fetch(`${API_URL}/api/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: t }),
      })
      if (!parseRes.ok) {
        const ct = parseRes.headers.get('content-type') || ''
        if (ct.includes('application/json')) {
          const err = await parseRes.json()
          throw new Error(err.error || 'Could not understand your trip description')
        }
        throw new Error(`Backend error ${parseRes.status} — is the backend running?`)
      }
      const parseData = await parseRes.json()
      parseData.gender = gender
      parseData.bagType = bagType
      // Merge attached file content as itinerary context
      if (attachedFile?.extractedText) {
        parseData.itinerary = attachedFile.extractedText +
          (parseData.itinerary ? '\n\n' + parseData.itinerary : '')
      }
      onParsed(parseData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
  }

  return (
    <div className="landing">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav className="lnav">
        <div className="lnav-wordmark">
          <span className="lnav-pack">Pack</span><span className="lnav-wise">wise</span>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-title-group">
          <h1 className="hero-brand-title">
            <span className="hb-pack">Pack</span><span className="hb-wise">wise</span>
          </h1>
          <p className="hero-subtitle">Tell me about your trip.</p>
        </div>

        <div className={`hero-input-card ${loading ? 'hero-input-card--loading' : ''}`}>
          <textarea
            ref={textareaRef}
            className="hero-textarea"
            value={input}
            onChange={e => { onInputChange(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder="3 days in NYC, Apr 10–13 — Goldman Sachs first round Thursday, Wharton campus visit Friday, fly home Saturday. I run every morning. Expecting rain."
            rows={3}
            disabled={loading}
          />

          {/* Attached file indicator */}
          {attachedFile && (
            <div className="hero-attachment">
              <Paperclip size={11} className="attach-icon" />
              <span className="attach-name">{attachedFile.name}</span>
              <button
                className="attach-remove"
                onClick={() => setAttachedFile(null)}
                title="Remove attachment"
                type="button"
              >
                <X size={10} />
              </button>
            </div>
          )}

          <div className="hero-input-footer">
            <div className="hero-input-left">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileAttach}
                style={{ display: 'none' }}
              />
              <button
                className={`upload-btn${attachLoading ? ' upload-btn--loading' : ''}`}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || attachLoading}
                title="Attach itinerary (PDF or image)"
              >
                {attachLoading
                  ? <span className="loading-dots"><span /><span /><span /></span>
                  : <><Paperclip size={12} /> Attach itinerary</>
                }
              </button>
              {input.length > 20 && (
                <span className="hero-char-hint">{input.length} chars</span>
              )}
            </div>
            <button
              className="hero-submit"
              type="button"
              onClick={() => submit()}
              disabled={loading || (!input.trim() && !attachedFile)}
            >
              {loading ? (
                <span className="loading-dots"><span /><span /><span /></span>
              ) : (
                <>Build my plan <ArrowRight size={14} /></>
              )}
            </button>
          </div>
        </div>

        {error && <p className="hero-error">{error}</p>}

        {/* ── Preferences row ──────────────────────────────────────── */}
        <div className="hero-prefs">
          <div className="pref-group">
            <span className="pref-label">Gender</span>
            <div className="pref-options">
              {GENDER_OPTIONS.map(g => (
                <button
                  key={g}
                  className={`pref-btn ${gender === g ? 'pref-btn--active' : ''}`}
                  onClick={() => setGender(g)}
                  disabled={loading}
                  type="button"
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="pref-sep" />
          <div className="pref-group">
            <span className="pref-label">Bag</span>
            <div className="pref-options">
              {BAG_OPTIONS.map(b => (
                <button
                  key={b}
                  className={`pref-btn ${bagType === b ? 'pref-btn--active' : ''}`}
                  onClick={() => setBagType(b)}
                  disabled={loading}
                  type="button"
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>

      </section>

    </div>
  )
}
