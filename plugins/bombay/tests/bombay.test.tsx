import { describe, expect, mock, test } from 'claude-code/testing'

import { createSim, loopFrames, SLEEP_POSES, step } from '../hooks/cat'
import { bombaySvg, SVG_LIMIT } from '../hooks/svg'

const props = (isWorking: boolean) => ({
  hasSurvey: false,
  isWorking,
  maxRows: 12,
  bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 11 },
  view: {},
})

const RUN = { origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 100 } }
const HALF = /[▀▄█]/
const EYES = /#F2C12E/

describe('bombay', () => {
  test('lives on the terminal: its frames change and its yellow eyes show', async $ => {
    const ui = await $.ui.mount({ plugin: 'bombay', surface: 'terminal', component: 'AbovePrompt', props: props(false) })
    await ui.resize({ columns: 60, rows: 6, in: 'bombay' })
    await ui.advance(300)
    const first = JSON.stringify(await ui.drawn({ in: 'bombay' }))
    expect(first).toMatch(HALF)

    const seen = new Set([first])
    for (let i = 0; i < 60; i++) {
      await ui.advance(500)
      seen.add(JSON.stringify(await ui.drawn({ in: 'bombay' })))
    }
    expect(seen.size).toBeGreaterThan(10)
    // Çoğu zaman uyur ama arada gözünü açar.
    expect([...seen].some(drawn => EYES.test(drawn))).toBe(true)
    await ui.unmount()
  })

  test("chases Claude's star while a turn runs, and purrs when clicked", async $ => {
    const ui = await $.ui.mount({ plugin: 'bombay', surface: 'terminal', component: 'AbovePrompt', props: props(true) })
    await ui.resize({ columns: 60, rows: 6, in: 'bombay' })
    await ui.advance(500)
    expect(JSON.stringify(await ui.drawn({ in: 'bombay' }))).toMatch(/[·✢✳✶✻✽]/)

    await ui.pointer({ type: 'down', x: 50, y: 3, button: 'left', in: 'bombay' })
    await ui.advance(100)
    expect(JSON.stringify(await ui.drawn({ in: 'bombay' }))).toMatch(/♥/)
    await ui.unmount()
  })

  test('is an animated vector Svg on the desktop, small enough for the surface', async $ => {
    for (const isWorking of [false, true]) {
      const ui = await $.ui.mount({ plugin: 'bombay', surface: 'desktop', component: 'AbovePrompt', props: props(isWorking) })
      const tree = JSON.stringify(await ui.drawn())
      expect(tree).toMatch(/@keyframes/)
      expect(tree).toMatch(/isInteractive/)
      expect(tree).toMatch(/color-scheme:light dark/)
      expect(tree).not.toMatch(/crispEdges/)
      expect(tree).toMatch(/feMorphology/)
      expect(tree.length).toBeLessThan(131072)
      await ui.unmount()
    }
  })

  test('sleeps most of the day: breathes, twitches, and plays only now and then', async () => {
    for (const width of [50, 106]) {
      const frames = loopFrames(width, false)
      const asleep = frames.filter(f => SLEEP_POSES.has(f.pose)).length
      expect(asleep / frames.length).toBeGreaterThan(0.6)
      expect(frames.slice(0, 30).some(f => SLEEP_POSES.has(f.pose))).toBe(true)
      // Mama ve yumak döngüde birer kez gelir.
      const starts = (has: (f: (typeof frames)[number]) => boolean) => frames.filter((f, i) => has(f) && !has(frames[i - 1] ?? f)).length
      expect(starts(f => f.bowl !== undefined)).toBeLessThanOrEqual(1)
      expect(starts(f => f.ball !== undefined)).toBeLessThanOrEqual(1)
    }
    const svg = bombaySvg({ widthPx: 640, isWorking: false }).source
    expect(svg).toMatch(/animateTransform/)
    expect(svg.length).toBeLessThan(SVG_LIMIT)
    for (const intro of ['feed', 'play', 'oops', 'done', 'pet'] as const) {
      expect(bombaySvg({ widthPx: 640, isWorking: false, intro, nonce: 1 }).source.length).toBeLessThan(SVG_LIMIT)
    }
  })

  test('naps on the terminal too: left to itself, it is asleep most of the time', async () => {
    const input = { width: 60, isWorking: false }
    let s = createSim(input.width, 7)
    let asleep = 0
    const ticks = 6000
    for (let i = 0; i < ticks; i++) {
      s = step(s, input)
      if (SLEEP_POSES.has(s.pose)) asleep += 1
    }
    expect(asleep / ticks).toBeGreaterThan(0.5)
  })

  test('chases the star twice while Claude works, then naps beside it', async () => {
    const frames = loopFrames(106, true)
    const pounces = frames.filter((f, i) => f.pose === 'pounce' && frames[i - 1]?.pose !== 'pounce').length
    expect(pounces).toBe(2)
    expect(frames.some(f => SLEEP_POSES.has(f.pose) && f.toy !== undefined)).toBe(true)
  })

  test('/bombay feed brings the bowl on the desktop, /bombay hide clears the band', async ($, on) => {
    mock.store(on)
    mock.clock(on)
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })

    await $.command.run({ command: 'bombay', args: 'feed', ...RUN })
    const fed = await $.ui.mount({ plugin: 'bombay', surface: 'desktop', component: 'AbovePrompt', props: props(false) })
    const tree = JSON.stringify(await fed.drawn())
    expect(tree).toMatch(/f-3/)
    expect(tree).toMatch(/I [\d.]+s step-end 1/)
    await fed.unmount()

    await $.command.run({ command: 'bombay', args: 'hide', ...RUN })
    const hidden = await $.ui.mount({ plugin: 'bombay', surface: 'desktop', component: 'AbovePrompt', props: props(false) })
    expect(JSON.stringify(await hidden.drawn())).toMatch(/engine/)
    await hidden.unmount()

    await $.command.run({ command: 'bombay', args: 'show', ...RUN })
    const shown = await $.ui.mount({ plugin: 'bombay', surface: 'terminal', component: 'AbovePrompt', props: props(false) })
    expect(JSON.stringify(await shown.drawn())).toMatch(/cat-term/)
    await shown.unmount()
  })
})
