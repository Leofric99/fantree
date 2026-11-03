import { useEffect, useRef, useState } from 'react'
import { assignFile, isProjectFile, openProjectFile, pickFiles, PROJECT_ACCEPT, removePhoto, saveProjectFile } from './lib/actions'
import { sanitizeProject, upgradeProject } from './lib/projectFile'
import { collectGarbage, loadImageMeta, loadProject, referencedImages, saveProject, saveProjectBackup } from './lib/storage'
import { useStore } from './lib/store'
import type { ImageMeta, Project } from './lib/types'
import { ExportDialog } from './components/ExportDialog'
import { Inspector } from './components/Inspector'
import { Sidebar } from './components/Sidebar'
import { Stage } from './components/Stage'
import { Toasts, TopBar } from './components/TopBar'

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

/** Restore the last session from IndexedDB, then autosave changes. */
function usePersistence() {
  const ready = useStore((s) => s.ready)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const saved = await loadProject()
        if (saved && !cancelled) {
          const loaded: Project = sanitizeProject(saved)
          const ids = referencedImages(loaded)
          const metas = await Promise.all([...ids].map(loadImageMeta))
          const images: Record<string, ImageMeta> = {}
          for (const m of metas) if (m) images[m.id] = m
          const project = upgradeProject(loaded, images)
          useStore.setState({ project, images })
          if (project !== loaded) void saveProject(project)
          void collectGarbage(ids)
        }
      } catch (err) {
        console.error('Failed to restore project', err)
      } finally {
        if (!cancelled) useStore.setState({ ready: true })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    // Ask the browser not to evict our data under storage pressure.
    void navigator.storage?.persist?.().catch(() => {})
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = (sync = false) => {
      if (timer === undefined) return
      clearTimeout(timer)
      timer = undefined
      const project = useStore.getState().project
      if (sync) saveProjectBackup(project)
      saveProject(project).catch((err) => console.error('Autosave failed', err))
    }
    const unsub = useStore.subscribe((s, prev) => {
      if (s.project === prev.project) return
      clearTimeout(timer)
      timer = setTimeout(flush, 400)
    })
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush(true)
    }
    const onPageHide = () => flush(true)
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      unsub()
      flush()
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [ready])
}

export default function App() {
  const svgRef = useRef<SVGSVGElement>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const ready = useStore((s) => s.ready)
  usePersistence()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        if (isTyping(e.target)) return
        e.preventDefault()
        if (e.shiftKey) st.redo()
        else st.undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        st.redo()
        return
      }
      if (mod && key === 's') {
        e.preventDefault()
        void saveProjectFile()
        return
      }
      if (mod && key === 'o') {
        e.preventDefault()
        void pickFiles(false, PROJECT_ACCEPT).then(([f]) => f && openProjectFile(f))
        return
      }
      if (mod && key === 'e') {
        e.preventDefault()
        setExportOpen(true)
        return
      }
      if (isTyping(e.target) || mod || document.querySelector('dialog[open]')) return
      const sel = st.selected
      if (e.key === 'Escape') st.select(null)
      if (!sel || !st.project.people[sel]?.photo) return
      // Offsets are fractions of the photo's displayed size (see lib/photo.ts).
      const step = e.shiftKey ? 0.05 : 0.008
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }
      if (nudge[e.key]) {
        e.preventDefault()
        const [dx, dy] = nudge[e.key]
        st.update((p) => {
          const ph = p.people[sel]?.photo
          if (ph) {
            ph.x += dx
            ph.y += dy
          }
        }, `nudge-${sel}`)
      } else if (e.key === '+' || e.key === '=' || e.key === '-') {
        const f = e.key === '-' ? 1 / 1.05 : 1.05
        st.update((p) => {
          const ph = p.people[sel]?.photo
          if (ph) ph.scale = Math.min(6, Math.max(0.2, ph.scale * f))
        }, `nudge-${sel}`)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removePhoto(sel)
      }
    }
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return
      const sel = useStore.getState().selected
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'))
      if (!file) return
      e.preventDefault()
      if (sel) void assignFile(sel, file)
      else useStore.getState().toast('Select a frame first, then paste.', 'info')
    }
    // Stop the browser navigating away when a file is dropped outside the chart.
    const prevent = (e: DragEvent) => e.preventDefault()
    // A .fantree file dropped anywhere in the window is imported as a project.
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const file = Array.from(e.dataTransfer?.files ?? []).find(isProjectFile)
      if (file) void openProjectFile(file)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <div className="app">
      <TopBar onExport={() => setExportOpen(true)} />
      <div className="workspace">
        <Sidebar />
        {ready ? <Stage svgRef={svgRef} /> : <main className="stage stage-loading">Loading your chart…</main>}
        <Inspector />
      </div>
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} svgRef={svgRef} />
      <Toasts />
    </div>
  )
}
