/**
 * Базовый стартовый генератор сценариев для Zeus 3×3.
 *
 * Теперь генератор учитывает правила из `GAME_RULES.md`:
 * - используется кодовая запись монет (`E`, `R1`..`R9`, `S3`..`S12`, `Jm`/`Jd`/`Jr`/`Jg`, `M`, `MJ`);
 * - pot‑признак добавляется как суффикс `_G` / `_V` / `_R`;
 * - pot‑монеты и спец‑символы могут появляться только в среднем ряду;
 * - в верхнем и нижнем рядах — только базовые регулярные монеты и пустота;
 * - sticky‑монеты никогда не являются pot‑монетами.
 *
 * Формат шага сценария:
 * {
 *   "matrix": string[][]    // матрица 3×3 в формате matrix[row][col]
 * }
 */

const ROWS = 3;
const COLS = 3;
const DEFAULT_SPIN_COUNT = 10;

// Коды монет и pot‑суффиксы строго по `GAME_RULES.md`
const REGULAR_COINS = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"];
const STICKY_COINS = ["S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12"];
const JACKPOT_COINS = ["Jm", "Jd", "Jr", "Jg"]; // Mini / Midi / Major / Grand
const POT_SUFFIXES = ["_G", "_V", "_R"]; // green / violet / red

/**
 * Вспомогательный выбор по "весам".
 *
 * @param {Array<{ value: string, weight: number }>} items
 * @returns {string}
 */
function weightedRandom(items) {
  const total = items.reduce((acc, it) => acc + it.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i += 1) {
    r -= items[i].weight;
    if (r <= 0) return items[i].value;
  }
  return items[items.length - 1].value;
}

/**
 * Проверка: код является ли sticky-монетой (S3..S12).
 * @param {string} code
 * @returns {boolean}
 */
function isStickyCode(code) {
  return code.startsWith("S");
}

/**
 * Генерирует случайный символ для указанного ряда с учётом правил.
 *
 * Основные ограничения (см. "правила копия с ноушена"):
 * - Top/bottom rows (0 и 2):
 *   - можно: basic regular (R1..R9), sticky (S3..S12), JP (Jm/Jd/Jr/Jg), M, MJ;
 *   - нельзя: pot regular (R*_G/V/R).
 * - Middle row (1):
 *   - можно: pot regular (R*_G/V/R), sticky, JP, M, MJ;
 *   - нельзя: basic regular без pot‑суффикса.
 * - В среднем ряду максимум 2 sticky‑монеты.
 *
 * Параметр options.noBonus:
 * - если true, дополнительно гарантируем, что в среднем ряду не будет 3 монет
 *   (т.е. один слот гарантированно пустой и стандартный триггер бонуски не сработает).
 *
 * @param {number} rowIndex - индекс ряда (0 = верхний, 1 = средний, 2 = нижний)
 * @param {number} colIndex - индекс колонки (0..2)
 * @param {{ noBonus?: boolean, stickyInRow?: number }} [options]
 * @returns {string} код символа (E, Rn, Rn_G, Jm_V, M, ...)
 */
function generateSymbolForRow(rowIndex, colIndex, options = {}) {
  const { stickyInRow = 0 } = options;

  // Верхний (0) и нижний (2) ряды:
  // можно: basic regular, sticky, JP, M, MJ (без pot‑суффикса).
  if (rowIndex === 0 || rowIndex === 2) {
    const items = [
      { value: "E", weight: 6 }, // побольше пустых
      ...REGULAR_COINS.map((code) => ({ value: code, weight: 1 })),
      ...STICKY_COINS.map((code) => ({ value: code, weight: 0.6 })),
      ...JACKPOT_COINS.map((code) => ({ value: code, weight: 0.2 })),
      { value: "M", weight: 0.5 },
      { value: "MJ", weight: 0.3 }
    ];
    return weightedRandom(items);
  }

  // Средний ряд (1):
  // можно: pot‑регулярные, sticky, JP, M, MJ; нельзя basic regular.
  const middlePool = [];

  // Пустая ячейка
  middlePool.push({ value: "E", weight: 8 });

  // Regular + pot‑признак
  REGULAR_COINS.forEach((code) => {
    POT_SUFFIXES.forEach((suffix) => {
      middlePool.push({ value: `${code}${suffix}`, weight: 1 });
    });
  });

  // Sticky‑монеты (без pot‑суффиксов) — ограничиваем максимум до 2 в ряду
  if (stickyInRow < 2) {
    STICKY_COINS.forEach((code) => {
      middlePool.push({ value: code, weight: 0.6 });
    });
  }

  // Джекпот‑монеты
  JACKPOT_COINS.forEach((code) => {
    middlePool.push({ value: code, weight: 0.2 });
  });

  // Mystery и mystery jackpot
  middlePool.push({ value: "M", weight: 0.7 });
  middlePool.push({ value: "MJ", weight: 0.3 });

  // Collector (C) в базовой игре не генерируем — только в бонуске.

  return weightedRandom(middlePool);
}

/**
 * Генерирует один спин 3×3.
 * grid[row][col] с кодами из раздела 1.8 `GAME_RULES.md`.
 *
 * @param {{ noBonus?: boolean }} [options]
 * @returns {string[][]}
 */
function generateRandomGrid3x3(options = {}) {
  const grid = [];

  for (let row = 0; row < ROWS; row += 1) {
    const rowData = [];
    let stickyInRow = 0;

    for (let col = 0; col < COLS; col += 1) {
      let symbol;

      // Генерируем символ с учётом лимита sticky и, для noBonus,
      // гарантируем отсутствие 3 монет в среднем ряду.
      // (Если noBonus = true и это средний ряд, следим, чтобы
      //  не получилось три non-empty символа.)
      // Поскольку пул весовой, в редких случаях может потребоваться
      // несколько попыток — но поле 3×3, так что это безопасно.
      do {
        symbol = generateSymbolForRow(row, col, { ...options, stickyInRow });
      } while (
        options.noBonus &&
        row === 1 &&
        // проверяем, что после постановки symbol не получится 3 монеты
        (symbol !== "E" &&
          rowData.filter((c) => c !== "E").length + 1 >= 3)
      );

      if (row === 1 && isStickyCode(symbol)) {
        stickyInRow += 1;
      }

      rowData.push(symbol);
    }
    grid.push(rowData);
  }

  return grid;
}

/**
 * Генерирует стартовый сценарий базовой игры (просто N спинов)
 * в формате матриц 3×3 с кодами монет.
 *
 * @param {number} spinCount - сколько спинов сгенерировать (по умолчанию 10)
 * @param {{ noBonus?: boolean }} [options] - режимы генерации
 * @returns {Array<{ matrix: string[][] }>}
 */
export function generateInitialScenario(spinCount = DEFAULT_SPIN_COUNT, options = {}) {
  const result = [];

  for (let i = 0; i < spinCount; i += 1) {
    const grid = generateRandomGrid3x3(options);

    result.push({
      matrix: grid
    });
  }

  return result;
}

/**
 * Вспомогательный helper: получить JSON-строку сценария.
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

