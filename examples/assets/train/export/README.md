# CustomCoinEmitter - Эмиттер фонтана монет

Кастомный эмиттер частиц для создания эффекта фонтана монет с физикой гравитации и анимацией текстур.

## 📦 Содержимое пакета

- `CustomCoinEmitter.js` - Основной класс эмиттера
- `config.json` - Конфигурационный файл с параметрами
- `coin_gold/` - Папка с текстурами монет (17 кадров: 00.png - 16.png)
- `example.html` - Пример использования
- `README.md` - Документация

## 🚀 Быстрый старт

### 1. Подключение библиотек

```html
<script src="https://pixijs.download/release/pixi.min.js"></script>
<script src="./CustomCoinEmitter.js"></script>
```

### 2. Загрузка текстур

```javascript
// Загрузка текстур монет
const coinTextures = [];
for (let i = 0; i <= 16; i++) {
  const num = i.toString().padStart(2, '0');
  coinTextures.push({ 
    alias: `coin_${num}`, 
    src: `./coin_gold/${num}.png` 
  });
}

await PIXI.Assets.load(coinTextures);

// Получение массивов текстур
const coinTexturesArray = [];
for (let i = 0; i <= 16; i++) {
  const num = i.toString().padStart(2, '0');
  coinTexturesArray.push(PIXI.Assets.get(`coin_${num}`));
}
```

### 3. Создание эмиттера

```javascript
const app = new PIXI.Application();
await app.init({ width: 800, height: 600 });
document.body.appendChild(app.canvas);

// Создание контейнера для монет
const coinLayer = new PIXI.Container();
app.stage.addChild(coinLayer);

// Создание эмиттера
const coinEmitter = new CustomCoinEmitter(coinLayer, coinTexturesArray, {
  startSpeed: 420,      // Начальная скорость вверх
  gravity: 900,         // Гравитация вниз (пикселей/сек²)
  spread: 30,           // Разброс угла в градусах
  lifetimeMin: 1.0,     // Минимальное время жизни
  lifetimeMax: 1.0,      // Максимальное время жизни
  scaleStart: 0.5,      // Начальный размер
  scaleEnd: 0.3,        // Конечный размер
  rotationSpeedMin: -5, // Минимальная скорость вращения
  rotationSpeedMax: 5,  // Максимальная скорость вращения
  animationSpeed: 30,   // Скорость анимации (30 fps)
  maxParticles: 300,    // Максимальное количество частиц
  emissionRate: 0.1,    // Частота эмиссии (0.1 сек = 10 монет/сек)
  x: 400,               // Позиция X
  y: 300,               // Позиция Y
  angle: 0              // Угол направления (в радианах)
});

// Включение эмиссии
coinEmitter.emit = true;

// Обновление в игровом цикле
app.ticker.add(() => {
  const deltaTime = app.ticker.deltaMS / 1000;
  coinEmitter.update(deltaTime);
});
```

## 📋 Параметры конфигурации

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `startSpeed` | number | 450 | Начальная скорость частиц (пикселей/сек) |
| `gravity` | number | 900 | Гравитация вниз (пикселей/сек²) |
| `spread` | number | 30 | Разброс угла в градусах |
| `lifetimeMin` | number | 1.2 | Минимальное время жизни частицы (сек) |
| `lifetimeMax` | number | 1.6 | Максимальное время жизни частицы (сек) |
| `scaleStart` | number | 1 | Начальный масштаб частицы |
| `scaleEnd` | number | 0.5 | Конечный масштаб частицы |
| `rotationSpeedMin` | number | -5 | Минимальная скорость вращения |
| `rotationSpeedMax` | number | 5 | Максимальная скорость вращения |
| `animationSpeed` | number | 30 | Скорость анимации текстуры (кадров/сек) |
| `maxParticles` | number | 500 | Максимальное количество частиц |
| `emissionRate` | number | 0.02 | Частота эмиссии (сек между частицами) |
| `x` | number | 0 | Позиция X эмиттера |
| `y` | number | 0 | Позиция Y эмиттера |
| `angle` | number | 0 | Угол направления эмиттера (радианы) |

