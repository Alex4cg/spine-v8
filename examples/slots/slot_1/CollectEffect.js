import { SpineAnimation } from './SpineAnimation.js';

export class CollectEffect {
  constructor(config, app, stage, trainManager = null) {
    this.config = config;
    this.app = app;
    this.stage = stage;
    this.spineAnimation = null;
    this.container = null;
    this.coinKey = null; // Привязка к монетке
    this.targetType = null; // Тип цели
    this.trainManager = trainManager; // Ссылка на TrainManager для получения позиции поезда
    this.debugGraphics = []; // Массив графических объектов для отладки тангентов
    this.showDebug = false; // Флаг отображения отладки
    this.debugTicker = null; // Callback для ticker для обновления отладки
    this.activeFlights = []; // Массив активных перелетов (каждый со своим экземпляром Spine)
    this.onHitCallback = null; // Callback для события collect_effect_hit (для поезда)
    this.onCollectorHitCallback = null; // Callback для события collect_effect_hit (для коллектора)
  }
  
  /**
   * Устанавливает callback для события collect_effect_hit (для поезда)
   * @param {Function} callback - Функция, которая будет вызвана при событии collect_effect_hit
   */
  setOnHitCallback(callback) {
    this.onHitCallback = callback;
  }

  /**
   * Устанавливает callback для события collect_effect_hit (для коллектора)
   * @param {Function} callback - Функция, которая будет вызвана при событии collect_effect_hit для коллектора
   */
  setOnCollectorHitCallback(callback) {
    this.onCollectorHitCallback = callback;
  }
  
  async init() {
    // Создаем Spine анимацию для collect effect
    this.spineAnimation = new SpineAnimation(
      this.config,
      this.app,
      this.stage,
      'collect_effect_2',
      'null', // Начальная анимация null (скрытое состояние)
      true
    );
    
    const loaded = await this.spineAnimation.load();
    if (!loaded) {
      console.warn('CollectEffect: Не удалось загрузить collect effect');
      return false;
    }
    
    // Получаем контейнер и устанавливаем zIndex
    this.container = this.spineAnimation.getContainer();
    this.container.zIndex = 300; // Выше всего (выше logo zIndex = 250)
    
    // Позиционируем в центре экрана
    const x = this.config.resolution.width / 2;
    const y = this.config.resolution.height / 2;
    this.spineAnimation.setPosition(x, y);
    
    // Инициализируем physics для скелета (если еще не инициализировано)
    if (this.spineAnimation.spine && this.spineAnimation.spine.skeleton) {
      if (!this.spineAnimation.spine.skeleton.physics) {
        this.spineAnimation.spine.skeleton.physics = {
          update: () => {},
          updateGlobal: () => {},
        };
      }
    }

    // Ждем один кадр (как в train-test.html)
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Устанавливаем скин "blue" (как в train-test.html)
    if (this.spineAnimation.spine && this.spineAnimation.spine.skeleton) {
      const blueSkin = this.spineAnimation.spine.skeleton.data.findSkin("blue");
      if (blueSkin) {
        this.spineAnimation.spine.skeleton.setSkin(blueSkin);
        this.spineAnimation.spine.skeleton.setSlotsToSetupPose();
        if (this.spineAnimation.spine.skeleton.physics) {
          this.spineAnimation.spine.skeleton.updateWorldTransform(
            this.spineAnimation.spine.skeleton.physics.update
          );
        }
        console.log('CollectEffect: Скин "blue" установлен');
      } else {
        console.warn('CollectEffect: Скин "blue" не найден');
      }
    }
    
    console.log('CollectEffect: Инициализирован');
    return true;
  }
  
  /**
   * Воспроизведение анимации collect effect
   * @param {string} animationName - Имя анимации (по умолчанию 'collect')
   * @param {number} track - Номер трека (по умолчанию 0)
   * @param {boolean} loop - Зациклена ли анимация (по умолчанию false)
   */
  play(animationName = 'collect', track = 0, loop = false) {
    if (!this.spineAnimation || !this.spineAnimation.spine) {
      return;
    }
    
    // Очищаем трек перед запуском
    this.spineAnimation.clearTrack(track);
    this.spineAnimation.setEmptyAnimation(track, 0);
    
    // Запускаем анимацию
    const entry = this.spineAnimation.setAnimationOnTrack(track, animationName, loop);
    
    if (entry) {
      console.log(`CollectEffect: Воспроизводится анимация "${animationName}" на треке ${track}`);
    } else {
      console.warn(`CollectEffect: Анимация "${animationName}" не найдена`);
    }
  }

