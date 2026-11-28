import { useMemo } from 'react'
import * as THREE from 'three'

import { COURSE } from '../game/config'
import { terrainHeight } from '../game/terrain'

const WIDTH = COURSE.width + 110
const START = -120
const LENGTH = COURSE.length + 260

export function Terrain() {
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(WIDTH, LENGTH, Math.round(WIDTH / 1.5), Math.round(LENGTH / 1.5))
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0, START + LENGTH / 2)
    const pos = g.getAttribute('position')
    for (let i = 0; i < pos.count; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)))
    g.computeVertexNormals()
    return g
  }, [])

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#ffffff" roughness={0.95} />
    </mesh>
  )
}