## 🎮 Методы API

### Основные методы

- `update(deltaTime)` - Обновление эмиттера (вызывать каждый кадр)
- `setPosition(x, y)` - Установка позиции эмиттера
- `setAngle(angle)` - Установка угла направления (в радианах)
- `setPositionAndAngle(x, y, angle)` - Установка позиции и угла одновременно
- `setEmissionRate(rate)` - Установка частоты эмиссии
- `setSpread(spread)` - Установка разброса угла (в градусах)
- `burst(count)` - Создание взрыва частиц (burst)
- `clear()` - Очистка всех частиц
- `destroy()` - Уничтожение эмиттера

### Свойства

- `emit` (boolean) - Включение/выключение эмиссии
- `x`, `y` (number) - Позиция эмиттера
- `angle` (number) - Угол направления (в радианах)

## 🔗 Привязка к костям Spine

Пример привязки эмиттера к кости Spine:

```javascript
// Находим кость
const bone = spineObject.skeleton.findBone("place_holder_emitter_gold_1");

// В игровом цикле обновляем позицию и угол
app.ticker.add(() => {
  if (bone) {
    // Получаем мировые координаты кости
    const point = { x: bone.worldX, y: bone.worldY };
    spineObject.skeletonToPixiWorldCoordinates(point);
    
    // Получаем угол поворота кости
    let boneAngle = 0;
    if (typeof bone.getWorldRotationX === 'function') {
      const angleDeg = bone.getWorldRotationX();
      boneAngle = (angleDeg * Math.PI) / 180;
    } else if (bone.a !== undefined && bone.b !== undefined) {
      boneAngle = Math.atan2(bone.b, bone.a);
    }
    
    // Устанавливаем позицию и угол эмиттера
    coinEmitter.setPositionAndAngle(point.x, point.y, boneAngle);
  }
  
  // Обновляем эмиттер
  const deltaTime = app.ticker.deltaMS / 1000;
  coinEmitter.update(deltaTime);
});
```

## 💡 Примеры использования

### Взрыв монет (burst)

```javascript
// Создать взрыв из 80 монет
coinEmitter.burst(80);
```

### Временное увеличение частоты эмиссии

```javascript
// Сохраняем оригинальную частоту
const originalRate = coinEmitter.emissionRate;

// Увеличиваем частоту
coinEmitter.setEmissionRate(0.01);

// Через 0.3 секунды возвращаем
setTimeout(() => {
  coinEmitter.setEmissionRate(originalRate);
}, 300);
```

### Изменение разброса для более широкого фонтана

```javascript
// Увеличиваем разброс с 30 до 60 градусов
coinEmitter.setSpread(60);
```

## 📝 Физика

Эмиттер использует простую физику с гравитацией:

- **Начальная скорость**: `vx = sin(angle) * speed`, `vy = -cos(angle) * speed`
- **Гравитация**: `vy += gravity * deltaTime`
- **Позиция**: `x += vx * deltaTime`, `y += vy * deltaTime`

Где:
- `angle` - угол направления эмиттера + случайный разброс
- `speed` - начальная скорость с вариацией ±20%
- `gravity` - ускорение вниз (900 пикселей/сек² по умолчанию)

## 🎨 Анимация текстур

Монеты используют последовательность из 17 кадров (00.png - 16.png), которые проигрываются с частотой 30 fps. Каждая частица имеет свой случайный начальный кадр для более естественного вида.

## ⚙️ Оптимизация

- Частицы переиспользуются (пул объектов)
- Неактивные частицы скрываются, но не удаляются
- Максимальное количество частиц ограничено параметром `maxParticles`

## 📄 Лицензия

Используйте свободно в ваших проектах.







