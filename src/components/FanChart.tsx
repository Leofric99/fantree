import { memo, type ReactNode } from 'react'
import { insetPath, type ChartGeom, type SlotGeom } from '../lib/geometry'
import { arcPath, centerBandPath, layoutLabel, type LabelLayout } from '../lib/labels'
import { textureTile, TEXTURE_TILE_UNITS } from '../lib/textures'
import { photoPlacement } from '../lib/photo'
import { FONTS, fontStack, TONE_MATRICES } from '../lib/themes'
import type { ImageMeta, Person, Photo, Settings, SlotId } from '../lib/types'

interface Props {
  geom: ChartGeom
  settings: Settings
  people: Record<SlotId, Person>
  images: Record<string, ImageMeta>
  selected: SlotId | null
  dropTarget: SlotId | null
  svgRef?: React.Ref<SVGSVGElement>
}

const P = 'ft'

function needsPhotoFilter(photo: Photo, settings: Settings) {
  return (
    settings.photos.tone !== 'original' || photo.brightness !== 1 || photo.contrast !== 1 || photo.saturation !== 1
  )
}

function PhotoFilter({ id, photo, settings, blur }: { id: string; photo: Photo; settings: Settings; blur?: number }) {
  const matrix = TONE_MATRICES[settings.photos.tone]
  const slope = photo.contrast * photo.brightness
  const intercept = (0.5 - 0.5 * photo.contrast) * photo.brightness
  return (
    <filter id={id} colorInterpolationFilters="sRGB" x="-20%" y="-20%" width="140%" height="140%">
      <feColorMatrix type="saturate" values={String(photo.saturation)} />
      {matrix && <feColorMatrix type="matrix" values={matrix.join(' ')} />}
      <feComponentTransfer>
        <feFuncR type="linear" slope={slope} intercept={intercept} />
        <feFuncG type="linear" slope={slope} intercept={intercept} />
        <feFuncB type="linear" slope={slope} intercept={intercept} />
      </feComponentTransfer>
      {blur ? <feGaussianBlur stdDeviation={blur} /> : null}
    </filter>
  )
}

const PhotoImage = memo(function PhotoImage({
  slot,
  photo,
  meta,
  filter,
}: {
  slot: SlotGeom
  photo: Photo
  meta: ImageMeta
  filter?: string
}) {
  const { w, h, cx: icx, cy: icy } = photoPlacement(slot, photo, meta)
  return (
    <g transform={`translate(${slot.cx} ${slot.cy}) rotate(${slot.frameRot})`}>
      <g transform={`translate(${icx} ${icy}) rotate(${photo.rotation}) scale(${photo.flipX ? -1 : 1} 1)`}>
        <image
          href={meta.previewUrl}
          data-image-id={meta.id}
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          preserveAspectRatio="none"
          filter={filter ? `url(#${filter})` : undefined}
        />
      </g>
    </g>
  )
})

