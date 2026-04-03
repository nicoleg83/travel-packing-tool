import { useState, useRef, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import OutfitTimeline from './OutfitTimeline'
import PackingList from './PackingList'
import LimitIndicator from './LimitIndicator'
import ChatPanel from './ChatPanel'
import './SplitView.css'

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

  // Packing List view: full-width list + floating chat bubble
  if (workingView === 'packing') {
    return (
      <div className="packing-view">
        <PackingList
          packingList={data.packingList}
          totalItems={data.totalItems}
          carryOnFeasible={data.carryOnFeasible}
          carryOnLimit={data.carryOnLimit}
          originalRequest={tripContext}
          currentPlan={data}
          multiColumn
        />

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