  /**
   * Создает новый экземпляр Spine анимации для перелета
   * @returns {Promise<Object>} Объект с spineAnimation и container
   */
  async createFlightInstance() {
    // Создаем новый экземпляр Spine анимации для этого перелета
    const flightSpine = new SpineAnimation(
      this.config,
      this.app,
      this.stage,
      'collect_effect_2',
      'null',
      true
    );
    
    const loaded = await flightSpine.load();
    if (!loaded) {
      console.warn('CollectEffect: Не удалось загрузить экземпляр для перелета');
      return null;
    }
    
    const container = flightSpine.getContainer();
    container.zIndex = 300; // Выше всего
    
    // Инициализируем physics для скелета
    if (flightSpine.spine && flightSpine.spine.skeleton) {
      if (!flightSpine.spine.skeleton.physics) {
        flightSpine.spine.skeleton.physics = {
          update: () => {},
          updateGlobal: () => {},
        };
      }
    }
    
    // Ждем один кадр перед установкой скина
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Устанавливаем скин "blue" (как в train-test.html)
    if (flightSpine.spine && flightSpine.spine.skeleton) {
      const blueSkin = flightSpine.spine.skeleton.data.findSkin("blue");
      if (blueSkin) {
        flightSpine.spine.skeleton.setSkin(blueSkin);
        flightSpine.spine.skeleton.setSlotsToSetupPose();
        if (flightSpine.spine.skeleton.physics) {
          flightSpine.spine.skeleton.updateWorldTransform(
            flightSpine.spine.skeleton.physics.update
          );
        }
        console.log('CollectEffect: Скин "blue" установлен для flight instance');
      } else {
        console.warn('CollectEffect: Скин "blue" не найден для flight instance');
      }
    }
    
    return { spineAnimation: flightSpine, container };
  }

