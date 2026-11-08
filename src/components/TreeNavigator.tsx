import { useMemo } from 'react'
import { UserRound } from 'lucide-react'
import { setTreeCenter } from '../lib/actions'
import { relationship } from '../lib/geometry'
import { mergedTree } from '../lib/tree'
import { useStore } from '../lib/store'

export function TreeNavigator() {
  const project = useStore((s) => s.project)
  const images = useStore((s) => s.images)
  const people = useMemo(() => mergedTree(project), [project])
  const center = project.tree?.center ?? 1
  const motherFirst = project.settings.layout.parentSide === 'mother'
  const nodes = new Set<number>([1, center])
  for (const id of Object.keys(people).map(Number)) {
    let n = id
    while (n >= 1) {
      nodes.add(n)
      n = Math.floor(n / 2)
    }
  }
  function node(id: number): React.ReactNode {
    if (!nodes.has(id)) return null
    const person = people[id]
    const image = person?.photo && images[person.photo.imageId]
    const name = person?.name.trim() || (id === 1 ? 'Original centre' : relationship(id))
    const children = nodes.has(id * 2) || nodes.has(id * 2 + 1)
    return (
      <li key={id}>
        <button type="button" className={`tree-person${id === center ? ' is-current' : ''}`}
          aria-current={id === center ? 'true' : undefined} onClick={() => setTreeCenter(id)}>
          {image ? <img src={image.previewUrl} alt="" /> : <span className="tree-avatar"><UserRound size={16} /></span>}
          <span>{name}{id === center && <small>Centre</small>}</span>
        </button>
        {children && <ul>{node(id * 2 + (motherFirst ? 1 : 0))}{node(id * 2 + (motherFirst ? 0 : 1))}</ul>}
      </li>
    )
  }
  return (
    <div className="tree-content">
      <p className="hint">Select a person to make them the centre.</p>
      <ul>{node(1)}</ul>
    </div>
  )
}
