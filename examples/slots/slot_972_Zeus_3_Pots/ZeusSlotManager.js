import { ReelAnimationCurve } from './ReelAnimationCurve.js';
import { ZeusReel } from './ZeusReel.js';

/**
 * Управляет набором рилов (для Зевса — 3×3).
 */
export class ZeusSlotManager {
  /**
   * @param {object} options
   * @param {PIXI.Container} options.parent - контейнер, куда будут добавлены все рилы
   * @param {number} options.rows - количество рядов (3)
   * @param {number} options.cols - количество колонок (3)
   * @param {number} options.symbolWidth - ширина символа (248)
   * @param {number} options.symbolHeight - высота символа (166)
   * @param {number} options.originX - левый верхний X сетки
   * @param {number} options.originY - левый верхний Y сетки
   * @param {number} [options.gapX] - горизонтальное расстояние между рилами
   * @param {number} [options.gapY] - вертикальное расстояние между рилами
   * @param {object} options.reelProfile - один из профилей из reel_animation.json
   * @param {function} [options.onSpinComplete] - коллбек по завершении спина всех рилов
   */
  constructor({
    parent,
    rows,
    cols,
    symbolWidth,
    symbolHeight,
    originX,
    originY,
    gapX = 0,
    gapY = 0,
    reelProfile,
    onSpinComplete
  }) {
    this.rows = rows;
    this.cols = cols;
    this.symbolWidth = symbolWidth;
    this.symbolHeight = symbolHeight;
    this.originX = originX;
    this.originY = originY;
    this.gapX = gapX;
    this.gapY = gapY;
    this.onSpinComplete = typeof onSpinComplete === 'function' ? onSpinComplete : null;

    // Для каждого рила нужен свой экземпляр кривой, т.к. по спецификации
    // Timing Tool длительность и дистанция Linear зависят от индекса колонки:
    // n = tapeLength + col * extraLength.
    this.reelProfile = reelProfile;
    this.reels = [];
    this.spinningCount = 0;
    this.spinIndex = 0; // номер шага сценария / спина

    this._createReels(parent);
  }

  _createReels(parent) {
    this.reels.length = 0;
    const rowStep = this.reelProfile.step || this.symbolHeight;
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const reelIndex = this._index(row, col);
        const x = this.originX + col * (this.symbolWidth + this.gapX);
        const y = this.originY + row * (rowStep + this.gapY);
        const curve = new ReelAnimationCurve(this.reelProfile, col);
        const reel = new ZeusReel({
          parent,
          x,
          y,
          width: this.symbolWidth,
          height: this.symbolHeight,
          row,
          col,
          curve,
          startDelayMs: reelIndex * curve.reelStartDelayMs,
          onStop: () => this._onReelStop()
        });
        this.reels.push(reel);
      }
    }
  }

  _index(row, col) {
    return row * this.cols + col;
  }

  _onReelStop() {
    this.spinningCount -= 1;
    if (this.spinningCount <= 0) {
      this.spinningCount = 0;
      if (this.onSpinComplete) {
        const finalMatrix = this.getCurrentMatrix();
        this.onSpinComplete(finalMatrix);
      }
    }
  }

  /**
   * Установить матрицу символов без анимации.
   * @param {number[][]} matrix - matrix[row][col]
   */
  setMatrixImmediately(matrix) {
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const idx = this._index(row, col);
        const reel = this.reels[idx];
        const symbol = matrix[row]?.[col] ?? 0;
        reel.setSymbol(symbol);
      }
    }
  }

  /**
   * Вернуть текущую матрицу символов.
   */
  getCurrentMatrix() {
    const matrix = [];
    for (let row = 0; row < this.rows; row += 1) {
      const rowArr = [];
      for (let col = 0; col < this.cols; col += 1) {
        const idx = this._index(row, col);
        const reel = this.reels[idx];
        rowArr.push(reel.currentSymbol || 0);
      }
      matrix.push(rowArr);
    }
    return matrix;
  }

  /**
   * Запустить спин ко всей матрице.
   * @param {number[][]} targetMatrix - matrix[row][col]
   */
  spinToMatrix(targetMatrix) {
    this.spinIndex += 1;
    const stepId = this.spinIndex;
    this.spinningCount = this.rows * this.cols;
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const idx = this._index(row, col);
        const reel = this.reels[idx];
        const symbol = targetMatrix[row]?.[col] ?? 0;
        reel.spinToSymbol(symbol, stepId);
      }
    }
  }

  /**
   * Обновление всех рилов.
   * @param {number} deltaMs
   */
  update(deltaMs) {
    for (let i = 0; i < this.reels.length; i += 1) {
      this.reels[i].update(deltaMs);
    }
  }
}

