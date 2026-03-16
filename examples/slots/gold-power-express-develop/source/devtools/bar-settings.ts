import type { SubFolder } from '@clawbuster/facade'
import type { InternalDevtoolsSettings, SettingsSection } from './settings'

export default function createBarSettingsDevtools(options: SettingsSection<`barSettings`>) {
  const mainFolder = options.rootFolder.addFolder({ title: `Bar Settings`, expanded: false })

  const fakeItemsFolder = mainFolder.addFolder({ title: `Fake Items`, expanded: false })
  createFakeItemsFolder(fakeItemsFolder, options.bindValues.fakeItems)

  const delayPerSpinFolder = mainFolder.addFolder({ title: `Delay Per Spin`, expanded: false })
  createSpinDelayFolder(delayPerSpinFolder, options.bindValues.delayPerSpin)

  const minSpinDurationFolder = mainFolder.addFolder({ title: `Min Spin Duration`, expanded: false })
  createMinSpinDurationFolder(minSpinDurationFolder, options.bindValues.minSpinDuration)

  const delayPerBarFolder = mainFolder.addFolder({ title: `Delay Per Bar`, expanded: false })
  createBarDelayFolder(delayPerBarFolder, options.bindValues.delayPerBar)

  const fallDelayFolder = mainFolder.addFolder({ title: `Fall Delay`, expanded: false })
  createFallDelayFolder(fallDelayFolder, options.bindValues.fallDelay)

  const backScrollFolder = mainFolder.addFolder({ title: `Back Scroll`, expanded: false })
  createBackScrollFolder(backScrollFolder, options.bindValues.backScroll)

  const preSpinBounceFolder = mainFolder.addFolder({ title: `Pre-Spin Bounce`, expanded: false })
  createPreSpinBounceFolder(preSpinBounceFolder, options.bindValues.preSpinBounce)

  mainFolder.addBinding(
    options.bindValues,
    `miniReelHidedFakeItemsPercent`,
    {
      min: 0,
      max: 1,
      step: 0.05,
      label: `Mini Reel Hide %`
    }
  )

  mainFolder.addBinding(
    options.bindValues,
    `anticipationDurationMultiplier`,
    {
      min: 1,
      max: 5,
      step: 0.1,
      label: `Anticipation Mult`
    }
  )

  const anticipationDelayFolder = mainFolder.addFolder({ title: `Anticipation Delay`, expanded: false })
  createAnticipationDelayFolder(anticipationDelayFolder, options.bindValues.anticipationDelay)
}

function createFakeItemsFolder(
  folder: SubFolder,
  inputValues: InternalDevtoolsSettings[`barSettings`][`fakeItems`]
) {
  const fieldFolder = folder.addFolder({ title: `Field PreSpin`, expanded: false })

  const defaultCountFolder = fieldFolder.addFolder({ title: `Default Count`, expanded: false })
  defaultCountFolder.addBinding(
    inputValues.field.preSpin.defaultCount,
    `base`,
    {
      min: 4,
      max: 150,
      step: 1,
      label: `Base`
    }
  )
  defaultCountFolder.addBinding(
    inputValues.field.preSpin.defaultCount,
    `freeSpins`,
    {
      min: 4,
      max: 150,
      step: 1,
      label: `Free Spins`
    }
  )
  defaultCountFolder.addBinding(
    inputValues.field.preSpin.defaultCount,
    `copyFromDefault`,
    {
      label: `Copy Default`
    }
  )

  const addCountFolder = fieldFolder.addFolder({ title: `Add Count`, expanded: false })
  addCountFolder.addBinding(
    inputValues.field.preSpin.addCount,
    `base`,
    {
      min: 0,
      max: 60,
      step: 1,
      label: `Base`
    }
  )
  addCountFolder.addBinding(
    inputValues.field.preSpin.addCount,
    `freeSpins`,
    {
      min: 0,
      max: 60,
      step: 1,
      label: `Free Spins`
    }
  )
  addCountFolder.addBinding(
    inputValues.field.preSpin.addCount,
    `copyFromDefault`,
    {
      label: `Copy Default`
    }
  )

  const coinFolder = fieldFolder.addFolder({ title: `Coin Settings`, expanded: false })
  coinFolder.addBinding(
    inputValues.field.preSpin.coin,
    `baseShow`,
    {
      min: 0,
      max: 100,
      step: 1,
      label: `Base Show %`
    }
  )
  coinFolder.addBinding(
    inputValues.field.preSpin.coin,
    `freeSpinsHide`,
    {
      min: 0,
      max: 100,
      step: 1,
      label: `FS Hide %`
    }
  )
}

