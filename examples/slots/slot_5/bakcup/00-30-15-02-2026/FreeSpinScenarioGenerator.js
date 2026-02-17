/**
 * FreeSpinScenarioGenerator — генератор сценариев для бонусной игры (фриспин).
 * Не меняет базовую логику спинов/каскадов: использует ScenarioGeneratorV3.
 * Добавляет: метаданные бонуса, счётчик фриспинов, активные сундуки, мультипликатор жёлтого сундука.
 * См. FREESPIN_SCENARIO_GENERATOR_LOGIC.md
 */
import { ScenarioGeneratorV3 } from './ScenarioGeneratorV3.js';

const CHEST_COLORS = ['red', 'blue', 'yellow'];

export class FreeSpinScenarioGenerator {
  /**
   * @param {Object} config — конфиг как для ScenarioGeneratorV3 (gridCols, gridRows, payoutsConfig, symbolNames, scatterActivationCount, …)
   * @param {number} [config.initialFreeSpins=10]
   * @param {number} [config.maxFreeSpinRounds=200] — только страховка от бесконечного цикла; в сценарий не пишется
   * @param {number} [config.yellowChestMultiplierPerBomb=1]
   * @param {number} [config.scatterSpinChanceFreeSpin=0.005] — шанс скаттера на спине в фриспине (низкий, чтобы сценарий доходил до 0)
   * @param {number} [config.scatterRefillChanceFreeSpin=0.005] — при досыпке
   * @param {number} [config.scatterCascadeChanceFreeSpin=0.005] — при досыпке в каскаде
   * Настройки «бедной» игры для внутреннего V3 (арки короче, бомб меньше; V3 сам не меняем):
   * @param {number} [config.maxCascadeStepsFreeSpin=5] — макс. шагов каскада в одной арке (1–5 каскадов)
   * @param {number} [config.bombSpinChanceFreeSpin=0.06] — шанс бомбы на спине в фриспине
   * @param {number} [config.bombRefillChanceFreeSpin=0.04] — при досыпке после спина
   * @param {number} [config.bombCascadeChanceFreeSpin=0.04] — при досыпке в каскаде
   */
  constructor(config) {
    this.v3 = new ScenarioGeneratorV3(config);
    this.initialFreeSpins = config.initialFreeSpins ?? 10;
    this.maxFreeSpinRounds = config.maxFreeSpinRounds ?? 200;
    this.yellowChestMultiplierPerBomb = config.yellowChestMultiplierPerBomb ?? 1;
    this.scatterSpinChanceFreeSpin = config.scatterSpinChanceFreeSpin ?? 0.005;
    this.scatterRefillChanceFreeSpin = config.scatterRefillChanceFreeSpin ?? 0.005;
    this.scatterCascadeChanceFreeSpin = config.scatterCascadeChanceFreeSpin ?? 0.005;
    this.scenario = [];
    this.meta = null;

    // «Бедная» игра во фриспине: короткие арки, меньше бомб (настраиваем только внутренний v3)
    this.v3.maxCascadeSteps = config.maxCascadeStepsFreeSpin ?? 5;
    this.v3.bombSpinChance = config.bombSpinChanceFreeSpin ?? 0.06;
    this.v3.bombRefillChance = config.bombRefillChanceFreeSpin ?? 0.04;
    this.v3.bombCascadeChance = config.bombCascadeChanceFreeSpin ?? 0.04;
  }

  reset() {
    this.scenario = [];
    this.meta = null;
    this.v3.reset();
  }

