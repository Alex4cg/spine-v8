/**
 * ScenarioGenerator - генератор сценариев для slot_6
 * Генерирует последовательность шагов игры: spin → selection → result
 */

import {
  CONFIG,
  generateRandomSymbol,
  getSymbolType,
  getWinAmount,
  getMultiplierValue,
  calculateTotalWin
} from './config.js';

export class ScenarioGenerator {
  constructor(config = {}) {
    this.STACK_ROWS = config.stackRows || CONFIG.STACK_ROWS;
    this.STACK_COLS = config.stackCols || CONFIG.STACK_COLS;
    this.FIELD_SIZE = config.fieldSize || CONFIG.FIELD_SIZE;
    this.randomSelection = config.randomSelection !== undefined ? config.randomSelection : CONFIG.GENERATION.RANDOM_SELECTION;
    
    this.reset();
  }

  /**
   * Сброс состояния генератора
   */
  reset() {
    this.scenario = [];
    this.accumulatedMultipliers = []; // Накопленные множители между спинами
  }

  /**
   * Генерирует случайный стек (4x3 сетка)
   * @returns {number[][]} - Стек символов [row][col]
   */
  generateRandomStack() {
    const stack = [];
    for (let row = 0; row < this.STACK_ROWS; row++) {
      stack[row] = [];
      for (let col = 0; col < this.STACK_COLS; col++) {
        stack[row][col] = generateRandomSymbol();
      }
    }
    return stack;
  }

  /**
   * Генерирует начальное игровое поле (3 символа)
   * @returns {number[]} - Массив из 3 символов
   */
  generateGameField() {
    const field = [];
    for (let i = 0; i < this.FIELD_SIZE; i++) {
      field[i] = generateRandomSymbol();
    }
    return field;
  }

  /**
   * Сдвигает символы из стека на игровое поле
   * Берет нижний ряд стека (row 3) и заменяет символы на поле
   * Сдвигает стек вниз и добавляет новый верхний ряд
   * @param {number[][]} stack - Текущий стек
   * @param {number[]} field - Текущее игровое поле
   * @returns {{stack: number[][], field: number[]}} - Новый стек и поле
   */
  shiftSymbols(stack, field) {
    // Копируем стек
    const newStack = stack.map(row => [...row]);
    
    // Берем нижний ряд стека (последний row)
    const bottomRow = newStack[this.STACK_ROWS - 1].slice();
    
    // Заменяем символы на игровом поле
    const newField = bottomRow.slice();
    
    // Сдвигаем стек вниз (row 2→3, row 1→2, row 0→1)
    for (let row = this.STACK_ROWS - 1; row > 0; row--) {
      newStack[row] = newStack[row - 1].slice();
    }
    
    // Добавляем новый верхний ряд (row 0)
    newStack[0] = [];
    for (let col = 0; col < this.STACK_COLS; col++) {
      newStack[0][col] = generateRandomSymbol();
    }
    
    return { stack: newStack, field: newField };
  }

  /**
   * Выбирает символ на игровом поле (красная рамка)
   * @param {number[]} field - Игровое поле
   * @returns {number} - Индекс выбранного символа (0-2)
   */
  selectSymbol(field) {
    if (this.randomSelection) {
      return Math.floor(Math.random() * this.FIELD_SIZE);
    }
    return 0; // Всегда первый символ
  }

  /**
   * Обрабатывает выбор символа
   * @param {number} selectedSymbol - ID выбранного символа
   * @param {number[]} accumulatedMultipliers - Накопленные множители
   * @returns {{symbolType: string, winAmount: number, multiplier: number, totalWin: number, newMultipliers: number[]}}
   */
  processSelection(selectedSymbol, accumulatedMultipliers) {
    const symbolType = getSymbolType(selectedSymbol);
    let winAmount = 0;
    let multiplier = 0;
    let totalWin = 0;
    let newMultipliers = [...accumulatedMultipliers];
    
    if (symbolType === 'blank') {
      // Пустышка - сбрасываем множители
      newMultipliers = [];
      totalWin = 0;
    } else if (symbolType === 'win') {
      // Выигрыш - применяем множители
      winAmount = getWinAmount(selectedSymbol);
      totalWin = calculateTotalWin(winAmount, accumulatedMultipliers);
      // После применения множители сбрасываются
      newMultipliers = [];
    } else if (symbolType === 'multiplier') {
      // Множитель - добавляем в накопленные
      multiplier = getMultiplierValue(selectedSymbol);
      newMultipliers.push(multiplier);
      totalWin = 0;
    }
    
    return {
      symbolType,
      winAmount,
      multiplier,
      totalWin,
      newMultipliers
    };
  }

