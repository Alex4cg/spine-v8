import { ReelAnimationCurve } from './ReelAnimationCurve.js';

/**
 * Один рил (для прототипа — одна ячейка 3×3).
 * Отвечает только за визуализацию прямоугольника-символа и простую анимацию спина.
 */
export class ZeusReel {
  /**
   * @param {object} options
   * @param {PIXI.Container} options.parent - контейнер, куда добавлять рил
   * @param {number} options.x - позиция X рила
   * @param {number} options.y - позиция Y рила
   * @param {number} options.width - ширина символа
   * @param {number} options.height - высота символа
   * @param {ReelAnimationCurve} options.curve - анимационная кривая
   * @param {number} options.row - индекс ряда в сетке (0..ROWS-1)
   * @param {number} options.col - индекс колонки в сетке (0..COLS-1)
   * @param {number} [options.startDelayMs] - задержка старта спина для этого рила
   * @param {function} [options.onStop] - коллбек при остановке рила
   * @param {boolean} [options.useMask] - использовать ли маску окна (для отладочных лент можно отключать)
   * @param {number}  [options.padding] - внутренние отступы внутри маски (px)
   */
  constructor({
    parent,
    x,
    y,
    width,
    height,
    curve,
    row,
    col,
    startDelayMs = 0,
    onStop,
    useMask = true,
    padding = 0
  }) {
    this.container = new PIXI.Container();
    this.container.sortableChildren = true;
    this.container.x = x;
    this.container.y = y;
    parent.addChild(this.container);

    this.width = width;
    this.height = height;
    this.curve = curve;
    this.row = row;
    this.col = col;
    this.step = this.curve.step || this.height;
    this.startDelayMs = startDelayMs;
    this.onStop = typeof onStop === 'function' ? onStop : null;
    // Внутренний отступ внутри окна маски. Для "плотных" рилов = 0.
    this.padding = padding;

    this.frame = new PIXI.Graphics();
    this.symbol = new PIXI.Graphics();
    this.container.addChild(this.symbol);
    this.container.addChild(this.frame);

    // Контейнер для отладочных подписей индексов (col,row) поверх символов.
    this.debugLabels = new PIXI.Container();
    this.debugLabels.zIndex = 1000;
    this.container.addChild(this.debugLabels);

    if (useMask) {
      // Маска, как в timing_preview_hold_win: окно ровно на один символ (step).
      // Делаем её полностью прозрачной, чтобы не видно было белого квадрата,
      // но PIXI будет использовать её геометрию для клиппинга.
      this.maskShape = new PIXI.Graphics();
      this.maskShape.beginFill(0xffffff, 1);
      this.maskShape.drawRect(0, 0, this.width, this.step);
      this.maskShape.endFill();
      this.maskShape.alpha = 0;
      this.container.addChild(this.maskShape);
      this.container.mask = this.maskShape;
    } else {
      this.maskShape = null;
    }

    this.currentSymbol = 0;
    this.targetSymbol = 0;
    this.isSpinning = false;
    this.elapsedMs = 0;
    this.totalDurationMs = this.curve.getDurationMs();

    // Глобальный индекс "опорного" символа на бесконечной ленте.
    // В начале считаем, что опорный элемент имеет индекс 0.
    this.anchorIndex = 0;
    this.targetAnchorIndex = 0;

    // Номера шагов сценария/спина для опорных символов:
    // anchorIndex → anchorStepId, targetAnchorIndex → targetAnchorStepId.
    this.anchorStepId = 0;
    this.targetAnchorStepId = 0;

    // Смещения по кривой: берём реальный offset на старте и общий
    // сдвиг за полный цикл (учитывает overshoot).
    this.curveOffsetStart = this.curve.getOffsetAt(0);
    this.totalDistance = (this.curve.startOffset || 0)
      + (this.curve.linearDistance || 0)
      + (this.curve.endDelta || 0);

    // Для отладочного превью лент рамку не рисуем, чтобы не было белых квадратов.
    // this._drawFrame();
    this._drawSymbol(this.currentSymbol);
  }

  _drawFrame() {
    this.frame.clear();
    this.frame.lineStyle(2, 0xffffff, 0.7);
    this.frame.drawRoundedRect(0, 0, this.width, this.height, 10);
    this.frame.endFill();
  }

  _drawSymbol(symbolType) {
    // Для статичного состояния: один прямоугольник по центру окна высотой step
    const padding = this.padding;
    const w = this.width - padding * 2;
    const h = this.step - padding * 2;
    const x = padding;
    const y = padding;

    this.symbol.clear();
    this._fillSymbolRect(symbolType, x, y, w, h);

    // Отладочная подпись индекса ячейки на статичном символе.
    this.debugLabels.removeChildren();
    const label = new PIXI.Text(`${this.col},${this.row}`, {
      fontFamily: 'Arial',
      fontSize: 14,
      fill: 0xff0000,
      fontWeight: 'bold',
      stroke: 0x000000,
      strokeThickness: 2
    });
    label.x = x + 4;
    label.y = y + 4;
    this.debugLabels.addChild(label);
  }

  _fillSymbolRect(symbolType, x, y, w, h) {
    if (symbolType === 0) {
      this.symbol.beginFill(0x4ade80); // зелёный
    } else {
      this.symbol.beginFill(0x60a5fa); // синий
    }
    this.symbol.drawRoundedRect(x, y, w, h, 6);
    this.symbol.endFill();
  }

