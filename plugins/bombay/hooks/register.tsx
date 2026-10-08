// Bombay: mesaj kutusunun üstünde yaşayan sarı gözlü kara kedi. Terminalde
// canlı yarım blok çizimi (Client), masaüstünde kendi kendine oynayan SVG.
// /bombay [show|hide|feed|play|pet]; görünürlük tercihi oturumlar arası kalır.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { PulseKind } from '../types'
import { bombaySvg } from './svg'

const isHidden = atom({ plugin: 'bombay', key: 'isHidden' } as const, false)
const pulse = atom({ plugin: 'bombay', key: 'pulse' } as const, { kind: 'done', n: 0, at: 0 })

/** Bandın satır sayısı: oyuncak/efekt satırı + kedinin beş satırı. */
const ROWS = 6
/** Masaüstünde bir olayın taze sayıldığı süre. */
const FRESH_MS = 4000

const ANSWERS: Record<string, string> = {
  feed: 'Bombay runs to the bowl.',
  play: 'Bombay pounces on the yarn.',
  pet: 'Bombay purrs.',
}

async function bump($: EngineInterface, kind: PulseKind): Promise<void> {
  try {
    const at = await $.clock.now()
    await update($, pulse, last => ({ kind, n: last.n + 1, at }))
  } catch {
    // Tepki süs; düşerse tur sürer.
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'bombay',
      description: 'Your black cat above the prompt: show, hide, feed, play or pet',
      argumentHint: '[show|hide|feed|play|pet]',
      immediate: true,
    })
    const stored = await $.store.get('isHidden').catch(() => undefined)
    if (typeof stored === 'boolean') await update($, isHidden, () => stored)

    return next(e)
  })

  on('command.run', { command: 'bombay' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'feed' || arg === 'play' || arg === 'pet') {
      await update($, isHidden, () => false)
      await bump($, arg)

      return { text: ANSWERS[arg] }
    }
    const hidden = arg === 'hide' ? true : arg === 'show' ? false : !(await read($, isHidden))
    await update($, isHidden, () => hidden)
    try {
      await $.store.set('isHidden', hidden)
    } catch {
      // Kalıcı tercih yazılamazsa bu oturumda yine geçerli.
    }

    return { text: hidden ? 'Bombay went for a nap elsewhere. /bombay brings it back.' : 'Bombay is back above the prompt.' }
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) await bump($, e.isAborted ? 'oops' : 'done')

    return done
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError === true) await bump($, 'oops')

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.maxRows < ROWS || (await read($, isHidden))) {
      return next(e)
    }
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
            props={{ isWorking: e.props.isWorking, pulse: last }}
            width={columns}
            height={ROWS}
          />
        </Box>
      )
    }

    if (e.surface === 'desktop') {
      const { Box, Svg } = $.ui.resolve(e)
      const isFresh = last.n > 0 && (await $.clock.now()) - last.at < FRESH_MS
      const art = bombaySvg({
        widthPx: Math.max(300, Math.min(640, Math.round(e.props.bodyColumns * 5))),
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
}
