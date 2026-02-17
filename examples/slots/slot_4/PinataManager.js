/**
 * PinataManager - управление Spine объектом пиньяты
 */
export class PinataManager {
  constructor(app, config) {
    this.app = app;
    this.config = config;
    this.pinata = null;
    this.log = (msg) => console.log(`[PinataManager] ${msg}`);
    this.idleSwitchEnabled = false;
    this.idleAnimations = {
      a: "00_idle_a_1",
      b: "01_idle_b_1"
    };
    this.idleTrackIndex = 0;
    this.isPlayingOneshot = false; // Флаг для защиты от повторных вызовов
    
    // Система уровней пиньяты
    this.currentLevel = 1; // Текущий уровень (1, 2 или 3)
    
    // Наборы анимаций для каждого уровня
    this.levelAnimations = {
      1: {
        idle_a: "00_idle_a_1",
        idle_b: "01_idle_b_1",
        hit: "02_hit_1",
        shoot: "03_shoot_1",
        hitup: "04_hitup_1",
        boom: "05_boom_1"
      },
      2: {
        idle_a: "06_idle_a_2",
        idle_b: "07_idle_b_2",
        hit: "08_hit_2",
        shoot: "09_shoot_2",
        hitup: "10_hitup_2",
        boom: "11_boom_2"
      },
      3: {
        idle_a: "12_idle_a_3",
        idle_b: "13_idle_b_3",
        hit: "14_hit_3",
        shoot: "15_shoot_3",
        hitup: "10_hitup_2", // Используем hitup_2 для перехода с уровня 3 на уровень 1
        boom: "16_boom_3"
      }
    };
    
    // Соотношения для idle switch на каждом уровне
    // ratioA означает соотношение idle_a : idle_b
    // Например, ratioA = 5 означает, что idle_a играется в 5 раз чаще (5:1)
    // Очень большое значение (1000/1) означает, что idle_b практически никогда не играется
    this.levelIdleRatios = {
      1: 1000/1, // Уровень 1: 10:0 (idle_a играется всегда, idle_b практически никогда)
      2: 2/1,    // Уровень 2: 2:1 (idle_a играется в 2 раза чаще, чем idle_b)
      3: 1/4     // Уровень 3: 1:4 (idle_b играется в 4 раза чаще, чем idle_a)
    };
    
    // Текущее соотношение для idle switch
    this.currentIdleRatio = this.levelIdleRatios[1];
  }

  /**
   * Инициализация пиньяты
   * @param {string} skeletonAlias - алиас скелета из PIXI.Assets
   * @param {string} atlasAlias - алиас атласа из PIXI.Assets
   * @param {Object} options - опции инициализации
   * @param {string} options.skin - имя скина (по умолчанию "big")
   * @param {string} options.animation - имя начальной анимации (по умолчанию "00_idle_a_1")
   * @param {boolean} options.loop - зациклена ли анимация (по умолчанию true)
   * @param {number} options.x - позиция X (по умолчанию центр экрана)
   * @param {number} options.y - позиция Y (по умолчанию центр экрана)
   * @param {number} options.zIndex - zIndex (по умолчанию 3)
   * @param {number} options.scale - масштаб (по умолчанию 1)
   */
  async init(skeletonAlias, atlasAlias, options = {}) {
    const {
      skin = "big",
      animation = "00_idle_a_1",
      loop = true,
      x = this.config.width / 2,
      y = this.config.height / 2,
      zIndex = 3,
      scale = 1
    } = options;

    // Создаем Spine объект пиньяты
    this.pinata = spine.Spine.from({
      skeleton: skeletonAlias,
      atlas: atlasAlias,
      scale: scale,
    });

    // Устанавливаем физику, если нужно
    if (!this.pinata.skeleton.physics) {
      this.pinata.skeleton.physics = {
        update: () => {},
        updateGlobal: () => {},
      };
    }

    // Устанавливаем позицию и zIndex
    this.pinata.x = x;
    this.pinata.y = y;
    this.pinata.zIndex = zIndex;

    // Добавляем на stage
    this.app.stage.addChild(this.pinata);

    // Ждем один кадр для корректной работы bounds
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Устанавливаем скин
    await this.setSkin(skin);

    // Запускаем анимацию
    await this.playAnimation(animation, loop);

    // Ждем еще один кадр после установки скина и анимации
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Регистрируем обновление в ticker
    this.app.ticker.add(() => {
      if (this.pinata && this.pinata.skeleton && this.pinata.skeleton.physics) {
        this.pinata.skeleton.updateWorldTransform(this.pinata.skeleton.physics.update);
      }
    });

    this.log('Pinata initialized');
    return this.pinata;
  }

