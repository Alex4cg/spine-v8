import { COLS } from '@/const'
import { getDevtoolsValues, isTurboMode } from '@/devtools'

export function IDX(col: number, row: number) {
  return (row * COLS) + col
}

export const LINE_INDEX_BY_POSITIONS_KEY: Record<string, number> = {
  '0,0,0': 0,
  '1,1,1': 1,
  '2,2,2': 2,
  '0,1,2': 3,
  '2,1,0': 4
}

export function resolveWinLineIndex(positions: number[]) {
  const key = positions.slice(0, COLS).join(`,`)
  const computed = LINE_INDEX_BY_POSITIONS_KEY[key]
  const computedIsValid = typeof computed === `number` && computed >= 0 && computed < 5

  if (!computedIsValid) {
    return 0
  }

  return computed
}
// TODO ???
// export enum GameMode {
//   Base = `base`,
//   FreeSpin = `freeSpin`
// }

export enum JackpotType {
  Mini = `mini`,
  Midi = `midi`,
  Major = `major`,
  Grand = `grand`
}

export const JACKPOT_VALUES = Object.freeze({
  [JackpotType.Mini]: 25,
  [JackpotType.Midi]: 50,
  [JackpotType.Major]: 150,
  [JackpotType.Grand]: 1000
})

export const BAR_CONFIG_DEFAULT = {
  items: {
    start: 12,
    preSpinsDefaultAdd: 2,
    preSpinsFreeSpinsAdd: 6
  },
  delayPerBar: {
    preSpin: {
      default: 0,
      freeSpins: 80
    },
    endSpin: {
      default: 0,
      freeSpins: 120
    }
  },
  fallDelay: {
    default: {
      inPreSpin: 60,
      inEndSpin: 60
    },
    freeSpins: {
      inPreSpin: 75,
      inEndSpin: 200
    }
  },
  backScroll: 80,
  miniReelHidedFakeItemsPercent: 0.3,
  stepDelays: {
    afterInitial: 300,
    afterApplyRewards: 500,
    afterCollector: 500,
    afterMiniWin: 300,
    afterTrainTrigger: 500,
    afterCoinUpgrade: 300,
    afterBigWin: 500
  }
}

export function getBarConfig() {
  const devtoolsValues = getDevtoolsValues()
  const { barSettings, stepDelays } = devtoolsValues

  return {
    items: {
      start: barSettings.fakeItems.field.preSpin.defaultCount.base,
      preSpinsDefaultAdd: barSettings.fakeItems.field.preSpin.addCount.base,
      preSpinsFreeSpinsAdd: barSettings.fakeItems.field.preSpin.addCount.freeSpins
    },
    delayPerBar: {
      preSpin: {
        default: barSettings.delayPerBar.preSpin.base,
        freeSpins: barSettings.delayPerBar.preSpin.freeSpins
      },
      endSpin: {
        default: barSettings.delayPerBar.endSpin.base,
        freeSpins: barSettings.delayPerBar.endSpin.freeSpins
      }
    },
    fallDelay: {
      default: {
        inPreSpin: barSettings.fallDelay.default.inPreSpin,
        inEndSpin: barSettings.fallDelay.default.inEndSpin
      },
      freeSpins: {
        inPreSpin: barSettings.fallDelay.freeSpins.inPreSpin,
        inEndSpin: barSettings.fallDelay.freeSpins.inEndSpin
      }
    },
    backScroll: barSettings.backScroll.time,
    preSpinBounce: barSettings.preSpinBounce,
    minSpinDuration: barSettings.minSpinDuration,
    miniReelHidedFakeItemsPercent: barSettings.miniReelHidedFakeItemsPercent,
    anticipationDurationMultiplier: barSettings.anticipationDurationMultiplier,
    anticipationDelay: barSettings.anticipationDelay,
    stepDelays: {
      afterInitial: stepDelays.afterInitial,
      afterApplyRewards: stepDelays.afterApplyRewards,
      afterCollector: stepDelays.afterCollector,
      afterMiniWin: stepDelays.afterMiniWin,
      afterTrainTrigger: stepDelays.afterTrainTrigger,
      afterCoinUpgrade: stepDelays.afterCoinUpgrade,
      afterBigWin: stepDelays.afterBigWin
    }
  }
}

export { isTurboMode }

export const BAR_CONFIG = BAR_CONFIG_DEFAULT
