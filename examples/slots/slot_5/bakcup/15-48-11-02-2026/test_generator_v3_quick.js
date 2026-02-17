/**
 * Быстрый тест ScenarioGeneratorV3
 * Запуск: node test_generator_v3_quick.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Простая реализация ScenarioGeneratorV3 для тестирования
class ScenarioGeneratorV3 {
  constructor(config) {
    this.GRID_COLS = config.gridCols || 6;
    this.GRID_ROWS = config.gridRows || 5;
    this.minSymbolsForWin = config.minSymbolsForWin || 7;
    this.symbolCount = config.symbolCount || 8;
    this.payoutsConfig = config.payoutsConfig || null;
    
    this.symbolNames = config.symbolNames || [
      'h1_lion', 'h2_bull', 'h3_bear', 'h4_wolf',
      'l1_revolver', 'l2_bottle', 'l3_horseshoe', 'l4_cactus'
    ];
    
    this.BOMB_SYMBOL_TYPE = config.bombSymbolType || 8;
    this.bombMultiplier = config.bombMultiplier || 5;
    this.bombSpinChance = config.bombSpinChance || 0.03;
    this.bombRefillChance = config.bombRefillChance || 0.01;
    
    this.reset();
  }

  reset() {
    this.scenario = [];
  }

  generateRandomGrid(allowBomb = true) {
    const grid = [];
    let bombPlaced = false;
    
    for (let row = 0; row < this.GRID_ROWS; row++) {
      grid[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        if (allowBomb && !bombPlaced && Math.random() < this.bombSpinChance) {
          grid[row][col] = this.BOMB_SYMBOL_TYPE;
          bombPlaced = true;
        } else {
          grid[row][col] = Math.floor(Math.random() * this.symbolCount);
        }
      }
    }
    
    return grid;
  }

  countSymbols(grid) {
    const counts = new Map();
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbol = grid[row][col];
        if (symbol !== this.BOMB_SYMBOL_TYPE && symbol >= 0) {
          counts.set(symbol, (counts.get(symbol) || 0) + 1);
        }
      }
    }
    return counts;
  }

  findWinningGroups(grid) {
    const counts = this.countSymbols(grid);
    const groups = [];
    let groupId = 1;
    
    for (const [symbolType, count] of counts.entries()) {
      if (count >= this.minSymbolsForWin) {
        groups.push({
          symbolType,
          count,
          groupId: groupId++,
          symbolName: this.symbolNames[symbolType] || `symbol_${symbolType}`
        });
      }
    }
    
    return groups.sort((a, b) => a.symbolType - b.symbolType);
  }

  createGroupMarkup(grid, winningGroups) {
    const markup = [];
    const symbolToGroupId = new Map();
    
    for (const group of winningGroups) {
      symbolToGroupId.set(group.symbolType, group.groupId);
    }
    
    for (let row = 0; row < this.GRID_ROWS; row++) {
      markup[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbol = grid[row][col];
        markup[row][col] = symbolToGroupId.get(symbol) || 0;
      }
    }
    
    return markup;
  }

  findBombPosition(grid) {
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        if (grid[row][col] === this.BOMB_SYMBOL_TYPE) {
          return { row, col };
        }
      }
    }
    return null;
  }

  findBombNeighbors(row, col) {
    const neighbors = [];
    const directions = [
      { dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
      { dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }
    ];
    
    for (const { dr, dc } of directions) {
      const newRow = row + dr;
      const newCol = col + dc;
      if (newRow >= 0 && newRow < this.GRID_ROWS && 
          newCol >= 0 && newCol < this.GRID_COLS) {
        neighbors.push({ row: newRow, col: newCol });
      }
    }
    
    return neighbors;
  }

  findWinningPositions(grid, winningGroups) {
    const winning = new Set();
    
    for (const group of winningGroups) {
      const symbolType = group.symbolType;
      for (let row = 0; row < this.GRID_ROWS; row++) {
        for (let col = 0; col < this.GRID_COLS; col++) {
          if (grid[row][col] === symbolType) {
            winning.add(`${row},${col}`);
          }
        }
      }
    }
    
    return winning;
  }

  removeSymbols(grid, positions) {
    const next = [];
    for (let row = 0; row < this.GRID_ROWS; row++) {
      next[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        next[row][col] = positions.has(`${row},${col}`) ? -1 : grid[row][col];
      }
    }
    return next;
  }

  compactColumns(grid) {
    const compacted = [];
    const emptySpots = [];
    
    for (let col = 0; col < this.GRID_COLS; col++) {
      const symbolsInColumn = [];
      for (let row = this.GRID_ROWS - 1; row >= 0; row--) {
        if (grid[row][col] >= 0) {
          symbolsInColumn.push(grid[row][col]);
        }
      }
      
      let symbolIndex = 0;
      for (let row = this.GRID_ROWS - 1; row >= 0; row--) {
        if (symbolIndex < symbolsInColumn.length) {
          compacted[row] = compacted[row] || [];
          compacted[row][col] = symbolsInColumn[symbolIndex++];
        } else {
          compacted[row] = compacted[row] || [];
          compacted[row][col] = -1;
          emptySpots.push({ row, col });
        }
      }
    }
    
    return { grid: compacted, emptySpots };
  }

  fillEmptySpots(grid, emptySpots, getNextSymbol, bombAlreadyUsed) {
    const filled = grid.map(row => row.slice());
    
    emptySpots.sort((a, b) => {
      if (a.col !== b.col) return a.col - b.col;
      return a.row - b.row;
    });
    
    const hasBombAfterCompact = this.findBombPosition(grid) !== null;
    
    for (let i = 0; i < emptySpots.length; i++) {
      const { row, col } = emptySpots[i];
      
      if (!bombAlreadyUsed && !hasBombAfterCompact && Math.random() < this.bombRefillChance) {
        filled[row][col] = this.BOMB_SYMBOL_TYPE;
        bombAlreadyUsed = true;
      } else {
        filled[row][col] = getNextSymbol(i);
      }
    }
    
    return { grid: filled, bombUsed: bombAlreadyUsed };
  }

  calculatePayouts(winningGroups) {
    if (!this.payoutsConfig) {
      return { payouts: [], totalPayout: 0 };
    }
    
    const payouts = [];
    let totalPayout = 0;
    
    for (const group of winningGroups) {
      if (group.symbolType === this.BOMB_SYMBOL_TYPE) continue;
      
      const countStr = String(group.count);
      const payout = this.payoutsConfig.payouts?.[countStr]?.[group.symbolName];
      
      if (payout !== undefined) {
        payouts.push({
          symbolType: group.symbolType,
          symbolName: group.symbolName,
          count: group.count,
          payout
        });
        totalPayout += payout;
      }
    }
    
    return { payouts, totalPayout };
  }

  createEvent(grid, eventType, winningGroups, bombPosition, bombAlreadyUsed) {
    const groupMarkup = this.createGroupMarkup(grid, winningGroups);
    const { payouts, totalPayout } = this.calculatePayouts(winningGroups);
    
    const event = {
      event: eventType,
      grid: grid.map(row => row.slice()),
      groupMarkup: groupMarkup.map(row => row.slice()),
      winningGroups: winningGroups.map(g => ({ ...g })),
      payouts: payouts.map(p => ({ ...p })),
      totalPayout: totalPayout
    };
    
    if (bombPosition) {
      if (winningGroups.length > 0) {
        event.bombType = 'multiplier';
        event.bombPosition = { ...bombPosition };
        event.multiplier = this.bombMultiplier;
        event.totalPayout = totalPayout * this.bombMultiplier;
      } else {
        event.bombType = 'explode';
        event.bombPosition = { ...bombPosition };
        const neighbors = this.findBombNeighbors(bombPosition.row, bombPosition.col);
        event.explodedPositions = [{ ...bombPosition }, ...neighbors].map(p => ({ ...p }));
      }
    }
    
    return event;
  }

  generateSpinWithCascades(getSpinGrid, getRefillSymbol) {
    const steps = [];
    let currentGrid = getSpinGrid();
    let bombAlreadyUsed = false;
    
    let winningGroups = this.findWinningGroups(currentGrid);
    let bombPosition = this.findBombPosition(currentGrid);
    
    let spinEventType;
    if (winningGroups.length > 0 && bombPosition) {
      spinEventType = 'spin-win-bomb';
    } else if (winningGroups.length > 0) {
      spinEventType = 'spin-win';
    } else if (bombPosition) {
      spinEventType = 'spin-bomb';
    } else {
      spinEventType = 'spin';
    }
    
    const spinEvent = this.createEvent(currentGrid, spinEventType, winningGroups, bombPosition, bombAlreadyUsed);
    steps.push(spinEvent);
    
    if (winningGroups.length === 0 && !bombPosition) {
      return steps;
    }
    
    if (bombPosition && winningGroups.length === 0) {
      const neighbors = this.findBombNeighbors(bombPosition.row, bombPosition.col);
      const explodePositions = new Set([`${bombPosition.row},${bombPosition.col}`]);
      neighbors.forEach(pos => explodePositions.add(`${pos.row},${pos.col}`));
      
      currentGrid = this.removeSymbols(currentGrid, explodePositions);
      bombAlreadyUsed = true;
    }
    
    if (winningGroups.length > 0) {
      const winningPositions = this.findWinningPositions(currentGrid, winningGroups);
      
      if (bombPosition) {
        winningPositions.add(`${bombPosition.row},${bombPosition.col}`);
        bombAlreadyUsed = true;
      }
      
      currentGrid = this.removeSymbols(currentGrid, winningPositions);
    }
    
    const { grid: compacted, emptySpots } = this.compactColumns(currentGrid);
    
    const { grid: filled, bombUsed } = this.fillEmptySpots(
      compacted, 
      emptySpots, 
      (refillIndex) => getRefillSymbol(0, refillIndex),
      bombAlreadyUsed
    );
    bombAlreadyUsed = bombUsed;
    currentGrid = filled;
    
    winningGroups = this.findWinningGroups(currentGrid);
    bombPosition = this.findBombPosition(currentGrid);
    
    if (winningGroups.length === 0 && !bombPosition) {
      const cascadeEvent = this.createEvent(currentGrid, 'cascade', [], null, bombAlreadyUsed);
      steps.push(cascadeEvent);
      return steps;
    }
    
    let cascadeStepIndex = 1;
    
    while (true) {
      let cascadeEventType;
      if (winningGroups.length > 0 && bombPosition) {
        cascadeEventType = 'cascade-win-bomb';
      } else if (winningGroups.length > 0) {
        cascadeEventType = 'cascade-win';
      } else if (bombPosition) {
        cascadeEventType = 'cascade-bomb';
      } else {
        cascadeEventType = 'cascade';
      }
      
      const cascadeEvent = this.createEvent(currentGrid, cascadeEventType, winningGroups, bombPosition, bombAlreadyUsed);
      steps.push(cascadeEvent);
      
      if (winningGroups.length === 0 && !bombPosition) {
        break;
      }
      
      if (bombPosition && winningGroups.length === 0) {
        const neighbors = this.findBombNeighbors(bombPosition.row, bombPosition.col);
        const explodePositions = new Set([`${bombPosition.row},${bombPosition.col}`]);
        neighbors.forEach(pos => explodePositions.add(`${pos.row},${pos.col}`));
        
        currentGrid = this.removeSymbols(currentGrid, explodePositions);
        bombAlreadyUsed = true;
      }
      
      if (winningGroups.length > 0) {
        const winningPositions = this.findWinningPositions(currentGrid, winningGroups);
        
        if (bombPosition) {
          winningPositions.add(`${bombPosition.row},${bombPosition.col}`);
          bombAlreadyUsed = true;
        }
        
        currentGrid = this.removeSymbols(currentGrid, winningPositions);
      }
      
      const { grid: compacted2, emptySpots: emptySpots2 } = this.compactColumns(currentGrid);
      
      const { grid: filled2, bombUsed: bombUsed2 } = this.fillEmptySpots(
        compacted2,
        emptySpots2,
        (refillIndex) => getRefillSymbol(cascadeStepIndex, refillIndex),
        bombAlreadyUsed
      );
      bombAlreadyUsed = bombUsed2;
      currentGrid = filled2;
      
      winningGroups = this.findWinningGroups(currentGrid);
      bombPosition = this.findBombPosition(currentGrid);
      
      cascadeStepIndex++;
    }
    
    return steps;
  }

  generateScenario(spinCount) {
    this.reset();
    
    for (let i = 0; i < spinCount; i++) {
      const steps = this.generateSpinWithCascades(
        () => this.generateRandomGrid(),
        (cascadeStepIndex, refillIndex) => Math.floor(Math.random() * this.symbolCount)
      );
      this.scenario.push(...steps);
    }
    
    return this.scenario;
  }
}

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

// Сохраняем сценарий
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const filename = `scenario_${timestamp}.json`;
const fs = await import('fs');
fs.writeFileSync(join(__dirname, 'scenario', filename), JSON.stringify(scenario, null, 2));
console.log(`\n✓ Сценарий сохранен: scenario/${filename}`);