  /**
   * Установка скина
   * @param {string} skinName - имя скина
   */
  async setSkin(skinName) {
    if (!this.pinata) {
      this.log('⚠️ Pinata not initialized');
      return false;
    }

    const skin = this.pinata.skeleton.data.findSkin(skinName);
    if (skin) {
      this.pinata.skeleton.setSkin(skin);
      this.pinata.skeleton.setSlotsToSetupPose();
      if (this.pinata.skeleton.physics && this.pinata.skeleton.physics.update) {
        this.pinata.skeleton.updateWorldTransform(this.pinata.skeleton.physics.update);
      }
      this.log(`Skin "${skinName}" установлен`);
      return true;
    } else {
      const availableSkins = this.pinata.skeleton.data.skins.map(s => s.name).join(", ");
      this.log(`⚠️ Скин "${skinName}" не найден. Доступные скины: ${availableSkins}`);
      return false;
    }
  }

  /**
   * Воспроизведение анимации
   * @param {string} animationName - имя анимации
   * @param {boolean} loop - зациклена ли анимация
   * @param {number} trackIndex - индекс трека (по умолчанию 0)
   * @param {number} mixDuration - длительность смешивания (по умолчанию 0.1)
   */
  playAnimation(animationName, loop = true, trackIndex = 0, mixDuration = 0.1) {
    if (!this.pinata) {
      this.log('⚠️ Pinata not initialized');
      return null;
    }

    const entry = this.pinata.state.setAnimation(trackIndex, animationName, loop);
    if (entry) {
      entry.mixDuration = mixDuration;
      this.log(`Анимация "${animationName}" запущена (loop: ${loop})`);
      return entry;
    } else {
      const availableAnimations = this.pinata.skeleton.data.animations.map(a => a.name).join(", ");
      this.log(`⚠️ Анимация "${animationName}" не найдена. Доступные анимации: ${availableAnimations}`);
      return null;
    }
  }

  /**
   * Определение типа анимации по имени
   * @param {string} animationName - имя анимации (например, "02_hit_1" -> "hit")
   * @returns {string|null} тип анимации или null, если не удалось определить
   */
  getAnimationType(animationName) {
    // Проверяем, является ли это уже типом
    const animationTypes = ['hit', 'shoot', 'hitup', 'boom'];
    if (animationTypes.includes(animationName)) {
      return animationName;
    }
    
    // Определяем тип по имени анимации (например, "02_hit_1" -> "hit")
    if (animationName.includes('_hit_') || animationName.includes('hit_')) {
      return 'hit';
    } else if (animationName.includes('_shoot_') || animationName.includes('shoot_')) {
      return 'shoot';
    } else if (animationName.includes('_hitup_') || animationName.includes('hitup_')) {
      return 'hitup';
    } else if (animationName.includes('_boom_') || animationName.includes('boom_')) {
      return 'boom';
    }
    
    return null;
  }

