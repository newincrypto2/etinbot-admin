'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ListPlus, Search, Calculator } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { saveQuoteLines, searchWfirmaGoods } from '@/actions/quotes'
import {
  LINE_KINDS,
  categoryLabel,
  fmtMarginPct,
  fmtZl,
  type CostItem,
  type QuoteLine,
  type WfirmaGood,
} from '@/lib/quotes'

type EditLine = {
  kind: string
  name: string
  qty: string
  unit: string
  unitCost: string
  costItemKey: string | null
  notes: string
}

type Props = {
  quoteId: string
  initialLines: QuoteLine[]
  initialQuantity: number | null
  initialTargetMarginPct: number | null
  costItems: CostItem[]
}

function numToInput(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return ''
  return String(v).replace('.', ',')
}

function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : null
}

function toEdit(l: QuoteLine): EditLine {
  return {
    kind: l.kind,
    name: l.name,
    qty: numToInput(l.qty),
    unit: l.unit ?? '',
    unitCost: numToInput(l.unitCost),
    costItemKey: l.costItemKey,
    notes: l.notes ?? '',
  }
}

export function LinesEditor({ quoteId, initialLines, initialQuantity, initialTargetMarginPct, costItems }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [lines, setLines] = useState<EditLine[]>(initialLines.map(toEdit))
  const [quantity, setQuantity] = useState(initialQuantity != null ? String(initialQuantity) : '')
  const [marginPct, setMarginPct] = useState(numToInput(initialTargetMarginPct))
  const [priceOverride, setPriceOverride] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  // wFirma
  const [wfQuery, setWfQuery] = useState('')
  const [wfPending, startWfTransition] = useTransition()
  const [wfGoods, setWfGoods] = useState<WfirmaGood[] | null>(null)
  const [wfMessage, setWfMessage] = useState<string | null>(null)

  const activeCostItems = useMemo(() => costItems.filter((c) => c.active), [costItems])

  const localCostTotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const q = parseNum(l.qty)
        const c = parseNum(l.unitCost)
        return q !== null && c !== null ? sum + q * c : sum
      }, 0),
    [lines],
  )

  const setLine = (i: number, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))

  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i))

  const addEmptyLine = () =>
    setLines((prev) => [
      ...prev,
      { kind: 'material', name: '', qty: '1', unit: 'szt', unitCost: '', costItemKey: null, notes: '' },
    ])

  const addFromCostItem = (item: CostItem) => {
    let qty = '1'
    let notes = ''
    if (item.category === 'labor' && item.throughputPerHour && item.throughputPerHour > 0) {
      const orderQty = parseNum(quantity)
      if (orderQty !== null && orderQty > 0) {
        const hours = orderQty / item.throughputPerHour
        qty = numToInput(Math.round(hours * 100) / 100)
        notes = `${orderQty} szt / ${numToInput(item.throughputPerHour)} szt/h`
      }
    }
    setLines((prev) => [
      ...prev,
      {
        kind: item.category === 'labor' ? 'labor' : item.category,
        name: item.label,
        qty,
        unit: item.unit ?? (item.category === 'labor' ? 'h' : 'szt'),
        unitCost: numToInput(item.unitCost),
        costItemKey: item.key,
        notes,
      },
    ])
    setPickerOpen(false)
  }

  const addFromWfirma = (g: WfirmaGood) => {
    setLines((prev) => [
      ...prev,
      {
        kind: 'product',
        name: g.name,
        qty: '1',
        unit: g.unit ?? 'szt',
        unitCost: numToInput(g.netto),
        costItemKey: null,
        notes: g.code ? `wFirma: ${g.code}` : 'wFirma',
      },
    ])
  }

  const onWfSearch = () => {
    if (!wfQuery.trim()) return
    startWfTransition(async () => {
      const r = await searchWfirmaGoods(wfQuery)
      if (r.ok) {
        setWfGoods(r.goods)
        setWfMessage(r.goods.length === 0 ? 'Brak wyników w wFirma.' : null)
      } else {
        setWfGoods(null)
        setWfMessage(r.message ?? 'Błąd wyszukiwania wFirma.')
      }
    })
  }

  const onSave = () =>
    startTransition(async () => {
      const payload: Parameters<typeof saveQuoteLines>[1]['lines'] = []
      for (const [i, l] of lines.entries()) {
        if (!l.name.trim()) {
          toast.error(`Pozycja ${i + 1}: podaj nazwę.`)
          return
        }
        const qty = parseNum(l.qty)
        const unitCost = parseNum(l.unitCost)
        if (qty === null || qty < 0) {
          toast.error(`Pozycja ${i + 1} („${l.name}"): niepoprawna ilość.`)
          return
        }
        if (unitCost === null || unitCost < 0) {
          toast.error(`Pozycja ${i + 1} („${l.name}"): niepoprawna cena jednostkowa.`)
          return
        }
        payload.push({
          kind: l.kind,
          name: l.name.trim(),
          qty,
          unit: l.unit.trim() || 'szt',
          unit_cost: unitCost,
          cost_item_key: l.costItemKey ?? undefined,
          notes: l.notes.trim() || undefined,
        })
      }
      const qtyNum = quantity.trim() ? parseNum(quantity) : null
      if (quantity.trim() && (qtyNum === null || qtyNum <= 0)) {
        toast.error('Ilość (szt) musi być liczbą większą od zera.')
        return
      }
      const marginNum = marginPct.trim() ? parseNum(marginPct) : null
      if (marginPct.trim() && marginNum === null) {
        toast.error('Marża docelowa musi być liczbą (%).')
        return
      }
      const overrideNum = priceOverride.trim() ? parseNum(priceOverride) : null
      if (priceOverride.trim() && (overrideNum === null || overrideNum <= 0)) {
        toast.error('Cena/szt narzucona musi być liczbą większą od zera.')
        return
      }

      const r = await saveQuoteLines(quoteId, {
        lines: payload,
        quantity: qtyNum !== null ? Math.round(qtyNum) : undefined,
        targetMarginPct: marginNum ?? undefined,
        pricePerUnitOverride: overrideNum ?? undefined,
      })
      if (r.ok && r.totals) {
        toast.success(
          `Przeliczono — koszt ${fmtZl(r.totals.costTotal)} · cena/szt ${fmtZl(r.totals.pricePerUnit)} · ` +
            `wartość ${fmtZl(r.totals.priceTotal)} · marża ${fmtMarginPct(r.totals.marginPct)}`,
          { duration: 8000 },
        )
        router.refresh()
      } else if (r.ok) {
        toast.success(r.message)
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })

  return (
    <section className="bg-white rounded-lg border">
      <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-b">
        <h2 className="text-sm font-semibold text-slate-800 inline-flex items-center gap-1.5">
          <Calculator className="h-4 w-4 text-slate-500" /> Kalkulacja
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setPickerOpen(true)}>
            <ListPlus className="h-3.5 w-3.5" /> Z cennika
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={addEmptyLine}>
            <Plus className="h-3.5 w-3.5" /> Dodaj pozycję
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-slate-600 whitespace-nowrap">Rodzaj</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 min-w-[180px]">Nazwa</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600 whitespace-nowrap">Ilość</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 whitespace-nowrap">Jedn.</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600 whitespace-nowrap">Cena jedn.</th>
              <th className="text-right px-3 py-2 font-medium text-slate-600 whitespace-nowrap">Suma</th>
              <th className="text-left px-3 py-2 font-medium text-slate-600 min-w-[120px]">Notatki</th>
              <th className="px-2 py-2 w-9"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {lines.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                  Brak pozycji — dodaj ręcznie albo z cennika.
                </td>
              </tr>
            )}
            {lines.map((l, i) => {
              const q = parseNum(l.qty)
              const c = parseNum(l.unitCost)
              const total = q !== null && c !== null ? q * c : null
              return (
                <tr key={i} className="align-top">
                  <td className="px-3 py-2">
                    <select
                      value={l.kind}
                      onChange={(e) => setLine(i, { kind: e.target.value })}
                      className="text-sm rounded-lg border border-slate-200 px-2 py-1.5 bg-white"
                    >
                      {LINE_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Input value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} className="text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={l.qty}
                      onChange={(e) => setLine(i, { qty: e.target.value })}
                      inputMode="decimal"
                      className="text-sm text-right w-20"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={l.unit}
                      onChange={(e) => setLine(i, { unit: e.target.value })}
                      className="text-sm w-16"
                      placeholder="szt"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={l.unitCost}
                      onChange={(e) => setLine(i, { unitCost: e.target.value })}
                      inputMode="decimal"
                      className="text-sm text-right w-24"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap pt-3.5">{fmtZl(total)}</td>
                  <td className="px-3 py-2">
                    <Input value={l.notes} onChange={(e) => setLine(i, { notes: e.target.value })} className="text-sm" />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      onClick={() => removeLine(i)}
                      title="Usuń pozycję"
                      className="h-8 w-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {lines.length > 0 && (
            <tfoot className="bg-slate-50 border-t">
              <tr>
                <td colSpan={5} className="px-3 py-2 text-right text-xs text-slate-500">
                  Koszt łączny (podgląd lokalny):
                </td>
                <td className="px-3 py-2 text-right font-medium text-slate-800 whitespace-nowrap">
                  {fmtZl(localCostTotal)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Parametry przeliczenia + zapis */}
      <div className="p-4 border-t space-y-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="text-xs text-slate-500">Ilość (szt)</label>
            <Input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              inputMode="numeric"
              className="mt-1 text-sm w-28"
              placeholder="np. 200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Marża docelowa %</label>
            <Input
              value={marginPct}
              onChange={(e) => setMarginPct(e.target.value)}
              inputMode="decimal"
              className="mt-1 text-sm w-28"
              placeholder="np. 40"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Cena/szt narzucona (opcjonalnie)</label>
            <Input
              value={priceOverride}
              onChange={(e) => setPriceOverride(e.target.value)}
              inputMode="decimal"
              className="mt-1 text-sm w-36"
              placeholder="puste = z marży"
            />
          </div>
          <Button onClick={onSave} disabled={pending} className="gap-1.5">
            <Calculator className="h-4 w-4" />
            {pending ? 'Przeliczam…' : 'Przelicz i zapisz'}
          </Button>
        </div>
        <p className="text-[11px] text-slate-400">
          Zapis podmienia wszystkie pozycje kalkulacji i przelicza koszt, cenę i marżę na backendzie.
        </p>

        {/* Wyszukiwarka wFirma */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <label className="text-xs text-slate-500">Szukaj ceny w wFirma</label>
          <div className="flex items-center gap-2">
            <Input
              value={wfQuery}
              onChange={(e) => setWfQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  onWfSearch()
                }
              }}
              placeholder="nazwa towaru / usługi w wFirma"
              className="text-sm w-72"
            />
            <Button variant="outline" size="sm" className="gap-1" onClick={onWfSearch} disabled={wfPending || !wfQuery.trim()}>
              <Search className="h-3.5 w-3.5" /> {wfPending ? 'Szukam…' : 'Szukaj'}
            </Button>
          </div>
          {wfMessage && <p className="text-[11px] text-slate-400">{wfMessage}</p>}
          {wfGoods && wfGoods.length > 0 && (
            <ul className="divide-y rounded-lg border border-slate-200 max-h-56 overflow-y-auto">
              {wfGoods.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="text-slate-800 truncate">{g.name}</div>
                    <div className="text-[11px] text-slate-400">
                      netto {fmtZl(g.netto)} · brutto {fmtZl(g.brutto)}
                      {g.unit ? ` / ${g.unit}` : ''}
                    </div>
                  </div>
                  <Button variant="outline" size="xs" onClick={() => addFromWfirma(g)}>
                    Wstaw jako pozycję
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Dialog: pozycje z cennika */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Wstaw pozycję z cennika</DialogTitle>
          </DialogHeader>
          {activeCostItems.length === 0 ? (
            <p className="text-sm text-slate-500">
              Cennik jest pusty — dodaj pozycje na stronie{' '}
              <Link href="/wyceny/cennik" className="text-indigo-600 hover:underline">
                Cennik
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-4">
              {['material', 'packaging', 'labor', 'transport', 'other']
                .filter((cat) => activeCostItems.some((c) => c.category === cat))
                .map((cat) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      {categoryLabel(cat)}
                    </p>
                    <ul className="divide-y rounded-lg border border-slate-200">
                      {activeCostItems
                        .filter((c) => c.category === cat)
                        .map((item) => (
                          <li key={item.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                            <div className="min-w-0">
                              <div className="text-slate-800 truncate">{item.label}</div>
                              <div className="text-[11px] text-slate-400">
                                {fmtZl(item.unitCost)}
                                {item.unit ? ` / ${item.unit}` : ''}
                                {item.throughputPerHour ? ` · wydajność ${numToInput(item.throughputPerHour)} szt/h` : ''}
                              </div>
                            </div>
                            <Button variant="outline" size="xs" onClick={() => addFromCostItem(item)}>
                              Wstaw
                            </Button>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