  /**
   * Проигрывает анимацию hit_coin с установкой контрольных точек для кривой
   * Создает новый экземпляр Spine для каждого перелета, чтобы поддерживать множественные одновременные перелеты
   * @param {object} startPosition - Начальная позиция монетки {x, y} (мировые координаты)
   * @param {Function} coinCallback - Callback при завершении анимации
   * @param {object} customEndPosition - Кастомная конечная позиция {x, y} (если не указана, используется позиция поезда)
   * @param {string} targetType - Тип цели: 'train' (поезд) или 'collector' (коллектор)
   * @param {object} collectorInfo - Информация о коллекторе {reelIndex, positionIndex} (только для targetType='collector')
   */
  async playHitCoin(startPosition = null, coinCallback = null, customEndPosition = null, targetType = 'train', collectorInfo = null) {
    if (!startPosition) {
      console.warn('CollectEffect: Start position not provided');
      return;
    }

    // Создаем новый экземпляр для этого перелета
    const flightInstance = await this.createFlightInstance();
    if (!flightInstance) {
      return;
    }
    
    const { spineAnimation, container } = flightInstance;
    
    // Показываем контейнер
    container.visible = true;

    // Получаем конечную позицию
    let endPosition = null;
    
    // Если передана кастомная конечная позиция (например, для коллектора) - используем её
    if (customEndPosition) {
      endPosition = customEndPosition;
    } else if (this.trainManager) {
      // Иначе используем позицию поезда (по умолчанию)
      // Используем позицию кости coin_target для точного попадания
      endPosition = this.trainManager.getCoinTargetPosition();
      // Fallback на позицию поезда, если кость не найдена
      if (!endPosition) {
        endPosition = this.trainManager.getPosition();
      }
    }

    // Устанавливаем позиции контрольных точек для кривой перелета
    if (startPosition && endPosition) {
      this.setControlPointsForInstance(spineAnimation, container, startPosition, endPosition);
    } else if (startPosition) {
      // Если только начальная позиция, используем её для позиционирования контейнера
      spineAnimation.setPosition(startPosition.x, startPosition.y);
      console.warn('CollectEffect: End position (train) not available, using start position only');
    }
    
    // Проигрываем основную анимацию hit_coin на треке 0
    const trackEntry = this.playOnInstance(spineAnimation, 'hit_coin', 0, false);
    
    // Одновременно запускаем start_effect на треке 1
    this.playOnInstance(spineAnimation, 'start_effect', 1, false);
    
    // Одновременно запускаем end_effect на треке 2
    this.playOnInstance(spineAnimation, 'end_effect', 2, false);
    
    // Сохраняем экземпляр перед добавлением слушателя
    const flightData = {
      spineAnimation,
      container,
      startPosition,
      endPosition,
      targetType, // Сохраняем тип цели для использования в слушателе событий
      collectorInfo // Сохраняем информацию о коллекторе (если есть)
    };
    
    this.activeFlights.push(flightData);
    
    // Добавляем слушатель событий для этого экземпляра перелета
    if (spineAnimation.spine && spineAnimation.spine.state) {
      spineAnimation.spine.state.addListener({
        event: (entry, event) => {
          // Обработка события collect_effect_hit
          if (event.data.name === 'collect_effect_hit') {
            console.log(`CollectEffect: Событие collect_effect_hit получено (target: ${flightData.targetType})`);
            // Вызываем соответствующий callback в зависимости от типа цели
            if (flightData.targetType === 'collector') {
              // Для коллектора вызываем специальный callback с информацией о коллекторе
              if (this.onCollectorHitCallback) {
                this.onCollectorHitCallback(flightData.collectorInfo);
              }
            } else {
              // Для поезда вызываем обычный callback
            if (this.onHitCallback) {
              this.onHitCallback();
              }
            }
          }
        },
        complete: (entry) => {
          // Обработка завершения анимации hit_coin (трек 0)
          if (entry.trackIndex === 0 && entry.animation && entry.animation.name === 'hit_coin') {
            console.log('CollectEffect: Анимация hit_coin завершена');
            
            // Вызываем callback для скрытия монетки и показа спрайта
            // Делаем это через setTimeout, чтобы дать время Spine завершить обработку
            setTimeout(() => {
              if (coinCallback) {
                coinCallback();
              }
              // Удаляем экземпляр после завершения анимации
              const index = this.activeFlights.indexOf(flightData);
              if (index !== -1) {
                this.removeFlightInstance(flightData);
              }
            }, 0);
          }
        }
      });
    }
  }
  
  /**
   * Проигрывает анимацию на конкретном экземпляре Spine
   */
  playOnInstance(spineAnimation, animationName, track, loop) {
    if (!spineAnimation || !spineAnimation.spine) {
      return;
    }
    
    spineAnimation.clearTrack(track);
    spineAnimation.setEmptyAnimation(track, 0);
    
    const entry = spineAnimation.setAnimationOnTrack(track, animationName, loop);
    
    if (entry) {
      console.log(`CollectEffect: Воспроизводится анимация "${animationName}" на треке ${track}`);
    } else {
      console.warn(`CollectEffect: Анимация "${animationName}" не найдена`);
    }
  }
  