  /**
   * Воспроизведение разовой анимации (возвращается к idle после завершения)
   * @param {string} animationName - имя анимации (может быть полным именем или типом: 'hit', 'shoot', 'hitup', 'boom')
   * @param {number} trackIndex - индекс трека (по умолчанию 0)
   * @param {number} mixDuration - длительность смешивания (по умолчанию 0.25)
   */
  playOneshotAnimation(animationName, trackIndex = 0, mixDuration = 0.25) {
    if (!this.pinata) {
      this.log('⚠️ Pinata not initialized');
      return null;
    }

    // Определяем тип анимации по имени (автоматически для полных имен типа "02_hit_1")
    const animationType = this.getAnimationType(animationName);
    
    // Если удалось определить тип, используем анимацию текущего уровня
    // Это позволяет автоматически переключаться на анимации уровня 2 после перехода
    let finalAnimationName = animationName;
    if (animationType) {
      finalAnimationName = this.getAnimationName(animationType);
      if (!finalAnimationName) {
        this.log(`⚠️ Не удалось получить анимацию типа "${animationType}" для уровня ${this.currentLevel}`);
        return null;
      }
      this.log(`Автоматически определена анимация: "${animationName}" -> "${animationType}" -> "${finalAnimationName}" (уровень ${this.currentLevel})`);
    }

    // Проверяем, является ли это анимацией "hitup" (переход уровня)
    const isHitup = finalAnimationName.includes('hitup');
    
    // Определяем переход уровня:
    // - Уровень 1 + 04_hitup_1 → уровень 2
    // - Уровень 2 + 10_hitup_2 → уровень 3
    // - Уровень 3 + 10_hitup_2 → уровень 1 (циклический переход)
    let nextLevel = null;
    if (isHitup) {
      if (this.currentLevel === 1 && finalAnimationName.includes('_1')) {
        nextLevel = 2; // 1 → 2
      } else if (this.currentLevel === 2 && finalAnimationName.includes('_2')) {
        nextLevel = 3; // 2 → 3
      } else if (this.currentLevel === 3 && finalAnimationName.includes('_2')) {
        nextLevel = 1; // 3 → 1 (циклический)
      }
    }
    const isLevelTransition = nextLevel !== null;

    // Отключаем idle switch ДО очистки трека, чтобы глобальный слушатель не мешал
    this.idleSwitchEnabled = false;

    // Очищаем трек перед запуском (как в playAnimationSequence)
    this.pinata.state.clearTrack(trackIndex);
    this.pinata.state.setEmptyAnimation(trackIndex, 0);

    // Сбрасываем кости и слоты к setup pose, чтобы убрать наследование позиций из предыдущей анимации
    // Это предотвращает смещение костей, которое сохраняется на протяжении hit и резко компенсируется в idle
    this.pinata.skeleton.setSlotsToSetupPose();
    this.pinata.skeleton.setBonesToSetupPose();
    if (this.pinata.skeleton.physics && this.pinata.skeleton.physics.update) {
      this.pinata.skeleton.updateWorldTransform(this.pinata.skeleton.physics.update);
    }

    // Небольшая задержка для гарантии, что трек полностью очищен (как в SpineEffectSystem.js)
    // Это предотвращает смешивание hit с предыдущей анимацией
    requestAnimationFrame(() => {
      // Запускаем разовую анимацию БЕЗ смешивания с предыдущей (mixDuration = 0)
      // Это гарантирует, что hit всегда начинается одинаково, независимо от того, когда нажата кнопка
      const entry = this.pinata.state.setAnimation(trackIndex, finalAnimationName, false);
      if (entry) {
        entry.mixDuration = 0; // Нет смешивания с предыдущей анимацией - hit начинается сразу
        
        // Если это переход уровня, переключаем уровень после завершения анимации
        if (isLevelTransition) {
          // Слушатель для перехода уровня
          const originalListener = entry.listener;
          const targetLevel = nextLevel; // Сохраняем целевой уровень в замыкании
          entry.listener = {
            complete: () => {
              // Вызываем оригинальный слушатель, если он был
              if (originalListener && originalListener.complete) {
                originalListener.complete(entry);
              }
              
              // Переключаем уровень на целевой
              this.setLevel(targetLevel);
              
              // Добавляем idle нового уровня после hitup
              const newLevelIdleA = this.idleAnimations.a; // Уже обновлено в setLevel
              const idleEntry = this.pinata.state.addAnimation(trackIndex, newLevelIdleA, true, 0);
              if (idleEntry) {
                idleEntry.mixDuration = 0.5;
              }
              
              // Включаем idle switch обратно (уже включен в setLevel, если был включен ранее)
              this.idleSwitchEnabled = true;
              this.log(`✅ Level transition completed: ${this.currentLevel === 1 ? 3 : this.currentLevel - 1} -> ${targetLevel}, idle switch restored`);
              
              // Удаляем временный слушатель
              entry.listener = null;
            }
          };
        } else {
          // Обычная разовая анимация - просто возвращаемся к idle текущего уровня
          const idleEntry = this.pinata.state.addAnimation(trackIndex, this.idleAnimations.a, true, 0);
          if (idleEntry) {
            idleEntry.mixDuration = 0.5;
          }
          
          // Включаем idle switch обратно после завершения разовой анимации
          const originalListener = entry.listener;
          entry.listener = {
            complete: () => {
              // Вызываем оригинальный слушатель, если он был
              if (originalListener && originalListener.complete) {
                originalListener.complete(entry);
              }
              
              // Включаем idle switch обратно после завершения hit
              // Теперь switch будет переключать между idle анимациями
              if (!this.idleSwitchEnabled) {
                this.idleSwitchEnabled = true;
                this.log(`Idle switch restored after oneshot animation "${finalAnimationName}" completed`);
              }
              
              // Удаляем временный слушатель
              entry.listener = null;
            }
          };
        }
        
        this.log(`Разовая анимация "${finalAnimationName}" запущена${isLevelTransition ? ' (level transition)' : ''}`);
      }
    });
    
    return null; // Возвращаем null, т.к. entry будет доступен только внутри requestAnimationFrame
  }

