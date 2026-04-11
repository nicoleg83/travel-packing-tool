import { useState, useRef, useCallback } from 'react'
import { Sparkles, CalendarDays } from 'lucide-react'
import OutfitTimeline from './OutfitTimeline'
import PackingList from './PackingList'
import LimitIndicator from './LimitIndicator'
import ChatPanel from './ChatPanel'
import './SplitView.css'

const OUTFIT_PILL = {
  'Formal': 'opl-pill-formal', 'Conservative Formal': 'opl-pill-formal',
  'Semi-Formal': 'opl-pill-formal', 'Cocktail': 'opl-pill-formal',
  'Business': 'opl-pill-business', 'Business Casual': 'opl-pill-business',
  'Smart Casual': 'opl-pill-smart', 'Resort Casual': 'opl-pill-smart',
  'Casual': 'opl-pill-casual', 'Beach Casual': 'opl-pill-casual',
  'Transit': 'opl-pill-transit', 'Travel': 'opl-pill-transit',
  'Activewear': 'opl-pill-active', 'Workout': 'opl-pill-active',
}
function pillClass(type) {
  if (!type) return 'opl-pill-transit'
  if (OUTFIT_PILL[type]) return OUTFIT_PILL[type]
  const t = type.toLowerCase()
  if (t.includes('formal') || t.includes('cocktail')) return 'opl-pill-formal'
  if (t.includes('business')) return 'opl-pill-business'
  if (t.includes('smart') || t.includes('resort')) return 'opl-pill-smart'
  if (t.includes('casual') || t.includes('beach')) return 'opl-pill-casual'
  if (t.includes('transit') || t.includes('travel')) return 'opl-pill-transit'
  if (t.includes('active') || t.includes('workout')) return 'opl-pill-active'
  return 'opl-pill-casual'
}

const MIN_SIDEBAR = 180
const MAX_SIDEBAR = 420
const DEFAULT_SIDEBAR = 240

export default function SplitView({ data, tripContext, workingView, includeWorkouts, onRegenerate }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR)
  const dragRef = useRef(null)

  const handleDragStart = useCallback((e) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startWidth: sidebarWidth }

    function onMove(ev) {
      if (!dragRef.current) return
      const delta = dragRef.current.startX - ev.clientX
      const newWidth = Math.max(MIN_SIDEBAR, Math.min(MAX_SIDEBAR, dragRef.current.startWidth + delta))
      setSidebarWidth(newWidth)
    }
    function onUp() {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  // Packing List view: packing list (left 50%) + outfit plan (right 50%) + floating chat
  if (workingView === 'packing') {
    const days = data.days || []
    return (
      <div className="packing-view packing-split-layout">

        {/* Left col — packing list (50%) */}
        <PackingList
          packingList={data.packingList}
          totalItems={data.totalItems}
          carryOnFeasible={data.carryOnFeasible}
          carryOnLimit={data.carryOnLimit}
          originalRequest={tripContext}
          currentPlan={data}
          hideOutfitSummary
        />

        {/* Right col — outfit plan (50%) */}
        <div className="packing-right-col">
          <div className="packing-right-header">
            <span className="packing-col-label">
              <CalendarDays size={11} />
              Outfit Plan
            </span>
            <div className="packing-header-meta">
              <span className="summary-stat">
                <span className="ss-val">
                  {days.reduce((n, d) => n + (d.outfits?.filter(o => !/activewear|workout/i.test(o.type || '')).length || 0), 0)}
                </span> outfits
              </span>
              <span className="summary-sep">·</span>
              <span className="summary-stat"><span className="ss-val">{days.length}</span> days</span>
            </div>
          </div>
          <div className="packing-right-body">
            {days.map((day, i) => {
              const outfits = (day.outfits || []).filter(o => !/activewear|workout/i.test(o.type || ''))
              if (!outfits.length) return null
              let dateLabel = day.label || `Day ${i + 1}`
              if (day.date) {
                const d = new Date(day.date + 'T12:00:00')
                const dow = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
                dateLabel = `${dow} ${d.getDate()}`
              }
              return (
                <div key={day.date || i} className="outfit-day-row">
                  <span className="outfit-day-label">{dateLabel}</span>
                  <div className="outfit-day-outfits">
                    {outfits.map((o, j) => (
                      <div key={j} className="outfit-day-entry">
                        <span className={`opl-pill ${pillClass(o.type)}`}>{o.type}</span>
                        <span className="outfit-day-items">
                          {(o.items || []).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Floating chat bubble */}
        <div className="floating-chat-wrap">
          {chatOpen && (
            <div className="floating-chat-panel">
              <ChatPanel
                originalRequest={tripContext}
                currentPlan={data}
                onRegenerate={onRegenerate}
              />
            </div>
          )}
          <button
            className={`chat-fab${chatOpen ? ' chat-fab--open' : ''}`}
            onClick={() => setChatOpen(o => !o)}
            title="Ask Packwise"
          >
            <Sparkles size={20} />
          </button>
        </div>
      </div>
    )
  }

  // Outfits view: calendar + resizable slim sidebar
  return (
    <div className="split-view">
      <section className="calendar-panel">
        <OutfitTimeline
          days={data.days}
          tripContext={tripContext}
          currentPlan={data}
          onRegenerate={onRegenerate}
          includeWorkouts={includeWorkouts}
        />
      </section>

      <aside className="outfits-sidebar" style={{ width: sidebarWidth }}>
        {/* Drag handle */}
        <div className="sidebar-drag-handle" onMouseDown={handleDragStart} />

        {/* Limit indicator */}
        <div className="sidebar-meta">
          <div className="sidebar-limit-wrap">
            <LimitIndicator
              totalItems={data.totalItems}
              limit={data.carryOnLimit}
              isCheckedBag={tripContext?.bagType === 'Checked bag'}
            />
          </div>
        </div>

        {/* Chat panel fills the rest */}
        <div className="sidebar-chat-fill">
          <ChatPanel
            originalRequest={tripContext}
            currentPlan={data}
            onRegenerate={onRegenerate}
          />
        </div>
      </aside>
    </div>
  )
}
