import type { BoxStyle, FontId, Settings, Texture, Tone } from './types'

import playfair400 from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url'
import playfair600 from '@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2?url'
import cormorant400 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2?url'
import cormorant600 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2?url'
import lora400 from '@fontsource/lora/files/lora-latin-400-normal.woff2?url'
import lora600 from '@fontsource/lora/files/lora-latin-600-normal.woff2?url'
import cinzel400 from '@fontsource/cinzel/files/cinzel-latin-400-normal.woff2?url'
import cinzel600 from '@fontsource/cinzel/files/cinzel-latin-600-normal.woff2?url'
import greatvibes400 from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff2?url'
import inter400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url'
import inter600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url'
import montserrat400 from '@fontsource/montserrat/files/montserrat-latin-400-normal.woff2?url'
import montserrat600 from '@fontsource/montserrat/files/montserrat-latin-600-normal.woff2?url'

export interface FontDef {
  id: FontId
  label: string
  family: string
  fallback: string
  files: { weight: number; url: string }[]
  /** Average glyph width relative to font size, used for fitting text. */
  widthFactor: number
  titleWeight: number
}

export const FONTS: Record<FontId, FontDef> = {
  playfair: {
    id: 'playfair',
    label: 'Playfair Display',
    family: 'Playfair Display',
    fallback: 'Georgia, serif',
    files: [
      { weight: 400, url: playfair400 },
      { weight: 600, url: playfair600 },
    ],
    widthFactor: 0.54,
    titleWeight: 600,
  },
  cormorant: {
    id: 'cormorant',
    label: 'Cormorant Garamond',
    family: 'Cormorant Garamond',
    fallback: 'Georgia, serif',
    files: [
      { weight: 400, url: cormorant400 },
      { weight: 600, url: cormorant600 },
    ],
    widthFactor: 0.46,
    titleWeight: 600,
  },
  lora: {
    id: 'lora',
    label: 'Lora',
    family: 'Lora',
    fallback: 'Georgia, serif',
    files: [
      { weight: 400, url: lora400 },
      { weight: 600, url: lora600 },
    ],
    widthFactor: 0.53,
    titleWeight: 600,
  },
  cinzel: {
    id: 'cinzel',
    label: 'Cinzel',
    family: 'Cinzel',
    fallback: 'Georgia, serif',
    files: [
      { weight: 400, url: cinzel400 },
      { weight: 600, url: cinzel600 },
    ],
    widthFactor: 0.68,
    titleWeight: 600,
  },
  greatvibes: {
    id: 'greatvibes',
    label: 'Great Vibes (script)',
    family: 'Great Vibes',
    fallback: 'cursive',
    files: [{ weight: 400, url: greatvibes400 }],
    widthFactor: 0.42,
    titleWeight: 400,
  },
  inter: {
    id: 'inter',
    label: 'Inter',
    family: 'Inter',
    fallback: 'system-ui, sans-serif',
    files: [
      { weight: 400, url: inter400 },
      { weight: 600, url: inter600 },
    ],
    widthFactor: 0.55,
    titleWeight: 600,
  },
  montserrat: {
    id: 'montserrat',
    label: 'Montserrat',
    family: 'Montserrat',
    fallback: 'system-ui, sans-serif',
    files: [
      { weight: 400, url: montserrat400 },
      { weight: 600, url: montserrat600 },
    ],
    widthFactor: 0.6,
    titleWeight: 600,
  },
}

export const fontStack = (id: FontId) => `'${FONTS[id].family}', ${FONTS[id].fallback}`

export interface ThemePreset {
  id: string
  label: string
  background: Omit<Settings['background'], 'preset'>
  tile: string
  stroke: string
  text: string
  band: string
}

