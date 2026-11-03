import { useMemo } from 'react'
import { computeGeometry, type ChartGeom } from './geometry'
import { useStore } from './store'

export function useGeometry(): ChartGeom {
  const layout = useStore((s) => s.project.settings.layout)
  const title = useStore((s) => s.project.settings.title)
  // Geometry only depends on layout and title, so photo/colour edits don't recompute it.
  return useMemo(() => computeGeometry({ layout, title }), [layout, title])
}
