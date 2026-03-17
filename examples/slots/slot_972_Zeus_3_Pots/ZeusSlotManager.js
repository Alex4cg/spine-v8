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
   * @param {PIXI.Texture} [options.symbolTexture] - текстура символа (монетки)
   * @param {PIXI.Texture} [options.frameTexture] - текстура рамки поверх поля
   * @param {PIXI.Texture} [options.plateTexture] - текстура фоновой подложки ячейки
   * @param {Array<{createOverlayCoin:function, createScrollCoin:function}>} [options.coinFactories]
   *   Массив фабрик монеток — по одной на каждый рил (row*cols + col).
   *   Каждый элемент: { createOverlayCoin(), createScrollCoin(slotIdx) }.
   * @param {import('./ZeusCollectEffect.js').ZeusCollectEffect} [options.collectEffect]
   *   Менеджер эффекта перелёта монет (для пот-монет).
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
    symbolTexture = null,
    frameTexture = null,
    plateTexture = null,
    coinFactories = null,
    collectEffect = null,
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
    this.symbolTexture = symbolTexture;
    this.plateTexture = plateTexture;
    this.coinFactories = Array.isArray(coinFactories) ? coinFactories : null;
    this.collectEffect = collectEffect || null;
    this.reels = [];
    this.spinningCount = 0;
    this.spinIndex = 0; // номер шага сценария / спина

    // Рамка поверх поля, но под финальными монетками-оверлеями.
    if (frameTexture) {
      parent.sortableChildren = true;
      const frameSprite = new PIXI.Sprite(frameTexture);
      frameSprite.x = originX-22;
      frameSprite.y = originY-14;
      frameSprite.zIndex = (parent.zIndex || 0) + 5;
      parent.addChild(frameSprite);
      this.frameSprite = frameSprite;
    }

    this._createReels(parent);
    this._wireCollectEffect();
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
          symbolTexture: this.symbolTexture,
          plateTexture: this.plateTexture,
          startDelayMs: reelIndex * curve.reelStartDelayMs,
          onStop: (stoppedReel) => this._onReelStop(stoppedReel),
          coinFactory: this.coinFactories ? (this.coinFactories[reelIndex] || null) : null
        });
        this.reels.push(reel);
      }
    }
  }

  _index(row, col) {
    return row * this.cols + col;
  }

  /**
   * Подключает collect-effect: каждая pot-монета при появлении стреляет
   * из своей позиции (без Spine-ивента, при запуске анимации hit).
   * Логика выстрела уже внутри ZeusReel.showOverlayFromCurrent().
   * @private
   */
  _wireCollectEffect() {
    if (!this.collectEffect) return;

    for (const reel of this.reels) {
      reel.onShotCallback = (worldPos, potType) => {
        const endPos = { x: worldPos.x, y: 120 };
        this.collectEffect.fire(worldPos, endPos, potType);
      };
    }
  }

  _onReelStop(stoppedReel) {
    this.spinningCount -= 1;

    if (stoppedReel && stoppedReel.useMask) {
      stoppedReel.showOverlayFromCurrent();
    }

    if (this.spinningCount <= 0) {
      this.spinningCount = 0;
      const finalMatrix = this.getCurrentMatrix();

      if (this.onSpinComplete) {
        this.onSpinComplete(finalMatrix);
      }
    }
  }

  /**
   * Установить матрицу символов без анимации.
   * @param {number[][]} matrix - matrix[row][col]
   * @param {import('./SymbolMapping.js').SymbolMeta[][]} [metaMatrix] - meta[row][col]
   */
  setMatrixImmediately(matrix, metaMatrix) {
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const idx = this._index(row, col);
        const reel = this.reels[idx];
        const symbol = matrix[row]?.[col] ?? 0;
        const meta = metaMatrix && metaMatrix[row] ? metaMatrix[row][col] : null;
        reel.setSymbol(symbol, meta);
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
   * @param {import('./SymbolMapping.js').SymbolMeta[][]} [targetMetaMatrix] - meta[row][col]
   */
  spinToMatrix(targetMatrix, targetMetaMatrix) {
    this.spinIndex += 1;
    const stepId = this.spinIndex;
    // Считаем только те рилы, которые реально будут крутиться.
    this.spinningCount = 0;
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        const idx = this._index(row, col);
        const reel = this.reels[idx];
        const symbol = targetMatrix[row]?.[col] ?? 0;
        const meta = targetMetaMatrix && targetMetaMatrix[row] ? targetMetaMatrix[row][col] : null;

        // Если рил уже sticky — он больше не крутится в регулярных спинах,
        // символ и overlay остаются как есть.
        if (reel.isSticky) {
          continue;
        }

        // Перед стартом конкретного рила очищаем только его оверлей.
        // Для будущего sticky (по meta.type === 'sticky') overlay пересоздастся
        // при остановке рила в showOverlayFromCurrent.
        if (reel.clearOverlay) {
          reel.clearOverlay();
        }

        this.spinningCount += 1;
        reel.spinToSymbol(symbol, stepId, meta);
      }
    }

    // Если все рилы уже sticky и крутить нечего — немедленно завершаем спин.
    if (this.spinningCount === 0) {
      const finalMatrix = this.getCurrentMatrix();
      if (this.onSpinComplete) {
        this.onSpinComplete(finalMatrix);
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

