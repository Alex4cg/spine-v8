import { Chain, Parallel, Tween, quadIn, quadOut } from '@/gkit/tweens'
import { COLS, ROWS, JackpotTypes, JACKPOT_BY_ID } from '@/const'
import { IDSpecial } from '@/components/items/const'
import type ItemBase from '@/components/items/item-base'
import type ItemCoin from '@/components/items/item-coin'
import type ItemCollector from '@/components/items/item-collector'
import { changeParent } from '@/gkit/utils/change-parent'
import type { StepInitial } from '@/types'
import type { FieldExportData } from '../types'
import { getBarConfig, isTurboMode } from '../const'
import type { CollectEffectSkin } from '../components/collect-effect'
import { playSfx, fadeSfx } from '@/gkit/utils/sound-manager'
import type Bar from '@/components/bar'

export function resolveJackpotType(coinValue: number): JackpotTypes {
  if (coinValue >= JACKPOT_BY_ID[JackpotTypes.Grand]) return JackpotTypes.Grand
  if (coinValue >= JACKPOT_BY_ID[JackpotTypes.Major]) return JackpotTypes.Major
  if (coinValue >= JACKPOT_BY_ID[JackpotTypes.Midi]) return JackpotTypes.Midi

  return JackpotTypes.Mini
}

export function getCollectEffectSkinByJackpotType(jackpotType: JackpotTypes): CollectEffectSkin {
  switch (jackpotType) {
    case JackpotTypes.Grand:
      return `red`
    case JackpotTypes.Major:
      return `green`
    case JackpotTypes.Midi:
      return `blue`
    default:
      return `gold`
  }
}

function playFlyToTrainEffect(
  coins: CoinPosition[],
  collectors: CollectorPosition[],
  fieldData: FieldExportData
) {
  const { train, collectEffect } = fieldData

  if (!train || !collectEffect) return

  const trainTargetPos = train.getHitTargetPosition()
  const totalEffects = coins.length + collectors.length
  let effectIndex = 0
  let lastEffectTween: ReturnType<typeof collectEffect.playEffect> | null = null

  playSfx(`coin_logo`, 0.5)

  for (let i = 0; i < coins.length; i++) {
    const { item, isJackpot, coinValue } = coins[i]
    const isLastEffect = ++effectIndex === totalEffects
    const coinItem = item as ItemCoin
    const from = coinItem.toGlobal({ x: 0, y: 0 })

    let effectSkin: CollectEffectSkin | undefined
    if (isJackpot && coinValue > 0) {
      const jackpotType = resolveJackpotType(coinValue)
      effectSkin = getCollectEffectSkinByJackpotType(jackpotType)
    }

    const skipEnd = totalEffects > 1 && !isLastEffect
    const effectTween = collectEffect.playEffect(
      { x: from.x, y: from.y },
      { x: trainTargetPos.x, y: trainTargetPos.y },
      effectSkin,
      skipEnd
    )

    effectTween.start()

    if (isLastEffect) {
      lastEffectTween = effectTween
    }
  }

  for (let i = 0; i < collectors.length; i++) {
    const { item } = collectors[i]
    const isLastEffect = ++effectIndex === totalEffects
    const collectorItem = item as ItemCollector
    const from = collectorItem.toGlobal({ x: 0, y: 0 })

    const skipEnd = totalEffects > 1 && !isLastEffect
    const effectTween = collectEffect.playEffect(
      { x: from.x, y: from.y },
      { x: trainTargetPos.x, y: trainTargetPos.y },
      undefined,
      skipEnd
    )

    effectTween.start()

    if (isLastEffect) {
      lastEffectTween = effectTween
    }
  }

  if (lastEffectTween) {
    lastEffectTween.once(`complete`, () => {
      train.playActive()
    })
  }
}

interface CoinPosition {
  col: number
  row: number
  item: ItemBase
  isJackpot: boolean
  coinValue: number
}

interface CollectorPosition {
  col: number
  row: number
  item: ItemBase
}

const SLAM_DISTANCE = 8
const SLAM_DOWN_DURATION = 32
const SLAM_UP_DURATION = 48

function playSlamEffect(bars: Bar[]): Promise<void> {
  const slamParallel = new Parallel()

  for (let c = 0; c < bars.length; c++) {
    const bar = bars[c]
    const originalY = bar.y
    const slamChain = new Chain()
      .add(Tween.to(bar, { y: originalY + SLAM_DISTANCE }, {
        duration: SLAM_DOWN_DURATION, easing: quadIn
      }))
      .add(Tween.to(bar, { y: originalY }, {
        duration: SLAM_UP_DURATION, easing: quadOut
      }))
    slamParallel.add(slamChain)
  }

  return new Promise<void>((resolve) => {
    slamParallel.once(`complete`, resolve)
    slamParallel.start()
  })
}

