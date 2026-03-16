import { WIN_GRADES, WinGradesTypes } from './config'

export function getWinGrade(x: number) {
  switch (true) {
    case x >= WIN_GRADES.LEGEND:
      return WinGradesTypes.Legend
    case x >= WIN_GRADES.VICTORY:
      return WinGradesTypes.Victory
    case x >= WIN_GRADES.SWEET:
      return WinGradesTypes.Sweet
    case x >= WIN_GRADES.BIG:
      return WinGradesTypes.Big
    default:
      return WinGradesTypes.Small
  }
}
