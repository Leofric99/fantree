import { FONTS } from './themes'
import { blobToDataUrl, imageForExport } from './storage'
import type { FontId, Settings } from './types'

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'svg'

export interface ExportOptions {
  format: ExportFormat
  /** Pixel length of the longest side. */
  longEdge: number
  transparent: boolean
  quality: number
}

export const RESOLUTIONS = [
  { id: 'hd', label: 'Full HD', px: 1920 },
  { id: '4k', label: '4K UHD', px: 3840 },
  { id: '5k', label: '5K', px: 5120 },
  { id: '8k', label: '8K UHD', px: 7680 },
  { id: 'print', label: 'Poster print (60 cm @ 300 dpi)', px: 7087 },
]

const fontCache = new Map<string, string>()

async function fontFaceCss(fonts: FontId[]): Promise<string> {
  const rules: string[] = []
  for (const id of new Set(fonts)) {
    const def = FONTS[id]
    for (const file of def.files) {
      let data = fontCache.get(file.url)
      if (!data) {
        data = await blobToDataUrl(await (await fetch(file.url)).blob())
        fontCache.set(file.url, data)
      }
      rules.push(
        `@font-face{font-family:'${def.family}';font-style:normal;font-weight:${file.weight};src:url(${data}) format('woff2');}`,
      )
    }
  }
  return rules.join('\n')
}

export function exportSize(viewBox: { w: number; h: number }, longEdge: number) {
  const ratio = viewBox.w / viewBox.h
  return ratio >= 1
    ? { width: longEdge, height: Math.round(longEdge / ratio) }
    : { width: Math.round(longEdge * ratio), height: longEdge }
}

/**
 * Builds a self-contained SVG string from the live chart: editor overlays are removed,
 * photos are swapped for appropriately sized originals and fonts are embedded.
 */
export async function buildStandaloneSvg(
  svg: SVGSVGElement,
  settings: Settings,
  opts: ExportOptions,
  onProgress?: (fraction: number) => void,
): Promise<{ markup: string; width: number; height: number }> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.querySelectorAll('[data-ui]').forEach((el) => el.remove())
  if (opts.transparent) clone.querySelectorAll('[data-bg]').forEach((el) => el.remove())
  clone.removeAttribute('class')

  const vb = svg.viewBox.baseVal
  const { width, height } = exportSize({ w: vb.width, h: vb.height }, opts.format === 'svg' ? 3840 : opts.longEdge)
  const pxPerUnit = width / vb.width
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const images = Array.from(clone.querySelectorAll<SVGImageElement>('image[data-image-id]'))
  // Each image is resampled once to the largest size it appears at.
  const needed = new Map<string, number>()
  for (const img of images) {
    const id = img.dataset.imageId!
    const w = parseFloat(img.getAttribute('width') ?? '0') * pxPerUnit * 1.15
    needed.set(id, Math.max(needed.get(id) ?? 0, w))
  }
  const urls = new Map<string, string | null>()
  let done = 0
  for (const [id, px] of needed) {
    urls.set(id, await imageForExport(id, Math.ceil(px)))
    onProgress?.(++done / (needed.size + 2))
  }
  for (const img of images) {
    const url = urls.get(img.dataset.imageId!)
    if (url) img.setAttribute('href', url)
    img.removeAttribute('data-image-id')
  }

  const fonts: FontId[] = []
  if (settings.labels.show) fonts.push(settings.labels.font)
  if (settings.title.show) fonts.push(settings.title.font)
  const css = await fontFaceCss(fonts)
  if (css) {
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = css
    clone.insertBefore(style, clone.firstChild)
  }
  onProgress?.((needed.size + 1) / (needed.size + 2))

  const markup = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
  return { markup, width, height }
}

export async function renderExport(
  svg: SVGSVGElement,
  settings: Settings,
  opts: ExportOptions,
  onProgress?: (fraction: number) => void,
): Promise<Blob> {
  const { markup, width, height } = await buildStandaloneSvg(svg, settings, opts, onProgress)
  if (opts.format === 'svg') return new Blob([markup], { type: 'image/svg+xml' })

  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    // Give the browser a beat to finish rasterising embedded fonts and images.
    await new Promise((r) => setTimeout(r, 60))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: opts.transparent && opts.format !== 'jpeg' })
    if (!ctx) throw new Error('Your browser could not allocate a canvas this large. Try a smaller size.')
    if (opts.format === 'jpeg' || (!opts.transparent && opts.format !== 'png')) {
      ctx.fillStyle = settings.background.color1
      ctx.fillRect(0, 0, width, height)
    }
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, width, height)
    const mime = `image/${opts.format}`
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, opts.quality))
    if (!blob) throw new Error('Export failed — the image may be too large for this browser.')
    onProgress?.(1)
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
