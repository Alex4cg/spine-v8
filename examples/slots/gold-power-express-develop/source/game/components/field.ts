import { Container, Sprite, Texture, Graphics, type ContainerChild } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { Chain, Parallel, Tween } from '@/gkit/tweens'
import { playSfx } from '@/gkit/utils/sound-manager'

import Bar from '@/components/bar'
import { COLS, ROWS, SAFE_ZONE_WIDTH, JackpotTypes } from '@/const'
import { IDBase, IDSpecial } from '@/components/items/const'
import type ItemBase from '@/components/items/item-base'
import bgAtlas from '@/assets/atlas/background/atlas.gen'
import WinFrame from '@/components/animation/win-frame'
import WinLines from '@/components/animation/win-lines'
import WinlineSpine from '@/assets/spine/winline/skeleton'
import LineWinPopup from '@/components/animation/line-win-popup'
import MultiplierFrame from '@/components/animation/multiplier-frame'
import CoinIndicator from '@/components/animation/coin-indicator'
import CoinIndicatorReel from '@/components/animation/coin-indicator-reel'
import IntrigueFrame from '@/components/animation/intrigue-frame'
import FieldEffect from '@/components/animation/field-effect'
import JackpotsContainer from '@/components/jackpots/jackpots-container'
import MiniWin from './mini-win'
import InfoLine from '@/components/info-line'
import FreeSpinsCounter from '@/components/free-spins-counter'
import type { FieldExportData } from '../types'
import { IDX, getBarConfig, isTurboMode } from '../const'
import { stopRewardLoopExternal } from '../steps/apply-rewards-step'

import {
  FIELD_TOP_OFFSET,
  FIELD_FRAME_TOP_OFFSET,
  FIELD_LEFT_OFFSET,
  GRID_HEIGHT,
  GRID_WIDTH,
  ITEM_H_GAP,
  ITEM_V_GAP,
  ITEM_TOP_OFFSET,
  SHOW_GRID_DEBUG,
  INDICATOR_Y_OFFSET,
  rowY,
  columnX
} from './field-layout'

import type { GridCell } from '@/types'

export { IDX }

enum LayerOrder {
  UnderField = 0,
  FieldBg = 1,
  FieldLines = 2,
  WinLinesLayer = 3,
  BarsBottom = 4,
  HideItems = 5,
  WinFrameLayer = 6,
  LineWinPopupLayer = 7,
  BarsTop = 9,
  FieldFg = 10,
  FieldFrame = 12,
  MultiplierFrameLayer = 14, // TODO Think about zIndex
  MiniWinLayer = 15,
  InfoLineLayer = 16
}

interface CellData {
  c: number
  r: number
  x: number
  y: number
  item: ContainerChild | null
  winFrame: WinFrame | null
}

const START_FIELD = [
  IDBase.H1,
  IDBase.L2,
  IDBase.W,
  IDBase.L1,
  IDBase.H2,
  IDBase.L3,
  IDBase.L4,
  IDBase.H3,
  IDBase.L1
]

function getRandomIndicesByShare(share: number, items: unknown[]): number[] {
  const count = Math.floor(items.length * share)
  const indices: number[] = []
  const available = items.map((_, i) => i)

  for (let i = 0; i < count && available.length > 0; i++) {
    const randomIndex = Math.floor(Math.random() * available.length)
    indices.push(available[randomIndex])
    available.splice(randomIndex, 1)
  }

  return indices
}

const JACKPOT_CHANCE_IN_MINI_REEL = 0.15

function getRandomCoinOrJackpot(): IDSpecial {
  return Math.random() < JACKPOT_CHANCE_IN_MINI_REEL ? IDSpecial.Jackpot : IDSpecial.Coin
}

