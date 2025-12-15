# Атласирование анимационных последовательностей

## Обзор

Система атласирования позволяет объединять последовательности кадров анимации в единый текстурый атлас для оптимизации загрузки и рендеринга. Это особенно полезно для winframe анимаций и других эффектов, состоящих из множества кадров.

## Структура папок

```
slots/slot_1/
  ├── seq/                    # Исходные последовательности кадров
  │   └── winframe_60_fps/    # Папка с последовательностью
  │       ├── 00.png
  │       ├── 01.png
  │       ├── ...
  │       └── 59.png
  └── atlas/                  # Сгенерированные атласы
      └── winframe_60_fps/
          ├── winframe_60_fps.json  # JSON с координатами кадров
          └── winframe_60_fps.png   # Текстура атласа
```

## Создание атласа

### Команда

```bash
node scripts/make-atlas.js <имя_секвенции>
```

**Пример:**
```bash
node scripts/make-atlas.js winframe_60_fps
```

### Требования

1. **Исходные файлы**: PNG кадры должны находиться в `slots/slot_1/seq/<имя_секвенции>/`
2. **Именование**: файлы должны быть названы в формате `00.png`, `01.png`, `02.png`, ... (с ведущими нулями)
3. **Сортировка**: файлы автоматически сортируются по имени

### Параметры упаковки

Скрипт использует следующие параметры (в `scripts/make-atlas.js`):

```javascript
{
  width: 4096,           // Ширина атласа
  height: 2048,          // Высота атласа
  padding: 2,             // Отступ между кадрами (пиксели)
  allowRotation: true,   // Разрешить поворот кадров для лучшей упаковки
  allowTrim: true,       // Обрезать прозрачные края
  trimMode: 'trim',      // Режим обрезки
  alphaThreshold: 0,     // Порог прозрачности для trim
  exporter: 'JsonHash'   // Формат экспорта (совместим с PixiJS)
}
```

### Результат

После выполнения создаются:
- **JSON файл**: содержит координаты и размеры каждого кадра в атласе
- **PNG файл**: текстура атласа с упакованными кадрами

**Расположение:** `slots/slot_1/atlas/<имя_секвенции>/`

## Использование атласа в коде

### Загрузка атласа

В `WinFrameAnimation.js`:

```javascript
async loadAtlas() {
  const atlasPath = this.config.winFrameAnimation.atlasPath;
  this.atlas = await PIXI.Assets.load(atlasPath);
  
  // Извлекаем текстуры в правильном порядке
  for (let i = 0; i < this.config.winFrameAnimation.frameCount; i++) {
    const frameName = String(i).padStart(2, '0') + '.png';
    if (this.atlas.textures[frameName]) {
      this.textures.push(this.atlas.textures[frameName]);
    }
  }
}
```

### Создание анимированного спрайта

```javascript
const sprite = new PIXI.AnimatedSprite(this.textures);
sprite.animationSpeed = 1.0;  // 60 fps
sprite.loop = false;          // проиграть 1 раз
sprite.anchor.set(0.5);       // центр спрайта
sprite.blendMode = 'add';      // аддитивное наложение
```

## Конфигурация

### В config.js

```javascript
winFrameAnimation: {
  atlasPath: './atlas/winframe_60_fps/winframe_60_fps.json',
  frameCount: 60,              // Количество кадров в последовательности
  animationSpeed: 1.0,          // Скорость анимации (1.0 = 60 fps)
  loop: false                   // Зациклить анимацию
}
```

## Обработка ошибок

### Если атлас не помещается в один файл

Если все кадры не помещаются в один атлас 4096x2048, скрипт создаст несколько атласов:
- `winframe_60_fps.json` и `winframe_60_fps.png` (первый атлас)
- `winframe_60_fps_1.json` и `winframe_60_fps_1.png` (второй атлас)
- и т.д.

**Решение:**
- Уменьшите `padding` в параметрах упаковки
- Убедитесь что `allowRotation: true` (уже включено)
- Проверьте размеры исходных кадров

### Исправление JSON после генерации

Иногда `free-tex-packer-core` создает JSON с вложенным `buffer` объектом. Для исправления используйте:

```bash
node scripts/fix-atlas-json.js
```

Этот скрипт автоматически исправляет все JSON файлы в папке `atlas/winframe_60_fps/`.

## Технические детали

### Библиотека

Используется `free-tex-packer-core` - Node.js библиотека для упаковки текстур.

**Установка:**
```bash
npm install free-tex-packer-core
```

### Формат JSON

Атлас использует формат `JsonHash`, который совместим с PixiJS:

```json
{
  "frames": {
    "00.png": {
      "frame": {"x": 0, "y": 0, "w": 100, "h": 100},
      "rotated": false,
      "trimmed": true,
      "spriteSourceSize": {"x": 0, "y": 0, "w": 100, "h": 100},
      "sourceSize": {"w": 100, "h": 100}
    },
    ...
  },
  "meta": {
    "app": "free-tex-packer",
    "version": "1.0.0",
    "image": "winframe_60_fps.png",
    "size": {"w": 4096, "h": 2048}
  }
}
```

### Оптимизация

- **Trim**: автоматическая обрезка прозрачных краев уменьшает размер атласа
- **Rotation**: поворот кадров позволяет лучше упаковать их в прямоугольник
- **Padding**: отступы предотвращают артефакты при фильтрации текстур

## Добавление новой последовательности

1. Создайте папку в `slots/slot_1/seq/<имя_секвенции>/`
2. Поместите PNG кадры с именами `00.png`, `01.png`, ...
3. Запустите: `node scripts/make-atlas.js <имя_секвенции>`
4. Обновите конфигурацию в `config.js` если нужно
5. Используйте в коде через `PIXI.Assets.load()`

## Примеры использования

### Winframe анимация

```javascript
// Загрузка
await winFrameAnimation.loadAtlas();

// Воспроизведение на выигрышных линиях
// Автоматически определяет горизонтальные линии одинаковых символов
winFrameAnimation.playOnWinningLines(reels);
```

**Важно:** Winframe анимация теперь воспроизводится только на горизонтальных линиях одинаковых символов. Система автоматически проверяет все три позиции (верхняя, средняя, нижняя) после остановки всех рилов и подсвечивает только выигрышные линии.

### Создание собственной анимации

```javascript
// Загрузка атласа
const atlas = await PIXI.Assets.load('./atlas/my_animation/my_animation.json');

// Извлечение текстур
const textures = [];
for (let i = 0; i < frameCount; i++) {
  const frameName = String(i).padStart(2, '0') + '.png';
  if (atlas.textures[frameName]) {
    textures.push(atlas.textures[frameName]);
  }
}

// Создание анимированного спрайта
const sprite = new PIXI.AnimatedSprite(textures);
sprite.animationSpeed = 1.0;
sprite.loop = true;
sprite.play();
```

## Рекомендации

1. **Именование**: используйте последовательную нумерацию с ведущими нулями
2. **Размеры**: старайтесь использовать кадры примерно одинакового размера
3. **Прозрачность**: используйте PNG с альфа-каналом для прозрачных областей
4. **Количество кадров**: для 60 fps анимации длительностью 1 секунда нужно 60 кадров
5. **Размер атласа**: 4096x2048 обычно достаточно для большинства последовательностей

