import type { SlotGeom } from './geometry'
import type { ImageMeta, Photo } from './types'

type Frame = Pick<SlotGeom, 'box'>
type Dims = Pick<ImageMeta, 'width' | 'height'>

/**
 * Photo placement is resolution- and frame-size-independent:
 *  - `scale` 1 means the photo just covers the frame's bounding box;
 *  - `x`/`y` are offsets of the photo centre from the frame centre, measured in multiples of the
 *    photo's displayed long side. Because that length grows and shrinks with the frame, the same
 *    point of the picture stays centred at the same relative zoom whenever the layout changes.
 */
export function coverScale(frame: Frame, meta: Dims): number {
  return Math.max(frame.box.w / meta.width, frame.box.h / meta.height)
}

/** Chart units represented by one unit of `photo.x` / `photo.y`. */
export function offsetUnit(frame: Frame, meta: Dims, scale: number): number {
  return coverScale(frame, meta) * scale * Math.max(meta.width, meta.height)
}

export function photoPlacement(frame: Frame, photo: Photo, meta: Dims) {
  const s = coverScale(frame, meta) * photo.scale
  const unit = s * Math.max(meta.width, meta.height)
  return {
    w: meta.width * s,
    h: meta.height * s,
    cx: frame.box.x + frame.box.w / 2 + photo.x * unit,
    cy: frame.box.y + frame.box.h / 2 + photo.y * unit,
    unit,
  }
}

/** Convert a version-1 placement (offsets in absolute chart units) to the current relative form. */
export function fromAbsoluteOffsets(photo: Photo, frame: Frame, meta: Dims): Photo {
  const unit = offsetUnit(frame, meta, photo.scale)
  return unit > 0 ? { ...photo, x: photo.x / unit, y: photo.y / unit } : { ...photo, x: 0, y: 0 }
}
