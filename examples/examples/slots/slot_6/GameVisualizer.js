/**
 * GameVisualizer - схематичная визуализация игры slot_6
 * Отрисовывает игру на квадратах без Spine анимаций
 */

import { CONFIG, getSymbolType, getWinAmount, getMultiplierValue } from './config.js';

export class GameVisualizer {
  constructor(config = {}) {
    this.container = config.container; // PIXI контейнер
    this.app = config.app; // PixiJS приложение
    
    this.SYMBOL_SIZE = CONFIG.SYMBOL_SIZE;
    this.SYMBOL_SPACING = CONFIG.SYMBOL_SPACING;
    this.STACK_ROWS = CONFIG.STACK_ROWS;
    this.STACK_COLS = CONFIG.STACK_COLS;
    this.FIELD_SIZE = CONFIG.FIELD_SIZE;
    
    // Хранилище графических элементов
    this.stackSprites = []; // [row][col] = PIXI.Graphics
    this.fieldSprites = []; // [index] = PIXI.Graphics
    this.selectionFrame = null; // Красная рамка выбора
    this.multiplierSprites = []; // Массив спрайтов множителей
    this.resultText = null; // Текст результата
    
    this.stepDelay = config.stepDelay || CONFIG.VISUALIZATION.STEP_DELAY;
    this.isPaused = false;
    this.isStopped = false;
    
    this.init();
  }

  /**
   * Инициализация визуализатора
   */
  init() {
    this.clear();
    this.initStack();
    this.initField();
    this.initSelectionFrame();
    this.initMultipliers();
    this.initResult();
  }

  /**
   * Инициализация стека (4x3 сетка)
   */
  initStack() {
    this.stackSprites = [];
    for (let row = 0; row < this.STACK_ROWS; row++) {
      this.stackSprites[row] = [];
      for (let col = 0; col < this.STACK_COLS; col++) {
        this.stackSprites[row][col] = null;
      }
    }
  }

  /**
   * Инициализация игрового поля (3 символа)
   */
  initField() {
    this.fieldSprites = [];
    for (let i = 0; i < this.FIELD_SIZE; i++) {
      this.fieldSprites[i] = null;
    }
  }

  /**
   * Инициализация красной рамки выбора
   */
  initSelectionFrame() {
    if (this.selectionFrame) {
      this.container.removeChild(this.selectionFrame);
    }
    this.selectionFrame = new PIXI.Graphics();
    this.selectionFrame.visible = false;
    this.container.addChild(this.selectionFrame);
  }

  /**
   * Инициализация области множителей
   */
  initMultipliers() {
    this.clearMultipliers();
  }

  /**
   * Инициализация текста результата
   */
  initResult() {
    if (this.resultText) {
      this.container.removeChild(this.resultText);
    }
    this.resultText = new PIXI.Text('', {
      fontFamily: 'Arial',
      fontSize: CONFIG.VISUALIZATION.TEXT_SIZE,
      fill: CONFIG.COLORS.TEXT,
      align: 'center'
    });
    this.resultText.anchor.set(0.5);
    this.resultText.x = CONFIG.POSITIONS.RESULT_X;
    this.resultText.y = CONFIG.POSITIONS.RESULT_Y;
    this.resultText.visible = false;
    this.container.addChild(this.resultText);
  }

  /**
   * Очистка всех элементов
   */
  clear() {
    this.clearStack();
    this.clearField();
    this.clearMultipliers();
    if (this.selectionFrame) {
      this.selectionFrame.visible = false;
    }
    if (this.resultText) {
      this.resultText.visible = false;
    }
  }

  /**
   * Очистка стека
   */
  clearStack() {
    for (let row = 0; row < this.STACK_ROWS; row++) {
      for (let col = 0; col < this.STACK_COLS; col++) {
        if (this.stackSprites[row] && this.stackSprites[row][col]) {
          this.container.removeChild(this.stackSprites[row][col]);
          this.stackSprites[row][col].destroy();
          this.stackSprites[row][col] = null;
        }
      }
    }
  }

  /**
   * Очистка игрового поля
   */
  clearField() {
    for (let i = 0; i < this.FIELD_SIZE; i++) {
      if (this.fieldSprites[i]) {
        this.container.removeChild(this.fieldSprites[i]);
        this.fieldSprites[i].destroy();
        this.fieldSprites[i] = null;
      }
    }
  }

  /**
   * Очистка множителей
   */
  clearMultipliers() {
    this.multiplierSprites.forEach(sprite => {
      this.container.removeChild(sprite);
      sprite.destroy();
    });
    this.multiplierSprites = [];
  }