  /**
   * Воспроизведение последовательности анимаций
   * @param {Array} animations - массив объектов {name, loop, delay}
   * @param {number} trackIndex - индекс трека (по умолчанию 0)
   * @param {number} startDelay - задержка начала последовательности в секундах (по умолчанию 0)
   */
  playAnimationSequence(animations, trackIndex = 0, startDelay = 0) {
    if (!this.pinata) {
      this.log('⚠️ Pinata not initialized');
      return;
    }

    if (animations.length === 0) {
      this.log('⚠️ Empty animation sequence');
      return;
    }

    // Временно отключаем idle switch, чтобы не было конфликтов
    const wasIdleSwitchEnabled = this.idleSwitchEnabled;
    this.idleSwitchEnabled = false;

    this.log(`🎬 Starting sequence: ${animations.map(a => a.name).join(' -> ')}`);

    const runSequence = () => {
      // Очищаем трек перед запуском
      this.pinata.state.clearTrack(trackIndex);
      this.pinata.state.setEmptyAnimation(trackIndex, 0);

      // Рекурсивная функция для запуска следующей анимации в последовательности
      const playNext = (index) => {
        if (index >= animations.length) {
          // Последовательность завершена - восстанавливаем idle switch
          if (wasIdleSwitchEnabled) {
            this.idleSwitchEnabled = true;
            // Запускаем idle после завершения последовательности
            const rand = Math.random();
            const ratioA = 5;
            const nextIdle = rand < (ratioA / (ratioA + 1)) 
              ? this.idleAnimations.a 
              : this.idleAnimations.b;
            this.playAnimation(nextIdle, false, trackIndex, 0.5);
            this.log(`✅ Sequence completed, idle switch restored: ${nextIdle}`);
          }
          return;
        }

        const { name, loop, delay = 0 } = animations[index];
        const isLast = index === animations.length - 1;

        // Запускаем анимацию
        const entry = this.pinata.state.setAnimation(trackIndex, name, loop);
        if (entry) {
          entry.mixDuration = 0.25;
          
          // Добавляем слушатель для перехода к следующей анимации (как в playOneshotAnimation)
          const originalListener = entry.listener;
          entry.listener = {
            complete: () => {
              // Вызываем оригинальный слушатель, если он был
              if (originalListener && originalListener.complete) {
                originalListener.complete(entry);
              }
              
              // Удаляем временный слушатель
              entry.listener = null;
              
              // Если это не последняя анимация, запускаем следующую
              if (!isLast) {
                // Небольшая задержка перед следующей анимацией (если указана)
                if (delay > 0) {
                  setTimeout(() => {
                    playNext(index + 1);
                  }, delay * 1000);
                } else {
                  playNext(index + 1);
                }
              } else {
                // Последняя анимация завершена - восстанавливаем idle switch
                if (wasIdleSwitchEnabled) {
                  this.idleSwitchEnabled = true;
                  const rand = Math.random();
                  const ratioA = 5;
                  const nextIdle = rand < (ratioA / (ratioA + 1)) 
                    ? this.idleAnimations.a 
                    : this.idleAnimations.b;
                  this.playAnimation(nextIdle, false, trackIndex, 0.5);
                  this.log(`✅ Sequence completed, idle switch restored: ${nextIdle}`);
                }
              }
            }
          };
          
          this.log(`  → Playing: "${name}" (${index + 1}/${animations.length})`);
        } else {
          this.log(`  ⚠️ Анимация "${name}" не найдена`);
          // Пропускаем эту анимацию и переходим к следующей
          if (!isLast) {
            playNext(index + 1);
          }
        }
      };

      // Запускаем первую анимацию
      playNext(0);
    };

    if (startDelay > 0) {
      setTimeout(runSequence, startDelay * 1000);
    } else {
      runSequence();
    }
  }

