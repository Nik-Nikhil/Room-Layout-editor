import { useState, type ReactNode } from 'react'
import {
  ChevronDown, ShieldCheck, ShieldAlert, MousePointer2, Ruler, ReceiptText, Box, Cable,
} from 'lucide-react'
import { KINDS, type Item, type Kind, type Wire } from '../../lib/store'
import SelectionPanel from './SelectionPanel'

const FX = { INR: 95.0, VND: 25_850 }

const fmtUSD = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtINR = (n: number) =>
  n.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const fmtVND = (n: number) =>
  n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 })

// ─── Collapsible card ─────────────────────────────────────────────────────────
export function CollapsibleCard({ icon: Icon, tone, title, subtitle, right, open, onToggle, children }: {
  icon: typeof Box
  tone: string
  title: string
  subtitle?: string
  right?: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <section className={`overflow-hidden rounded-xl border bg-surface-2 transition-colors duration-150 ${open ? 'border-accent/60' : 'border-line'}`}>
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full items-center gap-3 border-0 bg-transparent px-3 py-3 text-left cursor-pointer transition-colors duration-150 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: `${tone}26`, color: tone, boxShadow: `inset 0 0 0 1px ${tone}40` }}>
          <Icon size={18} strokeWidth={2.1} />
        </span>
        <span className="min-w-0 flex-1 overflow-hidden">
          <span className="block truncate text-[13px] font-semibold leading-tight text-ink">{title}</span>
          {subtitle && <span className="mt-0.5 block truncate text-[11px] text-hint tabular-nums">{subtitle}</span>}
        </span>
        {right && <span className="max-w-[40%] shrink-0 truncate">{right}</span>}
        <ChevronDown size={17} className={`shrink-0 text-ink-soft transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}>
        <div className="overflow-hidden">
          <div className="border-t border-line">{children}</div>
        </div>
      </div>
    </section>
  )
}

export default function RightPanel({ s, t, bad, sel, selWire, name, roomSize }: {
  s: any
  t: any
  bad: Array<{ a: Item; b: Item; gap: number }>
  sel?: Item
  selWire?: Wire
  name: (i: Item) => string
  roomSize: ReactNode
}) {
  const [openKey, setOpenKey] = useState<string | null>(null)
  const toggle = (k: string) => setOpenKey((cur) => (cur === k ? null : k))

  const hasBad = bad.length > 0
  const selTitle = sel ? name(sel) : selWire ? `${t.wire} #${selWire.id.split('-')[1]}` : t.nothingSelected
  const SelIcon = selWire && !sel ? Cable : MousePointer2

  const kinds = Object.keys(KINDS) as Kind[]
  const rows = kinds.map((k) => {
    const qty = s.items.filter((i: Item) => i.kind === k).length
    const unit = KINDS[k].price
    return { k, qty, unit, line: qty * unit }
  })
  const totalUSD = rows.reduce((n, r) => n + r.line, 0)
  const totalINR = totalUSD * FX.INR
  const totalVND = totalUSD * FX.VND

  const costTitle = s.lang === 'vi' ? 'Chi phí' : 'Cost'
  const costSub = s.items.length === 0
    ? (s.lang === 'vi' ? 'Chưa có thiết bị' : 'No items yet')
    : `${s.items.length} ${s.lang === 'vi' ? 'thiết bị' : 'items'}`

  return (
    <div className="flex flex-col gap-2.5 p-2.5">
      {/* 1 ─ Clearance check */}
      <CollapsibleCard
        icon={hasBad ? ShieldAlert : ShieldCheck}
        tone={hasBad ? '#ef4444' : '#22c55e'}
        title={t.clearanceCheck}
        subtitle={hasBad ? t.spacingIssue(bad.length) : undefined}
        right={hasBad
          ? <span className="rounded-full bg-[rgba(239,68,68,0.15)] px-2 py-0.5 text-[11px] font-semibold text-bad whitespace-nowrap">⚠ {bad.length}</span>
          : <span className="rounded-full bg-[rgba(34,197,94,0.15)] px-2 py-0.5 text-[11px] font-semibold text-good whitespace-nowrap">✓ {s.lang === 'vi' ? 'Đạt' : 'OK'}</span>}
        open={openKey === 'clear'} onToggle={() => toggle('clear')}>
        <div className="p-3">
          {!hasBad
            ? <p className="text-xs text-hint">{t.ok}</p>
            : <ul className="m-0 flex max-h-40 list-none flex-col gap-1.5 overflow-y-auto p-0">
                {bad.slice(0, 20).map((v) => (
                  <li key={v.a.id + v.b.id} className="border-l-2 border-bad pl-2 text-xs leading-[1.4] text-bad">
                    {t.close(name(v.a), name(v.b), v.gap)}
                  </li>
                ))}
              </ul>}
        </div>
      </CollapsibleCard>

      {/* 2 ─ Selection */}
      <CollapsibleCard
        icon={SelIcon} tone="#3b82f6"
        title={sel ? t.selectedItem : selWire ? t.selectedWire : t.selection}
        subtitle={selTitle}
        open={openKey === 'sel'} onToggle={() => toggle('sel')}>
        <SelectionPanel sel={sel} selWire={selWire} s={s} name={name} t={t} />
      </CollapsibleCard>

      {/* 3 ─ Room size */}
      <CollapsibleCard
        icon={Ruler} tone="#a78bfa"
        title={t.roomSize} subtitle={`${s.roomW} m × ${s.roomD} m`}
        open={openKey === 'room'} onToggle={() => toggle('room')}>
        <div className="p-3">{roomSize}</div>
      </CollapsibleCard>

      {/* 4 ─ Cost (USD · INR · VND) */}
      <CollapsibleCard
        icon={ReceiptText} tone="#f59e0b"
        title={costTitle}
        subtitle={costSub}
        right={<span className="text-[12px] font-bold text-accent tabular-nums whitespace-nowrap">{fmtUSD(totalUSD)}</span>}
        open={openKey === 'cost'} onToggle={() => toggle('cost')}>
        <div className="p-3 flex flex-col gap-2.5">
          <ul className="m-0 list-none p-0 divide-y divide-[var(--line)]">
            {rows.map(({ k, qty, unit, line }) => (
              <li key={k} className={`flex items-center gap-2 py-2 ${qty ? '' : 'opacity-45'}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-ink">{t[k] ?? k}</div>
                  <div className="text-[11px] text-hint tabular-nums">{fmtUSD(unit)} × {qty}</div>
                </div>
                <div className={`text-right text-xs tabular-nums ${qty ? 'font-semibold text-ink' : 'text-hint'}`}>
                  {qty ? fmtUSD(line) : '—'}
                </div>
              </li>
            ))}
          </ul>
          <div className="rounded-lg border border-line bg-panel-bg p-2.5 flex flex-col gap-1.5">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[11px] font-semibold text-hint">USD</span>
              <span className="text-sm font-bold text-accent tabular-nums">{fmtUSD(totalUSD)}</span>
            </div>
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[11px] font-semibold text-hint">INR</span>
              <span className="text-sm font-bold text-ink tabular-nums">{fmtINR(totalINR)}</span>
            </div>
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[11px] font-semibold text-hint">VND</span>
              <span className="text-sm font-bold text-ink tabular-nums">{fmtVND(totalVND)}</span>
            </div>
          </div>
          <p className="m-0 text-[10px] text-hint leading-snug">
            {s.lang === 'vi'
              ? `Tỷ giá tham khảo: 1 USD ≈ ${FX.INR} INR ≈ ${FX.VND.toLocaleString('vi-VN')} VND`
              : `Ref. rates: 1 USD ≈ ${FX.INR} INR ≈ ${FX.VND.toLocaleString('en-US')} VND`}
          </p>
        </div>
      </CollapsibleCard>
    </div>
  )
}
