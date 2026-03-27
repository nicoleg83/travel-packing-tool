import OutfitSlot from './OutfitSlot'
import './DayCard.css'

export default function DayCard({ day, dayIndex, originalRequest, currentPlan, onRegenerate }) {
  // Format date for display: "Mon 14" from "2026-04-14"
  let dayNum = ''
  let dayName = ''
  if (day.date) {
    const d = new Date(day.date + 'T12:00:00')  // noon to avoid tz edge cases
    dayNum = d.getDate()
    dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  return (
    <div className="day-card enter">
      <div className="day-card-header">
        <div className="day-date">
          {dayName && <span className="day-name">{dayName}</span>}
          {dayNum && <span className="day-num">{dayNum}</span>}
          {!dayName && <span className="day-label-text">{day.label}</span>}
        </div>
        {day.temp && <div className="day-temp">{day.temp}</div>}
        {day.events && <div className="day-events">{day.events}</div>}
      </div>

      <div className="day-outfits">
        {day.outfits.map((outfit, i) => (
          <OutfitSlot
            key={i}
            outfit={outfit}
            dayIndex={dayIndex}
            originalRequest={originalRequest}
            currentPlan={currentPlan}
            onRegenerate={onRegenerate}
          />
        ))}
      </div>
    </div>
  )
}
