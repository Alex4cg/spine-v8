/**
 * Тест для генерации спина с ровно 3 скаттерами в первом событии
 * Условия:
 * - Ровно 3 скаттера в первом событии (первое насыпание)
 * - Все 3 скаттера в первых 2 столбцах (колонки 0 и 1)
 * - Не более 5 скаттеров за всю арку (спин + каскады)
 * Запуск: node test_generate_spin_with_3_scatters.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
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

// Настройка вероятностей для ускорения поиска
const GENERATOR_CONFIG = {
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
  // Увеличиваем шанс скаттеров на спине для более частого появления
  scatterSpinChance: 0.15,  // вместо дефолтных ~0.0088
  // Убираем скаттеры из досыпок чтобы они были только в первом насыпании
  scatterRefillChance: 0.0,
  scatterCascadeChance: 0.0,
};

// Создаем генератор с настроенными параметрами
const generator = new ScenarioGeneratorV3(GENERATOR_CONFIG);

// Функция getRefillSymbol
const getRefillSymbol = (cascadeStepIndex, refillIndex) => 
  Math.floor(Math.random() * generator.symbolCount);

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

// Цикл перебора
console.log('\nПоиск спина с ровно 3 скаттерами в первых 2 столбцах...\n');
console.log('Условия:');
console.log('  - Ровно 3 скаттера в первом событии');
console.log('  - Все 3 скаттера в колонках 0 и 1');
console.log('  - Не более 5 скаттеров за всю арку\n');

let attempts = 0;
let found = false;
let scenario = null;

while (!found) {
  attempts++;
  
  // Показываем прогресс каждые 1000 попыток
  if (attempts % 1000 === 0) {
    process.stdout.write(`\rПопыток: ${attempts}...`);
  }
  
  const steps = generator.generateSpinWithCascades(
    () => generator.generateRandomGrid(),
    getRefillSymbol
  );
  
  const firstEvent = steps[0];
  const firstEventScatterInfo = generator.countScatters(firstEvent.grid);
  const firstEventScatterCount = firstEvent.scatterCount || firstEventScatterInfo.total;
  
  // Проверка 1: ровно 3 скаттера в первом событии
  if (firstEventScatterCount !== 3) {
    continue;
  }
  
  // Проверка 2: все 3 скаттера в первых 2 столбцах
  const scatterPositions = firstEvent.scatterPositions || firstEventScatterInfo.positions;
  if (scatterPositions.length !== 3) {
    continue;
  }
  
  const allInFirstTwoCols = scatterPositions.every(pos => pos.col === 0 || pos.col === 1);
  if (!allInFirstTwoCols) {
    continue;
  }
  
  // Проверка 3: не более 5 скаттеров за всю арку
  let totalScatters = 0;
  for (const step of steps) {
    const scatterCount = step.scatterCount || generator.countScatters(step.grid).total;
    totalScatters += scatterCount;
  }
  
  if (totalScatters <= 5) {
    found = true;
    scenario = steps;
  }
}

// Вывод результатов
console.log(`\n\n✓ Найдено за ${attempts} попыток!\n`);

// Информация о первом событии
const firstEvent = scenario[0];
const firstEventScatterInfo = generator.countScatters(firstEvent.grid);
const scatterPositions = firstEvent.scatterPositions || firstEventScatterInfo.positions;

console.log('Первое событие:');
console.log(`  Тип: ${firstEvent.event}`);
console.log(`  Скаттеров: ${firstEventScatterInfo.total}`);
console.log(`  Позиции скаттеров:`);
scatterPositions.forEach((pos, idx) => {
  const typeName = pos.type === 9 ? 'blue' : pos.type === 10 ? 'gold' : 'red';
  console.log(`    ${idx + 1}. [${pos.row}][${pos.col}] (${typeName})`);
});

if (firstEvent.winningGroups && firstEvent.winningGroups.length > 0) {
  console.log(`  Выигрышные группы: ${firstEvent.winningGroups.map(g => `${g.symbolName} (${g.count})`).join(', ')}`);
  console.log(`  Выплата: ${firstEvent.totalPayout}`);
}

if (firstEvent.bombType) {
  console.log(`  Бомба: ${firstEvent.bombType} в [${firstEvent.bombPosition.row}][${firstEvent.bombPosition.col}]`);
}

// Подсчёт скаттеров во всей арке
let totalScattersInArc = 0;
const scatterByEvent = [];
for (const step of scenario) {
  const scatterCount = step.scatterCount || generator.countScatters(step.grid).total;
  totalScattersInArc += scatterCount;
  if (scatterCount > 0) {
    scatterByEvent.push({ event: step.event, count: scatterCount });
  }
}

console.log(`\nОбщая статистика:`);
console.log(`  Всего шагов в сценарии: ${scenario.length}`);
console.log(`  Всего скаттеров за всю арку: ${totalScattersInArc}`);
if (scatterByEvent.length > 0) {
  console.log(`  События со скаттерами:`);
  scatterByEvent.forEach(({ event, count }) => {
    console.log(`    ${event}: ${count}`);
  });
}

// Статистика событий
const eventCounts = {};
scenario.forEach(step => {
  eventCounts[step.event] = (eventCounts[step.event] || 0) + 1;
});

console.log(`\nСтатистика событий:`);
Object.entries(eventCounts).forEach(([event, count]) => {
  console.log(`  ${event}: ${count}`);
});

// Сохраняем сценарий
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const filename = `scenario_3_scatters_${timestamp}.json`;
const scenarioDir = join(__dirname, 'scenario');

// Создаём директорию если её нет
if (!existsSync(scenarioDir)) {
  mkdirSync(scenarioDir, { recursive: true });
}

writeFileSync(join(scenarioDir, filename), formatCompactJSON(scenario));
console.log(`\n✓ Сценарий сохранен: scenario/${filename}`);
