#!/usr/bin/env node
// Plays a few seconds of POWDER as one character and screenshots it: chase ride, grab, top-down, crash.
// Needs the dev server running (pnpm dev) and playwright installed in the current directory:
//   mkdir -p /tmp/pwshot && cd /tmp/pwshot && npm i playwright
//   node <repo>/.agents/skills/powder-character/scripts/check-in-game.mjs skier-<name> [url] [outDir]
// Exits 1 on console errors or if the character's model never loaded.
import { createRequire } from 'node:module'
import { join } from 'node:path'

// resolve playwright from where you run it, not from the skill folder
const { chromium } = createRequire(join(process.cwd(), 'noop.js'))('playwright')

const [id, url = 'http://localhost:5173/', out = '/tmp'] = process.argv.slice(2)
if (!id) {
  console.error('usage: node check-in-game.mjs <character-id> [url] [outDir]')
  process.exit(2)
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
const errors = []
const loaded = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('response', (r) => r.url().endsWith(`/models/${id}.glb`) && loaded.push(r.status()))

const shots = []
const shot = async (label) => {
  const path = join(out, `${id}-${label}.png`)
  await page.screenshot({ path })
  shots.push(path)
}

await page.goto(url)
await page.evaluate((id) => {
  localStorage.setItem('powder.character', id)
  localStorage.setItem('powder.camera', 'chase')
}, id)
await page.reload()
await page.waitForTimeout(1500)
const picked = await page.locator('.picker button.active').first().textContent()

await page.keyboard.press('Enter')
await page.keyboard.down('ArrowDown')
await page.waitForTimeout(1800)
await shot('chase')
await page.keyboard.up('ArrowDown')

await page.keyboard.press('Space') // ollie, then hold a grab
await page.waitForTimeout(80)
await page.keyboard.down('Shift')
await page.waitForTimeout(250)
await shot('grab')
await page.keyboard.up('Shift')
await page.waitForTimeout(1200)

await page.keyboard.press('KeyC')
await page.waitForTimeout(900)
await shot('topdown')

// yard sale: skis and poles fly off separately
await page.evaluate(() => Object.assign(window.__powder.sim.skier, { crashT: 1.6, tumbleDir: 1 }))
await page.waitForTimeout(700)
await shot('crash')
await browser.close()

console.log(`picker shows: ${picked}`)
console.log(`model ${id}.glb: ${loaded.length ? `loaded (HTTP ${loaded.join(', ')})` : 'NOT requested'}`)
console.log(`screenshots:\n  ${shots.join('\n  ')}`)
const ok = errors.length === 0 && loaded.includes(200)
console.log(ok ? 'OK' : `FAIL${errors.length ? `\nconsole errors:\n  ${errors.join('\n  ')}` : ''}`)
process.exit(ok ? 0 : 1)
