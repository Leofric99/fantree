import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate'
import { computeGeometry, slotCount } from './geometry'
import { fromAbsoluteOffsets } from './photo'
import { defaultSettings } from './themes'
import type { ImageMeta, Person, Photo, Project } from './types'

/**
 * `.fantree` project package (version 2): a standard zip archive containing
 *   project.json      – settings, names, and per-photo position/zoom/rotation/adjustments
 *   images/<id>.<ext> – the image bytes exactly as stored by the app
 * Version 1 files (a single JSON document with base64 data URLs) can still be read.
 */
export const PACKAGE_FORMAT = 'fantree'
export const PACKAGE_VERSION = 2
const MANIFEST = 'project.json'
const MAX_GENERATIONS = 6
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export interface PackageImage {
  id: string
  mime: string
  bytes: Uint8Array
}

interface ManifestImage {
  path: string
  mime: string
}

interface Manifest {
  format: typeof PACKAGE_FORMAT
  version: number
  app: string
  savedAt: string
  project: Project
  images: Record<string, ManifestImage>
}

export interface ParsedPackage {
  project: Project
  images: PackageImage[]
  warnings: string[]
}

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

export function buildPackage(project: Project, images: PackageImage[], app = 'FanTree'): Uint8Array {
  const files: Zippable = {}
  const entries: Record<string, ManifestImage> = {}
  for (const img of images) {
    if (!ID_RE.test(img.id)) continue
    const path = `images/${img.id}.${EXT[img.mime] ?? 'bin'}`
    entries[img.id] = { path, mime: img.mime }
    // Images are already compressed; storing them avoids wasted CPU for no gain.
    files[path] = [img.bytes, { level: 0 }]
  }
  const manifest: Manifest = {
    format: PACKAGE_FORMAT,
    version: PACKAGE_VERSION,
    app,
    savedAt: new Date().toISOString(),
    project,
    images: entries,
  }
  files[MANIFEST] = [strToU8(JSON.stringify(manifest, null, 2)), { level: 6 }]
  return zipSync(files)
}

function isZip(bytes: Uint8Array) {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

function decodeDataUrl(url: string): { mime: string; bytes: Uint8Array } | null {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url)
  if (!m || !m[2]) return null
  const bin = atob(m[3])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return { mime: m[1] || 'application/octet-stream', bytes }
}

export function parsePackage(bytes: Uint8Array): ParsedPackage {
  const warnings: string[] = []
  const images: PackageImage[] = []
  let rawProject: unknown

  if (isZip(bytes)) {
    let files: Record<string, Uint8Array>
    try {
      files = unzipSync(bytes)
    } catch {
      throw new Error('The file is damaged and could not be unpacked.')
    }
    if (!files[MANIFEST]) throw new Error('This archive is not a FanTree project (project.json is missing).')
    const manifest = parseJson(strFromU8(files[MANIFEST])) as Partial<Manifest>
    checkHeader(manifest)
    rawProject = manifest.project
    for (const [id, entry] of Object.entries(manifest.images ?? {})) {
      const data = entry && typeof entry.path === 'string' ? files[entry.path] : undefined
      if (!ID_RE.test(id) || !data) {
        warnings.push(`An image (${id.slice(0, 12)}) was missing from the file.`)
        continue
      }
      images.push({ id, mime: typeof entry.mime === 'string' ? entry.mime : 'image/jpeg', bytes: data })
    }
  } else {
    const legacy = parseJson(new TextDecoder().decode(bytes)) as { format?: string; version?: number; project?: unknown; images?: Record<string, unknown> }
    checkHeader(legacy)
    rawProject = legacy.project
    for (const [id, url] of Object.entries(legacy.images ?? {})) {
      const decoded = ID_RE.test(id) && typeof url === 'string' ? decodeDataUrl(url) : null
      if (decoded) images.push({ id, ...decoded })
      else warnings.push(`An image (${id.slice(0, 12)}) could not be read.`)
    }
  }

  const project = sanitizeProject(rawProject)
  const available = new Set(images.map((i) => i.id))
  let dropped = 0
  for (const person of Object.values(project.people)) {
    if (person.photo && !available.has(person.photo.imageId)) {
      delete person.photo
      dropped++
    }
  }
  if (dropped) warnings.push(`${dropped} photo${dropped === 1 ? '' : 's'} could not be restored.`)
  const used = new Set(Object.values(project.people).flatMap((p) => (p.photo ? [p.photo.imageId] : [])))
  return { project, images: images.filter((i) => used.has(i.id)), warnings }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('This is not a FanTree project file.')
  }
}

