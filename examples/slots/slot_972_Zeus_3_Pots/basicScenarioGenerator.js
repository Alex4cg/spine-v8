/**
 * Базовый стартовый генератор сценариев для Zeus 3×3.
 *
 * Сейчас:
 * - поле 3×3;
 * - символы только 0 и 1;
 * - 10 спинов;
 * - без выигрышей, только «сырые» сетки.
 *
 * Формат шага сценария (по аналогии с slot_1/matrix/scenario_v2.json):
 * {
 *   "matrix": number[][]    // матрица 3×3 в формате matrix[row][col]
 * }
 */

const ROWS = 3;
const COLS = 3;
const DEFAULT_SPIN_COUNT = 10;

/**
 * Генерирует один спин 3×3 с символами 0/1.
 * grid[row][col]
 */
function generateRandomGrid3x3() {
  const grid = [];

  for (let row = 0; row < ROWS; row += 1) {
    const rowData = [];
    for (let col = 0; col < COLS; col += 1) {
      // Пока просто равновероятно 0 или 1
      const symbol = Math.random() < 0.5 ? 0 : 1;
      rowData.push(symbol);
    }
    grid.push(rowData);
  }

  return grid;
}

/**
 * Генерирует стартовый сценарий без выигрышей (просто N спинов).
 *
 * @param {number} spinCount - сколько спинов сгенерировать (по умолчанию 10)
 * @returns {Array<{ matrix: number[][] }>}
 */
export function generateInitialScenario(spinCount = DEFAULT_SPIN_COUNT) {
  const result = [];

  for (let i = 0; i < spinCount; i += 1) {
    const grid = generateRandomGrid3x3();

    result.push({
      matrix: grid
    });
  }

  return result;
}

/**
 * Вспомогательный helper: получить JSON-строку в формате scenario_v2.json.
 * Удобно для быстрого копирования в файл `scenario/scenario_v1.json`.
 */
export function generateInitialScenarioJson(spinCount = DEFAULT_SPIN_COUNT) {
  const data = generateInitialScenario(spinCount);
  return JSON.stringify(data, null, 2);
}

// Пример использования в браузере:
// import { generateInitialScenarioJson } from "./basicScenarioGenerator.js";
// console.log(generateInitialScenarioJson(10));
// → скопировать вывод в slots/slot_972_Zeus_3_Pots/scenario/scenario_v1.json