export function initialStepAnimation(
  step: StepInitial,
  fieldData: FieldExportData,
  isBonusTrigger: boolean = false,
  skipProps: { stopReelAnimation: boolean } = { stopReelAnimation: false },
  currentAnimation: { skip: (() => void) | null } = { skip: null }
) {
  return async () => {
    if (fieldData.instance.isFreespinMode) {
      await initialStepAnimationFreeSpins(step, fieldData, skipProps, currentAnimation)()

      return
    }

    const barConfig = getBarConfig()
    const turboMode = isTurboMode()
    const isQuickStop = skipProps.stopReelAnimation
    const barIds = fieldData.gridToBarFormat(step.grid)
    const anticipation = step.anticipation || { 0: false, 1: false, 2: false }
    const fallStepDuration = isQuickStop
      ? Math.min(barConfig.fallDelay.default.inEndSpin, 20)
      : barConfig.fallDelay.default.inEndSpin
    const backScrollDuration = isQuickStop ? 0 : barConfig.backScroll
    const bounceDistance = isQuickStop ? 0 : 20
    let anticipationDelay = turboMode ? barConfig.anticipationDelay.turbo : barConfig.anticipationDelay.base
    if (isQuickStop) anticipationDelay = 0
    let delayPerBarEndSpin = turboMode ? 0 : barConfig.delayPerBar.endSpin.default
    if (isQuickStop) delayPerBarEndSpin = 0
    const hasAnticipation = anticipation[2]
    const coinsOnPreviousReels: boolean[] = [false, false, false]

    const skipState = { wasSkipped: isQuickStop }
    const delayTweens: Tween[] = []

    const barPromises: Promise<void>[] = []

    for (let c = 0; c < COLS; c++) {
      const bar = fieldData.bars[c]
      const isThirdBar = c === 2 && hasAnticipation

      bar.setItems(barIds[c])

      for (let r = 0; r < ROWS; r++) {
        const cell = step.grid[c][r]
        if (typeof cell.coinValue === `number`) {
          const item = bar.getItemByPositionIndex(r)
          if (item?.id === IDSpecial.Coin) {
            (item as ItemCoin).setInitialMultiplier(cell.coinValue)
          }

          if (item?.id === IDSpecial.Jackpot) {
            const coinItem = item as ItemCoin
            coinItem.setInitialMultiplier(cell.coinValue)
            coinItem.setSkinByJackpotType(resolveJackpotType(cell.coinValue))
          }

          if (item?.id === IDSpecial.Collector) {
            (item as ItemCollector).setInitialMultiplier(cell.coinValue)
          }
        }
      }

      const endScrollingTween = bar.endBaseScrolling(
        fallStepDuration,
        backScrollDuration,
        bounceDistance,
        isThirdBar ? barConfig.anticipationDurationMultiplier : 1
      )

      const delay = isThirdBar
        ? anticipationDelay + (c * delayPerBarEndSpin)
        : (c * delayPerBarEndSpin)

      const delayTween = Tween.to({}, {}, { duration: delay })
      delayTweens.push(delayTween)

      const barCol = c
      const barPromise = new Promise<void>((resolve) => {
        endScrollingTween.once(`complete`, () => {
          bar.sweep()
          playSfx(turboMode || skipState.wasSkipped ? `reel_quick_stop` : `reel_stop`, 0.6)

          const items = bar.getItems()
          let hasCoinOrCollector = false

          for (let r = 0; r < ROWS; r++) {
            const item = items[r] as ItemBase
            if (item) {
              item.visible = true

              if ([IDSpecial.Coin, IDSpecial.Collector, IDSpecial.Jackpot].includes(item.id as IDSpecial)) {
                item.zIndex = fieldData.getLayerOrder(`FieldFrame`) + 1
                changeParent(item, fieldData.instance)
                fieldData.instance.sortChildren()
                bar.setMiniReelHoldItemByPositionIndex(r)
                hasCoinOrCollector = true
              }

              if (item.id === IDSpecial.Collector) {
                playSfx(`coin_collector`, 0.5)
              }

              if (item.id === IDSpecial.Jackpot) {
                const cell = step.grid[barCol][r]
                const coinValue = typeof cell.coinValue === `number` ? cell.coinValue : 0
                if (coinValue > 0) {
                  fieldData.instance.activeJackpot(resolveJackpotType(coinValue), true)
                }
              }
            }
          }

          if (hasCoinOrCollector) {
            coinsOnPreviousReels[barCol] = true

            if (barCol === 2 && isBonusTrigger) {
              playSfx(`coin_trigger`, 0.6)
            } else if (barCol === 2 && (coinsOnPreviousReels[0] || coinsOnPreviousReels[1])) {
              playSfx(`coin_drop_3`, 0.5)
            } else {
              playSfx(`coin_drop`, 0.5)
            }

            fieldData.instance.activateCoinIndicator(barCol)
          }

          if (barCol === 1 && hasAnticipation && !skipState.wasSkipped) {
            fieldData.instance.playIntrigueAnimation()
            playSfx(`reel_anticipation_3rdreel`, 0.5)
            playSfx(`coin_anticipation`, 0.5)
          }

          if (barCol === 2) {
            fieldData.instance.hideIntrigueAnimation()

            if (hasAnticipation && !skipState.wasSkipped) {
              fadeSfx(`reel_anticipation_3rdreel`, 0.5, 0, 200)
              fadeSfx(`coin_anticipation`, 0.5, 0, 200)
              playSfx(`reel_anticipation_3rdreel_end`, 0.5)

              if (isBonusTrigger) {
                fieldData.instance.playFieldEffect()
              }
            }
          }

          resolve()
        })

        delayTween.once(`complete`, () => {
          endScrollingTween.start()
        })

        delayTween.start()
      })

      barPromises.push(barPromise)
    }

    currentAnimation.skip = () => {
      skipState.wasSkipped = true

      if (hasAnticipation) {
        fadeSfx(`reel_anticipation_3rdreel`, 0.5, 0, 100)
        fadeSfx(`coin_anticipation`, 0.5, 0, 100)
      }

      for (const dt of delayTweens) {
        if (dt.isPlaying()) {
          dt.end()
        }
      }

      for (let c = 0; c < COLS; c++) {
        fieldData.bars[c].forceEndScrolling()
      }
    }

    await Promise.all(barPromises)
    currentAnimation.skip = null

    const landedCoins: CoinPosition[] = []
    const landedCollectors: CollectorPosition[] = []

    for (let c = 0; c < COLS; c++) {
      const bar = fieldData.bars[c]
      for (let r = 0; r < ROWS; r++) {
        const item = bar.getItemByPositionIndex(r)
        if (item) {
          if (item.id === IDSpecial.Coin || item.id === IDSpecial.Jackpot) {
            const cell = step.grid[c][r]
            const isJackpot = item.id === IDSpecial.Jackpot
            const coinValue = typeof cell.coinValue === `number` ? cell.coinValue : 0
            landedCoins.push({ col: c, row: r, item, isJackpot, coinValue })
          } else if (item.id === IDSpecial.Collector) {
            landedCollectors.push({ col: c, row: r, item })
          }
        }
      }
    }

    if (skipState.wasSkipped) {
      await playSlamEffect([fieldData.bars[0], fieldData.bars[1], fieldData.bars[2]])
    }

    if ((landedCoins.length > 0 || landedCollectors.length > 0) && fieldData.train && fieldData.collectEffect) {
      playFlyToTrainEffect(landedCoins, landedCollectors, fieldData)
    }
  }
}

