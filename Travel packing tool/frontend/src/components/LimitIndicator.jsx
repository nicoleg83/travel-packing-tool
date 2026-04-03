import { CheckCircle2, AlertTriangle, XCircle, Package } from 'lucide-react'
import './LimitIndicator.css'

function getStatus(totalItems, limit, isCheckedBag) {
  if (isCheckedBag) return 'checked'
  if (!limit) return 'ok'
  const pct = (totalItems / limit) * 100
  if (pct <= 100) return 'ok'
  if (pct <= 120) return 'warn'
  return 'over'
}

const STATUS_CONFIG = {
  ok:      { Icon: CheckCircle2, badge: 'Under limit' },
  warn:    { Icon: AlertTriangle, badge: 'Slightly over' },
  over:    { Icon: XCircle,      badge: 'Over limit' },
  checked: { Icon: Package,      badge: 'Checked bag' },
}

export default function LimitIndicator({ totalItems, limit, isCheckedBag }) {
  const status = getStatus(totalItems, limit, isCheckedBag)
  const { Icon, badge } = STATUS_CONFIG[status]
  const fillPct = Math.min(100, (totalItems / (limit || 1)) * 100)

  return (
    <div className={`limit-indicator limit-indicator--${status}`}>
      <div className="limit-top-row">
        <span className="limit-bag-label">
          {isCheckedBag ? 'Checked bag' : 'Carry-on'}
        </span>
        <span className="limit-status-badge">
          <Icon size={10} />
          {badge}
        </span>
      </div>
      <div className="limit-bar-wrap">
        <div className="limit-bar-fill" style={{ width: `${fillPct}%` }} />
      </div>
      <span className="limit-count">{totalItems} / {limit} items</span>
    </div>
  )
}
