/**
 * MiniWinManager — показ результатов выигрыша: мини вин (по кластерам) и мини тотал (итог каскада при бомбе).
 * Интегрируется с CascadeManager / ScenarioCascadeManager.
 */
import { SoundManager } from './SoundManager.js';

const PRIORITY_POSITIONS = [
  { col: 1, row: 1 },
  { col: 1, row: 3 },
  { col: 4, row: 1 },
  { col: 4, row: 3 }
];

export class MiniWinManager {
  /**
   * @param {Object} config
   * @param {PIXI.Container} config.container - Контейнер для размещения текстов (например gameFieldContainer)
   * @param {Array<Array<{x: number, y: number}>>} config.gridPositions - [col][row] = {x, y}
   * @param {number} config.gridCols
   * @param {number} config.gridRows
   * @param {number} config.symbolSize
   * @param {Object} config.fontManager - FontManager instance
   * @param {number} [config.zIndex=200] - zIndex для контейнера мини винов
   */
  constructor(config) {
    this.container = config.container;
    this.gridPositions = config.gridPositions;
    this.gridCols = config.gridCols;
    this.gridRows = config.gridRows;
    this.symbolSize = config.symbolSize;
    this.fontManager = config.fontManager;
    this.zIndex = config.zIndex ?? 200;

    this.miniWinContainer = null;
    this.miniWinSprites = [];
    this.miniTotalSprites = [];
    this._activeAnimations = new Set(); // Отслеживание активных анимаций
  }

  /**
   * Создаёт внутренний контейнер для мини винов (если ещё нет)
   */
  _ensureContainer() {
    if (!this.miniWinContainer) {
      this.miniWinContainer = new PIXI.Container();
      this.miniWinContainer.zIndex = this.zIndex;
      this.container.addChild(this.miniWinContainer);
    }
  }

  /**
   * Выбирает ячейку для мини вина по правилам приоритета.
   * @param {Array<{col: number, row: number}>} cells - ячейки кластера (col, row)
   * @returns {{col: number, row: number} | null}
   */
  _selectBestCell(cells) {
    if (!cells || cells.length === 0) return null;

    const inPriority = cells.find(c =>
      PRIORITY_POSITIONS.some(p => p.col === c.col && p.row === c.row)
    );
    if (inPriority) return inPriority;

    let best = cells[0];
    let minDist = Infinity;
    for (const cell of cells) {
      let d = Infinity;
      for (const p of PRIORITY_POSITIONS) {
        const manhattan = Math.abs(cell.col - p.col) + Math.abs(cell.row - p.row);
        if (manhattan < d) d = manhattan;
      }
      if (d < minDist) {
        minDist = d;
        best = cell;
      }
    }
    return best;
  }

  /**
   * Получает позицию центра поля (для мини тотала) — центр матрицы 6×5
   */
  _getGridCenter() {
    const midCol = Math.floor(this.gridCols / 2);
    const midRow = Math.floor(this.gridRows / 2);
    const p1 = this.gridPositions[midCol]?.[midRow];
    const p2 = this.gridPositions[midCol - 1]?.[midRow];
    if (p1 && p2) {
      return { x: (p1.x + p2.x) / 2, y: p1.y };
    }
    if (p1) return { x: p1.x, y: p1.y };
    return { x: 0, y: 0 };
  }

  /**
   * Форматирует выплату для отображения: знак + и два знака после запятой (0.00).
   */
  _formatPayout(value) {
    const n = typeof value === 'number' && !isNaN(value) ? value : 0;
    const formatted = Number(n).toFixed(2);
    return n >= 0 ? `+${formatted}` : formatted;
  }

  /**
   * Easing функция для баунса (easeOutBounce)
   * @param {number} t - Прогресс от 0 до 1
   * @returns {number} - Eased значение от 0 до 1
   */
  _easeOutBounce(t) {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  }

