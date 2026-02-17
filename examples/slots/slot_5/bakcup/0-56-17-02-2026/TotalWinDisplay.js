/**
 * TotalWinDisplay — отображение Total Win (накапливаемая сумма выигрыша за серию каскадов).
 * Позиция и масштаб настраиваются через Debug Menu (якорь totalWinAnchor).
 */
export class TotalWinDisplay {
  /**
   * @param {Object} config
   * @param {PIXI.Container} config.container - Контейнер для размещения текста (например gameFieldContainer)
   * @param {PIXI.Container} config.anchor - Якорь для позиции и масштаба (totalWinAnchor)
   * @param {Object} config.fontManager - FontManager instance
   * @param {number} [config.zIndex=200] - zIndex для спрайта Total Win
   */
  constructor(config) {
    this.container = config.container;
    this.anchor = config.anchor;
    this.fontManager = config.fontManager;
    this.zIndex = config.zIndex ?? 200;

    this.sprite = null;
    this._createSprite();
  }

  /**
   * Создаёт спрайт с текстом (дефолтная надпись "WIN UP TO 50000" для настройки позиции через дебаггер)
   */
  _createSprite() {
    const text = 'WIN UP TO 50000';
    this.sprite = this.fontManager.createText('Total_win', text);
    this.sprite.anchor.set(0.5);
    this.sprite.visible = true; // Видим по умолчанию для настройки позиции
    this.sprite.zIndex = this.zIndex;
    this.container.addChild(this.sprite);
    this._updatePosition();
  }

  /**
   * Обновляет позицию и масштаб спрайта из якоря
   */
  _updatePosition() {
    if (!this.sprite || !this.anchor) return;
    this.sprite.x = this.anchor.x;
    this.sprite.y = this.anchor.y;
    const scale = this.anchor.scale?.x ?? 1;
    this.sprite.scale.set(scale);
  }

  /**
   * Форматирует выплату для отображения: "WIN {value}" с двумя знаками после запятой (0.00).
   */
  _formatPayout(value) {
    const n = typeof value === 'number' && !isNaN(value) ? value : 0;
    const formatted = Number(n).toFixed(2);
    return `WIN ${formatted}`;
  }

  /**
   * Показывает Total Win с указанным значением
   * @param {number} value - Накопленная сумма за серию
   */
  show(value) {
    if (!this.sprite) return;
    
    const text = this._formatPayout(value);
    
    // Удаляем старый спрайт
    if (this.sprite.parent) {
      this.sprite.parent.removeChild(this.sprite);
      if (this.sprite.destroy) this.sprite.destroy();
    }
    
    // Создаём новый спрайт с обновлённым текстом
    this.sprite = this.fontManager.createText('Total_win', text);
    this.sprite.anchor.set(0.5);
    this.sprite.zIndex = this.zIndex;
    this.container.addChild(this.sprite);
    
    // Обновляем позицию и масштаб из якоря
    this._updatePosition();
    
    // Показываем
    this.sprite.visible = true;
  }

  /**
   * Обновляет значение Total Win без изменения видимости (если уже показан)
   * @param {number} value - Накопленная сумма за серию
   */
  update(value) {
    if (!this.sprite || !this.sprite.visible) return;
    this.show(value);
  }

  /**
   * Скрывает отображение Total Win
   */
  hide() {
    if (this.sprite) {
      this.sprite.visible = false;
    }
  }

  /**
   * Обновляет позицию и масштаб из якоря (вызывать при изменении якоря через Debug Menu)
   */
  updatePosition() {
    this._updatePosition();
  }

  /**
   * Уничтожает спрайт и очищает ресурсы
   */
  destroy() {
    if (this.sprite) {
      if (this.sprite.parent) {
        this.sprite.parent.removeChild(this.sprite);
      }
      if (this.sprite.destroy) {
        this.sprite.destroy();
      }
      this.sprite = null;
    }
  }
}
