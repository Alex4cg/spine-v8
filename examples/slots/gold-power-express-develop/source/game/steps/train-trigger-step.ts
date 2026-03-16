import type { StepTrainTrigger, AddedSymbol } from '@/types'
import type { FieldExportData } from '../types'
import { IDSpecial } from '@/components/items/const'
import type ItemCoin from '@/components/items/item-coin'
import type ItemCollector from '@/components/items/item-collector'
import { Tween } from '@/gkit/tweens'
import { columnX, rowY } from '../components/field-layout'
import { changeParent } from '@/gkit/utils/change-parent'
import { getDevtoolsValues, isTurboMode } from '@/devtools'
import { playSfx } from '@/gkit/utils/sound-manager'

export function trainTriggerStepAnimation(
  step: StepTrainTrigger,
  fieldData: FieldExportData
) {
  return async () => {
    const devtoolsValues = getDevtoolsValues()
    const turboMode = isTurboMode()
    const { trainTriggerAnimations } = devtoolsValues

    const { addedSymbols } = step

    if (addedSymbols.length === 0) {
      return
    }

    const train = fieldData.train
    const collectEffect = fieldData.collectEffect

    if (!train || !collectEffect) {
      await fallbackAnimation(step, fieldData)

      return
    }

    playSfx(`train_trigger`, 0.6)
    const hitTween = train.playHit()
    let effectsLaunched = false
    let effectsPromise: Promise<void> | null = null

    const onTrainHitHandler = () => {
      if (effectsLaunched) return
      effectsLaunched = true
      effectsPromise = launchEffectsToSlot(addedSymbols, fieldData, train, collectEffect, turboMode, trainTriggerAnimations)
    }

    const binding = train.onTrainHit.add(onTrainHitHandler)

    await new Promise<void>((resolve) => {
      hitTween.once(`complete`, () => {
        train.onTrainHit.detach(binding)

        if (!effectsLaunched) {
          effectsLaunched = true
          effectsPromise = launchEffectsToSlot(
            addedSymbols,
            fieldData,
            train,
            collectEffect,
            turboMode,
            trainTriggerAnimations
          )
        }

        resolve()
      })
      hitTween.start()
    })

    if (effectsPromise) {
      await effectsPromise
    }

    const postTriggerDelay = turboMode
      ? Math.min(trainTriggerAnimations.postTriggerDelay, 100)
      : trainTriggerAnimations.postTriggerDelay
    await new Promise<void>((resolve) => {
      Tween.to({}, {}, { duration: postTriggerDelay }).once(`complete`, resolve).start()
    })
  }
}

async function launchEffectsToSlot(
  addedSymbols: AddedSymbol[],
  fieldData: FieldExportData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  train: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  collectEffect: any,
  turboMode: boolean,
  trainTriggerAnimations: { symbolAppearDelay: number; postTriggerDelay: number }
) {
  const trainPos = train.getHitTargetPosition()
  const effectPromises: Promise<void>[] = []

  for (let i = 0; i < addedSymbols.length; i++) {
    const { row, col, symbol, coinValue } = addedSymbols[i]

    const targetX = columnX(col)
    const targetY = rowY(row)
    const targetGlobal = fieldData.instance.toGlobal({ x: targetX, y: targetY })

    const effectPromise = new Promise<void>((resolve) => {
      const symbolAppearDelay = turboMode
        ? Math.min(trainTriggerAnimations.symbolAppearDelay, 50)
        : trainTriggerAnimations.symbolAppearDelay
      const delayTween = Tween.to({}, {}, { duration: i * symbolAppearDelay })

      delayTween.once(`complete`, () => {
        const effectTween = collectEffect.playEffect(
          { x: trainPos.x, y: trainPos.y },
          { x: targetGlobal.x, y: targetGlobal.y }
        )

        effectTween.once(`complete`, () => {
          playSfx(`train_coin_drop`, 0.5)
          replaceSymbolAtPosition(fieldData, col, row, symbol, coinValue)
          resolve()
        })

        effectTween.start()
      })

      delayTween.start()
    })

    effectPromises.push(effectPromise)
  }

  await Promise.all(effectPromises)
}

function replaceSymbolAtPosition(
  fieldData: FieldExportData,
  col: number,
  row: number,
  symbol: string,
  coinValue: number | null
) {
  const bar = fieldData.bars[col]

  const existingItem = bar.getItemByPositionIndex(row)
  if (existingItem) {
    if (existingItem.parent) {
      existingItem.parent.removeChild(existingItem)
    }
    bar.setMiniReelEmptyByPositionIndex(row)
  }

  let id: IDSpecial
  switch (symbol) {
    case `COIN`:
      id = IDSpecial.Coin
      break
    case `COL`:
      id = IDSpecial.Collector
      break
    default:
      return
  }

  bar.setMiniReelItemByPositionIndex(row, id)

  if (coinValue !== undefined && coinValue !== null) {
    const item = bar.getItemByPositionIndex(row)
    if (item?.id === IDSpecial.Coin) {
      (item as ItemCoin).setInitialMultiplier(coinValue)
    }
    if (item?.id === IDSpecial.Collector) {
      (item as ItemCollector).setInitialMultiplier(coinValue)
    }
  }

  const item = bar.getItemByPositionIndex(row)
  if (item) {
    item.visible = true
    item.zIndex = fieldData.getLayerOrder(`FieldFrame`) + 1
    changeParent(item, fieldData.instance)
    fieldData.instance.sortChildren()
    bar.setMiniReelHoldItemByPositionIndex(row)

    if (item.id === IDSpecial.Coin) {
      (item as ItemCoin).playStart()

      if (fieldData.newlyLandedCoins) {
        fieldData.newlyLandedCoins.push({ col, row, item })
      }
    } else if (item.id === IDSpecial.Collector) {
      (item as ItemCollector).playStart()
    }
  }
}

async function fallbackAnimation(
  step: StepTrainTrigger,
  fieldData: FieldExportData
) {
  const { addedSymbols } = step

  for (let i = 0; i < addedSymbols.length; i++) {
    const { row, col, symbol, coinValue } = addedSymbols[i]

    await new Promise<void>((resolve) => {
      Tween.to({}, {}, { duration: 200 }).once(`complete`, resolve).start()
    })

    const bar = fieldData.bars[col]

    let id: IDSpecial
    switch (symbol) {
      case `COIN`:
        id = IDSpecial.Coin
        break
      case `COL`:
        id = IDSpecial.Collector
        break
      default:
        continue
    }

    bar.setMiniReelItemByPositionIndex(row, id)

    if (coinValue !== undefined && coinValue !== null) {
      const item = bar.getItemByPositionIndex(row)
      if (item?.id === IDSpecial.Coin) {
        (item as ItemCoin).setInitialMultiplier(coinValue)
      }
      if (item?.id === IDSpecial.Collector) {
        (item as ItemCollector).setInitialMultiplier(coinValue)
      }
    }

    bar.setMiniReelHoldItemByPositionIndex(row)

    if (id === IDSpecial.Coin && fieldData.newlyLandedCoins) {
      const item = bar.getItemByPositionIndex(row)
      if (item) {
        fieldData.newlyLandedCoins.push({ col, row, item })
      }
    }
  }

  await new Promise<void>((resolve) => {
    Tween.to({}, {}, { duration: 500 }).once(`complete`, resolve).start()
  })
}
