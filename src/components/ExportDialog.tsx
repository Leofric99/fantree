import { Download, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { downloadBlob } from '../lib/actions'
import { exportSize, renderExport, RESOLUTIONS, type ExportFormat } from '../lib/export'
import { useStore } from '../lib/store'
import { Segmented, Slider, Toggle } from './controls'
import { useGeometry } from '../lib/hooks'

const FORMATS: { id: ExportFormat; label: string; title: string }[] = [
  { id: 'png', label: 'PNG', title: 'Lossless — best for printing and archiving' },
  { id: 'jpeg', label: 'JPEG', title: 'Smaller files — great for sharing' },
  { id: 'webp', label: 'WebP', title: 'Modern, small and high quality' },
  { id: 'svg', label: 'SVG', title: 'Scalable vector with embedded photos' },
]

export function ExportDialog({ open, onClose, svgRef }: { open: boolean; onClose: () => void; svgRef: React.RefObject<SVGSVGElement | null> }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const settings = useStore((s) => s.project.settings)
  const toast = useStore((s) => s.toast)
  const geom = useGeometry()
  const [format, setFormat] = useState<ExportFormat>('png')
  const [res, setRes] = useState('4k')
  const [transparent, setTransparent] = useState(false)
  const [quality, setQuality] = useState(0.95)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  const longEdge = RESOLUTIONS.find((r) => r.id === res)!.px
  const size = exportSize(geom.viewBox, longEdge)
  const canTransparent = format !== 'jpeg'

  const run = async () => {
    const svg = svgRef.current
    if (!svg) return
    setBusy(true)
    setProgress(0)
    try {
      await document.fonts.ready
      const blob = await renderExport(
        svg,
        settings,
        { format, longEdge, transparent: transparent && canTransparent, quality },
        setProgress,
      )
      const base = (settings.title.show && settings.title.text.trim()) || 'family-fan-chart'
      const name = `${base.replace(/[^\w-]+/g, '-').toLowerCase()}-${format === 'svg' ? 'vector' : `${size.width}x${size.height}`}.${format === 'jpeg' ? 'jpg' : format}`
      downloadBlob(blob, name)
      toast(`Exported ${name} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`, 'success')
      onClose()
    } catch (err) {
      toast((err as Error).message || 'Export failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose} onCancel={(e) => busy && e.preventDefault()}>
      <header className="dialog-head">
        <div>
          <h2>Export your fan chart</h2>
          <p>Rendered at full quality from vector artwork and your original photos.</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} disabled={busy}>
          <X size={18} />
        </button>
      </header>
      <div className="dialog-body">
        <Segmented label="Format" value={format} onChange={setFormat} options={FORMATS} />
        <p className="hint">{FORMATS.find((f) => f.id === format)?.title}</p>
        {format !== 'svg' && (
          <div className="field">
            <span className="field-label">Resolution</span>
            <div className="res-grid" role="radiogroup" aria-label="Resolution">
              {RESOLUTIONS.map((r) => {
                const sz = exportSize(geom.viewBox, r.px)
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={res === r.id}
                    className={`res-card${res === r.id ? ' is-active' : ''}`}
                    onClick={() => setRes(r.id)}
                  >
                    <strong>{r.label}</strong>
                    <span>
                      {sz.width.toLocaleString()} × {sz.height.toLocaleString()}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {(format === 'jpeg' || format === 'webp') && (
          <Slider label="Quality" value={quality} min={0.6} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={setQuality} />
        )}
        {canTransparent && (
          <Toggle label="Transparent background" checked={transparent} onChange={setTransparent} hint="Only the fan, names and title" />
        )}
      </div>
      <footer className="dialog-foot">
        {busy && (
          <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${Math.max(4, progress * 100)}%` }} />
          </div>
        )}
        <button type="button" className="btn" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={run} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Download size={16} />}
          {busy ? 'Rendering…' : format === 'svg' ? 'Download SVG' : `Download ${size.width}×${size.height}`}
        </button>
      </footer>
    </dialog>
  )
}
