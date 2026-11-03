import { describe, expect, it } from 'vitest'
import { computeGeometry, type SlotGeom } from './geometry'
import { photoPlacement } from './photo'
import { sanitizeProject, upgradeProject } from './projectFile'
import { defaultSettings } from './themes'
import type { Photo, Settings } from './types'

const meta = { width: 1200, height: 1600 }
const photo: Photo = { imageId: 'a', x: 0.08, y: -0.05, scale: 1.6, rotation: 0, brightness: 1, contrast: 1, saturation: 1, flipX: false }

/** The image pixel shown at the frame centre, and how many image pixels span the frame width. */
function view(slot: SlotGeom, p: Photo) {
  const pl = photoPlacement(slot, p, meta)
  const pxPerUnit = meta.width / pl.w
  const fcx = slot.box.x + slot.box.w / 2
  const fcy = slot.box.y + slot.box.h / 2
  return {
    focusX: meta.width / 2 + (fcx - pl.cx) * pxPerUnit,
    focusY: meta.height / 2 + (fcy - pl.cy) * pxPerUnit,
    zoom: pl.w / Math.max(slot.box.w, slot.box.h * (meta.width / meta.height)),
  }
}

function geomWith(change: (s: Settings) => void) {
  const s = defaultSettings()
  change(s)
  return computeGeometry(s)
}

describe('photo placement', () => {
  it('keeps the same part of the photo centred at the same zoom when the layout changes', () => {
    const a = geomWith((s) => (s.layout.generations = 4))
    const variants = [
      geomWith((s) => (s.layout.generations = 6)),
      geomWith((s) => (s.layout.generations = 3)),
      geomWith((s) => (s.layout.gap = 20)),
      geomWith((s) => (s.layout.centerRadius = 0.2)),
      geomWith((s) => (s.layout.span = 300)),
    ]
    for (const id of [1, 2, 5, 12]) {
      const before = view(a.byId.get(id)!, photo)
      for (const g of variants) {
        const after = view(g.byId.get(id)!, photo)
        expect(after.focusX).toBeCloseTo(before.focusX, 6)
        expect(after.focusY).toBeCloseTo(before.focusY, 6)
        expect(after.zoom).toBeCloseTo(before.zoom, 6)
      }
    }
  })

  it('migrates version 1 absolute offsets without moving the photo', () => {
    const settings = defaultSettings()
    const legacyPhoto = { ...photo, x: 14, y: -9 }
    const legacy = sanitizeProject({ version: 1, settings, people: { 5: { name: '', dates: '', photo: legacyPhoto } } })
    expect(legacy.version).toBe(1)
    const upgraded = upgradeProject(legacy, { a: meta })
    expect(upgraded.version).toBe(2)
    const slot = computeGeometry(settings).byId.get(5)!
    const s0 = Math.max(slot.box.w / meta.width, slot.box.h / meta.height)
    const oldCx = slot.box.x + slot.box.w / 2 + 14
    const oldCy = slot.box.y + slot.box.h / 2 - 9
    const pl = photoPlacement(slot, upgraded.people[5].photo!, meta)
    expect(pl.cx).toBeCloseTo(oldCx, 6)
    expect(pl.cy).toBeCloseTo(oldCy, 6)
    expect(pl.w).toBeCloseTo(meta.width * s0 * photo.scale, 6)
    expect(upgradeProject(upgraded, { a: meta })).toBe(upgraded)
  })
})
