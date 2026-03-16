#!/usr/bin/env python3
"""Экспорт total_win_desktop.spine и total_win_mobile.spine через Spine CLI."""

import os
import subprocess
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EXPORT_SETTINGS = os.path.join(SCRIPT_DIR, "total_win.export.json")

# (входной .spine, выходная папка)
PROJECTS = [
    ("total_win_desktop.spine", "total_win_desktop"),
    ("total_win_mobile.spine", "total_win_mobile"),
]


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

    if not os.path.isfile(EXPORT_SETTINGS):
        print("Ошибка: файл настроек не найден:", EXPORT_SETTINGS, file=sys.stderr)
        sys.exit(1)

    errors = 0
    for spine_name, output_name in PROJECTS:
        input_spine = os.path.join(SCRIPT_DIR, spine_name)
        output_dir = os.path.join(SCRIPT_DIR, output_name)

        if not os.path.isfile(input_spine):
            print(f"Пропуск (не найден): {spine_name}", file=sys.stderr)
            continue

        os.makedirs(output_dir, exist_ok=True)

        result = subprocess.run(
            [spine_exe, "-i", input_spine, "-o", output_dir, "-e", EXPORT_SETTINGS],
            cwd=SCRIPT_DIR,
        )

        if result.returncode != 0:
            print(f"Ошибка Spine при экспорте {spine_name} (код {result.returncode})", file=sys.stderr)
            errors += 1
        else:
            print(f"Экспорт завершён: {output_name}")

    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
