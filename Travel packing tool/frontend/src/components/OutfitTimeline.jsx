import { useState, Fragment } from 'react'
import { Plane, Sun, Moon, Dumbbell, RefreshCw, BarChart2, ChevronLeft, ChevronRight } from 'lucide-react'

const WEATHER_EMOJI = {
  'clear sky': '☀️', 'mainly clear': '🌤️', 'partly cloudy': '⛅', 'overcast': '☁️',
  'foggy': '🌫️', 'icy fog': '🌫️', 'haze': '🌫️',
  'light drizzle': '🌦️', 'drizzle': '🌦️', 'heavy drizzle': '🌧️',
  'light rain': '🌧️', 'rain': '🌧️', 'moderate rain': '🌧️', 'heavy rain': '🌧️',
  'freezing rain': '🌨️', 'freezing drizzle': '🌨️',
  'light snow': '🌨️', 'snow': '❄️', 'heavy snow': '❄️', 'snow grains': '🌨️',
  'light rain showers': '🌦️', 'rain showers': '🌦️', 'showers': '🌦️', 'heavy showers': '🌧️',
  'snow showers': '🌨️', 'heavy snow showers': '🌨️',
  'light thunderstorm': '🌩️', 'thunderstorm': '⛈️', 'thunderstorm w/ hail': '⛈️', 'heavy thunderstorm': '⛈️',
  'variable conditions': '🌤️', 'windy': '💨',
}
function calWeatherEmoji(weatherStr) {
  if (!weatherStr) return null
  const lower = weatherStr.toLowerCase()
  for (const [key, emoji] of Object.entries(WEATHER_EMOJI)) {
    if (lower.includes(key)) return emoji
  }
  if (/rain|shower/i.test(weatherStr)) return '🌧️'
  if (/snow/i.test(weatherStr)) return '❄️'
  if (/thunder/i.test(weatherStr)) return '⛈️'
  if (/cloud/i.test(weatherStr)) return '☁️'
  if (/clear|sun/i.test(weatherStr)) return '☀️'
  return '🌤️'
}
import DayCard from './DayCard'
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
  if (t === 'activewear' || t.includes('workout') || t.includes('athletic') || t.includes('active') || t.includes('sport') || t.includes('gym') || tm === 'workout') return 'WORKOUT'
  if (tm === 'evening' || tm === 'night') return 'EVENING'
  return 'MORNING'
}

const PILL_CLASS = {
  'Formal':              'pill-formal',
  'Conservative Formal': 'pill-formal',
  'Semi-Formal':         'pill-formal',
  'Cocktail':            'pill-formal',
  'Black Tie':           'pill-formal',
  'Business':            'pill-business',
  'Business Casual':     'pill-business',
  'Smart Casual':        'pill-smart',
  'Resort Casual':       'pill-smart',
  'Smart':               'pill-smart',
  'Casual':              'pill-casual',
  'Beach Casual':        'pill-casual',
  'Daytime':             'pill-casual',
  'Transit':             'pill-transit',
  'Travel':              'pill-transit',
  'Activewear':          'pill-active',
  'Athletic':            'pill-active',
  'Workout':             'pill-active',
}