function Label({ slot, layout, settings }: { slot: SlotGeom; layout: LabelLayout; settings: Settings }) {
  const { labels } = settings
  const family = fontStack(labels.font)
  const halo =
    labels.style === 'halo'
      ? { stroke: labels.bandColor, strokeOpacity: labels.bandOpacity, strokeLinejoin: 'round' as const, paintOrder: 'stroke' }
      : {}
  const band = labels.style === 'band'
  const clip = `url(#${P}-clip-${slot.id})`

  if (layout.mode === 'arc') {
    return (
      <g>
        {band && (layout.band.rounded ? (
          <path
            clipPath={clip}
            d={centerBandPath(layout.band.r, layout.band.width, layout.band.a0!, layout.band.a1!)}
            fill={labels.bandColor}
            fillOpacity={labels.bandOpacity}
          />
        ) : (
          <path
            clipPath={clip}
            d={arcPath(layout.band.r, layout.a0 - 0.2, layout.a1 + 0.2, false)}
            fill="none"
            stroke={labels.bandColor}
            strokeOpacity={labels.bandOpacity}
            strokeWidth={layout.band.width}
          />
        ))}
        {layout.lines.map((line, i) => {
          const id = `${P}-lbl-${slot.id}-${i}`
          return (
            <g key={i}>
              <path id={id} d={arcPath(line.pos, layout.a0 - 0.15, layout.a1 + 0.15, layout.flipped)} fill="none" />
              <text
                fontFamily={family}
                fontSize={line.size}
                fontWeight={line.weight}
                fill={labels.color}
                strokeWidth={line.size * 0.22}
                letterSpacing={labels.uppercase ? line.size * 0.06 : undefined}
                {...halo}
              >
                <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
                  {line.text}
                </textPath>
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  return (
    <g>
      {band && (
        <g clipPath={clip}>
          <rect
            transform={`translate(${layout.x} ${layout.y}) rotate(${layout.rot})`}
            x={-layout.band.width / 2}
            y={layout.band.y}
            width={layout.band.width}
            height={layout.band.height}
            fill={labels.bandColor}
            fillOpacity={labels.bandOpacity}
          />
        </g>
      )}
      <g transform={`translate(${layout.x} ${layout.y}) rotate(${layout.rot})`}>
        {layout.lines.map((line, i) => (
          <text
            key={i}
            x={0}
            y={line.pos}
            textAnchor="middle"
            fontFamily={family}
            fontSize={line.size}
            fontWeight={line.weight}
            fill={labels.color}
            strokeWidth={line.size * 0.22}
            letterSpacing={labels.uppercase ? line.size * 0.06 : undefined}
            {...halo}
          >
            {line.text}
          </text>
        ))}
      </g>
    </g>
  )
}

function Background({ settings, geom }: { settings: Settings; geom: ChartGeom }) {
  const bg = settings.background
  const vb = geom.viewBox
  const tile = textureTile(bg.texture)
  const tileUnits = TEXTURE_TILE_UNITS[bg.texture]
  let fill = bg.color1
  let def: ReactNode = null
  if (bg.kind === 'linear') {
    fill = `url(#${P}-bg)`
    def = (
      <linearGradient id={`${P}-bg`} gradientTransform={`rotate(${bg.angle - 90} 0.5 0.5)`}>
        <stop offset="0" stopColor={bg.color1} />
        <stop offset="1" stopColor={bg.color2} />
      </linearGradient>
    )
  } else if (bg.kind === 'radial') {
    fill = `url(#${P}-bg)`
    def = (
      <radialGradient id={`${P}-bg`} cx="0.5" cy="0.42" r="0.75">
        <stop offset="0" stopColor={bg.color1} />
        <stop offset="1" stopColor={bg.color2} />
      </radialGradient>
    )
  }
  return (
    <g data-bg="">
      <defs>
        {def}
        {tile && (
          <pattern id={`${P}-tex`} patternUnits="userSpaceOnUse" width={tileUnits} height={tileUnits}>
            <image href={tile} width={tileUnits} height={tileUnits} preserveAspectRatio="none" />
          </pattern>
        )}
        <radialGradient id={`${P}-vig`} cx="0.5" cy="0.5" r="0.72">
          <stop offset="0.5" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="1" />
        </radialGradient>
      </defs>
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={fill} />
      {tile && bg.textureStrength > 0 && (
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${P}-tex)`} opacity={bg.textureStrength} />
      )}
      {bg.vignette > 0 && (
        <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={`url(#${P}-vig)`} opacity={bg.vignette} />
      )}
    </g>
  )
}

export function FanChart({ geom, settings, people, images, selected, dropTarget, svgRef }: Props) {
  const { boxes, layout, title } = settings
  const style = boxes.style
  const vb = geom.viewBox
  const f = boxes.feather
  const region = { x: vb.x - 200, y: vb.y - 200, width: vb.w + 400, height: vb.h + 400 }

  const slotPhotos = geom.slots.map((slot) => {
    const photo = people[slot.id]?.photo
    const meta = photo ? images[photo.imageId] : undefined
    return { slot, photo: meta ? photo : undefined, meta }
  })
  // Frames that are drawn at all; hidden empty frames only get an editor-only placeholder.
  const hideEmpty = style === 'minimal' || !boxes.showEmpty
  const visibleSlots = hideEmpty ? slotPhotos.filter((sp) => sp.photo).map((sp) => sp.slot) : geom.slots

  const dash =
    boxes.strokeDash === 'dashed'
      ? `${boxes.strokeWidth * 4} ${boxes.strokeWidth * 2.5}`
      : boxes.strokeDash === 'dotted'
        ? `0.01 ${boxes.strokeWidth * 2.2}`
        : undefined

  const tiles = (
    <g>
      {visibleSlots.map((slot) => {
        if (style === 'minimal') return null
        if (style === 'faded')
          return (
            <path
              key={slot.id}
              d={insetPath(slot, layout, f * 0.6)}
              fill={boxes.fill}
              fillOpacity={boxes.fillOpacity * 0.85}
              filter={`url(#${P}-soft)`}
            />
          )
        if (style === 'blurred')
          return (
            <path
              key={slot.id}
              d={insetPath(slot, layout, f * 0.3)}
              fill={boxes.fill}
              fillOpacity={boxes.fillOpacity}
              filter={`url(#${P}-soft)`}
            />
          )
        if (style === 'glass')
          return (
            <g key={slot.id}>
              <path d={slot.path} fill={boxes.fill} fillOpacity={boxes.fillOpacity * 0.45} />
              <path d={slot.path} fill={`url(#${P}-glass)`} />
            </g>
          )
        return <path key={slot.id} d={slot.path} fill={boxes.fill} fillOpacity={boxes.fillOpacity} />
      })}
    </g>
  )

  const photos = (
    <g>
      {slotPhotos.map(({ slot, photo, meta }) => {
        if (!photo || !meta) return null
        const filt = needsPhotoFilter(photo, settings) ? `${P}-pf-${slot.id}` : undefined
        if (style === 'faded')
          return (
            <g key={slot.id} mask={`url(#${P}-mfade-${slot.id})`}>
              <PhotoImage slot={slot} photo={photo} meta={meta} filter={filt} />
            </g>
          )
        if (style === 'blurred')
          return (
            <g key={slot.id}>
              <g mask={`url(#${P}-mouter-${slot.id})`}>
                <PhotoImage slot={slot} photo={photo} meta={meta} filter={`${P}-pb-${slot.id}`} />
              </g>
              <g mask={`url(#${P}-minner-${slot.id})`}>
                <PhotoImage slot={slot} photo={photo} meta={meta} filter={filt} />
              </g>
            </g>
          )
        return (
          <g key={slot.id} clipPath={`url(#${P}-clip-${slot.id})`}>
            <PhotoImage slot={slot} photo={photo} meta={meta} filter={filt} />
          </g>
        )
      })}
    </g>
  )

  const strokes =
    style === 'outlined' && boxes.strokeWidth > 0 ? (
      <g fill="none" stroke={boxes.stroke} strokeWidth={boxes.strokeWidth} strokeDasharray={dash} strokeLinecap="round" strokeLinejoin="round">
        {visibleSlots.map((slot) => (
          <path key={slot.id} d={slot.path} />
        ))}
      </g>
    ) : style === 'glass' ? (
      <g fill="none">
        {visibleSlots.map((slot) => (
          <g key={slot.id} clipPath={`url(#${P}-clip-${slot.id})`}>
            <path d={slot.path} stroke="#fff" strokeOpacity={0.75} strokeWidth={Math.max(2, boxes.strokeWidth) * 1.2} />
          </g>
        ))}
      </g>
    ) : null

  const shadow = boxes.shadow > 0 && style !== 'faded' && style !== 'blurred'

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
      className="fan-svg"
      role="img"
      aria-label="Family fan chart"
    >
      <Background settings={settings} geom={geom} />
      <defs>
        {geom.slots.map((slot) => (
          <clipPath key={slot.id} id={`${P}-clip-${slot.id}`}>
            <path d={slot.path} />
          </clipPath>
        ))}
        <filter id={`${P}-soft`} {...region} filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation={Math.max(0.1, f * 0.5)} />
        </filter>
        <filter id={`${P}-softer`} {...region} filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation={Math.max(0.1, f * 0.3)} />
        </filter>
        {shadow && (
          <filter id={`${P}-shadow`} {...region} filterUnits="userSpaceOnUse">
            <feDropShadow
              dx="0"
              dy={4 + boxes.shadow * 10}
              stdDeviation={6 + boxes.shadow * 14}
              floodColor="#000"
              floodOpacity={0.12 + boxes.shadow * 0.3}
            />
          </filter>
        )}
        <linearGradient id={`${P}-glass`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.02" />
        </linearGradient>
        {slotPhotos.map(({ slot, photo }) => {
          if (!photo) return null
          const items: ReactNode[] = []
          if (needsPhotoFilter(photo, settings))
            items.push(<PhotoFilter key="pf" id={`${P}-pf-${slot.id}`} photo={photo} settings={settings} />)
          if (style === 'faded')
            items.push(
              <mask key="mf" id={`${P}-mfade-${slot.id}`} maskUnits="userSpaceOnUse" {...region}>
                <path d={insetPath(slot, layout, f * 0.6)} fill="#fff" filter={`url(#${P}-soft)`} />
              </mask>,
            )
          if (style === 'blurred') {
            items.push(
              <PhotoFilter key="pb" id={`${P}-pb-${slot.id}`} photo={photo} settings={settings} blur={Math.max(1, f * 0.45)} />,
              <mask key="mo" id={`${P}-mouter-${slot.id}`} maskUnits="userSpaceOnUse" {...region}>
                <path d={insetPath(slot, layout, f * 0.15)} fill="#fff" filter={`url(#${P}-softer)`} />
              </mask>,
              <mask key="mi" id={`${P}-minner-${slot.id}`} maskUnits="userSpaceOnUse" {...region}>
                <path d={insetPath(slot, layout, f * 1.1)} fill="#fff" filter={`url(#${P}-soft)`} />
              </mask>,
            )
          }
          return <g key={slot.id}>{items}</g>
        })}
      </defs>

      <g filter={shadow ? `url(#${P}-shadow)` : undefined}>
        {tiles}
        {photos}
      </g>
      {strokes}

      <g>
        {geom.slots.map((slot) => {
          const layout = layoutLabel(slot, people[slot.id], settings.labels, geom.byId.get(2)?.thickness)
          return layout ? <Label key={slot.id} slot={slot} layout={layout} settings={settings} /> : null
        })}
      </g>

      {geom.title && (
        <g fill={title.color} textAnchor="middle" fontFamily={fontStack(title.font)}>
          {title.text.trim() && (
            <text x={0} y={geom.title.y} fontSize={geom.title.size} fontWeight={FONTS[title.font].titleWeight}>
              {title.text}
            </text>
          )}
          {title.subtitle.trim() && (
            <text
              x={0}
              y={geom.title.subtitleY}
              fontSize={geom.title.subSize}
              letterSpacing={geom.title.subSize * 0.22}
              opacity={0.75}
            >
              {title.subtitle.toUpperCase()}
            </text>
          )}
        </g>
      )}

      {/* Editor-only overlay: hit areas, hints and selection. Stripped on export. */}
      <g data-ui="">
        {slotPhotos.map(({ slot, photo }) => {
          const person = people[slot.id]
          const isSel = selected === slot.id
          const isDrop = dropTarget === slot.id
          return (
            <g key={slot.id}>
              {!photo && (
                <g className="slot-hint" transform={`translate(${slot.cx} ${slot.cy})`} pointerEvents="none">
                  {hideEmpty && (
                    <path d={slot.path} transform={`translate(${-slot.cx} ${-slot.cy})`} className="slot-ghost" />
                  )}
                  <circle r={Math.min(18, slot.thickness * 0.16, (slot.a1 - slot.a0) * slot.r1 * 0.2 || 18)} className="slot-plus-bg" />
                  <path
                    d={(() => {
                      const s = Math.min(8, slot.thickness * 0.07, (slot.a1 - slot.a0) * slot.r1 * 0.09 || 8)
                      return `M ${-s} 0 H ${s} M 0 ${-s} V ${s}`
                    })()}
                    className="slot-plus"
                  />
                </g>
              )}
              <path
                d={slot.path}
                data-slot={slot.id}
                className={`slot-hit${isSel ? ' is-selected' : ''}${isDrop ? ' is-drop' : ''}${photo ? ' has-photo' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`${person?.name || (slot.isCenter ? 'Centre person' : `Ancestor ${slot.id}`)}${photo ? ', has photo' : ', empty — press Enter to add a photo'}`}
                aria-pressed={isSel}
              />
            </g>
          )
        })}
      </g>
    </svg>
  )
}
