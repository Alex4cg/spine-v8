import type { FieldExportData } from '../types'

const MINI_WIN_DISPLAY_DURATION = 1500

export function miniWinStepAnimation(
  winAmount: number,
  fieldData: FieldExportData
) {
  return async () => {
    const { miniWin, infoLine } = fieldData

    if (!miniWin || winAmount <= 0) {
      return
    }

    infoLine.setWin(winAmount)

    await new Promise<void>((resolve) => {
      const animation = miniWin.getFullAnimation(winAmount, MINI_WIN_DISPLAY_DURATION)

      animation.once(`complete`, () => {
        resolve()
      })

      animation.start()
    })
  }
}
