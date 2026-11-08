import { generationOf } from './geometry'
import type { Person, Project, SlotId } from './types'

/** Convert a slot in a centre's fan to its original-tree index. */
export function absoluteSlot(center: SlotId, relative: SlotId): SlotId {
  const factor = 2 ** generationOf(relative)
  return center * factor + relative - factor
}

export function relativeSlot(center: SlotId, id: SlotId): SlotId | null {
  const depth = generationOf(id) - generationOf(center)
  if (depth < 0) return null
  const factor = 2 ** depth
  return Math.floor(id / factor) === center ? factor + id % factor : null
}

/** Overlay the editable fan on the saved tree, preserving branches outside the fan. */
export function mergedTree(project: Project): Record<SlotId, Person> {
  const center = project.tree?.center ?? 1
  const people = { ...(project.tree?.people ?? {}) }
  for (const key of Object.keys(people)) {
    const relative = relativeSlot(center, Number(key))
    if (relative !== null && relative <= 127) delete people[Number(key)]
  }
  for (const [key, person] of Object.entries(project.people)) {
    people[absoluteSlot(center, Number(key))] = person
  }
  people[1] ??= { name: '', dates: '' }
  return people
}

export function branchPeople(tree: Record<SlotId, Person>, center: SlotId): Record<SlotId, Person> {
  const people: Record<SlotId, Person> = {}
  for (const [key, person] of Object.entries(tree)) {
    const relative = relativeSlot(center, Number(key))
    if (relative !== null && relative <= 127) people[relative] = person
  }
  return people
}

/** Reverse every left/right choice in an Ahnentafel path. */
export function mirrorSlot(id: SlotId): SlotId {
  const base = 2 ** generationOf(id)
  return base + (2 * base - 1 - id)
}
