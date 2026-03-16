import type { GameStep, StepApplyRewards, StepCollector } from '@/types'
import type { FieldExportData } from './types'
import { applyRewardsStepAnimation } from './steps/apply-rewards-step'
import { initialStepAnimation } from './steps/initial-step'
import { collectorStepAnimation } from './steps/collector-step'
import { trainTriggerStepAnimation } from './steps/train-trigger-step'
import { coinUpgradeStepAnimation } from './steps/coin-upgrade-step'
import { bigWinStepAnimation } from './steps/big-win-step'
import { getBarConfig, isTurboMode } from './const'
import { Tween } from '@/gkit/tweens'
import type WinBoard from '@/components/layers/winboard'

interface StepsManagerOptions {
  fieldData: FieldExportData
  winBoard: WinBoard
}

const STEPS_ORDER = [
  `initial`,
  `applyRewards`,
  `trainTrigger`,
  `coinUpgrade`,
  `collector`,
  `bigWin`
] as const

export default class StepsManager {
  #fieldData: FieldExportData
  #winBoard: WinBoard
  #isSpinAnimation = false

  constructor(options: StepsManagerOptions) {
    this.#fieldData = options.fieldData
    this.#winBoard = options.winBoard
  }

  async startSpinAnimation(
    steps: GameStep[],
    isBonusTrigger: boolean = false,
    skipProps: { stopReelAnimation: boolean } = { stopReelAnimation: false },
    currentAnimation: { skip: (() => void) | null } = { skip: null }
  ) {
    if (this.#isSpinAnimation) {
      throw new Error(`endSpinAnimation must be called before startSpinAnimation`)
    }

    this.#isSpinAnimation = true

    const taskQueue: Array<() => Promise<void>> = []
    const executedSteps: string[] = []

    if (steps.length) {
      const collectorSteps = steps.filter((s) => s.kind === `collector`)
      for (let i = 0; i < STEPS_ORDER.length; i++) {
        const stepKind = STEPS_ORDER[i]

        if (stepKind === `collector`) {
          if (collectorSteps.length > 0) {
            executedSteps.push(stepKind)

            taskQueue.push(async () => {
              let flightSignalResolve: () => void
              const flightSignal = new Promise<void>((resolve) => { flightSignalResolve = resolve })

              const collectReadyCount = { value: 0 }
              let collectSignalResolve: () => void
              const collectSignal = new Promise<void>((resolve) => { collectSignalResolve = resolve })
              const totalCollectors = collectorSteps.length

              const collectorAnimations = collectorSteps.map((collectorStep, index) =>
                collectorStepAnimation(
                  collectorStep, this.#fieldData, collectorSteps, index, isBonusTrigger,
                  {
                    flightSignal, flightSignalResolve: flightSignalResolve!,
                    collectSignal, collectSignalResolve: collectSignalResolve!, collectReadyCount, totalCollectors
                  }
                )()
              )
              await Promise.all(collectorAnimations)
            })
          }
          continue
        }

        const step = steps.find((step) => step.kind === stepKind)

        if (!step) {
          continue
        }

        executedSteps.push(stepKind)

        switch (step.kind) {
          case `initial`: {
            taskQueue.push(initialStepAnimation(step, this.#fieldData, isBonusTrigger, skipProps, currentAnimation))
            break
          }
          case `applyRewards`: {
            taskQueue.push(applyRewardsStepAnimation(step, this.#fieldData, isBonusTrigger))
            break
          }
          case `trainTrigger`: {
            taskQueue.push(trainTriggerStepAnimation(step, this.#fieldData))
            break
          }
          case `coinUpgrade`: {
            taskQueue.push(coinUpgradeStepAnimation(step, this.#fieldData))
            break
          }
          case `bigWin`: {
            const applyRewardsStep = steps.find((s) => s.kind === `applyRewards`) as StepApplyRewards | undefined
            const totalLineWin = applyRewardsStep?.totalWin ?? 0
            const totalCollectorWin = collectorSteps.reduce((sum, s) => sum + (s as StepCollector).collectedValue, 0)
            const totalWin = totalLineWin + totalCollectorWin

            taskQueue.push(bigWinStepAnimation(step, this.#winBoard, totalWin))
            break
          }
          default: {
            break
          }
        }
      }
    }

    const barConfig = getBarConfig()
    const turboMode = isTurboMode()

    const stepDelayMap: Record<string, number> = {
      initial: barConfig.stepDelays.afterInitial,
      applyRewards: barConfig.stepDelays.afterApplyRewards,
      collector: barConfig.stepDelays.afterCollector,
      trainTrigger: barConfig.stepDelays.afterTrainTrigger,
      coinUpgrade: barConfig.stepDelays.afterCoinUpgrade,
      bigWin: barConfig.stepDelays.afterBigWin
    }

    try {
      for (let i = 0; i < taskQueue.length; i++) {
        const task = taskQueue[i]
        const stepKind = executedSteps[i]
        await task()

        if (i < taskQueue.length - 1) {
          const baseDelay = stepDelayMap[stepKind] || 300
          const delay = turboMode ? Math.min(baseDelay, 50) : baseDelay
          await new Promise<void>((resolve) => {
            Tween.to({}, {}, { duration: delay }).once(`complete`, resolve).start()
          })
        }
      }
    } finally {
      this.#isSpinAnimation = false
    }
  }

  endSpinAnimation() {
    this.#isSpinAnimation = false
  }
}