  /**
   * Устанавливает контрольные точки для конкретного экземпляра перелета
   */
  setControlPointsForInstance(spineAnimation, container, startPos, endPos) {
    if (!spineAnimation || !spineAnimation.spine || !container) {
      return;
    }

    const spine = spineAnimation.spine;
    const skeleton = spine.skeleton;
    
    // Находим кости
    const bone1 = skeleton.findBone('control_point_1');
    const bone1_t = skeleton.findBone('control_point_1_t');
    const bone2_t = skeleton.findBone('control_point_2_t');
    const bone2 = skeleton.findBone('control_point_2');

    if (!bone1 || !bone1_t || !bone2_t || !bone2) {
      console.warn('CollectEffect: Не все контрольные кости найдены');
      return;
    }

    // Преобразуем мировые координаты в локальные координаты костей
    const convertPoint = { x: 0, y: 0 };
    
    // Преобразуем начальную позицию (монетка)
    convertPoint.x = startPos.x;
    convertPoint.y = startPos.y;
    if (typeof spine.pixiWorldCoordinatesToBone === 'function') {
      spine.pixiWorldCoordinatesToBone(convertPoint, bone1);
      bone1.x = convertPoint.x;
      bone1.y = convertPoint.y;
    } else {
      bone1.x = startPos.x - container.x;
      bone1.y = startPos.y - container.y;
    }

    // Преобразуем конечную позицию (поезд)
    convertPoint.x = endPos.x;
    convertPoint.y = endPos.y;
    if (typeof spine.pixiWorldCoordinatesToBone === 'function') {
      spine.pixiWorldCoordinatesToBone(convertPoint, bone2);
      bone2.x = convertPoint.x;
      bone2.y = convertPoint.y;
    } else {
      bone2.x = endPos.x - container.x;
      bone2.y = endPos.y - container.y;
    }

    // Вычисляем вектор от начальной к конечной точке в мировых координатах
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    
    // Вычисляем расстояние между точками
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Вычисляем перпендикуляр к прямой в мировых координатах
    const perpLength = Math.sqrt(dx * dx + dy * dy);
    let perpX = perpLength > 0 ? -dy / perpLength : 0;
    let perpY = perpLength > 0 ? dx / perpLength : 0;
    
    // Определяем направление отклонения в зависимости от позиции монетки
    const screenCenterX = this.config.resolution.width / 2;
    const centerZone = 150;
    
    if (startPos.x < screenCenterX - centerZone) {
      perpX = -perpX;
      perpY = -perpY;
    } else if (startPos.x > screenCenterX + centerZone) {
      // Оставляем как есть (вправо)
    } else {
      // Центральная зона - случайное направление
      if (Math.random() < 0.5) {
        perpX = -perpX;
        perpY = -perpY;
      }
    }
    
    // Вычисляем коэффициент отклонения
    const minDistance = 200;
    const maxDeviation = 300;
    const deviationAmount = Math.min(maxDeviation, maxDeviation * (minDistance / Math.max(distance, 50)));
    
    // Тангент 1
    const tangent1BaseX = startPos.x + dx * 0.33;
    const tangent1BaseY = startPos.y + dy * 0.33;
    const tangent1World = {
      x: tangent1BaseX + perpX * deviationAmount,
      y: tangent1BaseY + perpY * deviationAmount
    };
    
    convertPoint.x = tangent1World.x;
    convertPoint.y = tangent1World.y;
    if (typeof spine.pixiWorldCoordinatesToBone === 'function') {
      spine.pixiWorldCoordinatesToBone(convertPoint, bone1_t);
      bone1_t.x = convertPoint.x;
      bone1_t.y = convertPoint.y;
    } else {
      bone1_t.x = tangent1World.x - container.x;
      bone1_t.y = tangent1World.y - container.y;
    }

    // Тангент 2
    const tangent2BaseX = startPos.x + dx * 0.67;
    const tangent2BaseY = startPos.y + dy * 0.67;
    const tangent2World = {
      x: tangent2BaseX + perpX * deviationAmount,
      y: tangent2BaseY + perpY * deviationAmount
    };
    
    convertPoint.x = tangent2World.x;
    convertPoint.y = tangent2World.y;
    if (typeof spine.pixiWorldCoordinatesToBone === 'function') {
      spine.pixiWorldCoordinatesToBone(convertPoint, bone2_t);
      bone2_t.x = convertPoint.x;
      bone2_t.y = convertPoint.y;
    } else {
      bone2_t.x = tangent2World.x - container.x;
      bone2_t.y = tangent2World.y - container.y;
    }

    // Обновляем скелет
    if (skeleton.physics) {
      skeleton.updateWorldTransform(skeleton.physics.update);
    } else {
      skeleton.physics = {
        update: () => {},
        updateGlobal: () => {},
      };
      skeleton.updateWorldTransform(skeleton.physics.update);
    }
  }
  
  /**
   * Удаляет экземпляр перелета после его завершения
   */
  removeFlightInstance(flightData) {
    const index = this.activeFlights.indexOf(flightData);
    if (index !== -1) {
      this.activeFlights.splice(index, 1);
    }
    
    // Удаляем контейнер из stage
    if (flightData.container && flightData.container.parent) {
      flightData.container.parent.removeChild(flightData.container);
    }
    
    // Уничтожаем Spine анимацию
    if (flightData.spineAnimation) {
      flightData.spineAnimation.destroy();
    }
  }

