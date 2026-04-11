import { useState, useRef, useEffect } from 'react'
import { MapPin, Plus, ChevronDown, PenLine, ArrowLeft, ArrowRight, Printer, Shirt, Package, Cloud } from 'lucide-react'
import LandingPage from './components/LandingPage'
import SplitView from './components/SplitView'
import WeatherView from './components/WeatherView'
import ErrorBoundary from './components/ErrorBoundary'
import { API_URL } from './api.js'
import './App.css'

const TRIP_TYPE_OPTIONS = ['Business', 'Casual', 'Leisure', 'Beach', 'Adventure', 'Wedding', 'Conference']
const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary']
const BAG_OPTIONS = ['Carry-on', 'Checked bag']
const STORAGE_KEY = 'packwise-plan'

function formatDateChip(dest) {
  if (!dest?.departureDate) return ''
  const dep = new Date(dest.departureDate + 'T12:00:00')
  const month = dep.toLocaleDateString('en-US', { month: 'short' })
  const depDay = dep.getDate()
  if (!dest.returnDate || dest.returnDate === dest.departureDate) return `${month} ${depDay}`
  const ret = new Date(dest.returnDate + 'T12:00:00')
  const retMonth = ret.toLocaleDateString('en-US', { month: 'short' })
  if (month === retMonth) return `${month} ${depDay}–${ret.getDate()}`
  return `${month} ${depDay} – ${retMonth} ${ret.getDate()}`
}

