import { BuildType } from '@clawbuster/factory'
import { gameSettings } from '@clawbuster/facade'

import { fullSettings, type FullDevtoolsValues } from './settings'
import createBarSettingsDevtools, {
  createStepDelaysDevtools,
  createTrainAnimationsDevtools,
  createCollectEffectsDevtools,
  createTransitionSettingsDevtools,
  createCollectorAnimationsDevtools,
  createCoinUpgradeAnimationsDevtools,
  createTrainTriggerAnimationsDevtools,
  createMiniWinConfigDevtools,
  createBonusTransitionConfigDevtools
} from './bar-settings'

declare const BUILD_CONFIG: { MODE: string }
declare const GAME_ENV_DATA: { DEPLOY_TARGET: string }

const tabByIndex = [
  gameSettings.fastModeTypes.Normal,
  gameSettings.fastModeTypes.Fast,
  gameSettings.fastModeTypes.Fastest
]

gameSettings.setCreateDevtoolsHandler<FullDevtoolsValues>((rootFolder, bindValues) => {
  if (rootFolder === null) {
    return
  }

  if (BUILD_CONFIG.MODE === BuildType.PRODUCTION) {
    if (typeof GAME_ENV_DATA !== `undefined` && GAME_ENV_DATA.DEPLOY_TARGET !== `develop`) {
      return
    }
  }

  const tabs = rootFolder.addTab({
    pages: [
      { title: `Normal` },
      { title: `Fast` },
      { title: `Fastest` }
    ]
  })

  for (let i = 0; i < 3; i++) {
    const currentPage = tabs.pages[i]
    const currentSettings = bindValues[tabByIndex[i]]

    createBarSettingsDevtools({
      rootFolder: currentPage,
      bindValues: currentSettings.barSettings
    })

    createStepDelaysDevtools({
      rootFolder: currentPage,
      bindValues: currentSettings.stepDelays
    })

    createTrainAnimationsDevtools({
      rootFolder: currentPage,
      bindValues: currentSettings.trainAnimations
    })

    createCollectEffectsDevtools({
      rootFolder: currentPage,
      bindValues: currentSettings.collectEffects
    })

    createTransitionSettingsDevtools({
      rootFolder: currentPage,
      bindValues: currentSettings.transitionSettings
    })

    createCollectorAnimationsDevtools({
      rootFolder: currentPage,
      bindValues: currentSettings.collectorAnimations
    })

    createCoinUpgradeAnimationsDevtools({
      rootFolder: currentPage,
      bindValues: currentSettings.coinUpgradeAnimations
    })

    createTrainTriggerAnimationsDevtools({
      rootFolder: currentPage,
      bindValues: currentSettings.trainTriggerAnimations
    })

    createMiniWinConfigDevtools({
      rootFolder: currentPage,
      bindValues: currentSettings.miniWinConfig
    })

    createBonusTransitionConfigDevtools({
      rootFolder: currentPage,
      bindValues: currentSettings.bonusTransitionConfig
    })
  }
})

gameSettings.setDevtoolsValues(fullSettings)

export function getDevtoolsValues() {
  const values = gameSettings.getDevtoolsValues<FullDevtoolsValues>()
  const fastMode = gameSettings.fastMode || gameSettings.fastModeTypes.Normal

  return values[fastMode]
}

export function isTurboMode() {
  return gameSettings.fastMode === gameSettings.fastModeTypes.Fastest
}

export function isFastMode() {
  return gameSettings.fastMode === gameSettings.fastModeTypes.Fast
}

export function isNormalMode() {
  return gameSettings.fastMode === gameSettings.fastModeTypes.Normal
}
