// Bombay modunun durum sözleşmesi.

/** Kediyi bir tepkiye ya da işe iten olay. */
export type PulseKind = 'done' | 'oops' | 'pet' | 'feed' | 'play'

/** Son olay, sayacı ve zamanı (ms); sayaç artınca çizim olayı bir kez oynatır. */
export type Pulse = { kind: PulseKind; n: number; at: number }

/**
 * Kedinin yeri: big tam bant, mini yarım boy bant, line bant yok (kedi istemin
 * altındaki mod etiketlerine iner); auto ekranın boyuna göre seçer.
 */
export type Size = 'big' | 'mini' | 'line'
export type SizePref = Size | 'auto'

declare module 'claude-code' {
  interface PluginState {
    bombay: { isHidden: boolean; pulse: Pulse; size: SizePref; isWorking: boolean; beat: number }
  }
}
