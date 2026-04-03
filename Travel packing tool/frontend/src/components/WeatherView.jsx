import { BarChart2 } from 'lucide-react'
import './WeatherView.css'

const CONDITION_EMOJI = {
  'clear sky': '☀️', 'mainly clear': '🌤️', 'partly cloudy': '⛅', 'overcast': '☁️',
  'foggy': '🌫️', 'icy fog': '🌫️',
  'light drizzle': '🌦️', 'drizzle': '🌦️', 'heavy drizzle': '🌧️',
  'light rain': '🌧️', 'rain': '🌧️', 'heavy rain': '🌧️',
  'light snow': '❄️', 'snow': '❄️', 'heavy snow': '❄️', 'snow grains': '❄️',
  'rain showers': '🌦️', 'showers': '🌦️', 'heavy showers': '🌧️',
  'snow showers': '🌨️', 'heavy snow showers': '🌨️',
  'thunderstorm': '⛈️', 'thunderstorm w/ hail': '⛈️', 'heavy thunderstorm': '⛈️',
  'variable conditions': '🌤️',
}

function conditionEmoji(cond) {
  if (!cond) return '🌤️'
  return CONDITION_EMOJI[cond.toLowerCase()] || '🌤️'
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

          {/* Daily forecast cards */}
          {w.dailyData?.length > 0 ? (
            <div className="weather-day-cards">
              {w.dailyData.map((day) => {
                const { weekday, date } = formatDayLabel(day.date)
                const emoji = conditionEmoji(day.condition)
                return (
                  <div key={day.date} className="weather-day-card">
                    <div className="wdc-top">
                      <div className="wdc-dow">{weekday}</div>
                      <div className="wdc-date">{date}</div>
                    </div>
                    <div className="wdc-icon">{emoji}</div>
                    <div className="wdc-condition">{day.condition}</div>
                    <div className="wdc-temps">
                      <span className="wdc-high">{day.high}°</span>
                      <span className="wdc-low">{day.low}°</span>
                    </div>
                    {day.precipProb != null && (
                      <div className={`wdc-precip${day.precipProb >= 40 ? ' wdc-precip--wet' : ''}`}>
                        💧 {day.precipProb}%
                      </div>
                    )}
                    {day.morning != null && (
                      <div className="wdc-hourly">
                        <span className="wdc-hourly-item">
                          <span className="wdc-hourly-label">AM</span>
                          <span className="wdc-hourly-val">{day.morning}°</span>
                        </span>
                        <span className="wdc-hourly-item">
                          <span className="wdc-hourly-label">PM</span>
                          <span className="wdc-hourly-val">{day.afternoon}°</span>
                        </span>
                        <span className="wdc-hourly-item">
                          <span className="wdc-hourly-label">EVE</span>
                          <span className="wdc-hourly-val">{day.evening}°</span>
                        </span>
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
