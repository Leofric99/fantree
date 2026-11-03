import { Download, FilePlus2, FolderOpen, Maximize, Minus, Plus, Redo2, Save, Undo2 } from 'lucide-react'
import { newProject, openProjectFile, pickFiles, PROJECT_ACCEPT, saveProjectFile } from '../lib/actions'
import { useStore } from '../lib/store'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const mod = isMac ? '⌘' : 'Ctrl+'

export function TopBar({ onExport }: { onExport: () => void }) {
  const canUndo = useStore((s) => s.past.length > 0)
  const canRedo = useStore((s) => s.future.length > 0)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const zoom = useStore((s) => s.zoom)
  const setZoom = useStore((s) => s.setZoom)

  return (
    <header className="topbar">
      <div className="brand">
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <defs>
            <linearGradient id="brand-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f4d58d" />
              <stop offset="1" stopColor="#c58b4b" />
            </linearGradient>
          </defs>
          <path d="M3 22 A13 13 0 0 1 29 22" fill="none" stroke="url(#brand-g)" strokeWidth="4" strokeLinecap="round" />
          <path d="M9 22 A7 7 0 0 1 23 22" fill="none" stroke="url(#brand-g)" strokeWidth="3.4" strokeLinecap="round" opacity="0.75" />
          <circle cx="16" cy="22" r="2.8" fill="url(#brand-g)" />
        </svg>
        <span>
          Fan<em>Tree</em>
        </span>
      </div>

      <div className="toolbar" role="toolbar" aria-label="Project">
        <button type="button" className="icon-btn" title="New chart" aria-label="New chart" onClick={newProject}>
          <FilePlus2 size={18} />
        </button>
        <button
          type="button"
          className="icon-btn"
          title={`Import project file (.fantree) (${mod}O)`}
          aria-label="Import project file"
          onClick={async () => {
            const [f] = await pickFiles(false, PROJECT_ACCEPT)
            if (f) await openProjectFile(f)
          }}
        >
          <FolderOpen size={18} />
        </button>
        <button type="button" className="icon-btn" title={`Export project file with all photos (${mod}S)`} aria-label="Export project file" onClick={saveProjectFile}>
          <Save size={18} />
        </button>
        <span className="divider" />
        <button type="button" className="icon-btn" title={`Undo (${mod}Z)`} aria-label="Undo" disabled={!canUndo} onClick={undo}>
          <Undo2 size={18} />
        </button>
        <button type="button" className="icon-btn" title={`Redo (${mod}⇧Z)`} aria-label="Redo" disabled={!canRedo} onClick={redo}>
          <Redo2 size={18} />
        </button>
        <span className="divider" />
        <button type="button" className="icon-btn" aria-label="Zoom out" title="Zoom out" onClick={() => setZoom(zoom / 1.2)}>
          <Minus size={18} />
        </button>
        <button type="button" className="zoom-label" title="Fit to window" onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" className="icon-btn" aria-label="Zoom in" title="Zoom in" onClick={() => setZoom(zoom * 1.2)}>
          <Plus size={18} />
        </button>
        <button type="button" className="icon-btn" aria-label="Fit to window" title="Fit to window" onClick={() => setZoom(1)}>
          <Maximize size={17} />
        </button>
      </div>

      <button type="button" className="btn btn-primary btn-export" onClick={onExport} title={`Export (${mod}E)`}>
        <Download size={16} /> Export
      </button>
    </header>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" className={`toast toast-${t.kind}`} onClick={() => dismiss(t.id)}>
          {t.message}
        </button>
      ))}
    </div>
  )
}
