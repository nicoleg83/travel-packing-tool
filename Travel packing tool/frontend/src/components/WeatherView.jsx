import { BarChart2, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, Wind, Droplets } from 'lucide-react'
import './WeatherView.css'

function WeatherIcon({ condition, size = 22 }) {
  const s = (condition || '').toLowerCase()
  const style = { color: 'var(--faint)', flexShrink: 0 }
  if (/thunder|lightning/i.test(s))            return <CloudLightning size={size} style={style} />
  if (/snow|blizzard|sleet/i.test(s))          return <CloudSnow      size={size} style={style} />
  if (/rain|shower|drizzle|freezing/i.test(s)) return <CloudRain      size={size} style={style} />
  if (/fog|mist|haze/i.test(s))                return <Droplets       size={size} style={style} />
  if (/wind/i.test(s))                          return <Wind           size={size} style={style} />
  if (/cloud|overcast/i.test(s))               return <Cloud          size={size} style={style} />
  if (/clear|sun|mainly/i.test(s))             return <Sun            size={size} style={style} />
  return <Cloud size={size} style={style} />
}

function isWet(condition) {
  return /rain|shower|drizzle|thunder|snow|sleet|freezing/i.test(condition || '')
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return {
    weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

function formatDateRange(dates) {
  if (!dates) return ''
  if (dates.includes(' to ')) {
    const [start, end] = dates.split(' to ')
    const s = new Date(start + 'T12:00:00')
    const e = new Date(end + 'T12:00:00')
    const sMonth = s.toLocaleDateString('en-US', { month: 'short' })
    const eMonth = e.toLocaleDateString('en-US', { month: 'short' })
    if (sMonth === eMonth) return `${sMonth} ${s.getDate()}–${e.getDate()}`
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`
  }
  const d = new Date(dates + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const PERIODS = [
  { label: 'AM',  condKey: 'morningCondition',   tempKey: 'morning' },
  { label: 'PM',  condKey: 'afternoonCondition',  tempKey: 'afternoon' },
  { label: 'EVE', condKey: 'eveningCondition',    tempKey: 'evening' },
]

export default function WeatherView({ weather }) {
  if (!weather?.length) return null

  return (
    <div className="weather-view">
      {weather.map((w, i) => (
        <div key={i} className="weather-dest">
          <div className="weather-dest-header">
            <div className="weather-dest-meta">
              <span className="weather-dest-city">{w.city}</span>
              <span className="weather-dest-dates">{formatDateRange(w.dates)}</span>
            </div>
            {w.isAverage && (
              <span className="weather-avg-tag" title={`${w.monthLabel || 'historical'} monthly average`}>
                <BarChart2 size={9} /> avg
              </span>
            )}
          </div>

          {w.dailyData?.length > 0 ? (
            <div className="weather-day-cards">
              {w.dailyData.map((day) => {
                const { weekday, date } = formatDayLabel(day.date)
                const hasPeriods = PERIODS.some(p => day[p.condKey] != null)

                return (
                  <div key={day.date} className="weather-day-card">
                    {/* Date */}
                    <div className="wdc-top">
                      <div className="wdc-dow">{weekday}</div>
                      <div className="wdc-date">{date}</div>
                    </div>

                    {/* Icon */}
                    <div className="wdc-icon">
                      <WeatherIcon condition={day.condition} size={26} />
                    </div>

                    {/* Overall condition — fixed height so temps always align */}
                    <div className="wdc-condition">{day.condition}</div>

                    {/* High / Low */}
                    <div className="wdc-temps">
                      <span className="wdc-high">{day.high}°</span>
                      <span className="wdc-low">{day.low}°</span>
                    </div>

                    {/* Precip */}
                    {day.precipProb != null && (
                      <div className={`wdc-precip${day.precipProb >= 40 ? ' wdc-precip--wet' : ''}`}>
                        <Droplets size={9} style={{ color: 'inherit' }} />
                        {day.precipProb}%
                      </div>
                    )}

                    {/* AM / PM / EVE breakdown */}
                    {hasPeriods && (
                      <div className="wdc-periods">
                        {PERIODS.map(({ label, condKey, tempKey }) => {
                          const cond = day[condKey]
                          const temp = day[tempKey]
                          if (cond == null && temp == null) return null
                          const wet = isWet(cond)
                          return (
                            <div key={label} className={`wdc-period-row${wet ? ' wdc-period-row--wet' : ''}`}>
                              <span className="wdc-period-label">{label}</span>
                              <WeatherIcon condition={cond} size={10} />
                              {temp != null && <span className="wdc-period-temp">{temp}°</span>}
                              {cond && <span className="wdc-period-cond">{cond}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="weather-no-detail">
              {w.weather && <p className="weather-dest-summary">{w.weather}</p>}
              <p className="weather-regen-hint">Regenerate your plan to see the full daily forecast.</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
