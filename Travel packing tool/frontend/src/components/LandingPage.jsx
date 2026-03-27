import { useState, useRef } from 'react'
import { API_URL } from '../api.js'
import {
  ArrowRight, MapPin, Briefcase,
  Sun, MountainSnow, Sparkles,
} from 'lucide-react'
import './LandingPage.css'

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary']
const BAG_OPTIONS = ['Carry-on', 'Checked bag']

const EXAMPLES = [
  "Long weekend in Miami, Jun 14–16 — beach days, one nice dinner Saturday night, flight out Sunday. Humid and warm. I prefer casual but put-together.",
  "3-day business conference in Chicago, Mar 5–7. Sessions during the day, client dinner Thursday, free Friday afternoon. Early March, could be cold.",
  "10 days hiking in Patagonia, Dec 1–10 — mostly trail days, one nicer night in a lodge. Need layers, waterproof gear, nothing too heavy.",
  "Wedding weekend in Napa, Sep 19–21 — rehearsal dinner Friday, wedding Saturday, brunch Sunday. I'm a guest, dress code is 'garden party'.",
]

const EXAMPLE_CHIPS = ['Beach trip, Miami, Jun 14–16', 'Conference, Chicago, Mar 5–7', 'Patagonia hiking, Dec 1–10', 'Wedding in Napa, Sep 19–21']

const TEMPLATES = [
  { icon: Briefcase, name: 'Business Trip', desc: 'Meetings, interviews, client dinners' },
  { icon: Sun, name: 'Beach Vacation', desc: 'Warm weather, resort, casual days' },
  { icon: MapPin, name: 'City Break', desc: 'Sightseeing, dinners out, mixed weather' },
  { icon: MountainSnow, name: 'Outdoor Adventure', desc: 'Hiking, camping, active days' },
]

const TEMPLATE_PROMPTS = [
  "3-day business trip to New York next week — meetings and a client dinner. Business professional attire.",
  "5 days at a beach resort in Miami next month — beach days, one nice dinner. Warm and humid.",
  "Long weekend city break in Chicago — sightseeing, dinners out. Mixed weather, layers needed.",
  "7-day hiking trip in Colorado — mostly trail days, one lodge night. Need layers and waterproof gear.",
]

export default function LandingPage({ input, onInputChange, onParsed }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gender, setGender] = useState('Male')
  const [bagType, setBagType] = useState('Carry-on')
  const textareaRef = useRef(null)

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
      // Apply user-selected gender (override parse result) and bagType
      parseData.gender = gender
      parseData.bagType = bagType
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

  function fillExample(i) {
    onInputChange(EXAMPLES[i])
    setError('')
    textareaRef.current?.focus()
  }

  function useTemplate(i) {
    onInputChange(TEMPLATE_PROMPTS[i])
    setError('')
    textareaRef.current?.focus()
    textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="landing">

      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav className="lnav">
        <div className="lnav-wordmark">
          <span className="lnav-pack">Pack</span><span className="lnav-wise">wise</span>
        </div>
        <div className="lnav-links">
          <a href="#how" className="lnav-link">How it works</a>
          <a href="#" className="lnav-link">Examples</a>
          <a href="#" className="lnav-signin">Sign in</a>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section className="hero">
        <h1 className="hero-headline">
          Tell me about<br />your <em>trip.</em>
        </h1>

        <div className={`hero-input-card ${loading ? 'hero-input-card--loading' : ''}`}>
          <textarea
            ref={textareaRef}
            className="hero-textarea"
            value={input}
            onChange={e => { onInputChange(e.target.value); setError('') }}
            onKeyDown={handleKeyDown}
            placeholder="3 days in NYC, Apr 10–13 — Goldman Sachs first round Thursday, Wharton campus visit Friday, fly home Saturday. I run every morning. Expecting rain."
            rows={4}
            disabled={loading}
          />
          <div className="hero-input-footer">
            <div className="hero-input-left">
              {input.length > 20 && (
                <span className="hero-char-hint">{input.length} chars</span>
              )}
            </div>
            <button
              className="hero-submit"
              type="button"
              onClick={() => submit()}
              disabled={loading || !input.trim()}
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

        <div className="hero-examples">
          <span className="ex-label">Try:</span>
          {EXAMPLE_CHIPS.map((c, i) => (
            <button key={c} className="ex-chip" onClick={() => fillExample(i)} disabled={loading}>
              {c}
            </button>
          ))}
        </div>
      </section>

      {/* ── TEMPLATES ────────────────────────────────────────────────── */}
      <section className="templates-section">
        <div className="section-divider">
          <div className="section-divider-line" />
          <span className="section-divider-text">Or start from a template</span>
          <div className="section-divider-line" />
        </div>
        <div className="template-grid">
          {TEMPLATES.map(({ icon: Icon, name, desc }, i) => (
            <button key={name} className="template-card" onClick={() => useTemplate(i)} disabled={loading}>
              <div className="template-icon"><Icon size={16} /></div>
              <div className="template-name">{name}</div>
              <div className="template-desc">{desc}</div>
            </button>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section className="how-section" id="how">
        <div className="how-inner">
          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <div className="step-title">Describe your trip</div>
            </div>
            <div className="step">
              <div className="step-num">02</div>
              <div className="step-title">Get your plan</div>
            </div>
            <div className="step">
              <div className="step-num">03</div>
              <div className="step-title">Refine with chat</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ───────────────────────────────────────────────── */}
      <div className="cta-section">
        <h2 className="cta-headline">Pack smarter.<br />Travel ready.</h2>
        <button className="cta-btn" onClick={() => textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
          <Sparkles size={15} />
          Build my packing plan
        </button>
      </div>

      <footer className="landing-footer">
        <div className="footer-brand">
          <span className="lnav-pack">Pack</span><span className="lnav-wise">wise</span>
        </div>
        <span className="footer-copy">© 2025 Packwise. All rights reserved.</span>
      </footer>

    </div>
  )
}