  /**
   * Анимирует появление (scale с bounce) и исчезновение (alpha + сдвиг вверх).
   * @param {PIXI.Sprite} sprite - Спрайт для анимации
   * @param {number} startY - Начальная Y позиция
   * @param {Object} [opts] - Опции: targetScale, totalDuration, onComplete, visibleRatio, disappearDurationMs, onlyDisappear, skipDisappear, delayMs, appearMs, visibleMs
   */
  _animateWinLike(sprite, startY, opts = {}) {
    const targetScale = opts.targetScale ?? 1;
    const totalDuration = opts.totalDuration ?? 3000;
    const visibleRatio = opts.visibleRatio ?? 0.5;
    const onlyDisappear = opts.onlyDisappear ?? false;
    const skipDisappear = opts.skipDisappear ?? false;

    const DELAY_RATIO = 0.1;
    const APPEAR_RATIO = 0.233;
    const DISAPPEAR_RATIO = 0.167;
    const baseVisible = 1 - DELAY_RATIO - APPEAR_RATIO - DISAPPEAR_RATIO;
    const useVisible = Math.max(0, visibleRatio !== undefined ? visibleRatio : baseVisible);

    let DELAY = onlyDisappear ? 0 : (opts.delayMs ?? totalDuration * DELAY_RATIO);
    let APPEAR = onlyDisappear ? 0 : (opts.appearMs ?? totalDuration * APPEAR_RATIO);
    let VISIBLE = onlyDisappear ? 0 : (opts.visibleMs ?? totalDuration * useVisible);
    let DISAPPEAR = skipDisappear ? 0 : (opts.disappearDurationMs ?? opts.disappearMs ?? (onlyDisappear ? totalDuration : Math.max(100, totalDuration - DELAY - APPEAR - VISIBLE)));
    const DISAPPEAR_OFFSET = 100;

    const startTime = performance.now();
    sprite.scale.set(onlyDisappear ? targetScale : 0);
    sprite.alpha = 1;
    sprite.y = startY;

    const animationId = Symbol();
    this._activeAnimations.add(animationId);

    const animate = (currentTime) => {
      if (!this._activeAnimations.has(animationId) || !sprite.parent) {
        this._activeAnimations.delete(animationId);
        return;
      }

      const elapsed = currentTime - startTime;

      if (elapsed < DELAY) {
        sprite.scale.set(onlyDisappear ? targetScale : 0);
        requestAnimationFrame(animate);
      } else if (elapsed < DELAY + APPEAR) {
        const progress = (elapsed - DELAY) / APPEAR;
        const eased = this._easeOutBounce(progress);
        sprite.scale.set(eased * targetScale);
        requestAnimationFrame(animate);
      } else if (elapsed < DELAY + APPEAR + VISIBLE) {
        sprite.scale.set(targetScale);
        requestAnimationFrame(animate);
      } else if (DISAPPEAR > 0 && elapsed < DELAY + APPEAR + VISIBLE + DISAPPEAR) {
        const dProgress = (elapsed - (DELAY + APPEAR + VISIBLE)) / DISAPPEAR;
        sprite.alpha = 1 - dProgress;
        sprite.y = startY - dProgress * DISAPPEAR_OFFSET;
        sprite.scale.set(targetScale);
        requestAnimationFrame(animate);
      } else {
        this._activeAnimations.delete(animationId);
        if (sprite.parent) sprite.parent.removeChild(sprite);
        if (sprite.destroy) sprite.destroy();
        opts.onComplete?.();
      }
    };

    requestAnimationFrame(animate);
  }

  _animateMiniWin(sprite, startY) {
    // Сценарий 1: задержка 300, появление 700, видимый 300, исчезновение 500 = 1800 мс (MINI_WIN_DISPLAY.md)
    this._animateWinLike(sprite, startY, {
      targetScale: 1,
      totalDuration: 1800,
      delayMs: 300,
      appearMs: 700,
      visibleMs: 300,
      disappearMs: 500
    });
  }

