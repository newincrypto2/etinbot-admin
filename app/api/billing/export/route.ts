import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/auth-helpers'
import { getMarginMultiplier } from '@/lib/cost-format'
import { getMonthlySummary } from '@/queries/costs'
import { activeClientSlug } from '@/lib/tenant'


function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function csvRow(cols: unknown[]): string {
  return cols.map(csvEscape).join(',')
}

function parseMonth(raw: string | null): { iso: string; start: Date; end: Date } | null {
  if (!raw || !/^\d{4}-\d{2}$/.test(raw)) return null
  const start = new Date(`${raw}-01T00:00:00.000Z`)
  if (isNaN(start.getTime())) return null
  const end = new Date(start)
  end.setUTCMonth(end.getUTCMonth() + 1)
  return { iso: raw, start, end }
}

export async function GET(req: NextRequest) {
  // Dane finansowe / marże — tylko OWNER wzwyż (spójne z /billing).
  await requireRole('OWNER')

  const { searchParams } = req.nextUrl
  const month = parseMonth(searchParams.get('month'))
  if (!month) {
    return NextResponse.json({ error: 'month=YYYY-MM required' }, { status: 400 })
  }
  const format = searchParams.get('format') ?? 'summary'
  if (format !== 'summary' && format !== 'detail') {
    return NextResponse.json({ error: 'format=summary|detail' }, { status: 400 })
  }

  const margin = getMarginMultiplier()

  if (format === 'summary') {
    const summary = await getMonthlySummary((await activeClientSlug()), `${month.iso}-01`)
    const lines = [
      `# EtinBOT — koszty ${month.iso} — klient: ${(await activeClientSlug())}`,
      csvRow(['service', 'units', 'unit_type', 'cost_pln']),
    ]
    for (const r of summary.byService) {
      const plnBilled = parseFloat(r.cost_pln || '0') * margin
      lines.push(csvRow([r.service, r.units, r.unit_type, plnBilled.toFixed(4)]))
    }
    const totalBilled = parseFloat(summary.total_pln || '0') * margin
    lines.push(csvRow(['TOTAL', '', '', totalBilled.toFixed(4)]))

    return new NextResponse(lines.join('\n') + '\n', {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="etinbot-koszty-${month.iso}-summary.csv"`,
      },
    })
  }

  // format === 'detail'
  const rows = await prisma.$queryRaw<
    Array<{
      created_at: Date
      conversation_id: string | null
      service: string
      operation: string | null
      units: any
      unit_type: string
      cost_usd: any
      cost_pln: any | null
      source: string
      external_id: string | null
    }>
  >`
    SELECT cc.created_at,
           cc.conversation_id,
           cc.service,
           cc.operation,
           cc.units,
           cc.unit_type,
           cc.cost_usd,
           cc.cost_pln,
           cc.source,
           cc.external_id
    FROM conversation_costs cc
    JOIN clients c ON c.id = cc.client_id
    WHERE c.slug = ${(await activeClientSlug())}
      AND cc.created_at >= ${month.start}
      AND cc.created_at < ${month.end}
    ORDER BY cc.created_at ASC
  `

  const lines = [
    `# EtinBOT — detail koszty ${month.iso} — klient: ${(await activeClientSlug())}`,
    csvRow([
      'created_at',
      'conversation_id',
      'service',
      'operation',
      'units',
      'unit_type',
      'cost_pln',
      'source',
      'external_id',
    ]),
  ]
  for (const r of rows) {
    const plnBilled = r.cost_pln ? parseFloat(r.cost_pln.toString()) * margin : 0
    lines.push(
      csvRow([
        r.created_at.toISOString(),
        r.conversation_id ?? '',
        r.service,
        r.operation ?? '',
        r.units?.toString() ?? '',
        r.unit_type,
        plnBilled.toFixed(6),
        r.source,
        r.external_id ?? '',
      ]),
    )
  }

  return new NextResponse(lines.join('\n') + '\n', {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="etinbot-koszty-${month.iso}-detail.csv"`,
    },
  })
}
