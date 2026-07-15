'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Sprout } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { seedCostItems, upsertCostItems, type CostItemInput } from '@/actions/quotes'
import { COST_CATEGORIES, categoryLabel, slugifyKey, type CostItem } from '@/lib/quotes'

type EditItem = {
  key: string
  label: string
  category: string
  unit: string
  unitCost: string
  throughput: string
  notes: string
  active: boolean
  dirty: boolean
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

function toEdit(c: CostItem): EditItem {
  return {
    key: c.key,
    label: c.label,
    category: c.category,
    unit: c.unit ?? '',
    unitCost: numToInput(c.unitCost),
    throughput: numToInput(c.throughputPerHour),
    notes: c.notes ?? '',
    active: c.active,
    dirty: false,
  }
}

function toPayload(it: EditItem): CostItemInput | { error: string } {
  if (!it.label.trim()) return { error: 'Podaj etykietę pozycji.' }
  const unitCost = parseNum(it.unitCost)
  if (unitCost === null || unitCost < 0) return { error: `„${it.label}": niepoprawna cena jednostkowa.` }
  const throughput = it.throughput.trim() ? parseNum(it.throughput) : null
  if (it.throughput.trim() && (throughput === null || throughput <= 0)) {
    return { error: `„${it.label}": niepoprawna wydajność (szt/h).` }
  }
  return {
    key: it.key,
    label: it.label.trim(),
    category: it.category,
    unit: it.unit.trim() || 'szt',
    unit_cost: unitCost,
    throughput_per_hour: throughput ?? undefined,
    notes: it.notes.trim() || undefined,
    active: it.active,
  }
}

export function CennikEditor({ items }: { items: CostItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rows, setRows] = useState<EditItem[]>(items.map(toEdit))
  const [savingKey, setSavingKey] = useState<string | null>(null)

  // Formularz nowej pozycji
  const [addOpen, setAddOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newCategory, setNewCategory] = useState('material')
  const [newUnit, setNewUnit] = useState('szt')
  const [newUnitCost, setNewUnitCost] = useState('')
  const [newThroughput, setNewThroughput] = useState('')
  const [newNotes, setNewNotes] = useState('')

  const setRow = (key: string, patch: Partial<EditItem>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch, dirty: true } : r)))

  const saveRow = (key: string) => {
    const row = rows.find((r) => r.key === key)
    if (!row) return
    const payload = toPayload(row)
    if ('error' in payload) {
      toast.error(payload.error)
      return
    }
    setSavingKey(key)
    startTransition(async () => {
      const r = await upsertCostItems([payload])
      setSavingKey(null)
      if (r.ok) {
        toast.success(r.message)
        setRows((prev) => prev.map((x) => (x.key === key ? { ...x, dirty: false } : x)))
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })
  }

  const addItem = () =>
    startTransition(async () => {
      const key = slugifyKey(newLabel)
      if (!key) {
        toast.error('Podaj etykietę nowej pozycji.')
        return
      }
      if (rows.some((r) => r.key === key)) {
        toast.error(`Pozycja o kluczu „${key}" już istnieje — zmień etykietę.`)
        return
      }
      const payload = toPayload({
        key,
        label: newLabel,
        category: newCategory,
        unit: newUnit,
        unitCost: newUnitCost,
        throughput: newThroughput,
        notes: newNotes,
        active: true,
        dirty: true,
      })
      if ('error' in payload) {
        toast.error(payload.error)
        return
      }
      const r = await upsertCostItems([payload])
      if (r.ok) {
        toast.success('Pozycja dodana do cennika.')
        setAddOpen(false)
        setNewLabel('')
        setNewUnitCost('')
        setNewThroughput('')
        setNewNotes('')
        setRows((prev) => [
          ...prev,
          {
            key,
            label: newLabel.trim(),
            category: newCategory,
            unit: newUnit.trim() || 'szt',
            unitCost: newUnitCost,
            throughput: newThroughput,
            notes: newNotes,
            active: true,
            dirty: false,
          },
        ])
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })

  const onSeed = () => {
    if (!confirm('Uzupełnić cennik domyślnymi pozycjami? Istniejące pozycje nie zostaną nadpisane.')) return
    startTransition(async () => {
      const r = await seedCostItems()
      if (r.ok) {
        toast.success(r.message)
        router.refresh()
        // Odśwież lokalny stan po ponownym renderze server component
        window.location.reload()
      } else {
        toast.error(r.message)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Button className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Dodaj pozycję
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={onSeed} disabled={pending}>
          <Sprout className="h-4 w-4" /> Uzupełnij domyślnym cennikiem
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <p className="text-sm font-medium text-slate-600">Cennik jest pusty</p>
          <p className="text-xs text-slate-400 mt-1">
            Dodaj pozycje ręcznie albo użyj przycisku „Uzupełnij domyślnym cennikiem&rdquo;.
          </p>
        </div>
      ) : (
        COST_CATEGORIES.filter((cat) => rows.some((r) => r.category === cat.value)).map((cat) => (
          <section key={cat.value} className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b">
              <h2 className="text-sm font-semibold text-slate-700">{cat.label}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 min-w-[180px]">Etykieta</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 whitespace-nowrap">Jedn.</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600 whitespace-nowrap">Koszt jedn. (zł)</th>
                    <th className="text-right px-3 py-2 font-medium text-slate-600 whitespace-nowrap">Wydajność szt/h</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-600 min-w-[140px]">Notatki</th>
                    <th className="text-center px-3 py-2 font-medium text-slate-600 whitespace-nowrap">Aktywna</th>
                    <th className="px-3 py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows
                    .filter((r) => r.category === cat.value)
                    .map((r) => (
                      <tr key={r.key} className={`align-top ${r.active ? '' : 'opacity-50'}`}>
                        <td className="px-3 py-2">
                          <Input value={r.label} onChange={(e) => setRow(r.key, { label: e.target.value })} className="text-sm" />
                          <div className="text-[10px] text-slate-300 mt-0.5 font-mono">{r.key}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Input value={r.unit} onChange={(e) => setRow(r.key, { unit: e.target.value })} className="text-sm w-16" />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={r.unitCost}
                            onChange={(e) => setRow(r.key, { unitCost: e.target.value })}
                            inputMode="decimal"
                            className="text-sm text-right w-24"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={r.throughput}
                            onChange={(e) => setRow(r.key, { throughput: e.target.value })}
                            inputMode="decimal"
                            className="text-sm text-right w-24"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input value={r.notes} onChange={(e) => setRow(r.key, { notes: e.target.value })} className="text-sm" />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={r.active}
                            onChange={(e) => setRow(r.key, { active: e.target.checked })}
                            className="h-4 w-4 mt-2 accent-indigo-600"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => saveRow(r.key)}
                            disabled={!r.dirty || (pending && savingKey === r.key)}
                          >
                            {pending && savingKey === r.key ? 'Zapisuję…' : 'Zapisz'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      {/* Dialog: nowa pozycja */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nowa pozycja cennika</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500">Etykieta *</label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="np. Wstążka satynowa z nadrukiem"
                className="mt-1 text-sm"
              />
              {newLabel.trim() && (
                <p className="text-[10px] text-slate-400 mt-1 font-mono">key: {slugifyKey(newLabel)}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Kategoria</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="mt-1 w-full text-sm rounded-lg border border-slate-200 px-3 py-2 bg-white"
                >
                  {COST_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Jednostka</label>
                <Input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} className="mt-1 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Koszt jedn. (zł) *</label>
                <Input
                  value={newUnitCost}
                  onChange={(e) => setNewUnitCost(e.target.value)}
                  inputMode="decimal"
                  placeholder="np. 2,50"
                  className="mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Wydajność szt/h (robocizna)</label>
                <Input
                  value={newThroughput}
                  onChange={(e) => setNewThroughput(e.target.value)}
                  inputMode="decimal"
                  placeholder="np. 30"
                  className="mt-1 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500">Notatki</label>
              <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} className="mt-1 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <p className="text-[11px] text-slate-400 mr-auto self-center">
              Kategoria „{categoryLabel(newCategory)}&rdquo;
            </p>
            <Button onClick={addItem} disabled={pending || !newLabel.trim() || !newUnitCost.trim()}>
              {pending ? 'Zapisuję…' : 'Dodaj'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