// Dropdown chip — for predefined option lists (tripType, gender)
function ChipDropdown({ options, currentValue, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="chip-dropdown-wrap" ref={ref}>
      <button className="chip chip-btn" onClick={() => setOpen(o => !o)}>
        {currentValue}
        <ChevronDown size={9} className="chip-chevron" />
      </button>
      {open && (
        <div className="chip-dropdown">
          {options.map(opt => (
            <button
              key={opt}
              className={`chip-option ${opt === currentValue ? 'chip-option--active' : ''}`}
              onClick={() => { onSelect(opt); setOpen(false) }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Inline-edit chip — for free-text values (city name)
function EditableTextChip({ value, icon, onEdit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) { inputRef.current?.focus(); inputRef.current?.select() }
  }, [editing])

  function commit() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onEdit(trimmed)
    else setDraft(value)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="chip chip-inline-input"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setEditing(false); setDraft(value) }
        }}
        size={Math.max(draft.length, 4)}
      />
    )
  }

  return (
    <button className="chip chip-btn" onClick={() => setEditing(true)}>
      {icon}
      {value}
      <PenLine size={9} className="chip-edit-icon" />
    </button>
  )
}

// Date picker chip — shows a small dropdown with dep/ret date inputs
function EditableDateChip({ dest, onEdit }) {
  const [open, setOpen] = useState(false)
  const [dep, setDep] = useState(dest.departureDate || '')
  const [ret, setRet] = useState(dest.returnDate || dest.departureDate || '')
  const ref = useRef(null)

  useEffect(() => {
    setDep(dest.departureDate || '')
    setRet(dest.returnDate || dest.departureDate || '')
  }, [dest.departureDate, dest.returnDate])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function apply() {
    setOpen(false)
    if (dep !== dest.departureDate || ret !== dest.returnDate) {
      onEdit({ departureDate: dep, returnDate: ret })
    }
  }

  return (
    <div className="chip-dropdown-wrap" ref={ref}>
      <button className="chip chip-btn" onClick={() => setOpen(o => !o)}>
        {formatDateChip(dest)}
        <PenLine size={9} className="chip-edit-icon" />
      </button>
      {open && (
        <div className="chip-dropdown chip-date-dropdown">
          <div className="date-field">
            <label className="date-field-label">From</label>
            <input
              type="date"
              className="date-field-input"
              value={dep}
              onChange={e => {
                const newDep = e.target.value
                setDep(newDep)
                if (ret && newDep > ret) setRet(newDep)
              }}
            />
          </div>
          <div className="date-field">
            <label className="date-field-label">To</label>
            <input
              type="date"
              className="date-field-input"
              value={ret}
              min={dep}
              onChange={e => setRet(e.target.value)}
            />
          </div>
          <button className="date-apply-btn" onClick={apply}>Apply</button>
        </div>
      )}
    </div>
  )
}

function getPendingLabel(p) {
  if (!p) return ''
  if (p.field === 'city') return `Update destination to "${p.value}"`
  if (p.field === 'dates') return `Update dates to ${formatDateChip({ departureDate: p.departureDate, returnDate: p.returnDate })}`
  if (p.field === 'tripType') return `Update trip type to "${p.value}"`
  if (p.field === 'gender') return `Update gender to "${p.value}"`
  if (p.field === 'bagType') return `Switch to ${p.value}`
  return `Update to "${p.value}"`
}

// Confirming view — shown after parse, before generate
function ConfirmingView({ parsedData, onEdit, onGenerate }) {
  const submitRef = useRef(false)
  const [gender, setGender] = useState(parsedData.gender || 'Male')
  const [bagType, setBagType] = useState(parsedData.bagType || 'Carry-on')
  const [includeWorkouts, setIncludeWorkouts] = useState(
    parsedData.itinerary ? /workout|gym|run|swim|fitness|exercise/i.test(parsedData.itinerary) : false
  )
  const [destinations, setDestinations] = useState(parsedData.destinations || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    if (submitRef.current || loading) return
    submitRef.current = true
    setLoading(true)
    setError('')
    try {
      const params = { ...parsedData, destinations, gender, bagType, includeWorkouts }
      await onGenerate(params)
    } catch (err) {
      setError(err.message || 'Something went wrong')
      submitRef.current = false
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="confirming-hero">
      <div className="confirming-title">Does this look right?</div>
      <div className="confirming-chips">
        {destinations.map((dest, i) => (
          <span key={i} className="dest-chip-group">
            {i > 0 && <span className="chip-sep">·</span>}
            <EditableTextChip
              value={dest.city}
              icon={<MapPin size={10} />}
              onEdit={v => setDestinations(ds => ds.map((d, j) => j === i ? { ...d, city: v } : d))}
            />
            {dest.departureDate && (
              <EditableDateChip
                dest={dest}
                onEdit={({ departureDate, returnDate }) =>
                  setDestinations(ds => ds.map((d, j) => j === i ? { ...d, departureDate, returnDate } : d))
                }
              />
            )}
          </span>
        ))}
        <span className="chip-sep">·</span>
        <ChipDropdown
          options={GENDER_OPTIONS}
          currentValue={gender}
          onSelect={setGender}
        />
        <span className="chip-sep">·</span>
        <ChipDropdown
          options={BAG_OPTIONS}
          currentValue={bagType}
          onSelect={setBagType}
        />
        <span className="chip-sep">·</span>
        <button
          className="chip chip-btn"
          onClick={() => setIncludeWorkouts(w => !w)}
          type="button"
        >
          Workouts: {includeWorkouts ? 'Yes' : 'No'}
        </button>
      </div>
      {error && <p className="confirming-error">{error}</p>}
      <div className="confirming-actions">
        <button className="btn-ghost" onClick={onEdit} disabled={loading}>
          <ArrowLeft size={12} />
          Edit
        </button>
        <button className="btn-filled" onClick={generate} disabled={loading}>
          {loading
            ? <span className="loading-dots"><span /><span /><span /></span>
            : <><ArrowRight size={12} />Generate</>
          }
        </button>
      </div>
    </div>
  )
}

function App() {
  const [view, setView] = useState('landing')
  const [workingView, setWorkingView] = useState('outfits')
  const [input, setInput] = useState('')
  const [parsedData, setParsedData] = useState(null)
  const [results, setResults] = useState(null)
  const [tripContext, setTripContext] = useState(null)
  const [includeWorkouts, setIncludeWorkouts] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [pendingChange, setPendingChange] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Sync includeWorkouts when tripContext changes
  useEffect(() => {
    if (tripContext?.includeWorkouts !== undefined) {
      setIncludeWorkouts(tripContext.includeWorkouts)
    }
  }, [tripContext])

  // Restore saved plan on mount (URL param takes priority over localStorage)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const planParam = params.get('plan')
      if (planParam) {
        const { results: r, tripContext: tc } = JSON.parse(decodeURIComponent(atob(planParam)))
        if (r?.days && tc?.destinations) {
          setResults(r)
          setTripContext(tc)
          setView('working')
          // Clean URL without reloading
          window.history.replaceState({}, '', window.location.pathname)
          return
        }
      }
    } catch {
      // bad URL param — fall through to localStorage
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const { results: r, tripContext: tc } = JSON.parse(saved)
        if (r?.days && tc?.destinations) {
          setResults(r)
          setTripContext(tc)
          setView('working')
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Persist whenever plan updates
  useEffect(() => {
    if (results && tripContext) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ results, tripContext }))
      } catch {}
    }
  }, [results, tripContext])

  function handleParsed(data) {
    setParsedData(data)
    setView('confirming')
  }

  async function handleGenerate(params) {
    const res = await fetch(`${API_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Generation failed')
    setResults(data)
    setTripContext(params)
    setView('working')
  }

  function handleBackToLanding() {
    setView('landing')
    setParsedData(null)
  }

  // legacy — kept for stored plan restoration
  function handleResults(data, params) {
    setResults(data)
    setTripContext(params)
    setView('working')
  }

  function handleNewPlan() {
    localStorage.removeItem(STORAGE_KEY)
    setResults(null)
    setTripContext(null)
    setPendingChange(null)
    setParsedData(null)
    setInput('')
    setView('landing')
    setWorkingView('outfits')
  }

  async function handleRegeneratePlan() {
    if (regenerating) return
    setRegenerating(true)
    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tripContext),
      })
      const data = await res.json()
      if (res.ok) setResults(data)
    } catch (err) {
      console.error('Regenerate plan failed:', err.message)
    } finally {
      setRegenerating(false)
    }
  }

  function handleChipEdit(change) {
    setPendingChange(change)
  }

  async function handleConfirmChange() {
    if (!pendingChange || confirmLoading) return
    setConfirmLoading(true)

    let newContext
    if (pendingChange.field === 'city') {
      newContext = {
        ...tripContext,
        destinations: tripContext.destinations.map((d, i) =>
          i === pendingChange.destIndex ? { ...d, city: pendingChange.value } : d
        ),
      }
    } else if (pendingChange.field === 'dates') {
      newContext = {
        ...tripContext,
        destinations: tripContext.destinations.map((d, i) =>
          i === pendingChange.destIndex
            ? { ...d, departureDate: pendingChange.departureDate, returnDate: pendingChange.returnDate }
            : d
        ),
      }
    } else {
      newContext = { ...tripContext, [pendingChange.field]: pendingChange.value }
    }

    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContext),
      })
      const data = await res.json()
      if (res.ok) {
        setTripContext(newContext)
        setResults(data)
      }
    } catch (err) {
      console.error('Chip update failed:', err.message)
    } finally {
      setConfirmLoading(false)
      setPendingChange(null)
    }
  }

  if (view === 'landing') {
    return (
      <div className="app-landing">
        <LandingPage
          input={input}
          onInputChange={setInput}
          onParsed={handleParsed}
        />
      </div>
    )
  }

  if (view === 'confirming') {
    return (
      <div className="app-landing">
        <ConfirmingView
          parsedData={parsedData}
          onEdit={handleBackToLanding}
          onGenerate={handleGenerate}
        />
      </div>
    )
  }

  const destinations = tripContext?.destinations || []

  const NAV_ITEMS = [
    { id: 'outfits',  Icon: Shirt,   label: 'Outfits' },
    { id: 'packing',  Icon: Package, label: 'Packing List' },
    { id: 'weather',  Icon: Cloud,   label: 'Weather' },
  ]

  return (
    <div className="app-working">
      <header className="masthead">
        <span className="masthead-wordmark">
          <span className="mw-pack">Pack</span><span className="mw-wise">wise</span>
        </span>

        <div className="masthead-chips">
          {destinations.map((dest, i) => (
            <span key={i} className="dest-chip-group">
              {i > 0 && <span className="chip-sep">·</span>}
              <EditableTextChip
                value={dest.city}
                icon={<MapPin size={10} />}
                onEdit={v => handleChipEdit({ field: 'city', destIndex: i, value: v })}
              />
            </span>
          ))}
          {tripContext?.gender && (
            <>
              <span className="chip-sep">·</span>
              <ChipDropdown
                options={GENDER_OPTIONS}
                currentValue={tripContext.gender}
                onSelect={v => handleChipEdit({ field: 'gender', value: v })}
              />
            </>
          )}
          {tripContext?.bagType && (
            <>
              <span className="chip-sep">·</span>
              <ChipDropdown
                options={BAG_OPTIONS}
                currentValue={tripContext.bagType}
                onSelect={v => handleChipEdit({ field: 'bagType', value: v })}
              />
            </>
          )}
          <span className="chip-sep">·</span>
          <button
            className="chip chip-btn"
            onClick={() => setIncludeWorkouts(w => !w)}
            type="button"
          >
            Workouts: {includeWorkouts ? 'Yes' : 'No'}
          </button>
        </div>

        <div className="masthead-actions">
          {workingView === 'packing' && (
            <button className="btn-ghost" onClick={() => window.print()} title="Print / Export">
              <Printer size={12} />
              Export
            </button>
          )}
          <button className="btn-filled" onClick={handleNewPlan}>
            <Plus size={12} />
            New Plan
          </button>
        </div>
      </header>

      {pendingChange && (
        <div className="confirm-banner">
          <span className="confirm-msg">
            {getPendingLabel(pendingChange)} and regenerate your plan?
          </span>
          <div className="confirm-actions">
            <button
              className="confirm-btn confirm-btn--cancel"
              onClick={() => setPendingChange(null)}
              disabled={confirmLoading}
            >
              Cancel
            </button>
            <button
              className="confirm-btn confirm-btn--ok"
              onClick={handleConfirmChange}
              disabled={confirmLoading}
            >
              {confirmLoading ? 'Generating…' : 'Regenerate'}
            </button>
          </div>
        </div>
      )}

      <div className="app-body">
        <nav className="app-sidebar-nav">
          {NAV_ITEMS.map(({ id, Icon, label }) => (
            <button
              key={id}
              className={`sidebar-nav-btn${workingView === id ? ' sidebar-nav-btn--active' : ''}`}
              onClick={() => setWorkingView(id)}
            >
              <Icon size={19} />
              <span className="sidebar-nav-label">{label}</span>
            </button>
          ))}
        </nav>

        <div className="app-content">
          <ErrorBoundary onReset={handleNewPlan}>
            {workingView === 'weather'
              ? <WeatherView weather={results.weather} />
              : <SplitView
                  data={results}
                  tripContext={tripContext}
                  workingView={workingView}
                  includeWorkouts={includeWorkouts}
                  onRegenerate={(newData) => setResults(newData)}
                />
            }
          </ErrorBoundary>
        </div>
      </div>
    </div>
  )
}

export default App
