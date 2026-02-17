/**
 * Быстрый тест ScenarioGeneratorV3 (тот же генератор, что в index.html)
 * Запуск: node test_generator_v3_quick.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ScenarioGeneratorV3 } from './ScenarioGeneratorV3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Загружаем payouts.json
let payoutsConfig = null;
try {
  const payoutsPath = join(__dirname, 'payouts.json');
  const payoutsData = readFileSync(payoutsPath, 'utf8');
  payoutsConfig = JSON.parse(payoutsData);
  console.log('✓ Payouts loaded');
} catch (error) {
  console.warn('⚠ Could not load payouts.json:', error.message);
}

// Создаем генератор (тот же конфиг, что и в index.html / .mjs — без переопределения скаттеров)
const generator = new ScenarioGeneratorV3({
  gridCols: 6,
  gridRows: 5,
  minSymbolsForWin: 7,
  symbolCount: 8,
  payoutsConfig: payoutsConfig,
  symbolNames: [
    'h1_lion', 'h2_bull', 'h3_bear', 'h4_wolf',
    'l1_revolver', 'l2_bottle', 'l3_horseshoe', 'l4_cactus'
  ],
  bombSymbolType: 8,
  bombMultiplier: 5
});

// Генерируем сценарий
console.log('\nГенерация сценария (30 спинов)...\n');
const scenario = generator.generateScenario(30);

console.log(`✓ Сценарий сгенерирован: ${scenario.length} шагов\n`);

// Выводим статистику
const eventCounts = {};
scenario.forEach(step => {
  eventCounts[step.event] = (eventCounts[step.event] || 0) + 1;
});

console.log('Статистика событий:');
Object.entries(eventCounts).forEach(([event, count]) => {
  console.log(`  ${event}: ${count}`);
});

console.log('\nПервые 3 шага:');
scenario.slice(0, 3).forEach((step, index) => {
  console.log(`\nШаг ${index + 1}: ${step.event}`);
  if (step.winningGroups && step.winningGroups.length > 0) {
    console.log(`  Выигрышные группы: ${step.winningGroups.map(g => `${g.symbolName} (${g.count})`).join(', ')}`);
  }
  if (step.bombType) {
    console.log(`  Бомба: ${step.bombType} в [${step.bombPosition.row}][${step.bombPosition.col}]`);
  }
  if (step.totalPayout > 0) {
    console.log(`  Выплата: ${step.totalPayout}`);
  }
});

// Проверка последовательности
console.log('\n\nПроверка последовательности событий:');
let errors = [];
for (let i = 0; i < scenario.length - 1; i++) {
  const current = scenario[i];
  const next = scenario[i + 1];
  
  if (current.event === 'spin-win' || current.event === 'spin-win-bomb') {
    if (!next.event.startsWith('cascade')) {
      errors.push(`Шаг ${i + 1}: ${current.event} должен иметь следующий шаг cascade, но получен ${next.event}`);
    }
  }
  
  if (current.event === 'spin-bomb') {
    if (!next.event.startsWith('cascade')) {
      errors.push(`Шаг ${i + 1}: ${current.event} должен иметь следующий шаг cascade, но получен ${next.event}`);
    }
  }
  
  if (current.event === 'cascade-win' || current.event === 'cascade-win-bomb') {
    if (!next.event.startsWith('cascade')) {
      errors.push(`Шаг ${i + 1}: ${current.event} должен иметь следующий шаг cascade, но получен ${next.event}`);
    }
  }
}

if (errors.length === 0) {
  console.log('✓ Последовательность событий корректна');
} else {
  console.log('✗ Найдены ошибки:');
  errors.forEach(err => console.log(`  - ${err}`));
}

// Статистика по бомбам
const eventsWithBomb = scenario.filter(s => s.bombPosition != null || s.bombType);
const bombByType = { 'spin-bomb': 0, 'spin-win-bomb': 0, 'cascade-bomb': 0, 'cascade-win-bomb': 0 };
scenario.forEach(s => {
  if (bombByType[s.event] !== undefined) bombByType[s.event]++;
});
const totalBombEvents = eventsWithBomb.length;
const maxBombsInEvent = Math.max(0, ...scenario.map(s => (s.grid && s.grid.flat().filter(c => c === 8).length) || 0));
console.log('\nБомбы:');
console.log(`  Событий с бомбой: ${totalBombEvents} из ${scenario.length}`);
console.log(`  spin-bomb: ${bombByType['spin-bomb']}, spin-win-bomb: ${bombByType['spin-win-bomb']}, cascade-bomb: ${bombByType['cascade-bomb']}, cascade-win-bomb: ${bombByType['cascade-win-bomb']}`);
console.log(`  Макс. бомб в одном событии: ${maxBombsInEvent} (должно быть ≤ 1)`);

// Скаттеры
const eventsWithScatter = scenario.filter(s => (s.scatterCount || 0) > 0);
const totalScatters = scenario.reduce((sum, s) => sum + (s.scatterCount || 0), 0);
const maxScatterInEvent = Math.max(0, ...scenario.map(s => s.scatterCount || 0));
const shareWithScatter = (eventsWithScatter.length / scenario.length * 100).toFixed(1);
console.log('\nСкаттеры:');
console.log(`  Событий с хотя бы 1 скаттером: ${eventsWithScatter.length} из ${scenario.length} (${shareWithScatter}%)`);
console.log(`  Всего скаттеров в сценарии: ${totalScatters}`);
console.log(`  Макс. скаттеров в одном событии: ${maxScatterInEvent}`);
const scatterRare = eventsWithScatter.length <= scenario.length * 0.5 && maxScatterInEvent <= 6;
if (scatterRare) {
  console.log('✓ Скаттеры выглядят достаточно редко');
} else {
  console.log('⚠ Скаттеры встречаются часто — проверьте scatterSpinChance / scatterRefillChance');
}

// Сохраняем сценарий
const scenarioDir = join(__dirname, 'scenario');
if (!existsSync(scenarioDir)) mkdirSync(scenarioDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const filename = `scenario_${timestamp}.json`;
writeFileSync(join(scenarioDir, filename), generator.formatCompactJSON(scenario));
console.log(`\n✓ Сценарий сохранен: scenario/${filename}`);