function createSpinDelayFolder(
  folder: SubFolder,
  inputValues: InternalDevtoolsSettings[`barSettings`][`delayPerSpin`]
) {
  folder.addBinding(
    inputValues,
    `base`,
    {
      min: 0,
      max: 3000,
      step: 10,
      label: `Base (ms)`
    }
  )
  folder.addBinding(
    inputValues,
    `freeSpins`,
    {
      min: 0,
      max: 3000,
      step: 10,
      label: `Free Spins (ms)`
    }
  )
  folder.addBinding(
    inputValues,
    `copyFromDefault`,
    {
      label: `Copy Default`
    }
  )
}

function createMinSpinDurationFolder(
  folder: SubFolder,
  inputValues: InternalDevtoolsSettings[`barSettings`][`minSpinDuration`]
) {
  folder.addBinding(
    inputValues,
    `base`,
    {
      min: 0,
      max: 9000,
      step: 50,
      label: `Base (ms)`
    }
  )
  folder.addBinding(
    inputValues,
    `freeSpins`,
    {
      min: 0,
      max: 6000,
      step: 50,
      label: `Free Spins (ms)`
    }
  )
}

function createBarDelayFolder(
  folder: SubFolder,
  inputValues: InternalDevtoolsSettings[`barSettings`][`delayPerBar`]
) {
  const preSpinFolder = folder.addFolder({ title: `PreSpin`, expanded: false })
  preSpinFolder.addBinding(
    inputValues.preSpin,
    `base`,
    {
      min: 0,
      max: 1500,
      step: 5,
      label: `Base (ms)`
    }
  )
  preSpinFolder.addBinding(
    inputValues.preSpin,
    `freeSpins`,
    {
      min: 0,
      max: 1500,
      step: 5,
      label: `Free Spins (ms)`
    }
  )
  preSpinFolder.addBinding(
    inputValues.preSpin,
    `copyFromDefault`,
    {
      label: `Copy Default`
    }
  )

  const endSpinFolder = folder.addFolder({ title: `EndSpin`, expanded: false })
  endSpinFolder.addBinding(
    inputValues.endSpin,
    `base`,
    {
      min: 0,
      max: 1500,
      step: 5,
      label: `Base (ms)`
    }
  )
  endSpinFolder.addBinding(
    inputValues.endSpin,
    `freeSpins`,
    {
      min: 0,
      max: 1500,
      step: 5,
      label: `Free Spins (ms)`
    }
  )
  endSpinFolder.addBinding(
    inputValues.endSpin,
    `copyFromDefault`,
    {
      label: `Copy Default`
    }
  )
}

function createFallDelayFolder(
  folder: SubFolder,
  inputValues: InternalDevtoolsSettings[`barSettings`][`fallDelay`]
) {
  const defaultFolder = folder.addFolder({ title: `Default`, expanded: false })
  defaultFolder.addBinding(
    inputValues.default,
    `inPreSpin`,
    {
      min: 10,
      max: 900,
      step: 5,
      label: `PreSpin (ms)`
    }
  )
  defaultFolder.addBinding(
    inputValues.default,
    `inEndSpin`,
    {
      min: 10,
      max: 900,
      step: 5,
      label: `EndSpin (ms)`
    }
  )

  const freeSpinsFolder = folder.addFolder({ title: `Free Spins`, expanded: false })
  freeSpinsFolder.addBinding(
    inputValues.freeSpins,
    `inPreSpin`,
    {
      min: 10,
      max: 900,
      step: 5,
      label: `PreSpin (ms)`
    }
  )
  freeSpinsFolder.addBinding(
    inputValues.freeSpins,
    `inEndSpin`,
    {
      min: 10,
      max: 1500,
      step: 5,
      label: `EndSpin (ms)`
    }
  )

  folder.addBinding(
    inputValues,
    `copyFromDefault`,
    {
      label: `Copy Default`
    }
  )
}

