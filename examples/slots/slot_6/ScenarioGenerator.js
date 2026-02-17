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
    this.allWaitingSymbols = null; // Предгенерированные символы для всех спинов
    this.waitingSymbolsRowIndex = this.STACK_ROWS; // Индекс текущего ряда в массиве ожидающих символов
  }

  /**
   * Добавляет "жирные" символы (большие множители или большие числа) в список ожидающих символов
   * через каждые 3-5 спинов
   * @param {number} spinCount - Количество спинов
   */
  addBigSymbolsToWaitingList(spinCount) {
    let nextBigSymbolSpin = Math.floor(Math.random() * 3) + 3; // 3-5 спинов
    let spinCounter = 0;
    
    // Проходим по рядам ожидающих символов (начиная с STACK_ROWS, так как первые ряды - начальный стек)
    for (let row = this.STACK_ROWS; row < this.allWaitingSymbols.length; row++) {
      spinCounter++;
      
      // Если достигли нужного интервала, добавляем "жирный" символ
      if (spinCounter >= nextBigSymbolSpin) {
        // Выбираем случайную позицию в ряду для большого символа
        const bigSymbolCol = Math.floor(Math.random() * this.STACK_COLS);
        
        // Случайно выбираем: большой множитель (70%) или большое число выигрыша (30%)
        const useMultiplier = Math.random() < 0.7;
        
        if (useMultiplier) {
          // Большой множитель: x10 или x11 (ID 19 или 20)
          const bigMultiplierId = CONFIG.SYMBOL_TYPES.MULTIPLIER_MAX - 1 + Math.floor(Math.random() * 2); // 19 или 20
          this.allWaitingSymbols[row][bigSymbolCol] = bigMultiplierId;
        } else {
          // Большое число выигрыша: 8, 9 или 10 (ID 8, 9 или 10)
          const bigWinId = CONFIG.SYMBOL_TYPES.WIN_MAX - 2 + Math.floor(Math.random() * 3); // 8, 9 или 10
          this.allWaitingSymbols[row][bigSymbolCol] = bigWinId;
        }
        
        // Гарантируем, что в ряду все еще есть минимум 1 пустышка
        this.ensureAtLeastOneBlank([this.allWaitingSymbols[row]]);
        
        // Устанавливаем следующий интервал для большого символа
        nextBigSymbolSpin = Math.floor(Math.random() * 3) + 3; // 3-5 спинов
        spinCounter = 0; // Сбрасываем счетчик
      }
    }
  }

  /**
   * Гарантирует наличие минимум 1 пустышки в массиве символов
   * @param {number[]|number[][]} symbols - Массив символов (одномерный или двумерный)
   * @param {number} blankId - ID пустышки (по умолчанию CONFIG.SYMBOL_TYPES.BLANK)
   */
  ensureAtLeastOneBlank(symbols, blankId = CONFIG.SYMBOL_TYPES.BLANK) {
    if (!symbols || symbols.length === 0) return;
    
    // Проверяем, является ли это двумерным массивом (стек)
    const is2D = Array.isArray(symbols[0]) && typeof symbols[0][0] !== 'undefined' && !isNaN(symbols[0][0]);
    
    if (is2D) {
      // Для двумерного массива (стек) - проверяем каждый ряд отдельно
      for (let row = 0; row < symbols.length; row++) {
        if (!symbols[row] || symbols[row].length === 0) continue;
        const rowHasBlank = symbols[row].some(s => s === blankId);
        if (!rowHasBlank) {
          // Случайно выбираем позицию для замены на пустышку в этом ряду
          const randomCol = Math.floor(Math.random() * symbols[row].length);
          symbols[row][randomCol] = blankId;
        }
      }
    } else {
      // Для одномерного массива (поле)
      const hasBlank = symbols.some(s => s === blankId);
      if (!hasBlank && symbols.length > 0) {
        const randomIndex = Math.floor(Math.random() * symbols.length);
        symbols[randomIndex] = blankId;
      }
    }
  }

  /**
   * Гарантирует наличие минимум 1 не-пустышки в каждом ряду стека ожидания
   * @param {number[][]} symbols - Двумерный массив символов (стек)
   * @param {number} blankId - ID пустышки (по умолчанию CONFIG.SYMBOL_TYPES.BLANK)
   */
  ensureAtLeastOneNonBlank(symbols, blankId = CONFIG.SYMBOL_TYPES.BLANK) {
    if (!symbols || symbols.length === 0) return;
    
    for (let row = 0; row < symbols.length; row++) {
      if (!symbols[row] || symbols[row].length === 0) continue;
      
      // Проверяем, есть ли хотя бы один не-пустышка в ряду
      const hasNonBlank = symbols[row].some(s => s !== blankId);
      
      if (!hasNonBlank) {
        // Если весь ряд состоит из пустышек, заменяем одну на случайный символ
        const randomCol = Math.floor(Math.random() * symbols[row].length);
        symbols[row][randomCol] = generateRandomSymbol();
      }
    }
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
    // Гарантируем минимум 1 пустышку в каждом ряду стека
    this.ensureAtLeastOneBlank(stack);
    // Гарантируем минимум 1 не-пустышку в каждом ряду стека
    this.ensureAtLeastOneNonBlank(stack);
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
    // Гарантируем минимум 1 пустышку на поле
    this.ensureAtLeastOneBlank(field);
    return field;
  }

  /**
   * Сдвигает символы из стека на игровое поле
   * Берет нижний ряд стека (row 3) и заменяет символы на поле
   * Сдвигает стек вниз и добавляет новый верхний ряд из предгенерированных символов
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
    
    // Добавляем новый верхний ряд (row 0) из предгенерированных символов
    if (this.allWaitingSymbols && this.waitingSymbolsRowIndex < this.allWaitingSymbols.length) {
      newStack[0] = [...this.allWaitingSymbols[this.waitingSymbolsRowIndex]];
      this.waitingSymbolsRowIndex++;
    } else {
      // Fallback: если предгенерированных символов нет, генерируем случайно
      newStack[0] = [];
      for (let col = 0; col < this.STACK_COLS; col++) {
        newStack[0][col] = generateRandomSymbol();
      }
      // Гарантируем минимум 1 пустышку в новом ряду
      this.ensureAtLeastOneBlank([newStack[0]]);
    }
    
    // Гарантируем минимум 1 пустышку во всем стеке после сдвига
    this.ensureAtLeastOneBlank(newStack);
    // Гарантируем минимум 1 не-пустышку в каждом ряду стека после сдвига
    this.ensureAtLeastOneNonBlank(newStack);
    
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
    
    // Предгенерируем все ожидающие символы для всех спинов
    const totalRows = this.STACK_ROWS + spinCount;
    this.allWaitingSymbols = [];
    for (let row = 0; row < totalRows; row++) {
      this.allWaitingSymbols[row] = [];
      for (let col = 0; col < this.STACK_COLS; col++) {
        this.allWaitingSymbols[row][col] = generateRandomSymbol();
      }
      // Гарантируем минимум 1 пустышку в каждом ряду
      this.ensureAtLeastOneBlank([this.allWaitingSymbols[row]]);
      // Гарантируем минимум 1 не-пустышку в каждом ряду (чтобы не было полностью пустых рядов)
      this.ensureAtLeastOneNonBlank([this.allWaitingSymbols[row]]);
    }
    
    // Добавляем "жирные" символы (большие множители или большие числа) через каждые 3-5 спинов
    this.addBigSymbolsToWaitingList(spinCount);
    
    // Финальная проверка: гарантируем минимум 1 не-пустышку во всех рядах после всех изменений
    this.ensureAtLeastOneNonBlank(this.allWaitingSymbols);
    
    // Генерируем начальный стек из первых STACK_ROWS рядов предгенерированных символов
    let currentStack = [];
    for (let row = 0; row < this.STACK_ROWS; row++) {
      currentStack[row] = [...this.allWaitingSymbols[row]];
    }
    
    // Генерируем начальное поле
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
