import { createSlice, createSelector, configureStore } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { useMemo, useSyncExternalStore } from 'react'
import type { Lang } from './i18n'   // same folder — no path change needed

// ─── Domain types ─────────────────────────────────────────────────────────────

export type Kind = 'cabinet' | 'motor' | 'panel'

export const KINDS: Record<Kind, { w: number; d: number; h: number; color: string; price: number }> = {
  cabinet: { w: 1.20, d: 0.77, h: 2.05, color: '#1a6bbf', price: 4200 },
  motor:   { w: 1.44, d: 0.67, h: 1.19, color: '#1a5faa', price: 2800 },
  panel:   { w: 1.00, d: 0.44, h: 1.79, color: '#4a4a5a', price: 3500 },
}

export const GRID = { w: 20, d: 12, cell: 0.5, minGap: 0.6 }
export const ROOM_LIMITS = { minW: 5, maxW: 80, minD: 5, maxD: 60 }

// Mutable room dimensions — kept in sync with Redux state for non-React callers
export const ROOM = { w: GRID.w, d: GRID.d }

export interface Item {
  id: string
  kind: Kind
  num: number
  x: number
  z: number
  rot: number
  color?: string
  label?: string   // user-editable display name (falls back to kind + num)
}

export interface Wire {
  id: string
  fromId: string
  toId: string
  color?: string
}

// 2 industrial colors for motors
export const INDUSTRY_COLORS = [
  { hex: '#c8c8c8', label: 'RAL 7035 Light Grey' },
  { hex: '#4e6b8c', label: 'RAL 5014 Pigeon Blue' },
] as const

// 3 cable colors for wires
export const WIRE_COLORS = [
  { hex: '#f0a500', label: 'Cable Yellow' },
  { hex: '#e53935', label: 'Power Red'    },
  { hex: '#1677ff', label: 'Control Blue' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const snap = (v: number) => Math.round(v / GRID.cell) * GRID.cell

export const footprint = (i: Item) => {
  const k    = KINDS[i.kind]
  const norm = ((i.rot % 180) + 180) % 180
  return norm > 45 && norm <= 135 ? { w: k.d, d: k.w } : { w: k.w, d: k.d }
}

function clamp(item: Item, roomW: number, roomD: number): Item {
  const f  = footprint(item)
  const mx = roomW / 2 - f.w / 2
  const mz = roomD / 2 - f.d / 2
  return {
    ...item,
    x: Math.max(-mx, Math.min(mx, snap(item.x))),
    z: Math.max(-mz, Math.min(mz, snap(item.z))),
  }
}

export interface Violation { a: Item; b: Item; gap: number }

export function violations(items: Item[]): Violation[] {
  const out: Violation[] = []
  for (let i = 0; i < items.length; i++) {
    const a = items[i], fa = footprint(a)
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j], fb = footprint(b)
      const gx = Math.abs(a.x - b.x) - (fa.w + fb.w) / 2
      const gz = Math.abs(a.z - b.z) - (fa.d + fb.d) / 2
      if (gx >= GRID.minGap || gz >= GRID.minGap) continue
      const gap = Math.hypot(Math.max(gx, 0), Math.max(gz, 0))
      if (gap < GRID.minGap) out.push({ a, b, gap })
    }
  }
  return out
}

// ─── History entry ────────────────────────────────────────────────────────────

interface Entry {
  label: string
  before: Item[];      beforeWires: Wire[]
  after:  Item[];      afterWires:  Wire[]
}

// ─── Slice state ──────────────────────────────────────────────────────────────

interface SceneState {
  items:          Item[]
  wires:          Wire[]
  selectedId:     string | null
  selectedWireId: string | null
  placing:        Kind | null
  dragId:         string | null
  past:           Entry[]
  future:         Entry[]
  lang:           Lang
  announce:       string
  roomW:          number
  roomD:          number
  // transient drag snapshot (not part of undo history mid-drag)
  _dragBefore:      Item[]  | null
  _dragBeforeWires: Wire[]  | null
}

// Monotone counters — module-level so they survive slice re-creation
let _seq = 0
const _kindSeq: Record<Kind, number> = { cabinet: 0, motor: 0, panel: 0 }
const MAX_HISTORY = 50

