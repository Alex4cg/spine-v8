<!DOCTYPE html>
<html>
<head>
<style>
body {
  background-color: white;
  color: #333;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}
h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
h2 { color: #34495e; margin-top: 30px; border-bottom: 2px solid #ecf0f1; padding-bottom: 5px; }
h3 { color: #555; margin-top: 20px; }
code { background-color: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; }
pre { background-color: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
blockquote { border-left: 4px solid #3498db; padding-left: 15px; margin-left: 0; color: #666; }
table { border-collapse: collapse; width: 100%; margin: 20px 0; }
th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
th { background-color: #3498db; color: white; }
</style>
</head>
<body>

# Документация по анимации перелета (Collect Effect)

## Обзор

Spine анимация перелета монет (`collect_effect`) используется для визуального эффекта перелета монет из поезда на игровое поле или наоборот - из поля в поезд.

## Структура файлов

```
assets/train/
├── collect_effect.json   # Spine скелет перелета монет
├── collect_effect.atlas   # Атлас текстур перелета
└── collect_effect.webp   # Текстуры перелета
```

## Анимации

### Базовые анимации

#### `null`
- **Зациклено**: Да
- **Описание**: Скрытое/пустое состояние перелета. Используется по умолчанию, когда эффект не активен.

#### `start_effect`
- **Зациклено**: Нет
- **Описание**: Начало эффекта перелета. Запускается одновременно с `hit_coin` и `end_effect`.

#### `hit_coin`
- **Зациклено**: Нет
- **Описание**: Основная анимация перелета монет. Во время проигрывания генерирует событие `collect_effect_hit`.

#### `end_effect`
- **Зациклено**: Нет
- **Описание**: Завершение эффекта перелета. Запускается одновременно с `start_effect` и `hit_coin`.

## Скины (Skins)

В Spine `collect_effect` доступны следующие скины:

- **`gold`** - золотой скин (используется в игре)
- **`blue`** - синий скин
- **`red`** - красный скин
- **`green`** - зеленый скин

> В игре на данный момент используется только скин `gold`.

## События (Events)

### `collect_effect_hit`
- **Когда срабатывает**: Во время проигрывания анимации `hit_coin`
- **Что должно произойти**: 
  - Запуск анимации поезда `06_active` (разовая)
  - ИЛИ запуск логики Level Up (анимация `06_active` + переключение уровня)

## Логика применения

### Два сценария использования

#### 1. Хит (выстрел из поезда)
**Последовательность:**
1. Запускается анимация поезда `07_hit`
2. Во время проигрывания срабатывает событие `train_hit`
3. На событие `train_hit`:
   - Запускаются анимации перелета (`start_effect`, `hit_coin`, `end_effect`) одновременно
   - Создается всплеск монет из эмиттеров (burst 80-100 частиц, spread 60°)
   - Эффект перелета направлен из поезда на игровое поле

**Визуально:** Поезд стреляет, монеты вылетают из поезда и перелетают на поле.

#### 2. Хит ту трейн (выстрел в поезд)
**Последовательность:**
1. Запускаются анимации перелета (`start_effect`, `hit_coin`, `end_effect`) одновременно
2. Во время проигрывания `hit_coin` срабатывает событие `collect_effect_hit`
3. На событие `collect_effect_hit`:
   - Запускается анимация поезда `06_active` (разовая)
   - ИЛИ запускается логика Level Up
   - Всплеск монет не создается
   - Эффект перелета направлен из игрового поля в поезд

**Визуально:** Монеты перелетают из поля в поезд, поезд реагирует на попадание.

### Управление костями

Для настройки траектории перелета используются кости управления:
- `control_point_1` - первая контрольная точка
- `control_point_2` - вторая контрольная точка
- `control_point_1_t` - тангенс первой точки (направление)
- `control_point_2_t` - тангенс второй точки (направление)

Эти кости используются для интерактивного управления траекторией перелета. Рекомендуется расставить опорные точки так, чтобы эффект вылетал по широкой заметной дуге: сначала вверх, потом в поле (или наоборот, в зависимости от направления).

### Технические детали

- Все три анимации (`start_effect`, `hit_coin`, `end_effect`) запускаются одновременно на разных треках
- Анимации разовые (не зациклены)
- Перед запуском треки должны быть очищены:
  ```javascript
  collectEffect.state.clearTrack(TRACK_COLLECT_START_EFFECT);
  collectEffect.state.clearTrack(TRACK_COLLECT_HIT_COIN);
  collectEffect.state.clearTrack(TRACK_COLLECT_END_EFFECT);
  collectEffect.state.setEmptyAnimation(TRACK_COLLECT_START_EFFECT, 0);
  collectEffect.state.setEmptyAnimation(TRACK_COLLECT_HIT_COIN, 0);
  collectEffect.state.setEmptyAnimation(TRACK_COLLECT_END_EFFECT, 0);
  ```

## Z-Index

Collect effect должен быть выше всех слоев поезда.

## Примечания для разработчика

1. **Инициализация**: После создания Spine объекта и добавления на stage необходимо подождать один кадр перед установкой скина и вызовом `setSlotsToSetupPose()`

2. **События**: Событие `collect_effect_hit` срабатывает во время проигрывания анимации `hit_coin`, не в начале и не в конце

3. **Очистка треков**: После завершения анимаций треки автоматически очищаются, но можно явно очистить их при необходимости

4. **Направление эффекта**: Направление перелета зависит от логики игры - либо из поезда на поле (Хит), либо из поля в поезд (Хит ту трейн)

</body>
</html>
