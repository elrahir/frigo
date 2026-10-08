// Bombay modunun durum sözleşmesi.

/** Kediyi bir tepkiye ya da işe iten olay. */
export type PulseKind = 'done' | 'oops' | 'pet' | 'feed' | 'play'

/** Son olay, sayacı ve zamanı (ms); sayaç artınca çizim olayı bir kez oynatır. */
export type Pulse = { kind: PulseKind; n: number; at: number }

declare module 'claude-code' {
  interface PluginState {
    bombay: { isHidden: boolean; pulse: Pulse }
  }
}
