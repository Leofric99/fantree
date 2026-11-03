import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { buildPackage, parsePackage, sanitizeProject } from './projectFile'
import { defaultSettings } from './themes'
import type { Project } from './types'

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 5, 0xff, 0xd9])
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 8, 7])

function sampleProject(): Project {
  const settings = defaultSettings()
  settings.boxes.style = 'faded'
  settings.background.color1 = '#123456'
  settings.title.text = 'The Hodge Family'
  settings.layout.generations = 6
  return {
    version: 2,
    settings,
    people: {
      1: { name: 'Chris & Emma', dates: 'Married 2019', photo: { imageId: 'img-a', x: 0.05, y: -0.12, scale: 1.75, rotation: -12, brightness: 1.1, contrast: 0.9, saturation: 0, flipX: true } },
      2: { name: 'William Hodge', dates: '1921 – 1994', photo: { imageId: 'img-b', x: 0, y: 0.01, scale: 2.4, rotation: 0, brightness: 1, contrast: 1, saturation: 1, flipX: false } },
      3: { name: 'No photo', dates: '' },
      100: { name: 'Gen 6', dates: '', photo: { imageId: 'img-a', x: 0.1, y: -0.1, scale: 1, rotation: 0, brightness: 1, contrast: 1, saturation: 1, flipX: false } },
    },
  }
}

describe('project package', () => {
  it('round-trips settings, names, photo placement and image bytes exactly', () => {
    const project = sampleProject()
    const bytes = buildPackage(project, [
      { id: 'img-a', mime: 'image/jpeg', bytes: jpeg },
      { id: 'img-b', mime: 'image/png', bytes: png },
    ])
    const parsed = parsePackage(bytes)
    expect(parsed.warnings).toEqual([])
    expect(parsed.project).toEqual(project)
    const byId = Object.fromEntries(parsed.images.map((i) => [i.id, i]))
    expect(Array.from(byId['img-a'].bytes)).toEqual(Array.from(jpeg))
    expect(byId['img-b'].mime).toBe('image/png')
    expect(Array.from(byId['img-b'].bytes)).toEqual(Array.from(png))
  })

  it('reads version 1 JSON files with data URLs', () => {
    const project = sampleProject()
    const toUrl = (mime: string, b: Uint8Array) => `data:${mime};base64,${btoa(String.fromCharCode(...b))}`
    const legacy = JSON.stringify({ format: 'fantree', version: 1, project, images: { 'img-a': toUrl('image/jpeg', jpeg), 'img-b': toUrl('image/png', png) } })
    const parsed = parsePackage(strToU8(legacy))
    expect(parsed.project).toEqual(project)
    expect(parsed.images.map((i) => i.id).sort()).toEqual(['img-a', 'img-b'])
    expect(Array.from(parsed.images.find((i) => i.id === 'img-a')!.bytes)).toEqual(Array.from(jpeg))
  })

  it('drops photos whose image is missing and reports it', () => {
    const parsed = parsePackage(buildPackage(sampleProject(), [{ id: 'img-a', mime: 'image/jpeg', bytes: jpeg }]))
    expect(parsed.project.people[2].photo).toBeUndefined()
    expect(parsed.project.people[2].name).toBe('William Hodge')
    expect(parsed.warnings.join(' ')).toMatch(/1 photo could not be restored/)
  })

  it('rejects files that are not FanTree projects', () => {
    expect(() => parsePackage(strToU8('hello'))).toThrow(/not a FanTree/)
    expect(() => parsePackage(strToU8(JSON.stringify({ format: 'other', project: {} })))).toThrow(/not a FanTree/)
    expect(() => parsePackage(zipSync({ 'readme.txt': strToU8('x') }))).toThrow(/project.json is missing/)
    expect(() => parsePackage(strToU8(JSON.stringify({ format: 'fantree', version: 99, project: {} })))).toThrow(/newer version/)
  })

  it('sanitises untrusted values', () => {
    const p = sanitizeProject({
      settings: { layout: { generations: 40, span: 'wide' }, boxes: { strokeWidth: Number.NaN } },
      people: {
        1: { name: 5, dates: 'ok', photo: { imageId: '../evil', x: 1 } },
        2: { name: 'A', dates: '', photo: { imageId: 'good', x: 1e9, scale: -3, flipX: 'yes' } },
        abc: { name: 'bad key' },
        9999: { name: 'out of range' },
      },
    })
    const d = defaultSettings()
    expect(p.settings.layout.generations).toBe(6)
    expect(p.settings.layout.span).toBe(d.layout.span)
    expect(p.settings.boxes.strokeWidth).toBe(d.boxes.strokeWidth)
    expect(p.people[1]).toEqual({ name: '', dates: 'ok' })
    expect(p.people[2].photo).toMatchObject({ imageId: 'good', x: 5000, scale: 0.05, flipX: false })
    expect(Object.keys(p.people).sort()).toEqual(['1', '2'])
  })
})
