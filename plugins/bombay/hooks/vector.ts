// Masaüstünde Bombay'ın vektör çizimleri. Her poz 22×8 birimlik kutuda
// (art.ts'teki piksel pozuyla aynı yer), zemin y=8'de; yan pozlar sağa bakar,
// sola bakış svg.ts'te aynalanır. Gövde parçaları aynı kara mürekkeple üst
// üste biner ve tek siluet olur; dış konturu svg.ts'teki süzgeç çizer.
// Uyku pozunun nefesi, kulak seğirmesi ve kuyruk kıpırtısı kendi SMIL
// döngüleriyle oynar: zaman çizelgesine kare yükü bindirmez.
//
// Terminal piksel çizimi (art.ts, paint.ts) olduğu gibi kalır.

import type { PoseName } from './art'

const FUR = '#141414'
const SHEEN = '#3E3E3E'
const INNER = '#2E2E2E'
const EYE = '#F2C12E'
const GLINT = '#FFF4CC'
const LID = '#8E8E8E'
const PINK = '#E58FA0'
const MOUTH = '#B9566A'
const WHISKER = '#7C7C7C'

type Pt = readonly [number, number]
type Eye = 'open' | 'closed' | 'wide' | 'squeeze'

const n = (v: number): string => String(Math.round(v * 100) / 100)
const p = (pt: Pt): string => `${n(pt[0])} ${n(pt[1])}`

// İlkeller