  /**
   * Установить символ без анимации.
   */
  setSymbol(symbolType) {
    this.currentSymbol = symbolType;
    this.targetSymbol = symbolType;
    this.isSpinning = false;
    this.elapsedMs = 0;
    this.symbol.y = 0;
    this._drawSymbol(symbolType);
  }

  /**
   * Запустить анимацию спина к заданному символу.
   */
  spinToSymbol(symbolType, stepId = 0) {
    this.targetSymbol = symbolType;
    this.isSpinning = true;
    this.elapsedMs = 0;

    // Сколько "шагов" (step) пройдёт центр окна за один спин.
    const step = this.step;
    const absDist = Math.abs(this.totalDistance);
    const steps = Math.max(1, Math.round(absDist / step));
    const direction = this.totalDistance >= 0 ? 1 : -1;

    // Обновляем привязку опорных индексов к номерам шагов сценария:
    // текущий якорь остаётся со старым anchorStepId,
    // целевой якорь (куда приедет символ) помечаем stepId.
    this.targetAnchorIndex = this.anchorIndex + direction * steps;
    this.targetAnchorStepId = stepId;
  }

  /**
   * Обновление рила.
   * @param {number} deltaMs - прошедшее время в миллисекундах
   */
  update(deltaMs) {
    if (!this.isSpinning) return;

    this.elapsedMs += deltaMs;
    const localTime = this.elapsedMs - this.startDelayMs;
    if (localTime <= 0) {
      return;
    }

    const t = Math.min(localTime, this.totalDurationMs);
    const offset = this.curve.getOffsetAt(t);

    // Эмулируем drawHoldWinCell из timing_preview_hold_win.js,
    // но вместо k→цвет используем k→тип символа, зависящий от сценария.
    const step = this.step;
    const poolSize = 4;

    this.symbol.clear();

    const padding = this.padding;
    const w = this.width - padding * 2;
    const h = step - padding * 2;
    const x = padding;

    // Очищаем отладочные подписи перед перерисовкой ленты.
    this.debugLabels.removeChildren();

    const direction = this.totalDistance >= 0 ? 1 : -1;
    const effectiveOffset = (offset - this.curveOffsetStart) * direction;

    // "Мировой" прогресс в пикселях.
    // В timing_preview_hold_win опорный индекс base — это СИМВОЛ НАД маской,
    // а видимый под маской — base-1. Наш anchorIndex трактуем как
    // "видимый под маской" → base = anchorIndex + 1.
    const progressWorld = (this.anchorIndex + 1) * step + effectiveOffset;
    const base = Math.floor(progressWorld / step);
    const kMin = base - 2;

    for (let i = 0; i < poolSize; i += 1) {
      const k = kMin + i;
      const y = -step + (progressWorld - k * step);
      const visibleY = y + padding;

      const symbolType = this._getSymbolByIndex(k);
      this._fillSymbolRect(symbolType, x, visibleY, w, h);

      // Базовая подпись ячейки.
      let labelText = `${this.col},${this.row}`;
      // Для опорных символов дописываем номер шага сценария:
      // - уезжающий: anchorIndex / anchorStepId
      // - приезжающий: targetAnchorIndex / targetAnchorStepId
      if (k === this.anchorIndex && this.anchorStepId > 0) {
        labelText += ` [${this.anchorStepId}]`;
      } else if (k === this.targetAnchorIndex && this.targetAnchorStepId > 0) {
        labelText += ` [${this.targetAnchorStepId}]`;
      }

      const label = new PIXI.Text(labelText, {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: 0xff0000,
        fontWeight: 'bold',
        stroke: 0x000000,
        strokeThickness: 2
      });
      label.x = x + 4;
      label.y = visibleY + 4;
      this.debugLabels.addChild(label);
    }

    if (localTime >= this.totalDurationMs) {
      this.isSpinning = false;
      this.symbol.y = 0;
      // К концу спина опорный индекс ленты смещается к целевому,
      // а текущий символ становится целевым.
      this.anchorIndex = this.targetAnchorIndex;
      this.anchorStepId = this.targetAnchorStepId;
      this.currentSymbol = this.targetSymbol;
      this._drawSymbol(this.currentSymbol);
      if (this.onStop) {
        this.onStop(this.currentSymbol);
      }
    }
  }

  /**
   * Детерминированное сопоставление "индекс на ленте" → "тип символа".
   * Опорные индексы (anchorIndex/targetAnchorIndex) жёстко привязаны
   * к currentSymbol/targetSymbol, остальные индексы — псевдослучайные 0/1,
   * но стабильные от кадра к кадру.
   * @param {number} k
   * @returns {number} symbolType
   */
  _getSymbolByIndex(k) {
    if (k === this.anchorIndex) return this.currentSymbol;
    if (k === this.targetAnchorIndex) return this.targetSymbol;

    // Простое детерминированное "рандомное" распределение по k и позиции рила,
    // чтобы между спинами цвет полосы не прыгал.
    const seed = k * 73856093 + this.col * 19349663 + this.row * 83492791;
    return (seed & 1) === 0 ? 0 : 1;
  }
}

