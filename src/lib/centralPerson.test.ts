import { beforeEach, describe, expect, it } from 'vitest'
import { setCentralPerson, setParentSide, setTreeCenter } from './actions'
import { buildPackage, parsePackage, sanitizeProject } from './projectFile'
import { referencedImages } from './storage'
import { computeGeometry } from './geometry'
import { emptyProject, newPhoto, useStore } from './store'

describe('changing the centre person', () => {
  beforeEach(() => {
    useStore.setState({ project: emptyProject(), past: [], future: [], selected: null })
  })

  it('moves the chosen branch, preserves photo placement and restores everything on undo', () => {
    const project = emptyProject()
    project.settings.layout.generations = 6
    project.people = {
      1: { name: 'Original', dates: '', photo: { ...newPhoto('one'), x: 0.2 } },
      4: { name: 'Grandfather', dates: '', photo: { ...newPhoto('four'), x: -0.3, y: 0.1, scale: 1.7 } },
      5: { name: 'Other branch', dates: '' },
      8: { name: 'Parent', dates: '' },
      19: { name: 'Ancestor', dates: '', photo: { ...newPhoto('nineteen'), rotation: 20 } },
    }
    useStore.setState({ project, selected: 4 })
    setCentralPerson(4)
    const changed = useStore.getState().project
    expect(changed.settings.layout.generations).toBe(4)
    expect(changed.people).toEqual({ 1: project.people[4], 2: project.people[8], 7: project.people[19] })
    expect(useStore.getState().selected).toBe(1)
    useStore.getState().undo()
    expect(useStore.getState().project).toEqual(project)
    useStore.getState().redo()
    expect(useStore.getState().project).toEqual(changed)
  })

  it('supports selecting an outermost ancestor and saving zero generations', () => {
    const project = emptyProject()
    project.settings.layout.generations = 2
    project.people[7] = { name: 'Ancestor', dates: '' }
    useStore.setState({ project })
    setCentralPerson(7)
    const changed = useStore.getState().project
    expect(changed.settings.layout.generations).toBe(0)
    expect(sanitizeProject(changed).settings.layout.generations).toBe(0)
  })
  it('navigates between branches, retaining edits and images across a project round trip', () => {
    const project = emptyProject()
    project.settings.layout.generations = 6
    project.people = {
      1: { name: 'Home', dates: '', photo: newPhoto('home') },
      4: { name: 'Grandfather', dates: '', photo: { ...newPhoto('grand'), x: 0.4 } },
      5: { name: 'Grandmother', dates: '', photo: newPhoto('other') },
    }
    useStore.setState({ project })
    setCentralPerson(4)
    useStore.getState().update((p) => { p.people[1].name = 'Edited grandfather' })
    const saved = useStore.getState().project
    expect([...referencedImages(saved)].sort()).toEqual(['grand', 'home', 'other'])
    const images = ['home', 'grand', 'other'].map((id) => ({ id, mime: 'image/jpeg', bytes: new Uint8Array([1]) }))
    const loaded = parsePackage(buildPackage(saved, images)).project
    useStore.setState({ project: loaded })
    setTreeCenter(1)
    expect(useStore.getState().project.settings.layout.generations).toBe(6)
    expect(useStore.getState().project.people[4].name).toBe('Edited grandfather')
    expect(useStore.getState().project.people[5].photo?.imageId).toBe('other')
    setTreeCenter(5)
    expect(useStore.getState().project.people[1].name).toBe('Grandmother')
    setTreeCenter(4)
    expect(useStore.getState().project.people[1].photo?.x).toBe(0.4)
    expect(useStore.getState().project.people[1].name).toBe('Edited grandfather')
  })

  it('changes the parent interpretation without moving photos and preserves tree navigation', () => {
    const project = emptyProject()
    project.people = { 1: { name: 'Home', dates: '' }, 2: { name: 'Left parent', dates: '', photo: newPhoto('left') }, 4: { name: 'Left grandparent', dates: '' } }
    useStore.setState({ project, selected: 2 })
    const before = computeGeometry(project.settings).byId.get(2)!
    setParentSide('mother')
    const changed = useStore.getState().project
    const after = computeGeometry(changed.settings).byId.get(3)!
    expect(changed.people[3].name).toBe('Left parent')
    expect(changed.people[7].name).toBe('Left grandparent')
    expect([after.cx, after.cy]).toEqual([before.cx, before.cy])
    expect(useStore.getState().selected).toBe(3)
    setCentralPerson(7)
    setTreeCenter(1)
    expect(useStore.getState().project.people[3].name).toBe('Left parent')
    expect(useStore.getState().project.people[7].name).toBe('Left grandparent')
    expect(sanitizeProject(useStore.getState().project).settings.layout.parentSide).toBe('mother')
  })

})
