import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Obstacle } from '../game/course'
import { mulberry32 } from '../game/course'
import { course } from '../game/runtime'
import { terrainHeight } from '../game/terrain'

function colored(g: THREE.BufferGeometry, color: string) {
  const c = new THREE.Color(color)
  const g2 = g.index ? g.toNonIndexed() : g
  const colors = new Float32Array(g2.attributes.position.count * 3)
  for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i)
  g2.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  g2.deleteAttribute('uv')
  return g2
}

function treeGeometry() {
  const parts = [colored(new THREE.CylinderGeometry(0.15, 0.2, 1, 6).translate(0, 0.5, 0), '#5b3b2a')]
  const tiers = [
    { r: 1.5, h: 2.2, y: 0.7, c: '#24583f' },
    { r: 1.15, h: 1.9, y: 1.8, c: '#2a6448' },
    { r: 0.8, h: 1.6, y: 2.8, c: '#317052' },
    { r: 0.45, h: 1.1, y: 3.7, c: '#387b5a' },
  ]
  for (const t of tiers) parts.push(colored(new THREE.ConeGeometry(t.r, t.h, 8).translate(0, t.y + t.h / 2, 0), t.c))
  const g = mergeGeometries(parts)!
  g.computeVertexNormals()
  return g
}

function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 1)
  const rand = mulberry32(99)
  const pos = g.attributes.position
  // Jitter shared vertices consistently so the mesh stays closed.
  const offsets = new Map<string, number>()
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
    if (!offsets.has(key)) offsets.set(key, 0.8 + rand() * 0.35)
    const k = offsets.get(key)!
    pos.setXYZ(i, pos.getX(i) * k, Math.max(-0.2, pos.getY(i) * k * 0.65), pos.getZ(i) * k)
  }
  g.computeVertexNormals()
  return g
}

function useInstances(ref: React.RefObject<THREE.InstancedMesh | null>, items: Obstacle[], scaleFor: (o: Obstacle) => THREE.Vector3) {
  useLayoutEffect(() => {
    const mesh = ref.current!
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    items.forEach((o, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), o.rot)
      m.compose(new THREE.Vector3(o.x, terrainHeight(o.x, o.z), o.z), q, scaleFor(o))
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [ref, items, scaleFor])
}

const treeScale = (o: Obstacle) => new THREE.Vector3(o.scale, o.scale * 1.05, o.scale)
const rockScale = (o: Obstacle) => new THREE.Vector3(o.scale * 1.2, o.scale, o.scale * 1.1)

export function Obstacles() {
  const trees = useMemo(() => course.obstacles.filter((o) => o.kind === 'tree'), [])
  const rocks = useMemo(() => course.obstacles.filter((o) => o.kind === 'rock'), [])
  const treeGeo = useMemo(treeGeometry, [])
  const rockGeo = useMemo(rockGeometry, [])
  const treeRef = useRef<THREE.InstancedMesh>(null)
  const rockRef = useRef<THREE.InstancedMesh>(null)
  useInstances(treeRef, trees, treeScale)
  useInstances(rockRef, rocks, rockScale)

  return (
    <>
      <instancedMesh ref={treeRef} args={[treeGeo, undefined, trees.length]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={rockRef} args={[rockGeo, undefined, rocks.length]} castShadow receiveShadow>
        <meshStandardMaterial color="#eef2f8" flatShading roughness={1} />
      </instancedMesh>
    </>
  )
}
