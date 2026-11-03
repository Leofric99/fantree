import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { assignFile, choosePhotoFor, fillEmptySlots } from '../lib/actions'
import { useGeometry } from '../lib/hooks'
import { offsetUnit } from '../lib/photo'
import { useStore } from '../lib/store'
import type { SlotId } from '../lib/types'
import { FanChart } from './FanChart'

interface Drag {
  slot: SlotId
  pointerId: number
  startX: number
  startY: number
  photoX: number
  photoY: number
  moved: boolean
  hadPhoto: boolean
  key: string
}

let dragSeq = 0

function slotFromEvent(target: EventTarget | null): SlotId | null {
  const el = (target as Element | null)?.closest?.('[data-slot]')
  return el ? Number(el.getAttribute('data-slot')) : null
}

export function Stage({ svgRef }: { svgRef: React.RefObject<SVGSVGElement | null> }) {
  const settings = useStore((s) => s.project.settings)
  const people = useStore((s) => s.project.people)
  const images = useStore((s) => s.images)
  const selected = useStore((s) => s.selected)
  const zoom = useStore((s) => s.zoom)
  const geom = useGeometry()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 800, h: 600 })
  const [dropTarget, setDropTarget] = useState<SlotId | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const drag = useRef<Drag | null>(null)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBox({ w: entry.contentRect.width, h: entry.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const vb = geom.viewBox
  // contentRect already excludes the scroller's padding.
  const fit = Math.min(box.w / vb.w, box.h / vb.h)
  const width = Math.max(100, vb.w * fit * zoom)
  const height = Math.max(100, vb.h * fit * zoom)

  const unitsPerPx = () => {
    const rect = svgRef.current?.getBoundingClientRect()
    return rect ? vb.w / rect.width : 1
  }

  // Wheel needs a non-passive listener so we can prevent page scroll while zooming a photo.
  useEffect(() => {
    const svg = svgRef.current
    const scroller = scrollRef.current
    if (!svg || !scroller) return
    const onWheel = (e: WheelEvent) => {
      const { selected: sel, project, update, setZoom, zoom: z } = useStore.getState()
      const slot = slotFromEvent(e.target)
      if (slot && slot === sel && project.people[slot]?.photo) {
        e.preventDefault()
        const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))
        update((p) => {
          const ph = p.people[slot]?.photo
          if (ph) ph.scale = Math.min(6, Math.max(0.2, ph.scale * factor))
        }, `wheel-${slot}`)
      } else if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        setZoom(z * Math.exp(-e.deltaY * 0.01))
      }
    }
    scroller.addEventListener('wheel', onWheel, { passive: false })
    return () => scroller.removeEventListener('wheel', onWheel)
  }, [svgRef])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const slot = slotFromEvent(e.target)
    const state = useStore.getState()
    if (!slot) {
      state.select(null)
      return
    }
    const photo = state.project.people[slot]?.photo
    state.select(slot)
    drag.current = {
      slot,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      photoX: photo?.x ?? 0,
      photoY: photo?.y ?? 0,
      moved: false,
      hadPhoto: !!photo,
      key: `drag-${++dragSeq}`,
    }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId || !d.hadPhoto) return
    const dxPx = e.clientX - d.startX
    const dyPx = e.clientY - d.startY
    if (!d.moved && Math.hypot(dxPx, dyPx) < 3) return
    d.moved = true
    const k = unitsPerPx()
    const slot = geom.byId.get(d.slot)!
    const t = (-slot.frameRot * Math.PI) / 180
    const dx = dxPx * k
    const dy = dyPx * k
    const lx = dx * Math.cos(t) - dy * Math.sin(t)
    const ly = dx * Math.sin(t) + dy * Math.cos(t)
    const { project, images } = useStore.getState()
    const ph0 = project.people[d.slot]?.photo
    const meta = ph0 && images[ph0.imageId]
    if (!ph0 || !meta) return
    const unit = offsetUnit(slot, meta, ph0.scale)
    useStore.getState().update((p) => {
      const ph = p.people[d.slot]?.photo
      if (ph) {
        ph.x = d.photoX + lx / unit
        ph.y = d.photoY + ly / unit
      }
    }, d.key)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d || d.pointerId !== e.pointerId) return
    if (!d.moved && !d.hadPhoto) void choosePhotoFor(d.slot)
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const slot = slotFromEvent(e.target)
    if (slot && useStore.getState().project.people[slot]?.photo) void choosePhotoFor(slot)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const slot = slotFromEvent(e.target)
    if (!slot) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      useStore.getState().select(slot)
      if (!useStore.getState().project.people[slot]?.photo) void choosePhotoFor(slot)
    }
  }

  const onFocus = (e: React.FocusEvent) => {
    const slot = slotFromEvent(e.target)
    if (slot && e.target.matches(':focus-visible')) useStore.getState().select(slot)
  }

  const slotAtPoint = (x: number, y: number) => slotFromEvent(document.elementFromPoint(x, y))

  const onDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
    setDropTarget(slotAtPoint(e.clientX, e.clientY))
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const target = slotAtPoint(e.clientX, e.clientY)
    setDropTarget(null)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif|avif)$/i.test(f.name))
    if (!files.length) return
    if (files.length === 1 && target) await assignFile(target, files[0])
    else await fillEmptySlots(files, target ?? undefined)
  }

  return (
    <main
      className={`stage${dragOver ? ' is-dragover' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragOver(false)
          setDropTarget(null)
        }
      }}
      onDrop={onDrop}
    >
      <div className="stage-scroll" ref={scrollRef}>
        <div
          className="stage-canvas"
          style={{ width, height, minWidth: width, minHeight: height }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          onDoubleClick={onDoubleClick}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
        >
          <FanChart
            svgRef={svgRef}
            geom={geom}
            settings={settings}
            people={people}
            images={images}
            selected={selected}
            dropTarget={dropTarget}
          />
        </div>
      </div>
      {dragOver && (
        <div className="drop-hint" aria-hidden="true">
          {dropTarget ? 'Drop to place photo here' : 'Drop photos to fill empty frames'}
        </div>
      )}
    </main>
  )
}
