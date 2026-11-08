import { Image as ImageIcon, LayoutGrid, Palette, Square, Type, Heading } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../lib/store'
import { setParentSide } from '../lib/actions'
import { TreeNavigator } from './TreeNavigator'
import { MAX_LABEL_SCALE } from '../lib/labels'
import { applyTheme, BOX_STYLES, FONTS, THEMES, TEXTURES, TONES } from '../lib/themes'
import type { Aspect, BackgroundKind, BoxStyle, FontId, LabelStyle, Settings, StrokeDash, Texture, Tone } from '../lib/types'
import { ColorField, Section, Segmented, Select, Slider, TextField, Toggle } from './controls'

type Tab = 'layout' | 'background' | 'frames' | 'photos' | 'labels' | 'title'

const TABS: { id: Tab; label: string; icon: typeof Palette }[] = [
  { id: 'background', label: 'Theme', icon: Palette },
  { id: 'frames', label: 'Frames', icon: Square },
  { id: 'photos', label: 'Photos', icon: ImageIcon },
  { id: 'labels', label: 'Names', icon: Type },
  { id: 'title', label: 'Title', icon: Heading },
  { id: 'layout', label: 'Layout', icon: LayoutGrid },
]

const FONT_OPTIONS = Object.values(FONTS).map((f) => ({ id: f.id, label: f.label }))
const pct = (v: number) => `${Math.round(v * 100)}%`

function useSetter() {
  const update = useStore((s) => s.update)
  return function set<G extends keyof Settings, K extends keyof Settings[G]>(group: G, key: K, value: Settings[G][K]) {
    update((p) => {
      ;(p.settings[group] as Settings[G])[key] = value
      if (group === 'background' && key !== 'preset') p.settings.background.preset = 'custom'
    }, `${group}.${String(key)}`)
  }
}

function themeCss(t: (typeof THEMES)[number]) {
  const b = t.background
  if (b.kind === 'solid') return b.color1
  if (b.kind === 'linear') return `linear-gradient(${b.angle}deg, ${b.color1}, ${b.color2})`
  return `radial-gradient(circle at 50% 42%, ${b.color1}, ${b.color2})`
}

function BackgroundPanel({ s }: { s: Settings }) {
  const set = useSetter()
  const update = useStore((st) => st.update)
  const bg = s.background
  return (
    <>
      <Section title="Theme presets">
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`theme-card${bg.preset === t.id ? ' is-active' : ''}`}
              onClick={() => update((p) => applyTheme(p.settings, t))}
              aria-pressed={bg.preset === t.id}
            >
              <span className="theme-swatch" style={{ background: themeCss(t) }}>
                <span className="theme-tile" style={{ background: t.tile, borderColor: t.stroke }} />
                <span className="theme-text" style={{ color: t.text }}>
                  Aa
                </span>
              </span>
              <span className="theme-name">{t.label}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Background">
        <Segmented<BackgroundKind>
          label="Fill"
          value={bg.kind}
          onChange={(v) => set('background', 'kind', v)}
          options={[
            { id: 'solid', label: 'Solid' },
            { id: 'linear', label: 'Linear' },
            { id: 'radial', label: 'Radial' },
          ]}
        />
        <div className="grid-2">
          <ColorField label={bg.kind === 'solid' ? 'Colour' : 'Colour 1'} value={bg.color1} onChange={(v) => set('background', 'color1', v)} />
          {bg.kind !== 'solid' && <ColorField label="Colour 2" value={bg.color2} onChange={(v) => set('background', 'color2', v)} />}
        </div>
        {bg.kind === 'linear' && (
          <Slider label="Angle" value={bg.angle} min={0} max={360} onChange={(v) => set('background', 'angle', v)} format={(v) => `${Math.round(v)}°`} />
        )}
        <Select<Texture> label="Texture" value={bg.texture} options={TEXTURES} onChange={(v) => set('background', 'texture', v)} />
        {bg.texture !== 'none' && (
          <Slider label="Texture strength" value={bg.textureStrength} min={0} max={1} step={0.01} format={pct} onChange={(v) => set('background', 'textureStrength', v)} />
        )}
        <Slider label="Vignette" value={bg.vignette} min={0} max={0.8} step={0.01} format={pct} onChange={(v) => set('background', 'vignette', v)} />
      </Section>
    </>
  )
}

