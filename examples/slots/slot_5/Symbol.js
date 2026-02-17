/**
 * Класс для символа в каскадной слот-игре
 */
import { fontManager } from './FontManager.js';

export class Symbol {
  /** Глобальная видимость отладочных элементов (рамка, индексы) для новых символов */
  static debugOverlayVisible = true;
  /** Алиасы загруженных Spine-ресурсов (устанавливаются из CascadeManager) */
  static spineSkeletonAlias = null;
  static spineAtlasAlias = null;
  /** Алиасы загруженных Spine-ресурсов для бомбы (устанавливаются из CascadeManager) */
  static bombSpineSkeletonAlias = null;
  static bombSpineAtlasAlias = null;
  /** Алиасы загруженных Spine-ресурсов для скаттеров (устанавливаются из CascadeManager) */
  static scatterSpineSkeletonAlias = null;
  static scatterSpineAtlasAlias = null;
  /** Колбэк при ивенте "boom" в анимации бомбы (например тряска поля); вызывается из entry.listener.event */
  static onBombBoomEvent = null;
  /** Колбэк при ивенте "shot" в анимации hit скаттера (для запуска перелёта к сундуку) */
  static onScatterShot = null;
  /** В бонусной игре использовать скины blue_fs / gold_fs / red_fs для скаттеров (выставляется из CascadeManager) */
  static useScatterFsSkins = false;

  constructor(centerX, centerY, textureIndex, parentContainer, symbolTextures, SYMBOL_SIZE, SYMBOL_TEXTURE_SIZE, FALL_SPEED, col = null, row = null) {
    this.parentContainer = parentContainer;
    this.textureIndex = textureIndex;
    this.symbolTextures = symbolTextures;
    this.SYMBOL_SIZE = SYMBOL_SIZE;
    this.SYMBOL_TEXTURE_SIZE = SYMBOL_TEXTURE_SIZE;
    this.FALL_SPEED = FALL_SPEED;
    this.col = col;
    this.row = row;
    
    // Определяем тип символа (бомба имеет textureIndex = 8)
    this.isBomb = (textureIndex === 8);
    
    // Определяем тип символа (скаттеры имеют textureIndex = 9, 10, 11)
    this.isScatter = (textureIndex === 9 || textureIndex === 10 || textureIndex === 11);
    // Определяем тип скаттера для установки скина
    if (this.isScatter) {
      if (textureIndex === 9) {
        this.scatterType = 'blue';
      } else if (textureIndex === 10) {
        this.scatterType = 'gold';
      } else if (textureIndex === 11) {
        this.scatterType = 'red';
      }
    }
    
    // Целевая позиция - центр ячейки из статической сетки
    this.targetX = centerX;
    this.targetY = centerY;
    // Текущая позиция (начинаем сверху экрана)
    // currentX и currentY - это координаты центра контейнера
    this.currentX = centerX;
    this.currentY = -SYMBOL_SIZE / 2; // Начинаем сверху экрана (центр контейнера)
    this.isFalling = false;
    this.fallSpeed = FALL_SPEED;
    this.onLandedCallback = null; // Колбэк при приземлении символа

    // Spine-анимация при приземлении (bounce)
    this.spineInstance = null;
    this.isShowingSpine = false;
    
    // Spine-экземпляр бомбы (постоянный, для idle анимации)
    this.bombSpineInstance = null;
    
    // Spine-экземпляр скаттера (постоянный, для idle анимации)
    this.scatterSpineInstance = null;
    // Флаг для отслеживания проигрывания анимации hit (защита от повторных вызовов)
    this.scatterHitAnimationPlaying = false;
    
    // Создаем контейнер для ячейки размером 100x100
    this.cellContainer = new PIXI.Container();
    this.cellContainer.width = SYMBOL_SIZE;
    this.cellContainer.height = SYMBOL_SIZE;
    // Позиционируем контейнер так, чтобы его центр был в (centerX, centerY)
    // Для этого вычитаем SYMBOL_SIZE/2 из координат (позиция левого верхнего угла)
    this.cellContainer.x = this.currentX - SYMBOL_SIZE / 2;
    this.cellContainer.y = this.currentY - SYMBOL_SIZE / 2;
    // z-index: бомба = 1000, скаттер = 500, обычный символ = 100
    this.cellContainer.zIndex = this.isBomb ? 1000 : (this.isScatter ? 500 : 100);
    // Базовый z-index для восстановления после показа выигрышей
    this._baseZIndex = this.cellContainer.zIndex;
    
    // Создаем тонкую рамку для контейнера (для настройки) - как в SlotReel.js
    this.border = new PIXI.Graphics();
    this.border.rect(0, 0, SYMBOL_SIZE, SYMBOL_SIZE);
    this.border.stroke({ width: 2, color: 0x00FF00, alpha: 1.0 });
    this.border.visible = Symbol.debugOverlayVisible;
    this.border.zIndex = 200; // Поверх всего
    this.cellContainer.addChild(this.border);
    
    // Создаем спрайт текстуры внутри контейнера
    // Защита от выхода за границы массива текстур
    const safeTextureIndex = textureIndex >= 0 && textureIndex < symbolTextures.length 
      ? textureIndex 
      : 0; // Fallback на первую текстуру если индекс невалидный
    
    // Логируем бомбы для отладки
    if (textureIndex === 8) {
      console.log(`💣 [SYMBOL] Создается символ с textureIndex=8 (бомба), safeTextureIndex=${safeTextureIndex}, symbolTextures.length=${symbolTextures.length}`);
    }
    
    this.sprite = new PIXI.Sprite(symbolTextures[safeTextureIndex]);
    this.sprite.anchor.set(0.5);
    // Текстуры уже нарисованы в нужном размере (112x112), масштабирование не требуется
    this.sprite.scale.set(1, 1);
    // Размещаем спрайт в центре контейнера
    this.sprite.x = SYMBOL_SIZE / 2;
    this.sprite.y = SYMBOL_SIZE / 2;
    
    // Для бомбы скрываем текстуру и создаем постоянный Spine экземпляр
    if (this.isBomb) {
      this.sprite.visible = false; // Скрываем текстуру для бомбы
      // Создаём постоянный Spine экземпляр для бомбы
      this.bombSpineInstance = this._createBombSpineInstance();
      if (this.bombSpineInstance) {
        this.cellContainer.addChild(this.bombSpineInstance);
        this.isShowingSpine = true; // Флаг для обновления Spine в update()
      }
    } else if (this.isScatter) {
      // Для скаттера скрываем текстуру и создаем постоянный Spine экземпляр
      this.sprite.visible = false; // Скрываем текстуру для скаттера
      // Создаём постоянный Spine экземпляр для скаттера
      this.scatterSpineInstance = this._createScatterSpineInstance();
      if (this.scatterSpineInstance) {
        this.cellContainer.addChild(this.scatterSpineInstance);
        this.isShowingSpine = true; // Флаг для обновления Spine в update()
      }
    } else {
      this.sprite.visible = true; // Показываем текстуру для обычных символов
    }
    
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
    
    // Сохраняем ссылку на родительский контейнер для пересортировки по z-index
    this._parentContainer = parentContainer;

    // Затемнение при показе выигрыша (символы не из вин-комбинации)
    this._dimFilter = null;
    this._dimmed = false;
  }

