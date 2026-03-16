import { gameSettings, type DevtoolsValues, type TabFolder } from '@clawbuster/facade'
import settingsJson from './settings.json'

export interface BarSettingsConfig {
  fakeItems: {
    field: {
      preSpin: {
        defaultCount: {
          base: number
          freeSpins: number
          copyFromDefault: boolean
        }
        addCount: {
          base: number
          freeSpins: number
          copyFromDefault: boolean
        }
        coin: {
          baseShow: number
          freeSpinsHide: number
        }
      }
    }
  }
  delayPerSpin: {
    base: number
    freeSpins: number
    copyFromDefault: boolean
  }
  minSpinDuration: {
    base: number
    freeSpins: number
  }
  delayPerBar: {
    preSpin: {
      base: number
      freeSpins: number
      copyFromDefault: boolean
    }
    endSpin: {
      base: number
      freeSpins: number
      copyFromDefault: boolean
    }
  }
  fallDelay: {
    default: {
      inPreSpin: number
      inEndSpin: number
    }
    freeSpins: {
      inPreSpin: number
      inEndSpin: number
    }
    copyFromDefault: boolean
  }
  backScroll: {
    time: number
    distance: number
    copyFromDefault: boolean
  }
  preSpinBounce: {
    enabled: boolean
    distance: number
    duration: number
  }
  miniReelHidedFakeItemsPercent: number
  anticipationDurationMultiplier: number
  anticipationDelay: {
    base: number
    turbo: number
  }
}

export interface StepDelaysConfig {
  afterInitial: number
  afterApplyRewards: number
  afterCollector: number
  afterMiniWin: number
  afterTrainTrigger: number
  afterCoinUpgrade: number
  afterBigWin: number
}

export interface CollectorAnimationsConfig {
  emptyDelay: number
  noCoinsDelay: number
  afterCollectDelay: number
}

export interface CoinUpgradeAnimationsConfig {
  upgradeDelay: number
}

export interface TrainTriggerAnimationsConfig {
  symbolAppearDelay: number
  postTriggerDelay: number
}

export interface MiniWinConfig {
  animationDuration: number
  displayDuration: number
}

export interface BonusTransitionConfig {
  showDuration: number
  titleScaleDuration: number
  hideDuration: number
}

export interface TrainAnimationsConfig {
  triggerDelay: number
  hitDuration: number
  collectDelay: number
}

export interface CollectEffectsConfig {
  flyDuration: number
  delayBetweenEffects: number
}

export interface TransitionSettingsConfig {
  delayBeforeShowBonusGame: number
  delayBeforeShowTotalWin: number
}

export interface InternalDevtoolsSettings {
  barSettings: BarSettingsConfig
  stepDelays: StepDelaysConfig
  trainAnimations: TrainAnimationsConfig
  collectEffects: CollectEffectsConfig
  transitionSettings: TransitionSettingsConfig
  collectorAnimations: CollectorAnimationsConfig
  coinUpgradeAnimations: CoinUpgradeAnimationsConfig
  trainTriggerAnimations: TrainTriggerAnimationsConfig
  miniWinConfig: MiniWinConfig
  bonusTransitionConfig: BonusTransitionConfig
}

export interface FullDevtoolsValues extends DevtoolsValues {
  [gameSettings.fastModeTypes.Normal]: InternalDevtoolsSettings
  [gameSettings.fastModeTypes.Fast]: InternalDevtoolsSettings
  [gameSettings.fastModeTypes.Fastest]: InternalDevtoolsSettings
}

export interface SettingsSection<T extends keyof InternalDevtoolsSettings> {
  rootFolder: TabFolder
  bindValues: InternalDevtoolsSettings[T]
}

export const fullSettings: FullDevtoolsValues = settingsJson as FullDevtoolsValues
