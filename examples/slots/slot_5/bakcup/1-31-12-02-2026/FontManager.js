/**
 * FontManager — централизованный менеджер стилизованных шрифтов из Figma.
 * Canvas → Texture → Sprite (по образцу AclonicaText).
 * Обводки масштабируются пропорционально fontSize (при override fontSize обводка сохраняет соотношение).
 * Рисуем в 2x, затем уменьшаем в текстуру 1x — для чёткого текста без влияния на scale в игре.
 */
import { CONFIG } from './config.js';

const RENDER_SCALE = 2;

export class FontManager {
  constructor() {
    this.cache = new Map();
    this.styles = (CONFIG.FONTS?.STYLES ? { ...CONFIG.FONTS.STYLES } : {});
  }

  registerStyle(name, styleObj) {
    this.styles[name] = { ...this.styles[name], ...styleObj };
  }

  async loadFonts() {
    this.clearCache();
    const fontSpecs = [
      '400 56px "The Bomb Sound"',
      '400 65px "GAMERIA"',
      '400 37px "GAMERIA"'
    ];
    try {
      for (const spec of fontSpecs) {
        await document.fonts.load(spec);
      }
      await document.fonts.ready;
    } catch (e) {
      console.warn('FontManager: Ошибка загрузки шрифтов:', e);
    }
    const maxAttempts = 50;
    let attempts = 0;
    while (attempts < maxAttempts) {
      const ok = document.fonts.check('400 56px "The Bomb Sound"') && document.fonts.check('400 65px "GAMERIA"');
      if (ok) {
        const activator = document.createElement('div');
        activator.style.fontFamily = '"The Bomb Sound", "GAMERIA"';
        activator.style.fontSize = '56px';
        activator.style.position = 'absolute';
        activator.style.visibility = 'hidden';
        activator.style.left = '-9999px';
        activator.textContent = '0';
        document.body.appendChild(activator);
        await new Promise(r => requestAnimationFrame(r));
        document.body.removeChild(activator);
        console.log('FontManager: Шрифты загружены');
        return;
      }
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    console.warn('FontManager: Шрифты не загрузились за отведённое время');
  }

  /**
   * Создаёт PIXI.Sprite с текстом по имени стиля.
   * Толщина обводок масштабируется пропорционально fontSize (при override fontSize).
   */
  createText(styleName, text, overrides = {}) {
    const preset = this.styles[styleName];
    if (!preset) {
      console.warn(`FontManager: Стиль "${styleName}" не найден`);
      return new PIXI.Sprite(PIXI.Texture.EMPTY);
    }
    const opts = { ...preset, ...overrides };
    const baseFontSize = preset.fontSize;
    const fontSize = opts.fontSize ?? baseFontSize;
    const scale = fontSize / baseFontSize;

    const {
      fontFamily,
      fontWeight = 400,
      color,
      borderColor,
      borderWidth = 0,
      padding = 0,
      lineHeight,
      useCache = true,
      twoLayer,
      layer1Color,
      layer1BorderColor,
      layer1BorderWidth = 0,
      layer2Color,
      layer2BorderColor,
      layer2BorderWidth,
      layerOffsetY = 4
    } = opts;

    const scaledBorderWidth = (borderWidth || 0) * scale;
    const scaledLayer1BorderWidth = (layer1BorderWidth || 0) * scale;
    const scaledLayer2BorderWidth = (layer2BorderWidth || 0) * scale;
    const lh = (overrides.lineHeight !== undefined ? overrides.lineHeight : (lineHeight ?? baseFontSize) * scale);

    const cacheKey = `fm_${styleName}_${text}_${fontSize}_${color}_${borderColor || ''}_${scaledBorderWidth}_${twoLayer || ''}_${layer1BorderColor || ''}_${scaledLayer1BorderWidth}_x${RENDER_SCALE}`;
    if (useCache && this.cache.has(cacheKey)) {
      return new PIXI.Sprite(this.cache.get(cacheKey));
    }

    const canvasHi = document.createElement('canvas');
    const ctx = canvasHi.getContext('2d');
    const fontStr = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
    ctx.font = fontStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = lh;
    const maxBorder = Math.max(scaledBorderWidth, scaledLayer2BorderWidth, (twoLayer ? scaledLayer1BorderWidth : 0));
    const extra = maxBorder * 2 + padding * 2 + (twoLayer ? Math.abs(layerOffsetY) : 0);
    const baseW = textWidth + extra;
    const baseH = textHeight + extra;
    canvasHi.width = Math.ceil(baseW * RENDER_SCALE);
    canvasHi.height = Math.ceil(baseH * RENDER_SCALE);
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    const centerX = baseW / 2;
    const centerY = baseH / 2;

    ctx.font = fontStr;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (twoLayer) {
      const ly2 = centerY + layerOffsetY;
      ctx.strokeStyle = layer2BorderColor;
      ctx.lineWidth = scaledLayer2BorderWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.miterLimit = 10;
      ctx.strokeText(text, centerX, ly2);
      ctx.fillStyle = layer2Color;
      ctx.fillText(text, centerX, ly2);
      if (scaledLayer1BorderWidth > 0) {
        ctx.strokeStyle = layer1BorderColor || '#000000';
        ctx.lineWidth = scaledLayer1BorderWidth;
        ctx.strokeText(text, centerX, centerY);
      }
      ctx.fillStyle = layer1Color;
      ctx.fillText(text, centerX, centerY);
    } else {
      if (scaledBorderWidth > 0) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = scaledBorderWidth;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.miterLimit = 10;
        ctx.strokeText(text, centerX, centerY);
      }
      ctx.fillStyle = color;
      ctx.fillText(text, centerX, centerY);
    }

    // Уменьшаем 2x→1x в текстуре: FontManager всегда возвращает sprite со scale 1, игра свободно множит scale
    const canvasOut = document.createElement('canvas');
    canvasOut.width = Math.ceil(baseW);
    canvasOut.height = Math.ceil(baseH);
    const ctxOut = canvasOut.getContext('2d');
    ctxOut.imageSmoothingEnabled = true;
    ctxOut.imageSmoothingQuality = 'high';
    ctxOut.drawImage(canvasHi, 0, 0, canvasHi.width, canvasHi.height, 0, 0, canvasOut.width, canvasOut.height);

    const texture = PIXI.Texture.from(canvasOut);
    if (useCache) this.cache.set(cacheKey, texture);
    return new PIXI.Sprite(texture);
  }

  clearCache() {
    this.cache.forEach(t => {
      if (t && !t.baseTexture?.destroyed) t.destroy();
    });
    this.cache.clear();
  }
}

export const fontManager = new FontManager();
