import type { GameState, Expand } from "@facade/index"
import type { Container } from "pixi.js"

export interface GridItemData {
  c: number
  r: number
}

export interface CoinData extends GridItemData {
  value: number
}

export interface DefaultState extends GameState {
  freespins: number
  maxWin: boolean
  coins: Expand<CoinData>[]
}

// API Response Types для Gold Power Express

export interface GridCell {
  symbol: string // W, H1-H4, L1-L4, COIN, COL, JP, B
  coinValue: number | null // для COIN, COL, JP (25=MINI, 50=MIDI, 150=MAJOR, 1000=GRAND)
  multiplierFrame: number | null // 2, 3, 5, 10
}

export interface StepInitial {
  kind: `initial`
  grid: GridCell[][] // 3 колонки x 3 ряда
  anticipation?: Record<number, boolean> // опционально, только для базовой игры
}

export interface LineReward {
  lineIndex: number // 0-4
  positions: number[] // [row для col0, row для col1, row для col2]
  reward: number
}

export interface StepApplyRewards {
  kind: `applyRewards`
  rewards: LineReward[]
  totalWin: number
}

export interface StepCollector {
  kind: `collector`
  row: number // 0-2
  col: number // всегда 1 (средний барабан)
  collectedValue: number // выигрыш в монетах (умножено на ставку)
  mult: number // суммарный множитель
}

export interface AddedSymbol {
  row: number // 0-2
  col: number // 0-2
  symbol: string // COIN или COL
  coinValue: number | null
}

export interface StepTrainTrigger {
  kind: `trainTrigger`
  addedSymbols: AddedSymbol[]
}

export interface StepCoinUpgrade {
  kind: `coinUpgrade`
  row: number // 0-2
  col: number // 0 или 2
  originalValue: number
  multiplier: number // 2, 3, 5, 10
  upgradedValue: number
}

export interface StepBigWin {
  kind: `bigWin`
  type: `BIG` | `SUPER` | `EPIC` | `MEGA`
}

export type GameStep =
  | StepInitial
  | StepApplyRewards
  | StepCollector
  | StepTrainTrigger
  | StepCoinUpgrade
  | StepBigWin

export interface RoundState {
  roundEnd: boolean
  freespins: number
  roundWinnings: number
  grid: GridCell[][]
}

export interface SpinResult {
  steps: GameStep[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta: Record<string, any>
  roundState: RoundState
}

export interface GoldPowerExpressResponse {
  spins: SpinResult[]
}

/** TODO: Export from @clawbuster/facade */
export enum OrientationType {
  Portrait = `PORTRAIT`,
  Landscape = `LANDSCAPE`
}
export interface ScreenSize {
  width: number
  height: number
}

export interface ScreenRect extends ScreenSize {
  x: number
  y: number
}

export type ScreenOrientation = OrientationType.Landscape | OrientationType.Portrait | null

export interface Foundations {
  containers: {
    root: Container
    stage: Container
    fitByHeight: Container
    fitByWidth: Container
    fullSizeStage: Container
    fullSizeFitByHeight: Container
    fullSizeFitByWidth: Container
    fullSizeByOrientationRatioScale: Container
  }

  scales: {
    stage: number
    fitByHeight: number
    fitByWidth: number
    fullSizeStage: number
    fullSizeFitByHeight: number
    fullSizeFitByWidth: number
    fullSizeByOrientationRatioScale: number
  }
}

export interface onResizeProps {
  viewport: ScreenSize
  safeRect: ScreenRect
  mobile: boolean
  desktop: boolean
  orientation: ScreenOrientation
  verticalFactor: number
  orientationRatioScale: number
  safeRectRatioScale: number
  fullSizeRatioScale: number
  mobilePortraitRatioScale: number
  foundations: Foundations
}
/** End export from @clawbuster/facade */