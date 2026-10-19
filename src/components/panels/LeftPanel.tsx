import { useState, useEffect } from 'react'
import { PackagePlus, Cable, Zap, ListChecks, Layers, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Item, Kind } from '../../lib/store'
import { CollapsibleCard } from './RightPanel'

const PAGE_SIZE = 10

type PaletteItem = { kind: Kind; label: string; dims: string; color: string; price: number; thumb: string }

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

  const [stressUsed, setStressUsed] = useState(false)
  const [page, setPage] = useState(0)
  const totalPages = Math.max(1, Math.ceil(s.items.length / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1))
  }, [s.items.length, page, totalPages])

  const pageItems = s.items.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const armedText = s.placing ? t.armed(t[s.placing]) : null

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
                  <button onClick={() => onArm(active ? null : p.kind)}
                    className={`shrink-0 cursor-pointer whitespace-nowrap rounded-lg border-0 px-3 py-[7px] text-xs font-bold transition-all duration-150 active:scale-95 ${
                      active
                        ? 'bg-[rgba(239,68,68,0.18)] text-[#fca5a5]'
                        : 'bg-accent text-white shadow-[0_2px_8px_rgba(59,130,246,0.35)] hover:brightness-110'}`}>
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
          <button onClick={onToggleWiring}
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors duration-150 ${
              wiringMode
                ? 'border-[#f97316] bg-[#f97316] text-white'
                : 'border-line bg-panel-bg text-ink hover:border-[#f97316] hover:text-[#f97316]'}`}>
            <Zap size={14} />{t.wire} {wiringMode ? `(${t.active})` : ''}
          </button>
          <p className="m-0 text-[11px] leading-[1.4] text-hint">{wiringFrom ? t.addWire : t.wireHint}</p>
        </div>
      </CollapsibleCard>

      {/* 3 ─ Placed items */}
      <CollapsibleCard
        icon={ListChecks} tone="#14b8a6"
        title={t.items}
        subtitle={`${s.items.length}`}
        right={<span className="rounded-full bg-[rgba(20,184,166,0.16)] px-2 py-0.5 text-[11px] font-bold text-[#14b8a6] tabular-nums">{s.items.length}</span>}
        open={openKey === 'items'} onToggle={() => toggle('items')}>
        <div className="flex flex-col gap-2 p-3">
          <div className="flex gap-1.5">
            <button
              onClick={() => { s.addMany(500); setStressUsed(true) }}
              disabled={stressUsed || s.items.length >= 500}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line bg-panel-bg px-2 py-1.5 text-[11px] font-semibold text-ink-soft transition-colors duration-150 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink-soft">
              <Layers size={13} />{t.stress}
            </button>
            <button onClick={() => { s.clear(); setStressUsed(false); setPage(0) }}
              className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line bg-panel-bg px-2 py-1.5 text-[11px] font-semibold text-ink-soft transition-colors duration-150 hover:border-bad hover:text-bad">
              <Trash2 size={13} />{t.clear}
            </button>
          </div>

          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {s.items.length === 0 && <li className="px-1 py-2 text-xs text-hint">{t.empty}</li>}
            {pageItems.map((i: Item) => (
              <li key={i.id}>
                <button aria-pressed={i.id === s.selectedId} onClick={() => s.select(i.id)}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-left text-xs text-ink transition-colors duration-150 ${
                    i.id === s.selectedId ? 'border-accent bg-[rgba(59,130,246,0.15)]' : 'border-transparent hover:bg-[var(--tint-hover)]'
                  }${badIds.has(i.id) ? ' border-l-[3px] border-l-bad' : ''}`}>
                  <span className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: palette.find((p) => p.kind === i.kind)?.color ?? '#888' }} />
                  {name(i)}
                </button>
              </li>
            ))}
          </ul>

          {s.items.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-line bg-panel-bg text-ink-soft transition-colors duration-150 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-35"
                aria-label="Previous page">
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[3.5rem] text-center text-[11px] font-semibold tabular-nums text-ink-soft">
                {page + 1} / {totalPages}
              </span>
              <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
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
