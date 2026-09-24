// World units are metres. Downhill is +z, x is across the slope.
export const COURSE = {
  seed: 1,
  length: 900,
  width: 90,
  // half-width of the skiable corridor; beyond this the forest is dense
  corridor: 34,
}

export const PHYS = {
  gravityAlongSlope: 4.4, // slope acceleration when pointing straight downhill
  gravity: 17, // vertical, while airborne (floaty on purpose)
  drag: 0.004, // quadratic air drag
  tuckDrag: 0.002,
  tuckBoost: 2.5,
  friction: 0.6,
  brake: 9,
  sideScrub: 3.2, // speed lost when carving across the fall line
  maxHeading: Math.PI * 0.48,
  turnRate: 2.4, // rad/s
  headingReturn: 0, // no auto-straightening
  ollieVy: 7,
  rampVy: 12,
  rampSpeedFactor: 0.12,
  spinRate: Math.PI * 3, // rad/s
  flipRate: Math.PI * 2.8,
  // when no rotation key is held, the body eases toward the nearest landable angle
  assistRate: Math.PI * 2.2,
  // fraction of the next rotation after which the assist completes it instead of easing back.
  // The first half-spin needs more commitment so a ~90° twist swings back as a shifty.
  firstSpinCommit: 0.6,
  spinCommit: 0.33,
  flipCommit: 0.33,
  shiftyMin: (55 * Math.PI) / 180,
  landSpinTolerance: (60 * Math.PI) / 180,
  landFlipTolerance: (75 * Math.PI) / 180,
  crashDuration: 1.6,
  crashSpeedFactor: 0.3,
  // after getting up you can't crash into things for a moment (the skier blinks)
  recoverDuration: 1.5,
  skierRadius: 0.45,
  maxSpeed: 22, // m/s ≈ 80 km/h
}

export const SCORE = {
  per180: 100,
  perFlip: 400,
  corkBonus: 1.3,
  shifty: 150,
  grabPerSecond: 250,
  minGrab: 0.15,
  gate: 50,
  bankDelay: 2.5,
  timePar: 75, // seconds; each second faster than par is worth timeBonusPerSecond
  timeBonusPerSecond: 60,
}
