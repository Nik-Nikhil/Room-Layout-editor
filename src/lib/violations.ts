import { GRID, footprint, type Item, type Violation } from './store'

// Checks minimum clearance between every pair of items.
//
// Instead of comparing every item against every other item (O(n²)), we drop
// items into a spatial hash with 2.5 m cells. Any violating pair must share
// a cell or be in adjacent cells, so we only compare the 3×3 neighbourhood.
// At 2 000 items this runs in milliseconds even during a drag.
export function violations(items: Item[]): Violation[] {
  const CELL = 2.5 // must be larger than the biggest footprint (1.44) + minGap (0.6)
  const results: Violation[] = []

  // Pre-compute every item's footprint (accounts for 90° rotations).
  const footprints = items.map(footprint)

  // Hash function: maps a cell coordinate pair to a single integer bucket key.
  const bucketKey = (cx: number, cz: number) => cx * 100003 + cz

  // Build the hash — each bucket holds the indices of items that fall into it.
  const buckets = new Map<number, number[]>()
  for (let i = 0; i < items.length; i++) {
    const key = bucketKey(
      Math.floor(items[i].x / CELL),
      Math.floor(items[i].z / CELL),
    )
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.push(i)
    } else {
      buckets.set(key, [i])
    }
  }

  // For each item, check its 3×3 neighbourhood.
  // We only look at j > i so each pair is checked exactly once.
  for (let i = 0; i < items.length; i++) {
    const a  = items[i]
    const fa = footprints[i]
    const cx = Math.floor(a.x / CELL)
    const cz = Math.floor(a.z / CELL)

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const bucket = buckets.get(bucketKey(cx + dx, cz + dz))
        if (!bucket) continue

        for (const j of bucket) {
          if (j <= i) continue // already checked this pair from the other side

          const b  = items[j]
          const fb = footprints[j]

          // Axis-aligned gaps between the two bounding boxes.
          // Negative means overlapping on that axis.
          const gapX = Math.abs(a.x - b.x) - (fa.w + fb.w) / 2
          const gapZ = Math.abs(a.z - b.z) - (fa.d + fb.d) / 2

          // If either gap already exceeds minGap the items are fine — skip.
          if (gapX >= GRID.minGap || gapZ >= GRID.minGap) continue

          // Corner distance: zero when the boxes overlap, positive otherwise.
          const gap = Math.hypot(Math.max(gapX, 0), Math.max(gapZ, 0))
          if (gap < GRID.minGap) {
            results.push({ a, b, gap })
          }
        }
      }
    }
  }

  return results
}
