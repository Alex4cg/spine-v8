export function getTeaseColumns(
  grid: string[][],
  bonusIds: string[],
  barCount: number,
  barSize: number,
  targetCount: number
) {
  const teaseColumns: Record<string, boolean> = {}

  const bonusColumns = getBonusColumns(grid, bonusIds, barCount, barSize)

  const totalBonusCount = bonusColumns.reduce((sum, col) => sum + col.sum, 0)

  if (totalBonusCount < targetCount) {
    return teaseColumns
  }

  let startIndex = 0
  let localSum = 0

  for (let i = 0; i < barCount; i++) {
    if (localSum < targetCount) {
      localSum += bonusColumns[startIndex].sum
      startIndex++
    } else {
      break
    }
  }

  let teaseColumnStart = bonusColumns[startIndex - 1].c + 1

  while (teaseColumnStart < barCount) {
    teaseColumns[teaseColumnStart] = true
    teaseColumnStart++
  }

  return teaseColumns
}

function getBonusColumns(incomeGrid: string[][], bonusIds: string[], barCount: number, rowCount: number) {
  const bonusColumns: Record<string, number> = {}

  const grid = incomeGrid.slice()

  for (let r = 0; r < rowCount; r++) {
    const row = grid[r]

    for (let c = 0; c < barCount; c++) {
      if (!bonusColumns[c]) {
        bonusColumns[c] = 0
      }

      if (bonusIds.includes(row[c])) {
        bonusColumns[c] += 1
      }
    }
  }

  const keys = Object.keys(bonusColumns)

  // eslint-disable-next-line
  return keys.map((key) => {
    return {
      c: Number(key),
      sum: bonusColumns[key]
    }
  })
}
