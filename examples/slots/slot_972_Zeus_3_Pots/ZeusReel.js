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
   * @param {PIXI.Texture} [options.symbolTexture] - текстура символа (монетки)
   * @param {number} [options.startDelayMs] - задержка старта спина для этого рила
   * @param {function} [options.onStop] - коллбек при остановке рила
   * @param {boolean} [options.useMask] - использовать ли маску окна (для отладочных лент можно отключать)
   * @param {number}  [options.padding] - внутренние отступы внутри маски (px)
   * @param {PIXI.Texture} [options.plateTexture] - текстура фоновой подложки ячейки
   * @param {function} [options.createSpineCoin] - фабрика Spine-монетки для оверлея
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
    symbolTexture = null,
    startDelayMs = 0,
    onStop,
    useMask = true,
    padding = 0,
    plateTexture = null,
    createSpineCoin = null
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
    this.useMask = useMask;
    this.symbolTexture = symbolTexture;
    this.plateTexture = plateTexture;
    this.step = this.curve.step || this.height;
    this.startDelayMs = startDelayMs;
    this.onStop = typeof onStop === 'function' ? onStop : null;
    // Внутренний отступ внутри окна маски. Для "плотных" рилов = 0.
    this.padding = padding;
    this.createSpineCoin = typeof createSpineCoin === 'function' ? createSpineCoin : null;

    this.frame = new PIXI.Graphics();

    // Контейнер символа: Graphics для простых заливок + спрайты монет.
    this.symbol = new PIXI.Graphics();
    this.coinSprites = [];
    this.plateSprites = [];
    // Монетка-оверлей поверх маски для финального состояния рила (Spine или спрайт).
    this.overlayCoin = null;
    // Два Spine-экземпляра для опорных символов внутри маски:
    // [0] — уезжающий (anchorIndex), [1] — приезжающий (targetAnchorIndex).
    // Остальные пролетающие символы остаются спрайтами.
    this.spineCoins = [null, null];

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

    // Статичная подложка в центре окна для текущего состояния рила.
    if (this.plateTexture) {
      let plate = this.plateSprites[0];
      if (!plate) {
        plate = new PIXI.Sprite(this.plateTexture);
        plate.anchor.set(0.5);
        this.plateSprites[0] = plate;
        this.symbol.addChild(plate);
      }
      plate.visible = true;
      plate.x = x + w / 2;
      plate.y = y + h / 2;
    }
    // Для основных рилов под маской не рисуем центральный символ внутри маски,
    // чтобы конечная монета показывалась только оверлеем поверх маски.
    if (!this.symbolTexture || !this.useMask) {
      // В отладочных/безмасочных рилах можно нарисовать символ как обычно.
      this._fillSymbolRect(symbolType, x, y, w, h, 0);
    }

    // Отладочная подпись индекса ячейки на статичном символе + номер спина, если есть.
    this.debugLabels.removeChildren();
    let labelText = `${this.col},${this.row}`;
    const stepId = this.targetAnchorStepId || this.anchorStepId || 0;
    if (stepId > 0) {
      labelText += ` [${stepId}]`;
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
    label.y = y + 4;
    this.debugLabels.addChild(label);
  }

  /**
   * Отрисовать один прямоугольник символа (как в версии до текстур):
   * - цветной прямоугольник-фон
   * - сверху маленький квадратик-индикатор.
   *
   * @param {number} symbolType
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {number} slotIndex - индекс слота в текущем кадре (0..poolSize-1)
   * @private
   */
  _fillSymbolRect(symbolType, x, y, w, h, slotIndex) {
    // 0 — пусто, 1 — монетка.
    if (symbolType !== 1) {
      return;
    }

    if (this.symbolTexture) {
      let sprite = this.coinSprites[slotIndex];
      if (!sprite) {
        sprite = new PIXI.Sprite(this.symbolTexture);
        sprite.anchor.set(0.5);
        this.coinSprites[slotIndex] = sprite;
        this.symbol.addChild(sprite);
      }
      sprite.visible = true;
      // Без трансформаций: просто ставим центр монетки в центр ячейки.
      sprite.x = x + w / 2;
      sprite.y = y + h / 2;
      return;
    }

    // Фолбэк, если текстура не загрузилась: однотонный прямоугольник.
    this.symbol.beginFill(0x60a5fa);
    this.symbol.drawRoundedRect(x, y, w, h, 6);
    this.symbol.endFill();
  }

  /**
   * Показать/обновить монетку-оверлей в центре окна рила
   * согласно currentSymbol. Работает только для рилов под маской.
   */
  showOverlayFromCurrent() {
    if (!this.useMask) return;

    // Для финального состояния показываем монетку только если текущий символ = 1.
    if (this.currentSymbol !== 1) {
      this.clearOverlay();
      return;
    }

    const parent = this.container.parent;
    if (!parent) return;

    // Ленивое создание оверлей-объекта: сначала Spine, если есть фабрика,
    // иначе фолбэк на обычный спрайт.
    if (!this.overlayCoin) {
      if (this.createSpineCoin) {
        this.overlayCoin = this.createSpineCoin();
      } else if (this.symbolTexture) {
        const sprite = new PIXI.Sprite(this.symbolTexture);
        sprite.anchor.set(0.5);
        this.overlayCoin = sprite;
      }
    }

    if (!this.overlayCoin) return;

    if (!this.overlayCoin.parent) {
      parent.addChild(this.overlayCoin);
    }

    parent.sortableChildren = true;
    const baseZ = (this.container.zIndex || 0) + 10;
    // Чем ниже ряд рила, тем выше монетка в overlay.
    this.overlayCoin.zIndex = baseZ + this.row;

    const padding = this.padding;
    const w = this.width - padding * 2;
    const h = this.step - padding * 2;

    const centerX = this.container.x + padding + w / 2;
    const centerY = this.container.y + padding + h / 2;

    this.overlayCoin.x = centerX;
    this.overlayCoin.y = centerY;
    this.overlayCoin.visible = true;

    // Оверлей Spine: один раз start, затем idle в цикле.
    if (this.overlayCoin.state) {
      this.overlayCoin.state.setAnimation(0, 'start', false);
      const overlayListener = {
        complete: (entry) => {
          if (entry.animation && entry.animation.name === 'start') {
            this.overlayCoin.state.setAnimation(0, 'idle', true);
            this.overlayCoin.state.removeListener(overlayListener);
          }
        }
      };
      this.overlayCoin.state.addListener(overlayListener);
    }
  }

  /**
   * Спрятать монетку-оверлей для этого рила (не удаляя спрайт).
   */
  clearOverlay() {
    if (this.overlayCoin) {
      this.overlayCoin.visible = false;
    }
  }

  /**
   * Старая реализация однотонной заливки сохранена на случай отладки.
   * Сейчас не используется, но может быть полезна как fallback.
   * @private
   */
  // eslint-disable-next-line class-methods-use-this
  _fillSymbolRectSolid(symbolType, x, y, w, h) {
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
    // При новом спине возвращаем внутренний символ под маской,
    // чтобы лента снова рисовалась.
    this.symbol.visible = true;

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
      // Во время задержки до старта анимации показываем уезжающую монету
      // там же, где стоял оверлей, чтобы не было мигания при смене.
      if (this.createSpineCoin && this.currentSymbol === 1) {
        if (!this.spineCoins[0]) {
          this.spineCoins[0] = this.createSpineCoin();
          this.container.addChild(this.spineCoins[0]);
          this.spineCoins[0].state.setAnimation(0, '1', true);
        }
        const pd = this.padding;
        const sw = this.width - pd * 2;
        const sh = this.step - pd * 2;
        this.spineCoins[0].visible = true;
        this.spineCoins[0].x = pd + sw / 2;
        this.spineCoins[0].y = pd + sh / 2;
      }
      return;
    }

    const t = Math.min(localTime, this.totalDurationMs);
    const offset = this.curve.getOffsetAt(t);

    // Эмулируем drawHoldWinCell из timing_preview_hold_win.js,
    // но вместо k→цвет используем k→тип символа, зависящий от сценария.
    const step = this.step;
    const poolSize = 4;

    // Готовим графику к перерисовке.
    this.symbol.clear();
    if (this.coinSprites) {
      for (let i = 0; i < this.coinSprites.length; i += 1) {
        const s = this.coinSprites[i];
        if (s) s.visible = false;
      }
    }
    if (this.plateSprites) {
      for (let i = 0; i < this.plateSprites.length; i += 1) {
        const p = this.plateSprites[i];
        if (p) p.visible = false;
      }
    }
    // Скрываем Spine-монеты опорных символов; покажем только те, что попадут в кадр.
    if (this.spineCoins[0]) this.spineCoins[0].visible = false;
    if (this.spineCoins[1]) this.spineCoins[1].visible = false;

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

      // Фоновая подложка слота под символом/Spine.
      if (this.plateTexture) {
        let plate = this.plateSprites[i];
        if (!plate) {
          plate = new PIXI.Sprite(this.plateTexture);
          plate.anchor.set(0.5);
          this.plateSprites[i] = plate;
          this.symbol.addChild(plate);
        }
        plate.visible = true;
        plate.x = x + w / 2;
        plate.y = visibleY + h / 2;
      }

      // Опорные символы рисуем через Spine (если фабрика есть),
      // все остальные пролетающие символы остаются спрайтами.
      let spineSlotIdx = -1;
      if (this.createSpineCoin && symbolType === 1) {
        if (k === this.anchorIndex) spineSlotIdx = 0;
        else if (k === this.targetAnchorIndex) spineSlotIdx = 1;
      }

      if (spineSlotIdx >= 0) {
        // Ленивое создание Spine-монетки и добавление в контейнер (под маску).
        // В прокрутках используем анимацию «1».
        if (!this.spineCoins[spineSlotIdx]) {
          this.spineCoins[spineSlotIdx] = this.createSpineCoin();
          this.container.addChild(this.spineCoins[spineSlotIdx]);
          this.spineCoins[spineSlotIdx].state.setAnimation(0, '1', true);
        }
        const sc = this.spineCoins[spineSlotIdx];
        sc.visible = true;
        sc.x = x + w / 2;
        sc.y = visibleY + h / 2;
      } else {
        this._fillSymbolRect(symbolType, x, visibleY, w, h, i);
      }

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
      // Прячем Spine-монеты опорных символов: overlay возьмёт на себя финальное состояние.
      if (this.spineCoins[0]) this.spineCoins[0].visible = false;
      if (this.spineCoins[1]) this.spineCoins[1].visible = false;

      this.isSpinning = false;
      this.symbol.y = 0;
      // К концу спина опорный индекс ленты смещается к целевому,
      // а текущий символ становится целевым.
      this.anchorIndex = this.targetAnchorIndex;
      this.anchorStepId = this.targetAnchorStepId;
      this.currentSymbol = this.targetSymbol;
      this._drawSymbol(this.currentSymbol);
      if (this.onStop) {
        this.onStop(this);
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

    // Целевая / текущая ячейка на ленте должна быть изолирована пустышками,
    // поэтому непосредственные соседи по ленте всегда = 0.
    if (
      k === this.anchorIndex - 1
      || k === this.anchorIndex + 1
      || k === this.targetAnchorIndex - 1
      || k === this.targetAnchorIndex + 1
    ) {
      return 0;
    }

    // Остальные позиции — детерминированный "рандом" 0/1,
    // стабильный от кадра к кадру.
    const seed = k * 73856093 + this.col * 19349663 + this.row * 83492791;
    return (seed & 1) === 0 ? 0 : 1;
  }
}

