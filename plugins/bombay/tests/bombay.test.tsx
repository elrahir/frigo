import { describe, expect, mock, test } from 'claude-code/testing'

import { createSim, loopFrames, SLEEP_POSES, SPRITE_TOP, step } from '../hooks/cat'
import { grid } from '../hooks/paint'
import { lineLabel, sizeFor } from '../hooks/size'
import { bombaySvg, SVG_LIMIT } from '../hooks/svg'

const props = (isWorking: boolean) => ({
  hasSurvey: false,
  isWorking,
  maxRows: 12,
  bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 11 },
  view: {},
})

/** auto'nun ölçtüğü ekranlar: geniş (tam bant), dizüstü (yarım boy), küçük (alt satır). */
const WIDE = { columns: 140, rows: 60 }
const LAPTOP = { columns: 90, rows: 32 }
const SMALL = { columns: 70, rows: 18 }

const RUN = { origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 100 } }
const HALF = /[▀▄█]/
const EYES = /#F2C12E/

describe('bombay', () => {
  test('lives on the terminal: its frames change and its yellow eyes show', async $ => {
    const ui = await $.ui.mount({ plugin: 'bombay', surface: 'terminal', component: 'AbovePrompt', props: props(false), viewport: WIDE })
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
    const ui = await $.ui.mount({ plugin: 'bombay', surface: 'terminal', component: 'AbovePrompt', props: props(true), viewport: WIDE })
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
      const ui = await $.ui.mount({ plugin: 'bombay', surface: 'desktop', component: 'AbovePrompt', props: props(isWorking), viewport: WIDE })
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

  test('picks its spot by screen size: full band, half band, or the line under the prompt', async ($, on) => {
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })
    on('ui.render', { component: 'SessionMode' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>{`modes: ${e.props.modes.join(' & ')}`}</Text>
    })
    const band = { terminal: { big: /"height":6\b/, mini: /"height":5\b/ }, desktop: { big: /"height":72\b/, mini: /"height":36\b/ } }
    for (const surface of ['terminal', 'desktop'] as const) {
      for (const [viewport, size] of [[WIDE, 'big'], [LAPTOP, 'mini']] as const) {
        const ui = await $.ui.mount({ plugin: 'bombay', surface, component: 'AbovePrompt', props: props(false), viewport })
        const tree = JSON.stringify(await ui.drawn())
        expect(tree).toMatch(band[surface][size])
        expect(tree).not.toMatch(/engine/)
        await ui.unmount()
        const footer = await $.ui.mount({ plugin: 'bombay', surface, component: 'SessionMode', props: { modes: [] }, viewport })
        expect(JSON.stringify(await footer.drawn())).not.toMatch(/=\^/)
        await footer.unmount()
      }
      // Küçük ekranda bant boşalır, kedi mod etiketlerinin sonuna iner.
      const ui = await $.ui.mount({ plugin: 'bombay', surface, component: 'AbovePrompt', props: props(false), viewport: SMALL })
      expect(JSON.stringify(await ui.drawn())).toMatch(/engine/)
      await ui.unmount()
      const footer = await $.ui.mount({ plugin: 'bombay', surface, component: 'SessionMode', props: { modes: ['plan'] }, viewport: SMALL })
      expect((await footer.find({ type: 'Text', text: /modes: plan & =\^-ω-\^= z/ }))).toBeDefined()
      await footer.unmount()
    }
  })

  test('/bombay mini, line and big pin its spot whatever the screen, and the choice is kept', async ($, on) => {
    mock.store(on)
    mock.clock(on)
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })
    on('ui.render', { component: 'SessionMode' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>{`modes: ${e.props.modes.join(' & ')}`}</Text>
    })

    await $.command.run({ command: 'bombay', args: 'mini', ...RUN })
    const mini = await $.ui.mount({ plugin: 'bombay', surface: 'desktop', component: 'AbovePrompt', props: props(false), viewport: WIDE })
    expect(JSON.stringify(await mini.drawn())).toMatch(/"height":36\b/)
    await mini.unmount()

    await $.command.run({ command: 'bombay', args: 'line', ...RUN })
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'bombay', surface, component: 'AbovePrompt', props: props(false), viewport: WIDE })
      expect(JSON.stringify(await ui.drawn())).toMatch(/engine/)
      await ui.unmount()
    }
    const footer = await $.ui.mount({ plugin: 'bombay', surface: 'desktop', component: 'SessionMode', props: { modes: [] }, viewport: WIDE })
    expect(await footer.find({ type: 'Text', text: /=\^-ω-\^= z/ })).toBeDefined()
    // Sevilince alt satırda da tepki verir, sonra yine uyur.
    await $.command.run({ command: 'bombay', args: 'pet', ...RUN })
    expect(await footer.find({ type: 'Text', text: /♥/ })).toBeDefined()
    await footer.unmount()

    await $.command.run({ command: 'bombay', args: 'big', ...RUN })
    const big = await $.ui.mount({ plugin: 'bombay', surface: 'terminal', component: 'AbovePrompt', props: props(false), viewport: SMALL })
    expect(JSON.stringify(await big.drawn())).toMatch(/"height":6\b/)
    await big.unmount()

    // auto yine ekranı ölçer.
    await $.command.run({ command: 'bombay', args: 'auto', ...RUN })
    const auto = await $.ui.mount({ plugin: 'bombay', surface: 'desktop', component: 'AbovePrompt', props: props(false), viewport: LAPTOP })
    expect(JSON.stringify(await auto.drawn())).toMatch(/"height":36\b/)
    await auto.unmount()
  })

  test('a new session opens with the spot chosen before', async ($, on) => {
    mock.store(on, { size: 'line' })
    mock.clock(on)
    on('command.register', ($, e) => ({ value: { command: e.name } }))
    on('session.start', ($, e) => ({ cwd: e.cwd }))
    on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text>engine</Text>
    })
    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ui = await $.ui.mount({ plugin: 'bombay', surface: 'desktop', component: 'AbovePrompt', props: props(false), viewport: WIDE })
    expect(JSON.stringify(await ui.drawn())).toMatch(/engine/)
    await ui.unmount()
  })

  test('the half-height terminal band keeps the whole cat in five rows, leaps included', async $ => {
    const ui = await $.ui.mount({ plugin: 'bombay', surface: 'terminal', component: 'AbovePrompt', props: props(true), viewport: LAPTOP })
    await ui.resize({ columns: 60, rows: 5, in: 'bombay' })
    for (let i = 0; i < 80; i++) {
      await ui.advance(100)
      const drawn = await ui.drawn({ in: 'bombay' })
      expect(drawn.type === 'Box' ? drawn.children?.length : 0).toBe(5)
    }
    await ui.unmount()
    // Atılan satıra (0, 1) sıçrayışta bile kedinin gövdesi düşmez.
    const leaps = loopFrames(60, true).filter(f => f.lift > 0)
    expect(leaps.length).toBeGreaterThan(0)
    for (const frame of leaps) {
      const g = grid(frame, 60, SPRITE_TOP - 2)
      expect(g[0]?.every(ink => ink === undefined)).toBe(true)
      expect(g[1]?.every(ink => ink === undefined || ink === 'o')).toBe(true)
    }
  })

  test('the line cat sleeps, peeks now and then, and hops around the star while Claude works', async () => {
    const asleep = Array.from({ length: 10 }, (_, beat) => lineLabel({ isWorking: false, beat }))
    expect(asleep.filter(label => /-ω-/.test(label)).length).toBeGreaterThan(7)
    expect(asleep.some(label => /·ω·/.test(label))).toBe(true)
    const working = [0, 1].map(beat => lineLabel({ isWorking: true, beat }))
    expect(working[0]).toMatch(/^\S \=\^/)
    expect(working[1]).toMatch(/\^= \S$/)
    expect(lineLabel({ isWorking: false, fresh: 'oops', beat: 0 })).toMatch(/!/)
    expect(sizeFor('auto', 'desktop', undefined)).toBe('mini')
    expect(sizeFor('line', 'terminal', WIDE)).toBe('line')
  })
})
