import { describe, expect, it } from 'vitest'
import { computeGeometry, relationship, ringRadii, sectorPath, slotCount, OUTER_RADIUS } from './geometry'
import { layoutLabel } from './labels'
import { defaultSettings } from './themes'

describe('geometry', () => {
  it('creates one slot per ancestor using Ahnentafel numbering', () => {
    const s = defaultSettings()
    const g = computeGeometry(s)
    expect(g.slots).toHaveLength(slotCount(s.layout.generations))
    expect(g.slots.map((x) => x.id)).toEqual(Array.from({ length: 63 }, (_, i) => i + 1))
  })

  it('ring radii end at the outer radius', () => {
    const r = ringRadii(defaultSettings().layout)
    expect(r.at(-1)).toBeCloseTo(OUTER_RADIUS)
    for (let i = 1; i < r.length; i++) expect(r[i]).toBeGreaterThan(r[i - 1])
  })

  it('orders each generation left to right across the fan', () => {
    const g = computeGeometry(defaultSettings())
    const father = g.byId.get(2)!
    const mother = g.byId.get(3)!
    expect(father.cx).toBeLessThan(0)
    expect(mother.cx).toBeGreaterThan(0)
    // Parents of slot n are 2n and 2n+1 and sit within n's angular range.
    const p = g.byId.get(5)!
    for (const child of [g.byId.get(10)!, g.byId.get(11)!]) {
      expect(child.a0).toBeGreaterThanOrEqual(p.a0 - 1e-9)
      expect(child.a1).toBeLessThanOrEqual(p.a1 + 1e-9)
    }
  })

  it('produces valid closed paths and non-empty frames', () => {
    const g = computeGeometry(defaultSettings())
    for (const slot of g.slots) {
      expect(slot.path).toMatch(/^M .* Z$/)
      expect(slot.path).not.toContain('NaN')
      expect(slot.box.w).toBeGreaterThan(0)
      expect(slot.box.h).toBeGreaterThan(0)
    }
  })

  it('returns empty path when the gap swallows the sector', () => {
    expect(sectorPath(100, 200, 0, 0.01, 50, 5)).toBe('')
  })

  it('pads the view box to the requested aspect ratio', () => {
    const s = defaultSettings()
    s.layout.aspect = '1:1'
    const vb = computeGeometry(s).viewBox
    expect(vb.w / vb.h).toBeCloseTo(1)
  })

  it('names relationships', () => {
    expect(relationship(2)).toBe('Father')
    expect(relationship(3)).toBe('Mother')
    expect(relationship(4)).toBe('Grandfather · paternal')
    expect(relationship(7)).toBe('Grandmother · maternal')
    expect(relationship(16)).toBe('2× great-grandfather · paternal')
  })
})

describe('labels', () => {
  const s = defaultSettings()
  const g = computeGeometry(s)

  it('uses arc text for wide frames and radial text for narrow ones', () => {
    const person = { name: 'Margaret Hodge', dates: '1891 – 1967' }
    expect(layoutLabel(g.byId.get(2)!, person, s.labels)?.mode).toBe('arc')
    expect(layoutLabel(g.byId.get(40)!, person, s.labels)?.mode).toBe('straight')
  })

  it('skips empty labels and respects the toggle', () => {
    expect(layoutLabel(g.byId.get(2)!, { name: ' ', dates: '' }, s.labels)).toBeNull()
    expect(layoutLabel(g.byId.get(2)!, { name: 'A', dates: '' }, { ...s.labels, show: false })).toBeNull()
  })

  it('keeps text sizes positive and finite', () => {
    for (const slot of g.slots) {
      const l = layoutLabel(slot, { name: 'Elizabeth Alexandra Mary', dates: '1900 – 2000' }, s.labels)!
      for (const line of l.lines) {
        expect(Number.isFinite(line.size)).toBe(true)
        expect(line.size).toBeGreaterThan(0)
      }
    }
  })
})