export const THEMES: ThemePreset[] = [
  {
    id: 'studio',
    label: 'Studio Grey',
    background: { kind: 'radial', color1: '#e2e2e1', color2: '#cbcbc9', angle: 0, texture: 'none', textureStrength: 0.3, vignette: 0.06 },
    tile: '#efefee',
    stroke: '#ffffff',
    text: '#2b2b2b',
    band: '#ffffff',
  },
  {
    id: 'parchment',
    label: 'Ivory Parchment',
    background: { kind: 'radial', color1: '#f8f1e1', color2: '#dfcda6', angle: 0, texture: 'paper', textureStrength: 0.45, vignette: 0.25 },
    tile: '#f1e7d1',
    stroke: '#b8a074',
    text: '#4a3a24',
    band: '#f8f1e1',
  },
  {
    id: 'sepia',
    label: 'Antique Sepia',
    background: { kind: 'radial', color1: '#dcc7a1', color2: '#9c7d50', angle: 0, texture: 'paper', textureStrength: 0.55, vignette: 0.4 },
    tile: '#e6d5b4',
    stroke: '#f3e6cb',
    text: '#3b2a15',
    band: '#efe2c6',
  },
  {
    id: 'linen',
    label: 'Linen White',
    background: { kind: 'linear', color1: '#f7f4ef', color2: '#ebe5dc', angle: 160, texture: 'linen', textureStrength: 0.35, vignette: 0.08 },
    tile: '#e8e1d6',
    stroke: '#ffffff',
    text: '#3d362c',
    band: '#faf8f4',
  },
  {
    id: 'white',
    label: 'Gallery White',
    background: { kind: 'solid', color1: '#ffffff', color2: '#ffffff', angle: 0, texture: 'none', textureStrength: 0.2, vignette: 0 },
    tile: '#efefef',
    stroke: '#d9d9d9',
    text: '#1d1d1f',
    band: '#ffffff',
  },
  {
    id: 'sage',
    label: 'Sage Garden',
    background: { kind: 'linear', color1: '#eef2e9', color2: '#c3d0b8', angle: 150, texture: 'grain', textureStrength: 0.25, vignette: 0.1 },
    tile: '#e7ede1',
    stroke: '#ffffff',
    text: '#33412c',
    band: '#f3f6ef',
  },
  {
    id: 'rose',
    label: 'Dusty Rose',
    background: { kind: 'linear', color1: '#f6e8e5', color2: '#d8b1ac', angle: 145, texture: 'grain', textureStrength: 0.22, vignette: 0.1 },
    tile: '#f3e3e0',
    stroke: '#ffffff',
    text: '#563535',
    band: '#fbf3f1',
  },
  {
    id: 'ocean',
    label: 'Ocean Mist',
    background: { kind: 'linear', color1: '#e6eff4', color2: '#a6c0ce', angle: 155, texture: 'grain', textureStrength: 0.2, vignette: 0.12 },
    tile: '#e5eef3',
    stroke: '#ffffff',
    text: '#26404e',
    band: '#f1f6f9',
  },
  {
    id: 'golden',
    label: 'Golden Hour',
    background: { kind: 'linear', color1: '#fbe7c4', color2: '#e3a073', angle: 135, texture: 'grain', textureStrength: 0.2, vignette: 0.15 },
    tile: '#fbecd3',
    stroke: '#fff7ea',
    text: '#5a3216',
    band: '#fff4e2',
  },
  {
    id: 'navy',
    label: 'Midnight Navy',
    background: { kind: 'radial', color1: '#21345a', color2: '#0a1120', angle: 0, texture: 'grain', textureStrength: 0.25, vignette: 0.3 },
    tile: '#22324f',
    stroke: '#c9ad6a',
    text: '#ecd9a8',
    band: '#0e1729',
  },
  {
    id: 'charcoal',
    label: 'Charcoal Noir',
    background: { kind: 'radial', color1: '#323235', color2: '#0f0f11', angle: 0, texture: 'grain', textureStrength: 0.3, vignette: 0.35 },
    tile: '#2c2c30',
    stroke: '#55555b',
    text: '#f1f1f1',
    band: '#141416',
  },
  {
    id: 'forest',
    label: 'Forest Heritage',
    background: { kind: 'radial', color1: '#33503f', color2: '#122018', angle: 0, texture: 'paper', textureStrength: 0.3, vignette: 0.35 },
    tile: '#36533f',
    stroke: '#cdb77f',
    text: '#eee0bd',
    band: '#14241a',
  },
  {
    id: 'burgundy',
    label: 'Burgundy Velvet',
    background: { kind: 'radial', color1: '#5f2230', color2: '#22080e', angle: 0, texture: 'linen', textureStrength: 0.3, vignette: 0.4 },
    tile: '#6b2b38',
    stroke: '#d8b77c',
    text: '#f4dfc2',
    band: '#2a0b12',
  },
  {
    id: 'slate',
    label: 'Slate Blue',
    background: { kind: 'linear', color1: '#45576b', color2: '#1b232d', angle: 170, texture: 'grain', textureStrength: 0.25, vignette: 0.25 },
    tile: '#4a5c70',
    stroke: '#8fa3b8',
    text: '#eef3f8',
    band: '#1b232d',
  },
]