function StyleIcon({ style }: { style: BoxStyle }) {
  const d = 'M6 30 L10 10 Q11 7 14 7 L34 7 Q37 7 38 10 L42 30 Q30 26 24 26 Q18 26 6 30 Z'
  return (
    <svg viewBox="0 0 48 36" aria-hidden="true" className="style-icon">
      <defs>
        <filter id={`si-${style}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={style === 'blurred' ? 1.6 : 3} />
        </filter>
      </defs>
      {style === 'solid' && <path d={d} fill="currentColor" opacity="0.55" />}
      {style === 'outlined' && <path d={d} fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="2" />}
      {style === 'minimal' && <path d={d} fill="none" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.6" />}
      {style === 'faded' && <path d={d} fill="currentColor" opacity="0.6" filter={`url(#si-${style})`} />}
      {style === 'blurred' && <path d={d} fill="currentColor" opacity="0.7" filter={`url(#si-${style})`} />}
      {style === 'glass' && (
        <>
          <path d={d} fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeOpacity="0.7" strokeWidth="1" />
          <path d="M12 10 L34 10" stroke="currentColor" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  )
}

function FramesPanel({ s }: { s: Settings }) {
  const set = useSetter()
  const b = s.boxes
  return (
    <>
      <Section title="Frame style">
        <div className="style-grid">
          {BOX_STYLES.map((st) => (
            <button
              key={st.id}
              type="button"
              className={`style-card${b.style === st.id ? ' is-active' : ''}`}
              onClick={() => set('boxes', 'style', st.id)}
              aria-pressed={b.style === st.id}
              title={st.hint}
            >
              <StyleIcon style={st.id} />
              <span>{st.label}</span>
            </button>
          ))}
        </div>
        <p className="hint">{BOX_STYLES.find((x) => x.id === b.style)?.hint}</p>
      </Section>
      <Section title="Appearance">
        {b.style !== 'minimal' && (
          <Toggle
            label="Show empty frames"
            checked={b.showEmpty}
            onChange={(v) => set('boxes', 'showEmpty', v)}
            hint="Off: frames without a photo are invisible in the export"
          />
        )}
        {b.style !== 'minimal' && (
          <>
            {b.showEmpty && <ColorField label="Empty frame colour" value={b.fill} onChange={(v) => set('boxes', 'fill', v)} />}
            <Slider label="Frame opacity" value={b.fillOpacity} min={0} max={1} step={0.01} format={pct} onChange={(v) => set('boxes', 'fillOpacity', v)} />
          </>
        )}
        {(b.style === 'outlined' || b.style === 'glass') && (
          <>
            {b.style === 'outlined' && <ColorField label="Outline colour" value={b.stroke} onChange={(v) => set('boxes', 'stroke', v)} />}
            <Slider label="Outline width" value={b.strokeWidth} min={0.5} max={16} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => set('boxes', 'strokeWidth', v)} />
            {b.style === 'outlined' && (
              <Segmented<StrokeDash>
                label="Outline pattern"
                value={b.strokeDash}
                onChange={(v) => set('boxes', 'strokeDash', v)}
                options={[
                  { id: 'solid', label: 'Solid' },
                  { id: 'dashed', label: 'Dashed' },
                  { id: 'dotted', label: 'Dotted' },
                ]}
              />
            )}
          </>
        )}
        {(b.style === 'faded' || b.style === 'blurred') && (
          <Slider label="Softness" value={b.feather} min={2} max={40} onChange={(v) => set('boxes', 'feather', v)} />
        )}
        {b.style !== 'faded' && b.style !== 'blurred' && (
          <Slider label="Drop shadow" value={b.shadow} min={0} max={1} step={0.01} format={pct} onChange={(v) => set('boxes', 'shadow', v)} />
        )}
      </Section>
      <Section title="Shape">
        <Slider label="Gap between frames" value={s.layout.gap} min={0} max={30} step={0.5} format={(v) => v.toFixed(1)} onChange={(v) => set('layout', 'gap', v)} />
        <Slider label="Corner rounding" value={s.layout.cornerRadius} min={0} max={40} onChange={(v) => set('layout', 'cornerRadius', v)} />
      </Section>
    </>
  )
}

function PhotosPanel({ s }: { s: Settings }) {
  const set = useSetter()
  return (
    <>
      <Section title="Photo tone">
        <div className="tone-grid">
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tone-card tone-${t.id}${s.photos.tone === t.id ? ' is-active' : ''}`}
              onClick={() => set('photos', 'tone', t.id as Tone)}
              aria-pressed={s.photos.tone === t.id}
            >
              <span className="tone-swatch" />
              {t.label}
            </button>
          ))}
        </div>
        <p className="hint">Unify old and new photos with a consistent finish. Applies to every photo.</p>
      </Section>
      <Section title="Photo orientation">
        <Segmented
          value={s.layout.photoOrientation}
          onChange={(v) => set('layout', 'photoOrientation', v)}
          options={[
            { id: 'upright', label: 'Upright' },
            { id: 'radial', label: 'Follow the fan' },
          ]}
        />
      </Section>
      <Section title="Tips">
        <ul className="tips">
          <li>Click an empty frame or drop a photo onto it.</li>
          <li>Drop many photos at once to fill empty frames from the centre outwards.</li>
          <li>Drag a photo to reposition it; scroll over it to zoom.</li>
          <li>Paste (⌘/Ctrl + V) an image into the selected frame.</li>
        </ul>
      </Section>
    </>
  )
}

function LabelsPanel({ s }: { s: Settings }) {
  const set = useSetter()
  const l = s.labels
  return (
    <>
      <Section title="Names">
        <Toggle label="Show names" checked={l.show} onChange={(v) => set('labels', 'show', v)} hint="Select a frame to type a name" />
        <Toggle label="Show dates" checked={l.showDates} onChange={(v) => set('labels', 'showDates', v)} />
        <Toggle label="Uppercase" checked={l.uppercase} onChange={(v) => set('labels', 'uppercase', v)} />
      </Section>
      <Section title="Typography">
        <Select<FontId> label="Font" value={l.font} options={FONT_OPTIONS} onChange={(v) => set('labels', 'font', v)} />
        <Slider label="Size for all names" value={l.size} min={0.2} max={MAX_LABEL_SCALE} step={0.01} format={pct} onChange={(v) => set('labels', 'size', v)} />
        <p className="hint">Scales the overlay and text with each frame. Long names wrap to fit.</p>
        <ColorField label="Text colour" value={l.color} onChange={(v) => set('labels', 'color', v)} />
      </Section>
      <Section title="Legibility">
        <Segmented<LabelStyle>
          label="Backing"
          value={l.style}
          onChange={(v) => set('labels', 'style', v)}
          options={[
            { id: 'band', label: 'Band' },
            { id: 'halo', label: 'Halo' },
            { id: 'plain', label: 'None' },
          ]}
        />
        {l.style !== 'plain' && (
          <>
            <ColorField label="Backing colour" value={l.bandColor} onChange={(v) => set('labels', 'bandColor', v)} />
            <Slider label="Backing opacity" value={l.bandOpacity} min={0} max={1} step={0.01} format={pct} onChange={(v) => set('labels', 'bandOpacity', v)} />
          </>
        )}
      </Section>
    </>
  )
}

function TitlePanel({ s }: { s: Settings }) {
  const set = useSetter()
  const t = s.title
  return (
    <Section title="Chart title">
      <Toggle label="Show title" checked={t.show} onChange={(v) => set('title', 'show', v)} />
      {t.show && (
        <>
          <TextField label="Title" value={t.text} onChange={(v) => set('title', 'text', v)} placeholder="The Smith Family" />
          <TextField label="Subtitle" value={t.subtitle} onChange={(v) => set('title', 'subtitle', v)} placeholder="Five generations" />
          <Select<FontId> label="Font" value={t.font} options={FONT_OPTIONS} onChange={(v) => set('title', 'font', v)} />
          <Slider label="Size" value={t.size} min={0.4} max={2.5} step={0.01} format={pct} onChange={(v) => set('title', 'size', v)} />
          <ColorField label="Colour" value={t.color} onChange={(v) => set('title', 'color', v)} />
          <Segmented
            label="Position"
            value={t.position}
            onChange={(v) => set('title', 'position', v)}
            options={[
              { id: 'under-hub', label: 'Under centre' },
              { id: 'bottom', label: 'Below chart' },
            ]}
          />
        </>
      )}
    </Section>
  )
}

function LayoutPanel({ s }: { s: Settings }) {
  const set = useSetter()
  const l = s.layout
  return (
    <>
      <Section title="Centre person">
        <TreeNavigator />
      </Section>
      <Section title="Parent order">
        <Segmented
          label="Left side of each parent pair"
          value={l.parentSide}
          onChange={setParentSide}
          options={[
            { id: 'father', label: 'Father' },
            { id: 'mother', label: 'Mother' },
          ]}
        />
        <p className="hint">Choose which parent is on the left. Existing photos stay in place and their relationships update.</p>
      </Section>
      <Section title="Structure">
        <Slider label="Generations" value={l.generations} min={0} max={6} onChange={(v) => set('layout', 'generations', v)} format={(v) => `${v} (${Math.pow(2, v + 1) - 1} frames)`} />
        <Slider label="Fan angle" value={l.span} min={160} max={360} onChange={(v) => set('layout', 'span', v)} format={(v) => `${Math.round(v)}°`} />
        <Slider label="Centre size" value={l.centerRadius} min={0.06} max={0.3} step={0.005} format={pct} onChange={(v) => set('layout', 'centerRadius', v)} />
        <Slider label="Outer ring emphasis" value={l.ringGrowth} min={-0.2} max={0.4} step={0.01} format={(v) => (v >= 0 ? '+' : '') + pct(v)} onChange={(v) => set('layout', 'ringGrowth', v)} />
      </Section>
      <Section title="Canvas">
        <Select<Aspect>
          label="Aspect ratio"
          value={l.aspect}
          onChange={(v) => set('layout', 'aspect', v)}
          options={[
            { id: 'auto', label: 'Fit to chart' },
            { id: '16:9', label: '16:9 — screens & TVs' },
            { id: '3:2', label: '3:2 — photo print' },
            { id: '4:3', label: '4:3' },
            { id: '1:1', label: '1:1 — square' },
            { id: 'A-landscape', label: 'A-series landscape (A4/A3…)' },
            { id: 'A-portrait', label: 'A-series portrait' },
          ]}
        />
        <Slider label="Margin" value={l.padding} min={0} max={0.3} step={0.005} format={pct} onChange={(v) => set('layout', 'padding', v)} />
      </Section>
    </>
  )
}

export function Sidebar() {
  const [tab, setTab] = useState<Tab>('background')
  const settings = useStore((s) => s.project.settings)
  return (
    <aside className="sidebar" aria-label="Design settings">
      <nav className="tabs" role="tablist">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            className={tab === id ? 'is-active' : ''}
            onClick={() => setTab(id)}
          >
            <Icon size={17} strokeWidth={1.7} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="panel" role="tabpanel">
        {tab === 'background' && <BackgroundPanel s={settings} />}
        {tab === 'frames' && <FramesPanel s={settings} />}
        {tab === 'photos' && <PhotosPanel s={settings} />}
        {tab === 'labels' && <LabelsPanel s={settings} />}
        {tab === 'title' && <TitlePanel s={settings} />}
        {tab === 'layout' && <LayoutPanel s={settings} />}
      </div>
    </aside>
  )
}