export default class Field extends Container {
  #isFreespinMode = false
  #fieldBg: Sprite
  #bars: Bar[]
  #fieldFg: Sprite | null = null
  #fieldLinesReg: Sprite | null = null
  #fieldLinesFs: Sprite | null = null
  #indicator: Sprite
  #indicatorFs: Sprite
  #cells: Record<number, CellData> = {}
  #hideItemsLayer: Sprite
  #multiplierFrameContainer: Container
  #multiplierFrames: Map<string, MultiplierFrame> = new Map()
  #winFrameContainer: Container
  #winLines: WinLines
  #lineWinPopup: LineWinPopup
  #miniWin: MiniWin
  #infoLine: InfoLine
  #coinIndicators: CoinIndicator[] = []
  #coinIndicatorReels: CoinIndicatorReel[] = []
  #intrigueFrame: IntrigueFrame
  #fieldEffect: FieldEffect
  #jackpotsContainer: JackpotsContainer
  #introDemoChain: Chain | null = null
  #introDemoCleanup: (() => void) | null = null
  #freeSpinsCounter: FreeSpinsCounter
  #skipProps = { stopReelAnimation: false }
  #currentAnimation: { skip: (() => void) | null } = { skip: null }

  constructor() {
    super()

    this.sortableChildren = true

    this.#fieldBg = this.addChild(new Sprite(bgAtlas.getTexture(`field-reg.png`)))
    this.#fieldBg.anchor.set(0.5)
    this.#fieldBg.position.set(SAFE_ZONE_WIDTH * 0.5, FIELD_TOP_OFFSET + (this.#fieldBg.height * 0.5))
    this.#fieldBg.zIndex = LayerOrder.FieldBg

    this.#indicator = this.addChild(new Sprite(bgAtlas.getTexture(`indicator.png`)))
    this.#indicator.anchor.set(0.5, 0)
    this.#indicator.position.set(SAFE_ZONE_WIDTH * 0.5, FIELD_TOP_OFFSET + this.#fieldBg.height + INDICATOR_Y_OFFSET)
    this.#indicator.zIndex = LayerOrder.UnderField

    this.#indicatorFs = this.addChild(new Sprite(bgAtlas.getTexture(`indicator_fs.png`)))
    this.#indicatorFs.anchor.set(0.5, 0)
    this.#indicatorFs.position.set(SAFE_ZONE_WIDTH * 0.5, FIELD_TOP_OFFSET + this.#fieldBg.height + INDICATOR_Y_OFFSET)
    this.#indicatorFs.zIndex = LayerOrder.UnderField
    this.#indicatorFs.visible = false

    this.#freeSpinsCounter = this.addChild(new FreeSpinsCounter())
    this.#freeSpinsCounter.position.set(
      SAFE_ZONE_WIDTH * 0.5,
      FIELD_TOP_OFFSET + this.#fieldBg.height + INDICATOR_Y_OFFSET + (this.#indicatorFs.height * 0.47)
    )
    this.#freeSpinsCounter.zIndex = LayerOrder.UnderField + 1
    this.#freeSpinsCounter.visible = false

    this.#infoLine = this.addChild(new InfoLine())
    this.#infoLine.position.set(SAFE_ZONE_WIDTH * 0.5, FIELD_TOP_OFFSET + this.#fieldBg.height + INDICATOR_Y_OFFSET + 60)
    this.#infoLine.zIndex = LayerOrder.InfoLineLayer