  /**
   * Генерирует один спин со всеми шагами
   * @param {number[][]} currentStack - Текущий стек
   * @param {number[]} currentField - Текущее игровое поле
   * @param {number} spinIndex - Номер спина в сценарии
   * @returns {Array} - Массив шагов спина [spin, selection, result]
   */
  generateSpin(currentStack, currentField, spinIndex) {
    const steps = [];
    let stepIndex = this.scenario.length;
    
    // ШАГ 1: Spin - сдвиг символов из стека на поле
    const { stack: newStack, field: newField } = this.shiftSymbols(currentStack, currentField);
    
    steps.push({
      event: 'spin',
      stack: newStack.map(row => [...row]),
      field: [...newField],
      spinIndex,
      stepIndex: stepIndex++
    });
    
    // ШАГ 2: Selection - выбор символа красной рамкой
    const selectedIndex = this.selectSymbol(newField);
    const selectedSymbol = newField[selectedIndex];
    
    steps.push({
      event: 'selection',
      stack: newStack.map(row => [...row]),
      field: [...newField],
      selectedIndex,
      selectedSymbol,
      spinIndex,
      stepIndex: stepIndex++
    });
    
    // ШАГ 3: Result - обработка результата
    const result = this.processSelection(selectedSymbol, this.accumulatedMultipliers);
    
    // Обновляем накопленные множители
    this.accumulatedMultipliers = result.newMultipliers;
    
    steps.push({
      event: 'result',
      stack: newStack.map(row => [...row]),
      field: [...newField],
      selectedIndex,
      selectedSymbol,
      symbolType: result.symbolType,
      winAmount: result.winAmount,
      multiplier: result.multiplier,
      accumulatedMultipliers: [...this.accumulatedMultipliers],
      totalWin: result.totalWin,
      spinIndex,
      stepIndex: stepIndex++
    });
    
    return {
      steps,
      nextStack: newStack,
      nextField: newField
    };
  }

  /**
   * Генерирует полный сценарий из N спинов
   * @param {number} spinCount - Количество спинов
   * @returns {Array} - Массив всех шагов сценария
   */
  generateScenario(spinCount = CONFIG.GENERATION.DEFAULT_SPIN_COUNT) {
    this.reset();
    
    // Генерируем начальный стек и поле
    let currentStack = this.generateRandomStack();
    let currentField = this.generateGameField();
    
    // Генерируем каждый спин
    for (let spinIndex = 0; spinIndex < spinCount; spinIndex++) {
      const { steps, nextStack, nextField } = this.generateSpin(
        currentStack,
        currentField,
        spinIndex
      );
      
      // Добавляем шаги в сценарий
      this.scenario.push(...steps);
      
      // Обновляем состояние для следующего спина
      currentStack = nextStack;
      currentField = nextField;
    }
    
    return this.scenario;
  }

  /**
   * Экспортирует сценарий в JSON формат
   * @returns {string} - JSON строка
   */
  exportToJSON() {
    return JSON.stringify(this.scenario, null, 2);
  }

  /**
   * Форматирует сценарий в компактный JSON (каждое событие на одной строке)
   * @returns {string} - Компактный JSON
   */
  formatCompactJSON() {
    const lines = ['['];
    for (let i = 0; i < this.scenario.length; i++) {
      const eventJson = JSON.stringify(this.scenario[i]);
      lines.push(`  ${eventJson}${i < this.scenario.length - 1 ? ',' : ''}`);
    }
    lines.push(']');
    return lines.join('\n');
  }

  /**
   * Сохраняет сценарий в файл (для Node.js окружения)
   * @param {string} filepath - Путь к файлу
   */
  saveToFile(filepath) {
    if (typeof window === 'undefined') {
      // Node.js окружение
      const fs = require('fs');
      fs.writeFileSync(filepath, this.formatCompactJSON(), 'utf8');
    } else {
      // Браузерное окружение - скачивание файла
      const content = this.formatCompactJSON();
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filepath.endsWith('.json') ? filepath : `${filepath}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Загружает сценарий из JSON
   * @param {string|Array} jsonData - JSON строка или массив шагов
   */
  loadScenario(jsonData) {
    if (typeof jsonData === 'string') {
      this.scenario = JSON.parse(jsonData);
    } else {
      this.scenario = jsonData;
    }
    
    // Восстанавливаем накопленные множители из последнего шага
    if (this.scenario.length > 0) {
      const lastStep = this.scenario[this.scenario.length - 1];
      if (lastStep.accumulatedMultipliers) {
        this.accumulatedMultipliers = [...lastStep.accumulatedMultipliers];
      }
    }
  }

  /**
   * Получает статистику сценария
   * @returns {Object} - Статистика
   */
  getStatistics() {
    const stats = {
      totalSteps: this.scenario.length,
      totalSpins: 0,
      totalWins: 0,
      totalBlanks: 0,
      totalMultipliers: 0,
      totalWinAmount: 0,
      maxMultipliers: 0,
      multipliersUsed: 0
    };
    
    this.scenario.forEach(step => {
      if (step.event === 'result') {
        stats.totalSpins++;
        
        if (step.symbolType === 'win') {
          stats.totalWins++;
          stats.totalWinAmount += step.totalWin;
        } else if (step.symbolType === 'blank') {
          stats.totalBlanks++;
        } else if (step.symbolType === 'multiplier') {
          stats.totalMultipliers++;
        }
        
        if (step.accumulatedMultipliers) {
          stats.maxMultipliers = Math.max(stats.maxMultipliers, step.accumulatedMultipliers.length);
          if (step.symbolType === 'win' && step.accumulatedMultipliers.length > 0) {
            stats.multipliersUsed += step.accumulatedMultipliers.length;
          }
        }
      }
    });
    
    return stats;
  }
}
