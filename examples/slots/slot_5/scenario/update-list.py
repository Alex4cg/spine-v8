#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Скрипт для автоматического обновления list.json
Находит все файлы с префиксом scenario_ и расширением .json в текущей папке
"""

import os
import json
from pathlib import Path

# Получаем путь к папке со скриптом
script_dir = Path(__file__).parent
list_file = script_dir / "list.json"

print(f"Сканирую папку: {script_dir}")

# Находим все файлы с префиксом scenario_ и расширением .json
scenario_files = sorted([
    f.name for f in script_dir.glob("scenario_*.json")
    if f.is_file()
])

if not scenario_files:
    print("Файлы сценариев не найдены!")
    exit(1)

print(f"Найдено файлов: {len(scenario_files)}")
for name in scenario_files:
    print(f"  - {name}")

# Создаем JSON массив
json_content = json.dumps(scenario_files, indent=2, ensure_ascii=False)

# Сохраняем в файл с UTF-8
try:
    with open(list_file, 'w', encoding='utf-8') as f:
        f.write(json_content)
    print(f"\nlist.json успешно обновлен!")
    print(f"Файл: {list_file}")
except Exception as e:
    print(f"ОШИБКА при записи файла: {e}")
    exit(1)