  /**
   * Устанавливает позиции контрольных точек для кривой перелета
   * @param {object} startPos - Начальная позиция {x, y} (мировые координаты)
   * @param {object} endPos - Конечная позиция {x, y} (мировые координаты)
   */
  setControlPoints(startPos, endPos) {
    if (!this.spineAnimation || !this.spineAnimation.spine || !this.container) {
      return;
    }

    const spine = this.spineAnimation.spine;
    const skeleton = spine.skeleton;
    
    // Находим кости
    const bone1 = skeleton.findBone('control_point_1');
    const bone1_t = skeleton.findBone('control_point_1_t');
    const bone2_t = skeleton.findBone('control_point_2_t');
    const bone2 = skeleton.findBone('control_point_2');

    if (!bone1 || !bone1_t || !bone2_t || !bone2) {
      console.warn('CollectEffect: Не все контрольные кости найдены', {
        bone1: !!bone1,
        bone1_t: !!bone1_t,
        bone2_t: !!bone2_t,
        bone2: !!bone2
      });
      return;
    }

    // Преобразуем мировые координаты в локальные координаты костей
    // Используем метод pixiWorldCoordinatesToBone для правильного преобразования
    const convertPoint = { x: 0, y: 0 };
    
    // Преобразуем начальную позицию (монетка)
    convertPoint.x = startPos.x;
    convertPoint.y = startPos.y;
    if (typeof spine.pixiWorldCoordinatesToBone === 'function') {
      spine.pixiWorldCoordinatesToBone(convertPoint, bone1);
      bone1.x = convertPoint.x;
      bone1.y = convertPoint.y;
    } else {
      // Fallback: простое преобразование относительно контейнера
      bone1.x = startPos.x - this.container.x;
      bone1.y = startPos.y - this.container.y;
    }

    // Преобразуем конечную позицию (поезд)
    convertPoint.x = endPos.x;
    convertPoint.y = endPos.y;
    if (typeof spine.pixiWorldCoordinatesToBone === 'function') {
      spine.pixiWorldCoordinatesToBone(convertPoint, bone2);
      bone2.x = convertPoint.x;
      bone2.y = convertPoint.y;
    } else {
      // Fallback: простое преобразование относительно контейнера
      bone2.x = endPos.x - this.container.x;
      bone2.y = endPos.y - this.container.y;
    }

    // Вычисляем вектор от начальной к конечной точке в мировых координатах
    const dx = endPos.x - startPos.x;
    const dy = endPos.y - startPos.y;
    
    // Вычисляем расстояние между точками
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Вычисляем перпендикуляр к прямой в мировых координатах (поворот на 90 градусов против часовой стрелки)
    // Перпендикуляр = (-dy, dx) нормализованный
    const perpLength = Math.sqrt(dx * dx + dy * dy);
    let perpX = perpLength > 0 ? -dy / perpLength : 0;
    let perpY = perpLength > 0 ? dx / perpLength : 0;
    
    // Определяем направление отклонения в зависимости от позиции монетки относительно центра экрана
    // Разделяем экран на три зоны: левая (влево), центральная (случайно влево/вправо), правая (вправо)
    const screenCenterX = this.config.resolution.width / 2;
    const centerZone = 150; // Зона вокруг центра (±150 пикселей) для центральных монет
    
    if (startPos.x < screenCenterX - centerZone) {
      // Монетка слева от центральной зоны - отклоняем влево (инвертируем перпендикуляр)
      perpX = -perpX;
      perpY = -perpY;
    } else if (startPos.x > screenCenterX + centerZone) {
      // Монетка справа от центральной зоны - отклоняем вправо (оставляем как есть)
      // perpX и perpY остаются без изменений
    } else {
      // Монетка в центральной зоне - случайное направление (влево или вправо)
      if (Math.random() < 0.5) {
        // Случайно инвертируем (влево)
        perpX = -perpX;
        perpY = -perpY;
      }
      // Иначе оставляем как есть (вправо)
    }
    
    // Вычисляем коэффициент отклонения: чем меньше расстояние, тем больше дуга
    // Используем обратную зависимость: maxDeviation * (minDistance / actualDistance)
    const minDistance = 200; // Минимальное расстояние для нормальной дуги
    const maxDeviation = 300; // Максимальное отклонение тангентов (увеличено для более выраженной дуги)
    const deviationAmount = Math.min(maxDeviation, maxDeviation * (minDistance / Math.max(distance, 50)));
    
    // Тангент 1 - на 1/3 пути от начала, с отклонением по перпендикуляру (в мировых координатах)
    const tangent1BaseX = startPos.x + dx * 0.33;
    const tangent1BaseY = startPos.y + dy * 0.33;
    const tangent1World = {
      x: tangent1BaseX + perpX * deviationAmount,
      y: tangent1BaseY + perpY * deviationAmount
    };
    
    // Преобразуем в локальные координаты кости
    convertPoint.x = tangent1World.x;
    convertPoint.y = tangent1World.y;
    if (typeof spine.pixiWorldCoordinatesToBone === 'function') {
      spine.pixiWorldCoordinatesToBone(convertPoint, bone1_t);
      bone1_t.x = convertPoint.x;
      bone1_t.y = convertPoint.y;
    } else {
      bone1_t.x = tangent1World.x - this.container.x;
      bone1_t.y = tangent1World.y - this.container.y;
    }

    // Тангент 2 - на 2/3 пути от начала, с отклонением по перпендикуляру (в мировых координатах)
    const tangent2BaseX = startPos.x + dx * 0.67;
    const tangent2BaseY = startPos.y + dy * 0.67;
    const tangent2World = {
      x: tangent2BaseX + perpX * deviationAmount,
      y: tangent2BaseY + perpY * deviationAmount
    };
    
    // Преобразуем в локальные координаты кости
    convertPoint.x = tangent2World.x;
    convertPoint.y = tangent2World.y;
    if (typeof spine.pixiWorldCoordinatesToBone === 'function') {
      spine.pixiWorldCoordinatesToBone(convertPoint, bone2_t);
      bone2_t.x = convertPoint.x;
      bone2_t.y = convertPoint.y;
    } else {
      bone2_t.x = tangent2World.x - this.container.x;
      bone2_t.y = tangent2World.y - this.container.y;
    }

    // Обновляем скелет (с проверкой physics)
    if (skeleton.physics) {
      skeleton.updateWorldTransform(skeleton.physics.update);
    } else {
      // Если physics нет, инициализируем его
      skeleton.physics = {
        update: () => {},
        updateGlobal: () => {},
      };
      skeleton.updateWorldTransform(skeleton.physics.update);
    }

    // Обновляем визуальные индикаторы для отладки (если включены)
    this.updateDebugGraphics(bone1, bone1_t, bone2_t, bone2);

    console.log(`CollectEffect: Control points set - start: (${startPos.x.toFixed(1)}, ${startPos.y.toFixed(1)}), end: (${endPos.x.toFixed(1)}, ${endPos.y.toFixed(1)})`);
  }