  /**
   * Включить/выключить затемнение символа (для не-выигрышных при показе выигрыша).
   * Используется простой эффект: понижение яркости через alpha или ColorMatrixFilter.
   * @param {boolean} dimmed - true = затемнить, false = нормальная яркость
   */
  setDimmed(dimmed) {
    if (this._dimmed === dimmed) return;
    this._dimmed = dimmed;
    if (!this.cellContainer || this.cellContainer.destroyed) return;

    if (dimmed) {
      // Пробуем ColorMatrixFilter (Pixi v8) для затемнения по яркости
      const ColorMatrixFilterClass = typeof PIXI !== 'undefined' && (PIXI.ColorMatrixFilter || (PIXI.filters && PIXI.filters.ColorMatrixFilter));
      if (ColorMatrixFilterClass) {
        if (!this._dimFilter) {
          this._dimFilter = new ColorMatrixFilterClass();
        }
        if (typeof this._dimFilter.brightness === 'function') {
          this._dimFilter.brightness(0.4, false);
        }
        this.cellContainer.filters = this.cellContainer.filters || [];
        if (!this.cellContainer.filters.includes(this._dimFilter)) {
          this.cellContainer.filters = [...this.cellContainer.filters, this._dimFilter];
        }
      } else {
        this.cellContainer.alpha = 0.4;
      }
    } else {
      if (this._dimFilter && this.cellContainer.filters) {
        this.cellContainer.filters = this.cellContainer.filters.filter(f => f !== this._dimFilter);
      }
      this.cellContainer.alpha = 1;
    }
  }

  /**
   * Опустить z-index скаттера во время показа выигрышей (чтобы он был ниже затемнённых символов)
   * @param {boolean} lowered - true = опустить z-index, false = вернуть в исходное состояние
   */
  setWinDisplayZIndex(lowered) {
    if (!this.isScatter || !this.cellContainer || this.cellContainer.destroyed) return;
    
    if (lowered) {
      // Опускаем скаттер ниже затемнённых символов (обычные = 100)
      this.cellContainer.zIndex = 50;
    } else {
      // Возвращаем базовый z-index
      this.cellContainer.zIndex = this._baseZIndex || 500;
    }
  }
  
  /**
   * Возвращает родительский контейнер символа для пересортировки
   * @returns {PIXI.Container|null}
   */
  getParentContainer() {
    return this._parentContainer || null;
  }

  startFall() {
    this.isFalling = true;
  }