function createBackScrollFolder(
  folder: SubFolder,
  inputValues: InternalDevtoolsSettings[`barSettings`][`backScroll`]
) {
  folder.addBinding(
    inputValues,
    `time`,
    {
      min: 0,
      max: 900,
      step: 5,
      label: `Time (ms)`
    }
  )
  folder.addBinding(
    inputValues,
    `distance`,
    {
      min: 0,
      max: 300,
      step: 1,
      label: `Distance (px)`
    }
  )
  folder.addBinding(
    inputValues,
    `copyFromDefault`,
    {
      label: `Copy Default`
    }
  )
}

function createPreSpinBounceFolder(
  folder: SubFolder,
  inputValues: InternalDevtoolsSettings[`barSettings`][`preSpinBounce`]
) {
  folder.addBinding(
    inputValues,
    `enabled`,
    {
      label: `Enabled`
    }
  )
  folder.addBinding(
    inputValues,
    `distance`,
    {
      min: 0,
      max: 150,
      step: 1,
      label: `Distance (px)`
    }
  )
  folder.addBinding(
    inputValues,
    `duration`,
    {
      min: 0,
      max: 900,
      step: 5,
      label: `Duration (ms)`
    }
  )
}

function createAnticipationDelayFolder(
  folder: SubFolder,
  inputValues: InternalDevtoolsSettings[`barSettings`][`anticipationDelay`]
) {
  folder.addBinding(
    inputValues,
    `base`,
    {
      min: 0,
      max: 3000,
      step: 50,
      label: `Base (ms)`
    }
  )
  folder.addBinding(
    inputValues,
    `turbo`,
    {
      min: 0,
      max: 3000,
      step: 50,
      label: `Turbo (ms)`
    }
  )
}

export function createStepDelaysDevtools(options: SettingsSection<`stepDelays`>) {
  const folder = options.rootFolder.addFolder({ title: `Step Delays`, expanded: false })

  folder.addBinding(options.bindValues, `afterInitial`, {
    min: 0, max: 3000, step: 10, label: `After Initial (ms)`
  })
  folder.addBinding(options.bindValues, `afterApplyRewards`, {
    min: 0, max: 3000, step: 10, label: `After Rewards (ms)`
  })
  folder.addBinding(options.bindValues, `afterCollector`, {
    min: 0, max: 3000, step: 10, label: `After Collector (ms)`
  })
  folder.addBinding(options.bindValues, `afterMiniWin`, {
    min: 0, max: 3000, step: 10, label: `After MiniWin (ms)`
  })
  folder.addBinding(options.bindValues, `afterTrainTrigger`, {
    min: 0, max: 3000, step: 10, label: `After Train (ms)`
  })
  folder.addBinding(options.bindValues, `afterCoinUpgrade`, {
    min: 0, max: 3000, step: 10, label: `After Upgrade (ms)`
  })
  folder.addBinding(options.bindValues, `afterBigWin`, {
    min: 0, max: 3000, step: 10, label: `After BigWin (ms)`
  })
}

export function createTrainAnimationsDevtools(options: SettingsSection<`trainAnimations`>) {
  const folder = options.rootFolder.addFolder({ title: `Train Animations`, expanded: false })

  folder.addBinding(options.bindValues, `triggerDelay`, {
    min: 0, max: 3000, step: 10, label: `Trigger Delay (ms)`
  })
  folder.addBinding(options.bindValues, `hitDuration`, {
    min: 0, max: 3000, step: 10, label: `Hit Duration (ms)`
  })
  folder.addBinding(options.bindValues, `collectDelay`, {
    min: 0, max: 1500, step: 10, label: `Collect Delay (ms)`
  })
}

