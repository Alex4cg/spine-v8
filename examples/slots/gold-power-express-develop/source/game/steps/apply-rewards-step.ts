import { Chain, Parallel, Tween, endTweenIfExist } from '@/gkit/tweens'
import { COLS, ROWS } from '@/const'
import type { StepApplyRewards } from '@/types'
import type { FieldExportData } from '../types'
import { IDX, resolveWinLineIndex, isTurboMode } from '../const'
import { getDevtoolsValues } from '@/devtools'
import { playSfx } from '@/gkit/utils/sound-manager'

let rewardLoop: Chain | null = null
let delayTween: Tween | null = null
let delayTweenToken: symbol | null = null

function dimSymbols(fieldData: FieldExportData, winPositions: Set<number>, dimAlpha: number = 0.3) {
  for (let c = 0; c < COLS; c++) {
    const bar = fieldData.bars[c]
    for (let r = 0; r < ROWS; r++) {
      const idx = IDX(c, r)
      if (!winPositions.has(idx)) {
        bar.dimItemByPositionIndex(r, dimAlpha)
      }
    }
  }
}

function undimSymbols(fieldData: FieldExportData) {
  for (const bar of fieldData.bars) {
    bar.undimAllItems()
  }
}

function onRewardLineParallelStart(this: Parallel) {
  const self = this as Parallel & {
    __rewardLineFieldData?: FieldExportData
    __rewardLineWinPositions?: Set<number>
  }

  const fieldData = self.__rewardLineFieldData
  const winPositions = self.__rewardLineWinPositions

  if (!fieldData || !winPositions) {
    return
  }

  undimSymbols(fieldData)
  dimSymbols(fieldData, winPositions)
}

function startRewardLoopWithDelay(
  rewards: StepApplyRewards[`rewards`],
  fieldData: FieldExportData,
  allWinPositions: Set<number>,
  delay: number
) {
  if (delayTween) {
    endTweenIfExist(delayTween)
    delayTween = null
  }

  const token = Symbol(`delayTween`)
  delayTweenToken = token

  const newDelayTween = Tween.to({}, {}, { duration: delay })
  newDelayTween.once(`complete`, () => {
    if (delayTweenToken !== token) {
      return
    }

    delayTween = null
    delayTweenToken = null

    fieldData.winLines.stopLooping()
    for (const idx of allWinPositions) {
      const col = idx % COLS
      const row = Math.floor(idx / COLS)
      const cell = fieldData.cells[col]?.[row]
      if (cell?.winFrame) {
        cell.winFrame.stopLooping()
      }
    }

    fieldData.miniWin.visible = false

    startRewardLoop(rewards, fieldData)
  })
  delayTween = newDelayTween
  delayTween.start()
}

function startRewardLoop(
  rewards: StepApplyRewards[`rewards`],
  fieldData: FieldExportData
) {
  stopRewardLoop(fieldData)

  const rewardChain = new Chain()
  rewardChain.repeat(Infinity)

  for (const reward of rewards) {
    const { positions } = reward
    const resolvedLineIndex = resolveWinLineIndex(positions)
    const rowIndex = positions[1] !== undefined && positions[1] >= 0 && positions[1] < ROWS ? positions[1] : 1
    const lineWinPositions = new Set<number>()

    for (let col = 0; col < COLS; col++) {
      const row = positions[col]
      if (row !== undefined && row >= 0 && row < ROWS) {
        const idx = IDX(col, row)
        lineWinPositions.add(idx)
      }
    }

    const parallel = new Parallel()

    ;(parallel as Parallel & {
      __rewardLineFieldData?: FieldExportData
      __rewardLineWinPositions?: Set<number>
    }).__rewardLineFieldData = fieldData
    ;(parallel as Parallel & {
      __rewardLineFieldData?: FieldExportData
      __rewardLineWinPositions?: Set<number>
    }).__rewardLineWinPositions = lineWinPositions

    parallel.on(`start`, onRewardLineParallelStart)
    parallel.on(`start`, () => {
      playSfx(rewards.length > 1 ? `line_many` : `line_hit`, 0.4)
    })

    parallel.add(fieldData.winLines.showLine(resolvedLineIndex))
    parallel.add(fieldData.lineWinPopup.getTween(reward.reward, rowIndex, false))

    for (const idx of lineWinPositions) {
      const col = idx % COLS
      const row = Math.floor(idx / COLS)
      const cell = fieldData.cells[col]?.[row]
      if (cell?.winFrame) {
        parallel.add(cell.winFrame.getWinTween())
      }
    }

    rewardChain.add(parallel)
  }

  rewardChain.on(`start`, () => {
    fieldData.winLines.reset()
    fieldData.lineWinPopup.reset()
    fieldData.miniWin.visible = false
  })

  rewardLoop = rewardChain

  rewardChain.start()
}

