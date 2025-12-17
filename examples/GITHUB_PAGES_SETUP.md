# Инструкция по настройке GitHub Pages

## ✅ Шаги для публикации игры

### 1. Закоммить изменения

```bash
git add .
git commit -m "Add GitHub Pages support and bonus round features"
git push origin 2025-12-16-trij
```

### 2. Настроить GitHub Pages

1. Перейдите на GitHub: https://github.com/pixijs/spine-v8
2. Откройте **Settings** → **Pages**
3. В разделе **Source** выберите:
   - **Branch**: `2025-12-16-trij` (или `main`/`master` если хотите использовать основную ветку)
   - **Folder**: `/ (root)`
4. Нажмите **Save**

### 3. Дождаться публикации

GitHub Pages обычно публикует сайт в течение 1-2 минут. Вы увидите сообщение:
> "Your site is live at https://pixijs.github.io/spine-v8/..."

### 4. Открыть игру

После публикации игра будет доступна по адресу:

**https://pixijs.github.io/spine-v8/examples/slots/slot_1/index.html**

## 🔗 Прямая ссылка для шаринга

После настройки GitHub Pages, вы можете поделиться этой ссылкой:

```
https://pixijs.github.io/spine-v8/examples/slots/slot_1/index.html
```

## 📝 Примечания

- Файл `.nojekyll` уже создан - он нужен для правильной работы GitHub Pages
- Все пути к библиотекам используют относительные пути и должны работать корректно
- Если нужно изменить ветку для GitHub Pages, просто обновите настройки в Settings → Pages

## 🐛 Если что-то не работает

1. Проверьте, что все файлы закоммичены и запушены
2. Убедитесь, что в Settings → Pages выбрана правильная ветка
3. Подождите несколько минут - GitHub Pages может обновляться с задержкой
4. Проверьте консоль браузера на наличие ошибок загрузки ресурсов

