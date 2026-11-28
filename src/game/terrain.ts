// Visual snow surface: gentle rolls plus mogul fields. Physics treats the slope as flat;
// everything that sits on the snow adds this height so nothing floats or sinks.

const hash = (x: number, z: number) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43_758.5453
  return s - Math.floor(s)
}

function valueNoise(x: number, z: number) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi)
  const b = hash(xi + 1, zi)
  const c = hash(xi, zi + 1)
  const d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function terrainHeight(x: number, z: number) {
  const rolls = (valueNoise(x * 0.06, z * 0.05) - 0.5) * 3
  const mask = Math.min(1, Math.max(0, valueNoise(x * 0.03 + 40, z * 0.025) - 0.4) * 3)
  const moguls = mask * Math.sin(x * 0.7 + Math.sin(z * 0.1) * 2) * Math.sin(z * 0.6) * 0.9
  return rolls + moguls
}
