# CollectEffect - Система перелетов монет

## Описание

`CollectEffect` управляет анимацией перелета монет от позиции на поле к поезду. Система поддерживает множественные одновременные перелеты, каждый из которых создает свой собственный экземпляр Spine анимации.

## Основные возможности

- **Множественные одновременные перелеты**: Каждая монетка создает свой экземпляр анимации перелета
- **Дугообразная траектория**: Перелет происходит по кривой Безье с контрольными точками
- **Направление отклонения**: В зависимости от позиции монеты (левая/центральная/правая зона)
- **Интеграция с поездом**: При событии `collect_effect_hit` поезд реагирует анимацией
- **Интеграция с частицами**: При событии `collect_effect_hit` частицы создают всплеск

## Структура

### Конструктор

```javascript
constructor(config, app, stage, trainManager = null)
```

- `config` - Конфигурация игры
- `app` - Экземпляр PixiJS Application
- `stage` - Stage контейнер
- `trainManager` - Менеджер поезда (для получения позиции цели)

### Основные методы

#### `async init()`
Инициализирует базовый экземпляр Spine анимации (используется для шаблона).

#### `async playHitCoin(startPosition)`
Создает новый экземпляр перелета для монетки.

**Параметры:**
- `startPosition` - Начальная позиция монетки `{x, y}` в мировых координатах

**Процесс:**
1. Создает новый экземпляр Spine анимации через `createFlightInstance()`
2. Получает конечную позицию (позицию поезда) через `trainManager.getPosition()`
3. Устанавливает контрольные точки для кривой через `setControlPointsForInstance()`
4. Запускает три анимации одновременно:
   - `hit_coin` на треке 0 (основная анимация перелета)
   - `start_effect` на треке 1 (эффект начала)
   - `end_effect` на треке 2 (эффект конца)
5. Добавляет слушатель события `collect_effect_hit`
6. Автоматически удаляет экземпляр после завершения анимации

#### `async createFlightInstance()`
Создает новый экземпляр Spine анимации для перелета.

**Возвращает:** `{spineAnimation, container}` или `null` при ошибке

#### `setControlPointsForInstance(spineAnimation, container, startPos, endPos)`
Устанавливает контрольные точки для кривой Безье перелета.

**Параметры:**
- `spineAnimation` - Экземпляр Spine анимации
- `container` - Контейнер экземпляра
- `startPos` - Начальная позиция `{x, y}`
- `endPos` - Конечная позиция `{x, y}`

**Логика отклонения:**
- **Левая зона** (`x < center - 150`): Отклонение влево
- **Центральная зона** (`center - 150 ≤ x ≤ center + 150`): Случайное направление (50/50)
- **Правая зона** (`x > center + 150`): Отклонение вправо

**Коэффициент отклонения:**
- Чем меньше расстояние между точками, тем больше дуга
- Формула: `deviationAmount = maxDeviation * (minDistance / distance)`
- `maxDeviation = 300` пикселей
- `minDistance = 200` пикселей

#### `setOnHitCallback(callback)`
Устанавливает callback, который вызывается при событии `collect_effect_hit`.

**Использование:**
```javascript
collectEffect.setOnHitCallback(() => {
  trainManager.playActiveAnimation();
  particleSystem.triggerHitBurst();
});
```

## Кости Spine анимации

Анимация `collect_effect` должна содержать следующие кости для управления траекторией:

- `control_point_1` - Начальная точка перелета (позиция монетки)
- `control_point_1_t` - Тангент для кривой (1/3 пути от начала)
- `control_point_2_t` - Тангент для кривой (2/3 пути от начала)
- `control_point_2` - Конечная точка перелета (позиция поезда)

## Анимации

- `hit_coin` - Основная анимация перелета
- `start_effect` - Эффект начала перелета
- `end_effect` - Эффект конца перелета
- `null` - Скрытое состояние (начальная анимация)

## События

- `collect_effect_hit` - Срабатывает при достижении монеткой поезда
  - Вызывает callback, установленный через `setOnHitCallback()`
  - Обычно используется для реакции поезда и частиц

## Отладка

В дебаггере (`DebugPositionEditor`) добавлен чекбокс "Показать тангенты перелета" для визуализации контрольных точек:
- Зеленый - начальная точка
- Пурпурный - тангент 1
- Голубой - тангент 2
- Красный - конечная точка

## Пример использования

```javascript
// В SlotMachine.init()
this.collectEffect = new CollectEffect(this.config, this.app, this.app.stage, this.trainManager);
await this.collectEffect.init();

// Устанавливаем callback для реакции на прилет
this.collectEffect.setOnHitCallback(() => {
  if (this.trainManager) {
    this.trainManager.playActiveAnimation();
  }
  if (this.particleSystem) {
    this.particleSystem.triggerHitBurst();
  }
});

// В CoinManager при событии start_flight
this.collectEffect.playHitCoin(startPosition);
```


