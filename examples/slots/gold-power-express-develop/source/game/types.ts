import type { Container } from 'pixi.js'
import type Bar from '@/components/bar'
import type WinLines from '@/components/animation/win-lines'
import type LineWinPopup from '@/components/animation/line-win-popup'
import type WinFrame from '@/components/animation/win-frame'
import type MultiplierFrame from '@/components/animation/multiplier-frame'
import type TrainSpine from '@/game/components/train-spine'
import type CollectEffect from '@/game/components/collect-effect'
import type MiniWin from '@/game/components/mini-win'
import type InfoLine from '@/components/info-line'
import type TrainAnimationManager from '@/game/train-animation-manager'
import type { GridCell } from '@/types'
import type { JackpotTypes } from '@/const'

export interface CellData {
  c: number
  r: number
  x: number
  y: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item: any
  winFrame: WinFrame | null
}

export interface FieldInstance extends Container {
  getMultiplierFrame: (col: number, row: number) => MultiplierFrame | undefined
  removeMultiplierFrame: (col: number, row: number) => void
  addMultiplierFrame: (col: number, row: number, multiplier: number, train?: TrainSpine | null, collectEffect?: CollectEffect | null) => MultiplierFrame
  clearAllMultiplierFrames: () => void
  setMultiplierFramesFromGrid: (grid: GridCell[][], train?: TrainSpine | null, collectEffect?: CollectEffect | null) => void
  setFreespinMode: (value: boolean) => void
  isFreespinMode: boolean
  startBeforeSpinAnimation: () => Promise<void>
  startBeforeSpinAnimationFreeSpins: () => Promise<void>
  endSpinAnimation: () => Promise<void>
  activateCoinIndicator: (colIndex: number) => void
  hideAllCoinIndicators: () => void
  playIntrigueAnimation: () => void
  hideIntrigueAnimation: () => void
  playFieldEffect: () => void
  hideFieldEffect: () => void
  activeJackpot: (jackpotType: JackpotTypes, repeat?: boolean) => void
  stopJackpot: (jackpotType: JackpotTypes) => void
  stopAllJackpots: () => void
  setFreeSpinsCounterValue: (value: number) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFreeSpinsCounterAnimationTween: (value: number) => any
  freeSpinsCounterValue: number
}

export interface NewlyLandedCoin {
  col: number
  row: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  item?: any
}

export interface FieldExportData {
  instance: FieldInstance
  bars: Bar[]
  cells: CellData[][]
  winLines: WinLines
  lineWinPopup: LineWinPopup
  miniWin: MiniWin
  infoLine: InfoLine
  train: TrainSpine | null
  collectEffect: CollectEffect | null
  trainAnimationManager?: TrainAnimationManager
  newlyLandedCoins: NewlyLandedCoin[] | null
  getLayerOrder: (layer: string) => number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gridToBarFormat: (grid: GridCell[][]) => any[][]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getWinLinesFromAction: (action: any) => any[]
}
