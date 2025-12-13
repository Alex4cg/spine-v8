# TrainManager - Управление анимацией поезда

## Описание

`TrainManager` управляет Spine анимацией поезда, включая постоянные анимации, разовые анимации при спине, реакцию на прилет монет и динамическое увеличение масштаба.

## Основные возможности

- **Постоянные анимации**: Зацикленные анимации на разных треках
- **Разовая анимация при спине**: Случайная анимация при каждом спине
- **Реакция на прилет монет**: Анимация `active` при событии `collect_effect_hit`
- **Динамическое увеличение масштаба**: Увеличение на 0.3% за каждый прилет (максимум 5%)

## Структура

### Конструктор

```javascript
constructor(config, app, stage)
```

- `config` - Конфигурация игры
- `app` - Экземпляр PixiJS Application
- `stage` - Stage контейнер

### Свойства

- `scaleIncrement` - Текущее приращение масштаба (0-5%)
- `maxScaleIncrement` - Максимальное приращение масштаба (5%)
- `scaleIncrementPerHit` - Приращение масштаба за один прилет (0.3%)
- `baseScale` - Базовый масштаб поезда (сохраняется при инициализации)

### Основные методы

#### `async init()`
Инициализирует и загружает поезд.

**Процесс:**
1. Создает Spine анимацию поезда
2. Устанавливает позицию и zIndex (90)
3. Сохраняет базовый масштаб в `baseScale`
4. Запускает постоянные анимации:
   - Трек 0: `00_idle` (базовая idle анимация)
   - Трек 1: `01_piles_of_gold` (зациклено)
   - Трек 2: `02_bg_speed_effect` (зациклено)

#### `playSpinAnimation()`
Запускает разовую анимацию при спине.

**Анимации:**
- `03_blick_add`
- `04_steam_1`
- `05_steam_2`

Выбирается случайная анимация и проигрывается на треке 3.

#### `playActiveAnimation()`
Запускает анимацию `active` при событии `collect_effect_hit`.

**Процесс:**
1. Очищает трек 4
2. Пробует запустить `06_active`, если не найдено - `active`
3. Увеличивает масштаб контейнера на 0.3% (если не достигнут максимум 5%)

**Логика увеличения масштаба:**
```javascript
if (this.scaleIncrement < this.maxScaleIncrement) {
  this.scaleIncrement = Math.min(
    this.scaleIncrement + this.scaleIncrementPerHit, 
    this.maxScaleIncrement
  );
  
  const scaleMultiplier = 1 + (this.scaleIncrement / 100);
  const newScaleX = this.baseScale.x * scaleMultiplier;
  const newScaleY = this.baseScale.y * scaleMultiplier;
  
  this.trainAnimation.setScale(newScaleX, newScaleY);
}
```

**Примеры:**
- 1 прилет: масштаб = базовый * 1.003 (0.3%)
- 10 прилетов: масштаб = базовый * 1.03 (3%)
- 17 прилетов: масштаб = базовый * 1.05 (5% - максимум)
- 20+ прилетов: масштаб остается 1.05 (не увеличивается дальше)

#### `getPosition()`
Возвращает текущую позицию поезда в мировых координатах.

**Возвращает:** `{x, y}` или `null` если поезд не загружен

#### `getSpineAnimation()`
Возвращает ссылку на Spine анимацию поезда (для ParticleSystem и других систем).

## Треки анимаций

- **Трек 0**: `00_idle` - базовая idle анимация (зациклено)
- **Трек 1**: `01_piles_of_gold` - кучи золота (зациклено)
- **Трек 2**: `02_bg_speed_effect` - эффект скорости фона (зациклено)
- **Трек 3**: Разовые анимации при спине (`03_blick_add`, `04_steam_1`, `05_steam_2`)
- **Трек 4**: `06_active` / `active` - реакция на прилет монет (разово)

## Интеграция

### С CollectEffect

```javascript
// В SlotMachine.init()
this.collectEffect.setOnHitCallback(() => {
  this.trainManager.playActiveAnimation();
});
```

### С ParticleSystem

Позиция поезда используется для определения конечной точки перелета монет.

## Пример использования

```javascript
// Инициализация
this.trainManager = new TrainManager(this.config, this.app, this.app.stage);
await this.trainManager.init();

// При спине
this.trainManager.playSpinAnimation();

// При прилете монеты (через callback)
this.trainManager.playActiveAnimation(); // Автоматически увеличивает масштаб

// Получение позиции для перелета
const trainPosition = this.trainManager.getPosition();
```

## Конфигурация

В `config.js`:

```javascript
spine: {
  train: {
    enabled: true,
    animationName: '00_idle',
    loop: true,
    scale: { x: 1.0, y: 1.0 },
    position: { x: 960, y: 236 },
    zIndex: 90
  }
}
```

