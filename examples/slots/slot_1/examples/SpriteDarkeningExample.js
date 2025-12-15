/**
 * Примеры затемнения и окрашивания спрайтов в PixiJS
 * 
 * Использование ColorMatrixFilter для:
 * 1. Затемнения спрайтов
 * 2. Окрашивания в синие оттенки
 * 3. Комбинирования эффектов
 * 
 * ОПТИМАЛЬНЫЕ ПАРАМЕТРЫ:
 * - darkness = 0.79 (затемнение)
 * - blueTint = 0.39 (синий оттенок)
 * 
 * Использование: предполагается, что PIXI доступен глобально
 */

/**
 * Пример 1: Затемнение спрайта
 * @param {PIXI.Sprite} sprite - Спрайт для затемнения
 * @param {number} darkness - Уровень затемнения (0 = нормально, 1 = полностью черный)
 */
export function darkenSprite(sprite, darkness = 0.5) {
  // Создаем фильтр ColorMatrixFilter
  const colorMatrix = new PIXI.ColorMatrixFilter();
  
  // Затемняем: brightness(0) = полностью черный, brightness(1) = нормально
  // darkness = 0.5 означает затемнение на 50%
  const brightness = 1 - darkness;
  colorMatrix.brightness(brightness, false);
  
  // Применяем фильтр к спрайту
  sprite.filters = [colorMatrix];
  
  return colorMatrix; // Возвращаем фильтр для дальнейшего управления
}

/**
 * Пример 2: Окрашивание в синие оттенки
 * @param {PIXI.Sprite} sprite - Спрайт для окрашивания
 * @param {number} blueIntensity - Интенсивность синего оттенка (0-1)
 */
export function tintSpriteBlue(sprite, blueIntensity = 0.5) {
  const colorMatrix = new PIXI.ColorMatrixFilter();
  
  // Метод tint принимает цвет в формате RGB (0-1) или hex
  // Для синего оттенка: увеличиваем синий канал, уменьшаем красный и зеленый
  // Можно использовать hex цвет: 0x0000FF для чистого синего
  // Или RGB массив: [0, 0, 1] для синего
  
  // Вариант 1: Использование tint с синим цветом
  // colorMatrix.tint(0x0000FF, blueIntensity);
  
  // Вариант 2: Ручная настройка матрицы для синего оттенка
  // Уменьшаем красный и зеленый каналы, усиливаем синий
  const matrix = [
    1 - blueIntensity * 0.5, 0, 0, 0, 0,  // R канал
    0, 1 - blueIntensity * 0.5, 0, 0, 0,  // G канал
    0, 0, 1 + blueIntensity * 0.3, 0, 0,  // B канал (усиливаем)
    0, 0, 0, 1, 0                           // Alpha канал
  ];
  colorMatrix.matrix = matrix;
  
  sprite.filters = [colorMatrix];
  
  return colorMatrix;
}

/**
 * Пример 3: Комбинирование затемнения и синего оттенка
 * @param {PIXI.Sprite} sprite - Спрайт для обработки
 * @param {number} darkness - Уровень затемнения (0-1), оптимально: 0.79
 * @param {number} blueIntensity - Интенсивность синего оттенка (0-1), оптимально: 0.39
 */
export function darkenAndTintBlue(sprite, darkness = 0.79, blueIntensity = 0.39) {
  const colorMatrix = new PIXI.ColorMatrixFilter();
  
  // Сначала затемняем
  const brightness = 1 - darkness;
  colorMatrix.brightness(brightness, false);
  
  // Затем добавляем синий оттенок через tint
  // Используем темно-синий цвет для более реалистичного эффекта
  const blueTint = 0x1a1a66; // Темно-синий цвет
  colorMatrix.tint(blueTint, blueIntensity);
  
  sprite.filters = [colorMatrix];
  
  return colorMatrix;
}

/**
 * Пример 4: Создание матрицы для затемнения с синим оттенком вручную
 * @param {PIXI.Sprite} sprite - Спрайт для обработки
 * @param {number} darkness - Уровень затемнения (0-1), оптимально: 0.79
 * @param {number} blueIntensity - Интенсивность синего оттенка (0-1), оптимально: 0.39
 */
export function darkenAndTintBlueManual(sprite, darkness = 0.79, blueIntensity = 0.39) {
  const colorMatrix = new PIXI.ColorMatrixFilter();
  
  // Комбинированная матрица: затемнение + синий оттенок
  const brightness = 1 - darkness;
  
  // Матрица: [R, G, B, A, offset]
  // Уменьшаем красный и зеленый, усиливаем синий, затемняем
  const matrix = [
    brightness * (1 - blueIntensity * 0.3), 0, 0, 0, 0,                    // R
    0, brightness * (1 - blueIntensity * 0.3), 0, 0, 0,                    // G
    0, 0, brightness * (1 + blueIntensity * 0.2), 0, 0,                    // B
    0, 0, 0, 1, 0                                                           // A
  ];
  
  colorMatrix.matrix = matrix;
  sprite.filters = [colorMatrix];
  
  return colorMatrix;
}

/**
 * Пример 5: Удаление фильтров
 * @param {PIXI.Sprite} sprite - Спрайт
 */
export function removeFilters(sprite) {
  sprite.filters = null;
}

/**
 * Пример использования в SlotReel:
 * 
 * // В методе createSymbol:
 * const sprite = new PIXI.Sprite(texture);
 * 
 * // Затемняем символы, которые не активны
 * if (shouldBeDarkened) {
 *   darkenSprite(sprite, 0.6); // Затемнение на 60%
 * }
 * 
 * // Или добавляем синий оттенок
 * if (shouldBeBlueTinted) {
 *   tintSpriteBlue(sprite, 0.4); // Синий оттенок 40%
 * }
 * 
 * // Или комбинируем оба эффекта (оптимальные параметры)
 * if (shouldBeDarkenedAndBlue) {
 *   darkenAndTintBlue(sprite, 0.79, 0.39); // Затемнение 79% + синий 39%
 * }
 */

