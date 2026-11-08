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

  it('uses arc text along the inner edge for wide and narrow frames', () => {
    const person = { name: 'Margaret Hodge', dates: '1891 – 1967' }
    expect(layoutLabel(g.byId.get(2)!, person, s.labels)?.mode).toBe('arc')
    expect(layoutLabel(g.byId.get(40)!, person, s.labels)?.mode).toBe('arc')
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

  it('uses the same overlay size regardless of name and scales it with the slider', () => {
    for (const id of [1, 2, 40]) {
      const slot = g.byId.get(id)!
      const short = layoutLabel(slot, { name: 'Amy', dates: '' }, { ...s.labels, size: 0.7 })!
      const long = layoutLabel(slot, { name: 'A very long family name that needs wrapping', dates: '1880 – 1950' }, { ...s.labels, size: 0.7 })!
      const large = layoutLabel(slot, { name: 'Amy', dates: '' }, { ...s.labels, size: 1.4 })!
      const bandHeight = (label: typeof short) => label.mode === 'straight' ? label.band.height : label.band.width
      if (!slot.isCenter) {
        expect(bandHeight(short)).toBeCloseTo(bandHeight(long))
        expect(bandHeight(large)).toBeCloseTo(bandHeight(short) * 2)
      }
      expect(large.lines[0].size).toBeGreaterThan(short.lines[0].size)
      expect(long.lines.length).toBeGreaterThan(1)
      expect(long.lines.map((line) => line.text).join(' ').replace(/\s/g, '')).toBe('Averylongfamilynamethatneedswrapping1880–1950')
    }
  })

  it('scales label text with the frame dimensions', () => {
    const person = { name: 'Margaret', dates: '1900 – 1980' }
    for (const id of [1, 2, 40]) {
      const slot = g.byId.get(id)!
      const scaled = { ...slot, r1: slot.r1 * 2, r2: slot.r2 * 2, cx: slot.cx * 2, cy: slot.cy * 2,
        thickness: slot.thickness * 2, arcLen: slot.arcLen * 2,
        box: { x: slot.box.x * 2, y: slot.box.y * 2, w: slot.box.w * 2, h: slot.box.h * 2 } }
      const original = layoutLabel(slot, person, s.labels)!
      const larger = layoutLabel(scaled, person, s.labels)!
      original.lines.forEach((line, i) => expect(larger.lines[i].size).toBeCloseTo(line.size * 2))
    }
  })

  it('keeps full-width backgrounds tight above and below text', () => {
    const person = { name: 'Amy', dates: '' }
    for (const id of [1, 2, 40]) {
      const slot = g.byId.get(id)!
      const label = layoutLabel(slot, person, s.labels)!
      const line = label.lines[0]
      if (label.mode === 'straight') {
        expect(label.band.y + label.band.height).toBeCloseTo(slot.r2)
        expect(label.band.width).toBeGreaterThanOrEqual(slot.r2 * 2)
      } else {
        expect(label.band.width).toBeLessThan(line.size * 1.25)
      }
    }
  })

  it('places curved name backgrounds against the visual bottom edge', () => {
    const settings = defaultSettings()
    settings.layout.span = 360
    const geometry = computeGeometry(settings)
    for (const slot of geometry.slots.filter((item) => !item.isCenter)) {
      const label = layoutLabel(slot, { name: 'Amy', dates: '' }, settings.labels)!
      if (label.mode !== 'arc') continue
      const edge = label.band.r - label.band.width / 2
      expect(edge).toBeCloseTo(slot.r1)
    }
  })

  it('orients every ancestor label consistently relative to the fan centre', () => {
    const settings = defaultSettings()
    settings.layout.span = 360
    for (const slot of computeGeometry(settings).slots.filter((item) => !item.isCenter)) {
      const label = layoutLabel(slot, { name: 'Test', dates: '' }, settings.labels)!
      expect(label.mode).toBe('arc')
      if (label.mode === 'arc') expect(label.flipped).toBe(false)
    }
  })



  it('matches the centre text scale to the parents when the text fits', () => {
    const parent = g.byId.get(2)!
    const centre = g.byId.get(1)!
    for (const size of [0.5, 1, 1.5]) {
      const labels = { ...s.labels, size }
      const person = { name: 'A', dates: '' }
      const hub = layoutLabel(centre, person, labels, parent.thickness)!
      const parentLabel = layoutLabel(parent, person, labels)!
      expect(hub.lines[0].size).toBeCloseTo(parentLabel.lines[0].size)

    }
  })

  it('does not split ordinary centre names to fit the bottom tip of the circle', () => {
    const label = layoutLabel(g.byId.get(1)!, { name: 'Natasha Hodges', dates: '' }, s.labels, g.byId.get(2)!.thickness)!
    expect(label.lines.map((line) => line.text).join(' ')).toBe('Natasha Hodges')
    expect(label.lines.every((line) => ['Natasha', 'Hodges', 'Natasha Hodges'].includes(line.text))).toBe(true)
  })





  it('curves the centre label at the bottom of the circle with rounded backing', () => {
    const center = g.byId.get(1)!
    const parent = g.byId.get(2)!
    const person = { name: 'Amy', dates: '' }
    const label = layoutLabel(center, person, s.labels, parent.thickness)!
    const parentLabel = layoutLabel(parent, person, s.labels)!
    if (label.mode !== 'arc' || parentLabel.mode !== 'arc') throw new Error('Expected curved labels')
    expect(label.flipped).toBe(true)
    expect(label.band.r + label.band.width / 2).toBeCloseTo(center.r2)
    expect(label.band.width).toBeCloseTo(parentLabel.band.width)
    expect(label.band.rounded).toBe(true)
    expect(label.band.a0!).toBeGreaterThan(label.a0)
    expect(label.band.a1!).toBeLessThan(label.a1)
  })

})
