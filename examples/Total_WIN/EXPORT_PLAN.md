# План: Экспорт total_win.spine в total_win_desktop

## Задача

Запустить `total_win.spine` и экспортировать в папку `total_win_desktop` (skeleton.json, skeleton.atlas, skeleton.png). Только Spine CLI, без GUI.

## Spine CLI (официальная документация)

Источник: [esotericsoftware.com/spine-command-line-interface](http://esotericsoftware.com/spine-command-line-interface)

**Один вызов — всё делает:**
```
Spine -i <project.spine> -o <output_folder> -e json+pack
```
- `json+pack` — экспорт JSON скелета + паковка текстур в атлас (дефолтные настройки)
- Папка output создаётся автоматически
- Windows: использовать **Spine.com** (ждёт завершения), а не Spine.exe

**Пример из документации:**
```
Spine -i /path/to/project.spine -o /path/to/output/ -e json+pack
```

---

## Структура Total_WIN (текущая)

```
Total_WIN/
  total_win.spine          # Вход
  total_win_desktop/       # Выход (skeleton.json, skeleton.atlas, skeleton.png)
  total_win_tps.pack.json  # Pack settings (для json+pack не нужны — используются дефолты)
  export.py                # Скрипт (создать)
```

---

## Код export.py

```python
#!/usr/bin/env python3
"""Экспорт total_win.spine в total_win_desktop через Spine CLI."""

import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
INPUT_SPINE = os.path.join(SCRIPT_DIR, "total_win.spine")
OUTPUT_DIR = os.path.join(SCRIPT_DIR, "total_win_desktop")


def find_spine():
    for path in [
        os.environ.get("SPINE_PATH"),
        r"C:\Program Files\Spine\Spine.com",
        r"C:\Program Files (x86)\Spine\Spine.com",
    ]:
        if path and os.path.isfile(path):
            return path
    return None


def main():
    spine_exe = find_spine()
    if not spine_exe:
        print("Ошибка: Spine.com не найден. Установите Spine или задайте SPINE_PATH.", file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(INPUT_SPINE):
        print(f"Ошибка: файл не найден: {INPUT_SPINE}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    result = subprocess.run(
        [spine_exe, "-i", INPUT_SPINE, "-o", OUTPUT_DIR, "-e", "json+pack"],
        cwd=SCRIPT_DIR,
    )

    if result.returncode != 0:
        print(f"Ошибка Spine (код {result.returncode})", file=sys.stderr)
        sys.exit(result.returncode)

    print("Экспорт завершён:", OUTPUT_DIR)


if __name__ == "__main__":
    main()
```

---

## Инструкция

1. Убедиться, что Spine установлен (Spine.com в `C:\Program Files\Spine\` или переменная `SPINE_PATH`)
2. В папке Total_WIN выполнить: `python export.py`
3. Результат: `total_win_desktop/skeleton.json`, `skeleton.atlas`, `skeleton.png`
