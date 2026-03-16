# Slot Machine Demo

HTML5 Canvas игра на PIXI.js со Spine-анимациями.

## 🎮 Игра

Игра доступна по адресу: [https://[username].github.io/[repository]/slots/slot_1/index.html](https://[username].github.io/[repository]/slots/slot_1/index.html)

## 🚀 Запуск локально

```bash
python -m http.server 8000
```

Затем откройте: http://localhost:8000/slots/slot_1/index.html

## 🛠 Технологии

- **PIXI.js** - Canvas рендеринг
- **Spine** - 2D скелетная анимация
- **JavaScript ES6+** - Современный JavaScript с модулями

## 📁 Структура проекта

```
slots/slot_1/
├── index.html          # Главный файл игры
├── SlotMachine.js     # Основная логика слота
├── CoinManager.js     # Управление монетами
├── CollectorManager.js # Управление коллекторами
├── BonusManager.js    # Логика бонусного раунда
├── IntrigueManager.js # Логика интриги
├── config.js          # Конфигурация игры
└── matrix/            # Сценарии игры
    ├── scenario_v2.json
    └── scenario_bonus.json
```

## 🎯 Особенности

- Анимации персонажей на Spine
- Система событий (интрига, бонус)
- Полеты монет к коллекторам
- Визуальные эффекты и частицы
- Адаптивный интерфейс

## 📝 Лицензия

Это демо-проект для демонстрации возможностей PIXI.js и Spine.


