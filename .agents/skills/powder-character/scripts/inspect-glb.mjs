#!/usr/bin/env node
// Checks a POWDER skier .glb has the parts the game animates, with vertex colours.
// Usage: node inspect-glb.mjs public/models/skier-<name>.glb
import { readFileSync } from 'node:fs'

const file = process.argv[2]
if (!file) {
  console.error('usage: node inspect-glb.mjs <file.glb>')
  process.exit(2)
}

const buf = readFileSync(file)
if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error(`${file} is not a binary glTF`)
const json = JSON.parse(buf.toString('utf8', 20, 20 + buf.readUInt32LE(12)))

const REQUIRED = ['Boots', 'Shins', 'Thighs', 'Torso', 'ArmL', 'ArmR', 'SkiL', 'SkiR', 'PoleL', 'PoleR']
const problems = []
let total = 0

for (const name of REQUIRED) {
  const node = json.nodes.find((n) => n.name === name)
  if (!node) {
    problems.push(`missing node ${name}`)
    continue
  }
  if (node.mesh === undefined) {
    problems.push(`${name} has no mesh`)
    continue
  }
  const mesh = json.meshes[node.mesh]
  let tris = 0
  for (const prim of mesh.primitives) {
    if (!prim.attributes.COLOR_0) problems.push(`${name} has no vertex colours (COLOR_0)`)
    tris += json.accessors[prim.indices ?? prim.attributes.POSITION].count / 3
  }
  if (mesh.primitives.length > 1) problems.push(`${name} has ${mesh.primitives.length} primitives; the game expects one material`)
  total += tris // L and R share a mesh but are each drawn
  console.log(`${name.padEnd(6)} mesh ${mesh.name.padEnd(5)} ${tris} tris`)
}

console.log(`${total} tris for the whole skier`)
if (problems.length) {
  console.error(`\nFAIL\n- ${problems.join('\n- ')}`)
  process.exit(1)
}
console.log('OK')