  /**
   * Очистка трека
   * @param {number} trackIndex - индекс трека
   */
  clearTrack(trackIndex) {
    if (!this.pinata) return;
    this.pinata.state.clearTrack(trackIndex);
  }

  /**
   * Установка пустой анимации на трек
   * @param {number} trackIndex - индекс трека
   * @param {number} mixDuration - длительность смешивания
   */
  setEmptyAnimation(trackIndex, mixDuration = 0) {
    if (!this.pinata) return;
    this.pinata.state.setEmptyAnimation(trackIndex, mixDuration);
  }

  /**
   * Получение Spine объекта пиньяты
   */
  getPinata() {
    return this.pinata;
  }

  /**
   * Установка позиции
   * @param {number} x - позиция X
   * @param {number} y - позиция Y
   */
  setPosition(x, y) {
    if (!this.pinata) return;
    this.pinata.x = x;
    this.pinata.y = y;
  }

  /**
   * Установка масштаба
   * @param {number} scale - масштаб
   */
  setScale(scale) {
    if (!this.pinata) return;
    this.pinata.scale.set(scale);
  }

  /**
   * Установка zIndex
   * @param {number} zIndex - zIndex
   */
  setZIndex(zIndex) {
    if (!this.pinata) return;
    this.pinata.zIndex = zIndex;
  }

  /**
   * Добавление слушателя событий
   * @param {Object} listeners - объект с обработчиками событий
   */
  addListener(listeners) {
    if (!this.pinata) return;
    this.pinata.state.addListener(listeners);
  }

  /**
   * Включение переключения между idle анимациями
   * @param {Object} options - опции переключения
   * @param {string} options.animationA - имя анимации A (по умолчанию "00_idle_a_1")
   * @param {string} options.animationB - имя анимации B (по умолчанию "01_idle_b_1")
   * @param {number} options.ratioA - соотношение A к B (по умолчанию 5, т.е. 5:1)
   * @param {number} options.trackIndex - индекс трека (по умолчанию 0)
   */
  enableIdleSwitch(options = {}) {
    if (!this.pinata) {
      this.log('⚠️ Pinata not initialized');
      return;
    }

    const {
      animationA = this.idleAnimations.a,
      animationB = this.idleAnimations.b,
      ratioA = 5,
      trackIndex = 0
    } = options;

    this.idleAnimations.a = animationA;
    this.idleAnimations.b = animationB;
    this.idleTrackIndex = trackIndex;
    this.idleSwitchEnabled = true;
    
    // Обновляем текущее соотношение, если оно указано в опциях
    // Иначе используем соотношение текущего уровня
    if (options.ratioA !== undefined) {
      this.currentIdleRatio = ratioA;
    } else {
      this.currentIdleRatio = this.levelIdleRatios[this.currentLevel];
    }

    // Добавляем слушатель завершения анимации
    // Используем this.idleAnimations вместо локальных переменных, чтобы при изменении уровня
    // слушатель автоматически использовал новые анимации
    this.pinata.state.addListener({
      complete: (entry) => {
        // Первая проверка - idle switch должен быть включен
        if (!this.idleSwitchEnabled) return;
        if (entry.trackIndex !== trackIndex) return;
        if (!entry.animation) return;

        const currentAnim = entry.animation.name;
        
        // Используем this.idleAnimations вместо локальных переменных из замыкания
        // Это позволяет обновлять анимации через setLevel без перезапуска слушателя
        const animationA = this.idleAnimations.a;
        const animationB = this.idleAnimations.b;
        
        // Проверяем, что завершилась именно idle анимация, а не какая-то другая
        // Это критично - игнорируем ВСЕ не-idle анимации (hit, shoot и т.д.)
        if (currentAnim !== animationA && currentAnim !== animationB) {
          return; // Игнорируем не-idle анимации
        }
        
        // Дополнительная проверка - убеждаемся, что idle switch все еще включен
        // (может быть отключен между проверками)
        if (!this.idleSwitchEnabled) return;
        
        // Используем текущее соотношение уровня для выбора следующей анимации
        const currentRatio = this.currentIdleRatio;
        // Вероятность выбрать A: ratioA / (ratioA + 1)
        // Вероятность выбрать B: 1 / (ratioA + 1)
        const rand = Math.random();
        const probabilityA = currentRatio / (currentRatio + 1);
        const nextAnim = rand < probabilityA ? animationA : animationB;
        
        // Запускаем следующую анимацию (не зациклена, без смешивания)
        this.playAnimation(nextAnim, false, trackIndex, 0);
        
        // Детальное логирование для отладки
        const ratioDisplay = currentRatio < 1 
          ? `1:${(1/currentRatio).toFixed(0)}` 
          : `${currentRatio}:1`;
        this.log(`Idle switch [Level ${this.currentLevel}]: ${currentAnim} -> ${nextAnim} (ratio: ${ratioDisplay}, probA: ${(probabilityA * 100).toFixed(1)}%, rand: ${rand.toFixed(3)})`);
      }
    });

    const ratioDisplay = this.currentIdleRatio < 1 
      ? `1:${(1/this.currentIdleRatio).toFixed(0)}` 
      : `${this.currentIdleRatio}:1`;
    this.log(`Idle switch enabled: ${animationA} : ${animationB} (${ratioDisplay})`);
  }