export function createCollectEffectsDevtools(options: SettingsSection<`collectEffects`>) {
  const folder = options.rootFolder.addFolder({ title: `Collect Effects`, expanded: false })

  folder.addBinding(options.bindValues, `flyDuration`, {
    min: 50, max: 3000, step: 10, label: `Fly Duration (ms)`
  })
  folder.addBinding(options.bindValues, `delayBetweenEffects`, {
    min: 0, max: 600, step: 5, label: `Delay Between (ms)`
  })
}

export function createTransitionSettingsDevtools(options: SettingsSection<`transitionSettings`>) {
  const folder = options.rootFolder.addFolder({ title: `Transition Settings`, expanded: false })

  folder.addBinding(options.bindValues, `delayBeforeShowBonusGame`, {
    min: 0, max: 9000, step: 50, label: `Before Bonus (ms)`
  })
  folder.addBinding(options.bindValues, `delayBeforeShowTotalWin`, {
    min: 0, max: 6000, step: 50, label: `Before Total Win (ms)`
  })
}

export function createCollectorAnimationsDevtools(options: SettingsSection<`collectorAnimations`>) {
  const folder = options.rootFolder.addFolder({ title: `Collector Animations`, expanded: false })

  folder.addBinding(options.bindValues, `emptyDelay`, {
    min: 0, max: 3000, step: 10, label: `Empty Delay (ms)`
  })
  folder.addBinding(options.bindValues, `noCoinsDelay`, {
    min: 0, max: 3000, step: 10, label: `No Coins Delay (ms)`
  })
  folder.addBinding(options.bindValues, `afterCollectDelay`, {
    min: 0, max: 3000, step: 10, label: `After Collect (ms)`
  })
}

export function createCoinUpgradeAnimationsDevtools(options: SettingsSection<`coinUpgradeAnimations`>) {
  const folder = options.rootFolder.addFolder({ title: `Coin Upgrade Animations`, expanded: false })

  folder.addBinding(options.bindValues, `upgradeDelay`, {
    min: 0, max: 4500, step: 10, label: `Upgrade Delay (ms)`
  })
}

export function createTrainTriggerAnimationsDevtools(options: SettingsSection<`trainTriggerAnimations`>) {
  const folder = options.rootFolder.addFolder({ title: `Train Trigger Animations`, expanded: false })

  folder.addBinding(options.bindValues, `symbolAppearDelay`, {
    min: 0, max: 1500, step: 10, label: `Symbol Appear (ms)`
  })
  folder.addBinding(options.bindValues, `postTriggerDelay`, {
    min: 0, max: 4500, step: 10, label: `Post Trigger (ms)`
  })
}

export function createMiniWinConfigDevtools(options: SettingsSection<`miniWinConfig`>) {
  const folder = options.rootFolder.addFolder({ title: `Mini Win Config`, expanded: false })

  folder.addBinding(options.bindValues, `animationDuration`, {
    min: 50, max: 3000, step: 10, label: `Animation (ms)`
  })
  folder.addBinding(options.bindValues, `displayDuration`, {
    min: 500, max: 15000, step: 50, label: `Display (ms)`
  })
}

export function createBonusTransitionConfigDevtools(options: SettingsSection<`bonusTransitionConfig`>) {
  const folder = options.rootFolder.addFolder({ title: `Bonus Transition Config`, expanded: false })

  folder.addBinding(options.bindValues, `showDuration`, {
    min: 100, max: 3000, step: 10, label: `Show Duration (ms)`
  })
  folder.addBinding(options.bindValues, `titleScaleDuration`, {
    min: 100, max: 3000, step: 10, label: `Title Scale (ms)`
  })
  folder.addBinding(options.bindValues, `hideDuration`, {
    min: 100, max: 3000, step: 10, label: `Hide Duration (ms)`
  })
}
