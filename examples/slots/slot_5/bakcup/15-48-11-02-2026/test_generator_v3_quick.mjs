/**
 * Быстрый тест ScenarioGeneratorV3
 * Запуск: node test_generator_v3_quick.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Импортируем генератор из основного файла
import { ScenarioGeneratorV3 } from './ScenarioGeneratorV3.js';

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

// Создаем генератор
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
  bombMultiplier: 5,
  bombSpinChance: 0.03,
  bombRefillChance: 0.01
});

// Генерируем сценарий
console.log('\nГенерация сценария (5 спинов)...\n');
const scenario = generator.generateScenario(5);

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

// Функция для компактного форматирования JSON (каждое событие на одной строке)
function formatCompactJSON(scenario) {
  const lines = ['['];
  for (let i = 0; i < scenario.length; i++) {
    const eventJson = JSON.stringify(scenario[i]);
    lines.push(`  ${eventJson}${i < scenario.length - 1 ? ',' : ''}`);
  }
  lines.push(']');
  return lines.join('\n');
}

// Сохраняем сценарий
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const filename = `scenario_${timestamp}.json`;
const scenarioDir = join(__dirname, 'scenario');
writeFileSync(join(scenarioDir, filename), formatCompactJSON(scenario));
console.log(`\n✓ Сценарий сохранен: scenario/${filename}`);