function checkHeader(data: unknown) {
  const d = data as { format?: unknown; version?: unknown; project?: unknown } | null
  if (!d || d.format !== PACKAGE_FORMAT || typeof d.project !== 'object' || d.project === null) {
    throw new Error('This is not a FanTree project file.')
  }
  if (typeof d.version === 'number' && d.version > PACKAGE_VERSION) {
    throw new Error('This project was saved by a newer version of FanTree.')
  }
}

const num = (v: unknown, fallback: number, min = -Infinity, max = Infinity) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback
const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')

function sanitizePhoto(raw: unknown, legacy: boolean): Photo | undefined {
  const p = raw as Partial<Photo> | null
  if (!p || typeof p.imageId !== 'string' || !ID_RE.test(p.imageId)) return undefined
  return {
    imageId: p.imageId,
    x: legacy ? num(p.x, 0, -5000, 5000) : num(p.x, 0, -10, 10),
    y: legacy ? num(p.y, 0, -5000, 5000) : num(p.y, 0, -10, 10),
    scale: num(p.scale, 1, 0.05, 50),
    rotation: num(p.rotation, 0, -360, 360),
    brightness: num(p.brightness, 1, 0, 3),
    contrast: num(p.contrast, 1, 0, 3),
    saturation: num(p.saturation, 1, 0, 3),
    flipX: p.flipX === true,
  }
}

/** Accepts untrusted JSON and returns a well-formed project, filling gaps with defaults. */
export function sanitizeProject(raw: unknown): Project {
  const src = (raw ?? {}) as { version?: unknown; settings?: unknown; people?: unknown }
  const legacy = src.version !== 2
  const settings = mergeDeep(defaultSettings(), src.settings)
  settings.layout.generations = Math.round(num(settings.layout.generations, 5, 2, MAX_GENERATIONS))
  const maxSlot = slotCount(MAX_GENERATIONS)
  const people: Record<number, Person> = {}
  if (src.people && typeof src.people === 'object') {
    for (const [key, value] of Object.entries(src.people as Record<string, unknown>)) {
      const slot = Number(key)
      if (!Number.isInteger(slot) || slot < 1 || slot > maxSlot || !value || typeof value !== 'object') continue
      const v = value as Partial<Person>
      const person: Person = { name: str(v.name), dates: str(v.dates) }
      const photo = sanitizePhoto(v.photo, legacy)
      if (photo) person.photo = photo
      people[slot] = person
    }
  }
  return { version: legacy ? 1 : 2, settings, people }
}

/**
 * Bring a sanitised project up to the current version. Version 1 stored photo offsets in absolute
 * chart units, which needs the saved layout and each image's size to convert.
 */
export function upgradeProject(project: Project, images: Record<string, Pick<ImageMeta, 'width' | 'height'>>): Project {
  if (project.version === 2) return project
  const geom = computeGeometry(project.settings)
  const people: Record<number, Person> = {}
  for (const [key, person] of Object.entries(project.people)) {
    const slot = geom.byId.get(Number(key))
    const meta = person.photo && images[person.photo.imageId]
    people[Number(key)] =
      person.photo && slot && meta
        ? { ...person, photo: fromAbsoluteOffsets(person.photo, slot, meta) }
        : person.photo
          ? { ...person, photo: { ...person.photo, x: 0, y: 0 } }
          : person
  }
  return { ...project, version: 2, people }
}

/** Fill missing or wrongly-typed keys from defaults so older or edited files keep working. */
export function mergeDeep<T>(defaults: T, value: unknown): T {
  if (typeof defaults !== 'object' || defaults === null || Array.isArray(defaults)) {
    return (typeof value === typeof defaults && (typeof value !== 'number' || Number.isFinite(value)) ? value : defaults) as T
  }
  const out: Record<string, unknown> = { ...(defaults as Record<string, unknown>) }
  const src = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  for (const key of Object.keys(out)) out[key] = mergeDeep(out[key], src[key])
  return out as T
}