    if (SHOW_GRID_DEBUG) {
      const g = this.addChild(new Graphics())
      g.zIndex = LayerOrder.FieldLines

      g.rect(FIELD_LEFT_OFFSET - (ITEM_H_GAP * 0.5), ITEM_TOP_OFFSET - (ITEM_V_GAP * 0.5), GRID_WIDTH, GRID_HEIGHT)
      g.stroke({ width: 2, color: 0x00ff00, alpha: 1 })

      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          g.circle(columnX(c), rowY(r), 4)
          g.fill(0xff0000)
        }
      }
    }

    this.#fieldLinesReg = this.addChild(new Sprite(bgAtlas.getTexture(`lines_reg.png`)))
    this.#fieldLinesReg.anchor.set(0.5)
    this.#fieldLinesReg.position.set(SAFE_ZONE_WIDTH * 0.5, FIELD_TOP_OFFSET + (this.#fieldBg.height * 0.5))
    this.#fieldLinesReg.zIndex = LayerOrder.FieldLines

    this.#fieldLinesFs = this.addChild(new Sprite(bgAtlas.getTexture(`lines_fs.png`)))
    this.#fieldLinesFs.anchor.set(0.5)
    this.#fieldLinesFs.position.set((SAFE_ZONE_WIDTH * 0.5) - 2, FIELD_TOP_OFFSET + (this.#fieldBg.height * 0.5))
    this.#fieldLinesFs.zIndex = 10
    this.#fieldLinesFs.visible = false

    this.#bars = Array.from({ length: COLS }, (_, col) => this.addChild(new Bar({
      index: col,
      size: ROWS,
      x: columnX(col),
      y: rowY(0)
    })))

    const maskFg = this.addChild(new Sprite(Texture.WHITE))
    maskFg.width = this.#fieldBg.width
    maskFg.height = this.#fieldBg.height
    maskFg.anchor.set(0.5)
    maskFg.position.set(SAFE_ZONE_WIDTH * 0.5, FIELD_TOP_OFFSET + (this.#fieldBg.height * 0.5))

    for (const bar of this.#bars) {
      bar.mask = maskFg
      bar.zIndex = LayerOrder.BarsBottom
    }

    const hideItemsLayers = this.addChild(new Sprite(Texture.WHITE))
    hideItemsLayers.width = this.#fieldBg.width
    hideItemsLayers.height = this.#fieldBg.height
    hideItemsLayers.anchor.set(0.5)
    hideItemsLayers.tint = 0x0
    hideItemsLayers.position.set(SAFE_ZONE_WIDTH * 0.5, FIELD_TOP_OFFSET + (this.#fieldBg.height * 0.5))
    hideItemsLayers.alpha = 0
    hideItemsLayers.zIndex = LayerOrder.HideItems
    this.#hideItemsLayer = hideItemsLayers

    this.#multiplierFrameContainer = this.addChild(new Container())
    this.#multiplierFrameContainer.zIndex = LayerOrder.MultiplierFrameLayer

    this.#winFrameContainer = this.addChild(new Container())
    this.#winFrameContainer.zIndex = LayerOrder.WinFrameLayer

    this.#winLines = this.addChild(new WinLines())
    this.#winLines.zIndex = LayerOrder.WinLinesLayer
    this.#winLines.position.set(SAFE_ZONE_WIDTH * 0.5, rowY(1))

    this.#lineWinPopup = this.addChild(new LineWinPopup())
    this.#lineWinPopup.zIndex = LayerOrder.LineWinPopupLayer
    this.#lineWinPopup.position.set(SAFE_ZONE_WIDTH * 0.5, rowY(1))

    this.#miniWin = this.addChild(new MiniWin())
    this.#miniWin.zIndex = LayerOrder.MiniWinLayer
    this.#miniWin.position.set(SAFE_ZONE_WIDTH * 0.5, rowY(0.88))

    this.#fieldFg = this.addChild(new Sprite(bgAtlas.getTexture(`frame-reg.png`)))
    this.#fieldFg.anchor.set(0.5)
    this.#fieldFg.position.set(SAFE_ZONE_WIDTH * 0.5, FIELD_FRAME_TOP_OFFSET + (this.#fieldFg.height * 0.5))
    this.#fieldFg.zIndex = LayerOrder.FieldFrame

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const index = IDX(c, r)

        this.#cells[index] = {
          c,
          r,
          x: columnX(c),
          y: rowY(r),
          item: null,
          winFrame: null
        }
      }
    }

    for (let c = 0; c < COLS; c++) {
      const coinIndicator = this.addChild(new CoinIndicator())
      coinIndicator.position.set(columnX(c), FIELD_TOP_OFFSET + this.#fieldBg.height + INDICATOR_Y_OFFSET + 15)
      coinIndicator.zIndex = LayerOrder.UnderField + 1
      this.#coinIndicators.push(coinIndicator)

      const coinIndicatorReel = this.addChild(new CoinIndicatorReel())
      coinIndicatorReel.position.set(columnX(c), rowY(1))
      coinIndicatorReel.zIndex = LayerOrder.FieldLines - 1
      this.#coinIndicatorReels.push(coinIndicatorReel)
    }

    this.#intrigueFrame = this.addChild(new IntrigueFrame())
    this.#intrigueFrame.position.set(columnX(2), rowY(1))
    this.#intrigueFrame.zIndex = LayerOrder.FieldFrame + 1

    this.#fieldEffect = this.addChild(new FieldEffect())
    this.#fieldEffect.position.set(SAFE_ZONE_WIDTH * 0.5, FIELD_TOP_OFFSET + (this.#fieldBg.height * 0.5))
    this.#fieldEffect.zIndex = LayerOrder.FieldFrame + 2

    this.#jackpotsContainer = this.addChild(new JackpotsContainer())
    this.#jackpotsContainer.zIndex = LayerOrder.FieldFrame + 3

    this.sortChildren()
  }

  initWinFrames() {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const index = IDX(c, r)
        const winFrame = new WinFrame(index)
        winFrame.position.set(columnX(c), rowY(r))
        this.#winFrameContainer.addChild(winFrame)
        this.#cells[index].winFrame = winFrame
      }
    }
  }

  fillWithDummyItems() {
    for (let c = 0; c < COLS; c++) {
      const ids = START_FIELD.slice(c * ROWS, (c + 1) * ROWS)
      this.#bars[c].setInitialItems(ids as (IDBase | IDSpecial)[])
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fillFromStateGrid(grid: any[][]) {
    if (!grid || !Array.isArray(grid) || grid.length < COLS) {
      this.fillWithDummyItems()

      return
    }

    for (let c = 0; c < COLS; c++) {
      const column = grid[c]
      if (!Array.isArray(column) || column.length < ROWS) {
        const ids = START_FIELD.slice(c * ROWS, (c + 1) * ROWS)
        this.#bars[c].setInitialItems(ids as (IDBase | IDSpecial)[])
        continue
      }

      const ids: (IDBase | IDSpecial)[] = []
      let hasBlank = false
      for (let r = 0; r < ROWS; r++) {
        const cell = column[r]
        const symbol = typeof cell === `string` ? cell : cell?.symbol
        const id = symbol ? this.#mapSymbolToID(symbol) : IDBase.L1
        if (id === IDSpecial.Blank) hasBlank = true
        ids.push(id)
      }

      if (!hasBlank) {
        this.#bars[c].setInitialItems(ids)
      } else {
        for (let r = 0; r < ROWS; r++) {
          if (ids[r] !== IDSpecial.Blank) {
            this.#bars[c].setMiniReelItemByPositionIndex(r, ids[r])
          }
        }
      }
    }
  }

  #mapSymbolToID(symbol: string): IDBase | IDSpecial {
    switch (symbol) {
      case `W`: return IDBase.W
      case `H1`: return IDBase.H1
      case `H2`: return IDBase.H2
      case `H3`: return IDBase.H3
      case `H4`: return IDBase.H4
      case `L1`: return IDBase.L1
      case `L2`: return IDBase.L2
      case `L3`: return IDBase.L3
      case `L4`: return IDBase.L4
      case `COIN`: return IDSpecial.Coin
      case `COL`: return IDSpecial.Collector
      case `JP`: return IDSpecial.Jackpot
      case `B`: return IDSpecial.Blank
      default:
        // eslint-disable-next-line
        console.warn(`Unknown symbol: ${symbol}, using H1`)

        return IDBase.L1
    }
  }

  #gridToBarFormat(grid: GridCell[][]): (IDBase | IDSpecial)[][] {
    const result: (IDBase | IDSpecial)[][] = []

    for (let c = 0; c < COLS; c++) {
      const column: (IDBase | IDSpecial)[] = []
      for (let r = 0; r < ROWS; r++) {
        const cell = grid[c][r]
        column.push(this.#mapSymbolToID(cell.symbol))
      }
      result.push(column)
    }

    return result
  }

  get exportData(): FieldExportData {
    const cellsArray: CellData[][] = []
    for (let c = 0; c < COLS; c++) {
      cellsArray[c] = []
      for (let r = 0; r < ROWS; r++) {
        cellsArray[c][r] = this.#cells[IDX(c, r)]
      }
    }

    return {
      instance: this,
      bars: this.#bars,
      cells: cellsArray,
      winLines: this.#winLines,
      lineWinPopup: this.#lineWinPopup,
      miniWin: this.#miniWin,
      infoLine: this.#infoLine,
      train: null,
      collectEffect: null,
      newlyLandedCoins: null,
      gridToBarFormat: this.#gridToBarFormat.bind(this),
      getLayerOrder: (layer: string) => LayerOrder[layer as keyof typeof LayerOrder] || 0,
      getWinLinesFromAction: () => []
    }
  }

  get skipProps() {
    return this.#skipProps
  }

  get currentAnimation() {
    return this.#currentAnimation
  }

  callSkip() {
    this.#skipProps.stopReelAnimation = true
    if (this.#currentAnimation.skip) {
      this.#currentAnimation.skip()
      this.#currentAnimation.skip = null
    }
  }

  resetSkipProps() {
    this.#skipProps = { stopReelAnimation: false }
    this.#currentAnimation.skip = null
  }

  async startBeforeSpinAnimation() {
    this.skipIntroDemo()
    this.stopAllJackpots()
    this.hideAllCoinIndicators()

    const barConfig = getBarConfig()
    const skipDelay = isTurboMode()

    let fakeItemsCount = barConfig.items.start

    const mainParallel = new Parallel()

    for (let c = 0; c < COLS; c++) {
      const bar = this.#bars[c]

      const fakeIds = Array.from({ length: fakeItemsCount }, () => {
        const blurSymbols = [
          IDBase.H1,
          IDBase.H2,
          IDBase.H3,
          IDBase.H4,
          IDBase.L1,
          IDBase.L2,
          IDBase.L3,
          IDBase.L4
        ]

        const index = Math.floor(Math.random() * blurSymbols.length)

        return blurSymbols[index]
      })

      bar.setFakeItems(fakeIds)

      fakeItemsCount += barConfig.items.preSpinsDefaultAdd

      const fallStepDuration = barConfig.fallDelay.default.inPreSpin
      const delayPerBar = skipDelay ? 0 : barConfig.delayPerBar.preSpin.default
      const bounceConfig = barConfig.preSpinBounce

      mainParallel.add(
        Tween
          .to({}, {}, { duration: c * delayPerBar })
          .on(`complete`, () => {
            bar.startBaseScrolling(fallStepDuration, bounceConfig)
          })
      )
    }

    const bounceExtraDuration = barConfig.preSpinBounce?.enabled ? barConfig.preSpinBounce.duration : 0

    mainParallel.add(Tween.to({}, {}, {
      duration:
        (COLS * (skipDelay ? 0 : barConfig.delayPerBar.preSpin.default))
        + (barConfig.fallDelay.default.inPreSpin * ROWS)
        + bounceExtraDuration
    }))

    return new Promise<void>((resolve) => {
      mainParallel.once(`complete`, () => {
        resolve()
      })
      mainParallel.start()
    })
  }

  async startBeforeSpinAnimationFreeSpins() {
    this.stopAllJackpots()
    const barConfig = getBarConfig()
    const skipDelay = isTurboMode()

    let fakeItemsCount = barConfig.items.start

    const mainParallel = new Parallel()

    let cellIndex = 0

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const bar = this.#bars[c]

        if (bar.isItemHolding(r)) {
          continue
        }

        const count = fakeItemsCount + (r * barConfig.items.preSpinsFreeSpinsAdd)

        const fakeItems: IDSpecial[] = Array.from({ length: count }, () => {
          if (c === 1) {
            return IDSpecial.Collector
          }

          return getRandomCoinOrJackpot()
        })

        const randomIndicesByShare = getRandomIndicesByShare(barConfig.miniReelHidedFakeItemsPercent, fakeItems)
        bar.setMiniReelFakeItemsByPositionIndex(fakeItems, randomIndicesByShare, r)

        const delayPerBar = skipDelay ? 0 : barConfig.delayPerBar.preSpin.freeSpins

        mainParallel.add(
          Tween
            .to({}, {}, { duration: delayPerBar * cellIndex })
            .on(`complete`, () => {
              bar.startMiniReelByPositionIndex(r, barConfig.fallDelay.freeSpins.inPreSpin)
            })
        )

        cellIndex++
      }

      fakeItemsCount += barConfig.items.preSpinsFreeSpinsAdd
    }

    mainParallel.add(
      this.#freeSpinsCounter.getAnimationTweenByNumber(this.#freeSpinsCounter.activeTiles - 1)
    )

    const delayPerBarFs = skipDelay ? 0 : barConfig.delayPerBar.preSpin.freeSpins

    mainParallel.add(Tween.to({}, {}, {
      duration: (delayPerBarFs * cellIndex) + barConfig.fallDelay.freeSpins.inPreSpin
    }))

    this.#currentAnimation.skip = () => {
      this.#skipProps.stopReelAnimation = true
      if (mainParallel.isPlaying()) {
        mainParallel.end()
      }
    }

    return new Promise<void>((resolve) => {
      mainParallel.once(`complete`, () => {
        this.#currentAnimation.skip = null

        resolve()
      })
      mainParallel.start()
    })
  }

  async endSpinAnimation() {
    stopRewardLoopExternal(this.exportData)
    this.#infoLine.endRound()
    for (let c = 0; c < COLS; c++) {
      const items: { item: ItemBase, index: number }[] = []
      const bar = this.#bars[c]

      for (let r = 0; r < ROWS; r++) {
        const item = bar.getItemByPositionIndex(r)

        if (item && item.parent === this && !(this.#isFreespinMode && bar.isItemHolding(r))) {
          items.push({ item: item, index: r })
        }
      }

      if (items.length) {
        bar.restoreItems(items)
      }
    }
  }

  addMultiplierFrame(
    col: number,
    row: number,
    multiplier: number,
    train?: { getHitTargetPosition: () => { x: number; y: number } } | null,
    collectEffect?: {
      playHitEffect: (
        from: { x: number; y: number },
        to: { x: number; y: number }
      ) => { once: (event: string, cb: () => void) => unknown; start: () => void }
    } | null
  ) {
    const key = `${col}_${row}`

    if (this.#multiplierFrames.has(key)) {
      return this.#multiplierFrames.get(key)!
    }

    const frame = new MultiplierFrame(col, row, multiplier)
    frame.position.set(columnX(col), rowY(row))
    frame.alpha = 0

    this.#multiplierFrameContainer.addChild(frame)
    this.#multiplierFrames.set(key, frame)

    if (train && collectEffect) {
      const trainPos = train.getHitTargetPosition()
      const frameGlobalPos = frame.toGlobal({ x: 0, y: 0 })

      const flyEffect = collectEffect.playHitEffect(
        { x: trainPos.x, y: trainPos.y },
        { x: frameGlobalPos.x, y: frameGlobalPos.y }
      )

      flyEffect.once(`complete`, () => {
        playSfx(`bg_multiplier`, 0.5)
        frame.alpha = 1
        frame.getShowTween().start()
      })

      flyEffect.start()
    } else {
      frame.alpha = 1
      frame.getShowTween().start()
    }

    return frame
  }

  removeMultiplierFrame(col: number, row: number) {
    const key = `${col}_${row}`
    const frame = this.#multiplierFrames.get(key)

    if (frame) {
      frame.getHideTween().once(`complete`, () => {
        this.#multiplierFrameContainer.removeChild(frame)
        frame.destroy()
      }).start()

      this.#multiplierFrames.delete(key)
    }
  }

  getMultiplierFrame(col: number, row: number) {
    const key = `${col}_${row}`

    return this.#multiplierFrames.get(key)
  }

  clearAllMultiplierFrames() {
    for (const [, frame] of this.#multiplierFrames) {
      this.#multiplierFrameContainer.removeChild(frame)
      frame.destroy()
    }

    this.#multiplierFrames.clear()
  }

  setMultiplierFramesFromGrid(
    grid: GridCell[][],
    train?: { getHitTargetPosition: () => { x: number; y: number } } | null,
    collectEffect?: {
      playHitEffect: (
        from: { x: number; y: number },
        to: { x: number; y: number }
      ) => { once: (event: string, cb: () => void) => unknown; start: () => void }
    } | null
  ) {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const cell = grid[c][r]

        if (cell.multiplierFrame && cell.multiplierFrame > 1) {
          this.addMultiplierFrame(c, r, cell.multiplierFrame, train, collectEffect)
        }
      }
    }
  }

  get isFreespinMode() {
    return this.#isFreespinMode
  }

  setFreespinMode(value: boolean) {
    this.#isFreespinMode = value

    if (this.#fieldLinesReg && this.#fieldLinesFs) {
      this.#fieldLinesReg.visible = !value
      this.#fieldLinesFs.visible = value
    }

    this.#indicator.visible = !value
    this.#indicatorFs.visible = value
    this.#infoLine.visible = !value

    if (value) {
      this.#freeSpinsCounter.reset()
      this.#freeSpinsCounter.visible = true
      this.hideAllCoinIndicators()
    } else {
      this.#freeSpinsCounter.visible = false
    }

    for (const bar of this.#bars) {
      bar.setFreeSpinsMode(value)

      if (value) {
        bar.getShowItemsBackgroundTween(300).start()
      } else {
        bar.getHideItemsBackgroundTween(300).start()
      }
    }
  }

  activateCoinIndicator(colIndex: number) {
    if (colIndex >= 0 && colIndex < this.#coinIndicators.length) {
      const indicator = this.#coinIndicators[colIndex]
      if (!indicator.isActive) {
        indicator.playIn()
      }
    }

    if (colIndex >= 0 && colIndex < this.#coinIndicatorReels.length) {
      const reelIndicator = this.#coinIndicatorReels[colIndex]
      if (!reelIndicator.isActive) {
        reelIndicator.playIn()
      }
    }
  }

  hideAllCoinIndicators() {
    for (const indicator of this.#coinIndicators) {
      indicator.hide()
    }

    for (const reelIndicator of this.#coinIndicatorReels) {
      reelIndicator.hide()
    }
  }

  playIntrigueAnimation() {
    this.#intrigueFrame.play()
  }

  hideIntrigueAnimation() {
    this.#intrigueFrame.hide()
  }

  playFieldEffect() {
    this.#fieldEffect.play()
  }

  hideFieldEffect() {
    this.#fieldEffect.hide()
  }

  activeJackpot(jackpotType: JackpotTypes, repeat = false) {
    this.#jackpotsContainer.activeJackpotByType(jackpotType, repeat)
  }

  stopJackpot(jackpotType: JackpotTypes) {
    this.#jackpotsContainer.stopJackpotByType(jackpotType)
  }

  stopAllJackpots() {
    this.#jackpotsContainer.stopAllJackpots()
  }

  setFreeSpinsCounterValue(value: number) {
    this.#freeSpinsCounter.setActiveByNumber(value)
  }

  getFreeSpinsCounterAnimationTween(value: number) {
    return this.#freeSpinsCounter.getAnimationTweenByNumber(value)
  }

  get freeSpinsCounterValue() {
    return this.#freeSpinsCounter.activeTiles
  }

  hideAnimation(duration: number = 300) {
    return Tween.to(this, { alpha: 0 }, { duration })
  }

  revealAnimation(duration: number = 300) {
    return Tween.to(this, { alpha: 1 }, { duration })
  }

  playIntroDemo(fadeDuration: number = 150): Promise<void> {
    const blockDuration = 1200
    const rightBlock = [JackpotTypes.Major, JackpotTypes.Mini]
    const leftBlock = [JackpotTypes.Grand, JackpotTypes.Midi]

    return new Promise<void>((resolve) => {
      const introSpine = new Spine(WinlineSpine.spineData)
      introSpine.autoUpdate = true
      introSpine.alpha = 0
      introSpine.visible = true
      introSpine.zIndex = LayerOrder.FieldFrame + 1
      introSpine.position.set(SAFE_ZONE_WIDTH * 0.5, rowY(1))

      this.addChild(introSpine)

      introSpine.state.setAnimation(0, `start_screen`, false)

      const cleanup = () => {
        this.stopAllJackpots()
        if (introSpine.parent) {
          this.removeChild(introSpine)
        }
        introSpine.destroy()
        this.#introDemoChain = null
        this.#introDemoCleanup = null
      }

      this.#introDemoCleanup = cleanup

      const chain = new Chain()

      chain.add(Tween.to(introSpine, { alpha: 1 }, { duration: fadeDuration }))

      chain.call(() => {
        for (const jp of rightBlock) { this.activeJackpot(jp, true) }
      })
      chain.add(Tween.wait({ duration: blockDuration }))
      chain.call(() => {
        for (const jp of rightBlock) { this.stopJackpot(jp) }
        for (const jp of leftBlock) { this.activeJackpot(jp, true) }
      })
      chain.add(Tween.wait({ duration: blockDuration }))

      chain.add(Tween.to(introSpine, { alpha: 0 }, { duration: fadeDuration }))
      chain.call(() => {
        cleanup()
        resolve()
      })

      this.#introDemoChain = chain
      chain.start()
    })
  }

  skipIntroDemo() {
    if (this.#introDemoChain) {
      this.#introDemoChain.end()
      this.#introDemoChain = null
    }
    if (this.#introDemoCleanup) {
      this.#introDemoCleanup()
      this.#introDemoCleanup = null
    }
  }
}
