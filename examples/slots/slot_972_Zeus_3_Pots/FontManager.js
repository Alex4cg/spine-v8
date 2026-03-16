/**
 * FontManager — упрощённый менеджер шрифтов для Zeus.
 * Рендерит текст на Canvas → PIXI.Texture → PIXI.Sprite.
 */

const RENDER_SCALE = 2;

export class FontManager {
  constructor() {
    this.cache = new Map();
    this.styles = {
      coinValue: {
        fontFamily: 'GAMERIA',
        fontWeight: 400,
        fontSize: 120,
        color: '#FFD700',
        borderColor: '#7A3800',
        borderWidth: 12,
        padding: 8,
      },
    };
  }

  async loadFonts() {
    this.clearCache();
    const spec = '400 60px "GAMERIA"';
    try {
      if (document.fonts && document.fonts.load) {
        await document.fonts.load(spec);
        await document.fonts.ready;
        const activator = document.createElement('div');
        activator.style.fontFamily = '"GAMERIA"';
        activator.style.fontSize = '60px';
        activator.style.position = 'absolute';
        activator.style.visibility = 'hidden';
        activator.style.left = '-9999px';
        activator.textContent = '0';
        document.body.appendChild(activator);
        await new Promise((r) => requestAnimationFrame(r));
        document.body.removeChild(activator);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Zeus FontManager: font load error', e);
    }
  }

  createText(styleName, text, overrides = {}) {
    const preset = this.styles[styleName];
    if (!preset || typeof PIXI === 'undefined') {
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
      letterSpacing,
      textShadow,
    } = opts;

    const scaledBorderWidth = (borderWidth || 0) * scale;
    const lh = (overrides.lineHeight !== undefined
      ? overrides.lineHeight
      : (lineHeight ?? baseFontSize) * scale);

    const shadowKey = textShadow ? `${textShadow.offsetY}_${textShadow.color}` : '';
    const cacheKey = `zeus_fm_${styleName}_${text}_${fontSize}_${color}_${borderColor || ''}_${scaledBorderWidth}_${letterSpacing || ''}_${shadowKey}_x${RENDER_SCALE}`;
    if (this.cache.has(cacheKey)) {
      return new PIXI.Sprite(this.cache.get(cacheKey));
    }

    const canvasHi = document.createElement('canvas');
    const ctx = canvasHi.getContext('2d');
    const fontStr = `${fontWeight} ${fontSize}px "${fontFamily}", sans-serif`;
    ctx.font = fontStr;
    if (letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = letterSpacing;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = lh;
    const maxBorder = scaledBorderWidth;
    const extra = maxBorder * 2 + padding * 2;
    const baseW = textWidth + extra;
    const baseH = textHeight + extra;
    canvasHi.width = Math.ceil(baseW * RENDER_SCALE);
    canvasHi.height = Math.ceil(baseH * RENDER_SCALE);
    ctx.scale(RENDER_SCALE, RENDER_SCALE);
    const centerX = baseW / 2;
    const centerY = baseH / 2;

    ctx.font = fontStr;
    if (letterSpacing && 'letterSpacing' in ctx) ctx.letterSpacing = letterSpacing;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (textShadow) {
      ctx.shadowOffsetX = textShadow.offsetX ?? 0;
      ctx.shadowOffsetY = textShadow.offsetY ?? 0;
      ctx.shadowBlur = textShadow.blur ?? 0;
      ctx.shadowColor = textShadow.color ?? 'transparent';
    }

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

    if (textShadow) {
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
    }

    const canvasOut = document.createElement('canvas');
    canvasOut.width = Math.ceil(baseW);
    canvasOut.height = Math.ceil(baseH);
    const ctxOut = canvasOut.getContext('2d');
    ctxOut.imageSmoothingEnabled = true;
    ctxOut.imageSmoothingQuality = 'high';
    ctxOut.drawImage(
      canvasHi,
      0,
      0,
      canvasHi.width,
      canvasHi.height,
      0,
      0,
      canvasOut.width,
      canvasOut.height,
    );

    const texture = PIXI.Texture.from(canvasOut);
    this.cache.set(cacheKey, texture);
    return new PIXI.Sprite(texture);
  }

  clearCache() {
    this.cache.forEach((t) => {
      if (t && !t.baseTexture?.destroyed) t.destroy();
    });
    this.cache.clear();
  }
}

export const fontManager = new FontManager();

