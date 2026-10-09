// Bir kareyi piksel ızgarasına döker; terminal bunu yarım bloklarla (▀▄),
// masaüstü SVG'si aynı sprite'larla çizer.

import { BALL, BOWL, blink, outline, pixels, POSES } from './art'
import type { Pixel, PoseName } from './art'
import { GRID_H, GROUND, SPRITE_TOP } from './cat'
import type { Frame } from './cat'

/** Bir pikselin mürekkebi: art.ts'teki harfler ve 'o' (kontur). */
export type Ink = string

export type Sprite = { body: Pixel[]; edge: Array<{ x: number; y: number }> }

const cache = new Map<string, Sprite>()

export function spriteKey(pose: PoseName, flip: boolean, closed: boolean): string {
  return `${pose}${flip ? '-l' : ''}${closed ? '-c' : ''}`
}

export function sprite(pose: PoseName, flip: boolean, closed: boolean): Sprite {
  const key = spriteKey(pose, flip, closed)
  let hit = cache.get(key)
  if (hit === undefined) {
    const art = closed ? blink(POSES[pose]) : POSES[pose]
    const body = pixels(art, flip)
    hit = { body, edge: outline(body) }
    cache.set(key, hit)
  }
  return hit
}

export const bowlPixels = (food: number): Pixel[] => pixels(BOWL[Math.max(0, Math.min(3, food))] ?? BOWL[0], false, 6)
export const ballPixels = (): Pixel[] => pixels(BALL, false, 3)
export const BOWL_TOP = GROUND - 2
export const BALL_TOP = GROUND - 2

/** maxLift: sıçrayış en çok bu kadar yükselir (kırpılmış bantta baş kesilmesin). */
export function grid(frame: Frame, width: number, maxLift = SPRITE_TOP): Array<Array<Ink | undefined>> {
  const g = Array.from({ length: GRID_H }, () => new Array<Ink | undefined>(width).fill(undefined))
  const put = (x: number, y: number, ink: Ink): void => {
    const row = g[y]
    if (row !== undefined && x >= 0 && x < width) row[x] = ink
  }
  const top = SPRITE_TOP - Math.min(frame.lift, maxLift)
  const cat = sprite(frame.pose, frame.flip, frame.closed)
  for (const p of cat.edge) put(frame.x + p.x, top + p.y, 'o')
  for (const p of cat.body) put(frame.x + p.x, top + p.y, p.c)
  if (frame.bowl !== undefined) {
    for (const p of bowlPixels(frame.bowl.food)) put(frame.bowl.x + p.x, BOWL_TOP + p.y, p.c)
  }
  if (frame.ball !== undefined) {
    for (const p of ballPixels()) put(frame.ball.x + p.x, BALL_TOP - frame.ball.lift + p.y, p.c)
  }
  return g
}

/** Terminal satırının bir parçası: metin, ön ve arka plan mürekkebi. */
export type Run = { text: string; fg?: Ink; bg?: Ink }

/**
 * Kareyi GRID_H / 2 terminal satırına yarım bloklarla döker; crop üstteki boş
 * satırlardan kaçını atar (sıçrayış o kadar alçalır, işaretler ilk satırda).
 */
export function runs(frame: Frame, width: number, crop = 0): Run[][] {
  const g = grid(frame, width, SPRITE_TOP - 2 * crop)
  const out: Run[][] = []
  for (let r = crop; r < GRID_H / 2; r++) {
    const upper = g[2 * r] ?? []
    const lower = g[2 * r + 1] ?? []
    const cells: Run[] = []
    for (let x = 0; x < width; x++) {
      const a = upper[x]
      const b = lower[x]
      if (a === undefined && b === undefined) cells.push({ text: ' ' })
      else if (a === b) cells.push({ text: '█', fg: a })
      else if (b === undefined) cells.push({ text: '▀', fg: a })
      else if (a === undefined) cells.push({ text: '▄', fg: b })
      else cells.push({ text: '▀', fg: a, bg: b })
    }
    if (r === crop) {
      for (const glyph of [frame.toy && { x: frame.toy.x, glyph: frame.toy.glyph, ink: 'toy' }, frame.fx && { x: frame.fx.x, glyph: frame.fx.glyph, ink: frame.fx.kind }]) {
        if (!glyph) continue
        const cell = cells[glyph.x]
        if (cell !== undefined && cell.text === ' ') cells[glyph.x] = { text: glyph.glyph, fg: glyph.ink }
      }
    }
    const merged: Run[] = []
    for (const cell of cells) {
      const last = merged[merged.length - 1]
      if (last !== undefined && last.fg === cell.fg && last.bg === cell.bg) last.text += cell.text
      else merged.push({ ...cell })
    }
    out.push(merged)
  }
  return out
}
