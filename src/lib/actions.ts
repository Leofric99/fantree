import { slotCount } from './geometry'
import { newPhoto, useStore, emptyProject } from './store'
import { buildPackage, parsePackage, upgradeProject, type PackageImage } from './projectFile'
import { ACCEPTED_TYPES, getFullImage, importImage, referencedImages, restoreImage } from './storage'
import type { ImageMeta, Project, SlotId } from './types'

const st = () => useStore.getState()

function isImage(file: File) {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp)$/i.test(file.name)
}

export async function assignFile(slot: SlotId, file: Blob): Promise<void> {
  try {
    const meta = await importImage(file)
    st().addImage(meta)
    st().update((p) => {
      const person = (p.people[slot] ??= { name: '', dates: '' })
      person.photo = newPhoto(meta.id)
    })
    st().select(slot)
  } catch (err) {
    st().toast((err as Error).message, 'error')
  }
}

/** Drop several photos at once: fills empty frames from the centre outwards. */
export async function fillEmptySlots(files: File[], startAt?: SlotId): Promise<void> {
  const images = files.filter(isImage)
  if (!images.length) {
    st().toast('No image files found in that drop.', 'error')
    return
  }
  const { project } = st()
  const total = slotCount(project.settings.layout.generations)
  const empty: SlotId[] = []
  for (let id = startAt ?? 1; id <= total && empty.length < images.length; id++) {
    if (!project.people[id]?.photo) empty.push(id)
  }
  if (!empty.length) {
    st().toast('Every frame already has a photo.', 'info')
    return
  }
  const metas: (ImageMeta | null)[] = await Promise.all(
    images.slice(0, empty.length).map((f) => importImage(f).catch(() => null)),
  )
  metas.forEach((m) => m && st().addImage(m))
  st().update((p) => {
    metas.forEach((m, i) => {
      if (!m) return
      const person = (p.people[empty[i]] ??= { name: '', dates: '' })
      person.photo = newPhoto(m.id)
    })
  })
  const added = metas.filter(Boolean).length
  st().toast(`Added ${added} photo${added === 1 ? '' : 's'}.`, 'success')
  if (images.length > empty.length) st().toast(`${images.length - empty.length} photo(s) skipped — no empty frames left.`)
}

export function removePhoto(slot: SlotId) {
  st().update((p) => {
    if (p.people[slot]) delete p.people[slot].photo
  })
}

export function swapSlots(a: SlotId, b: SlotId) {
  if (a === b) return
  st().update((p) => {
    const pa = p.people[a]
    const pb = p.people[b]
    if (pb) p.people[a] = pb
    else delete p.people[a]
    if (pa) p.people[b] = pa
    else delete p.people[b]
  })
}

export const PROJECT_ACCEPT = '.fantree,application/zip,application/json'

function projectFileName(project: Project) {
  return `${(project.settings.title.text.trim() || 'family-fan-chart').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'family-fan-chart'}.fantree`
}

/** Export the whole project (settings, names, photo placement and images) as one portable file. */
export async function saveProjectFile(): Promise<void> {
  const { project } = st()
  const suggestedName = projectFileName(project)
  // Ask for the destination first: the picker must open while the click's user activation is still valid.
  type SaveHandle = { createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }> }
  const picker = (window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<SaveHandle> }).showSaveFilePicker
  let handle: SaveHandle | null = null
  if (picker) {
    try {
      handle = await picker({
        suggestedName,
        types: [{ description: 'FanTree project', accept: { 'application/x-fantree': ['.fantree'] } }],
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      handle = null
    }
  }
  try {
    const images: PackageImage[] = []
    let missing = 0
    for (const id of referencedImages(project)) {
      const stored = await getFullImage(id)
      if (stored) images.push({ id, mime: stored.full.type || stored.mime, bytes: new Uint8Array(await stored.full.arrayBuffer()) })
      else missing++
    }
    const bytes = buildPackage(project, images, `FanTree ${__APP_VERSION__}`)
    const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/x-fantree' })
    if (handle) {
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
    } else {
      downloadBlob(blob, suggestedName)
    }
    const mb = (blob.size / 1024 / 1024).toFixed(1)
    st().toast(`Project exported with ${images.length} photo${images.length === 1 ? '' : 's'} (${mb} MB).`, 'success')
    if (missing) st().toast(`${missing} photo(s) were missing from this browser and could not be included.`, 'error')
  } catch (err) {
    st().toast(`Could not export project: ${(err as Error).message}`, 'error')
  }
}

export function isProjectFile(file: File) {
  return /\.fantree$/i.test(file.name)
}

/** Import a .fantree file, replacing the current chart (undoable). */
export async function openProjectFile(file: File): Promise<void> {
  try {
    const { project, images, warnings } = parsePackage(new Uint8Array(await file.arrayBuffer()))
    const metas: Record<string, ImageMeta> = {}
    for (const img of images) {
      try {
        metas[img.id] = await restoreImage(img.id, new Blob([img.bytes as Uint8Array<ArrayBuffer>], { type: img.mime }))
      } catch {
        warnings.push('A photo in the file could not be decoded.')
      }
    }
    for (const person of Object.values(project.people)) {
      if (person.photo && !metas[person.photo.imageId]) delete person.photo
    }
    st().replaceProject(upgradeProject(project, metas), metas)
    st().toast(`Imported “${file.name}” with ${Object.keys(metas).length} photo(s). Undo restores your previous chart.`, 'success')
    for (const w of new Set(warnings)) st().toast(w, 'error')
  } catch (err) {
    st().toast(`Could not import project: ${(err as Error).message}`, 'error')
  }
}

export function newProject() {
  st().replaceProject(emptyProject())
  st().toast('Started a new chart. Use Undo to bring the previous one back.')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function pickFiles(multiple: boolean, accept: string): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.onchange = () => resolve(Array.from(input.files ?? []))
    input.addEventListener('cancel', () => resolve([]))
    input.click()
  })
}

export async function choosePhotoFor(slot: SlotId) {
  const [file] = await pickFiles(false, ACCEPTED_TYPES)
  if (file) await assignFile(slot, file)
}