  /**
   * Показывает мини вины — выплаты по каждому кластеру над выбранной ячейкой.
   * @param {Object} step - Шаг сценария с winningGroups, groupMarkup, payouts
   * @param {Object} [opts] - multiClusterNoBomb: true — сценарий 2 (видимый 0); bombScenario: true — сценарий 3 (видимый 500мс, всего 2с)
   */
  showMiniWins(step, opts = {}) {
    if (!step || !step.winningGroups || step.winningGroups.length === 0) return;
    if (!step.groupMarkup) return;

    SoundManager.playWin();
    this._ensureContainer();
    this.clear();

    const groupMarkup = step.groupMarkup;
    const payouts = step.payouts || [];
    const GRID_ROWS = this.gridRows;
    const GRID_COLS = this.gridCols;

    for (let i = 0; i < step.winningGroups.length; i++) {
      const group = step.winningGroups[i];
      const groupId = group.groupId;
      const payoutValue = payouts[i]?.payout;
      const text = this._formatPayout(payoutValue);

      const cells = [];
      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          if (groupMarkup[row] && groupMarkup[row][col] === groupId) {
            cells.push({ col, row });
          }
        }
      }

      const best = this._selectBestCell(cells);
      if (!best) continue;

      const pos = this.gridPositions[best.col]?.[best.row];
      if (!pos) continue;

      const sprite = this.fontManager.createText('win_amount', text);
      sprite.anchor.set(0.5);
      sprite.x = pos.x;
      sprite.y = pos.y;
      sprite.alpha = 0;
      this.miniWinContainer.addChild(sprite);
      this.miniWinSprites.push(sprite);

