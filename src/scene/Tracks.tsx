import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { runtime } from '../game/runtime'
import { useGame } from '../game/store'
import { terrainHeight } from '../game/terrain'

const MAX_SEGMENTS = 8000
const STEP = 0.35
const SKI_GAP = 0.2

type TrackPoint = { x: number; z: number; lx: number; lz: number; rx: number; rz: number }

/** Carved tracks: two line segments (one per ski) laid down while the skier is on the snow. */
export function Tracks() {
  const runId = useGame((s) => s.runId)
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SEGMENTS * 2 * 3), 3))
    g.setDrawRange(0, 0)
    return g
  }, [])
  // the geometry is changed through the line's ref, never through the value `useMemo` returned
  const lines = useRef<THREE.LineSegments>(null!)
  const state = useRef<{ next: number; count: number; last: TrackPoint | null }>({ next: 0, count: 0, last: null })

  useEffect(() => {
    state.current = { next: 0, count: 0, last: null }
    lines.current.geometry.setDrawRange(0, 0)
  }, [runId])

  useFrame(() => {
    const s = runtime.sim.skier
    const st = state.current
    if (s.airborne || s.crashT > 0 || s.onRamp) {
      st.last = null
      return
    }
    if (st.last && Math.hypot(s.x - st.last.x, s.z - st.last.z) < STEP) return

    const px = Math.cos(s.heading) * SKI_GAP
    const pz = -Math.sin(s.heading) * SKI_GAP
    const cur = { x: s.x, z: s.z, lx: s.x - px, lz: s.z - pz, rx: s.x + px, rz: s.z + pz }
    if (st.last) {
      const { geometry: g } = lines.current
      const pos = g.getAttribute('position')
      const segments: [ax: number, az: number, bx: number, bz: number][] = [
        [st.last.lx, st.last.lz, cur.lx, cur.lz],
        [st.last.rx, st.last.rz, cur.rx, cur.rz],
      ]
      for (const [ax, az, bx, bz] of segments) {
        const i = st.next * 2
        pos.setXYZ(i, ax, terrainHeight(ax, az) + 0.03, az)
        pos.setXYZ(i + 1, bx, terrainHeight(bx, bz) + 0.03, bz)
        st.next = (st.next + 1) % MAX_SEGMENTS
        st.count = Math.min(MAX_SEGMENTS, st.count + 1)
      }
      pos.needsUpdate = true
      g.setDrawRange(0, st.count * 2)
      g.computeBoundingSphere()
    }
    st.last = cur
  })

  return (
    <lineSegments ref={lines} geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color="#8d9bb3" transparent opacity={0.75} />
    </lineSegments>
  )
}