  /**
   * Отключение переключения между idle анимациями
   */
  disableIdleSwitch() {
    this.idleSwitchEnabled = false;
    this.log('Idle switch disabled');
  }

  /**
   * Получение имени анимации по типу и текущему уровню
   * @param {string} animationType - тип анимации ('hit', 'shoot', 'hitup', 'boom', 'idle_a', 'idle_b')
   * @returns {string} имя анимации для текущего уровня
   */
  getAnimationName(animationType) {
    const levelAnims = this.levelAnimations[this.currentLevel];
    if (!levelAnims || !levelAnims[animationType]) {
      this.log(`⚠️ Анимация типа "${animationType}" не найдена для уровня ${this.currentLevel}`);
      return null;
    }
    return levelAnims[animationType];
  }

  /**
   * Переключение на следующий уровень пиньяты
   * @param {number} newLevel - новый уровень (1, 2 или 3)
   */
  setLevel(newLevel) {
    if (newLevel === this.currentLevel) {
      this.log(`Уровень ${newLevel} уже установлен`);
      return;
    }

    if (!this.levelAnimations[newLevel]) {
      this.log(`⚠️ Уровень ${newLevel} не существует`);
      return;
    }

    const wasIdleSwitchEnabled = this.idleSwitchEnabled;
    this.idleSwitchEnabled = false; // Временно отключаем switch

    this.currentLevel = newLevel;
    const levelAnims = this.levelAnimations[newLevel];

    // Обновляем idle анимации
    this.idleAnimations.a = levelAnims.idle_a;
    this.idleAnimations.b = levelAnims.idle_b;
    
    // Обновляем соотношение для idle switch
    const oldRatio = this.currentIdleRatio;
    this.currentIdleRatio = this.levelIdleRatios[newLevel];
    
    const oldRatioDisplay = oldRatio < 1 
      ? `1:${(1/oldRatio).toFixed(0)}` 
      : `${oldRatio}:1`;
    const newRatioDisplay = this.currentIdleRatio < 1 
      ? `1:${(1/this.currentIdleRatio).toFixed(0)}` 
      : `${this.currentIdleRatio}:1`;

    this.log(`✅ Уровень переключен на ${newLevel}`);
    this.log(`   Idle анимации: ${levelAnims.idle_a}, ${levelAnims.idle_b}`);
    this.log(`   Соотношение idle switch: ${oldRatioDisplay} -> ${newRatioDisplay} (ratio: ${this.currentIdleRatio})`);

    // Если switch был включен, просто включаем его обратно
    // Слушатель уже использует this.idleAnimations и this.currentIdleRatio, поэтому автоматически подхватит новые настройки
    if (wasIdleSwitchEnabled) {
      this.idleSwitchEnabled = true;
      this.log(`Idle switch restored with new level ${newLevel} animations and ratio`);
    }
  }

  /**
   * Получение текущего уровня
   * @returns {number} текущий уровень
   */
  getCurrentLevel() {
    return this.currentLevel;
  }

  /**
   * Получение текущего соотношения idle switch в читаемом виде
   * @returns {string} соотношение в формате "1:5" или "3:1"
   */
  getCurrentRatioDisplay() {
    if (this.currentIdleRatio < 1) {
      return `1:${(1/this.currentIdleRatio).toFixed(0)}`;
    } else {
      return `${this.currentIdleRatio}:1`;
    }
  }

  /**
   * Уничтожение менеджера
   */
  destroy() {
    if (this.pinata) {
      this.app.stage.removeChild(this.pinata);
      this.pinata.destroy();
      this.pinata = null;
    }
  }
}