function pushHistory(state: SceneState, label: string, after: Item[], afterWires?: Wire[]) {
  const entry: Entry = {
    label,
    before:      state.items,
    beforeWires: state.wires,
    after,
    afterWires: afterWires ?? state.wires,
  }
  state.past.push(entry)
  if (state.past.length > MAX_HISTORY) state.past.shift()
  state.future = []
  state.items  = after
  state.wires  = afterWires ?? state.wires
  state.announce = label
}

const initialState: SceneState = {
  items:          [],
  wires:          [],
  selectedId:     null,
  selectedWireId: null,
  placing:        null,
  dragId:         null,
  past:           [],
  future:         [],
  lang:           'en',
  announce:       '',
  roomW:          GRID.w,
  roomD:          GRID.d,
  _dragBefore:      null,
  _dragBeforeWires: null,
}

// ─── Slice ────────────────────────────────────────────────────────────────────

const sceneSlice = createSlice({
  name: 'scene',
  initialState,
  reducers: {
    select(state, action: PayloadAction<string | null>) {
      state.selectedId     = action.payload
      state.selectedWireId = null
    },
    selectWire(state, action: PayloadAction<string | null>) {
      state.selectedWireId = action.payload
      state.selectedId     = null
    },
    arm(state, action: PayloadAction<Kind | null>) {
      state.placing    = action.payload
      state.selectedId = null
    },
    cancelPlacing(state) {
      state.placing = null
    },
    place(state, action: PayloadAction<{ x: number; z: number }>) {
      if (!state.placing) return
      const kind = state.placing
      const num  = ++_kindSeq[kind]
      const item = clamp(
        { id: `${kind}-${++_seq}`, num, kind, x: action.payload.x, z: action.payload.z, rot: 0 },
        state.roomW, state.roomD,
      )
      pushHistory(state, `Placed ${item.id}`, [...state.items, item])
      state.selectedId = item.id
      state.placing    = null
    },
    updateItem(
      state,
      action: PayloadAction<{ id: string; patch: Partial<Item>; label?: string }>,
    ) {
      const { id, patch, label = 'Edited' } = action.payload
      const next = state.items.map((i) =>
        i.id === id ? clamp({ ...i, ...patch }, state.roomW, state.roomD) : i,
      )
      pushHistory(state, `${label} ${id}`, next)
    },
    removeItem(state, action: PayloadAction<string>) {
      const id        = action.payload
      const nextItems = state.items.filter((i) => i.id !== id)
      const nextWires = state.wires.filter((w) => w.fromId !== id && w.toId !== id)
      pushHistory(state, `Deleted ${id}`, nextItems, nextWires)
      state.selectedId = null
    },
        addMany(state, action: PayloadAction<number>) {
      const count = action.payload
      const kinds = Object.keys(KINDS) as Kind[]
      const gap = GRID.minGap

      // Largest footprint (accounts for 0°/90° rotation in the stress layout)
      let maxW = 0, maxD = 0
      for (const k of kinds) {
        maxW = Math.max(maxW, KINDS[k].w, KINDS[k].d)
        maxD = Math.max(maxD, KINDS[k].w, KINDS[k].d)
      }
      const stepX = maxW + gap   // center-to-center so edges stay ≥ gap apart
      const stepZ = maxD + gap

      const cols = Math.ceil(Math.sqrt(count))
      const rows = Math.ceil(count / cols)

      // Grow room so the whole grid fits (snap to 0.5 m)
      const needW = cols * stepX + maxW
      const needD = rows * stepZ + maxD
      const roomW = Math.min(
        ROOM_LIMITS.maxW,
        Math.max(state.roomW, Math.ceil(needW / GRID.cell) * GRID.cell),
      )
      const roomD = Math.min(
        ROOM_LIMITS.maxD,
        Math.max(state.roomD, Math.ceil(needD / GRID.cell) * GRID.cell),
      )

      state.roomW = roomW
      state.roomD = roomD
      ROOM.w = roomW
      ROOM.d = roomD

      const originX = -roomW / 2 + stepX / 2
      const originZ = -roomD / 2 + stepZ / 2

      const extra: Item[] = []
      for (let k = 0; k < count; k++) {
        const kind = kinds[k % kinds.length]
        const num  = ++_kindSeq[kind]
        const col  = k % cols
        const row  = Math.floor(k / cols)
        extra.push(
          clamp(
            {
              id:  `${kind}-${++_seq}`,
              num,
              kind,
              rot: 0,
              x:   originX + col * stepX,
              z:   originZ + row * stepZ,
            },
            roomW,
            roomD,
          ),
        )
      }
      pushHistory(state, `Added ${count} items`, [...state.items, ...extra])
    },
    clearScene(state) {
      _kindSeq.cabinet = 0; _kindSeq.motor = 0; _kindSeq.panel = 0
      _seq = 0
      pushHistory(state, 'Cleared scene', [], [])
      state.selectedId     = null
      state.selectedWireId = null
    },
    beginDrag(state, action: PayloadAction<string>) {
      state._dragBefore      = state.items
      state._dragBeforeWires = state.wires
      state.dragId           = action.payload
      state.selectedId       = action.payload
    },
    dragTo(state, action: PayloadAction<{ x: number; z: number }>) {
      if (!state.dragId) return
      state.items = state.items.map((i) =>
        i.id === state.dragId
          ? clamp({ ...i, x: action.payload.x, z: action.payload.z }, state.roomW, state.roomD)
          : i,
      )
    },
    endDrag(state) {
      const before      = state._dragBefore
      const beforeWires = state._dragBeforeWires
      state._dragBefore      = null
      state._dragBeforeWires = null
      if (!state.dragId || !before) { state.dragId = null; return }
      const moved = before !== state.items &&
        before.some((b, k) => b !== state.items[k])
      if (moved) {
        const entry: Entry = {
          label:       `Moved ${state.dragId}`,
          before,
          beforeWires: beforeWires!,
          after:       state.items,
          afterWires:  state.wires,
        }
        state.past.push(entry)
        if (state.past.length > MAX_HISTORY) state.past.shift()
        state.future   = []
        state.announce = `Moved ${state.dragId}`
      }
      state.dragId = null
    },
    undo(state) {
      const e = state.past[state.past.length - 1]
      if (!e) return
      state.past.pop()
      state.future.unshift(e)
      state.items    = e.before
      state.wires    = e.beforeWires
      state.announce = `Undid: ${e.label}`
    },
    redo(state) {
      const e = state.future[0]
      if (!e) return
      state.future.shift()
      state.past.push(e)
      state.items    = e.after
      state.wires    = e.afterWires
      state.announce = `Redid: ${e.label}`
    },
    setLang(state, action: PayloadAction<Lang>) {
      state.lang = action.payload
    },
     setRoomSize(state, action: PayloadAction<{ w: number; d: number }>) {
      const w = Math.min(ROOM_LIMITS.maxW, Math.max(ROOM_LIMITS.minW, action.payload.w))
      const d = Math.min(ROOM_LIMITS.maxD, Math.max(ROOM_LIMITS.minD, action.payload.d))
      state.roomW = w
      state.roomD = d
      ROOM.w = w
      ROOM.d = d
      state.items = state.items.map((i) => clamp(i, w, d))
    },
    addWire(state, action: PayloadAction<{ fromId: string; toId: string }>) {
      const { fromId, toId } = action.payload
      const exists = state.wires.some(
        (w) =>
          (w.fromId === fromId && w.toId === toId) ||
          (w.fromId === toId   && w.toId === fromId),
      )
      if (exists) return
      const wire: Wire = { id: `wire-${++_seq}`, fromId, toId, color: WIRE_COLORS[0].hex }
      pushHistory(state, `Wired ${fromId}→${toId}`, state.items, [...state.wires, wire])
    },
    removeWire(state, action: PayloadAction<string>) {
      const nextWires = state.wires.filter((w) => w.id !== action.payload)
      pushHistory(state, `Disconnected ${action.payload}`, state.items, nextWires)
      state.selectedWireId = null
    },
    updateWire(state, action: PayloadAction<{ id: string; patch: Partial<Wire> }>) {
      const { id, patch } = action.payload
      const next = state.wires.map((w) => (w.id === id ? { ...w, ...patch } : w))
      pushHistory(state, `Wire color ${id}`, state.items, next)
    },
  },
})

