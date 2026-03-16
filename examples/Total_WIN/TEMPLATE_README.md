# Total_WIN — шаблон экспорта Spine

## Что оставить без изменений (ядро шаблона)

| Файл | Назначение |
|------|------------|
| `export.py` | Скрипт экспорта. Вызывает Spine CLI. Не менять логику путей и вызова. |
| `total_win.export.json` | Настройки экспорта Spine. Важно: `packTarget: "perskeleton"`, `packSource: "attachments"` — атлас по скелету. |

Для другого проекта можно:
- переименовать `total_win.export.json` → `мой_проект.export.json` и обновить путь в `export.py` (константа `EXPORT_SETTINGS`);
- в `export.py` менять только список `PROJECTS` — добавлять/удалять пары `(входной .spine, выходная папка)`.

---

## Что подменять под свой проект

| Файл/папка | Описание |
|------------|----------|
| `*.spine` | Spine‑проекты (total_win_desktop.spine, total_win_mobile.spine). Замени на свои. |
| `images/` | Картинки, на которые ссылаются `.spine`. Подставь свои изображения. |

---

## Что можно удалить (лишнее)

| Файл | Причина |
|------|---------|
| `total_win_tps.pack.json` | Только настройки Texture Packer. Их уже внесены в `total_win.export.json` (блок `packAtlas`). Не используется при экспорте. |
| `total_win_atps.pack.json` | Резервная копия настроек экспорта. Не нужен при работе, только для справки. |
| `total_win_desktop/` | Папки вывода — создаются заново при каждом `python export.py`. В шаблон не включать. |
| `total_win_mobile/` | То же. |
| `EXPORT_PLAN.md` | Описание плана, не обязательно для шаблона. |

---

## Минимальный набор для шаблона

```
Total_WIN/
├── export.py              ← обязательно
├── total_win.export.json  ← обязательно
├── total_win_desktop.spine
├── total_win_mobile.spine
└── images/
    ├── desktop/
    └── mobile/
```

---

## Как использовать шаблон

1. Скопировать папку.
2. Заменить `.spine` и `images/` на свои.
3. В `export.py` обновить `PROJECTS`:
   ```python
   PROJECTS = [
       ("мой_desktop.spine", "мой_desktop"),
       ("мой_mobile.spine", "мой_mobile"),
   ]
   ```
4. При необходимости переименовать `total_win.export.json` и прописать новый путь в `EXPORT_SETTINGS`.
5. Выполнить: `python export.py` (должен быть установлен Spine и настроен `SPINE_PATH` или путь по умолчанию).

---

## Что не трогать в `total_win.export.json`

- `packTarget: "perskeleton"` — атлас по одному скелету (`skeleton.atlas`, `skeleton.png`).
- `packSource: "attachments"` — паковка из аттачментов проекта.
- `packAtlas` — можно править размеры, форматы и т.п., но `packTarget` и `packSource` оставить.