const blob = (d: string): string => `<path d="${d}"/>`
const oval = (cx: number, cy: number, rx: number, ry: number, fill?: string, rot = 0): string =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}"${fill ? ` fill="${fill}"` : ''}${
    rot ? ` transform="rotate(${rot} ${n(cx)} ${n(cy)})"` : ''
  }/>`
// Çizgilerin uç ve köşe yuvarlaklığını pozun kapsayıcı grubu verir (POSE_ATTRS).
const line = (d: string, w: number, color = FUR, extra = ''): string =>
  `<path d="${d}" fill="none"${color === FUR ? '' : ` stroke="${color}"`} stroke-width="${n(w)}"${extra}/>`
const sheen = (d: string, w = 0.2): string => line(d, w, SHEEN)
const tail = (d: string, w = 0.85, extra = ''): string => line(d, w, FUR, extra)

/**
 * Gövde: arka (kalça) ve ön (göğüs) daireleri, aralarında sırt ve karın
 * çizgisi. dip sırtı çökertir (eksi değer kamburlaştırır), sag karnı sarkıtır.
 */
function torso(r: Pt, rr: number, c: Pt, cr: number, dip = 0.2, sag = 0.15): string {
  const dx = c[0] - r[0]
  const dy = c[1] - r[1]
  const len = Math.hypot(dx, dy)
  const ux = dx / len
  const uy = dy / len
  // Sırta doğru birim normal.
  const vx = uy
  const vy = -ux
  const at = (b: Pt, k: number, a = 0): string => `${n(b[0] + vx * k + ux * a)} ${n(b[1] + vy * k + uy * a)}`
  return blob(
    `M${at(r, rr)}C${at(r, rr - dip, len / 3)} ${at(c, cr - dip, -len / 3)} ${at(c, cr)}` +
      `A${n(cr)} ${n(cr)} 0 0 1 ${at(c, -cr)}C${at(c, -cr - sag, -len / 3)} ${at(r, -rr - sag, len / 3)} ${at(r, -rr)}` +
      `A${n(rr)} ${n(rr)} 0 0 1 ${at(r, rr)}Z`,
  )
}

const paw = (at: Pt, dir = 1): string => oval(at[0] + 0.15 * dir, at[1] + 0.02, 0.5, 0.26)

/** Ön bacak: omuzdan pençeye, dirsekte hafif geriye bükük. */
function foreleg(top: Pt, foot: Pt, lifted = false, w = 0.95): string {
  const elbow: Pt = [(top[0] + foot[0]) / 2 - (lifted ? 0.55 : 0.12), (top[1] + foot[1]) / 2]
  return line(`M${p(top)}Q${p(elbow)} ${p(foot)}`, w) + paw(foot)
}

/** Arka bacak: kalçada iri uyluk, dizden topuğa geriye, topuktan pençeye. */
function hindleg(hip: Pt, foot: Pt, lifted = false, w = 0.88): string {
  const knee: Pt = [foot[0] + 0.55, Math.min(hip[1] + 1.35, foot[1] - 1.6)]
  const hock: Pt = [foot[0] - 0.45 - (lifted ? 0.2 : 0), foot[1] - (lifted ? 0.6 : 0.82)]
  const thigh = oval((hip[0] + knee[0]) / 2, (hip[1] + knee[1]) / 2 + 0.1, 1.2, 1.35, undefined, -18)
  return thigh + line(`M${p(knee)}L${p(hock)}L${p(foot)}`, w) + paw(foot)
}

/** Gerilmiş bacak (koşu, sıçrayış, gerinme): düz çizgi ve pati. */
const reach = (top: Pt, foot: Pt, w = 0.9): string => line(`M${p(top)}L${p(foot)}`, w) + paw(foot)

// Başlar

function sideEye(x: number, y: number, eye: Eye): string {
  if (eye === 'closed' || eye === 'squeeze') {
    const bend = eye === 'closed' ? 0.26 : -0.18
    return line(`M${n(x - 0.42)} ${n(y)}Q${n(x)} ${n(y + bend)} ${n(x + 0.4)} ${n(y)}`, 0.13, LID)
  }
  if (eye === 'wide') return oval(x, y, 0.46, 0.42, EYE) + oval(x + 0.05, y, 0.22, 0.24, FUR) + oval(x + 0.18, y - 0.14, 0.07, 0.07, GLINT)
  return oval(x, y, 0.43, 0.31, EYE, -10) + oval(x + 0.06, y, 0.1, 0.27, FUR) + oval(x + 0.18, y - 0.12, 0.06, 0.06, GLINT)
}

/** Yandan baş, sağa bakar; (x, y) kafatasının ortası, rot derece. */
function sideHead(x: number, y: number, rot: number, eye: Eye, ears: 'up' | 'back' = 'up'): string {
  const ear =
    ears === 'up'
      ? blob(`M${n(x - 0.95)} ${n(y - 0.75)}L${n(x - 1.05)} ${n(y - 2.25)}L${n(x + 0.1)} ${n(y - 1.3)}Z`) +
        blob(`M${n(x + 0.1)} ${n(y - 1.35)}L${n(x + 0.95)} ${n(y - 2.3)}L${n(x + 1.4)} ${n(y - 0.85)}Z`) +
        `<path d="M${n(x + 0.45)} ${n(y - 1.32)}L${n(x + 0.92)} ${n(y - 1.92)}L${n(x + 1.17)} ${n(y - 1.02)}Z" fill="${INNER}"/>`
      : blob(`M${n(x - 0.6)} ${n(y - 1.0)}L${n(x - 2.1)} ${n(y - 1.55)}L${n(x - 0.6)} ${n(y - 1.55)}Z`) +
        blob(`M${n(x - 0.1)} ${n(y - 1.2)}L${n(x - 1.4)} ${n(y - 2.05)}L${n(x + 0.6)} ${n(y - 1.45)}Z`)
  const parts =
    ear +
    oval(x, y, 1.75, 1.5) +
    oval(x + 1.2, y + 0.55, 0.98, 0.74) +
    sideEye(x + 0.82, y - 0.08, eye) +
    oval(x + 2.12, y + 0.38, 0.2, 0.14, PINK) +
    line(`M${n(x + 1.7)} ${n(y + 0.78)}L${n(x + 3.15)} ${n(y + 0.5)}M${n(x + 1.7)} ${n(y + 0.9)}L${n(x + 3.05)} ${n(y + 1.12)}`, 0.07, WHISKER, ' opacity=".8"') +
    sheen(`M${n(x - 1.15)} ${n(y - 0.95)}Q${n(x - 0.1)} ${n(y - 1.55)} ${n(x + 0.95)} ${n(y - 1.2)}`)
  return rot === 0 ? parts : `<g transform="rotate(${rot} ${n(x)} ${n(y)})">${parts}</g>`
}

function frontEye(x: number, y: number, eye: Eye): string {
  if (eye === 'closed') return line(`M${n(x - 0.55)} ${n(y)}Q${n(x)} ${n(y + 0.32)} ${n(x + 0.55)} ${n(y)}`, 0.13, LID)
  if (eye === 'squeeze') return line(`M${n(x - 0.55)} ${n(y + 0.12)}Q${n(x)} ${n(y - 0.16)} ${n(x + 0.55)} ${n(y + 0.12)}`, 0.13, LID)
  const almond = `M${n(x - 0.6)} ${n(y)}C${n(x - 0.3)} ${n(y - 0.46)} ${n(x + 0.3)} ${n(y - 0.46)} ${n(x + 0.6)} ${n(y)}C${n(x + 0.3)} ${n(y + 0.44)} ${n(x - 0.3)} ${n(y + 0.44)} ${n(x - 0.6)} ${n(y)}Z`
  const pupil = eye === 'wide' ? oval(x, y, 0.24, 0.3, FUR) : oval(x, y, 0.12, 0.35, FUR)
  return `<path d="${almond}" fill="${EYE}"/>` + pupil + oval(x + 0.17, y - 0.15, 0.07, 0.07, GLINT)
}

/** Önden baş; (x, y) yüzün ortası. */
function frontHead(x: number, y: number, eye: Eye, mouth: 'smile' | 'yawn' | 'lick' = 'smile', tilt = 0): string {
  const ears =
    blob(`M${n(x - 2.05)} ${n(y - 0.55)}L${n(x - 1.95)} ${n(y - 2.55)}L${n(x - 0.65)} ${n(y - 1.55)}Z`) +
    blob(`M${n(x + 2.05)} ${n(y - 0.55)}L${n(x + 1.95)} ${n(y - 2.55)}L${n(x + 0.65)} ${n(y - 1.55)}Z`) +
    `<path d="M${n(x - 1.75)} ${n(y - 0.95)}L${n(x - 1.72)} ${n(y - 2.08)}L${n(x - 1.0)} ${n(y - 1.5)}Z" fill="${INNER}"/>` +
    `<path d="M${n(x + 1.75)} ${n(y - 0.95)}L${n(x + 1.72)} ${n(y - 2.08)}L${n(x + 1.0)} ${n(y - 1.5)}Z" fill="${INNER}"/>`
  const face =
    oval(x, y, 2.3, 1.9) +
    oval(x, y + 0.55, 2.05, 1.45) +
    sheen(`M${n(x - 1.4)} ${n(y - 1.32)}Q${n(x)} ${n(y - 1.98)} ${n(x + 1.4)} ${n(y - 1.32)}`) +
    frontEye(x - 0.95, y + 0.05, eye) +
    frontEye(x + 0.95, y + 0.05, eye)
  const nose = `<path d="M${n(x - 0.24)} ${n(y + 0.68)}L${n(x + 0.24)} ${n(y + 0.68)}L${n(x)} ${n(y + 0.93)}Z" fill="${PINK}"/>`
  const mouthDraw =
    mouth === 'yawn'
      ? oval(x, y + 1.3, 0.5, 0.58, MOUTH) + oval(x, y + 1.6, 0.32, 0.2, PINK)
      : line(`M${n(x - 0.38)} ${n(y + 1.12)}Q${n(x - 0.18)} ${n(y + 1.3)} ${n(x)} ${n(y + 1.08)}Q${n(x + 0.18)} ${n(y + 1.3)} ${n(x + 0.38)} ${n(y + 1.12)}`, 0.08, '#4C4C4C') +
        (mouth === 'lick' ? oval(x + 0.05, y + 1.3, 0.22, 0.17, PINK) : '')
  const whiskers = line(
    `M${n(x - 0.9)} ${n(y + 0.9)}L${n(x - 2.9)} ${n(y + 0.55)}M${n(x - 0.9)} ${n(y + 1.05)}L${n(x - 2.95)} ${n(y + 1.1)}M${n(x - 0.9)} ${n(y + 1.2)}L${n(x - 2.8)} ${n(y + 1.62)}` +
      `M${n(x + 0.9)} ${n(y + 0.9)}L${n(x + 2.9)} ${n(y + 0.55)}M${n(x + 0.9)} ${n(y + 1.05)}L${n(x + 2.95)} ${n(y + 1.1)}M${n(x + 0.9)} ${n(y + 1.2)}L${n(x + 2.8)} ${n(y + 1.62)}`,
    0.07,
    WHISKER,
    ' opacity=".75"',
  )
  const parts = ears + face + nose + mouthDraw + whiskers
  return tilt === 0 ? parts : `<g transform="rotate(${tilt} ${n(x)} ${n(y + 1)})">${parts}</g>`
}

// Önden oturuş ailesi (sit, sitFlick, yawn, groom, groomLick)

function sitting(o: { eye: Eye; tail: 'rest' | 'flick'; mouth?: 'smile' | 'yawn' | 'lick'; paw?: 'down' | 'groom' | 'lick'; tilt?: number }): string {
  const tailD =
    o.tail === 'rest'
      ? 'M13.3 7.55C14.9 8 16.4 7.5 16.5 6.3C16.6 5.4 16.1 5 15.6 5.15'
      : 'M13.3 7.55C14.9 8 16.6 7.25 16.9 5.7C17.1 4.6 16.7 4 16.15 3.95'
  const raised = o.paw === 'groom' || o.paw === 'lick'
  const tip: Pt = o.paw === 'lick' ? [10.15, 4.05] : [9.85, 3.8]
  const body =
    tail(tailD) +
    blob('M8.7 4.1C7.5 5 7 6.3 7.15 7.5C7.25 7.9 7.7 8 8.2 8L12.8 8C13.3 8 13.75 7.9 13.85 7.5C14 6.3 13.5 5 12.3 4.1Z') +
    oval(8.0, 7.05, 1.15, 0.98) +
    oval(13.0, 7.05, 1.15, 0.98) +
    sheen('M8.7 4.75Q8.1 5.6 8.05 6.6', 0.16) +
    line('M11.15 5.5L11.2 7.62', 0.1, INNER) +
    oval(11.75, 7.82, 0.62, 0.3) +
    line('M11.2 7.66Q11.75 7.45 12.3 7.66', 0.08, INNER) +
    (raised
      ? ''
      : line('M9.85 5.5L9.8 7.62', 0.1, INNER) + oval(9.25, 7.82, 0.62, 0.3) + line('M8.7 7.66Q9.25 7.45 9.8 7.66', 0.08, INNER))
  const head = frontHead(10.5, 2.6, o.eye, o.mouth ?? 'smile', o.tilt ?? 0)
  const lifted = raised ? line(`M9.45 5.7Q8.95 4.75 ${p(tip)}`, 0.95) + oval(tip[0] + 0.05, tip[1] - 0.08, 0.5, 0.42) : ''
  return body + head + lifted
}

// Yandan duruş ailesi

type Legs = { hf: Pt; ff: Pt; hn: Pt; fn: Pt; up?: ReadonlyArray<'hf' | 'ff' | 'hn' | 'fn'> }

const HIP_FAR: Pt = [7.1, 4.5]
const HIP_NEAR: Pt = [7.7, 4.7]
const SHOULDER_FAR: Pt = [14.0, 5.0]
const SHOULDER_NEAR: Pt = [14.7, 5.2]
const STAND_TORSO = torso([7.5, 4.4], 1.62, [14.6, 4.4], 1.6, 0.18, 0.12)
const STAND_NECK = blob('M13.9 3.3C14.9 2.4 16 1.9 17 2.1L17.5 3.9C16.5 4.6 15.3 5 14.4 5.1Z')
const BACK_SHEEN = sheen('M8.6 2.95C10.6 3.12 12.6 3.12 14.2 2.95')
const UP_TAIL = 'M6.1 3.7C4.6 3.4 4 2.2 4.4 1C4.6 0.4 5.1 0.15 5.6 0.3'

function standing(legs: Legs, eye: Eye, o: { tail?: string; dy?: number } = {}): string {
  const up = new Set(legs.up ?? [])
  const parts =
    tail(o.tail ?? UP_TAIL) +
    hindleg(HIP_FAR, legs.hf, up.has('hf')) +
    foreleg(SHOULDER_FAR, legs.ff, up.has('ff')) +
    STAND_TORSO +
    STAND_NECK +
    sideHead(17.4, 2.25, 0, eye) +
    hindleg(HIP_NEAR, legs.hn, up.has('hn')) +
    foreleg(SHOULDER_NEAR, legs.fn, up.has('fn')) +
    BACK_SHEEN
  return o.dy ? `<g transform="translate(0 ${n(o.dy)})">${parts}</g>` : parts
}

const G = 7.72
const LIFT = 7.12

function walking(k: 1 | 2 | 3 | 4, eye: Eye): string {
  switch (k) {
    case 1:
      return standing({ hf: [8.6, G], ff: [13.5, G], hn: [6.8, G], fn: [16.0, G] }, eye, { tail: 'M6.1 3.7C4.6 3.4 3.9 2.3 4.2 1.1C4.4 0.5 4.8 0.2 5.3 0.3' })
    case 2:
      return standing({ hf: [7.9, LIFT], ff: [14.3, G], hn: [7.5, G], fn: [15.3, LIFT], up: ['hf', 'fn'] }, eye, { dy: -0.08 })
    case 3:
      return standing({ hf: [6.9, G], ff: [15.8, G], hn: [8.8, G], fn: [13.9, G] }, eye, { tail: 'M6.1 3.7C4.6 3.4 4.1 2.1 4.6 0.9C4.9 0.4 5.4 0.25 5.8 0.45' })
    case 4:
      return standing({ hf: [7.4, G], ff: [15.1, LIFT], hn: [8.1, LIFT], fn: [14.6, G], up: ['ff', 'hn'] }, eye, { dy: -0.08 })
  }
}

// Koşu, oyun, mama

function runOut(eye: Eye): string {
  return (
    tail('M6.2 3.6C4.8 3.2 3.4 2.6 2.2 1.9') +
    reach([7.0, 5.0], [3.2, 7.2]) +
    reach([15.0, 5.0], [19.0, 7.3]) +
    torso([7.2, 4.2], 1.55, [15.2, 4.0], 1.5, 0.15, 0.1) +
    oval(7.6, 5.0, 1.3, 1.3) +
    blob('M14.6 3.1C15.6 2.4 16.7 2.1 17.6 2.4L17.9 3.9C16.9 4.4 15.7 4.7 14.8 4.8Z') +
    sideHead(18.0, 2.6, 8, eye, 'back') +
    reach([7.8, 5.4], [2.6, G], 0.95) +
    reach([15.4, 5.2], [19.8, G], 0.95)
  )
}

function runIn(eye: Eye): string {
  return (
    tail('M7 3.4C5.6 2.8 4.2 2.5 2.8 2.6') +
    reach([9.0, 5.0], [12.6, 7.5]) +
    reach([14.4, 5.0], [12.2, 7.4]) +
    torso([8.6, 4.2], 1.7, [14.6, 4.1], 1.6, -0.45, 0) +
    blob('M13.8 3.2C15 2.5 16.1 2.3 17 2.7L17.3 4.2C16.3 4.7 15.1 4.9 14.2 5Z') +
    sideHead(17.4, 3.0, 4, eye, 'back') +
    oval(9.2, 5.0, 1.3, 1.4, undefined, -25) +
    reach([9.6, 5.4], [13.4, G], 0.95) +
    reach([15.0, 5.2], [13.0, G], 0.95)
  )
}

function crouching(eye: Eye, o: { wiggle?: boolean; bat?: boolean } = {}): string {
  return (
    tail(o.wiggle ? 'M6.4 4.6C4.9 4.4 3.9 3.6 3.6 2.6' : 'M6.6 4.9C5 4.9 3.9 4.4 3.3 3.4') +
    line('M14.2 6.9L16.4 7.62', 0.85) +
    paw([16.6, G]) +
    torso(o.wiggle ? [7.8, 4.9] : [8.0, 5.2], 1.65, [14.4, 5.8], 1.45, 0.05, 0.05) +
    oval(8.6, 6.7, 1.6, 1.05) +
    paw([9.8, G]) +
    blob('M14.4 4.9C15.4 4.4 16.4 4.3 17.2 4.6L17.4 6.4C16.4 6.9 15.4 7 14.6 7Z') +
    sideHead(17.5, 5.0, 8, eye) +
    (o.bat
      ? line('M14.8 6.4Q16.8 5.5 19 6.2', 0.9) + oval(19.25, 6.25, 0.52, 0.32, undefined, 15)
      : line('M14.6 6.9L17.1 7.62', 0.9) + paw([17.3, G]))
  )
}

function pouncing(eye: Eye): string {
  return (
    `<g transform="rotate(-10 11.5 4)">` +
    tail('M5.8 3.9C4.4 3.4 3.2 2.6 2 2.2') +
    reach([7.0, 5.0], [3.2, 6.4]) +
    reach([15.0, 5.0], [19.2, 5.7]) +
    torso([7.2, 4.3], 1.55, [15.2, 4.2], 1.5, 0.1, 0.05) +
    oval(7.6, 5.0, 1.3, 1.3) +
    blob('M14.6 3.3C15.6 2.5 16.7 2.2 17.6 2.5L17.9 4C16.9 4.5 15.7 4.8 14.8 4.9Z') +
    sideHead(18.0, 2.7, 4, eye, 'back') +
    reach([7.8, 5.3], [3.8, 6.9], 0.95) +
    reach([15.6, 5.2], [19.8, 5.1], 0.95) +
    '</g>'
  )
}

function eating(eye: Eye, chew: boolean): string {
  const hy = chew ? 6.3 : 6.05
  return (
    tail('M6.1 3.8C4.7 3.4 4.1 2.4 4.3 1.2C4.4 0.6 4.8 0.35 5.2 0.4') +
    hindleg(HIP_FAR, [7.3, G]) +
    foreleg(SHOULDER_FAR, [14.2, G]) +
    STAND_TORSO +
    blob(`M13.9 3.2C15.4 3 16.6 3.9 17.4 ${n(hy - 1.1)}L17.5 ${n(hy + 0.7)}C16.2 6.3 15 5.6 14.2 5.3Z`) +
    sideHead(17.7, hy, chew ? 34 : 30, eye) +
    hindleg(HIP_NEAR, [8.0, G]) +
    foreleg(SHOULDER_NEAR, [15.2, G]) +
    BACK_SHEEN
  )
}

// Yatış, uyku, gerinme, ürkme

function loafing(eye: Eye): string {
  return (
    blob('M6.4 8C6 5.8 7.6 3.9 10.6 3.75C13.4 3.65 15.6 4.5 16.4 6C16.8 6.8 16.9 7.4 16.8 8Z') +
    sheen('M8.2 4.35C10 3.95 12.6 3.95 14.4 4.4') +
    tail('M6.8 7.72C8.6 8.02 11 8 12.6 7.7', 0.75) +
    sheen('M7.6 7.66C9 7.86 10.8 7.86 12.2 7.64', 0.12) +
    paw([16.4, G]) +
    sideHead(17.2, 4.7, 0, eye)
  )
}

/**
 * Kıvrılmış uyku: baş patilerde, kuyruk burna sarılı. Nefes, kulak seğirmesi
 * ve kuyruk ucu kendi döngüsünde oynar; süreler (4.2 s, 7.3 s, 11.3 s)
 * birbirine bölünmez, hareketin tekrar ettiği belli olmaz.
 */
function sleeping(): string {
  const breath =
    `<g transform="translate(11 8)"><g>` +
    `<animateTransform attributeName="transform" type="scale" values="1 1;1.012 1.055;1 1" keyTimes="0;.45;1" dur="4.2s" repeatCount="indefinite" calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"/>` +
    `<g transform="translate(-11 -8)">` +
    blob('M6 8C5.6 5.7 7.5 3.85 10.6 3.75C13.6 3.65 15.8 5 16.2 6.9L16.2 8Z') +
    sheen('M8 4.3C9.8 3.95 12.4 3.95 14.2 4.5') +
    `</g></g></g>`
  const ear =
    `<g><animateTransform attributeName="transform" type="rotate" values="0 15.7 4.8;0 15.7 4.8;-16 15.7 4.8;0 15.7 4.8;-10 15.7 4.8;0 15.7 4.8" keyTimes="0;.9;.925;.95;.97;1" dur="7.3s" repeatCount="indefinite"/>` +
    blob('M15.6 4.95L15.45 3.5L16.55 4.45Z') +
    `</g>`
  const head =
    blob('M14.4 5.3L14.1 3.85L15.3 4.75Z') +
    ear +
    oval(15.4, 6.25, 1.7, 1.4) +
    oval(16.5, 6.85, 0.92, 0.66) +
    line('M15.75 6.2Q16.15 6.48 16.55 6.2', 0.13, LID) +
    oval(17.38, 6.62, 0.17, 0.12, PINK) +
    sheen('M14.1 5.45Q15 4.9 16.1 5.15')
  const tip =
    `<g><animateTransform attributeName="transform" type="rotate" values="0 15.4 7.68;0 15.4 7.68;-14 15.4 7.68;4 15.4 7.68;0 15.4 7.68" keyTimes="0;.8;.86;.93;1" dur="11.3s" repeatCount="indefinite"/>` +
    tail('M15.4 7.68C16.6 7.55 17.8 7.45 18.6 7.05', 0.8) +
    `</g>`
  return (
    breath +
    paw([16.9, 7.74]) +
    head +
    tail('M6.4 7.72C9.5 8.08 12.8 8.05 15.4 7.68', 0.8) +
    tip +
    sheen('M7.4 7.62C10 7.9 12.8 7.88 15 7.56', 0.12)
  )
}