// ─── Redux store ──────────────────────────────────────────────────────────────

export const reduxStore = configureStore({
  reducer: { scene: sceneSlice.reducer },
  middleware: (getDefault) =>
    getDefault({ serializableCheck: false }), // history entries hold plain objects — fine
})

export type RootState   = ReturnType<typeof reduxStore.getState>
export type AppDispatch = typeof reduxStore.dispatch

// ─── Actions (named exports for consumers) ───────────────────────────────────

export const {
  select,
  selectWire,
  arm,
  cancelPlacing,
  place,
  updateItem,
  removeItem,
  addMany,
  clearScene,
  beginDrag,
  dragTo,
  endDrag,
  undo,
  redo,
  setLang,
  setRoomSize,
  addWire,
  removeWire,
  updateWire,
} = sceneSlice.actions

// ─── Selectors ────────────────────────────────────────────────────────────────

export const selectScene      = (s: RootState) => s.scene
export const selectItems      = (s: RootState) => s.scene.items
export const selectWires      = (s: RootState) => s.scene.wires
export const selectSelectedId = (s: RootState) => s.scene.selectedId
export const selectWireId     = (s: RootState) => s.scene.selectedWireId
export const selectPlacing    = (s: RootState) => s.scene.placing
export const selectDragId     = (s: RootState) => s.scene.dragId
export const selectLang       = (s: RootState) => s.scene.lang
export const selectRoomW      = (s: RootState) => s.scene.roomW
export const selectRoomD      = (s: RootState) => s.scene.roomD
export const selectAnnounce   = (s: RootState) => s.scene.announce
export const selectPastLen    = (s: RootState) => s.scene.past.length
export const selectFutureLen  = (s: RootState) => s.scene.future.length

