export const GAME_WIDTH = 1920
export const GAME_HEIGHT = 1080

export const SAFE_ZONE_WIDTH = 1100
export const SAFE_ZONE_HEIGHT = 900

export const COLS = 3
export const ROWS = 3

export enum JackpotTypes {
  Grand = `grand`,
  Major = `major`,
  Midi = `midi`,
  Mini = `mini`
}

export const JACKPOT_BY_ID = Object.freeze({
  [JackpotTypes.Grand]: 1000,
  [JackpotTypes.Major]: 150,
  [JackpotTypes.Midi]: 50,
  [JackpotTypes.Mini]: 25
})

// 5 линий для поля 3×3
// [row для col0, row для col1, row для col2]
export const PAYLINES = [
  [0, 0, 0], // Верхняя горизонталь
  [1, 1, 1], // Средняя горизонталь
  [2, 2, 2], // Нижняя горизонталь
  [0, 1, 2], // Диагональ сверху вниз
  [2, 1, 0] // Диагональ снизу вверх
]