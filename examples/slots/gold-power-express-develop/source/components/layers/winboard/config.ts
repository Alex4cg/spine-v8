export enum WinBoardTypes {
  WinIn = `winIn`,
  WinOut = `winOut`,
  FreeSpinsIn = `freeSpinsIn`,
  FreeSpinsOut = `freeSpinsOut`,
  TotalWinIn = `totalWinIn`,
  TotalWinOut = `totalWinOut`,
  MaxWinIn = `maxWinIn`,
  MaxWinOut = `maxWinOut`
}

export enum WinBoardEvent {
  PopupClick = `winBoardPopupClick`,
  Win = `winBoardWin`,
  Big = `winBoardBigWin`,
  Sweet = `winBoardSweetWin`,
  Victory = `winBoardVictoryWin`,
  Legend = `winBoardLegendWin`,
  FreeSpinsIn = `winBoardFreeSpinsIn`,
  AfterTotalWinIn = `winBoardAfterTotalWinIn`,
  HideFreeSpinsTotalIn = `winBoardHideFreeSpinsTotalIn`,
  BackdropCoveredFreeSpinsIn = `winBoardBackdropCoveredFreeSpinsIn`,
  BackdropCoveredTotalWinIn = `winBoardBackdropCoveredTotalWinIn`,
  BackdropCoveredMaxWinIn = `winBoardBackdropCoveredMaxWinIn`,
}

export enum WinGradesTypes {
  Small = `SMALL`,
  Big = `BIG`,
  Sweet = `SWEET`,
  Victory = `VICTORY`,
  Legend = `LEGEND`
}

export const WIN_GRADES: Record<Exclude<WinGradesTypes, WinGradesTypes.Small>, number> = Object.freeze({
  [WinGradesTypes.Legend]: 99,
  [WinGradesTypes.Victory]: 50,
  [WinGradesTypes.Sweet]: 25,
  [WinGradesTypes.Big]: 10
})

export const DEFAULT_ANIMATION_TIME_IN_SEC = 5
export const MAX_GRADE = 5000
export const PAUSE_DURATION = 3
export const MAX_GRADE_ANIMATION_TIME = 40

export enum FreeSpinsMode {
  Default = `default`,
  Total = `total`,
  MaxWin = `maxWin`
}
