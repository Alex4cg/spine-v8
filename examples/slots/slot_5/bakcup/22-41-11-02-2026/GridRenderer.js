/**
 * Утилиты для отрисовки сетки и визуальных элементов
 */
export class GridRenderer {
  /**
   * Создает фон игрового поля
   * @param {number} startX - Начальная X координата
   * @param {number} startY - Начальная Y координата
   * @param {number} cols - Количество колонок
   * @param {number} rows - Количество рядов
   * @param {number} symbolSize - Размер символа
   * @param {number} padding - Отступ вокруг поля
   * @param {number} cornerRadius - Радиус скругления углов
   * @returns {PIXI.Graphics} Графический объект фона
   */
  static createGameFieldBackground(startX, startY, cols, rows, symbolSize, padding = 20, cornerRadius = 10) {
    const gameFieldBg = new PIXI.Graphics();
    gameFieldBg.beginFill(0x1a1a2a);
    gameFieldBg.drawRoundedRect(
      startX - padding,
      startY - padding,
      cols * symbolSize + padding * 2,
      rows * symbolSize + padding * 2,
      cornerRadius
    );
    gameFieldBg.endFill();
    gameFieldBg.zIndex = 50;
    return gameFieldBg;
  }

  /**
   * Создает линии сетки (границы ячеек)
   * @param {number} startX - Начальная X координата
   * @param {number} startY - Начальная Y координата
   * @param {number} cols - Количество колонок
   * @param {number} rows - Количество рядов
   * @param {number} symbolSize - Размер символа
   * @param {number} lineWidth - Толщина линии
   * @param {number} lineColor - Цвет линии
   * @param {number} lineAlpha - Прозрачность линии
   * @returns {PIXI.Graphics} Графический объект линий сетки
   */
  static createGridLines(startX, startY, cols, rows, symbolSize, lineWidth = 2, lineColor = 0x444444, lineAlpha = 0.5) {
    const gridLines = new PIXI.Graphics();
    gridLines.lineStyle(lineWidth, lineColor, lineAlpha);
    
    // Вертикальные линии
    for (let col = 0; col <= cols; col++) {
      const x = startX + col * symbolSize;
      gridLines.moveTo(x, startY);
      gridLines.lineTo(x, startY + rows * symbolSize);
    }
    
    // Горизонтальные линии
    for (let row = 0; row <= rows; row++) {
      const y = startY + row * symbolSize;
      gridLines.moveTo(startX, y);
      gridLines.lineTo(startX + cols * symbolSize, y);
    }
    
    gridLines.zIndex = 60;
    return gridLines;
  }

  /**
   * Создает рамку игрового поля
   * @param {number} startX - Начальная X координата
   * @param {number} startY - Начальная Y координата
   * @param {number} width - Ширина поля
   * @param {number} height - Высота поля
   * @param {number} lineWidth - Толщина линии
   * @param {number} lineColor - Цвет линии
   * @param {number} lineAlpha - Прозрачность линии
   * @returns {PIXI.Graphics} Графический объект рамки
   */
  static createGameFrame(startX, startY, width, height, lineWidth = 2, lineColor = 0xFF0000, lineAlpha = 1) {
    const gameFrame = new PIXI.Graphics();
    gameFrame.rect(0, 0, width, height);
    gameFrame.stroke({ width: lineWidth, color: lineColor, alpha: lineAlpha });
    gameFrame.x = startX;
    gameFrame.y = startY;
    gameFrame.zIndex = 1000; // Поверх всего
    return gameFrame;
  }

  /**
   * Создает маркеры центров ячеек (крестики для отладки)
   * @param {Array<Array<{x: number, y: number}>>} gridPositions - Матрица позиций [col][row]
   * @param {number} markerSize - Размер маркера
   * @param {number} lineWidth - Толщина линии
   * @param {number} lineColor - Цвет линии
   * @param {number} lineAlpha - Прозрачность линии
   * @returns {PIXI.Graphics} Графический объект маркеров
   */
  static createGridMarkers(gridPositions, markerSize = 5, lineWidth = 1, lineColor = 0xFFFF00, lineAlpha = 0.5) {
    const gridMarkers = new PIXI.Graphics();
    
    for (let col = 0; col < gridPositions.length; col++) {
      for (let row = 0; row < gridPositions[col].length; row++) {
        const pos = gridPositions[col][row];
        // Крестик в центре ячейки
        gridMarkers.moveTo(pos.x - markerSize, pos.y);
        gridMarkers.lineTo(pos.x + markerSize, pos.y);
        gridMarkers.moveTo(pos.x, pos.y - markerSize);
        gridMarkers.lineTo(pos.x, pos.y + markerSize);
      }
    }
    
    gridMarkers.stroke({ width: lineWidth, color: lineColor, alpha: lineAlpha });
    gridMarkers.zIndex = 999; // Под рамками контейнеров, но видно
    return gridMarkers;
  }

