// Bombay'ın davranışı: sanal evcil hayvan. Açlık, enerji ve eğlence zamanla
// değişir ve sıradaki işi seçer. Vaktinin çoğu uykuda geçer (nefes alır,
// kulağı seğirir, arada kıpırdanıp yine dalar); arada oturur, yalanır,
// gezinir, seyrek olarak mama yer, yumakla oynar ya da koşturur. Claude
// çalışırken turuncu yıldızı iki kez kovalar, sonra yıldızın yanında kestirir.
// Terminal bu simülasyonu canlı adımlar; masaüstü sabit bir gündemle önceden
// koşup SVG döngüsüne derler.

import { POSE_W } from './art'
import type { PoseName } from './art'

export const TICK_MS = 100
/** Bölgenin piksel boyu: 2 boşluk, 1 kontur, 8 kedi, 1 kontur. */
export const GRID_H = 12
/** Yerdeyken pozun üst satırı. */
export const SPRITE_TOP = GRID_H - 1 - 8
/** Pençelerin bastığı satır; eşyalar da buraya oturur. */
export const GROUND = GRID_H - 2

export type Gait = 'walk' | 'trot' | 'run'
export type Fx = 'z' | 'note' | 'bang' | 'heart'
export type Poke = 'done' | 'oops' | 'pet' | 'feed' | 'play'
export type Activity = 'sit' | 'walk' | 'groom' | 'lie' | 'nap' | 'sleep' | 'eat' | 'play' | 'zoomies'

/** Uyku pozları: art.ts'te nefes ve kulak kareleri, vector.ts'te tek çizim. */
export const SLEEP_POSES: ReadonlySet<PoseName> = new Set(['sleep', 'sleepBreath', 'sleepEar'])

type Step =
  | { k: 'go'; to: number; gait: Gait }
  | { k: 'pose'; poses: PoseName[]; every: number; ticks: number; fx?: Fx; closed?: boolean; idle?: boolean }
  | { k: 'leap'; to: number }
  | { k: 'face'; dir: 1 | -1 }
  | { k: 'bowl'; at: number | null }
  | { k: 'eat'; ticks: number }
  | { k: 'ball'; at: number | null }
  | { k: 'kick'; dist: number }
  | { k: 'chaseBall'; pounce: boolean }
  | { k: 'sleep'; ticks: number }
  | { k: 'toy' }
  | { k: 'need'; hunger?: number; energy?: number; fun?: number }

export type Sim = {
  x: number
  dir: 1 | -1
  lift: number
  pose: PoseName
  closed: boolean
  steps: Step[]
  cur?: Step
  t: number
  from: number
  blink: number
  fx?: Fx
  fxLeft: number
  bowl?: { x: number; food: number }
  ball?: { x: number; to: number; lift: number }
  toy?: number
  working: boolean
  /** Bu iş turunda yıldızı kaç kez kovaladı; ikiden sonra kestirir. */
  chased: number
  hunger: number
  energy: number
  fun: number
  agendaAt: number
  seed: number
  tick: number
}

export type SimInput = { width: number; isWorking: boolean }
/**
 * agenda: masaüstü döngüsü için sabit sıra; yoksa ihtiyaçlar seçer.
 * hold: adımlar bitince yeni iş seçme, son pozda kal.
 */
export type SimOptions = { agenda?: Activity[]; hold?: boolean }

const W = POSE_W
const BALL_W = 3
const BOWL_W = 6
const FRONT: ReadonlySet<PoseName> = new Set(['sit', 'sitFlick', 'yawn', 'groom', 'groomLick'])
const WALK: PoseName[] = ['walk1', 'walk2', 'walk3', 'walk4']
const LEAP_H = 3

export function maxX(width: number): number {
  return Math.max(0, width - W)
}

export function createSim(width: number, seed = 0xb0b): Sim {
  return {
    x: maxX(width),
    dir: -1,
    lift: 0,
    pose: 'sit',
    closed: false,
    steps: [],
    t: 0,
    from: 0,
    blink: 0,
    fxLeft: 0,
    working: false,
    chased: 0,
    hunger: 35,
    energy: 80,
    fun: 55,
    agendaAt: 0,
    seed,
    tick: 0,
  }
}

