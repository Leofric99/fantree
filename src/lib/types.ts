/** Ahnentafel number: 1 = centre person, 2 = father, 3 = mother, 2n / 2n+1 = parents of n. */
export type SlotId = number

export interface Photo {
  imageId: string
  /**
   * Offset of the photo centre from the frame centre (frame-local axes), in multiples of the
   * photo's displayed long side, so placement survives layout changes. See lib/photo.ts.
   */
  x: number
  y: number
  /** 1 = photo exactly covers the frame. */
  scale: number
  rotation: number
  brightness: number
  contrast: number
  saturation: number
  flipX: boolean
}

export interface Person {
  name: string
  dates: string
  photo?: Photo
}

export type BoxStyle = 'solid' | 'outlined' | 'minimal' | 'faded' | 'blurred' | 'glass'
export type BackgroundKind = 'solid' | 'linear' | 'radial'
export type Texture = 'none' | 'grain' | 'paper' | 'linen'
export type Tone = 'original' | 'mono' | 'noir' | 'sepia' | 'vintage' | 'warm' | 'cool'
export type LabelStyle = 'halo' | 'band' | 'plain'
export type Aspect = 'auto' | '16:9' | '3:2' | '4:3' | '1:1' | 'A-landscape' | 'A-portrait'
export type StrokeDash = 'solid' | 'dashed' | 'dotted'
export type FontId =
  | 'playfair'
  | 'cormorant'
  | 'lora'
  | 'cinzel'
  | 'greatvibes'
  | 'inter'
  | 'montserrat'

export interface Settings {
  layout: {
    generations: number
    /** Degrees covered by the fan. */
    span: number
    /** Centre circle radius as a fraction of the outer radius. */
    centerRadius: number
    /** How much thicker each successive ring is (0 = equal). */
    ringGrowth: number
    gap: number
    cornerRadius: number
    photoOrientation: 'upright' | 'radial'
    aspect: Aspect
    padding: number
  }
  background: {
    preset: string
    kind: BackgroundKind
    color1: string
    color2: string
    angle: number
    texture: Texture
    textureStrength: number
    vignette: number
  }
  boxes: {
    style: BoxStyle
    fill: string
    fillOpacity: number
    stroke: string
    strokeWidth: number
    strokeDash: StrokeDash
    feather: number
    shadow: number
    /** Draw frames that have no photo. When false they are left out of exports entirely. */
    showEmpty: boolean
  }
  photos: {
    tone: Tone
  }
  labels: {
    show: boolean
    showDates: boolean
    font: FontId
    size: number
    color: string
    style: LabelStyle
    bandColor: string
    bandOpacity: number
    uppercase: boolean
  }
  title: {
    show: boolean
    text: string
    subtitle: string
    font: FontId
    color: string
    size: number
    position: 'under-hub' | 'bottom'
  }
}

export interface Project {
  /** 1 = photo offsets in absolute chart units (legacy); 2 = offsets relative to photo size. */
  version: 1 | 2
  settings: Settings
  people: Record<SlotId, Person>
}

export interface ImageMeta {
  id: string
  width: number
  height: number
  previewUrl: string
  mime: string
}
