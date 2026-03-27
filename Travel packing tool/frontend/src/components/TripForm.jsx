import { useState } from 'react'
import './TripForm.css'
import { API_URL } from '../api.js'

const EMPTY_DESTINATION = { city: '', departureDate: '', returnDate: '', stopType: 'Stay' }

const STOP_TYPES = ['Stay', 'Overnight', 'Day trip']

export default function TripForm({ onResults }) {
  const [destinations, setDestinations] = useState([{ ...EMPTY_DESTINATION }])
  const [tripType, setTripType] = useState('Recruiting')
  const [gender, setGender] = useState('Male')
  const [itinerary, setItinerary] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateDestination(index, field, value) {
    setDestinations(prev => prev.map((d, i) => {
      if (i !== index) return d
      const updated = { ...d, [field]: value }
      // Day trips: auto-mirror return date from departure
      if (field === 'stopType' && value === 'Day trip') {
        updated.returnDate = d.departureDate
      }
      if (field === 'departureDate' && d.stopType === 'Day trip') {
        updated.returnDate = value
      }
      return updated
    }))
    setError('')
  }

  function addDestination() {
    setDestinations(prev => [...prev, { ...EMPTY_DESTINATION }])
  }

  function removeDestination(index) {
    setDestinations(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Validate all destinations
    for (let i = 0; i < destinations.length; i++) {
      const d = destinations[i]
      const label = destinations.length > 1 ? `Stop ${i + 1}` : 'Destination'
      if (!d.city.trim()) return setError(`${label}: city is required.`)
      if (!d.departureDate) return setError(`${label}: departure date is required.`)
      if (d.stopType !== 'Day trip') {
        if (!d.returnDate) return setError(`${label}: return date is required.`)
        if (d.returnDate < d.departureDate) return setError(`${label}: return date must be after departure date.`)
      }
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinations, tripType, gender, itinerary }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      onResults(data, { destinations, tripType, gender, itinerary })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="trip-form" onSubmit={handleSubmit}>

      {/* Destination rows */}
      <div className="destinations-section">
        {destinations.map((dest, i) => (
          <div className="destination-row" key={i}>
            {destinations.length > 1 && (
              <div className="stop-label">Stop {i + 1}</div>
            )}
            <div className={`dest-fields${dest.stopType === 'Day trip' ? ' no-return' : ''}`}>
              <div className="field dest-city">
                <label>{destinations.length === 1 ? 'Destination' : 'City'}</label>
                <input
                  value={dest.city}
                  onChange={e => updateDestination(i, 'city', e.target.value)}
                  placeholder="e.g. New York, NY"
                />
              </div>
              <div className="field">
                <label>Type</label>
                <div className="stop-type-toggle">
                  {STOP_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      className={`stop-type-btn ${dest.stopType === t ? 'active' : ''}`}
                      onClick={() => updateDestination(i, 'stopType', t)}
                    >{t}</button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>{dest.stopType === 'Day trip' ? 'Date' : 'Departure'}</label>
                <input
                  type="date"
                  value={dest.departureDate}
                  onChange={e => updateDestination(i, 'departureDate', e.target.value)}
                />
              </div>
              {dest.stopType !== 'Day trip' && (
                <div className="field">
                  <label>Return</label>
                  <input
                    type="date"
                    value={dest.returnDate}
                    onChange={e => updateDestination(i, 'returnDate', e.target.value)}
                  />
                </div>
              )}
              {destinations.length > 1 && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeDestination(i)}
                  title="Remove this stop"
                >✕</button>
              )}
            </div>
          </div>
        ))}

        <button type="button" className="add-dest-btn" onClick={addDestination}>
          + Add another destination
        </button>
      </div>

      {/* Trip options row */}
      <div className="form-row options-row">
        <div className="field">
          <label>Trip Type</label>
          <select value={tripType} onChange={e => { setTripType(e.target.value); setError('') }}>
            <option>Recruiting</option>
            <option>Business</option>
            <option>School Trip</option>
            <option>Leisure</option>
            <option>Mixed</option>
          </select>
        </div>

        <div className="field">
          <label>Gender</label>
          <div className="gender-toggle">
            {['Male', 'Female', 'Non-binary'].map(g => (
              <button
                key={g}
                type="button"
                className={`gender-btn ${gender === g ? 'active' : ''}`}
                onClick={() => setGender(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="field full">
          <label>Rough Itinerary <span className="optional">(optional)</span></label>
          <textarea
            value={itinerary}
            onChange={e => { setItinerary(e.target.value); setError('') }}
            placeholder="e.g. Day 1: Goldman first round + networking dinner. Day 2: final rounds. Day 3: explore city, fly home 6pm."
            rows={2}
          />
        </div>
      </div>

      {error && <p className="form-error">{error}</p>}

      <button className="btn-generate" type="submit" disabled={loading}>
        {loading ? (
          <><span className="spinner" />Generating your plan…</>
        ) : (
          <>✦ Generate My Packing Plan</>
        )}
      </button>
    </form>
  )
}
