# Инструкция по запуску сервера

## Правильный запуск сервера

Для корректной работы проекта сервер **должен запускаться из корневой директории `examples`**, а не из `slots/slot_1`.

### Шаги запуска:

1. **Откройте терминал** (PowerShell или CMD)

2. **Перейдите в корневую директорию проекта:**
   ```powershell
   cd D:\GitHub\Spine_dev\test\spine-v8\examples
   ```

3. **Запустите HTTP сервер на порту 8000:**
   ```powershell
   python -m http.server 8000
   ```

   Или одной командой:
   ```powershell
   cd D:\GitHub\Spine_dev\test\spine-v8\examples; python -m http.server 8000
   ```

4. **Откройте в браузере:**
   ```
   http://localhost:8000/slots/slot_1/index.html
   ```

### Важно:

- ✅ **Правильно:** Сервер запущен из `examples/` → путь `http://localhost:8000/slots/slot_1/index.html`
- ❌ **Неправильно:** Сервер запущен из `slots/slot_1/` → путь `http://localhost:8000/index.html` (не работает!)

### Остановка сервера:

- Нажмите `Ctrl+C` в терминале, где запущен сервер
- Или закройте окно терминала
- Или найдите процесс Python в диспетчере задач и завершите его

### Проверка работы сервера:

После запуска сервер должен отвечать на порту 8000. Проверить можно командой:
```powershell
Test-NetConnection -ComputerName localhost -Port 8000 -InformationLevel Quiet
```

Если возвращает `True` - сервер работает.

### Решение проблем:

**Ошибка 404 "File not found":**
- Убедитесь, что сервер запущен из директории `examples`
- Проверьте, что файл `slots/slot_1/index.html` существует
- Обновите страницу в браузере (Ctrl+F5)

**Порт 8000 занят:**
- Остановите другие процессы Python, использующие порт 8000
- Или используйте другой порт: `python -m http.server 8001`
- Тогда URL будет: `http://localhost:8001/slots/slot_1/index.html`

### Структура проекта:

```
examples/
├── assets/
│   └── libs/
│       ├── spine-pixi.js
│       └── particle-emitter.min.js
├── slots/
│   └── slot_1/
│       ├── index.html
│       ├── config.js
│       ├── SlotMachine.js
│       └── ...
└── ...
```

Сервер должен видеть всю структуру от корня `examples/`, чтобы правильно разрешать пути к ресурсам (например, `../../../assets/libs/spine-pixi.js` из `slots/slot_1/index.html`).

