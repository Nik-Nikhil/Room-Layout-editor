import { useState, useRef, useEffect, type ReactNode } from 'react'
import {
  Server, Cog, Gauge, Move3d, Ruler, RotateCw, Palette, Cable, Trash2,
  ChevronDown, Unplug, MousePointerClick, Zap, ArrowRight, Box, Pencil, Check, X,
} from 'lucide-react'
import { GRID, KINDS, INDUSTRY_COLORS, WIRE_COLORS, type Item, type Kind, type Wire } from '../../lib/store'
import { COLORABLE_KINDS } from '../scene/Items'

const KIND_META: Record<Kind, { icon: typeof Box; color: string }> = {
  cabinet: { icon: Server, color: '#1a6bbf' },
  motor:   { icon: Cog,    color: '#1a5faa' },
  panel:   { icon: Gauge,  color: '#6b6b82' },
}

function Section({ icon: Icon, title, summary, badge, open, onToggle, children }: {
  icon: typeof Box; title: string; summary?: string; badge?: number
  open: boolean; onToggle: () => void; children: ReactNode
}) {
  return (
    <div className="border-b border-line last:border-b-0">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="group flex w-full items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer bg-transparent border-0 transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ${open ? 'bg-accent text-white' : 'bg-[rgba(59,130,246,0.14)] text-accent'}`}>
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-ink">{title}</span>
          {!open && summary && <span className="block truncate text-[11px] text-hint tabular-nums">{summary}</span>}
        </span>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-[rgba(59,130,246,0.15)] px-1.5 py-0.5 text-[10px] font-bold text-accent tabular-nums">{badge}</span>
        )}
        <ChevronDown size={16} className={`shrink-0 text-ink-soft transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-0.5">{children}</div>
        </div>
      </div>
    </div>
  )
}

function AxisInput({ axis, value, onChange }: { axis: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center overflow-hidden rounded-lg border border-line bg-surface-2 focus-within:border-accent">
      <span className="flex h-8 w-7 items-center justify-center bg-white/[0.05] text-[11px] font-bold text-ink-soft">{axis}</span>
      <input type="number" step={GRID.cell} value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="h-8 w-full min-w-0 border-0 bg-transparent px-2 text-xs text-ink tabular-nums outline-none" />
      <span className="pr-2 text-[10px] text-hint">m</span>
    </label>
  )
}

function Swatches({ colors, value, onPick }: {
  colors: ReadonlyArray<{ hex: string; label: string }>; value: string; onPick: (hex: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button key={c.hex} title={c.label} aria-label={c.label} aria-pressed={value === c.hex}
          className="swatch" onClick={() => onPick(c.hex)}
          style={{ background: c.hex, outline: value === c.hex ? '3px solid var(--swatch-ring)' : '2px solid transparent' }} />
      ))}
    </div>
  )
}

function IconBtn({ icon: Icon, label, onClick, danger }: {
  icon: typeof Box; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className={`flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold cursor-pointer transition-colors duration-150 ${
        danger
          ? 'border-bad/50 bg-transparent text-bad hover:bg-bad hover:text-white'
          : 'border-line bg-surface-2 text-ink hover:border-accent hover:text-accent'}`}>
      <Icon size={14} />{label}
    </button>
  )
}

function RenameField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
  const inputRef              = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.select() }, [editing])
  useEffect(() => { if (!editing) setDraft(value) }, [value, editing])

  const commit = () => { onCommit(draft.trim() || value); setEditing(false) }
  const cancel = () => { setDraft(value); setEditing(false) }

  if (editing) {
    return (
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <input ref={inputRef} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          className="h-7 flex-1 min-w-0 rounded-md border border-accent bg-surface-2 px-2 text-[13px] font-semibold text-ink outline-none"
          maxLength={40} />
        <button onClick={commit} className="h-6 w-6 flex items-center justify-center rounded-md border-0 bg-accent text-white cursor-pointer hover:brightness-110">
          <Check size={12} />
        </button>
        <button onClick={cancel} className="h-6 w-6 flex items-center justify-center rounded-md border border-line bg-transparent text-ink-soft cursor-pointer hover:border-bad hover:text-bad">
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 flex-1 min-w-0 group">
      <span className="truncate text-[13px] font-semibold text-ink flex-1">{value}</span>
      <button onClick={() => setEditing(true)} title="Rename"
        className="h-6 w-6 flex items-center justify-center rounded-md border-0 bg-transparent text-hint cursor-pointer opacity-0 group-hover:opacity-100 hover:text-accent transition-opacity duration-150">
        <Pencil size={12} />
      </button>
    </div>
  )
}

export default function SelectionPanel({ sel, selWire, s, name, t }: {
  sel?: Item
  selWire?: Wire
  s: any
  name: (i: Item) => string
  t: any
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  if (!sel && !selWire) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.05] text-hint">
          <MousePointerClick size={20} />
        </span>
        <p className="text-xs text-hint">{t.selectHint}</p>
      </div>
    )
  }

  if (selWire) {
    const from  = s.items.find((i: Item) => i.id === selWire.fromId)
    const to    = s.items.find((i: Item) => i.id === selWire.toId)
    const color = selWire.color ?? WIRE_COLORS[0].hex
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-3 py-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: color }}>
            <Cable size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-ink">{t.wire} #{selWire.id.split('-')[1]}</div>
            <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-hint">
              {from ? name(from) : '?'} <ArrowRight size={11} /> {to ? name(to) : '?'}
            </div>
          </div>
          <IconBtn icon={Unplug} label={t.disconnect} danger onClick={() => s.removeWire(selWire.id)} />
        </div>

        <Section icon={Zap} title={t.endpoints} summary={`${from ? name(from) : '?'} → ${to ? name(to) : '?'}`}
          open={!!open.ends} onToggle={() => toggle('ends')}>
          <div className="flex flex-col gap-1.5">
            {[from, to].map((it, idx) => it && (
              <button key={it.id} onClick={() => s.select(it.id)}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-left text-xs text-ink cursor-pointer hover:border-accent">
                <span className="text-[10px] font-bold text-hint">{idx === 0 ? t.from.toUpperCase() : t.to.toUpperCase()}</span>
                {name(it)}
              </button>
            ))}
          </div>
        </Section>

        <Section icon={Palette} title={t.color} open={!!open.color} onToggle={() => toggle('color')}
          summary={WIRE_COLORS.find((c) => c.hex === color)?.label}>
          <Swatches colors={WIRE_COLORS} value={color} onPick={(hex) => s.updateWire(selWire.id, { color: hex })} />
        </Section>
      </div>
    )
  }

  const item = sel!
  const meta = KIND_META[item.kind]
  const KindIcon = meta.icon
  const dims = KINDS[item.kind]
  const rot  = item.rot ?? 0
  const colorable = COLORABLE_KINDS.includes(item.kind)
  const cw: Wire[] = s.wires.filter((w: Wire) => w.fromId === item.id || w.toId === item.id)
  const displayName = item.label || name(item)

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-3 py-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: meta.color }}>
          <KindIcon size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <RenameField value={displayName}
            onCommit={(newLabel) => s.update(item.id, { label: newLabel }, 'Renamed')} />
          <div className="mt-0.5 truncate text-[11px] text-hint">{item.id}</div>
        </div>
      </div>

      <div className="flex gap-1.5 border-b border-line px-3 py-2">
        <IconBtn icon={Trash2} label={t.del} danger onClick={() => s.remove(item.id)} />
      </div>

      <Section icon={Move3d} title={t.position} summary={`X ${item.x} · Z ${item.z} m`}
        open={!!open.pos} onToggle={() => toggle('pos')}>
        <div className="grid grid-cols-2 gap-2">
          <AxisInput axis="X" value={item.x} onChange={(x) => s.update(item.id, { x }, 'Moved')} />
          <AxisInput axis="Z" value={item.z} onChange={(z) => s.update(item.id, { z }, 'Moved')} />
        </div>
      </Section>

      <Section icon={RotateCw} title={t.rotation} summary={`${rot}°`}
        open={!!open.rot} onToggle={() => toggle('rot')}>
        <div className="flex items-center gap-2">
          <input type="range" min={0} max={359} step={1} value={rot}
            onChange={(e) => s.update(item.id, { rot: +e.target.value }, 'Rotated')}
            className="flex-1 cursor-pointer" style={{ accentColor: 'var(--accent)' }} />
          <input type="text" inputMode="numeric" value={rot}
            onChange={(e) => {
              const v = (((parseInt(e.target.value, 10) || 0) % 360) + 360) % 360
              s.update(item.id, { rot: v }, 'Rotated')
            }}
            className="h-8 w-14 rounded-lg border border-line bg-surface-2 px-2 text-center text-xs text-ink tabular-nums outline-none focus:border-accent" />
        </div>
      </Section>

      <Section icon={Ruler} title={t.dimensions} summary={`${dims.w} × ${dims.d} × ${dims.h} m`}
        open={!!open.dim} onToggle={() => toggle('dim')}>
        <div className="grid grid-cols-3 gap-1.5">
          {([[t.width, 'w'], [t.depth, 'd'], [t.height, 'h']] as [string, 'w'|'d'|'h'][]).map(([label, k]) => (
            <div key={k} className="rounded-lg border border-line bg-surface-2 px-2 py-1.5">
              <div className="text-[10px] text-hint">{label}</div>
              <div className="text-xs font-semibold text-ink tabular-nums">{dims[k]} m</div>
            </div>
          ))}
        </div>
      </Section>

      {colorable && (
        <Section icon={Palette} title={t.color}
          summary={INDUSTRY_COLORS.find((c) => c.hex === item.color)?.label ?? t.defaultColor}
          open={!!open.color} onToggle={() => toggle('color')}>
          <Swatches colors={INDUSTRY_COLORS} value={item.color ?? ''} onPick={(hex) => s.update(item.id, { color: hex }, 'Recolored')} />
        </Section>
      )}

      <Section icon={Cable} title={t.connections} badge={cw.length}
        summary={cw.length ? t.wireCount(cw.length) : t.noneLabel}
        open={!!open.conn} onToggle={() => toggle('conn')}>
        {cw.length === 0 ? (
          <p className="text-xs text-hint">{t.noWiresYet}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {cw.map((w) => {
              const otherId = w.fromId === item.id ? w.toId : w.fromId
              const other = s.items.find((i: Item) => i.id === otherId)
              return (
                <li key={w.id} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: w.color ?? WIRE_COLORS[0].hex }} />
                  <button onClick={() => s.selectWire(w.id)} className="flex-1 truncate border-0 bg-transparent p-0 text-left text-ink cursor-pointer hover:text-accent">
                    {other ? (other.label || name(other)) : otherId}
                  </button>
                  <button onClick={() => s.removeWire(w.id)} title={t.disconnect} aria-label={t.disconnect}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-transparent text-ink-soft cursor-pointer hover:border-bad hover:text-bad">
                    <Unplug size={13} />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