function rand(s: Sim): number {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0
  return s.seed / 4294967296
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

function clone(s: Sim): Sim {
  return {
    ...s,
    steps: [...s.steps],
    bowl: s.bowl && { ...s.bowl },
    ball: s.ball && { ...s.ball },
  }
}

function setFx(s: Sim, fx: Fx | undefined, ticks: number): void {
  s.fx = fx
  s.fxLeft = ticks
}

// Eşyaya göre kedinin durması gereken yer: yüzü ya da patisi eşyanın üstünde.
function beforeBall(ballX: number, dir: 1 | -1): number {
  return dir > 0 ? ballX - (W - 1) : ballX + BALL_W - 1
}
function atBowl(bowlX: number, dir: 1 | -1): number {
  return dir > 0 ? bowlX - (W - 5) : bowlX + BOWL_W - 5
}

// Etkinlik planları

/** Uykuda kıpırdanma: başını kaldırır, bir an bakar, yine yatar. */
const stir = (): Step[] => [
  { k: 'pose', poses: ['loaf'], every: 1, ticks: 8, closed: true },
  { k: 'pose', poses: ['loaf'], every: 1, ticks: 10 },
  { k: 'pose', poses: ['loaf'], every: 1, ticks: 6, closed: true },
]

const sitFor = (ticks: number): Step => ({ k: 'pose', poses: ['sit'], every: 1, ticks, idle: true })

function plan(s: Sim, activity: Activity, hi: number): Step[] {
  switch (activity) {
    case 'sit':
      return [sitFor(25 + Math.floor(rand(s) * 35))]
    case 'walk': {
      let to = Math.round(rand(s) * hi)
      if (Math.abs(to - s.x) < 10) to = s.x < hi / 2 ? Math.min(hi, s.x + 14) : Math.max(0, s.x - 14)
      return [{ k: 'go', to, gait: 'walk' }, { k: 'pose', poses: ['stand'], every: 1, ticks: 6, idle: true }]
    }
    case 'groom':
      return [
        { k: 'pose', poses: ['groom', 'groomLick'], every: 3, ticks: 30 },
        sitFor(8),
      ]
    case 'lie':
      return [{ k: 'pose', poses: ['loaf'], every: 1, ticks: 50 + Math.floor(rand(s) * 40), idle: true }]
    case 'nap':
      return [
        { k: 'pose', poses: ['loaf'], every: 1, ticks: 12, idle: true },
        { k: 'sleep', ticks: 240 + Math.floor(rand(s) * 120) },
        { k: 'pose', poses: ['yawn'], every: 1, ticks: 8 },
        sitFor(6),
      ]
    case 'sleep':
      return [
        { k: 'pose', poses: ['loaf'], every: 1, ticks: 12, idle: true },
        { k: 'sleep', ticks: 260 + Math.floor(rand(s) * 140) },
        ...stir(),
        { k: 'sleep', ticks: 280 + Math.floor(rand(s) * 160) },
        { k: 'pose', poses: ['yawn'], every: 1, ticks: 8 },
        { k: 'pose', poses: ['stretch'], every: 1, ticks: 12 },
        sitFor(6),
      ]
    case 'eat': {
      const dir: 1 | -1 = s.x + W / 2 < (hi + W) / 2 ? 1 : -1
      const bowl = clamp(dir > 0 ? s.x + W + 6 : s.x - BOWL_W - 6, 1, hi + W - BOWL_W - 1)
      const spot = clamp(atBowl(bowl, dir), 0, hi)
      return [
        { k: 'bowl', at: bowl },
        { k: 'face', dir },
        { k: 'pose', poses: ['sit'], every: 1, ticks: 6, fx: 'note' },
        { k: 'go', to: spot, gait: 'trot' },
        { k: 'face', dir },
        { k: 'eat', ticks: 45 },
        { k: 'bowl', at: null },
        { k: 'need', hunger: -70 },
        { k: 'pose', poses: ['groom', 'groomLick'], every: 3, ticks: 15 },
        sitFor(6),
      ]
    }
    case 'play': {
      const dir: 1 | -1 = s.x + W / 2 < (hi + W) / 2 ? 1 : -1
      const ball = clamp(dir > 0 ? s.x + W + 8 : s.x - BALL_W - 8, 0, hi + W - BALL_W)
      const steps: Step[] = [
        { k: 'ball', at: ball },
        { k: 'face', dir },
        { k: 'pose', poses: ['crouch', 'crouchWiggle'], every: 2, ticks: 10 },
        { k: 'chaseBall', pounce: true },
      ]
      const rounds = 2 + Math.floor(rand(s) * 2)
      for (let i = 0; i < rounds; i++) {
        steps.push({ k: 'kick', dist: 12 + Math.floor(rand(s) * 14) })
        steps.push({ k: 'chaseBall', pounce: i % 2 === 1 })
        steps.push({ k: 'pose', poses: ['bat', 'crouch'], every: 2, ticks: 6 })
      }
      steps.push({ k: 'ball', at: null }, { k: 'need', fun: 45, energy: -8 }, sitFor(10))
      return steps
    }
    case 'zoomies': {
      const far = s.x < hi / 2 ? hi : 0
      const near = far === 0 ? hi : 0
      return [
        { k: 'pose', poses: ['crouch', 'crouchWiggle'], every: 1, ticks: 6 },
        { k: 'go', to: far, gait: 'run' },
        { k: 'go', to: near, gait: 'run' },
        { k: 'leap', to: clamp(near + (far > near ? 10 : -10), 0, hi) },
        { k: 'go', to: far, gait: 'run' },
        { k: 'need', fun: 35, energy: -15 },
        { k: 'pose', poses: ['arch'], every: 1, ticks: 4 },
        sitFor(10),
      ]
    }
  }
}

function chasePlan(s: Sim, width: number): Step[] {
  const hi = maxX(width)
  const toy = s.toy ?? Math.round(width / 2)
  const dir: 1 | -1 = toy > s.x + W / 2 ? 1 : -1
  const land = clamp(dir > 0 ? toy - (W - 3) : toy - 2, 0, hi)
  const stop = clamp(land - dir * 8, 0, hi)
  return [
    { k: 'go', to: stop, gait: 'trot' },
    { k: 'face', dir },
    { k: 'pose', poses: ['crouch', 'crouchWiggle'], every: 1, ticks: 5 },
    { k: 'leap', to: land },
    { k: 'toy' },
    { k: 'pose', poses: ['stand'], every: 1, ticks: 3 },
  ]
}

/** Claude çalışırken: yıldızı iki kez kovalar, sonra yanında kestirir. */
function workPlan(s: Sim, width: number): Step[] {
  if (s.chased < 2) {
    s.chased += 1
    return chasePlan(s, width)
  }
  s.chased = 0
  return plan(s, 'nap', maxX(width))
}

// Uyku ağır basar; oyun, koşu ve mama seyrek gelir.
function choose(s: Sim): Activity {
  const weights: Array<[Activity, number]> = [
    ['sit', 2],
    ['walk', 1.2],
    ['groom', 1],
    ['lie', 1.5],
    ['nap', 3],
    ['sleep', s.energy < 50 ? 8 : 2.5],
    ['play', 0.25 + (100 - s.fun) / 120],
    ['zoomies', s.energy > 60 ? 0.1 + (100 - s.fun) / 300 : 0],
    ['eat', s.hunger > 70 ? 6 : 0.1],
  ]
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let r = rand(s) * total
  for (const [activity, w] of weights) {
    r -= w
    if (r < 0) return activity
  }
  return 'sit'
}

// Bir olaya tepki: o anki işi bırakır.
function interrupt(s: Sim): void {
  s.steps = []
  s.cur = undefined
  s.t = 0
  s.lift = 0
  s.bowl = undefined
  s.ball = undefined
  if (s.fx === 'z') setFx(s, undefined, 0)
}

export function poke(prev: Sim, kind: Poke, width: number): Sim {
  const s = clone(prev)
  const hi = maxX(width)
  const wasAsleep = s.cur?.k === 'sleep'
  interrupt(s)
  const wake: Step[] = wasAsleep ? [{ k: 'pose', poses: ['yawn'], every: 1, ticks: 6 }] : []
  if (kind === 'done') {
    s.steps = [...wake, { k: 'pose', poses: ['sit', 'sitFlick'], every: 3, ticks: 20, fx: 'note', closed: true }]
  } else if (kind === 'oops') {
    s.steps = [{ k: 'pose', poses: ['arch'], every: 1, ticks: 14, fx: 'bang' }, sitFor(6)]
  } else if (kind === 'pet') {
    s.steps = [...wake, { k: 'pose', poses: ['sit'], every: 1, ticks: 18, fx: 'heart', closed: true }, { k: 'need', fun: 10 }]
  } else {
    s.steps = [...wake, ...plan(s, kind === 'feed' ? 'eat' : 'play', hi)]
  }
  return s
}

// Adımlar

function startStep(s: Sim, cur: Step, input: SimInput): Step {
  s.from = s.x
  if (cur.k === 'chaseBall') {
    const ball = s.ball
    if (ball === undefined) return { k: 'pose', poses: ['stand'], every: 1, ticks: 1 }
    const dir: 1 | -1 = ball.to + 1 > s.x + W / 2 ? 1 : -1
    s.dir = dir
    const to = clamp(beforeBall(ball.to, dir), 0, maxX(input.width))
    return cur.pounce ? { k: 'leap', to } : { k: 'go', to, gait: 'trot' }
  }
  if (cur.k === 'go' && cur.to !== s.x) s.dir = cur.to > s.x ? 1 : -1
  if (cur.k === 'leap' && cur.to !== s.x) s.dir = cur.to > s.x ? 1 : -1
  return cur
}

// Bir tik koşar; adım bittiyse true.
function runStep(s: Sim, cur: Step, input: SimInput): boolean {
  const hi = maxX(input.width)
  switch (cur.k) {
    case 'face':
      s.dir = cur.dir
      return true
    case 'bowl':
      s.bowl = cur.at === null ? undefined : { x: cur.at, food: 3 }
      return true
    case 'ball':
      s.ball = cur.at === null ? undefined : { x: cur.at, to: cur.at, lift: 0 }
      return true
    case 'kick': {
      if (s.ball === undefined) return true
      const lo = 0
      const top = input.width - BALL_W
      let dir = s.dir
      if ((dir > 0 && s.ball.x + cur.dist > top) || (dir < 0 && s.ball.x - cur.dist < lo)) dir = dir > 0 ? -1 : 1
      s.ball.to = clamp(s.ball.x + dir * cur.dist, lo, top)
      return true
    }
    case 'toy': {
      const old = s.toy ?? 0
      let next = 3 + Math.round(rand(s) * (input.width - 6))
      if (Math.abs(next - old) < 18) next = old < input.width / 2 ? Math.min(input.width - 3, old + 24) : Math.max(3, old - 24)
      s.toy = next
      return true
    }
    case 'need':
      s.hunger = clamp(s.hunger + (cur.hunger ?? 0), 0, 100)
      s.energy = clamp(s.energy + (cur.energy ?? 0), 0, 100)
      s.fun = clamp(s.fun + (cur.fun ?? 0), 0, 100)
      return true
    case 'go': {
      const target = clamp(cur.to, 0, hi)
      const speed = cur.gait === 'run' ? 2 : 1
      const moves = cur.gait !== 'walk' || s.t % 2 === 1
      if (moves) s.x = s.x < target ? Math.min(target, s.x + speed) : Math.max(target, s.x - speed)
      s.pose =
        cur.gait === 'run'
          ? s.t % 2 === 0
            ? 'runOut'
            : 'runIn'
          : (WALK[Math.floor(cur.gait === 'walk' ? s.t / 2 : s.t) % WALK.length] ?? 'stand')
      if (cur.gait === 'run') s.energy = clamp(s.energy - 0.1, 0, 100)
      s.t += 1
      return s.x === target
    }
    case 'leap': {
      const target = clamp(cur.to, 0, hi)
      const length = Math.max(5, Math.ceil(Math.abs(target - s.from) / 2))
      s.t += 1
      const p = Math.min(1, s.t / length)
      s.x = Math.round(s.from + (target - s.from) * p)
      s.lift = Math.round(4 * LEAP_H * p * (1 - p))
      s.pose = 'pounce'
      if (p >= 1) {
        s.lift = 0
        return true
      }
      return false
    }
    case 'eat': {
      s.pose = Math.floor(s.t / 3) % 2 === 0 ? 'eat' : 'eatChew'
      if (s.bowl !== undefined) s.bowl.food = Math.max(0, Math.ceil(3 * (1 - (s.t + 1) / cur.ticks)))
      s.t += 1
      return s.t >= cur.ticks
    }
    case 'sleep': {
      s.pose = s.t % 97 < 3 ? 'sleepEar' : s.t % 36 < 18 ? 'sleep' : 'sleepBreath'
      if (s.fx !== 'z') setFx(s, 'z', -1)
      s.energy = clamp(s.energy + 0.2, 0, 100)
      s.t += 1
      const done = cur.ticks >= 0 ? s.t >= cur.ticks : s.energy >= 100
      if (done) setFx(s, undefined, 0)
      return done
    }
    case 'pose': {
      if (s.t === 0 && cur.fx !== undefined) setFx(s, cur.fx, cur.ticks)
      let pose = cur.poses[Math.floor(s.t / cur.every) % cur.poses.length] ?? 'sit'
      if (cur.idle && pose === 'sit' && s.t % 40 >= 34) pose = 'sitFlick'
      s.pose = pose
      s.closed = cur.closed === true
      if (cur.idle && s.blink === 0 && rand(s) < 0.03) s.blink = 4
      s.t += 1
      return s.t >= cur.ticks
    }
    case 'chaseBall':
      return true
  }
}

function moveBall(s: Sim): void {
  const ball = s.ball
  if (ball === undefined) return
  const left = Math.abs(ball.to - ball.x)
  if (left === 0) {
    ball.lift = 0
    return
  }
  const speed = left > 4 ? 2 : 1
  ball.x += ball.to > ball.x ? speed : -speed
  ball.lift = left > 8 && left % 4 < 2 ? 1 : 0
}

/** Bir tik ilerletir; önceki durumu değiştirmez. */
export function step(prev: Sim, input: SimInput, opts: SimOptions = {}): Sim {
  const s = clone(prev)
  const hi = maxX(input.width)
  s.tick += 1
  if (s.x > hi) s.x = hi
  s.hunger = clamp(s.hunger + 0.015, 0, 100)
  if (s.cur?.k !== 'sleep') s.energy = clamp(s.energy - 0.02, 0, 100)
  s.fun = clamp(s.fun - 0.03, 0, 100)
  if (s.blink > 0) s.blink -= 1
  if (s.fxLeft > 0) {
    s.fxLeft -= 1
    if (s.fxLeft === 0) s.fx = undefined
  }

  if (input.isWorking && !s.working) {
    const wasAsleep = s.cur?.k === 'sleep'
    s.working = true
    s.chased = 0
    interrupt(s)
    s.toy = s.x > hi / 2 ? 4 : input.width - 4
    if (wasAsleep) s.steps = [{ k: 'pose', poses: ['yawn'], every: 1, ticks: 6 }]
  } else if (!input.isWorking && s.working) {
    s.working = false
    s.toy = undefined
    interrupt(s)
  }

  moveBall(s)

  for (let guard = 0; guard < 16; guard++) {
    if (s.cur === undefined) {
      let next = s.steps.shift()
      if (next === undefined && opts.hold) break
      if (next === undefined) {
        const steps = s.working
          ? workPlan(s, input.width)
          : plan(s, opts.agenda ? (opts.agenda[s.agendaAt++ % opts.agenda.length] ?? 'sit') : choose(s), hi)
        next = steps.shift()
        s.steps = steps
      }
      if (next === undefined) break
      s.cur = startStep(s, next, input)
      s.t = 0
      s.closed = false
    }
    if (!runStep(s, s.cur, input)) break
    s.cur = undefined
    if (s.steps.length === 0 && opts.agenda && !s.working && s.agendaAt >= opts.agenda.length) break
  }
  return s
}

// Kare

export type Frame = {
  x: number
  lift: number
  pose: PoseName
  flip: boolean
  closed: boolean
  bowl?: { x: number; food: number }
  ball?: { x: number; lift: number }
  toy?: { x: number; glyph: string }
  fx?: { x: number; glyph: string; kind: Fx }
}

const SPIN = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢']
const Z = ['z', 'z', 'z', 'Z', 'Z', 'Z', ' ', ' ']
const GLYPH: Record<Exclude<Fx, 'z'>, string> = { note: '♪', bang: '!', heart: '♥' }

export function frameOf(s: Sim): Frame {
  const flip = s.dir < 0
  const front = FRONT.has(s.pose)
  let fx: Frame['fx']
  if (s.fx !== undefined) {
    const glyph = s.fx === 'z' ? (Z[Math.floor(s.tick / 2) % Z.length] ?? ' ') : GLYPH[s.fx]
    const head = front ? 14 : flip ? 2 : W - 3
    if (glyph !== ' ') fx = { x: s.x + head, glyph, kind: s.fx }
  }
  return {
    x: s.x,
    lift: s.lift,
    pose: s.pose,
    flip: front ? false : flip,
    closed: s.closed || s.blink > 0,
    bowl: s.bowl && { ...s.bowl },
    ball: s.ball && { x: s.ball.x, lift: s.ball.lift },
    toy: s.toy === undefined ? undefined : { x: s.toy, glyph: SPIN[s.tick % SPIN.length] ?? '✻' },
    fx,
  }
}

/**
 * Masaüstü gündemi: uykuyla açılır (her yeniden çizim döngüyü baştan
 * başlatır, en çok görülen baş kısmıdır); oyun, mama ve koşu birer kez.
 */
const AGENDA: Activity[] = ['sleep', 'sit', 'groom', 'walk', 'lie', 'nap', 'sit', 'play', 'nap', 'walk', 'eat', 'sleep', 'zoomies', 'sit']

/**
 * Masaüstü döngüsü: gündemi bir kez tamamlayıp evde oturarak biter. Claude
 * çalışırken bir tur: iki kovalama ve bir kestirme.
 */
export function loopFrames(width: number, isWorking: boolean): Frame[] {
  const input: SimInput = { width, isWorking }
  const opts: SimOptions = isWorking ? {} : { agenda: AGENDA }
  let s = createSim(width, 0xb0b + width)
  const frames: Frame[] = []
  for (let i = 0; i < 6000; i++) {
    const napped = s.working && s.chased === 0 && i > 0
    s = step(s, input, opts)
    if (napped && s.chased === 1) break
    frames.push(frameOf(s))
    if (!isWorking && s.agendaAt >= AGENDA.length && s.cur === undefined && s.steps.length === 0) break
  }
  return [...frames, ...homeward(s, input)]
}

/** Tepki (ve gerekirse mama/oyun) ardından eve dönüş: masaüstü girişi. */
export function introFrames(width: number, isWorking: boolean, kind: Poke): Frame[] {
  const input: SimInput = { width, isWorking }
  let s = poke(createSim(width, 0x5eed + width), kind, width)
  if (isWorking) s.working = true
  const frames: Frame[] = []
  for (let i = 0; i < 1200 && (s.steps.length > 0 || s.cur !== undefined || i === 0); i++) {
    s = step(s, input, { hold: true })
    frames.push(frameOf(s))
  }
  return [...frames, ...homeward(s, input)]
}

// Döngü dikişsiz kapansın diye eve yürür ve oturur.
function homeward(start: Sim, input: SimInput): Frame[] {
  const home = maxX(input.width)
  let s = clone(start)
  interrupt(s)
  s.toy = input.isWorking ? (start.toy ?? 0) : undefined
  s.steps = [{ k: 'go', to: home, gait: 'walk' }, { k: 'face', dir: -1 }, sitFor(8)]
  if (input.isWorking) s.working = true
  const frames: Frame[] = []
  for (let i = 0; i < 2000 && (s.steps.length > 0 || s.cur !== undefined || i === 0); i++) {
    s = step(s, input, { hold: true })
    frames.push(frameOf(s))
  }
  return frames
}