function stretching(eye: Eye): string {
  return (
    tail('M6.8 3.1C5.8 2.5 5.3 1.5 5.2 0.4') +
    line('M13.6 6.9L17.8 7.66', 0.85) +
    paw([18.0, G]) +
    reach([7.8, 4.4], [7.5, G]) +
    torso([8.0, 3.5], 1.55, [14.0, 5.9], 1.3, 0.1, 0.05) +
    oval(8.4, 4.4, 1.25, 1.4, undefined, -10) +
    blob('M14.2 5.1C15.2 4.7 16.1 4.7 16.8 5L17.1 6.8C16.1 7.2 15.1 7.3 14.3 7.2Z') +
    sideHead(17.2, 5.6, 6, eye) +
    reach([8.6, 4.8], [8.5, G], 0.95) +
    line('M14.4 7L18.6 7.68', 0.85) +
    paw([18.8, G])
  )
}

function arching(eye: Eye): string {
  return (
    tail('M6.6 4.3C5.7 3.4 5.3 2.2 5.3 0.5', 1.3) +
    reach([6.9, 4.8], [6.6, G], 1.0) +
    reach([14.7, 4.5], [14.9, G], 1.0) +
    blob('M5.9 5.4C6 2.6 8.4 1.2 11 1.2C13.6 1.2 15.9 2.6 16 4.9L14.4 5C14.2 3.7 12.8 3.3 11 3.3C9.2 3.3 7.8 3.9 7.5 5.4Z') +
    sheen('M7.4 3.3C8.4 2.1 9.6 1.55 11 1.55C12.4 1.55 13.8 2.1 14.8 3.1') +
    sideHead(16.9, 3.3, 0, eye, 'back') +
    reach([7.6, 5.0], [7.6, G], 1.0) +
    reach([15.4, 4.5], [15.8, G], 1.0)
  )
}