function stopRewardLoop(fieldData: FieldExportData) {
  delayTweenToken = null

  if (delayTween) {
    endTweenIfExist(delayTween)
    delayTween = null
  }

  fieldData.winLines.stopLooping()
  fieldData.winLines.reset()

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const cell = fieldData.cells[c]?.[r]
      if (cell?.winFrame) {
        cell.winFrame.reset()
      }
    }
  }

  fieldData.lineWinPopup.reset()
  fieldData.miniWin.visible = false
  undimSymbols(fieldData)

  if (!rewardLoop) {
    return
  }

  const loop = rewardLoop
  rewardLoop = null

  endTweenIfExist(loop)
}

export function stopRewardLoopExternal(fieldData: FieldExportData) {
  stopRewardLoop(fieldData)
}

export function applyRewardsStepAnimation(
  step: StepApplyRewards,
  fieldData: FieldExportData,
  isBonusTrigger: boolean = false
) {
  return async () => {
    if (!step.rewards || step.rewards.length === 0) {
      return
    }

    stopRewardLoop(fieldData)

    fieldData.winLines.reset()
    fieldData.lineWinPopup.reset()

    const devtoolsValues = getDevtoolsValues()
    const turboMode = isTurboMode()
    const { miniWinConfig } = devtoolsValues
    const miniWinDisplayDuration = turboMode
      ? Math.min(miniWinConfig.displayDuration, 1500)
      : miniWinConfig.displayDuration

    const allLineIndices: number[] = []
    const allWinPositions = new Set<number>()

    for (const reward of step.rewards) {
      const { positions } = reward
      const resolvedLineIndex = resolveWinLineIndex(positions)
      allLineIndices.push(resolvedLineIndex)

      for (let col = 0; col < COLS; col++) {
        const row = positions[col]
        if (row !== undefined && row >= 0 && row < ROWS) {
          const idx = IDX(col, row)
          allWinPositions.add(idx)
        }
      }
    }

    const totalWin = step.totalWin ?? step.rewards.reduce((sum, r) => sum + r.reward, 0)

    dimSymbols(fieldData, allWinPositions)
    fieldData.winLines.showAllLinesLooping(allLineIndices)

    for (const idx of allWinPositions) {
      const col = idx % COLS
      const row = Math.floor(idx / COLS)
      const cell = fieldData.cells[col]?.[row]
      if (cell?.winFrame) {
        cell.winFrame.startLooping()
      }
    }

    fieldData.infoLine.setWin(totalWin)
    fieldData.miniWin.setWin(totalWin)
    fieldData.miniWin.getShowTween().start()

    if (step.rewards.length > 1) {
      playSfx(`line_many`, 0.4)
    } else {
      playSfx(`line_hit`, 0.4)
    }
    await new Promise<void>((resolve) => {
      Tween.to({}, {}, { duration: miniWinDisplayDuration }).once(`complete`, resolve).start()
    })

    if (isBonusTrigger) {
      fieldData.winLines.stopLooping()
      fieldData.lineWinPopup.reset()

      const fadeOutParallel = new Parallel()

      fadeOutParallel.add(fieldData.miniWin.getHideTween())
      fadeOutParallel.add(Tween.to(fieldData.winLines, { alpha: 0 }, { duration: 200 }))

      for (const idx of allWinPositions) {
        const col = idx % COLS
        const row = Math.floor(idx / COLS)
        const cell = fieldData.cells[col]?.[row]
        if (cell?.winFrame) {
          cell.winFrame.stopLooping()
        }
      }

      await new Promise<void>((resolve) => {
        fadeOutParallel.once(`complete`, resolve).start()
      })

      fieldData.winLines.reset()
      fieldData.winLines.alpha = 1
      undimSymbols(fieldData)
    } else {
      startRewardLoopWithDelay(step.rewards, fieldData, allWinPositions, 0)
    }
  }
}
