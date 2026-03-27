import { useState, Fragment } from 'react'
import { Plane, Sun, Moon, Dumbbell, RefreshCw, Cloud } from 'lucide-react'
import { API_URL } from '../api.js'
import './OutfitTimeline.css'

const ROW_DEFS = [
  { key: 'TRAVEL',  label: 'Travel',  Icon: Plane },
  { key: 'MORNING', label: 'Morning', Icon: Sun },
  { key: 'EVENING', label: 'Evening', Icon: Moon },
  { key: 'WORKOUT', label: 'Workout', Icon: Dumbbell },
]

function getRow(type, time) {
  const t = (type || '').toLowerCase()
  const tm = (time || '').toLowerCase()
  if (t === 'transit' || t === 'travel') return 'TRAVEL'
  if (t === 'activewear') return 'WORKOUT'
  if (tm === 'evening' || tm === 'night') return 'EVENING'
  return 'MORNING'
}

const PILL_CLASS = {
  'Formal':              'pill-formal',
  'Business Casual':     'pill-business',
  'Business':            'pill-business',
  'Casual':              'pill-casual',
  'Transit':             'pill-transit',
  'Travel':              'pill-transit',
  'Activewear':          'pill-active',
  'Conservative Formal': 'pill-formal',
}

// Match a day's date to the correct weather entry by destination date range
function getWeatherForDay(weatherArr, dayDate) {
  if (!dayDate || !weatherArr?.length) return null
  return (
    weatherArr.find(w => {
      if (!w.dates) return false
      if (w.dates.includes(' to ')) {
        const [start, end] = w.dates.split(' to ')
        return dayDate >= start && dayDate <= end
      }
      return w.dates === dayDate
    }) || weatherArr[0]
  )
}

export default function OutfitTimeline({ days, tripContext, currentPlan, onRegenerate }) {
  const [regenSlot, setRegenSlot] = useState(null) // `${date}-${rowKey}`

  if (!days?.length) return null

  // Always show all 4 rows
  const activeRows = ROW_DEFS

  const cornerMonth = days[0]?.date
    ? new Date(days[0].date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
    : ''

  const colCount = days.length

  async function handleSlotRegen(day, outfit, rowKey) {
    const slotKey = `${day.date || day.label}-${rowKey}`
    if (regenSlot) return
    setRegenSlot(slotKey)
    try {
      const timeLabel = outfit.time || rowKey
      const dayLabel = day.label || day.date || 'that day'
      const instruction = `Replace the ${timeLabel} outfit on ${dayLabel} with a completely different option. Keep every other day and outfit exactly the same. Keep the packing list consistent with whatever you change.`
      const res = await fetch(`${API_URL}/api/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalRequest: tripContext,
          editInstruction: instruction,
          currentPlan,
        }),
      })
      const data = await res.json()
      if (res.ok) onRegenerate(data)
    } catch (err) {
      console.error('Slot regen failed:', err)
    } finally {
      setRegenSlot(null)
    }
  }

  return (
    <div className="timeline-scroll">
      <div className="cal-scroll-inner">
        <div
          className="cal-grid"
          style={{ gridTemplateColumns: `90px repeat(${colCount}, 220px)` }}
        >
          {/* ── Corner ──────────────────────────────────────────────── */}
          <div className="g-corner">
            {cornerMonth && <span className="corner-month">{cornerMonth}</span>}
          </div>

          {/* ── Column headers ──────────────────────────────────────── */}
          {days.map((day, i) => {
            let dow = ''
            let dateNum = day.label || `Day ${i + 1}`
            if (day.date) {
              const d = new Date(day.date + 'T12:00:00')
              dow = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
              dateNum = d.getDate()
            }
            const weatherArr = Array.isArray(currentPlan?.weather) ? currentPlan.weather : []
            const weatherEntry = getWeatherForDay(weatherArr, day.date)

            return (
              <div key={day.date || i} className="g-col-head">
                {dow && <div className="col-dow">{dow}</div>}
                <div className="col-date">{dateNum}</div>
                {day.events && <div className="col-events">{day.events}</div>}
                {weatherEntry?.weather && (
                  <div className="col-weather">
                    <Cloud size={11} />
                    {weatherEntry.weather}
                  </div>
                )}
              </div>
            )
          })}

          {/* ── Content rows ────────────────────────────────────────── */}
          {activeRows.map(({ key, label, Icon }) => (
            <Fragment key={key}>
              {/* Row label */}
              <div className="g-row-label">
                <Icon size={15} />
                <span className="row-label-text">{label}</span>
              </div>

              {/* One cell per day */}
              {days.map((day, dayIndex) => {
                const outfit = day.outfits?.find(o => getRow(o.type, o.time) === key)
                const slotKey = `${day.date || day.label}-${key}`
                const isRegening = regenSlot === slotKey

                return (
                  <div
                    key={`${key}-${day.date || dayIndex}`}
                    className={`g-outfit${outfit ? '' : ' cell-empty'}`}
                  >
                    {outfit ? (
                      <>
                        <span className={`pill ${PILL_CLASS[outfit.type] || 'pill-transit'}`}>
                          {outfit.type}
                        </span>
                        <ul className="outfit-items">
                          {outfit.items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                        <button
                          className={`slot-regen ${isRegening ? 'slot-regen--loading' : ''}`}
                          onClick={() => handleSlotRegen(day, outfit, key)}
                          disabled={!!regenSlot}
                        >
                          <RefreshCw size={10} className={isRegening ? 'spin' : ''} />
                          {isRegening ? 'Swapping…' : 'New outfit'}
                        </button>
                      </>
                    ) : (
                      <span className="empty-dash">—</span>
                    )}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
