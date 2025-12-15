# Работа со Spine анимациями

## Обзор

Система Spine анимаций позволяет добавлять и управлять анимированными элементами, созданными в Spine Editor. Каждая Spine анимация находится в своем контейнере на `stage` для независимого управления позицией и порядком отрисовки.

## Структура папок

```
slots/slot_1/spine/
  ├── train/              # Поезд
  │   ├── skeleton.json
  │   ├── skeleton.atlas
  │   └── skeleton.png
  └── logo/               # Логотип
      ├── skeleton.json
      ├── skeleton.atlas
      └── skeleton.png
```

**Важно:**
- Имя папки = имя спайна
- Файлы всегда называются `skeleton.json`, `skeleton.atlas`, `skeleton.png`
- Путь к спайну: `./spine/<имя_папки>/skeleton.json`

## Конфигурация

### В config.js

```javascript
spine: {
  train: {
    enabled: true,              // включить поезд
    animationName: '00_idle',   // имя анимации
    loop: true,                 // зациклить
    position: { x: 0, y: 0 },   // позиция (автоматически)
    scale: { x: 1, y: 1 },      // масштаб
    zIndex: 150                 // порядок отрисовки
  },
  logo: {
    enabled: true,
    animationName: 'idle',
    loop: true,
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    zIndex: 250
  }
}
```

## Загрузка и создание

### Автоматическая загрузка

Spine анимации загружаются автоматически при инициализации `SlotMachine`:

```javascript
await slotMachine.init();  // Загружает все включенные Spine анимации
```

### Структура контейнера

Каждая Spine анимация создается в своем контейнере:

```
app.stage
  └── <spineName>Container (PIXI.Container)
      └── spine (spine.Spine объект)
```

**Преимущества:**
- Независимое управление zIndex
- Трансформации применяются к контейнеру
- События работают на уровне самого спайна

## Управление анимациями

### Доступ к Spine объекту

```javascript
const trainAnimation = slotMachine.spineAnimations.train;
const trainSpine = trainAnimation.spine;  // Сам Spine объект
const trainContainer = trainAnimation.getContainer();  // Контейнер
```

### Смена анимации

```javascript
trainAnimation.playAnimation('animation_name', true);  // имя, зациклить
```

### Позиционирование

```javascript
trainAnimation.setPosition(x, y);  // Позиция контейнера
trainAnimation.setScale(scaleX, scaleY);  // Масштаб контейнера
```

## События Spine

### События анимации

```javascript
trainSpine.state.addListener({
  start: (entry) => console.log('Animation started'),
  complete: (entry) => console.log('Animation completed'),
  event: (entry, event) => console.log('Custom event:', event.data.name)
});
```

### PixiJS события

```javascript
trainSpine.eventMode = 'static';
trainSpine.on('pointerdown', (e) => {
  console.log('Spine clicked');
});
```

**Важно:** События работают независимо от контейнера - они привязаны к самому Spine объекту.

## Отладка позиции

Все Spine анимации доступны в отладчике позиции:
- **Train Spine Container** - контейнер поезда
- **Logo Spine Container** - контейнер логотипа

См. `DEBUG_POSITION_PROMPT.md` для подробностей.

## Добавление нового Spine

1. Создайте папку `spine/<имя_спайна>/`
2. Поместите файлы: `skeleton.json`, `skeleton.atlas`, `skeleton.png`
3. Добавьте конфигурацию в `config.js`:

```javascript
spine: {
  mySpine: {
    enabled: true,
    animationName: 'idle',
    loop: true,
    zIndex: 200
  }
}
```

4. Обновите `SlotMachine.loadSpineAnimations()` для загрузки нового спайна
5. Зарегистрируйте в `DebugPositionEditor.registerElements()` для отладки

## Технические детали

### Загрузка через PIXI.Assets

```javascript
await PIXI.Assets.load([
  { alias: "trainSkeleton", src: "./spine/train/skeleton.json" },
  { alias: "trainAtlas", src: "./spine/train/skeleton.atlas" }
]);

const spine = spine.Spine.from({
  skeleton: "trainSkeleton",
  atlas: "trainAtlas",
  scale: 1
});
```

### Физика

Для совместимости устанавливается пустая физика:

```javascript
if (!spine.skeleton.physics) {
  spine.skeleton.physics = {
    update: () => {},
    updateGlobal: () => {}
  };
}
```

### Проверка анимаций

Система автоматически проверяет наличие указанной анимации:

```javascript
const animations = this.spine.state.data.skeletonData.animations;
const animationNames = animations.map(anim => anim.name);

if (animationNames.includes(this.animationName)) {
  this.spine.state.setAnimation(0, this.animationName, this.loop);
} else {
  // Используется первая доступная анимация
  const firstAnim = animations[0].name;
  this.spine.state.setAnimation(0, firstAnim, this.loop);
}
```

## Рекомендации

1. **Именование**: используйте понятные имена папок (train, logo, character и т.д.)
2. **zIndex**: планируйте порядок отрисовки заранее
3. **События**: используйте для интерактивности и синхронизации с игровой логикой
4. **Производительность**: Spine анимации оптимизированы, но избегайте слишком большого количества одновременно активных спайнов
5. **Контейнеры**: каждый спайн в своем контейнере - это позволяет независимо управлять несколькими спайнами

## Примеры использования

### Базовое использование

```javascript
// В SlotMachine.js
async loadSpineAnimations() {
  if (this.config.spine.train.enabled) {
    this.spineAnimations.train = new SpineAnimation(
      this.config.spine.train,
      this.app,
      this.app.stage,  // Родительский контейнер (stage)
      'train',
      this.config.spine.train.animationName,
      this.config.spine.train.loop
    );
    
    await this.spineAnimations.train.load();
    
    // Устанавливаем позицию и масштаб
    const pos = this.config.spine.train.position;
    this.spineAnimations.train.setPosition(pos.x, pos.y);
    
    const scale = this.config.spine.train.scale;
    this.spineAnimations.train.setScale(scale.x, scale.y);
    
    // Устанавливаем zIndex
    this.spineAnimations.train.getContainer().zIndex = this.config.spine.train.zIndex;
  }
}
```

### Смена анимации во время игры

```javascript
// При нажатии на кнопку спина
slotMachine.spineAnimations.train.playAnimation('spin', false);  // проиграть 1 раз

// После завершения спина
slotMachine.spineAnimations.train.playAnimation('00_idle', true);  // вернуться к idle
```

### Обработка событий

```javascript
const trainSpine = slotMachine.spineAnimations.train.spine;

trainSpine.state.addListener({
  complete: (entry) => {
    if (entry.animation.name === 'spin') {
      // Анимация спина завершена, вернуться к idle
      slotMachine.spineAnimations.train.playAnimation('00_idle', true);
    }
  }
});
```