  /**
   * Выбрать случайно минимум один цвет сундука.
   * @returns {string[]}
   */
  _pickActiveChests(minCount = 1) {
    const count = Math.max(minCount, 1 + Math.floor(Math.random() * CHEST_COLORS.length));
    const shuffled = [...CHEST_COLORS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  /**
   * Проверяет, есть ли в шаге бомба (любого типа).
   * @param {Object} step
   * @returns {boolean}
   */
  _stepHasBomb(step) {
    return !!(step.bombPosition || step.bombType);
  }

  /**
   * Добавляет к шагу поля фриспина и при необходимости увеличивает yellowChestMultiplier.
   * @param {Object} step — мутирует step
   * @param {number} freeSpinsRemaining
   * @param {number} roundIndex
   * @param {string[]} activeChests
   * @param {number} yellowChestMultiplier — текущее значение до этого шага
   * @returns {number} — новое значение yellowChestMultiplier после шага
   */
  _enrichStep(step, freeSpinsRemaining, roundIndex, activeChests, yellowChestMultiplier) {
    step.freeSpinsRemaining = freeSpinsRemaining;
    step.roundIndex = roundIndex;
    step.isAutoSpin = roundIndex > 0;

    const hasYellow = activeChests.includes('yellow');
    if (hasYellow && this._stepHasBomb(step)) {
      yellowChestMultiplier += this.yellowChestMultiplierPerBomb;
    }
    step.yellowChestMultiplier = hasYellow ? yellowChestMultiplier : undefined;
    return yellowChestMultiplier;
  }

  /**
   * Генерирует полный сценарий фриспина.
   * @param {number} [initialFreeSpins] — переопределяет конфиг
   * @param {number} [maxFreeSpinRounds] — переопределяет конфиг
   * @param {string[]} [activeChests] — массив 'red'|'blue'|'yellow', минимум 1; если не передан — случайно
   * @returns {Array} — сценарий [bonus-init, ...шаги]
   */
  generateFreeSpinScenario(initialFreeSpins, maxFreeSpinRounds, activeChests) {
    this.reset();

    const initial = initialFreeSpins ?? this.initialFreeSpins;
    const maxRounds = maxFreeSpinRounds ?? this.maxFreeSpinRounds;
    const chests = Array.isArray(activeChests) && activeChests.length > 0
      ? activeChests.filter(c => CHEST_COLORS.includes(c))
      : this._pickActiveChests();
    if (chests.length === 0) {
      chests.push(CHEST_COLORS[Math.floor(Math.random() * CHEST_COLORS.length)]);
    }

    // В сценарий не пишем initialFreeSpins и maxFreeSpinRounds — сценарий логически идёт до 0 фриспинов
    this.meta = {
      event: 'bonus-init',
      isBonus: true,
      activeChests: chests,
      yellowChestMultiplierPerBomb: this.yellowChestMultiplierPerBomb
    };
    this.scenario.push(this.meta);

    let freeSpinsRemaining = initial;
    let roundIndex = 0;
    let yellowChestMultiplier = 0;

    // Временно снижаем шансы скаттеров, чтобы сценарий доходил до 0 фриспинов (скаттеров не много)
    const savedSpin = this.v3.scatterSpinChance;
    const savedRefill = this.v3.scatterRefillChance;
    const savedCascade = this.v3.scatterCascadeChance;
    this.v3.scatterSpinChance = this.scatterSpinChanceFreeSpin;
    this.v3.scatterRefillChance = this.scatterRefillChanceFreeSpin;
    this.v3.scatterCascadeChance = this.scatterCascadeChanceFreeSpin;

    while (freeSpinsRemaining > 0 && roundIndex < maxRounds) {
      const getSpinGrid = () => this.v3.generateRandomGrid();
      const getRefillSymbol = (cascadeStepIndex, refillIndex) =>
        Math.floor(Math.random() * this.v3.symbolCount);

      const roundSteps = this.v3.generateSpinWithCascades(getSpinGrid, getRefillSymbol);
      let scattersOnFieldAtEnd = 0;

      for (const step of roundSteps) {
        yellowChestMultiplier = this._enrichStep(
          step,
          freeSpinsRemaining,
          roundIndex,
          chests,
          yellowChestMultiplier
        );
        if (typeof step.scatterCount === 'number') {
          scattersOnFieldAtEnd = step.scatterCount;
        }
        this.scenario.push(step);
      }

      // Убавляет фриспин только событие спин (spin, spin-win, spin-bomb, spin-win-bomb) — в раунде ровно одно такое
      freeSpinsRemaining -= 1;
      freeSpinsRemaining += scattersOnFieldAtEnd; // каждый скаттер на поле даёт +1 фриспин
      roundIndex += 1;
    }

    this.v3.scatterSpinChance = savedSpin;
    this.v3.scatterRefillChance = savedRefill;
    this.v3.scatterCascadeChance = savedCascade;

    return this.scenario;
  }

  /**
   * Для совместимости с визуализатором (делегирует V3).
   */
  findWinningPositions(grid) {
    return this.v3.findWinningPositions(grid);
  }

  formatCompactJSON(scenario = null) {
    const data = scenario || this.scenario;
    const lines = ['['];
    for (let i = 0; i < data.length; i++) {
      const eventJson = JSON.stringify(data[i]);
      lines.push(`  ${eventJson}${i < data.length - 1 ? ',' : ''}`);
    }
    lines.push(']');
    return lines.join('\n');
  }

  exportToJSON() {
    return this.formatCompactJSON();
  }

  downloadScenario(filename = 'scenario.json') {
    const content = this.exportToJSON();
    if (!filename.endsWith('.json')) {
      filename += '.json';
    }
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.startsWith('scenario/') ? filename : `scenario/${filename}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
