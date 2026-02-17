/**
 * Класс для символа в каскадной слот-игре
 */
export class Symbol {
  /** Глобальная видимость отладочных элементов (рамка, индексы) для новых символов */
  static debugOverlayVisible = true;
  /** Алиасы загруженных Spine-ресурсов (устанавливаются из CascadeManager) */
  static spineSkeletonAlias = null;
  static spineAtlasAlias = null;

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
    this.onLandedCallback = null; // Колбэк при приземлении символа

    // Spine-анимация при приземлении (bounce)
    this.spineInstance = null;
    this.isShowingSpine = false;
    
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
    // Текстуры уже нарисованы в нужном размере (112x112), масштабирование не требуется
    this.sprite.scale.set(1, 1);
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
    // Обновляем Spine только если он существует, не уничтожен и находится в контейнере
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

  /** Показать Spine, проиграть bounce, по завершении вернуть текстуру и уничтожить экземпляр */
  showSpineAnimation() {
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
   * Показать анимацию выигрыша: текстура скрывается, Spine проигрывает win → disappearance,
   * затем Spine удаляется и вызывается onComplete. Текстуру обратно не показываем — символ будет уничтожен.
   * @param {function} onComplete - вызывается после завершения disappearance
   */
  showWinAnimation(onComplete) {
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

    spineInstance.state.setAnimation(0, 'win', false);
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

  /** Скрыть Spine и снова показать текстуру (fallback на случай если колбэк не сработал) */
  hideSpineAnimation() {
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
    this.sprite.texture = this.symbolTextures[textureIndex];
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
