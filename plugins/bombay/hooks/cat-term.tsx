// Terminalde Bombay: simülasyonu kendi kare saatiyle canlı adımlar ve yarım
// bloklarla çizer. Tıklamak (fare raporlayan terminalde) sevmektir: mırlar.

import type { ClientModule } from 'claude-code'

import type { Pulse } from '../types'
import { createSim, frameOf, maxX, poke, step, TICK_MS } from './cat'
import type { Sim } from './cat'
import { runs } from './paint'

type Props = { isWorking: boolean; pulse: Pulse }

const INK: Record<string, string> = {
  k: '#141414',
  g: '#2E2E2E',
  y: '#F2C12E',
  c: '#7A7A7A',
  n: '#E58FA0',
  o: 'inactive',
  b: '#4E7FD1',
  B: '#36598F',
  f: '#B7793F',
  r: '#D9485F',
  R: '#9E2F42',
  toy: 'claude',
  z: 'inactive',
  note: '#F2C12E',
  bang: 'warning',
  heart: 'error',
}

type Live = { sim: Sim; props: Props; seen: number; placed: boolean }
let live: Live | undefined

const Bombay: ClientModule<Props, Sim> = (props, surface) => {
  const { Box, Text } = surface.elements

  if (surface.state === undefined || live === undefined) {
    const own: Live = { sim: createSim(0), props, seen: props.pulse.n, placed: false }
    live = own
    surface.every(TICK_MS, () => {
      const width = surface.columns
      if (width <= 0) return
      if (!own.placed) {
        own.sim = { ...own.sim, x: maxX(width) }
        own.placed = true
      }
      if (own.props.pulse.n !== own.seen) {
        own.seen = own.props.pulse.n
        own.sim = poke(own.sim, own.props.pulse.kind, width)
      }
      own.sim = step(own.sim, { width, isWorking: own.props.isWorking })
      surface.setState(own.sim)
    })
    surface.onPointer(event => {
      if (event.type !== 'down' || surface.columns <= 0) return
      own.sim = poke(own.sim, 'pet', surface.columns)
      surface.setState(own.sim)
    })
    surface.setState(own.sim)
  }
  live.props = props

  const columns = surface.columns
  if (columns < 26 || !live.placed) return <Text> </Text>

  return (
    <Box flexDirection="column">
      {runs(frameOf(surface.state ?? live.sim), columns).map(row => (
        <Box flexDirection="row">
          {row.map(run => {
            const color = run.fg === undefined ? undefined : INK[run.fg]
            const backgroundColor = run.bg === undefined ? undefined : INK[run.bg]
            if (color === undefined && backgroundColor === undefined) return <Text>{run.text}</Text>
            if (backgroundColor === undefined) return <Text color={color}>{run.text}</Text>
            return (
              <Text color={color} backgroundColor={backgroundColor}>
                {run.text}
              </Text>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

export default Bombay
