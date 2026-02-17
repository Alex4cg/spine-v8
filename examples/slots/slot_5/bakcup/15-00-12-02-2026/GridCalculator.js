/**
 * Утилиты для расчета позиций сетки
 */
export class GridCalculator {
  /**
   * Вычисляет начальную X координату сетки (центрирование)
   * @param {number} appWidth - Ширина приложения
   * @param {number} cols - Количество колонок
   * @param {number} symbolSize - Размер символа
   * @returns {number} X координата начала сетки
   */
  static getGridStartX(appWidth, cols, symbolSize) {
    return appWidth / 2 - (cols * symbolSize) / 2;
  }
  
  /**
   * Вычисляет матрицу позиций центров ячеек сетки
   * @param {number} cols - Количество колонок
   * @param {number} rows - Количество рядов
   * @param {number} symbolSize - Размер символа
   * @param {number} startX - Начальная X координата сетки
   * @param {number} startY - Начальная Y координата сетки
   * @returns {Array<Array<{x: number, y: number}>>} Матрица позиций [col][row] = {x, y}
   */
  static calculatePositions(cols, rows, symbolSize, startX, startY) {
    const positions = [];
    
    for (let col = 0; col < cols; col++) {
      positions[col] = [];
      for (let row = 0; row < rows; row++) {
        // Центр ячейки
        positions[col][row] = {
          x: startX + col * symbolSize + symbolSize / 2,
          y: startY + row * symbolSize + symbolSize / 2
        };
      }
    }
    
    return positions;
  }
  
  /**
   * Вычисляет размеры игрового поля
   * @param {number} cols - Количество колонок
   * @param {number} rows - Количество рядов
   * @param {number} symbolSize - Размер символа
   * @returns {{width: number, height: number}} Размеры поля
   */
  static getGameAreaSize(cols, rows, symbolSize) {
    return {
      width: cols * symbolSize,
      height: rows * symbolSize
    };
  }
  
  /**
   * Вычисляет Y координату конца сетки (для расчета позиции падения старых символов)
   * @param {number} startY - Начальная Y координата сетки
   * @param {number} rows - Количество рядов
   * @param {number} symbolSize - Размер символа
   * @returns {number} Y координата конца сетки
   */
  static getGridEndY(startY, rows, symbolSize) {
    return startY + rows * symbolSize;
  }
}