function getPillClass(type) {
  if (!type) return 'pill-transit'
  // Exact match first
  if (PILL_CLASS[type]) return PILL_CLASS[type]
  // Fuzzy match on keywords
  const t = type.toLowerCase()
  if (t.includes('formal') || t.includes('cocktail') || t.includes('black tie')) return 'pill-formal'
  if (t.includes('business') && !t.includes('casual')) return 'pill-business'
  if (t.includes('smart') || t.includes('resort')) return 'pill-smart'
  if (t.includes('casual') || t.includes('daytime')) return 'pill-casual'
  if (t.includes('transit') || t.includes('travel')) return 'pill-transit'
  if (t.includes('active') || t.includes('workout') || t.includes('athletic')) return 'pill-active'
  return 'pill-casual'
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

const PAGE_SIZE = 5

export default function OutfitTimeline({ days, tripContext, currentPlan, onRegenerate, includeWorkouts = true }) {
  const [regenSlot, setRegenSlot] = useState(null) // `${date}-${rowKey}`
  const [page, setPage] = useState(0)

  if (!days?.length) return null

  // Pagination
  const totalPages = Math.ceil(days.length / PAGE_SIZE)
  const visibleDays = days.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  // Filter WORKOUT row when workouts are disabled
  const activeRows = includeWorkouts
    ? ROW_DEFS
    : ROW_DEFS.filter(r => r.key !== 'WORKOUT')

  const colCount = visibleDays.length

  async function handleSlotRegen(day, outfit, rowKey) {
    const slotKey = `${day.date || day.label}-${rowKey}`
    if (regenSlot) return
    setRegenSlot(slotKey)
    try {
      const timeLabel = outfit.time || rowKey
      const dayLabel = day.label || day.date || 'that day'
      const instruction = `Replace ONLY the ${timeLabel} outfit on ${dayLabel} with a completely different option. Do not change any other day or outfit slot.`
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
      if (res.ok) {
        // Surgically replace only the target outfit — keep all other days/outfits from currentPlan
        const targetDate = day.date
        const newDay = data.days?.find(d => d.date === targetDate)
        const newOutfit = newDay?.outfits?.find(o => getRow(o.type, o.time) === rowKey)

        if (newOutfit) {
          const updatedPlan = {
            ...currentPlan,
            days: currentPlan.days.map(d => {
              if (d.date !== targetDate) return d
              return {
                ...d,
                outfits: d.outfits.map(o =>
                  getRow(o.type, o.time) === rowKey ? newOutfit : o
                ),
              }
            }),
            packingList: data.packingList || currentPlan.packingList,
            totalItems: data.totalItems ?? currentPlan.totalItems,
            carryOnFeasible: data.carryOnFeasible ?? currentPlan.carryOnFeasible,
            carryOnLimit: data.carryOnLimit ?? currentPlan.carryOnLimit,
          }
          onRegenerate(updatedPlan)
        } else {
          onRegenerate(data)
        }
      }
    } catch (err) {
      console.error('Slot regen failed:', err)
    } finally {
      setRegenSlot(null)
    }
  }

  return (
    <div className="timeline-scroll">
      {/* ── Mobile: vertical day-card stack ─────────────────────────── */}
      <div className="mobile-day-stack">
        {days.map((day, i) => (
          <DayCard
            key={day.date || i}
            day={day}
            dayIndex={i}
            originalRequest={tripContext}
            currentPlan={currentPlan}
            onRegenerate={onRegenerate}
          />
        ))}
      </div>

      {/* ── Desktop: calendar grid ───────────────────────────────────── */}
      <div className="cal-scroll-inner desktop-cal">
        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="cal-pagination">
            <button
              className="cal-page-btn"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              aria-label="Previous days"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="cal-page-label">
              Days {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, days.length)} of {days.length}
            </span>
            <button
              className="cal-page-btn"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              aria-label="Next days"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        <div
          className="cal-grid"
          style={{ gridTemplateColumns: `80px repeat(${colCount}, 170px)` }}
        >
          {/* ── Corner ──────────────────────────────────────────────── */}
          <div className="g-corner" />

          {/* ── Column headers ──────────────────────────────────────── */}
          {visibleDays.map((day, i) => {
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
                {day.events && (
                  <div className="col-events">{day.events}</div>
                )}
                {weatherEntry?.weather && !weatherEntry.weather.toLowerCase().includes('unavailable') && (
                  <div className={`col-weather${weatherEntry.isAverage ? ' col-weather--avg' : ''}`}>
                    {weatherEntry.isAverage
                      ? <BarChart2 size={11} />
                      : <span className="col-weather-emoji">{calWeatherEmoji(weatherEntry.weather)}</span>
                    }
                    {weatherEntry.weather}
                    {weatherEntry.isAverage && (
                      <span className="weather-avg-tag" title={`${weatherEntry.monthLabel || 'historical'} monthly average`}>avg</span>
                    )}
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
              {visibleDays.map((day, dayIndex) => {
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
                        <span className={`pill ${getPillClass(outfit.type)}`}>
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