// Poz tablosu

/**
 * Bir pozun vektör çizimi, sağa bakar. closed gözleri kapatır (göz kırpma,
 * keyif). Uyku pozunun gözleri her zaman kapalı.
 */
export function catVector(pose: PoseName, closed: boolean): string {
  const eye: Eye = closed ? 'closed' : 'open'
  switch (pose) {
    case 'sit':
      return sitting({ eye, tail: 'rest' })
    case 'sitFlick':
      return sitting({ eye, tail: 'flick' })
    case 'yawn':
      return sitting({ eye: 'squeeze', tail: 'rest', mouth: 'yawn', tilt: -4 })
    case 'groom':
      return sitting({ eye: 'closed', tail: 'rest', paw: 'groom', tilt: -6 })
    case 'groomLick':
      return sitting({ eye: 'closed', tail: 'rest', paw: 'lick', mouth: 'lick', tilt: -10 })
    case 'stand':
      return standing({ hf: [7.3, G], ff: [14.1, G], hn: [8.0, G], fn: [14.9, G] }, eye)
    case 'walk1':
      return walking(1, eye)
    case 'walk2':
      return walking(2, eye)
    case 'walk3':
      return walking(3, eye)
    case 'walk4':
      return walking(4, eye)
    case 'runOut':
      return runOut(eye)
    case 'runIn':
      return runIn(eye)
    case 'crouch':
      return crouching(eye)
    case 'crouchWiggle':
      return crouching(eye, { wiggle: true })
    case 'pounce':
      return pouncing(eye)
    case 'bat':
      return crouching(eye, { bat: true })
    case 'eat':
      return eating('closed', false)
    case 'eatChew':
      return eating('closed', true)
    case 'loaf':
      return loafing(eye)
    case 'sleep':
    case 'sleepBreath':
    case 'sleepEar':
      return sleeping()
    case 'stretch':
      return stretching('squeeze')
    case 'arch':
      return arching(closed ? 'closed' : 'wide')
  }
}

