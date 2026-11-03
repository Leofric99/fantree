import { produce, type Draft } from 'immer'
import { create } from 'zustand'
import { defaultSettings } from './themes'
import type { ImageMeta, Photo, Project, SlotId } from './types'

const HISTORY_LIMIT = 150
const COALESCE_MS = 800

export interface Toast {
  id: number
  kind: 'info' | 'error' | 'success'
  message: string
}

interface State {
  project: Project
  past: Project[]
  future: Project[]
  selected: SlotId | null
  images: Record<string, ImageMeta>
  zoom: number
  ready: boolean
  toasts: Toast[]
  lastKey: string | null
  lastTime: number

  update: (recipe: (draft: Draft<Project>) => void, coalesceKey?: string) => void
  undo: () => void
  redo: () => void
  select: (id: SlotId | null) => void
  setZoom: (zoom: number) => void
  addImage: (meta: ImageMeta) => void
  replaceProject: (project: Project, images?: Record<string, ImageMeta>) => void
  toast: (message: string, kind?: Toast['kind']) => void
  dismissToast: (id: number) => void
}

export function emptyProject(): Project {
  return { version: 2, settings: defaultSettings(), people: {} }
}

export function newPhoto(imageId: string): Photo {
  return { imageId, x: 0, y: 0, scale: 1, rotation: 0, brightness: 1, contrast: 1, saturation: 1, flipX: false }
}

let toastSeq = 0

export const useStore = create<State>()((set, get) => ({
  project: emptyProject(),
  past: [],
  future: [],
  selected: null,
  images: {},
  zoom: 1,
  ready: false,
  toasts: [],
  lastKey: null,
  lastTime: 0,

  update: (recipe, coalesceKey) => {
    const { project, past, lastKey, lastTime } = get()
    const next = produce(project, recipe)
    if (next === project) return
    const now = performance.now()
    const coalesce = coalesceKey !== undefined && coalesceKey === lastKey && now - lastTime < COALESCE_MS
    set({
      project: next,
      past: coalesce ? past : [...past.slice(-HISTORY_LIMIT + 1), project],
      future: [],
      lastKey: coalesceKey ?? null,
      lastTime: now,
    })
  },

  undo: () => {
    const { past, project, future } = get()
    const prev = past.at(-1)
    if (!prev) return
    set({ project: prev, past: past.slice(0, -1), future: [project, ...future], lastKey: null })
  },

  redo: () => {
    const { past, project, future } = get()
    const [next, ...rest] = future
    if (!next) return
    set({ project: next, past: [...past, project], future: rest, lastKey: null })
  },

  select: (id) => set({ selected: id }),
  setZoom: (zoom) => set({ zoom: Math.min(4, Math.max(0.25, zoom)) }),
  addImage: (meta) => set((s) => ({ images: { ...s.images, [meta.id]: meta } })),

  replaceProject: (project, images) =>
    set((s) => ({
      project,
      past: [...s.past.slice(-HISTORY_LIMIT + 1), s.project],
      future: [],
      selected: null,
      images: images ? { ...s.images, ...images } : s.images,
      lastKey: null,
    })),

  toast: (message, kind = 'info') => {
    const id = ++toastSeq
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }))
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 6000 : 3500)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const useSettings = () => useStore((s) => s.project.settings)
