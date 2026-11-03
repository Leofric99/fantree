import { FlipHorizontal2, ImagePlus, RotateCcw, Trash2, X, Users } from 'lucide-react'
import { choosePhotoFor, fillEmptySlots, pickFiles, removePhoto } from '../lib/actions'
import { generationOf, relationship, slotCount } from '../lib/geometry'
import { ACCEPTED_TYPES } from '../lib/storage'
import { useStore } from '../lib/store'
import type { Photo } from '../lib/types'
import { Section, Slider, TextField } from './controls'

const pct = (v: number) => `${Math.round(v * 100)}%`

function Overview() {
  const people = useStore((s) => s.project.people)
  const gens = useStore((s) => s.project.settings.layout.generations)
  const total = slotCount(gens)
  let filled = 0
  for (let id = 1; id <= total; id++) if (people[id]?.photo) filled++
  return (
    <div className="inspector-empty">
      <div className="progress-ring" style={{ '--p': filled / total } as React.CSSProperties}>
        <span>
          {filled}
          <small>/{total}</small>
        </span>
      </div>
      <h2>Build your fan</h2>
      <p>Select any frame to add a photo, name and dates. You can also drop a whole folder of photos onto the chart.</p>
      <button
        type="button"
        className="btn btn-primary"
        onClick={async () => {
          const files = await pickFiles(true, ACCEPTED_TYPES)
          if (files.length) await fillEmptySlots(files)
        }}
      >
        <Users size={16} /> Add several photos
      </button>
      <dl className="shortcuts">
        <dt>Drag</dt>
        <dd>Move photo</dd>
        <dt>Scroll</dt>
        <dd>Zoom photo</dd>
        <dt>Arrows</dt>
        <dd>Nudge photo</dd>
        <dt>⌘/Ctrl Z</dt>
        <dd>Undo</dd>
        <dt>Delete</dt>
        <dd>Remove photo</dd>
      </dl>
    </div>
  )
}

export function Inspector() {
  const selected = useStore((s) => s.selected)
  const person = useStore((s) => (s.selected ? s.project.people[s.selected] : undefined))
  const meta = useStore((s) => (person?.photo ? s.images[person.photo.imageId] : undefined))
  const update = useStore((s) => s.update)
  const select = useStore((s) => s.select)

  if (!selected) {
    return (
      <aside className="inspector" aria-label="Frame details">
        <Overview />
      </aside>
    )
  }

  const photo = person?.photo
  const setPerson = (key: 'name' | 'dates', value: string) =>
    update((p) => {
      const target = (p.people[selected] ??= { name: '', dates: '' })
      target[key] = value
    }, `person.${selected}.${key}`)
  const setPhoto = <K extends keyof Photo>(key: K, value: Photo[K]) =>
    update((p) => {
      const ph = p.people[selected]?.photo
      if (ph) ph[key] = value
    }, `photo.${selected}.${key}`)

  const gen = generationOf(selected)

  return (
    <aside className="inspector" aria-label="Frame details">
      <header className="inspector-head">
        <div>
          <span className="eyebrow">
            Generation {gen + 1} · #{selected}
          </span>
          <h2>{person?.name.trim() || relationship(selected)}</h2>
          {person?.name.trim() && <span className="sub">{relationship(selected)}</span>}
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => select(null)}>
          <X size={18} />
        </button>
      </header>

      <Section title="Photo">
        {photo && meta ? (
          <div className="thumb">
            <img src={meta.previewUrl} alt="" />
            <span className="thumb-meta">
              {meta.width} × {meta.height}px
            </span>
          </div>
        ) : (
          <button type="button" className="dropzone" onClick={() => choosePhotoFor(selected)}>
            <ImagePlus size={26} strokeWidth={1.5} />
            <span>Choose a photo</span>
            <small>or drop / paste one onto the frame</small>
          </button>
        )}
        {photo && (
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => choosePhotoFor(selected)}>
              <ImagePlus size={15} /> Replace
            </button>
            <button type="button" className="btn btn-danger" onClick={() => removePhoto(selected)}>
              <Trash2 size={15} /> Remove
            </button>
          </div>
        )}
      </Section>

      {photo && (
        <Section
          title="Position"
          aside={
            <button
              type="button"
              className="link-btn"
              onClick={() =>
                update((p) => {
                  const ph = p.people[selected]?.photo
                  if (ph) Object.assign(ph, { x: 0, y: 0, scale: 1, rotation: 0 })
                })
              }
            >
              <RotateCcw size={13} /> Reset
            </button>
          }
        >
          <Slider label="Zoom" value={photo.scale} min={0.3} max={5} step={0.01} format={pct} onChange={(v) => setPhoto('scale', v)} />
          <Slider label="Rotate" value={photo.rotation} min={-180} max={180} step={0.5} format={(v) => `${v.toFixed(1)}°`} onChange={(v) => setPhoto('rotation', v)} />
          <button type="button" className={`btn btn-ghost${photo.flipX ? ' is-active' : ''}`} onClick={() => setPhoto('flipX', !photo.flipX)}>
            <FlipHorizontal2 size={15} /> Mirror
          </button>
        </Section>
      )}

      {photo && (
        <Section
          title="Adjust"
          aside={
            <button
              type="button"
              className="link-btn"
              onClick={() =>
                update((p) => {
                  const ph = p.people[selected]?.photo
                  if (ph) Object.assign(ph, { brightness: 1, contrast: 1, saturation: 1 })
                })
              }
            >
              <RotateCcw size={13} /> Reset
            </button>
          }
        >
          <Slider label="Brightness" value={photo.brightness} min={0.5} max={1.6} step={0.01} format={pct} onChange={(v) => setPhoto('brightness', v)} />
          <Slider label="Contrast" value={photo.contrast} min={0.5} max={1.8} step={0.01} format={pct} onChange={(v) => setPhoto('contrast', v)} />
          <Slider label="Saturation" value={photo.saturation} min={0} max={2} step={0.01} format={pct} onChange={(v) => setPhoto('saturation', v)} />
        </Section>
      )}

      <Section title="Name (optional)">
        <TextField label="Name" value={person?.name ?? ''} placeholder="e.g. Margaret Hodge" onChange={(v) => setPerson('name', v)} />
        <TextField label="Dates" value={person?.dates ?? ''} placeholder="e.g. 1891 – 1967" onChange={(v) => setPerson('dates', v)} />
      </Section>
    </aside>
  )
}
