// Bombay: mesaj kutusunun üstünde yaşayan sarı gözlü kara kedi. Terminalde
// canlı yarım blok çizimi (Client), masaüstünde kendi kendine oynayan SVG.
// Küçük ekranda bant yarıya iner ya da kedi bandı bırakıp istemin altındaki
// mod etiketlerine taşınır (size.ts).
// /bombay [show|hide|big|mini|line|auto|feed|play|pet]; görünürlük ve boy
// tercihi oturumlar arası kalır.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PulseKind, SizePref } from '../types'
import { FRESH_MS, isSizePref, lineLabel, sizeFor } from './size'
import { bombaySvg, MINI_SCALE, SCALE } from './svg'

const isHidden = atom({ plugin: 'bombay', key: 'isHidden' } as const, false)
const pulse = atom({ plugin: 'bombay', key: 'pulse' } as const, { kind: 'done', n: 0, at: 0 })
const size = atom({ plugin: 'bombay', key: 'size' } as const, 'auto')
const isWorking = atom({ plugin: 'bombay', key: 'isWorking' } as const, false)
const beat = atom({ plugin: 'bombay', key: 'beat' } as const, 0)

/** Bandın satır sayısı: oyuncak/efekt satırı + kedinin beş satırı; yarım boyda efekt satırı kedinin üstüne biner. */
const ROWS = { big: 6, mini: 5 } as const
/** Alt satırdaki kedinin bir karesi. */
const BEAT_MS = 2000

const ANSWERS: Record<string, string> = {
  feed: 'Bombay runs to the bowl.',
  play: 'Bombay pounces on the yarn.',
  pet: 'Bombay purrs.',
}

const SIZE_ANSWERS: Record<SizePref, string> = {
  big: 'Bombay takes the full band above the prompt.',
  mini: 'Bombay curls up in a half-height band above the prompt.',
  line: 'Bombay moved down beside the mode labels under the prompt; the band is free.',
  auto: 'Bombay picks its spot by screen size: full band, half band, or the line under the prompt.',
}

async function bump($: EngineInterface, kind: PulseKind): Promise<void> {
  try {
    const at = await $.clock.now()
    await update($, pulse, last => ({ kind, n: last.n + 1, at }))
  } catch {
    // Tepki süs; düşerse tur sürer.
  }
}

async function keep($: EngineInterface, key: 'isHidden' | 'size', value: boolean | SizePref): Promise<void> {
  try {
    await $.store.set(key, value)
  } catch {
    // Kalıcı tercih yazılamazsa bu oturumda yine geçerli.
  }
}

// Alt satırdaki kedi bu vuruşla nefes alır; bant çizilirken vuruş durur.
async function tick($: EngineInterface): Promise<void> {
  try {
    const pref = await read($, size)
    if (pref === 'big' || pref === 'mini' || (await read($, isHidden))) return
    await update($, beat, n => n + 1)
  } catch {
    // Bir kare kaçarsa sonraki gelir.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'bombay',
      description: 'Your black cat above the prompt: show, hide, resize (big, mini, line, auto), feed, play or pet',
      argumentHint: '[show|hide|big|mini|line|auto|feed|play|pet]',
      immediate: true,
    })
    const stored = await $.store.get('isHidden').catch(() => undefined)
    if (typeof stored === 'boolean') await update($, isHidden, () => stored)
    const storedSize = await $.store.get('size').catch(() => undefined)
    if (isSizePref(storedSize)) await update($, size, () => storedSize)
    $.clock.every(BEAT_MS, () => void tick($))

    return next(e)
  })

  on('command.run', { command: 'bombay' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'feed' || arg === 'play' || arg === 'pet') {
      await update($, isHidden, () => false)
      await bump($, arg)

      return { text: ANSWERS[arg] }
    }
    if (isSizePref(arg)) {
      await update($, size, () => arg)
      await update($, isHidden, () => false)
      await keep($, 'size', arg)
      await keep($, 'isHidden', false)

      return { text: SIZE_ANSWERS[arg] }
    }
    const hidden = arg === 'hide' ? true : arg === 'show' ? false : !(await read($, isHidden))
    await update($, isHidden, () => hidden)
    await keep($, 'isHidden', hidden)

    return { text: hidden ? 'Bombay went for a nap elsewhere. /bombay brings it back.' : 'Bombay is back above the prompt.' }
  })

  on('turn.start', async ($, e, next) => {
    await update($, isWorking, () => true).catch(() => undefined)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      await update($, isWorking, () => false).catch(() => undefined)
      await bump($, e.isAborted ? 'oops' : 'done')
    }

    return done
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError === true) await bump($, 'oops')

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const where = sizeFor(await read($, size), e.surface, e.viewport)
    if (where === 'line' || e.props.maxRows < ROWS[where]) return next(e)
    const last = await read($, pulse)

    if (e.surface === 'terminal') {
      const columns = Math.min(90, Math.floor(e.props.bodyColumns * 0.6))
      if (columns < 30) return next(e)
      const { Box, Client } = $.ui.resolve(e)

      return (
        <Box flexDirection="row" justifyContent="flex-end">
          <Client
            key="bombay"
            module="./cat-term.tsx"
            props={{ isWorking: e.props.isWorking, pulse: last, crop: where === 'mini' ? 1 : 0 }}
            width={columns}
            height={ROWS[where]}
          />
        </Box>
      )
    }

    if (e.surface === 'desktop') {
      const { Box, Svg } = $.ui.resolve(e)
      const isFresh = last.n > 0 && (await $.clock.now()) - last.at < FRESH_MS
      // Yarım boyda kedi aynı alanda koşar, yalnız birimi küçüktür.
      const scale = where === 'mini' ? MINI_SCALE : SCALE
      const widthPx = Math.max(300, Math.min(640, Math.round(e.props.bodyColumns * 5)))
      const art = bombaySvg({
        widthPx: Math.round((widthPx * scale) / SCALE),
        scale,
        isWorking: e.props.isWorking,
        intro: isFresh ? last.kind : undefined,
        nonce: isFresh ? last.n : undefined,
      })

      return (
        <Box flexDirection="row" justifyContent="flex-end">
          <Svg
            source={art.source}
            alt="Bombay, a black cat with yellow eyes, living above the prompt"
            width={art.width}
            height={art.height}
            isInteractive
          />
        </Box>
      )
    }

    return next(e)
  })

  // Bant bırakılınca kedi istemin altındaki mod etiketlerinin sonunda yaşar.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    if (await read($, isHidden)) return next(e)
    if (sizeFor(await read($, size), e.surface, e.viewport) !== 'line') return next(e)
    const last = await read($, pulse)
    const fresh = last.n > 0 && (await $.clock.now()) - last.at < FRESH_MS ? last.kind : undefined
    const label = lineLabel({ isWorking: await read($, isWorking), fresh, beat: await read($, beat) })

    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, label] } })
  })
}
