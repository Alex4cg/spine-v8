/**
 * Класс для символа в каскадной слот-игре
 */
export class Symbol {
  /** Глобальная видимость отладочных элементов (рамка, индексы) для новых символов */
  static debugOverlayVisible = true;

  constructor(centerX, centerY, textureIndex, parentContainer, symbolTextures, SYMBOL_SIZE, SYMBOL_TEXTURE_SIZE, FALL_SPEED, col = null, row = null) {
    this.parentContainer = parentContainer;
    this.textureIndex = textureIndex;
    this.symbolTextures = symbolTextures;
    this.SYMBOL_SIZE = SYMBOL_SIZE;
    this.SYMBOL_TEXTURE_SIZE = SYMBOL_TEXTURE_SIZE;
    this.FALL_SPEED = FALL_SPEED;
    this.col = col;
    this.row = row;
    
    // Целевая позиция - центр ячейки из статической сетки
    this.targetX = centerX;
    this.targetY = centerY;
    // Текущая позиция (начинаем сверху экрана)
    // currentX и currentY - это координаты центра контейнера
    this.currentX = centerX;
    this.currentY = -SYMBOL_SIZE / 2; // Начинаем сверху экрана (центр контейнера)
    this.isFalling = false;
    this.fallSpeed = FALL_SPEED;
    
    // Создаем контейнер для ячейки размером 100x100
    this.cellContainer = new PIXI.Container();
    this.cellContainer.width = SYMBOL_SIZE;
    this.cellContainer.height = SYMBOL_SIZE;
    // Позиционируем контейнер так, чтобы его центр был в (centerX, centerY)
    // Для этого вычитаем SYMBOL_SIZE/2 из координат (позиция левого верхнего угла)
    this.cellContainer.x = this.currentX - SYMBOL_SIZE / 2;
    this.cellContainer.y = this.currentY - SYMBOL_SIZE / 2;
    this.cellContainer.zIndex = 100;
    
    // Создаем тонкую рамку для контейнера (для настройки) - как в SlotReel.js
    this.border = new PIXI.Graphics();
    this.border.rect(0, 0, SYMBOL_SIZE, SYMBOL_SIZE);
    this.border.stroke({ width: 2, color: 0x00FF00, alpha: 1.0 });
    this.border.visible = Symbol.debugOverlayVisible;
    this.border.zIndex = 200; // Поверх всего
    this.cellContainer.addChild(this.border);
    
    // Создаем спрайт текстуры внутри контейнера
    this.sprite = new PIXI.Sprite(symbolTextures[textureIndex]);
    this.sprite.anchor.set(0.5);
    // Используем пропорциональное масштабирование для сохранения соотношения сторон
    const originalWidth = this.sprite.texture.width;
    const originalHeight = this.sprite.texture.height;
    // Вычисляем масштаб для обеих осей, используя минимальный, чтобы текстура помещалась в квадрат
    const scaleX = SYMBOL_TEXTURE_SIZE / originalWidth;
    const scaleY = SYMBOL_TEXTURE_SIZE / originalHeight;
    const uniformScale = Math.min(scaleX, scaleY); // Используем одинаковый масштаб для обеих осей
    this.sprite.scale.set(uniformScale, uniformScale);
    // Сохраняем оригинальный масштаб для использования в update()
    this.originalScaleX = uniformScale;
    this.originalScaleY = uniformScale;
    // Размещаем спрайт в центре контейнера
    this.sprite.x = SYMBOL_SIZE / 2;
    this.sprite.y = SYMBOL_SIZE / 2;
    this.sprite.visible = true; // Показываем текстуру
    
    // Добавляем спрайт в контейнер
    this.cellContainer.addChild(this.sprite);
    
    // Добавляем текстовую метку с индексами (col, row) если они заданы
    if (col !== null && row !== null) {
      this.indexText = new PIXI.Text(
        `${col},${row}`,
        {
          fontFamily: 'Arial',
          fontSize: 12,
          fill: 0xFF00FF, // Фиолетовый цвет для отличия от статической разметки
          fontWeight: 'bold',
          stroke: 0x000000,
          strokeThickness: 2,
          align: 'left'
        }
      );
      // Позиция индекса в правом верхнем углу ячейки (чтобы не пересекаться со статической разметкой)
      this.indexText.x = SYMBOL_SIZE - 30;
      this.indexText.y = 5;
      this.indexText.visible = Symbol.debugOverlayVisible;
      this.indexText.zIndex = 300; // Поверх рамки
      this.cellContainer.addChild(this.indexText);
    }
    
    // Добавляем контейнер в родительский контейнер
    parentContainer.addChild(this.cellContainer);
  }

  startFall() {
    this.isFalling = true;
  }

  update(deltaTime) {
    if (this.isFalling && this.currentY < this.targetY) {
      const distance = this.targetY - this.currentY;
      const moveDistance = this.fallSpeed * deltaTime;
      
      if (moveDistance >= distance) {
        // Достигли цели - точно в центр статической разметки
        this.currentY = this.targetY;
        this.isFalling = false;
        // Восстанавливаем оригинальный масштаб
        this.sprite.scale.set(this.originalScaleX, this.originalScaleY);
      } else {
        this.currentY += moveDistance;
      }
      
      // Обновляем позицию контейнера (вычитаем SYMBOL_SIZE/2 чтобы центр был в currentX, currentY)
      this.cellContainer.x = this.currentX - this.SYMBOL_SIZE / 2;
      this.cellContainer.y = this.currentY - this.SYMBOL_SIZE / 2;
    }
  }

  setPosition(centerX, centerY) {
    // Устанавливаем позицию от геометрического центра
    this.targetX = centerX;
    this.targetY = centerY;
    this.currentX = centerX;
    this.currentY = centerY;
    // Позиционируем контейнер так, чтобы его центр был в (centerX, centerY)
    this.cellContainer.x = centerX - this.SYMBOL_SIZE / 2;
    this.cellContainer.y = centerY - this.SYMBOL_SIZE / 2;
  }

  setTexture(textureIndex) {
    this.textureIndex = textureIndex;
    this.sprite.texture = this.symbolTextures[textureIndex];
    // Пересчитываем пропорциональный масштаб для новой текстуры
    const originalWidth = this.sprite.texture.width;
    const originalHeight = this.sprite.texture.height;
    const scaleX = this.SYMBOL_TEXTURE_SIZE / originalWidth;
    const scaleY = this.SYMBOL_TEXTURE_SIZE / originalHeight;
    const uniformScale = Math.min(scaleX, scaleY); // Используем одинаковый масштаб для обеих осей
    this.sprite.scale.set(uniformScale, uniformScale);
    this.originalScaleX = uniformScale;
    this.originalScaleY = uniformScale;
  }

  /** Включить/выключить отладочные элементы символа (зелёная рамка и индексы) */
  setDebugOverlayVisible(visible) {
    if (this.border) this.border.visible = visible;
    if (this.indexText) this.indexText.visible = visible;
  }

  destroy() {
    if (this.cellContainer && this.cellContainer.parent) {
      this.cellContainer.parent.removeChild(this.cellContainer);
      this.cellContainer.destroy({ children: true });
    }
  }
}
