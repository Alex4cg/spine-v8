# Шрифты в проекте

## Используемые шрифты

### Montserrat Extra Bold (font-weight: 800)
- **Использование:** Золотой текст выигрышей (`MiniWinText.js`)
- **Загрузка:** Google Fonts через `<link>` в `index.html`
- **Fallback:** `"Montserrat", "Arial Black", sans-serif`
- **Статус:** ✅ Работает стабильно

### Aclonica Regular (font-weight: 400)
- **Использование:** Текст на монетках (`AclonicaText.js`)
- **Загрузка:** Google Fonts через `<link>` в `index.html`
- **Fallback:** `"Aclonica", sans-serif`
- **Статус:** ✅ Исправлено - работает стабильно

## Проблема с загрузкой Aclonica

**Проблема:** Шрифт Aclonica не всегда корректно отображался в Canvas, особенно при быстрой загрузке страницы.

**Причина:** 
- `document.fonts.ready` может сработать до реальной загрузки шрифта
- Canvas может не "увидеть" шрифт даже после `document.fonts.ready`
- Отсутствие fallback приводило к использованию системного шрифта

**Решение:**
1. Явная загрузка через `document.fonts.load('400 45px "Aclonica"')`
2. Проверка загрузки в цикле с таймаутом (до 5 секунд)
3. Активация шрифта через временный DOM элемент
4. Два кадра ожидания для активации шрифта в Canvas
5. Добавлен fallback `sans-serif` для надежности

## Реализация загрузки

### MiniWinText (работает без проблем)
```javascript
ctx.font = `800 ${fontSize}px "Montserrat", "Arial Black", sans-serif`;
// Fallback обеспечивает стабильную работу
```

### AclonicaText (исправлено)
```javascript
// В loadFont():
await document.fonts.load('400 45px "Aclonica"');
await document.fonts.ready;

// Проверка в цикле с таймаутом
while (attempts < maxAttempts) {
  const isLoaded = document.fonts.check('400 45px "Aclonica"');
  if (isLoaded) {
    // Активация через DOM элемент
    // Два кадра ожидания
    return;
  }
  await new Promise(resolve => setTimeout(resolve, 100));
}

// В createText():
ctx.font = `400 ${fontSize}px "Aclonica", sans-serif`; // С fallback
```

## Рекомендации

1. **Всегда используйте fallback** в Canvas font declarations
2. **Явно загружайте шрифты** через `document.fonts.load()` перед использованием
3. **Проверяйте загрузку** через `document.fonts.check()` в цикле
4. **Активируйте шрифт** через временный DOM элемент перед использованием в Canvas
5. **Ждите несколько кадров** после активации для надежности

## См. также

- [MINI_WIN_TEXT.md](./MINI_WIN_TEXT.md) - Документация по MiniWinText
- [COIN_MANAGER.md](./COIN_MANAGER.md) - Использование AclonicaText в монетках

