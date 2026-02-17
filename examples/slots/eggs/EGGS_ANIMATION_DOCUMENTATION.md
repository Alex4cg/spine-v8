<!DOCTYPE html>
<html>
<head>
<style>
body {
  background-color: white;
  color: #222;
  font-family: -apple-system, BlinkMacSystemFont, 'Roboto', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  line-height: 1.6;
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}
h1 { color: #1a1a1a; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
h2 { color: #2c3e50; margin-top: 30px; border-bottom: 2px solid #ecf0f1; padding-bottom: 5px; }
h3 { color: #2c3e50; margin-top: 20px; }
code { background-color: #f4f4f4; color: #000 !important; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-weight: 600; }
pre { background-color: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
pre code { background-color: transparent !important; color: #000 !important; padding: 0; font-weight: 600 !important; }
pre code *, pre code span, pre code .token, pre code .keyword, pre code .function, pre code .string, pre code .punctuation { color: #000 !important; }
blockquote { border-left: 4px solid #3498db; padding-left: 15px; margin-left: 0; color: #222; }
table { border-collapse: collapse; width: 100%; margin: 20px 0; }
th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
th { background-color: #3498db; color: white; }
ul, ol { margin: 10px 0; padding-left: 30px; }
li { margin: 5px 0; }
</style>
</head>
<body>

# Документация по Spine анимации Eggs

## Обзор

Spine анимация Eggs с поддержкой:

- Интерактивного управления через события


## Треки анимаций (Animation Tracks)

### Трек 0 (TRACK_IDLE) - Базовый трек

Базовый трек для фоновых анимаций, которые играют постоянно:

- **`00_idle`** — зациклено — основная анимация яйца (базовая, всегда крутится)
- **`00_idle_no_text`** — зациклено — анимация яйца без текста
- **`00_null`** — зациклено — пустое/скрытое состояние

### Трек 1 (TRACK_MAIN) - Основной трек для разовых анимаций

Трек для разовых анимаций, которые накладываются поверх базового трека:

- **`02_appearance`** — не зациклено — появление яйца (mixDuration: 0, мгновенное появление)
- **`02_start`** — не зациклено — стартовая анимация
- **`02_hit`** — не зациклено — анимация удара
- **`02_shot`** — не зациклено — анимация выстрела
- **`02_shot_to_total`** — не зациклено — анимация выстрела к тоталу (генерирует событие `egg_shot`)
- **`02_color_to_gold`** — не зациклено — анимация изменения цвета на золотой (генерирует событие `egg_shot`)
- **`02_jp_to_mult`** — не зациклено — анимация перехода JP к множителю
- **`02_win`** — зациклено — анимация победы

**Особенности:**
- Все анимации на треке 1 имеют `mixDuration: 0.1` (быстрый переход), кроме `02_appearance` (0 - мгновенное)
- После завершения анимации трек автоматически очищается, возвращаясь к базовому состоянию

### Трек 2 (TRACK_TRACK) - Трек для track анимаций

Трек для специальных анимаций, которые накладываются поверх всех остальных:

- **`01_track_jp_mult`** — зациклено — анимация track JP множителя
- **`01_track_no_jp_mult`** — зациклено — анимация track без JP множителя

**Особенности:**
- Анимации на треке 2 имеют `mixDuration: 0.2` (быстрое переключение)
- Можно переключать между анимациями с плавным смешиванием

## События (Events)

### Перечисление событий по анимациям

- **`00_idle`** — нет событий
- **`00_idle_no_text`** — нет событий
- **`00_null`** — нет событий
- **`02_appearance`** — нет событий
- **`02_start`** — нет событий
- **`02_hit`** — событие `egg_hit`
- **`02_shot`** — событие `egg_shot`
- **`02_color_to_gold`** — событие `egg_shot` 
- **`02_jp_to_mult`** — событие `mult_on`
- **`02_win`** — нет событий
- **`02_shot_to_total`** — событие `egg_shot`
- **`01_track_jp_mult`** — нет событий
- **`01_track_no_jp_mult`** — нет событий


## Скины (Skins)

### Основные скины яйца

- **`00_gold`** — золотой скин
- **`01_blue`** — синий скин
- **`02_red`** — красный скин
- **`03_purple`** — фиолетовый скин

### Скины (размеры джекпота)

- **`04_mini`** — мини 
- **`05_midi`** — миди 
- **`06_major`** — мажорный 
- **`07_grand`** — гранд 



## Важные особенности реализации

### 1. Очистка треков

- После завершения разовых анимаций на треке 1 трек автоматически очищается через `setEmptyAnimation(TRACK_MAIN, 0.1)`
- Базовый трек 0 продолжает играть постоянно
- Трек 2 может играть независимо от других треков

### 2. Смешивание анимаций

- `02_appearance`: `mixDuration = 0` — мгновенное появление
- Остальные анимации трека 1: `mixDuration = 0.1` — быстрый переход
- Анимации трека 2: `mixDuration = 0.2` — быстрое переключение

### 3. Управление скинами

- После смены скина необходимо вызывать:
  ```javascript
  skeleton.setSkin(skin);
  skeleton.setSlotsToSetupPose();
  state.apply(skeleton);
  skeleton.updateWorldTransform();
  ```

### 4. События анимаций

- События срабатывают во время проигрывания анимации, а не в начале или конце
- Слушатели событий настраиваются через `entry.listener = { event: (entry, event) => { ... } }`

## Примечания для разработчика

1. **Очистка треков**: Всегда очищайте трек 1 после завершения разовых анимаций, чтобы не блокировать другие анимации

2. **События**: Событие `egg_shot` может срабатывать в разных анимациях, необходимо проверять контекст вызова


## Версия

- **Spine версия**: Spine 4.1
- **PIXI.js версия**: v8
- **Дата создания документации**: 2024

</body>
</html>

