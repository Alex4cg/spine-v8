/**
 * Быстрый тест FreeSpinScenarioGenerator
 * Запуск: node test_freespin_generator_quick.mjs
 *
 * Проверяет: сценарии фриспина завершаются (счётчик доходит до 0), число раундов в разумных пределах.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import { FreeSpinScenarioGenerator } from './FreeSpinScenarioGenerator.js';

let payoutsConfig = null;
try {
  const payoutsPath = join(__dirname, 'payouts.json');
  payoutsConfig = JSON.parse(readFileSync(payoutsPath, 'utf8'));
  console.log('✓ Payouts loaded');
} catch (e) {
  console.warn('⚠ Could not load payouts.json:', e.message);
}

const generator = new FreeSpinScenarioGenerator({
  gridCols: 6,
  gridRows: 5,
  minSymbolsForWin: 7,
  symbolCount: 8,
  payoutsConfig: payoutsConfig,
  symbolNames: [
    'h1_lion', 'h2_bull', 'h3_bear', 'h4_wolf',
    'l1_revolver', 'l2_bottle', 'l3_horseshoe', 'l4_cactus'
  ],
  scatterActivationCount: 4
});

const RUNS = 20;
const INITIAL_FREE_SPINS = 10;
const MAX_ROUNDS_CAP = 200;

console.log(`\nГенерация ${RUNS} сценариев фриспина (начальных фриспинов: ${INITIAL_FREE_SPINS})...\n`);

const results = [];
for (let r = 0; r < RUNS; r++) {
  generator.generateFreeSpinScenario(INITIAL_FREE_SPINS, MAX_ROUNDS_CAP, ['red']);
  const scenario = generator.scenario;
  const bonusInit = scenario[0];
  const playSteps = scenario.filter(s => s.grid && typeof s.freeSpinsRemaining === 'number');
  const lastPlay = playSteps[playSteps.length - 1];
  const roundCount = lastPlay ? (lastPlay.roundIndex + 1) : 0;
  // Завершилось по 0: не достигли лимита раундов (последний шаг — значение на начало раунда, 0 бывает после выхода)
  const endedByZero = roundCount < MAX_ROUNDS_CAP;
  const stepCount = scenario.length;
  results.push({
    roundCount,
    stepCount,
    endedByZero,
    lastFreeSpins: lastPlay ? lastPlay.freeSpinsRemaining : null
  });
}

const roundCounts = results.map(x => x.roundCount);
const endedByZeroCount = results.filter(x => x.endedByZero).length;
const minRounds = Math.min(...roundCounts);
const maxRounds = Math.max(...roundCounts);
const avgRounds = roundCounts.reduce((a, b) => a + b, 0) / roundCounts.length;

console.log('Результаты:');
console.log(`  Раундов: min=${minRounds}, max=${maxRounds}, avg=${avgRounds.toFixed(1)}`);
console.log(`  Завершилось по 0 фриспинов: ${endedByZeroCount} из ${RUNS}`);
console.log(`  Завершилось по лимиту раундов: ${RUNS - endedByZeroCount} из ${RUNS}`);

let ok = true;
if (endedByZeroCount < RUNS * 0.5) {
  console.log('\n⚠ Меньше половины сценариев закончились по 0 фриспинов — снизьте шансы скаттеров в фриспине.');
  ok = false;
}
const hitCap = results.filter(x => x.roundCount >= MAX_ROUNDS_CAP).length;
if (hitCap > 0) {
  console.log(`\n⚠ ${hitCap} сценариев достигли лимита ${MAX_ROUNDS_CAP} раундов — фриспины не заканчиваются.`);
  ok = false;
}
if (minRounds <= INITIAL_FREE_SPINS) {
  console.log(`\n✓ Часть сценариев закончилась за ${INITIAL_FREE_SPINS} раундов или быстрее (мало скаттеров).`);
}

if (ok) {
  console.log('\n✓ Тест пройден: фриспины в среднем заканчиваются по счётчику 0.');
} else {
  console.log('\n✗ Тест не пройден.');
}

// Сохраняем один сценарий для проверки
const one = generator.generateFreeSpinScenario(INITIAL_FREE_SPINS, MAX_ROUNDS_CAP, ['yellow']);
function formatCompactJSON(scenario) {
  const lines = ['['];
  for (let i = 0; i < scenario.length; i++) {
    const eventJson = JSON.stringify(scenario[i]);
    lines.push(`  ${eventJson}${i < scenario.length - 1 ? ',' : ''}`);
  }
  lines.push(']');
  return lines.join('\n');
}
const scenarioDir = join(__dirname, 'scenario');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const filename = `scenario_freespin_${timestamp}.json`;
writeFileSync(join(scenarioDir, filename), formatCompactJSON(one));
console.log(`\n✓ Один сценарий сохранён: scenario/${filename}`);
