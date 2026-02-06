/**
 * ScenarioVisualizer - визуализация процесса генерации сценария
 * Рисует сетку на экране и показывает каждый шаг (спин → каскады) без анимации
 */
export class ScenarioVisualizer {
  constructor(config) {
    this.container = config.container; // PIXI контейнер для символов
    this.symbolTextures = config.symbolTextures;
    this.gridPositions = config.gridPositions; // [col][row] = {x, y}
    this.GRID_COLS = config.gridCols || 6;
    this.GRID_ROWS = config.gridRows || 5;
    this.SYMBOL_SIZE = config.symbolSize || 112;
    this.SYMBOL_TEXTURE_SIZE = config.symbolTextureSize || 112;
    
    // Хранилище спрайтов: [row][col] = PIXI.Sprite
    this.sprites = [];
    this.stepDelay = config.stepDelay || 300; // Задержка между шагами (мс)
    this.isPaused = false;
    this.isStopped = false;
    
    this.initSprites();
  }

  /**
   * Инициализирует пустую сетку спрайтов
   */
  initSprites() {
    // Очищаем старые спрайты
    this.clear();
    
    // Создаем массив спрайтов
    for (let row = 0; row < this.GRID_ROWS; row++) {
      this.sprites[row] = [];
      for (let col = 0; col < this.GRID_COLS; col++) {
        this.sprites[row][col] = null;
      }
    }
  }

  /**
   * Очищает все спрайты
   */
  clear() {
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        if (this.sprites[row] && this.sprites[row][col]) {
          this.container.removeChild(this.sprites[row][col]);
          this.sprites[row][col].destroy();
          this.sprites[row][col] = null;
        }
      }
    }
  }

  /**
   * Обновляет визуализацию сетки
   * @param {number[][]} grid - Сетка [row][col] с индексами символов (0-7)
   * @param {Set<string>} winningPositions - Опционально: позиции выигрышных символов для подсветки
   */
  updateGrid(grid, winningPositions = null) {
    for (let row = 0; row < this.GRID_ROWS; row++) {
      for (let col = 0; col < this.GRID_COLS; col++) {
        const symbolIndex = grid[row][col];
        const position = this.gridPositions[col][row]; // gridPositions[col][row]
        const isWinning = winningPositions && winningPositions.has(`${row},${col}`);
        
        if (symbolIndex >= 0 && symbolIndex < this.symbolTextures.length) {
          // Создаем или обновляем спрайт
          if (!this.sprites[row][col]) {
            this.sprites[row][col] = new PIXI.Sprite(this.symbolTextures[symbolIndex]);
            this.sprites[row][col].anchor.set(0.5);
            
            // Масштабирование
            const originalWidth = this.sprites[row][col].texture.width;
            const originalHeight = this.sprites[row][col].texture.height;
            const scaleX = this.SYMBOL_TEXTURE_SIZE / originalWidth;
            const scaleY = this.SYMBOL_TEXTURE_SIZE / originalHeight;
            const uniformScale = Math.min(scaleX, scaleY);
            this.sprites[row][col].scale.set(uniformScale, uniformScale);
            
            this.sprites[row][col].x = position.x;
            this.sprites[row][col].y = position.y;
            this.sprites[row][col].zIndex = 100;
            
            // Добавляем рамку для выигрышных символов
            if (isWinning) {
              const border = new PIXI.Graphics();
              border.rect(-this.SYMBOL_SIZE/2, -this.SYMBOL_SIZE/2, this.SYMBOL_SIZE, this.SYMBOL_SIZE);
              border.stroke({ width: 3, color: 0xFF0000, alpha: 1.0 });
              border.zIndex = 200;
              this.sprites[row][col].addChild(border);
            }
            
            this.container.addChild(this.sprites[row][col]);
          } else {
            // Обновляем текстуру и позицию
            this.sprites[row][col].texture = this.symbolTextures[symbolIndex];
            this.sprites[row][col].x = position.x;
            this.sprites[row][col].y = position.y;
            this.sprites[row][col].visible = true;
            
            // Обновляем рамку выигрыша
            const existingBorder = this.sprites[row][col].children.find(child => child instanceof PIXI.Graphics);
            if (isWinning && !existingBorder) {
              const border = new PIXI.Graphics();
              border.rect(-this.SYMBOL_SIZE/2, -this.SYMBOL_SIZE/2, this.SYMBOL_SIZE, this.SYMBOL_SIZE);
              border.stroke({ width: 3, color: 0xFF0000, alpha: 1.0 });
              border.zIndex = 200;
              this.sprites[row][col].addChild(border);
            } else if (!isWinning && existingBorder) {
              this.sprites[row][col].removeChild(existingBorder);
              existingBorder.destroy();
            }
          }
        } else {
          // Скрываем спрайт если символ удален или невалидный
          if (this.sprites[row][col]) {
            this.sprites[row][col].visible = false;
          }
        }
      }
    }
  }

  /**
   * Показывает шаг с задержкой
   * @param {number[][]} grid - Сетка для отображения
   * @param {string} eventType - Тип события ('spin' или 'cascade')
   * @param {Set<string>} winningPositions - Опционально: позиции выигрышных символов
   * @returns {Promise}
   */
  async showStep(grid, eventType, winningPositions = null) {
    this.updateGrid(grid, winningPositions);
    
    // Ждем пока не будет снята пауза
    while (this.isPaused && !this.isStopped) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (this.isStopped) {
      return false; // Прервано
    }
    
    // Небольшая задержка для визуального восприятия
    await new Promise(resolve => setTimeout(resolve, this.stepDelay));
    
    return true; // Продолжаем
  }

  /**
   * Визуализирует весь процесс генерации сценария
   * @param {Array<{event: string, grid: number[][]}>} scenario - Массив шагов сценария
   * @param {Function} onStep - Колбэк вызываемый на каждом шаге (stepIndex, step, totalSteps)
   * @returns {Promise}
   */
  async visualizeScenario(scenario, onStep) {
    this.clear();
    this.isPaused = false;
    this.isStopped = false;
    
    for (let i = 0; i < scenario.length; i++) {
      if (this.isStopped) break;
      
      const step = scenario[i];
      const continueVisualization = await this.showStep(step.grid, step.event);
      
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