  /**
   * Создает спрайт символа (квадрат)
   * @param {number} symbolId - ID символа
   * @param {number} x - X позиция
   * @param {number} y - Y позиция
   * @returns {PIXI.Graphics} - Графический элемент
   */
  createSymbolSprite(symbolId, x, y) {
    const symbolType = getSymbolType(symbolId);
    const graphics = new PIXI.Graphics();
    
    // Определяем цвет
    let color = CONFIG.COLORS.BLANK;
    if (symbolType === 'win') {
      color = CONFIG.COLORS.WIN;
    } else if (symbolType === 'multiplier') {
      color = CONFIG.COLORS.MULTIPLIER;
    }
    
    // Рисуем квадрат
    graphics.rect(-this.SYMBOL_SIZE / 2, -this.SYMBOL_SIZE / 2, this.SYMBOL_SIZE, this.SYMBOL_SIZE);
    graphics.fill(color);
    graphics.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.5 });
    
    // Добавляем текст
    let text = '';
    if (symbolType === 'win') {
      text = String(getWinAmount(symbolId));
    } else if (symbolType === 'multiplier') {
      text = `x${getMultiplierValue(symbolId)}`;
    } else {
      text = '';
    }
    
    if (text) {
      const textSprite = new PIXI.Text(text, {
        fontFamily: 'Arial',
        fontSize: 20,
        fill: 0x000000,
        fontWeight: 'bold',
        align: 'center'
      });
      textSprite.anchor.set(0.5);
      graphics.addChild(textSprite);
    }
    
    graphics.x = x;
    graphics.y = y;
    
    return graphics;
  }

  /**
   * Отрисовка стека
   * @param {number[][]} stack - Стек символов [row][col]
   */
  renderStack(stack) {
    this.clearStack();
    
    for (let row = 0; row < this.STACK_ROWS; row++) {
      for (let col = 0; col < this.STACK_COLS; col++) {
        const symbolId = stack[row][col];
        const x = CONFIG.POSITIONS.STACK_START_X + col * (this.SYMBOL_SIZE + this.SYMBOL_SPACING);
        const y = CONFIG.POSITIONS.STACK_START_Y + row * (this.SYMBOL_SIZE + this.SYMBOL_SPACING);
        
        const sprite = this.createSymbolSprite(symbolId, x, y);
        this.stackSprites[row][col] = sprite;
        this.container.addChild(sprite);
      }
    }
  }

  /**
   * Отрисовка игрового поля
   * @param {number[]} field - Массив из 3 символов
   */
  renderField(field) {
    this.clearField();
    this.hideSelectionFrame();
    
    for (let i = 0; i < this.FIELD_SIZE; i++) {
      const symbolId = field[i];
      const x = CONFIG.POSITIONS.FIELD_START_X + i * (this.SYMBOL_SIZE + this.SYMBOL_SPACING);
      const y = CONFIG.POSITIONS.FIELD_Y;
      
      const sprite = this.createSymbolSprite(symbolId, x, y);
      this.fieldSprites[i] = sprite;
      this.container.addChild(sprite);
    }
  }

  /**
   * Отрисовка красной рамки выбора
   * @param {number} index - Индекс выбранного символа (0-2)
   */
  renderSelectionFrame(index) {
    if (index < 0 || index >= this.FIELD_SIZE) {
      this.hideSelectionFrame();
      return;
    }
    
    const x = CONFIG.POSITIONS.FIELD_START_X + index * (this.SYMBOL_SIZE + this.SYMBOL_SPACING);
    const y = CONFIG.POSITIONS.FIELD_Y;
    
    this.selectionFrame.clear();
    this.selectionFrame.rect(
      -this.SYMBOL_SIZE / 2 - CONFIG.VISUALIZATION.FRAME_THICKNESS,
      -this.SYMBOL_SIZE / 2 - CONFIG.VISUALIZATION.FRAME_THICKNESS,
      this.SYMBOL_SIZE + CONFIG.VISUALIZATION.FRAME_THICKNESS * 2,
      this.SYMBOL_SIZE + CONFIG.VISUALIZATION.FRAME_THICKNESS * 2
    );
    this.selectionFrame.stroke({
      width: CONFIG.VISUALIZATION.FRAME_THICKNESS,
      color: CONFIG.COLORS.SELECTION_FRAME,
      alpha: 1.0
    });
    this.selectionFrame.x = x;
    this.selectionFrame.y = y;
    this.selectionFrame.visible = true;
  }

  /**
   * Скрывает красную рамку выбора
   */
  hideSelectionFrame() {
    if (this.selectionFrame) {
      this.selectionFrame.visible = false;
    }
  }

  /**
   * Отрисовка накопленных множителей
   * @param {number[]} multipliers - Массив множителей
   */
  renderMultipliers(multipliers) {
    this.clearMultipliers();
    
    if (!multipliers || multipliers.length === 0) {
      return;
    }
    
    const startY = CONFIG.POSITIONS.MULTIPLIERS_START_Y;
    const spacing = CONFIG.VISUALIZATION.MULTIPLIER_SPACING;
    
    multipliers.forEach((multiplier, index) => {
      const graphics = new PIXI.Graphics();
      graphics.rect(-30, -15, 60, 30);
      graphics.fill(CONFIG.COLORS.MULTIPLIER);
      graphics.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.5 });
      
      const text = new PIXI.Text(`x${multiplier}`, {
        fontFamily: 'Arial',
        fontSize: 18,
        fill: 0x000000,
        fontWeight: 'bold',
        align: 'center'
      });
      text.anchor.set(0.5);
      graphics.addChild(text);
      
      graphics.x = CONFIG.POSITIONS.MULTIPLIERS_X;
      graphics.y = startY + index * spacing;
      
      this.multiplierSprites.push(graphics);
      this.container.addChild(graphics);
    });
  }

  /**
   * Отрисовка результата
   * @param {Object} result - Результат выбора
   */
  renderResult(result) {
    if (!this.resultText) {
      this.initResult();
    }
    
    let text = '';
    if (result.symbolType === 'win') {
      text = `WIN: ${result.totalWin}`;
    } else if (result.symbolType === 'blank') {
      text = 'NO WIN';
    } else if (result.symbolType === 'multiplier') {
      text = `MULTIPLIER x${result.multiplier}`;
    }
    
    this.resultText.text = text;
    this.resultText.visible = true;
  }

  /**
   * Скрывает результат
   */
  hideResult() {
    if (this.resultText) {
      this.resultText.visible = false;
    }
  }

  /**
   * Показывает шаг с задержкой
   * @param {Object} step - Шаг сценария
   * @returns {Promise<boolean>}
   */
  async showStep(step) {
    if (!step) {
      return false;
    }
    
    // Отрисовываем стек и поле
    if (step.stack) {
      this.renderStack(step.stack);
    }
    if (step.field) {
      this.renderField(step.field);
    }
    
    // Обрабатываем разные типы событий
    if (step.event === 'spin') {
      this.hideSelectionFrame();
      this.hideResult();
    } else if (step.event === 'selection') {
      if (step.selectedIndex !== undefined) {
        this.renderSelectionFrame(step.selectedIndex);
      }
      this.hideResult();
    } else if (step.event === 'result') {
      if (step.selectedIndex !== undefined) {
        this.renderSelectionFrame(step.selectedIndex);
      }
      if (step.accumulatedMultipliers) {
        this.renderMultipliers(step.accumulatedMultipliers);
      }
      this.renderResult({
        symbolType: step.symbolType,
        totalWin: step.totalWin || 0,
        multiplier: step.multiplier || 0
      });
    }
    
    // Ждем пока не будет снята пауза
    while (this.isPaused && !this.isStopped) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.isStopped) {
      return false;
    }
    
    // Задержка для визуального восприятия
    await new Promise(resolve => setTimeout(resolve, this.stepDelay));
    
    return true;
  }

  /**
   * Визуализирует весь сценарий пошагово
   * @param {Array} scenario - Массив шагов сценария
   * @param {Function} onStep - Колбэк на каждом шаге (stepIndex, step, totalSteps)
   * @returns {Promise}
   */
  async visualizeScenario(scenario, onStep) {
    this.clear();
    this.isPaused = false;
    this.isStopped = false;
    
    for (let i = 0; i < scenario.length; i++) {
      if (this.isStopped) break;
      
      const step = scenario[i];
      const continueVisualization = await this.showStep(step);
      
      if (!continueVisualization) break;
      
      if (onStep) {
        onStep(i, step, scenario.length);
      }
    }
  }

  /**
   * Устанавливает задержку между шагами
   * @param {number} delayMs - Задержка в миллисекундах
   */
  setStepDelay(delayMs) {
    this.stepDelay = Math.max(0, delayMs);
  }

  /**
   * Пауза/продолжить визуализацию
   */
  togglePause() {
    this.isPaused = !this.isPaused;
    return this.isPaused;
  }

  /**
   * Останавливает визуализацию
   */
  stop() {
    this.isStopped = true;
    this.isPaused = false;
  }

  /**
   * Сброс состояния
   */
  reset() {
    this.isPaused = false;
    this.isStopped = false;
  }
}
