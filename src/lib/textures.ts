import type { Texture } from './types'

const SIZE = 512
const cache = new Map<Texture, string>()

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Seamless (periodic) value noise with several octaves. */
function periodicNoise(size: number, octaves: number, baseCells: number, seed: number): Float32Array {
  const out = new Float32Array(size * size)
  const rand = rng(seed)
  let amp = 1
  let total = 0
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells * Math.pow(2, o)
    const lattice = new Float32Array(cells * cells).map(() => rand())
    const smooth = (t: number) => t * t * (3 - 2 * t)
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * cells
      const y0 = Math.floor(fy)
      const ty = smooth(fy - y0)
      const y1 = (y0 + 1) % cells
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells
        const x0 = Math.floor(fx)
        const tx = smooth(fx - x0)
        const x1 = (x0 + 1) % cells
        const a = lattice[y0 * cells + x0]
        const b = lattice[y0 * cells + x1]
        const c = lattice[y1 * cells + x0]
        const d = lattice[y1 * cells + x1]
        out[y * size + x] += amp * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty)
      }
    }
    total += amp
    amp *= 0.55
  }
  for (let i = 0; i < out.length; i++) out[i] /= total
  return out
}

/**
 * Texture tiles encode light/dark variation as white/black pixels with alpha, so they
 * overlay any background colour without needing blend modes (which keeps exports faithful).
 */
export function textureTile(kind: Texture): string | null {
  if (kind === 'none') return null
  const hit = cache.get(kind)
  if (hit) return hit

  const rand = rng(1234)
  const values = new Float32Array(SIZE * SIZE)
  if (kind === 'grain') {
    for (let i = 0; i < values.length; i++) values[i] = (rand() + rand() + rand()) / 3
  } else if (kind === 'paper') {
    const fibres = periodicNoise(SIZE, 6, 4, 77)
    const fine = periodicNoise(SIZE, 2, 64, 99)
    for (let i = 0; i < values.length; i++) values[i] = fibres[i] * 0.75 + fine[i] * 0.25 + (rand() - 0.5) * 0.08
  } else {
    const rows = Array.from({ length: SIZE }, () => rand())
    const cols = Array.from({ length: SIZE }, () => rand())
    const mottle = periodicNoise(SIZE, 3, 4, 5)
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        values[y * SIZE + x] = rows[y] * 0.38 + cols[x] * 0.38 + mottle[y * SIZE + x] * 0.24 + (rand() - 0.5) * 0.06
  }

  let min = Infinity
  let max = -Infinity
  for (const v of values) {
    min = Math.min(min, v)
    max = Math.max(max, v)
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(SIZE, SIZE)
  for (let i = 0; i < values.length; i++) {
    const v = (values[i] - min) / (max - min || 1) - 0.5
    const c = v > 0 ? 255 : 0
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c
    img.data[i * 4 + 3] = Math.min(255, Math.abs(v) * 2 * 255 * (v > 0 ? 0.55 : 1))
  }
  ctx.putImageData(img, 0, 0)
  const url = canvas.toDataURL('image/png')
  cache.set(kind, url)
  return url
}

export const TEXTURE_TILE_UNITS: Record<Texture, number> = { none: 0, grain: 180, paper: 900, linen: 520 }
