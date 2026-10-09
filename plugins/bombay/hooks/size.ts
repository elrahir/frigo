// Küçük ekranlar için kedinin yeri: tam bant (big), yarım boy bant (mini) ya
// da hiç bant (line). line'da kedi istemin altındaki mod etiketlerinde
// (SessionMode) yazıyla yaşar: o satır zaten var, kedi yer kaplamaz.

import type { RenderSurface, RenderViewport } from 'claude-code'

import type { Pulse, Size, SizePref } from '../types'

/** Bir olayın taze sayıldığı süre. */
export const FRESH_MS = 4000

type Room = { rows: number; columns: number }

/** auto: bundan küçük ekranda alt satıra iner, bundan büyükte tam bant çizer. */
const AUTO: Record<'terminal' | 'desktop', { line: Room; big: Room }> = {
  terminal: { line: { rows: 20, columns: 60 }, big: { rows: 36, columns: 100 } },
  desktop: { line: { rows: 24, columns: 50 }, big: { rows: 50, columns: 100 } },
}

export function isSizePref(value: unknown): value is SizePref {
  return value === 'auto' || value === 'big' || value === 'mini' || value === 'line'
}

/** Tercih ve ekranın ölçüsünden kedinin yeri; ölçü yoksa yarım boy. */
export function sizeFor(pref: SizePref, surface: RenderSurface, viewport: RenderViewport | undefined): Size {
  if (pref !== 'auto') return pref
  if (viewport === undefined) return 'mini'
  const room = AUTO[surface === 'terminal' ? 'terminal' : 'desktop']
  if (viewport.rows < room.line.rows || viewport.columns < room.line.columns) return 'line'
  if (viewport.rows >= room.big.rows && viewport.columns >= room.big.columns) return 'big'
  return 'mini'
}

const AWAKE = '=^·ω·^='
const ASLEEP = '=^-ω-^='
const STARTLED = '=^OωO^='
const STAR = ['✢', '✳', '✶', '✻', '✽']

const REACTION: Record<Pulse['kind'], string> = {
  done: `${AWAKE} ♪`,
  oops: `${STARTLED} !`,
  pet: `${ASLEEP} ♥`,
  feed: `${AWAKE} nom`,
  play: `${AWAKE} ●`,
}

/**
 * Alt satırdaki kedi, bir vuruşta (beat) bir kare: çoğunlukla uyur (z, Z),
 * arada gözünü açıp bakar; Claude çalışırken yıldızın iki yanına sıçrar;
 * taze bir olaya bant gibi tepki verir.
 */
export function lineLabel(opts: { isWorking: boolean; fresh?: Pulse['kind']; beat: number }): string {
  if (opts.fresh !== undefined) return REACTION[opts.fresh]
  const star = STAR[opts.beat % STAR.length] ?? '✻'
  if (opts.isWorking) return opts.beat % 2 === 0 ? `${star} ${AWAKE}` : `${AWAKE} ${star}`
  const t = opts.beat % 10
  if (t === 8) return AWAKE
  return `${ASLEEP} ${t % 2 === 0 ? 'z' : 'Z'}`
}
