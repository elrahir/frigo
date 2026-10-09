// Masaüstünde Bombay: simülasyonu sabit bir gündemle önceden koşar, kareleri
// CSS anahtar karelerine derler ve kendi kendine oynayan bir vektör SVG
// döndürür. Masaüstü SVG'yi betiksiz, korumalı bir çerçevede çizer
// (isInteractive): CSS animasyonu, SMIL ve :hover orada çalışır, eklentiye
// her karede yük binmez.
//
// Pozlar karede değişir (step-end); konum izleri ise kareler arasında doğrusal
// akar, kedi ve yumak kayarak ilerler.

import { POSE_W } from './art'
import type { PoseName } from './art'
import { GRID_H, introFrames, loopFrames, SLEEP_POSES, SPRITE_TOP, TICK_MS } from './cat'
import type { Frame, Poke } from './cat'
import { BALL_TOP, BOWL_TOP } from './paint'
import { bowlVector, catVector, POSE_ATTRS, starVector, yarnVector } from './vector'

/** Bir birimin CSS pikseli cinsinden kenarı: tam bantta ve yarım boy bantta. */
export const SCALE = 6
export const MINI_SCALE = 3
/** Masaüstünün Svg'ye izin verdiği en uzun kaynak (SvgProps.source). */
export const SVG_LIMIT = 131072
const GLYPH_COLOR: Record<string, string> = { note: '#F2C12E', bang: '#E8A33D', heart: '#E0607E' }
/** Yumak bir birim yuvarlanınca dönen açı: 360 / (π · çap). */
const ROLL_DEG = 41.5

export type BombaySvg = { source: string; width: number; height: number }

const pct = (i: number, n: number): number => Math.round((i / n) * 10000) / 100

/**
 * Bir iz: her karede bir değer; yalnız değiştiği yerde anahtar kare yazılır.
 * smooth izde değerler arası doğrusal akar; üç kareden uzun bir duruşun sonuna
 * da anahtar kare konur ki duruş kaymaya dönmesin.
 */
function keyframes(name: string, values: string[], smooth = false): string {
  let out = ''
  let prev: string | undefined
  let last = -1
  values.forEach((v, i) => {
    if (v === prev) return
    if (smooth && prev !== undefined && i - last >= 3) out += `${pct(i - 1, values.length)}%{${prev}}`
    out += `${pct(i, values.length)}%{${v}}`
    prev = v
    last = i
  })
  return `@keyframes ${name}{${out}100%{${values[values.length - 1] ?? ''}}}`
}

const show = (on: boolean): string => `visibility:${on ? 'visible' : 'hidden'}`
const at = (x: number, y: number): string => `transform:translate(${x}px,${y}px)`

/** Uyku pozlarının masaüstünde tek çizimi var; nefesi SMIL oynatır. */
const drawn = (pose: PoseName): PoseName => (SLEEP_POSES.has(pose) ? 'sleep' : pose)
/** Çizim anahtarı (poz ve göz); aynalı hâl aynı çizimi kullanır. */
const artOf = (f: Frame): string => `${drawn(f.pose)}${f.closed && !SLEEP_POSES.has(f.pose) ? '-c' : ''}`
const keyOf = (f: Frame): string => `${artOf(f)}${f.flip ? '-l' : ''}`

/** Eşya yokken izi son (ya da ilk) bilinen konumda tutar; görünürlüğü ayrı iz söyler. */
function held(values: Array<string | undefined>): string[] {
  const first = values.find(v => v !== undefined) ?? ''
  let lastSeen = first
  return values.map(v => (lastSeen = v ?? lastSeen))
}

type Track = { cls: string; values: string[]; smooth?: boolean }