  /**
   * Создает или обновляет визуальные индикаторы для отладки тангентов
   * @param {Bone} bone1 - Кость control_point_1
   * @param {Bone} bone1_t - Кость control_point_1_t (тангент 1)
   * @param {Bone} bone2_t - Кость control_point_2_t (тангент 2)
   * @param {Bone} bone2 - Кость control_point_2
   */
  updateDebugGraphics(bone1, bone1_t, bone2_t, bone2) {
    if (!this.spineAnimation || !this.spineAnimation.spine) {
      return;
    }

    const spine = this.spineAnimation.spine;

    // Очищаем старые графические объекты
    this.clearDebugGraphics();

    // Если отладка не включена, выходим
    if (!this.showDebug) {
      return;
    }

    const bones = [
      { bone: bone1, color: 0x00ff00, label: 'start' },      // Зеленый - начальная точка
      { bone: bone1_t, color: 0xff00ff, label: 't1' },       // Пурпурный - тангент 1
      { bone: bone2_t, color: 0x00ffff, label: 't2' },       // Голубой - тангент 2
      { bone: bone2, color: 0xff0000, label: 'end' }         // Красный - конечная точка
    ];

    for (const { bone, color, label } of bones) {
      if (!bone) continue;

      // Получаем мировые координаты кости
      const world = { x: bone.worldX, y: bone.worldY };
      // Преобразуем координаты скелета в мировые координаты PixiJS
      if (typeof spine.skeletonToPixiWorldCoordinates === 'function') {
        spine.skeletonToPixiWorldCoordinates(world);
      } else if (typeof spine.skeleton?.data?.skeletonToPixiWorldCoordinates === 'function') {
        spine.skeleton.data.skeletonToPixiWorldCoordinates(world);
      } else {
        // Fallback: используем позицию контейнера
        world.x = bone.worldX + this.container.x;
        world.y = bone.worldY + this.container.y;
      }

      // Создаем графический объект для визуализации
      const graphics = new PIXI.Graphics();
      graphics.lineStyle({ width: 2, color: color, alpha: 0.9 });
      graphics.beginFill(color, 0.4);
      graphics.drawCircle(0, 0, 8); // Круг радиусом 8 пикселей
      graphics.endFill();
      
      // Позиционируем
      graphics.x = world.x;
      graphics.y = world.y;
      graphics.zIndex = 1000; // Поверх всего
      graphics.eventMode = 'static';

      // Добавляем на stage
      this.stage.addChild(graphics);
      this.debugGraphics.push(graphics);
    }
  }

