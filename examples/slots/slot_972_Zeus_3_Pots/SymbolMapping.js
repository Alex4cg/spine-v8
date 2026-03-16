/**
 * Парсинг кодов сценария (E, R6_G, S10, Jg, M, MJ, C и т.п.)
 * в нормализованный meta-объект.
 */

/**
 * @typedef {'empty' | 'regular' | 'sticky' | 'jackpot' | 'mystery' | 'mysteryJackpot' | 'collector'} SymbolType
 */

/**
 * @typedef {'green' | 'violet' | 'red' | null} PotColor
 */

/**
 * @typedef {'mini' | 'midi' | 'major' | 'grand' | null} JackpotType
 */

/**
 * @typedef {object} SymbolMeta
 * @property {SymbolType} type
 * @property {number | null} multiplier
 * @property {JackpotType} jackpot
 * @property {PotColor} pot
 * @property {string} rawCode
 */

/**
 * Разобрать строковый код ячейки сценария в meta-объект.
 * Валидация ограничений из GAME_RULES.md делается на уровне генератора сценария,
 * здесь мы просто доверяем входным данным.
 *
 * @param {string} code
 * @returns {SymbolMeta}
 */
export function parseScenarioCode(code) {
  const rawCode = code || 'E';

  if (rawCode === 'E') {
    return {
      type: 'empty',
      multiplier: null,
      jackpot: null,
      pot: null,
      rawCode
    };
  }

  // Pot-суффикс: _G / _V / _R
  let pot = /** @type {PotColor} */ (null);
  let base = rawCode;

  if (rawCode.endsWith('_G')) {
    pot = 'green';
    base = rawCode.slice(0, -2);
  } else if (rawCode.endsWith('_V')) {
    pot = 'violet';
    base = rawCode.slice(0, -2);
  } else if (rawCode.endsWith('_R')) {
    pot = 'red';
    base = rawCode.slice(0, -2);
  }

  /** @type {SymbolType} */
  let type = 'regular';
  /** @type {number | null} */
  let multiplier = null;
  /** @type {JackpotType} */
  let jackpot = null;

  if (base === 'C') {
    type = 'collector';
  } else if (base === 'M') {
    type = 'mystery';
  } else if (base === 'MJ') {
    type = 'mysteryJackpot';
  } else if (base[0] === 'R') {
    type = 'regular';
    multiplier = Number.parseInt(base.slice(1), 10) || null;
  } else if (base[0] === 'S') {
    type = 'sticky';
    multiplier = Number.parseInt(base.slice(1), 10) || null;
  } else if (base[0] === 'J') {
    type = 'jackpot';
    const suffix = base.slice(1); // m/d/r/g
    if (suffix === 'm') jackpot = 'mini';
    else if (suffix === 'd') jackpot = 'midi';
    else if (suffix === 'r') jackpot = 'major';
    else if (suffix === 'g') jackpot = 'grand';

    // Фиксированные множители из GAME_RULES.md (для удобства логики выплат).
    if (jackpot === 'mini') multiplier = 15;
    else if (jackpot === 'midi') multiplier = 50;
    else if (jackpot === 'major') multiplier = 100;
    else if (jackpot === 'grand') multiplier = 1000;
  } else {
    // Неизвестный код трактуем как empty, чтобы не ломать рендер.
    type = 'empty';
  }

  return {
    type,
    multiplier,
    jackpot,
    pot,
    rawCode
  };
}

/**
 * Преобразовать meta-объект к простому числу для существующей 0/1-логики.
 * Сейчас достаточно 0 = пусто, 1 = есть монета / любой спец-символ.
 *
 * @param {SymbolMeta} meta
 * @returns {number}
 */
export function metaToNumericSymbol(meta) {
  if (!meta || meta.type === 'empty') return 0;
  return 1;
}