      if (opts.bombScenario) {
        this._animateWinLike(sprite, pos.y, {
          targetScale: 1,
          totalDuration: 2000,
          delayMs: 300,
          appearMs: 700,
          visibleMs: 500,
          disappearMs: 500
        });
      } else if (opts.multiClusterNoBomb) {
        this._animateWinLike(sprite, pos.y, {
          targetScale: 1,
          totalDuration: 3000,
          visibleRatio: 0,
          disappearDurationMs: 500
        });
      } else {
        this._animateMiniWin(sprite, pos.y);
      }
    }
  }

  /**
   * 2+ кластера без бомбы: мини вины появляются, сразу начинают улетать, в этот момент стартует мини тотал.
   * @param {Object} step - Шаг сценария
   * @returns {Promise<void>}
   */
  async showMiniWinsAndTotalForMultiCluster(step) {
    this.showMiniWins(step, { multiClusterNoBomb: true });
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.showMiniTotal(step, 1000);
  }

  /**
   * 1 или 2+ кластера + бомба: мини вины уже показаны вызывающим; ждём 1с, затем мини тотал.
   * @param {Object} step - Шаг сценария
   * @param {number} [durationMs=2000] - общая длительность мини тотала с бомбой
   * @param {{ displayBase?: number, displayMult?: number, displayTotal?: number }} [displayOpts] - база × эффективный множитель (жёлтый+бомба) = итог; если не передан — из step
   * @returns {Promise<void>}
   */
  async showMiniWinsAndTotalWithBomb(step, durationMs = 2000, displayOpts = null) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await this.showMiniTotalWithBomb(step, durationMs, displayOpts);
  }

  /**
   * Показывает мини тотал по центру поля (без бомбы).
   * @param {Object} step - Шаг сценария с totalPayout
   * @param {number} durationMs - Длительность показа (мс)
   * @returns {Promise<void>}
   */
  async showMiniTotal(step, durationMs = 1000) {
    SoundManager.playWin();
    this._ensureContainer();

    const total = step?.totalPayout;
    const text = this._formatPayout(total);
    const center = this._getGridCenter();

    const sprite = this.fontManager.createText('win_amount', text);
    sprite.anchor.set(0.5);
    sprite.x = center.x;
    sprite.y = center.y;
    this.miniWinContainer.addChild(sprite);
    this.miniTotalSprites.push(sprite);

    await new Promise(resolve => {
      this._animateWinLike(sprite, center.y, {
        targetScale: 1.5,
        totalDuration: durationMs,
        onComplete: () => {
          const idx = this.miniTotalSprites.indexOf(sprite);
          if (idx > -1) this.miniTotalSprites.splice(idx, 1);
          resolve();
        }
      });
    });
  }

  /**
   * Показывает мини тотал при бомбе: сначала "база×множитель" (при бонусе с жёлтым — эффективный множитель, напр. 30), затем результат.
   * @param {Object} step - Шаг сценария с totalPayout, multiplier
   * @param {number} [_durationMs] - не используется, тайминги заданы явно
   * @param {{ displayBase?: number, displayMult?: number, displayTotal?: number }} [displayOpts] - если задано: база, эффективный множитель, итог
   * @returns {Promise<void>}
   */
  async showMiniTotalWithBomb(step, _durationMs = 2000, displayOpts = null) {
    SoundManager.playWin();
    this._ensureContainer();

    let baseVal, multVal, resultVal;
    if (displayOpts && displayOpts.displayTotal != null) {
      baseVal = displayOpts.displayBase ?? 0;
      multVal = displayOpts.displayMult ?? 1;
      resultVal = displayOpts.displayTotal;
    } else {
      const total = step?.totalPayout ?? 0;
      const mult = step?.multiplier ?? 1;
      baseVal = mult !== 1 ? total / mult : total;
      multVal = mult;
      resultVal = total * mult;
    }
    const center = this._getGridCenter();

    // Этап 1: множитель — задержка 100, появление 233, видимый 800 мс, без исчезновения
    const stage1Duration = 100 + 233 + 800;

    const multText = `${Number(baseVal).toFixed(2)}×${multVal}`;
    const multSprite = this.fontManager.createText('win_amount', multText);
    multSprite.anchor.set(0.5);
    multSprite.x = center.x;
    multSprite.y = center.y;
    this.miniWinContainer.addChild(multSprite);
    this.miniTotalSprites.push(multSprite);

    await new Promise(resolve => {
      this._animateWinLike(multSprite, center.y, {
        targetScale: 1.5,
        totalDuration: stage1Duration,
        delayMs: 100,
        appearMs: 233,
        visibleMs: 800,
        skipDisappear: true,
        onComplete: () => {
          const idx = this.miniTotalSprites.indexOf(multSprite);
          if (idx > -1) this.miniTotalSprites.splice(idx, 1);
          resolve();
        }
      });
    });

    // Этап 2: результат — видимый 1000 мс, исчезновение 300 мс (MINI_WIN_DISPLAY.md)
    const resultSprite = this.fontManager.createText('win_amount', this._formatPayout(resultVal));
    resultSprite.anchor.set(0.5);
    resultSprite.scale.set(1.5);
    resultSprite.x = center.x;
    resultSprite.y = center.y;
    this.miniWinContainer.addChild(resultSprite);
    this.miniTotalSprites.push(resultSprite);

    await new Promise(resolve => {
      this._animateWinLike(resultSprite, center.y, {
        targetScale: 1.5,
        totalDuration: 1000 + 300,
        delayMs: 0,
        appearMs: 0,
        visibleMs: 1000,
        disappearMs: 300,
        onComplete: () => {
          const idx = this.miniTotalSprites.indexOf(resultSprite);
          if (idx > -1) this.miniTotalSprites.splice(idx, 1);
          resolve();
        }
      });
    });
  }

  _clearMiniTotal() {
    for (const s of this.miniTotalSprites) {
      if (s && s.parent) s.parent.removeChild(s);
      if (s && s.destroy) s.destroy();
    }
    this.miniTotalSprites = [];
  }

  /**
   * Очищает все мини вины и мини тоталы
   */
  clear() {
    // Останавливаем все активные анимации
    this._activeAnimations.clear();
    
    for (const s of this.miniWinSprites) {
      if (s && s.parent) s.parent.removeChild(s);
      if (s && s.destroy) s.destroy();
    }
    this.miniWinSprites = [];
    this._clearMiniTotal();
  }

  /**
   * Уничтожает контейнер и все спрайты
   */
  destroy() {
    this.clear();
    if (this.miniWinContainer && this.miniWinContainer.parent) {
      this.miniWinContainer.parent.removeChild(this.miniWinContainer);
    }
    this.miniWinContainer = null;
  }
}
