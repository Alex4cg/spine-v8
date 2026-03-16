import type { StepBigWin } from '@/types'
import { getWinGrade } from '@/components/layers/winboard/utils'
import { WinBoardTypes } from '@/components/layers/winboard/config'
import { ui } from '@clawbuster/facade'
import type WinBoard from '@/components/layers/winboard'

export function bigWinStepAnimation(step: StepBigWin, winBoardInstance: WinBoard, totalWin: number) {
  return async () => {
    const bet = ui.bet.value!
    const xWinnings = totalWin / bet

    const grade = getWinGrade(xWinnings)

    winBoardInstance.setWinnings(totalWin)
    winBoardInstance.setXWinnings(xWinnings)
    winBoardInstance.setWinGrade(grade)

    await new Promise<void>((resolve) => {
      const winInAnimation = winBoardInstance.getAnimation(WinBoardTypes.WinIn)

      winInAnimation.once(`complete`, () => {
        resolve()
      })

      winInAnimation.start()
    })
  }
}