  update(deltaTime) {
    // Обновляем Spine бомбы (постоянный экземпляр)
    if (this.isBomb && this.bombSpineInstance && !this.bombSpineInstance.destroyed && 
        this.cellContainer && !this.cellContainer.destroyed &&
        this.cellContainer.children && this.cellContainer.children.includes(this.bombSpineInstance)) {
      try {
        if (this.bombSpineInstance.skeleton && this.bombSpineInstance.skeleton.physics) {
          const physics = this.bombSpineInstance.skeleton.physics;
          const updateFn = physics && physics.update ? physics.update : () => {};
          this.bombSpineInstance.skeleton.updateWorldTransform(updateFn);
        }
      } catch (e) {
        // Игнорируем ошибки обновления
      }
    }
    
    // Обновляем Spine скаттера (постоянный экземпляр)
    if (this.isScatter && this.scatterSpineInstance && !this.scatterSpineInstance.destroyed && 
        this.cellContainer && !this.cellContainer.destroyed &&
        this.cellContainer.children && this.cellContainer.children.includes(this.scatterSpineInstance)) {
      try {
        if (this.scatterSpineInstance.skeleton && this.scatterSpineInstance.skeleton.physics) {
          const physics = this.scatterSpineInstance.skeleton.physics;
          const updateFn = physics && physics.update ? physics.update : () => {};
          this.scatterSpineInstance.skeleton.updateWorldTransform(updateFn);
        }
      } catch (e) {
        // Игнорируем ошибки обновления
      }
    }
    
    // Обновляем Spine только если он существует, не уничтожен и находится в контейнере (для обычных символов)
    if (this.isShowingSpine && this.spineInstance && !this.spineInstance.destroyed && 
        this.cellContainer && !this.cellContainer.destroyed &&
        this.cellContainer.children && this.cellContainer.children.includes(this.spineInstance)) {
      try {
        if (this.spineInstance.skeleton && this.spineInstance.skeleton.physics) {
          const physics = this.spineInstance.skeleton.physics;
          const updateFn = physics && physics.update ? physics.update : () => {};
          this.spineInstance.skeleton.updateWorldTransform(updateFn);
        }
      } catch (e) {
        // Игнорируем ошибки обновления
      }
    }
    if (this.isFalling && this.currentY < this.targetY) {
      const distance = this.targetY - this.currentY;
      const moveDistance = this.fallSpeed * deltaTime;
      
      if (moveDistance >= distance) {
        // Достигли цели - точно в центр статической разметки
        this.currentY = this.targetY;
        this.isFalling = false;
        // Вызываем колбэк приземления
        if (this.onLandedCallback) {
          const callback = this.onLandedCallback;
          this.onLandedCallback = null; // Очищаем ДО вызова, чтобы избежать повторных вызовов
          callback(); // Вызываем колбэк
        }
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

  /** Маппинг textureIndex -> имя скина Spine (из skeleton.json) */
  _getSkinName(textureIndex) {
    const skinNames = [
      'h1_lion',
      'h2_bull',
      'h3_bear',
      'h4_wolf',
      'l1_revolver',
      'l2_ bottle', // с пробелом в skeleton.json
      'l3_horseshoe',
      'l4_cactus'
    ];
    return skinNames[textureIndex % skinNames.length] || skinNames[0];
  }

  /** Создаёт новый изолированный Spine-экземпляр для bounce анимации */
  _createNewSpineInstance() {
    if (typeof spine === 'undefined' || !Symbol.spineSkeletonAlias || !Symbol.spineAtlasAlias) {
      return null;
    }
    
    try {
      const spineInstance = spine.Spine.from({
        skeleton: Symbol.spineSkeletonAlias,
        atlas: Symbol.spineAtlasAlias,
        scale: 1
      });
      
      if (!spineInstance.skeleton.physics) {
        spineInstance.skeleton.physics = {
          update: () => {},
          updateGlobal: () => {}
        };
      }
      
      const skinName = this._getSkinName(this.textureIndex);
      const skin = spineInstance.skeleton.data.findSkin(skinName);
      if (skin) {
        spineInstance.skeleton.setSkin(skin);
        spineInstance.skeleton.setSlotsToSetupPose();
      }
      
      spineInstance.x = this.SYMBOL_SIZE / 2;
      spineInstance.y = this.SYMBOL_SIZE / 2;
      
      // Spine анимации уже нарисованы в нужном размере (112x112), масштабирование не требуется
      spineInstance.scale.set(1, 1);
      
      return spineInstance;
    } catch (e) {
      console.warn('[Symbol] _createNewSpineInstance failed:', e);
      return null;
    }
  }

  /** Создаёт постоянный Spine-экземпляр для бомбы с idle анимацией */
  _createBombSpineInstance() {
    if (typeof spine === 'undefined' || !Symbol.bombSpineSkeletonAlias || !Symbol.bombSpineAtlasAlias) {
      return null;
    }
    
    try {
      const spineInstance = spine.Spine.from({
        skeleton: Symbol.bombSpineSkeletonAlias,
        atlas: Symbol.bombSpineAtlasAlias,
        scale: 1
      });
      
      if (!spineInstance.skeleton.physics) {
        spineInstance.skeleton.physics = {
          update: () => {},
          updateGlobal: () => {}
        };
      }
      
      // Устанавливаем скин bomb_regular (для обычной бомбы)
      const skin = spineInstance.skeleton.data.findSkin('bomb_regular');
      if (skin) {
        spineInstance.skeleton.setSkin(skin);
        spineInstance.skeleton.setSlotsToSetupPose();
      }
      
      // Позиционирование в центре контейнера
      spineInstance.x = this.SYMBOL_SIZE / 2;
      spineInstance.y = this.SYMBOL_SIZE / 2;
      spineInstance.scale.set(1, 1);
      
      // Проигрываем idle анимацию (постоянно зациклена)
      const animations = spineInstance.skeleton.data.animations;
      if (animations) {
        const idleAnim = animations.find(anim => anim.name === 'idle');
        if (idleAnim) {
          spineInstance.state.setAnimation(0, 'idle', true); // loop = true для постоянной анимации
        }
      }

      // Прикрепляем текст "x5" в слот text_holder (стиль x2000, fontSize 37*2=74)
      const textSlot = spineInstance.skeleton.findSlot('text_holder');
      if (textSlot) {
        try {
          const textSprite = fontManager.createText('x2000', 'x5', { fontSize: 74 });
          textSprite.anchor.set(0.5);
          spineInstance.addSlotObject('text_holder', textSprite);

          // Синхронизация альфы текста с альфой слота (наследование анимаций исчезновения)
          const originalAfterUpdate = spineInstance.afterUpdateWorldTransforms;
          spineInstance.afterUpdateWorldTransforms = () => {
            if (originalAfterUpdate) originalAfterUpdate.call(spineInstance);
            if (textSlot?.color && textSprite && !textSprite.destroyed) {
              textSprite.alpha = textSlot.color.a;
            }
          };
          textSprite.alpha = textSlot.color.a;
        } catch (e) {
          console.warn('[Symbol] Не удалось прикрепить текст к text_holder:', e);
        }
      }

      return spineInstance;
    } catch (e) {
      console.warn('[Symbol] _createBombSpineInstance failed:', e);
      return null;
    }
  }

  /** Создаёт постоянный Spine-экземпляр для скаттера с idle анимацией */
  _createScatterSpineInstance() {
    if (typeof spine === 'undefined' || !Symbol.scatterSpineSkeletonAlias || !Symbol.scatterSpineAtlasAlias) {
      return null;
    }
    
    try {
      const spineInstance = spine.Spine.from({
        skeleton: Symbol.scatterSpineSkeletonAlias,
        atlas: Symbol.scatterSpineAtlasAlias,
        scale: 1
      });
      
      if (!spineInstance.skeleton.physics) {
        spineInstance.skeleton.physics = {
          update: () => {},
          updateGlobal: () => {}
        };
      }
      
      // Устанавливаем скин: в бонусной игре — blue_fs / gold_fs / red_fs, иначе blue / gold / red
      if (this.scatterType) {
        const skinName = Symbol.useScatterFsSkins ? (this.scatterType + '_fs') : this.scatterType;
        let skin = spineInstance.skeleton.data.findSkin(skinName);
        if (!skin) skin = spineInstance.skeleton.data.findSkin(this.scatterType);
        if (skin) {
          spineInstance.skeleton.setSkin(skin);
          spineInstance.skeleton.setSlotsToSetupPose();
        }
      }
      
      // Позиционирование в центре контейнера
      spineInstance.x = this.SYMBOL_SIZE / 2;
      spineInstance.y = this.SYMBOL_SIZE / 2;
      spineInstance.scale.set(1, 1);
      
      // Проигрываем idle анимацию (постоянно зациклена)
      const animations = spineInstance.skeleton.data.animations;
      if (animations) {
        const idleAnim = animations.find(anim => anim.name === 'idle');
        if (idleAnim) {
          spineInstance.state.setAnimation(0, 'idle', true); // loop = true для постоянной анимации
        }
      }

      return spineInstance;
    } catch (e) {
      console.warn('[Symbol] _createScatterSpineInstance failed:', e);
      return null;
    }
  }

  /**
   * Проигрывает анимацию hit для скаттера: hit один раз на треке 0, затем переключается на idle_null в цикле
   */
  playScatterHitAnimation() {
    console.log('🔵 playScatterHitAnimation called', {
      isScatter: this.isScatter,
      hasSpine: !!this.scatterSpineInstance,
      alreadyPlaying: this.scatterHitAnimationPlaying,
      scatterType: this.scatterType
    });
    
    if (!this.isScatter || !this.scatterSpineInstance) return;
    
    // Защита от повторных вызовов: если анимация уже проигрывается, игнорируем вызов
    if (this.scatterHitAnimationPlaying) {
      console.log('⚠️ Animation already playing, skipping');
      return;
    }
    
    // Устанавливаем флаг, что анимация проигрывается
    this.scatterHitAnimationPlaying = true;
    
    // Проигрываем hit один раз на треке 0 (заменяя idle)
    const hitEntry = this.scatterSpineInstance.state.setAnimation(0, 'hit', false);
    if (hitEntry) {
      const self = this;
      hitEntry.listener = {
        event: (entry, event) => {
          console.log(`🔴 [Symbol] Spine event: ${event.data.name}`);
          // Слушаем событие "shot" для запуска перелёта к сундуку
          if (event.data.name === 'shot') {
            console.log(`🎯 [Symbol] Событие shot от скаттера ${self.scatterType} в позиции (${self.col}, ${self.row})`);
            console.log(`🎯 [Symbol] onScatterShot callback exists: ${!!Symbol.onScatterShot}`);
            if (Symbol.onScatterShot) {
              Symbol.onScatterShot(self);
            }
          }
        },
        complete: () => {
          // После завершения hit переключаемся на idle_null в цикле
          self.scatterSpineInstance.state.setAnimation(0, 'idle_null', true);
          // Сбрасываем флаг после завершения анимации
          self.scatterHitAnimationPlaying = false;
        }
      };
    } else {
      // Если анимация hit не найдена, сразу переключаемся на idle_null
      this.scatterSpineInstance.state.setAnimation(0, 'idle_null', true);
      // Сбрасываем флаг, так как анимация не была найдена
      this.scatterHitAnimationPlaying = false;
    }
  }

  /**
   * Проигрывает анимацию boom для скаттера (при попадании под взрыв бомбы).
   * После завершения возвращается к текущей анимации (idle или idle_null).
   */
  playScatterBoomAnimation() {
    if (!this.isScatter || !this.scatterSpineInstance) return;
    
    console.log(`💥 [Scatter] Playing boom animation for scatter type: ${this.scatterType}`);
    
    // Сохраняем текущую анимацию для возврата после boom
    const currentTrack = this.scatterSpineInstance.state.getCurrent(0);
    const currentAnimName = currentTrack && currentTrack.animation ? currentTrack.animation.name : 'idle';
    const wasLooping = currentTrack ? currentTrack.loop : true;
    
    // Проигрываем boom один раз
    const boomEntry = this.scatterSpineInstance.state.setAnimation(0, 'boom', false);
    if (boomEntry) {
      const self = this;
      boomEntry.listener = {
        complete: () => {
          // Возвращаемся к предыдущей анимации
          if (self.scatterSpineInstance && !self.scatterSpineInstance.destroyed) {
            self.scatterSpineInstance.state.setAnimation(0, currentAnimName, wasLooping);
          }
        }
      };
    } else {
      console.warn(`[Scatter] boom animation not found, staying on current animation`);
    }
  }

  /**
   * Создаёт Spine-экземпляр бомбы для оверлея (без маски), с текстом мультипликатора в text_holder.
   * @param {string} [multiplierText='x5'] - текст типа "x5"
   * @returns {spine.Spine|null}
   */
  static createBombSpineOverlayInstance(multiplierText = 'x5') {
    if (typeof spine === 'undefined' || !Symbol.bombSpineSkeletonAlias || !Symbol.bombSpineAtlasAlias) {
      return null;
    }
    try {
      const spineInstance = spine.Spine.from({
        skeleton: Symbol.bombSpineSkeletonAlias,
        atlas: Symbol.bombSpineAtlasAlias,
        scale: 1
      });
      if (!spineInstance.skeleton.physics) {
        spineInstance.skeleton.physics = { update: () => {}, updateGlobal: () => {} };
      }
      const skin = spineInstance.skeleton.data.findSkin('bomb_regular');
      if (skin) {
        spineInstance.skeleton.setSkin(skin);
        spineInstance.skeleton.setSlotsToSetupPose();
      }
      spineInstance.x = 0;
      spineInstance.y = 0;
      spineInstance.scale.set(1, 1);

      const textSlot = spineInstance.skeleton.findSlot('text_holder');
      if (textSlot) {
        try {
          const textSprite = fontManager.createText('x2000', multiplierText, { fontSize: 74 });
          textSprite.anchor.set(0.5);
          spineInstance.addSlotObject('text_holder', textSprite);
          const originalAfterUpdate = spineInstance.afterUpdateWorldTransforms;
          spineInstance.afterUpdateWorldTransforms = () => {
            if (originalAfterUpdate) originalAfterUpdate.call(spineInstance);
            if (textSlot?.color && textSprite && !textSprite.destroyed) {
              textSprite.alpha = textSlot.color.a;
            }
          };
          textSprite.alpha = textSlot.color.a;
        } catch (e) {
          console.warn('[Symbol] createBombSpineOverlayInstance: текст в text_holder не прикреплён', e);
        }
      }
      return spineInstance;
    } catch (e) {
      console.warn('[Symbol] createBombSpineOverlayInstance failed:', e);
      return null;
    }
  }

  /**
   * Проигрывает на переданном Spine бомбы анимацию выигрыша big_start → big_boom, по завершении вызывает onComplete.
   * @param {spine.Spine} spineInstance
   * @param {function} onComplete
   */
  static playBombWinAnimationOnSpine(spineInstance, onComplete) {
    if (!spineInstance || !spineInstance.state) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    const finish = () => {
      requestAnimationFrame(() => { if (typeof onComplete === 'function') onComplete(); });
    };
    const onBoomEvent = (trackEntry, e) => {
      if (e && e.data && e.data.name === 'boom' && typeof Symbol.onBombBoomEvent === 'function') {
        Symbol.onBombBoomEvent();
      }
    };
    const playBigBoom = () => {
      const entry2 = spineInstance.state.setAnimation(0, 'big_boom', false);
      if (entry2) {
        entry2.listener = { event: onBoomEvent, complete: finish };
      } else {
        finish();
      }
    };
    const entry1 = spineInstance.state.setAnimation(0, 'big_start', false);
    if (entry1) {
      entry1.listener = { event: onBoomEvent, complete: playBigBoom };
    } else {
      finish();
    }
  }

  /** Показать Spine, проиграть bounce, по завершении вернуть текстуру и уничтожить экземпляр */
  showSpineAnimation(animationName) {
    // Для бомбы используем постоянный Spine экземпляр
    if (this.isBomb && this.bombSpineInstance) {
      if (!this.cellContainer || this.cellContainer.destroyed) {
        return;
      }
      // Проигрываем bounce поверх idle анимации
      const entry = this.bombSpineInstance.state.setAnimation(1, 'bounce', false);
      if (entry) {
        entry.listener = {
          complete: () => {
            // После завершения bounce возвращаемся к idle (idle уже играет на треке 0)
            // Просто удаляем трек bounce
            this.bombSpineInstance.state.clearTrack(1);
          }
        };
      }
      return;
    }
    
    // Для скаттера используем постоянный Spine экземпляр
    if (this.isScatter && this.scatterSpineInstance) {
      if (!this.cellContainer || this.cellContainer.destroyed) {
        return;
      }
      // Проигрываем bounce поверх текущей анимации (idle или idle_null)
      if (animationName === 'bounce') {
        const entry = this.scatterSpineInstance.state.setAnimation(1, 'bounce', false);
        if (entry) {
          entry.listener = {
            complete: () => {
              // После завершения bounce удаляем трек bounce
              this.scatterSpineInstance.state.clearTrack(1);
            }
          };
        }
      }
      return;
    }
    
    // Для обычных символов - стандартная логика
    if (typeof spine === 'undefined' || !Symbol.spineSkeletonAlias) {
      return;
    }
    if (!this.cellContainer || this.cellContainer.destroyed) {
      return;
    }
    // Если уже показываем Spine, не создаем новый
    if (this.isShowingSpine) {
      return;
    }
    
    // Создаем новый изолированный экземпляр для этой анимации
    const spineInstance = this._createNewSpineInstance();
    if (!spineInstance) {
      return;
    }
    
    // Сохраняем ссылку
    this.spineInstance = spineInstance;
    this.isShowingSpine = true;
    
    // Скрываем текстуру
    if (this.sprite) {
      this.sprite.visible = false;
    }
    
    // Добавляем Spine в контейнер
    this.cellContainer.addChild(spineInstance);
    
    // Проигрываем bounce один раз
    const self = this;
    const entry = spineInstance.state.setAnimation(0, 'bounce', false);
    if (entry) {
      entry.listener = {
        complete: () => {
          // Используем requestAnimationFrame для синхронизации с циклом рендеринга
          requestAnimationFrame(() => {
            // Удаляем из контейнера
            if (self.cellContainer && !self.cellContainer.destroyed && spineInstance && self.cellContainer.children && self.cellContainer.children.includes(spineInstance)) {
              try {
                self.cellContainer.removeChild(spineInstance);
              } catch (e) {
                // Игнорируем ошибки удаления
              }
            }
            
            // Показываем текстуру
            if (self.sprite) {
              self.sprite.visible = true;
            }
            
            // Очищаем ссылку сразу
            if (self.spineInstance === spineInstance) {
              self.spineInstance = null;
              self.isShowingSpine = false;
            }
            
            // Уничтожаем экземпляр в следующем кадре после удаления из дерева рендеринга
            requestAnimationFrame(() => {
              if (spineInstance && spineInstance.destroy && !spineInstance.destroyed) {
                try {
                  if (spineInstance.state) {
                    spineInstance.state.clearTracks();
                  }
                  spineInstance.destroy();
                } catch (e) {
                  // Игнорируем ошибки при уничтожении
                }
              }
            });
          });
        }
      };
    }
  }

  /**
   * Показать анимацию выигрыша: текстура скрывается, Spine проигрывает win → [win] → disappearance,
   * затем Spine удаляется и вызывается onComplete.
   * Для бомб: boom или big_start → big_boom (при opts.useBigBomb).
   * @param {function} onComplete - вызывается после завершения
   * @param {Object} [opts] - doubleWin: 2 цикла win для символов; useBigBomb: big_start → big_boom для бомбы
   */
  showWinAnimation(onComplete, opts = {}) {
    // Для скаттера не вызываем (они не участвуют в выигрышах)
    if (this.isScatter) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    
    // Для бомбы: big_start → big_boom (multiplier сценарий) или boom
    if (this.isBomb && this.bombSpineInstance) {
      if (!this.cellContainer || this.cellContainer.destroyed) {
        if (typeof onComplete === 'function') onComplete();
        return;
      }
      
      const useBigBomb = opts.useBigBomb === true;
      const anim1 = useBigBomb ? 'big_start' : 'boom';
      const anim2 = useBigBomb ? 'big_boom' : null;

      const self = this;
      const finish = () => { requestAnimationFrame(() => { if (typeof onComplete === 'function') onComplete(); }); };
      const onBoomEvent = (trackEntry, e) => {
        if (e && e.data && e.data.name === 'boom' && typeof Symbol.onBombBoomEvent === 'function') {
          Symbol.onBombBoomEvent();
        }
      };

      const playNext = () => {
        const entry2 = self.bombSpineInstance.state.setAnimation(0, anim2, false);
        if (entry2) {
          entry2.listener = { event: onBoomEvent, complete: finish };
        } else {
          finish();
        }
      };

      const entry = this.bombSpineInstance.state.setAnimation(0, anim1, false);
      if (entry) {
        entry.listener = {
          event: onBoomEvent,
          complete: () => {
            if (anim2) playNext(); else finish();
          }
        };
      } else {
        finish();
      }
      return;
    }
    
    // Для обычных символов - стандартная логика
    if (typeof spine === 'undefined' || !Symbol.spineSkeletonAlias) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    if (!this.cellContainer || this.cellContainer.destroyed) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    this.hideSpineAnimation();
    if (this.sprite) this.sprite.visible = false;

    const spineInstance = this._createNewSpineInstance();
    if (!spineInstance) {
      if (this.sprite) this.sprite.visible = true;
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    this.spineInstance = spineInstance;
    this.isShowingSpine = true;
    this.cellContainer.addChild(spineInstance);

    const doubleWin = opts.doubleWin === true;
    spineInstance.state.setAnimation(0, 'win', false);
    if (doubleWin) spineInstance.state.addAnimation(0, 'win', false, 0);
    const entryDisappearance = spineInstance.state.addAnimation(0, 'disappearance', false, 0);
    const self = this;
    if (entryDisappearance) {
      entryDisappearance.listener = {
        complete: () => {
          requestAnimationFrame(() => {
            if (self.cellContainer && !self.cellContainer.destroyed && spineInstance && self.cellContainer.children && self.cellContainer.children.includes(spineInstance)) {
              try { self.cellContainer.removeChild(spineInstance); } catch (e) {}
            }
            if (self.spineInstance === spineInstance) {
              self.spineInstance = null;
              self.isShowingSpine = false;
            }
            requestAnimationFrame(() => {
              if (spineInstance && spineInstance.destroy && !spineInstance.destroyed) {
                try {
                  if (spineInstance.state) spineInstance.state.clearTracks();
                  spineInstance.destroy();
                } catch (e) {}
              }
              if (typeof onComplete === 'function') onComplete();
            });
          });
        }
      };
    } else {
      if (self.spineInstance === spineInstance) {
        self.spineInstance = null;
        self.isShowingSpine = false;
      }
      try { if (spineInstance.destroy && !spineInstance.destroyed) spineInstance.destroy(); } catch (e) {}
      if (typeof onComplete === 'function') onComplete();
    }
  }

  /**
   * Показать анимацию исчезновения от взрыва бомбы (boom_disappearance).
   * Вызывается по ивенту "boom" от бомбы для символов-соседей (spin-bomb / cascade-bomb).
   * @param {function} onComplete - вызывается после завершения анимации
   */
  showBoomDisappearance(onComplete) {
    // Для бомбы не вызываем
    if (this.isBomb) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    
    // Для скаттера не вызываем (они неуязвимы к взрывам)
    if (this.isScatter) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    if (typeof spine === 'undefined' || !Symbol.spineSkeletonAlias) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    if (!this.cellContainer || this.cellContainer.destroyed) {
      if (typeof onComplete === 'function') onComplete();
      return;
    }
    this.hideSpineAnimation();
    if (this.sprite) this.sprite.visible = false;

    const spineInstance = this._createNewSpineInstance();
    if (!spineInstance) {
      if (this.sprite) this.sprite.visible = true;
      if (typeof onComplete === 'function') onComplete();
      return;
    }

    this.spineInstance = spineInstance;
    this.isShowingSpine = true;
    this.cellContainer.addChild(spineInstance);

    const entry = spineInstance.state.setAnimation(0, 'boom_disappearance', false);
    const self = this;
    if (entry) {
      entry.listener = {
        complete: () => {
          requestAnimationFrame(() => {
            if (self.cellContainer && !self.cellContainer.destroyed && spineInstance && self.cellContainer.children && self.cellContainer.children.includes(spineInstance)) {
              try { self.cellContainer.removeChild(spineInstance); } catch (e) {}
            }
            if (self.spineInstance === spineInstance) {
              self.spineInstance = null;
              self.isShowingSpine = false;
            }
            requestAnimationFrame(() => {
              if (spineInstance && spineInstance.destroy && !spineInstance.destroyed) {
                try {
                  if (spineInstance.state) spineInstance.state.clearTracks();
                  spineInstance.destroy();
                } catch (e) {}
              }
              if (typeof onComplete === 'function') onComplete();
            });
          });
        }
      };
    } else {
      if (self.spineInstance === spineInstance) {
        self.spineInstance = null;
        self.isShowingSpine = false;
      }
      try { if (spineInstance.destroy && !spineInstance.destroyed) spineInstance.destroy(); } catch (e) {}
      if (typeof onComplete === 'function') onComplete();
    }
  }

  /** Скрыть Spine и снова показать текстуру (fallback на случай если колбэк не сработал) */
  hideSpineAnimation() {
    // Для бомбы не скрываем Spine (он постоянный)
    if (this.isBomb) {
      return;
    }
    
    // Для скаттера не скрываем Spine (он постоянный)
    if (this.isScatter) {
      return;
    }
    
    if (!this.cellContainer || this.cellContainer.destroyed) {
      this.isShowingSpine = false;
      return;
    }
    
    // Удаляем Spine из контейнера
    if (this.spineInstance && this.cellContainer.children && this.cellContainer.children.includes(this.spineInstance)) {
      try {
        this.cellContainer.removeChild(this.spineInstance);
      } catch (e) {
        // Игнорируем ошибки
      }
    }
    
    // Уничтожаем экземпляр
    if (this.spineInstance) {
      try {
        if (this.spineInstance.state) {
          this.spineInstance.state.clearTracks();
        }
        if (this.spineInstance.destroy && !this.spineInstance.destroyed) {
          this.spineInstance.destroy();
        }
      } catch (e) {
        // Игнорируем ошибки
      }
      this.spineInstance = null;
    }
    
    // Показываем текстуру
    if (this.sprite) {
      this.sprite.visible = true;
    }
    
    this.isShowingSpine = false;
  }

  setTexture(textureIndex) {
    this.textureIndex = textureIndex;
    // Защита от выхода за границы массива текстур
    const safeTextureIndex = textureIndex >= 0 && textureIndex < this.symbolTextures.length 
      ? textureIndex 
      : 0; // Fallback на первую текстуру если индекс невалидный
    this.sprite.texture = this.symbolTextures[safeTextureIndex];
    // Текстуры уже нарисованы в нужном размере (112x112), масштабирование не требуется
    this.sprite.scale.set(1, 1);
  }

  /** Включить/выключить отладочные элементы символа (зелёная рамка и индексы) */
  setDebugOverlayVisible(visible) {
    if (this.border) this.border.visible = visible;
    if (this.indexText) this.indexText.visible = visible;
  }

  destroy() {
    // Очищаем колбэк, чтобы избежать вызовов после уничтожения
    this.onLandedCallback = null;
    
    // Уничтожаем Spine экземпляр бомбы (постоянный)
    if (this.isBomb && this.bombSpineInstance) {
      try {
        // Удаляем текст из слота text_holder
        try {
          this.bombSpineInstance.removeSlotObject('text_holder');
        } catch (e) {}
        // Останавливаем все анимации и очищаем listeners
        if (this.bombSpineInstance.state) {
          this.bombSpineInstance.state.clearTracks();
          // Очищаем listeners чтобы колбэки не вызывались
          const tracks = this.bombSpineInstance.state.tracks;
          if (tracks) {
            for (let i = 0; i < tracks.length; i++) {
              const track = tracks[i];
              if (track && track.entry && track.entry.listener) {
                track.entry.listener = null;
              }
            }
          }
        }
        
        // Удаляем из контейнера перед уничтожением
        if (this.cellContainer && !this.cellContainer.destroyed && 
            this.cellContainer.children && this.cellContainer.children.includes(this.bombSpineInstance)) {
          this.cellContainer.removeChild(this.bombSpineInstance);
        }
        
        // Уничтожаем экземпляр только если он не уничтожен
        if (this.bombSpineInstance && this.bombSpineInstance.destroy && !this.bombSpineInstance.destroyed) {
          this.bombSpineInstance.destroy();
        }
      } catch (e) {
        // Игнорируем ошибки при уничтожении
      }
      this.bombSpineInstance = null;
    }
    
    // Уничтожаем Spine экземпляр скаттера (постоянный)
    if (this.isScatter && this.scatterSpineInstance) {
      try {
        // Останавливаем все анимации и очищаем listeners
        if (this.scatterSpineInstance.state) {
          this.scatterSpineInstance.state.clearTracks();
          // Очищаем listeners чтобы колбэки не вызывались
          const tracks = this.scatterSpineInstance.state.tracks;
          if (tracks) {
            for (let i = 0; i < tracks.length; i++) {
              const track = tracks[i];
              if (track && track.entry && track.entry.listener) {
                track.entry.listener = null;
              }
            }
          }
        }
        
        // Удаляем из контейнера перед уничтожением
        if (this.cellContainer && !this.cellContainer.destroyed && 
            this.cellContainer.children && this.cellContainer.children.includes(this.scatterSpineInstance)) {
          this.cellContainer.removeChild(this.scatterSpineInstance);
        }
        
        // Уничтожаем экземпляр только если он не уничтожен
        if (this.scatterSpineInstance && this.scatterSpineInstance.destroy && !this.scatterSpineInstance.destroyed) {
          this.scatterSpineInstance.destroy();
        }
      } catch (e) {
        // Игнорируем ошибки при уничтожении
      }
      this.scatterSpineInstance = null;
    }
    this.isShowingSpine = false;
    
    // Уничтожаем Spine экземпляр только при полном уничтожении символа
    if (this.spineInstance) {
      try {
        // Останавливаем все анимации и очищаем listeners
        if (this.spineInstance.state) {
          this.spineInstance.state.clearTracks();
          // Очищаем listeners чтобы колбэки не вызывались
          const tracks = this.spineInstance.state.tracks;
          if (tracks) {
            for (let i = 0; i < tracks.length; i++) {
              const track = tracks[i];
              if (track && track.entry && track.entry.listener) {
                track.entry.listener = null;
              }
            }
          }
        }
        
        // Удаляем из контейнера перед уничтожением
        if (this.cellContainer && !this.cellContainer.destroyed && this.cellContainer.children && this.cellContainer.children.includes(this.spineInstance)) {
          this.cellContainer.removeChild(this.spineInstance);
        }
        
        // Уничтожаем экземпляр только если он не уничтожен
        if (this.spineInstance && this.spineInstance.destroy && !this.spineInstance.destroyed) {
          this.spineInstance.destroy();
        }
      } catch (e) {
        // Игнорируем ошибки при уничтожении
      }
      this.spineInstance = null;
    }
    
    // Уничтожаем контейнер
    if (this.cellContainer && this.cellContainer.parent) {
      this.cellContainer.parent.removeChild(this.cellContainer);
      this.cellContainer.destroy({ children: true });
    }
  }
}