export const selectSelectedItem = createSelector(
  selectItems, selectSelectedId,
  (items, id) => (id ? items.find((i) => i.id === id) : undefined),
)
export const selectSelectedWire = createSelector(
  selectWires, selectWireId,
  (wires, id) => (id ? wires.find((w) => w.id === id) : undefined),
)

// ─── useStore: Redux behind a hook ───────────────────────────────────────────
// Components read `useStore()` (state + bound actions) and non-React code (pointer/keyboard handlers)
// uses `useStore.getState()`. Everything goes through the Redux store above; no <Provider> is needed.

const A = sceneSlice.actions
const act = {
  select:     (id: string | null)                         => reduxStore.dispatch(A.select(id)),
  selectWire: (id: string | null)                         => reduxStore.dispatch(A.selectWire(id)),
  arm:        (k: Kind | null)                            => reduxStore.dispatch(A.arm(k)),
  cancelPlacing: ()                                       => reduxStore.dispatch(A.cancelPlacing()),
  place:      (x: number, z: number)                      => reduxStore.dispatch(A.place({ x, z })),
  update:     (id: string, patch: Partial<Item>, label?: string) => reduxStore.dispatch(A.updateItem({ id, patch, label })),
  remove:     (id: string)                                => reduxStore.dispatch(A.removeItem(id)),
  addMany:    (n: number)                                 => reduxStore.dispatch(A.addMany(n)),
  clear:      ()                                          => reduxStore.dispatch(A.clearScene()),
  beginDrag:  (id: string)                                => reduxStore.dispatch(A.beginDrag(id)),
  dragTo:     (x: number, z: number)                      => reduxStore.dispatch(A.dragTo({ x, z })),
  endDrag:    ()                                          => reduxStore.dispatch(A.endDrag()),
  undo:       ()                                          => reduxStore.dispatch(A.undo()),
  redo:       ()                                          => reduxStore.dispatch(A.redo()),
  setRoomSize: (w: number, d: number)                    => reduxStore.dispatch(A.setRoomSize({ w, d })),
  setLang:    (l: Lang)                                   => reduxStore.dispatch(A.setLang(l)),
  addWire:    (fromId: string, toId: string)              => reduxStore.dispatch(A.addWire({ fromId, toId })),
  removeWire: (id: string)                                => reduxStore.dispatch(A.removeWire(id)),
  updateWire: (id: string, patch: Partial<Wire>)          => reduxStore.dispatch(A.updateWire({ id, patch })),
}

export type Store = SceneState & typeof act

export function useStore(): Store {
  const scene = useSyncExternalStore(reduxStore.subscribe, () => reduxStore.getState().scene)
  return useMemo(() => ({ ...scene, ...act }), [scene])
}
useStore.getState = (): Store => ({ ...reduxStore.getState().scene, ...act })