  /**
   * Создает текстовые индексы (col, row) для каждой ячейки
   * @param {Array<Array<{x: number, y: number}>>} gridPositions - Матрица позиций [col][row]
   * @param {number} symbolSize - Размер символа
   * @param {Object} textStyle - Стиль текста (PIXI.TextStyle)
   * @returns {PIXI.Container} Контейнер с текстовыми метками
   */
  static createIndexLabels(gridPositions, symbolSize, textStyle = null) {
    const defaultStyle = {
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0x00FF00,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 2,
      align: 'left'
    };
    
    const style = textStyle || defaultStyle;
    const indexContainer = new PIXI.Container();
    
    for (let col = 0; col < gridPositions.length; col++) {
      for (let row = 0; row < gridPositions[col].length; row++) {
        const pos = gridPositions[col][row];
        // Позиция индекса в левом верхнем углу ячейки
        const indexX = pos.x - symbolSize / 2 + 5;
        const indexY = pos.y - symbolSize / 2 + 5;
        
        // Создаем текстовую метку с индексами
        const indexText = new PIXI.Text(`${col},${row}`, style);
        indexText.x = indexX;
        indexText.y = indexY;
        indexText.zIndex = 1001; // Поверх всего
        indexContainer.addChild(indexText);
      }
    }
    
    indexContainer.zIndex = 1001;
    return indexContainer;
  }

  /**
   * Создает все визуальные элементы сетки за один вызов
   * @param {PIXI.Container} stage - Контейнер stage для добавления элементов
   * @param {Object} config - Конфигурация
   * @param {Array<Array<{x: number, y: number}>>} gridPositions - Матрица позиций
   * @param {PIXI.Container} debugContainer - Опциональный контейнер для дебаг элементов (если null, дебаг на stage)
   * @param {number} debugOffsetX - Смещение по X для дебаг элементов в отдельном контейнере
   * @returns {Object} Объект с созданными элементами
   */
  static renderGrid(stage, config, gridPositions, debugContainer = null, debugOffsetX = 0) {
    const {
      startX,
      startY,
      cols,
      rows,
      symbolSize
    } = config;

    const gameAreaSize = {
      width: cols * symbolSize,
      height: rows * symbolSize
    };

    // Создаем основные элементы (всегда на stage)
    const gameFieldBg = this.createGameFieldBackground(startX, startY, cols, rows, symbolSize);
    const gridLines = this.createGridLines(startX, startY, cols, rows, symbolSize);
    
    // Добавляем основные элементы на stage
    stage.addChild(gameFieldBg);
    stage.addChild(gridLines);

    // Дебаг элементы создаем в отдельном контейнере или на stage
    const debugTarget = debugContainer || stage;
    const debugX = debugContainer ? debugOffsetX : startX;
    const debugY = startY;
    
    // Создаем дебаг элементы со смещением позиций
    const debugPositions = gridPositions.map(col => 
      col.map(pos => ({ x: pos.x - startX + debugX, y: pos.y }))
    );
    
    const gameFrame = this.createGameFrame(debugX, debugY, gameAreaSize.width, gameAreaSize.height);
    const gridMarkers = this.createGridMarkers(debugPositions);
    const indexContainer = this.createIndexLabels(debugPositions, symbolSize);
    
    // Добавляем дебаг элементы в целевой контейнер
    debugTarget.addChild(gameFrame);
    debugTarget.addChild(gridMarkers);
    debugTarget.addChild(indexContainer);

    return {
      gameFieldBg,
      gridLines,
      gameFrame,
      gridMarkers,
      indexContainer
    };
  }
}
