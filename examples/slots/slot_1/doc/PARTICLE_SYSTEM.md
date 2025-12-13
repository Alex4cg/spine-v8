# ParticleSystem - Система частиц

## Описание

`ParticleSystem` управляет эмиттерами частиц вокруг поезда, включая дым и фонтаны монет. Система реагирует на прилет монет, создавая всплеск частиц.

## Основные возможности

- **Эмиттер дыма**: Стандартный эмиттер дыма за поездом
- **Эмиттеры монет**: Кастомные эмиттеры фонтанов монет перед поездом
- **Реакция на прилет**: Всплеск монет при событии `collect_effect_hit`
- **Динамическое обновление**: Позиции эмиттеров следуют за костями поезда

## Структура

### Конструктор

```javascript
constructor(app, stage)
```

- `app` - Экземпляр PixiJS Application
- `stage` - Stage контейнер

### Основные методы

#### `async init(trainSpine)`
Инициализирует систему частиц.

**Параметры:**
- `trainSpine` - Spine анимация поезда (для привязки к костям)

**Процесс:**
1. Создает контейнеры:
   - `particleLayer` (zIndex 85) - для дыма (за поездом)
   - `coinLayer` (zIndex 95) - для монет (перед поездом)
2. Инициализирует эмиттер дыма через `initSmokeEmitter()`
3. Инициализирует эмиттеры монет через `initCoinEmitters()`
4. Настраивает обновление в ticker через `setupTickerUpdate()`

#### `async initSmokeEmitter(trainSpine)`
Создает стандартный эмиттер дыма.

**Кость:** `place_holder_emitter_1`

**Ресурсы:**
- Конфигурация: `./particles/emitter.json`
- Текстура: `./particles/m_smoke.png`

#### `async initCoinEmitters(trainSpine)`
Создает кастомные эмиттеры монет.

**Кости:**
- `place_holder_emitter_gold_1`
- `place_holder_emitter_gold_2`

**Ресурсы:**
- Текстуры монет: `./particles/coin_gold/00.png` - `./particles/coin_gold/16.png` (17 кадров анимации)

**Конфигурация эмиттера:**
```javascript
{
  startSpeed: 420,        // Начальная скорость
  gravity: 900,           // Гравитация
  spread: 30,             // Разброс угла (градусы)
  lifetimeMin: 1,         // Минимальное время жизни
  lifetimeMax: 1,         // Максимальное время жизни
  scaleStart: 0.5,        // Начальный масштаб
  scaleEnd: 0.3,          // Конечный масштаб
  rotationSpeedMin: -5,   // Минимальная скорость вращения
  rotationSpeedMax: 5,     // Максимальная скорость вращения
  animationSpeed: 30,      // Скорость анимации (30 fps)
  maxParticles: 300,      // Максимум частиц
  emissionRate: 0.1       // Частота эмиссии
}
```

#### `triggerHitBurst()`
Создает всплеск частиц при прилете монеты.

**Процесс:**
1. Для каждого эмиттера монет:
   - Сохраняет оригинальные значения `spread` и `emissionRate`
   - Увеличивает `spread` до 60 градусов (для более широкого всплеска)
   - Вызывает `burst(80-100)` - создает 80-100 частиц сразу
   - Устанавливает `emissionRate` в 0.01 (очень высокая частота)
   - Через 300мс возвращает оригинальные значения

**Использование:**
```javascript
// В SlotMachine.init()
this.collectEffect.setOnHitCallback(() => {
  this.particleSystem.triggerHitBurst();
});
```

#### `setupTickerUpdate(trainSpine)`
Настраивает обновление позиций эмиттеров каждый кадр.

**Обновляет:**
- Позицию эмиттера дыма (следует за костью `place_holder_emitter_1`)
- Позиции и углы эмиттеров монет (следуют за костями `place_holder_emitter_gold_1` и `place_holder_emitter_gold_2`)

## CustomCoinEmitter

Кастомный эмиттер монет с анимацией и физикой.

### Методы

#### `burst(count)`
Создает взрыв частиц (создает `count` частиц сразу).

#### `setSpread(spread)`
Устанавливает разброс угла в градусах.

#### `setEmissionRate(rate)`
Устанавливает частоту эмиссии (чем меньше значение, тем чаще эмиссия).

#### `setPositionAndAngle(x, y, angle)`
Устанавливает позицию и угол направления эмиттера.

## Интеграция

### С CollectEffect

```javascript
// В SlotMachine.init()
this.collectEffect.setOnHitCallback(() => {
  this.particleSystem.triggerHitBurst();
});
```

### С TrainManager

Позиции эмиттеров привязаны к костям поезда и обновляются каждый кадр.

## Пример использования

```javascript
// Инициализация
this.particleSystem = new ParticleSystem(this.app, this.app.stage);
await this.particleSystem.init(this.trainManager.getSpineAnimation());

// При прилете монеты (через callback)
this.particleSystem.triggerHitBurst();
```

## Структура файлов

```
particles/
  ├── emitter.json          # Конфигурация эмиттера дыма
  ├── m_smoke.png           # Текстура дыма
  └── coin_gold/
      ├── 00.png            # Кадр 0 анимации монеты
      ├── 01.png            # Кадр 1
      ├── ...
      └── 16.png            # Кадр 16
```

## Z-Index слои

- **85**: `particleLayer` (дым) - за поездом
- **90**: Поезд
- **95**: `coinLayer` (монеты) - перед поездом
