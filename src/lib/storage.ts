import { createStore, del, get, keys, set } from 'idb-keyval'
import type { ImageMeta, Project } from './types'

const imageDb = createStore('fantree-images', 'images')
const projectDb = createStore('fantree-project', 'project')
const PROJECT_KEY = 'current'

interface StoredImage {
  full: Blob
  preview: Blob
  width: number
  height: number
  mime: string
}

const FULL_MAX = 4096
const PREVIEW_MAX = 1400
export const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,image/bmp'

function newId(): string {
  return crypto.randomUUID()
}

async function encode(source: CanvasImageSource, w: number, h: number, mime: string, quality: number): Promise<Blob> {
  const canvas = new OffscreenCanvas(w, h)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  return canvas.convertToBlob({ type: mime, quality })
}

/** Downscale in halving steps for sharper, alias-free results on large reductions. */
async function resize(bitmap: ImageBitmap, maxSide: number, mime: string, quality: number): Promise<Blob> {
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const tw = Math.max(1, Math.round(bitmap.width * ratio))
  const th = Math.max(1, Math.round(bitmap.height * ratio))
  let src: CanvasImageSource = bitmap
  let sw = bitmap.width
  let sh = bitmap.height
  while (sw / 2 >= tw && sh / 2 >= th) {
    sw = Math.round(sw / 2)
    sh = Math.round(sh / 2)
    const step = new OffscreenCanvas(sw, sh)
    const ctx = step.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, 0, 0, sw, sh)
    src = step
  }
  return encode(src, tw, th, mime, quality)
}

export async function importImage(file: Blob): Promise<ImageMeta> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('This image format could not be read by your browser. Try JPEG, PNG or WebP.')
  }
  const hasAlpha = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif'
  const mime = hasAlpha ? 'image/png' : 'image/jpeg'
  const full = await resize(bitmap, FULL_MAX, mime, 0.95)
  const preview = await resize(bitmap, PREVIEW_MAX, hasAlpha ? 'image/webp' : 'image/jpeg', 0.88)
  const ratio = Math.min(1, FULL_MAX / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * ratio)
  const height = Math.round(bitmap.height * ratio)
  bitmap.close()

  const id = newId()
  await set(id, { full, preview, width, height, mime } satisfies StoredImage, imageDb)
  return { id, width, height, mime, previewUrl: URL.createObjectURL(preview) }
}

export async function loadImageMeta(id: string): Promise<ImageMeta | null> {
  const stored = await get<StoredImage>(id, imageDb)
  if (!stored) return null
  return { id, width: stored.width, height: stored.height, mime: stored.mime, previewUrl: URL.createObjectURL(stored.preview) }
}

export async function getFullImage(id: string): Promise<StoredImage | undefined> {
  return get<StoredImage>(id, imageDb)
}

/** Remove images no longer referenced by the project. */
export async function collectGarbage(keep: Set<string>): Promise<void> {
  const all = await keys(imageDb)
  await Promise.all(all.filter((k) => !keep.has(String(k))).map((k) => del(k, imageDb)))
}

// IndexedDB writes are async and may not finish while the page is unloading, so
// the latest project (small JSON, no image data) is also kept in localStorage
// until a matching IndexedDB write has completed.
const BACKUP_KEY = 'fantree-project-backup'
let saveRev = 0

export async function saveProject(project: Project): Promise<void> {
  const rev = ++saveRev
  await set(PROJECT_KEY, project, projectDb)
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (raw && (JSON.parse(raw) as { rev: number }).rev <= rev) localStorage.removeItem(BACKUP_KEY)
  } catch {
    /* ignore */
  }
}

/** Synchronous save for page unload; pair with an async saveProject call. */
export function saveProjectBackup(project: Project): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ rev: saveRev + 1, project }))
  } catch {
    /* quota exceeded or storage disabled */
  }
}

export async function loadProject(): Promise<Project | undefined> {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (raw) return (JSON.parse(raw) as { project: Project }).project
  } catch {
    /* fall back to IndexedDB */
  }
  return get<Project>(PROJECT_KEY, projectDb)
}

export function referencedImages(project: Project): Set<string> {
  const ids = new Set<string>()
  for (const p of [...Object.values(project.people), ...Object.values(project.tree?.people ?? {})]) if (p.photo) ids.add(p.photo.imageId)
  return ids
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob()
}

/** Produce an image sized for the given pixel width (never upscaled), as a data URL. */
export async function imageForExport(id: string, targetWidthPx: number): Promise<string | null> {
  const stored = await getFullImage(id)
  if (!stored) return null
  if (targetWidthPx >= stored.width * 0.9) return blobToDataUrl(stored.full)
  const bitmap = await createImageBitmap(stored.full)
  const maxSide = Math.ceil(Math.max(stored.width, stored.height) * (targetWidthPx / stored.width))
  const blob = await resize(bitmap, maxSide, stored.mime, 0.93)
  bitmap.close()
  return blobToDataUrl(blob)
}

/** Store an image coming from a project file, preserving its id. */
export async function restoreImage(id: string, full: Blob): Promise<ImageMeta> {
  const bitmap = await createImageBitmap(full)
  const mime = full.type || 'image/jpeg'
  const preview = await resize(bitmap, PREVIEW_MAX, mime === 'image/png' ? 'image/webp' : 'image/jpeg', 0.88)
  const meta = { full, preview, width: bitmap.width, height: bitmap.height, mime }
  bitmap.close()
  await set(id, meta satisfies StoredImage, imageDb)
  return { id, width: meta.width, height: meta.height, mime, previewUrl: URL.createObjectURL(preview) }
}