/**
 * Bir pozun kapsayıcı grubunun nitelikleri: kürk mürekkebi (dolgu ve çizgi),
 * yuvarlak uç ve köşeler; dolgulu parçalar çizgisiz kalsın diye kalınlık 0.
 */
export const POSE_ATTRS = `fill="${FUR}" stroke="${FUR}" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"`

// Eşyalar

/** Mama kabı, 6×3 birim, doluluk 0..3. */
export function bowlVector(food: number): string {
  const mound =
    food >= 3
      ? oval(3, 1.15, 2.15, 0.72, '#B7793F') + oval(2.2, 0.9, 0.28, 0.2, '#8F5A2B') + oval(3.5, 0.75, 0.28, 0.2, '#8F5A2B') + oval(4.1, 1.1, 0.26, 0.19, '#C98E55')
      : food === 2
        ? oval(3, 1.25, 1.75, 0.5, '#B7793F') + oval(2.5, 1.05, 0.26, 0.18, '#8F5A2B') + oval(3.6, 1.1, 0.26, 0.18, '#C98E55')
        : food === 1
          ? oval(2.5, 1.2, 0.3, 0.2, '#B7793F') + oval(3.4, 1.25, 0.3, 0.2, '#8F5A2B')
          : ''
  return (
    '<ellipse cx="3" cy="2.9" rx="2.5" ry=".22" fill="#000" opacity=".28"/>' +
    mound +
    `<path d="M0.35 1.25L5.65 1.25L5.05 2.85Q3 3.05 0.95 2.85Z" fill="#4E7FD1"/>` +
    `<path d="M0.35 1.25L5.65 1.25L5.55 1.6L0.45 1.6Z" fill="#6C98E2"/>` +
    `<path d="M1.1 2.3Q3 2.45 4.9 2.3" fill="none" stroke="#36598F" stroke-width=".18"/>`
  )
}

