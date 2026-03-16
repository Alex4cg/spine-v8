import type { StepCollector } from '@/types'
import type { FieldExportData } from '../types'
import { IDSpecial } from '@/components/items/const'
import type ItemCollector from '@/components/items/item-collector'
import type ItemCoin from '@/components/items/item-coin'
import { ROWS, JackpotTypes, SAFE_ZONE_WIDTH } from '@/const'
import { FIELD_TOP_OFFSET, FIELD_BG_HEIGHT } from '../components/field-layout'
import { Tween } from '@/gkit/tweens'
import { getDevtoolsValues, isTurboMode } from '@/devtools'
import { resolveJackpotType, getCollectEffectSkinByJackpotType } from './initial-step'
import type { CollectEffectSkin } from '../components/collect-effect'
import { playSfx } from '@/gkit/utils/sound-manager'

interface CollectorSignals {
  flightSignal?: Promise<void>
  flightSignalResolve?: () => void
  collectSignal?: Promise<void>
  collectSignalResolve?: () => void
  collectReadyCount?: { value: number }
  totalCollectors?: number
}

export function collectorStepAnimation(
  step: StepCollector,
  fieldData: FieldExportData,
  allCollectorSteps: StepCollector[],
  collectorIndex: number = 0,
  isBonusTrigger: boolean = false,
  signals: CollectorSignals = {}
) {
  return async () => {
    const devtoolsValues = getDevtoolsValues()
    const turboMode = isTurboMode()
    const { collectorAnimations } = devtoolsValues

    const { row, col, collectedValue, mult } = step
    const isFreeSpinsMode = fieldData.instance.isFreespinMode
    const isFirstCollector = collectorIndex === 0
    const collectorBar = fieldData.bars[col]
    const collectorItem = collectorBar.getItemByPositionIndex(row) as ItemCollector

    if (!collectorItem || collectorItem.id !== IDSpecial.Collector) {
      if (isFirstCollector && signals.flightSignalResolve) {
        signals.flightSignalResolve()
      }

      const emptyDelay = turboMode ? Math.min(collectorAnimations.emptyDelay, 50) : collectorAnimations.emptyDelay
      await new Promise<void>((resolve) => {
        Tween.to({}, {}, { duration: emptyDelay }).once(`complete`, resolve).start()
      })

      return
    }

    const allCoins: Array<{ col: number; row: number; item: ItemCoin }> = []

    if (isFreeSpinsMode && fieldData.newlyLandedCoins) {
      for (const { col: c, row: r, item } of fieldData.newlyLandedCoins) {
        if (item && (item.id === IDSpecial.Coin || item.id === IDSpecial.Jackpot)) {
          allCoins.push({ col: c, row: r, item: item as ItemCoin })
        }
      }
    } else {
      for (const c of [0, 2]) {
        const bar = fieldData.bars[c]
        for (let r = 0; r < ROWS; r++) {
          const item = bar.getItemByPositionIndex(r)
          if (item && (item.id === IDSpecial.Coin || item.id === IDSpecial.Jackpot)) {
            allCoins.push({ col: c, row: r, item: item as ItemCoin })
          }
        }
      }
    }

    const coinsToCollect = allCoins
    if (coinsToCollect.length === 0) {
      if (isFirstCollector && signals.flightSignalResolve) {
        signals.flightSignalResolve()
      }

      collectorItem.setInitialMultiplier(mult)
      const noCoinsDelay = turboMode ? Math.min(collectorAnimations.noCoinsDelay, 50) : collectorAnimations.noCoinsDelay
      await new Promise<void>((resolve) => {
        Tween.to({}, {}, { duration: noCoinsDelay }).once(`complete`, resolve).start()
      })

      return
    }

    const { collectEffect } = fieldData

    if (!collectEffect) {
      if (isFirstCollector && signals.flightSignalResolve) {
        signals.flightSignalResolve()
      }

      collectorItem.setMultiplier(collectedValue)

      return
    }

    const collectorGlobalPos = collectorItem.toGlobal({ x: 0, y: 0 })

    const hasJpCoin = coinsToCollect.some(
      ({ item }) => item.id === IDSpecial.Jackpot && item.isJackpotCoin
    )

    const jpCompletePromises: Promise<void>[] = []
    const disappearancePromises: Promise<void>[] = []

    if (isFirstCollector) {
      if (hasJpCoin) {
        const jpCoins = coinsToCollect.filter(
          ({ item }) => item.id === IDSpecial.Jackpot && item.isJackpotCoin
        )
        const regularCoins = coinsToCollect.filter(
          ({ item }) => !(item.id === IDSpecial.Jackpot && item.isJackpotCoin)
        )

        for (const { item: coinItem } of jpCoins) {
          const isGrand = coinItem.multiplier > 0
            && resolveJackpotType(coinItem.multiplier) === JackpotTypes.Grand
          playSfx(isGrand ? `jpcoin_reveal_χ1000` : `jpcoin_reveal`, 0.5)

          const regFlightFired = { value: false }

          jpCompletePromises.push(new Promise<void>((resolve) => {
            const onFlightStart = () => {
              if (isFreeSpinsMode && regularCoins.length > 0) {
                for (const { item: regCoin } of regularCoins) {
                  disappearancePromises.push(new Promise<void>((resolveDisappear) => {
                    const dTween = regCoin.getDisappearanceTween(() => {
                      if (!regFlightFired.value) {
                        regFlightFired.value = true
                        signals.flightSignalResolve?.()
                      }
                    })
                    dTween.once(`complete`, () => { resolveDisappear() })
                    dTween.start()
                  }))
                }
              } else if (!isFreeSpinsMode) {
                for (const { item: regCoin } of regularCoins) {
                  regCoin.getShotTween().start()
                }
                signals.flightSignalResolve?.()
              } else {
                signals.flightSignalResolve?.()
              }
            }

            if (isGrand) {
              fieldData.instance.playFieldEffect()

              const fieldCenterLocal = { x: SAFE_ZONE_WIDTH * 0.5, y: FIELD_TOP_OFFSET + (FIELD_BG_HEIGHT * 0.5) }
              const fieldCenterGlobal = fieldData.instance.toGlobal(fieldCenterLocal)

              const applyTween = coinItem.getApplyGrandTween(onFlightStart, fieldCenterGlobal)
              applyTween.once(`complete`, () => {
                fieldData.instance.hideFieldEffect()
                resolve()
              })
              applyTween.start()
            } else {
              const applyTween = coinItem.getApplyJpTween(onFlightStart)
              applyTween.once(`complete`, () => {
                resolve()
              })
              applyTween.start()
            }
          }))
        }
      } else if (isFreeSpinsMode) {
        const flightSignalFired = { value: false }
        for (const { item: coinItem } of coinsToCollect) {
          disappearancePromises.push(new Promise<void>((resolveDisappear) => {
            const dTween = coinItem.getDisappearanceTween(() => {
              if (!flightSignalFired.value) {
                flightSignalFired.value = true
                signals.flightSignalResolve?.()
              }
            })
            dTween.once(`complete`, () => { resolveDisappear() })
            dTween.start()
          }))
        }
      } else {
        for (const { item: coinItem } of coinsToCollect) {
          coinItem.getShotTween().start()
        }

        queueMicrotask(() => { signals.flightSignalResolve?.() })
      }
    }

    if (signals.flightSignal) {
      await signals.flightSignal
    }

    if (isFirstCollector) {
      if (!isFreeSpinsMode) {
        playSfx(`coin_collector_base_trigger`, 0.4)
      }

      playSfx(`coin_logo`, 0.5)
    }

    const totalCoins = coinsToCollect.length
    const effectPromises: Promise<void>[] = []

    for (let i = 0; i < coinsToCollect.length; i++) {
      const { item: coinItem } = coinsToCollect[i]
      const isLastEffect = i === totalCoins - 1

      let effectSkin: CollectEffectSkin | undefined
      if (coinItem.id === IDSpecial.Jackpot && coinItem.multiplier > 0) {
        const jackpotType = resolveJackpotType(coinItem.multiplier)
        effectSkin = getCollectEffectSkinByJackpotType(jackpotType)
      }

      const skipEnd = totalCoins > 1 && !isLastEffect
      const coinGlobalPos = coinItem.toGlobal({ x: 0, y: 0 })

      const effectPromise = new Promise<void>((resolve) => {
        const effectTween = collectEffect.playEffect(
          { x: coinGlobalPos.x, y: coinGlobalPos.y },
          { x: collectorGlobalPos.x, y: collectorGlobalPos.y },
          effectSkin,
          skipEnd
        )

        effectTween.once(`complete`, () => {
          resolve()
        })

        effectTween.start()
      })

      effectPromises.push(effectPromise)
    }

    await Promise.all(effectPromises)

    if (jpCompletePromises.length > 0) {
      await Promise.all(jpCompletePromises)
    }

    if (disappearancePromises.length > 0) {
      await Promise.all(disappearancePromises)
    }

    if (isFirstCollector && isFreeSpinsMode) {
      for (const { col: coinCol, row: coinRow, item: coinItem } of coinsToCollect) {
        if (coinItem.parent) {
          coinItem.parent.removeChild(coinItem)
        }

        const bar = fieldData.bars[coinCol]
        bar.unsetHoldItemByPositionIndex(coinRow)
        bar.setMiniReelEmptyByPositionIndex(coinRow)
      }
    }

    if (signals.collectReadyCount && signals.collectSignalResolve && signals.totalCollectors) {
      signals.collectReadyCount.value++
      if (signals.collectReadyCount.value >= signals.totalCollectors) {
        signals.collectSignalResolve()
      }
    }

    if (signals.collectSignal) {
      await signals.collectSignal
    }

    const collectStagger = turboMode ? 0 : collectorIndex * 100
    if (collectStagger > 0) {
      await new Promise<void>((resolve) => {
        Tween.to({}, {}, { duration: collectStagger }).once(`complete`, resolve).start()
      })
    }

    if (isFirstCollector && isFreeSpinsMode) {
      const collectorsCount = Math.min(allCollectorSteps.length, 3)
      playSfx(`bg_coincollect_${collectorsCount}`, 0.5)
    }

    const collectTween = collectorItem.getCollectTween(mult)

    await new Promise<void>((resolve) => {
      collectTween.once(`complete`, () => {
        resolve()
      })
      collectTween.start()
    })

    if (fieldData.trainAnimationManager && coinsToCollect.length > 0) {
      await fieldData.trainAnimationManager.onCoinsCollected(coinsToCollect.length)
    }

    const afterCollectDelay = turboMode
      ? Math.min(collectorAnimations.afterCollectDelay, 50)
      : collectorAnimations.afterCollectDelay
    await new Promise<void>((resolve) => {
      Tween.to({}, {}, { duration: afterCollectDelay }).once(`complete`, resolve).start()
    })

    const isLastCollector = collectorIndex === allCollectorSteps.length - 1
    if (isLastCollector && !isFreeSpinsMode && !isBonusTrigger) {
      const totalCollectorWin = allCollectorSteps.reduce((sum, s) => sum + s.collectedValue, 0)
      if (totalCollectorWin > 0) {
        const { miniWinConfig } = devtoolsValues
        const miniWinDisplayDuration = turboMode
          ? Math.min(miniWinConfig.displayDuration, 1500)
          : miniWinConfig.displayDuration

        if (fieldData.infoLine.isWinShowing && fieldData.infoLine.isWinEnabled) {
          fieldData.infoLine.addWin(totalCollectorWin)
        } else {
          fieldData.infoLine.setWin(totalCollectorWin)
        }

        fieldData.miniWin.setWin(totalCollectorWin)
        fieldData.miniWin.getShowTween().start()
        await new Promise<void>((resolve) => {
          Tween.to({}, {}, { duration: miniWinDisplayDuration }).once(`complete`, resolve).start()
        })
        fieldData.miniWin.visible = false
      }
    }
  }
}