export function bombaySvg(opts: { widthPx: number; isWorking: boolean; intro?: Poke; nonce?: number; scale?: number }): BombaySvg {
  const scale = opts.scale ?? SCALE
  const width = Math.max(POSE_W + 8, Math.floor(opts.widthPx / scale))
  const loop = loopFrames(width, opts.isWorking)
  const intro = opts.intro === undefined ? [] : introFrames(width, opts.isWorking, opts.intro)
  const all = [...intro, ...loop]

  const sprites = [...new Set(all.map(keyOf))]
  const glyphs = [...new Set(all.flatMap(f => (f.fx && f.fx.kind !== 'z' ? [f.fx.glyph] : [])))]
  const foods = [0, 1, 2, 3].filter(food => all.some(f => f.bowl?.food === food))
  const hasBowl = foods.length > 0
  const hasBall = all.some(f => f.ball !== undefined)
  const hasToy = all.some(f => f.toy !== undefined)
  const hasSleep = all.some(f => SLEEP_POSES.has(f.pose))

  // İzler, iki bölüm (giriş, döngü) için ayrı ayrı derlenir.
  const tracks = (frames: Frame[]): Track[] => {
    const out: Track[] = [
      { cls: 'm', values: frames.map(f => at(f.x, SPRITE_TOP - f.lift)), smooth: true },
      ...sprites.map((key, i) => ({ cls: `u${i}`, values: frames.map(f => show(keyOf(f) === key)) })),
    ]
    if (hasBowl) {
      out.push({ cls: 'bw', values: frames.map(f => (f.bowl ? `${show(true)};${at(f.bowl.x, BOWL_TOP)}` : show(false))) })
      for (const food of foods) out.push({ cls: `bf${food}`, values: frames.map(f => show(f.bowl?.food === food)) })
    }
    if (hasBall) {
      out.push({ cls: 'bl', values: frames.map(f => show(f.ball !== undefined)) })
      out.push({ cls: 'bm', values: held(frames.map(f => f.ball && at(f.ball.x, BALL_TOP - f.ball.lift))), smooth: true })
      out.push({ cls: 'br', values: held(frames.map(f => f.ball && `transform:rotate(${Math.round(f.ball.x * ROLL_DEG)}deg)`)), smooth: true })
    }
    if (hasToy) out.push({ cls: 'ty', values: frames.map(f => (f.toy ? `${show(true)};${at(f.toy.x + 0.5, 1.7)}` : show(false))) })
    if (glyphs.length > 0) {
      out.push({ cls: 'fx', values: frames.map(f => (f.fx && f.fx.kind !== 'z' ? `${show(true)};${at(f.fx.x, 0)}` : show(false))) })
      glyphs.forEach((g, i) => out.push({ cls: `g${i}`, values: frames.map(f => show(f.fx?.glyph === g)) }))
    }
    if (hasSleep) {
      out.push({
        cls: 'zz',
        values: frames.map(f => (SLEEP_POSES.has(f.pose) ? `${show(true)};${at(f.x + (f.flip ? 5.6 : 16.4), SPRITE_TOP - f.lift + 3.8)}` : show(false))),
      })
    }
    return out
  }

  const introS = (intro.length * TICK_MS) / 1000
  const loopS = (loop.length * TICK_MS) / 1000
  const introTracks = intro.length > 0 ? tracks(intro) : []
  let css = ''
  tracks(loop).forEach((track, t) => {
    const timing = track.smooth ? 'linear' : 'step-end'
    css += keyframes(`${track.cls}L`, track.values, track.smooth)
    const first = introTracks[t]
    if (first !== undefined) {
      css += keyframes(`${track.cls}I`, first.values, first.smooth)
      css += `.${track.cls}{animation:${track.cls}I ${introS}s ${timing} 1,${track.cls}L ${loopS}s ${timing} ${introS}s infinite;${first.values[0] ?? ''}}`
    } else {
      css += `.${track.cls}{animation:${track.cls}L ${loopS}s ${timing} infinite;${track.values[0] ?? ''}}`
    }
  })
  // Kendi saatiyle dönen yıldız, uçuşan z'ler, süzülen tepki işaretleri.
  css += '.br,.st{transform-box:fill-box;transform-origin:50% 50%}'
  css += '@keyframes sp{to{transform:rotate(360deg)}}@keyframes pu{50%{transform:scale(.72)}}.st{animation:sp 2.4s linear infinite}.sp{transform-box:fill-box;transform-origin:50% 50%;animation:pu 1.2s ease-in-out infinite}'
  css += '@keyframes zf{0%{opacity:0;transform:translate(0,0) scale(.6)}25%{opacity:.85}100%{opacity:0;transform:translate(1.8px,-3px) scale(1.15)}}'
  css += '.z{opacity:0;animation:zf 3.3s ease-out infinite;transform-box:fill-box;transform-origin:50% 50%}.z2{animation-delay:1.1s}.z3{animation-delay:2.2s}'
  css += '@keyframes bob{50%{transform:translateY(-.35px)}}.gl{animation:bob 1s ease-in-out infinite}'
  // Fare üstündeyken durur ve mırlar; hareket azaltılmışsa evinde oturur.
  css += 'svg:has(.hit:hover) *{animation-play-state:paused}.hi{opacity:0}svg:has(.hit:hover) .hi{opacity:1}'
  css += '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'
  css += 'text{font-family:ui-rounded,"SF Pro Rounded",ui-sans-serif,system-ui,"Segoe UI Symbol","Apple Symbols",sans-serif;font-weight:700;text-anchor:middle}'
  // Çerçevedeki belgenin renk şeması sayfanınkinden (koyu tema) farklıysa
  // tarayıcı çerçevenin arkasına opak beyaz zemin boyar; iki şemayı da
  // kabul edince zemin şeffaf kalır.
  css += ':root{color-scheme:light dark}'

  // Kara kedi koyu zeminde kaybolmasın: siluetin dışına ince gri kontur.
  const filter =
    '<filter id="rim" x="-10%" y="-20%" width="120%" height="140%">' +
    '<feMorphology in="SourceAlpha" operator="erode" radius=".06"/><feMorphology operator="dilate" radius=".28" result="d"/>' +
    '<feFlood flood-color="#9A9A9A" flood-opacity=".5"/><feComposite in2="d" operator="in"/>' +
    '<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
  // Her çizim bir kez tanımlanır; sola bakış onun aynası.
  const arts = [...new Set(all.map(artOf))]
  const defs =
    filter +
    arts
      .map((art, i) => {
        const frame = all.find(f => artOf(f) === art)
        return frame === undefined ? '' : `<g id="a-${i}" ${POSE_ATTRS}>${catVector(drawn(frame.pose), frame.closed)}</g>`
      })
      .join('') +
    foods.map(food => `<g id="f-${food}">${bowlVector(food)}</g>`).join('')
  const spriteUse = (key: string, i: number): string => {
    const frame = all.find(f => keyOf(f) === key)
    const art = frame === undefined ? 0 : arts.indexOf(artOf(frame))
    const mirror = frame?.flip ? ` transform="matrix(-1 0 0 1 ${POSE_W} 0)"` : ''
    return `<g class="u${i}"><use href="#a-${art}"${mirror}/></g>`
  }

  const cat =
    `<g class="m"><g filter="url(#rim)">` +
    sprites.map(spriteUse).join('') +
    `</g><rect class="hit" x="0" y="0" width="${POSE_W}" height="8" fill="transparent"/>` +
    `<text class="hi" x="${POSE_W / 2}" y="-0.4" font-size="3" fill="${GLYPH_COLOR.heart}">♥</text>` +
    '</g>'
  const bowl = hasBowl ? `<g class="bw">${foods.map(food => `<use href="#f-${food}" class="bf${food}"/>`).join('')}</g>` : ''
  const ball = hasBall ? `<g class="bl"><g class="bm"><g class="br">${yarnVector()}</g></g></g>` : ''
  const toy = hasToy ? `<g class="ty"><g class="sp"><g class="st">${starVector()}</g></g></g>` : ''
  const zz = hasSleep
    ? `<g class="zz">${['z', 'z', 'Z'].map((g, i) => `<text class="z z${i + 1}" x="0" y="0" font-size="${i === 2 ? 2.4 : 1.9}" fill="#9C9890">${g}</text>`).join('')}</g>`
    : ''
  const fx =
    glyphs.length > 0
      ? `<g class="fx"><g class="gl">${glyphs
          .map((g, i) => {
            const kind = all.find(f => f.fx?.glyph === g)?.fx?.kind ?? 'note'
            return `<text class="g${i}" x="0.5" y="2.6" font-size="2.8" fill="${GLYPH_COLOR[kind] ?? '#888'}">${g}</text>`
          })
          .join('')}</g></g>`
      : ''

  const viewW = width
  const viewH = GRID_H
  const source =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewW} ${viewH}" width="${viewW * scale}" height="${viewH * scale}">` +
    (opts.nonce === undefined ? '' : `<!--${opts.nonce}-->`) +
    `<style>${css}</style><defs>${defs}</defs>` +
    cat +
    bowl +
    ball +
    toy +
    zz +
    fx +
    '</svg>'

  // Uzun bir giriş sınırı aşarsa tepki atlanır, döngü yine oynar.
  if (source.length > SVG_LIMIT && opts.intro !== undefined) return bombaySvg({ ...opts, intro: undefined, nonce: undefined })
  return { source, width: viewW * scale, height: viewH * scale }
}
