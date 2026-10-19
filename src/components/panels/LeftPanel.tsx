import { useState, useEffect } from 'react'
import { PackagePlus, Cable, Zap, ListChecks, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { MAX_ITEMS, type Item, type Kind } from '../../lib/store'
import { CollapsibleCard } from './RightPanel'

const PAGE_SIZE = 10

type PaletteItem = { kind: Kind; label: string; dims: string; color: string; price: number; thumb: string }

// ─── Preset targets ───────────────────────────────────────────────────────────
const PRESET_TARGETS = [500, 1000, MAX_ITEMS] as const

export default function LeftPanel({ s, t, palette, name, badIds, wiringMode, wiringFrom, onToggleWiring, onArm }: {
  s: any
  t: any
  palette: PaletteItem[]
  name: (i: Item) => string
  badIds: Set<string>
  wiringMode: boolean
  wiringFrom: string | null
  onToggleWiring: () => void
  onArm: (k: Kind | null) => void
}) {
  const [openKey, setOpenKey] = useState<string | null>('equip')
  const toggle = (k: string) => setOpenKey((cur) => (cur === k ? null : k))

  const [page, setPage]     = useState(0)
  const [custom, setCustom] = useState('')

  const count     = s.items.length
  const full      = count >= MAX_ITEMS
  const remaining = MAX_ITEMS - count
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  // ── Custom input validation ────────────────────────────────────────────────
  // Parse what the user typed — floor to integer, treat blank / non-numeric as NaN
  const parsed    = custom === '' ? NaN : Math.floor(Number(custom))
  const isNumber  = Number.isFinite(parsed) && parsed > 0
  // Load is enabled when the value is a valid integer above the current count
  const canLoad   = isNumber && parsed > count && parsed <= MAX_ITEMS
  // Show an error only when the user has typed a number that's ≤ current count
  const tooLow    = isNumber && parsed <= count

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1))
  }, [count, page, totalPages])

  const pageItems = s.items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const armedText = s.placing ? t.armed(t[s.placing]) : null

  const loadTo = (n: number) => { s.addMany(n); setPage(0) }

  // ── Preset button labels ───────────────────────────────────────────────────
  const presetLabel = (target: number) => {
    if (target >= 1000) return `${target / 1000}k`
    return String(target)
  }
  const presetTitle = (target: number) => {
    const labels: Record<number, string> = {
      500:       t.stress,
      1000:      t.stress1000,
      [MAX_ITEMS]: t.stress2000,
    }
    return labels[target] ?? `Load ${target}`
  }

  return (
    <div className="flex flex-col gap-2.5 p-2.5">

      {/* 1 ─ Equipment palette */}
      <CollapsibleCard
        icon={PackagePlus} tone="#3b82f6"
        title={t.palette}
        subtitle={armedText ?? palette.map((p) => t[p.kind]).join(' · ')}
        right={s.placing ? <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-accent" /> : undefined}
        open={openKey === 'equip'} onToggle={() => toggle('equip')}>
        <div className="flex flex-col gap-2.5 p-3">
          <div className="flex flex-col gap-2">
            {palette.map((p) => {
              const active = s.placing === p.kind
              return (
                <div key={p.kind}
                  className={`flex items-center gap-3 rounded-xl border bg-panel-bg px-2.5 py-2.5 transition-colors duration-150 ${active ? 'border-accent' : 'border-line'}`}>
                  <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg border border-line bg-[var(--thumb-bg)]">
                    <img src={p.thumb} alt="" className="h-[46px] w-[46px] object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold text-ink">{t[p.kind]}</div>
                    <div className="mt-0.5 whitespace-nowrap text-[11px] text-hint">{p.dims}</div>
                    <div className="mt-1 text-xs font-bold text-accent tabular-nums">${p.price.toLocaleString()}</div>
                  </div>
                  <button
                    onClick={() => onArm(active ? null : p.kind)}
                    disabled={full && !active}
                    className={`shrink-0 cursor-pointer whitespace-nowrap rounded-lg border-0 px-3 py-[7px] text-xs font-bold transition-all duration-150 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                      active
                        ? 'bg-[rgba(239,68,68,0.18)] text-[#fca5a5]'
                        : 'bg-accent text-white shadow-[0_2px_8px_rgba(59,130,246,0.35)] hover:brightness-110'
                    }`}>
                    {active ? t.cancelAdd : t.addToScene}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </CollapsibleCard>

      {/* 2 ─ Wiring */}
      <CollapsibleCard
        icon={Cable} tone="#f97316"
        title={t.wire}
        subtitle={wiringMode ? (wiringFrom ? t.addWire : t.wireHint) : undefined}
        right={wiringMode
          ? <span className="rounded-full bg-[rgba(249,115,22,0.18)] px-2 py-0.5 text-[10px] font-bold text-[#f97316]">{t.on}</span>
          : undefined}
        open={openKey === 'wire'} onToggle={() => toggle('wire')}>
        <div className="flex flex-col gap-2 p-3">
          <button
            onClick={onToggleWiring}
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors duration-150 ${
              wiringMode
                ? 'border-[#f97316] bg-[#f97316] text-white'
                : 'border-line bg-panel-bg text-ink hover:border-[#f97316] hover:text-[#f97316]'
            }`}>
            <Zap size={14} />{t.wire} {wiringMode ? `(${t.active})` : ''}
          </button>
          <p className="m-0 text-[11px] leading-[1.4] text-hint">{wiringFrom ? t.addWire : t.wireHint}</p>
        </div>
      </CollapsibleCard>

      {/* 3 ─ Placed items */}
      <CollapsibleCard
        icon={ListChecks} tone="#14b8a6"
        title={t.items}
        subtitle={(() => {
          if (count === 0) return t.empty.split('.')[0]
          if (count <= 30) {
            const parts = (Object.keys({ cabinet: 0, motor: 0, panel: 0 }) as Kind[])
              .map((k) => {
                const n = s.items.filter((i: Item) => i.kind === k).length
                return n ? `${n} ${t[k].toLowerCase()}` : ''
              })
              .filter(Boolean)
            return parts.join(' · ')
          }
          return `${count} ${t.items.toLowerCase()}`
        })()}
        right={
          <span className="rounded-full bg-[rgba(20,184,166,0.16)] px-2 py-0.5 text-[11px] font-bold text-[#14b8a6] tabular-nums">
            {count}
          </span>
        }
        open={openKey === 'items'} onToggle={() => toggle('items')}>

        <div className="flex flex-col gap-2 p-3">

          {/* ── Preset buttons ── */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-hint">
              {s.lang === 'vi' ? 'Tải về tổng' : 'Load to total'}
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {PRESET_TARGETS.map((target) => {
                // A button is active when the current count is exactly at this target.
                const isActive   = count === target
                // A button is disabled when we're already at or past the target, or the room is full.
                const isDisabled = count >= target || full
                return (
                  <button
                    key={target}
                    disabled={isDisabled}
                    onClick={() => loadTo(target)}
                    aria-pressed={isActive}
                    title={presetTitle(target)}
                    className={[
                      'flex items-center justify-center rounded-lg border py-1.5 text-[13px] font-bold tabular-nums transition-colors duration-150',
                      isActive
                        ? 'border-accent bg-accent text-white'
                        : isDisabled
                          ? 'cursor-not-allowed border-line bg-panel-bg text-ink-soft opacity-35'
                          : 'cursor-pointer border-line bg-panel-bg text-ink-soft hover:border-accent hover:text-accent',
                    ].join(' ')}>
                    {presetLabel(target)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Custom count input ── */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={MAX_ITEMS}
                value={custom}
                placeholder={t.customLabel}
                disabled={full}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canLoad) { loadTo(parsed); setCustom('') } }}
                style={{
                  width: 0,
                  borderColor: tooLow ? 'var(--bad)' : undefined,
                  color:       tooLow ? 'var(--bad)' : undefined,
                }}
                className="h-8 min-w-0 flex-1 text-xs"
              />
              <button
                disabled={!canLoad}
                onClick={() => { loadTo(parsed); setCustom('') }}
                className="h-8 w-16 shrink-0 cursor-pointer rounded-lg border-0 bg-accent text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
                {t.load}
              </button>
            </div>
            {/* Inline hint: shows remaining capacity normally, error when value is too low */}
            <p className={`m-0 text-[11px] ${tooLow ? 'text-bad' : 'text-hint'}`}>
              {tooLow
                ? (s.lang === 'vi'
                    ? `Đã có ${count} thiết bị — nhập số lớn hơn`
                    : `Already at ${count} — type a number above ${count}`)
                : full
                  ? t.itemsFull
                  : t.remaining(remaining)}
            </p>
          </div>

          {/* ── Clear ── */}
          <button
            onClick={() => { s.clear(); setPage(0); setCustom('') }}
            className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line bg-panel-bg px-2 py-1.5 text-[11px] font-semibold text-ink-soft transition-colors duration-150 hover:border-bad hover:text-bad">
            <Trash2 size={13} />{t.clear}
          </button>

          {/* ── Item list ── */}
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {count === 0 && (
              <li className="px-1 py-2 text-xs text-hint">{t.empty}</li>
            )}
            {pageItems.map((i: Item) => (
              <li key={i.id}>
                <button
                  aria-pressed={i.id === s.selectedId}
                  onClick={() => s.select(i.id)}
                  className={[
                    'flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-left text-xs text-ink transition-colors duration-150',
                    i.id === s.selectedId
                      ? 'border-accent bg-[rgba(59,130,246,0.15)]'
                      : 'border-transparent hover:bg-[var(--tint-hover)]',
                    badIds.has(i.id) ? 'border-l-[3px] border-l-bad' : '',
                  ].join(' ')}>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: palette.find((p) => p.kind === i.kind)?.color ?? '#888' }}
                  />
                  {name(i)}
                </button>
              </li>
            ))}
          </ul>

          {/* ── Pagination ── */}
          {count > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line bg-panel-bg text-ink-soft transition-colors duration-150 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Previous page">
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[3.5rem] text-center text-[11px] font-semibold tabular-nums text-ink-soft">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line bg-panel-bg text-ink-soft transition-colors duration-150 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Next page">
                <ChevronRight size={16} />
              </button>
            </div>
          )}

        </div>
      </CollapsibleCard>
    </div>
  )
}
