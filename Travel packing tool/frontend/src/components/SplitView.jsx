import { Cloud, CloudSun } from 'lucide-react'
import OutfitTimeline from './OutfitTimeline'
import PackingList from './PackingList'
import './SplitView.css'

function buildMeta(data, tripContext) {
  const parts = []
  // Weather summaries
  const weatherArr = Array.isArray(data.weather) ? data.weather : []
  weatherArr.forEach(w => {
    if (w.weather) parts.push({ icon: 'cloud', text: `${w.city} ${w.weather}` })
  })
  // Date range
  const dest = tripContext?.destinations?.[0]
  if (dest?.departureDate) {
    const dep = new Date(dest.departureDate + 'T12:00:00')
    const month = dep.toLocaleDateString('en-US', { month: 'short' })
    const depDay = dep.getDate()
    if (dest.returnDate && dest.returnDate !== dest.departureDate) {
      const ret = new Date(dest.returnDate + 'T12:00:00')
      parts.push({ text: `${month} ${depDay}–${ret.getDate()}` })
      const nights = Math.round((ret - dep) / (1000 * 60 * 60 * 24))
      parts.push({ text: `${nights} day${nights !== 1 ? 's' : ''}` })
    } else {
      parts.push({ text: `${month} ${depDay}` })
    }
  }
  return parts
}

export default function SplitView({ data, tripContext, onRegenerate }) {
  const meta = buildMeta(data, tripContext)

  return (
    <div className="split-view">
      <section className="calendar-panel">
        <div className="calendar-panel-header">
          <span className="cal-panel-title">Day-by-Day Outfit Calendar</span>
          <div className="cal-panel-meta">
            {meta.map((m, i) => (
              <span key={i} className="meta-item">
                {i > 0 && <span className="meta-sep">·</span>}
                {m.icon && <Cloud size={11} />}
                {m.text}
              </span>
            ))}
          </div>
        </div>
        <OutfitTimeline
          days={data.days}
          tripContext={tripContext}
          currentPlan={data}
          onRegenerate={onRegenerate}
        />
      </section>

      <aside className="packing-panel">
        <PackingList
          packingList={data.packingList}
          totalItems={data.totalItems}
          carryOnFeasible={data.carryOnFeasible}
          carryOnLimit={data.carryOnLimit}
          originalRequest={tripContext}
          currentPlan={data}
          onRegenerate={onRegenerate}
        />
      </aside>
    </div>
  )
}
