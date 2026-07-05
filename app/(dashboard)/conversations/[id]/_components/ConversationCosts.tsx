import { Coins, ChevronDown } from 'lucide-react'
import type { ConversationCostSummary } from '@/queries/costs'
import { fmtPln, fmtUnits, serviceName, withMargin } from '@/lib/cost-format'

export function ConversationCosts({ summary }: { summary: ConversationCostSummary }) {
  if (summary.breakdown.length === 0) {
    return (
      <div className="text-xs text-slate-400 flex items-center gap-1.5 py-2">
        <Coins className="h-3.5 w-3.5" />
        Brak danych kosztowych dla tej rozmowy.
      </div>
    )
  }

  const totalBilled = withMargin(summary.total_pln) ?? 0

  return (
    <details className="group rounded-md border border-slate-200 bg-white">
      <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer list-none text-sm text-slate-600 hover:bg-slate-50/60">
        <span className="flex items-center gap-1.5">
          <Coins className="h-3.5 w-3.5 text-slate-400" />
          Koszt rozmowy:{' '}
          <span className="font-semibold text-slate-900">{fmtPln(totalBilled)}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <table className="w-full text-sm border-t border-slate-100">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50/40">
            <th className="px-3 py-1.5 font-medium">Usługa</th>
            <th className="px-3 py-1.5 font-medium text-right">Zużycie</th>
            <th className="px-3 py-1.5 font-medium text-right">PLN</th>
          </tr>
        </thead>
        <tbody>
          {summary.breakdown.map((line) => (
            <tr key={line.service + line.unit_type} className="border-t border-slate-100">
              <td className="px-3 py-1.5 text-slate-700 text-xs">
                {serviceName(line.service)}
                {line.line_count > 1 && (
                  <span className="text-[10px] text-slate-400 ml-1.5">×{line.line_count}</span>
                )}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-[11px] text-slate-500">
                {fmtUnits(line.units, line.unit_type)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-[11px] font-medium text-slate-900">
                {fmtPln(withMargin(line.cost_pln))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