export const BOX_STYLES: { id: BoxStyle; label: string; hint: string }[] = [
  { id: 'solid', label: 'Solid', hint: 'Filled tiles with crisp edges' },
  { id: 'outlined', label: 'Outlined', hint: 'Tiles framed with a border' },
  { id: 'minimal', label: 'No outline', hint: 'Photos float on the background' },
  { id: 'faded', label: 'Faded', hint: 'Photos fade softly into the background' },
  { id: 'blurred', label: 'Blurred', hint: 'Dreamy blurred edges' },
  { id: 'glass', label: 'Glass', hint: 'Frosted glass tiles with highlights' },
]

export const TONES: { id: Tone; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'mono', label: 'Black & white' },
  { id: 'noir', label: 'Noir' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
]

export const TEXTURES: { id: Texture; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'grain', label: 'Film grain' },
  { id: 'paper', label: 'Paper' },
  { id: 'linen', label: 'Linen' },
]

/** 4x5 colour matrices (row-major, as used by feColorMatrix). */
export const TONE_MATRICES: Record<Tone, number[] | null> = {
  original: null,
  mono: [0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0.2126, 0.7152, 0.0722, 0, 0, 0, 0, 0, 1, 0],
  noir: [0.3, 0.85, 0.1, 0, -0.12, 0.3, 0.85, 0.1, 0, -0.12, 0.3, 0.85, 0.1, 0, -0.12, 0, 0, 0, 1, 0],
  sepia: [0.393, 0.769, 0.189, 0, 0, 0.349, 0.686, 0.168, 0, 0, 0.272, 0.534, 0.131, 0, 0, 0, 0, 0, 1, 0],
  vintage: [0.5, 0.45, 0.12, 0, 0.06, 0.32, 0.6, 0.1, 0, 0.04, 0.24, 0.38, 0.28, 0, 0.03, 0, 0, 0, 1, 0],
  warm: [1.06, 0.02, 0, 0, 0.02, 0, 1.0, 0, 0, 0.01, 0, 0, 0.88, 0, 0, 0, 0, 0, 1, 0],
  cool: [0.92, 0, 0, 0, 0, 0, 1.0, 0.02, 0, 0, 0, 0.03, 1.08, 0, 0.02, 0, 0, 0, 1, 0],
}

export function applyTheme(settings: Settings, theme: ThemePreset): void {
  settings.background = { preset: theme.id, ...theme.background }
  settings.boxes.fill = theme.tile
  settings.boxes.stroke = theme.stroke
  settings.labels.color = theme.text
  settings.labels.bandColor = theme.band
  settings.title.color = theme.text
}

export function defaultSettings(): Settings {
  const theme = THEMES[0]
  const settings: Settings = {
    layout: {
      generations: 5,
      parentSide: 'father',
      span: 220,
      centerRadius: 0.115,
      ringGrowth: 0.08,
      gap: 7,
      cornerRadius: 7,
      photoOrientation: 'upright',
      aspect: 'auto',
      padding: 0.08,
    },
    background: { preset: theme.id, ...theme.background },
    boxes: {
      style: 'solid',
      fill: theme.tile,
      fillOpacity: 1,
      stroke: theme.stroke,
      strokeWidth: 4,
      strokeDash: 'solid',
      feather: 14,
      shadow: 0,
      showEmpty: true,
    },
    photos: { tone: 'original' },
    labels: {
      show: true,
      showDates: true,
      font: 'playfair',
      size: 1,
      color: theme.text,
      style: 'band',
      bandColor: theme.band,
      bandOpacity: 0.72,
      uppercase: false,
    },
    title: {
      show: false,
      text: 'Our Family Tree',
      subtitle: 'Five generations',
      font: 'playfair',
      color: theme.text,
      size: 1,
      position: 'under-hub',
    },
  }
  return settings
}