  /**
   * Очищает все графические объекты для отладки
   */
  clearDebugGraphics() {
    for (const graphics of this.debugGraphics) {
      if (graphics && graphics.parent) {
        graphics.parent.removeChild(graphics);
        graphics.destroy();
      }
    }
    this.debugGraphics = [];
  }

  /**
   * Проверяет, есть ли активные полеты монеток
   * @returns {boolean} true если есть активные полеты
   */
  hasActiveFlights() {
    return this.activeFlights.length > 0;
  }

  /**
   * Включает/выключает отображение отладки тангентов
   * @param {boolean} show - true для включения, false для выключения
   */
  setDebugVisible(show) {
    this.showDebug = show;
    if (!show) {
      this.clearDebugGraphics();
      this.disableDebugTicker();
    } else {
      // Включаем автоматическое обновление через ticker
      this.enableDebugTicker();
      // Обновляем графику сразу (если кости уже установлены)
      if (this.spineAnimation && this.spineAnimation.spine) {
        const skeleton = this.spineAnimation.spine.skeleton;
        const bone1 = skeleton.findBone('control_point_1');
        const bone1_t = skeleton.findBone('control_point_1_t');
        const bone2_t = skeleton.findBone('control_point_2_t');
        const bone2 = skeleton.findBone('control_point_2');
        if (bone1 && bone1_t && bone2_t && bone2) {
          this.updateDebugGraphics(bone1, bone1_t, bone2_t, bone2);
        }
      }
    }
  }

  /**
   * Обновляет позиции отладочной графики (вызывать каждый кадр)
   */
  updateDebug() {
    if (!this.showDebug || !this.spineAnimation || !this.spineAnimation.spine) {
      return;
    }

    const skeleton = this.spineAnimation.spine.skeleton;
    const bone1 = skeleton.findBone('control_point_1');
    const bone1_t = skeleton.findBone('control_point_1_t');
    const bone2_t = skeleton.findBone('control_point_2_t');
    const bone2 = skeleton.findBone('control_point_2');

    if (bone1 && bone1_t && bone2_t && bone2) {
      this.updateDebugGraphics(bone1, bone1_t, bone2_t, bone2);
    }
  }

  /**
   * Включает автоматическое обновление отладочной графики через ticker
   */
  enableDebugTicker() {
    if (this.debugTicker) {
      return; // Уже включен
    }

    this.debugTicker = (delta) => {
      this.updateDebug();
    };

    if (this.app && this.app.ticker) {
      this.app.ticker.add(this.debugTicker);
    }
  }

  /**
   * Выключает автоматическое обновление отладочной графики
   */
  disableDebugTicker() {
    if (this.debugTicker && this.app && this.app.ticker) {
      this.app.ticker.remove(this.debugTicker);
      this.debugTicker = null;
    }
  }
  
  // Получение контейнера для доступа из дебаггера
  getContainer() {
    return this.container;
  }
  
  // Уничтожение collect effect
  destroy() {
    this.clearDebugGraphics();
    this.disableDebugTicker();
    if (this.spineAnimation) {
      this.spineAnimation.destroy();
      this.spineAnimation = null;
    }
    this.container = null;
  }
}