/** Yumak, 3×3 birim; svg.ts yuvarlanırken ortası etrafında döndürür. */
export function yarnVector(): string {
  return (
    `<circle cx="1.5" cy="1.5" r="1.38" fill="#D9485F"/>` +
    `<path d="M0.4 1.0Q1.6 1.5 2.6 0.7M0.25 1.7Q1.5 2.1 2.85 1.5M0.7 2.5Q1.7 2.3 2.4 2.55M1.1 0.2Q0.9 1.4 1.4 2.85" fill="none" stroke="#9E2F42" stroke-width=".16" stroke-linecap="round"/>` +
    `<path d="M1.95 0.45Q2.35 0.75 2.2 1.05" fill="none" stroke="#F07A8C" stroke-width=".14" stroke-linecap="round"/>`
  )
}

/** Claude'un turuncu yıldızı, (0, 0) çevresinde. */
export function starVector(): string {
  const rays = [0, 45, 90, 135]
    .map(a => {
      const r = (a * Math.PI) / 180
      const x = Math.cos(r) * 0.95
      const y = Math.sin(r) * 0.95
      return `M${n(-x)} ${n(-y)}L${n(x)} ${n(y)}`
    })
    .join('')
  return `<path d="${rays}" fill="none" stroke="#D97757" stroke-width=".36" stroke-linecap="round"/>`
}
