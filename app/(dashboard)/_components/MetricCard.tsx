import Link from 'next/link'

import { Sparkline } from './Sparkline'

export type MetricStatus = 'good' | 'warn' | 'crit' | 'neutral'

const SUB_COLOR: Record<MetricStatus, string> = {
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  crit: 'text-red-600',
  neutral: 'text-slate-400',
}

const SPARK_COLOR = '#2E7CF0'

// Kafel KPI wg makiety etinbot-panel-2.html: label mono uppercase, wartość
// text-2xl tabular-nums, podpis kolorem semantycznym, sparkline 30d.
export function MetricCard({
  label,
  value,
  sub,
  status = 'neutral',
  spark,
  href,
}: {
  label: string
  value: string | number
  sub?: string
  status?: MetricStatus
  spark?: number[]
  href?: string
}) {
  const body = (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 ${
        href ? 'transition-colors hover:border-[#2E7CF0]/40 hover:shadow-sm' : ''
      }`}
    >
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {sub && <div className={`mt-0.5 text-xs ${SUB_COLOR[status]}`}>{sub}</div>}
      {spark && spark.length >= 2 && <Sparkline points={spark} color={SPARK_COLOR} />}
    </div>
  )

  return href ? <Link href={href}>{body}</Link> : body
}