interface ActiveCell {
  bar: Bar
  col: number
  row: number
}

const SKIP_CELL_DELAY = 35

export function initialStepAnimationFreeSpins(
  step: StepInitial,
  fieldData: FieldExportData,
  skipProps: { stopReelAnimation: boolean } = { stopReelAnimation: false },
  currentAnimation: { skip: (() => void) | null } = { skip: null }
) {
  return async () => {
    const barConfig = getBarConfig()
    const turboMode = isTurboMode()
    const isQuickStop = skipProps.stopReelAnimation
    const barIds = fieldData.gridToBarFormat(step.grid)

    fieldData.instance.setMultiplierFramesFromGrid(step.grid, fieldData.train, fieldData.collectEffect)
    fieldData.newlyLandedCoins = []

    const fallStepDuration = isQuickStop
      ? Math.min(barConfig.fallDelay.freeSpins.inEndSpin, 20)
      : barConfig.fallDelay.freeSpins.inEndSpin
    const backScrollDuration = isQuickStop ? 0 : barConfig.backScroll
    const bounceDistance = isQuickStop ? 0 : 20
    let delayPerBarEndSpin = turboMode ? 0 : barConfig.delayPerBar.endSpin.freeSpins
    if (isQuickStop) delayPerBarEndSpin = 0

    const skipState = { wasSkipped: isQuickStop }
    const delayTweens: Tween[] = []
    const activeCells: ActiveCell[] = []
    const cellPromises: Promise<void>[] = []

    let cellIndex = 0

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const bar = fieldData.bars[c]

        if (bar.isItemHolding(r)) {
          continue
        }

        const id = barIds[c][r]

        if (id === IDSpecial.Blank) {
          bar.setMiniReelEmptyByPositionIndex(r)
        } else {
          bar.setMiniReelItemByPositionIndex(r, id)
        }

        const cell = step.grid[c][r]
        if (typeof cell.coinValue === `number`) {
          const item = bar.getItemByPositionIndex(r)
          if (item?.id === IDSpecial.Coin) {
            (item as ItemCoin).setInitialMultiplier(cell.coinValue)
          }

          if (item?.id === IDSpecial.Jackpot) {
            const coinItem = item as ItemCoin
            coinItem.setInitialMultiplier(cell.coinValue)
            coinItem.setSkinByJackpotType(resolveJackpotType(cell.coinValue))
          }

          if (item?.id === IDSpecial.Collector) {
            (item as ItemCollector).setInitialMultiplier(cell.coinValue)
          }
        }

        const endMiniReelTween = bar.endMiniReelByPositionIndexTween(
          r,
          fallStepDuration,
          backScrollDuration,
          bounceDistance
        )

        const delayTween = Tween.to({}, {}, { duration: cellIndex * delayPerBarEndSpin })
        delayTweens.push(delayTween)

        activeCells.push({ bar, col: c, row: r })

        const cellCol = c
        const cellRow = r

        const cellPromise = new Promise<void>((resolve) => {
          endMiniReelTween.once(`complete`, () => {
            const item = bar.getItemByPositionIndex(cellRow) as ItemBase
            const specialSymbolIds = [IDSpecial.Coin, IDSpecial.Collector, IDSpecial.Jackpot]
            const isSpecialSymbol = item && specialSymbolIds.includes(item.id as IDSpecial)

            if (!isSpecialSymbol) {
              playSfx(turboMode || skipState.wasSkipped ? `bgreel_quick_stop` : `bgreel_stop`, 0.5)
            }

            if (isSpecialSymbol) {
              bar.setMiniReelHoldItemByPositionIndex(cellRow)

              item.visible = true
              item.zIndex = fieldData.getLayerOrder(`FieldFrame`) + 1
              if (item.parent) {
                changeParent(item, fieldData.instance)
                fieldData.instance.sortChildren()
              }

              if (item.id === IDSpecial.Collector) {
                playSfx(`bgreel_collector`, 0.5)
              }

              if ((item.id === IDSpecial.Coin || item.id === IDSpecial.Jackpot) && (cellCol === 0 || cellCol === 2)) {
                fieldData.newlyLandedCoins?.push({ col: cellCol, row: cellRow, item })
                playSfx(item.id === IDSpecial.Jackpot ? `bgreel_jpcoin` : `coin_drop`, 0.5)

                if (fieldData.instance.freeSpinsCounterValue !== 3) {
                  fieldData.instance.getFreeSpinsCounterAnimationTween(3).start()
                }
              }

              if (item.id === IDSpecial.Jackpot) {
                const cell = step.grid[cellCol][cellRow]
                const coinValue = typeof cell.coinValue === `number` ? cell.coinValue : 0
                if (coinValue > 0) {
                  fieldData.instance.activeJackpot(resolveJackpotType(coinValue), true)
                }
              }
            }

            bar.sweepMiniReelByPositionIndex(cellRow)
            resolve()
          })

          delayTween.once(`complete`, () => {
            endMiniReelTween.start()
          })

          delayTween.start()
        })

        cellPromises.push(cellPromise)
        cellIndex++
      }
    }

    if (cellIndex === 0) {
      return
    }

    currentAnimation.skip = () => {
      skipState.wasSkipped = true

      for (const dt of delayTweens) {
        if (dt.isPlaying()) {
          dt.end()
        }
      }

      activeCells[0].bar.forceEndMiniReelScrolling(activeCells[0].row)

      if (activeCells.length > 1) {
        const skipChain = new Chain()

        for (let i = 1; i < activeCells.length; i++) {
          const { bar, row } = activeCells[i]
          const cellDelay = Tween.to({}, {}, { duration: SKIP_CELL_DELAY })
          cellDelay.once(`complete`, () => {
            bar.forceEndMiniReelScrolling(row)
          })
          skipChain.add(cellDelay)
        }

        skipChain.start()
      }
    }

    await Promise.all(cellPromises)
    currentAnimation.skip = null
  }
}
