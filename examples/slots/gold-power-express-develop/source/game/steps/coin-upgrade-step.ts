import type { StepCoinUpgrade } from '@/types'
import type { FieldExportData } from '../types'
import type ItemCoin from '@/components/items/item-coin'
import { IDSpecial } from '@/components/items/const'
import { Tween } from '@/gkit/tweens'
import { getDevtoolsValues, isTurboMode } from '@/devtools'
import { playSfx } from '@/gkit/utils/sound-manager'

export function coinUpgradeStepAnimation(
  step: StepCoinUpgrade,
  fieldData: FieldExportData
) {
  return async () => {
    const devtoolsValues = getDevtoolsValues()
    const turboMode = isTurboMode()
    const { coinUpgradeAnimations } = devtoolsValues

    const { col, row, upgradedValue } = step

    const frame = fieldData.instance.getMultiplierFrame(col, row)

    if (frame) {
      playSfx(`bg_multiplier`, 0.5)
      await new Promise<void>((resolve) => {
        frame.getActivateTween().once(`complete`, resolve).start()
      })

      fieldData.instance.removeMultiplierFrame(col, row)
    }

    const item = fieldData.bars[col].getItemByPositionIndex(row)

    if (item && (item.id === IDSpecial.Coin || item.id === IDSpecial.Jackpot)) {
      (item as ItemCoin).setInitialMultiplier(upgradedValue)
      playSfx(`bg_multiplier_applied`, 0.5)
    }

    const upgradeDelay = turboMode ? Math.min(coinUpgradeAnimations.upgradeDelay, 100) : coinUpgradeAnimations.upgradeDelay
    await new Promise<void>((resolve) => {
      Tween.to({}, {}, { duration: upgradeDelay }).once(`complete`, resolve).start()
    })
  }
}
