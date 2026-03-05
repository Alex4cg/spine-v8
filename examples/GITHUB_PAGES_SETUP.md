# Инструкция по настройке GitHub Pages

## Шаги для публикации игры

### 1. Закоммитить и запушить изменения

Коммит с игрой «8 марта» уже создан локально. Чтобы отправить его в **Secret-santa-xoxoxo/spine-v8**:

1. Закройте все программы, использующие этот репозиторий (IDE, другой терминал), чтобы не было блокировки `.git/config`.
2. Добавьте remote и выполните push (в корне репозитория):
   ```bash
   git remote add secret-santa https://github.com/Secret-santa-xoxoxo/spine-v8.git
   git push secret-santa 2025-12-16-trij:main
   ```
   Если ветка в вашем GitHub уже называется `main`, после push включите Pages из ветки **main**. Если хотите публиковать из ветки `2025-12-16-trij`, в Settings → Pages выберите эту ветку вместо main.

### 2. Настроить GitHub Pages

1. Перейдите на GitHub: **https://github.com/Secret-santa-xoxoxo/spine-v8**
2. Откройте **Settings** → **Pages** (в левом меню)
3. В разделе **Build and deployment** → **Source** выберите **Deploy from a branch**
4. **Branch**: выберите **main** (или нужную ветку) и папку **/ (root)**
5. Нажмите **Save**

### 3. Дождаться публикации

GitHub Pages обычно публикует сайт в течение 1–2 минут. В разделе Pages появится сообщение:
> "Your site is live at https://secret-santa-xoxoxo.github.io/spine-v8/"

### 4. Открыть игру «8 марта»

После публикации игра будет доступна по адресу:

**https://secret-santa-xoxoxo.github.io/spine-v8/examples/slots/8_march/index.html**

## Прямая ссылка для шаринга

Этой ссылкой можно делиться с коллегами (имя пользователя в URL в нижнем регистре):

```
https://secret-santa-xoxoxo.github.io/spine-v8/examples/slots/8_march/index.html
```

## Примечания

- Файл `.nojekyll` в корне репозитория и в `examples/` нужен для корректной работы GitHub Pages (папки с подчёркиванием не скрываются Jekyll)
- Все пути к ресурсам в игре относительные и работают при публикации из корня репозитория
- Чтобы сменить ветку для GitHub Pages, измените настройки в Settings → Pages

## Если что-то не работает

1. Проверьте, что все файлы закоммичены и запушены
2. Убедитесь, что в Settings → Pages выбрана правильная ветка и папка **/ (root)**
3. Подождите несколько минут — GitHub Pages может обновляться с задержкой
4. Проверьте консоль браузера (F12) на ошибки загрузки ресурсов
