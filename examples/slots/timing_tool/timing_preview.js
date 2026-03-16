/**
 * Timing Preview — нода превью кубиков для bounce_canvas.
 * Принимает API от основного скрипта и рисует анимацию Start → Linear → End.
 */
(function (global) {
  const PREVIEW_HEIGHT = 800;
  const CUBE_SIZE = 10;
  const CUBE_COUNT = 5;
  const PHASE_WAIT = 500;
  const PHASE_WAIT_END = 500;
  const MAX_CYCLES = 2;

  function createTimingPreview(api) {
    let previewX = 50;
    let previewY = 200;
    let playfieldCols = 3;
    let playfieldRows = 3;
    const ctx = api.ctx;
    const draw = api.draw;
    const startKeyframes = api.startKeyframes;
    const endKeyframes = api.endKeyframes;
    const evaluateStartBezier = api.evaluateStartBezier;
    const evaluateEndBezier = api.evaluateEndBezier;
    const getStartDuration = api.getStartDuration;
    const getLinearDuration = api.getLinearDuration;
    const getEndDuration = api.getEndDuration;
    const getLinearDistance = api.getLinearDistance;
    const getSymbolStep = typeof api.getSymbolStep === 'function' ? api.getSymbolStep : function () { return 0; };
    /** При каждой отрисовке читаем задержку из API (UI), чтобы кривые/пересоздание не перезаписывали. */
    const getReelStartDelayMsFromApi = typeof api.getReelStartDelayMs === 'function' ? api.getReelStartDelayMs : null;
    const getReelWidthPxFromApi = typeof api.getReelWidthPx === 'function' ? api.getReelWidthPx : null;
    const getPreviewSymbolStyle = typeof api.getPreviewSymbolStyle === 'function' ? api.getPreviewSymbolStyle : function () { return 'rectangles'; };
    const getTextureByIndex = typeof api.getTextureByIndex === 'function' ? api.getTextureByIndex : function () { return null; };
    const cubes = [];
    let cubesSpawned = false;
    let animationStartTime = 0;
    let animationRunning = true;
    /** Локальный кэш задержки, если API не передаёт геттер. */
    let reelStartDelayMs = 0;

    /** Длительность одного прогона колонки col от старта до конца (без задержки). */
    function getColumnRunDuration(col) {
      return PHASE_WAIT + getStartDuration() + getLinearDuration(col) + getEndDuration() + PHASE_WAIT_END;
    }

    /** Позиция по времени от старта колонки, без цикла (для одного спина). Если elapsed < 0 — ещё не старт; если elapsed >= runDuration — финал. */
    function getCubeProgressNoWrap(elapsed, col) {
      const startMs = getStartDuration();
      const linearMs = getLinearDuration(col);
      const endMs = getEndDuration();
      const runDuration = PHASE_WAIT + startMs + linearMs + endMs + PHASE_WAIT_END;
      const startVal = startKeyframes.length > 0 ? startKeyframes[0].value : 0;

      if (elapsed < 0) return startVal;
      if (elapsed >= runDuration) {
        const startTMax = startKeyframes.length > 0 ? startKeyframes[startKeyframes.length - 1].t : 1;
        const startEndVal = evaluateStartBezier(startTMax);
        const endTMin = endKeyframes.length > 0 ? endKeyframes[0].t : 0;
        const endTMax = endKeyframes.length > 0 ? endKeyframes[endKeyframes.length - 1].t : 1;
        return startEndVal + getLinearDistance(col) + (evaluateEndBezier(endTMax) - evaluateEndBezier(endTMin));
      }

      const animTime = elapsed - PHASE_WAIT;
      const startTMin = startKeyframes.length > 0 ? startKeyframes[0].t : 0;
      const startTMax = startKeyframes.length > 0 ? startKeyframes[startKeyframes.length - 1].t : 1;

      if (animTime < 0) return startVal;
      if (animTime < startMs) {
        if (startMs <= 0) return startVal;
        const tNorm = animTime / startMs;
        const t = startTMin + tNorm * (startTMax - startTMin);
        return evaluateStartBezier(t);
      }

      const startEndValue = evaluateStartBezier(startTMax);
      const linearTime = animTime - startMs;
      const linearPx = getLinearDistance(col);

      if (linearTime < linearMs && linearMs > 0) {
        const progress = linearTime / linearMs;
        return startEndValue + linearPx * progress;
      }

      const afterLinear = startEndValue + linearPx;
      const endTime = animTime - startMs - linearMs;
      const endMs_ = getEndDuration();
      const endTMin = endKeyframes.length > 0 ? endKeyframes[0].t : 0;
      const endTMax = endKeyframes.length > 0 ? endKeyframes[endKeyframes.length - 1].t : 1;

      if (endTime < endMs_ && endMs_ > 0) {
        const tNorm = endTime / endMs_;
        const t = endTMin + tNorm * (endTMax - endTMin);
        const endPickupValue = evaluateEndBezier(endTMin);
        return afterLinear + (evaluateEndBezier(t) - endPickupValue);
      }

      return afterLinear + (evaluateEndBezier(endTMax) - evaluateEndBezier(endTMin));
    }

    /** col — опциональный индекс колонки (для «доп длина»: каждая колонка на N шагов дольше). С modulo — для режима кубиков (несколько циклов). */
    function getCubeProgress(elapsed, col) {
      const startMs = getStartDuration();
      const linearMs = getLinearDuration(col);
      const endMs = getEndDuration();
      const cycleDuration = PHASE_WAIT + startMs + linearMs + endMs + PHASE_WAIT_END;
      const cycleTime = elapsed % cycleDuration;
      return getCubeProgressNoWrap(cycleTime, col);
    }

    function spawnAllCubes() {
      cubes.length = 0;
      for (let i = 0; i < CUBE_COUNT; i++) {
        cubes.push({
          index: i,
          baseX: previewX + i * (CUBE_SIZE + 4),
          color: 'hsl(' + (i * 72) + ', 70%, 60%)',
          progress: 0
        });
      }
      animationStartTime = performance.now();
      cubesSpawned = true;
    }

    /** col — опциональный индекс колонки (для «доп длина»). */
    function getCycleProgressDelta(col) {
      const startTMin = startKeyframes.length > 0 ? startKeyframes[0].t : 0;
      const startTMax = startKeyframes.length > 0 ? startKeyframes[startKeyframes.length - 1].t : 1;
      const endTMin = endKeyframes.length > 0 ? endKeyframes[0].t : 0;
      const endTMax = endKeyframes.length > 0 ? endKeyframes[endKeyframes.length - 1].t : 1;
      const startVal = evaluateStartBezier(startTMin);
      const startEndVal = evaluateStartBezier(startTMax);
      const afterLinear = startEndVal + getLinearDistance(col);
      const endDelta = evaluateEndBezier(endTMax) - evaluateEndBezier(endTMin);
      return afterLinear + endDelta - startVal;
    }

    function updateCubes(now) {
      if (!cubesSpawned) return;

      const elapsed = now - animationStartTime;
      const step = getSymbolStep();
      const cycleDuration = step > 0
        ? getGlobalSpinDuration()
        : (PHASE_WAIT + getStartDuration() + getLinearDuration() + getEndDuration() + PHASE_WAIT_END);
      const currentCycle = Math.floor(elapsed / cycleDuration);

      if (step <= 0 && currentCycle >= MAX_CYCLES) {
        cubesSpawned = false;
        setTimeout(spawnAllCubes, 500);
        return;
      }

      let progress = getCubeProgress(elapsed, 0);
      if (step > 0) {
        progress += currentCycle * getCycleProgressDelta(0);
      }
      if (!Number.isFinite(progress)) progress = 0;
      for (let i = 0; i < cubes.length; i++) {
        cubes[i].progress = progress;
        cubes[i].cycle = currentCycle;
      }
    }

    function getReelWidth() {
      if (getReelWidthPxFromApi) {
        const v = getReelWidthPxFromApi();
        return typeof v === 'number' && v >= 12 && v <= 250 ? v : 28;
      }
      return 28;
    }

    function getPlayfieldDimensions(step) {
      const rw = getReelWidth();
      const playfieldHeight = playfieldRows * step;
      const playfieldWidth = playfieldCols * rw;
      return { playfieldHeight, playfieldWidth };
    }

    /** Возвращает задержку между колонками (мс), читается из API при каждой отрисовке. */
    function getReelStartDelayPerColumnMs() {
      if (getReelStartDelayMsFromApi) {
        const v = getReelStartDelayMsFromApi();
        return typeof v === 'number' && v >= 0 ? v : 0;
      }
      return reelStartDelayMs;
    }

    /** Один спин = одно общее событие: от старта первой колонки до полного завершения последней. */
    function getGlobalSpinDuration() {
      const delayPerColMs = getReelStartDelayPerColumnMs();
      const lastCol = playfieldCols - 1;
      return lastCol * delayPerColMs + getColumnRunDuration(lastCol);
    }

    function drawReelPlayfield(baseX, baseY, elapsed, step) {
      const { playfieldHeight, playfieldWidth } = getPlayfieldDimensions(step);
      const poolSize = playfieldRows + 2;
      const delayPerColMs = getReelStartDelayPerColumnMs();
      const globalSpinDuration = getGlobalSpinDuration();
      const spinIndex = Math.floor(elapsed / globalSpinDuration);
      const spinTime = elapsed % globalSpinDuration;

      ctx.save();
      ctx.beginPath();
      ctx.rect(baseX, baseY, playfieldWidth, playfieldHeight);
      ctx.clip();

      for (let col = 0; col < playfieldCols; col++) {
        const effectiveElapsed = spinTime - col * delayPerColMs;
        const runProgress = getCubeProgressNoWrap(effectiveElapsed, col);
        let progress = spinIndex * getCycleProgressDelta(col) + runProgress;
        if (!Number.isFinite(progress)) progress = 0;

        const base = Math.floor(progress / step);
        const kMin = base - playfieldRows + 1;
        const rw = getReelWidth();
        const colX = baseX + col * rw;
        for (let i = 0; i < poolSize; i++) {
          const k = kMin + i;
          const y = baseY + step + (progress - k * step);
          const useTextures = getPreviewSymbolStyle() === 'textures';
          const img = useTextures ? getTextureByIndex(k) : null;
          if (img) {
            const cx = colX + rw / 2;
            const cy = y + step / 2;
            const drawW = img.naturalWidth;
            const drawH = img.naturalHeight;
            ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
          } else {
            const hue = (k % 16) * 24;
            ctx.fillStyle = 'hsl(' + hue + ', 55%, 50%)';
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1;
            ctx.fillRect(colX, y, rw, step);
            ctx.strokeRect(colX, y, rw, step);
          }
        }
      }
      ctx.restore();
    }

    function drawCubes() {
      const step = getSymbolStep();
      let boxW, boxH;
      if (step > 0) {
        const { playfieldHeight, playfieldWidth } = getPlayfieldDimensions(step);
        boxW = playfieldWidth + 20;
        boxH = 38 + playfieldHeight;
      } else {
        boxW = CUBE_COUNT * (CUBE_SIZE + 4) + 20;
        boxH = 300;
      }

      ctx.fillStyle = 'rgba(30, 30, 35, 0.95)';
      ctx.fillRect(previewX - 10, previewY - 16, boxW, boxH);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.strokeRect(previewX - 10, previewY - 16, boxW, boxH);

      const baseY = previewY + 22;
      ctx.fillStyle = '#888';
      ctx.font = '9px sans-serif';
      if (cubesSpawned && cubes.length > 0) {
        const currentVal = cubes[0].progress;
        const delayPerColMs = getReelStartDelayPerColumnMs();
        const reelsStr = step > 0 ? '  step=' + step + ' ' + playfieldCols + '×' + playfieldRows + (delayPerColMs > 0 ? ' d=' + delayPerColMs + 'ms' : '') : '';
        ctx.fillText('Preview  v=' + Math.round(currentVal) + reelsStr, previewX, previewY - 4);

        if (step > 0) {
          const elapsed = performance.now() - animationStartTime;
          drawReelPlayfield(previewX + 10, baseY, elapsed, step);
        } else {
          for (let i = 0; i < cubes.length; i++) {
            const c = cubes[i];
            const y = baseY + c.progress;
            ctx.fillStyle = c.color;
            ctx.globalAlpha = 0.9;
            ctx.fillRect(c.baseX, y, CUBE_SIZE, CUBE_SIZE);
          }
          ctx.globalAlpha = 1;
        }
      } else {
        ctx.fillText('restarting...', previewX, previewY - 4);
      }
    }

    function getPreviewBoxSize() {
      const step = getSymbolStep();
      if (step > 0) {
        const { playfieldHeight, playfieldWidth } = getPlayfieldDimensions(step);
        return {
          w: playfieldWidth + 20,
          h: 38 + playfieldHeight
        };
      }
      return { w: CUBE_COUNT * (CUBE_SIZE + 4) + 20, h: 120 };
    }

    function getPreviewBounds() {
      const { w, h } = getPreviewBoxSize();
      return { x: previewX - 10, y: previewY - 16, w: w, h: h };
    }

    function getPosition() {
      return { x: previewX, y: previewY };
    }

    function setPosition(x, y) {
      previewX = x;
      previewY = y;
    }

    function setPlayfieldSize(cols, rows) {
      if (typeof cols === 'number' && cols >= 1 && cols <= 10) playfieldCols = Math.floor(cols);
      if (typeof rows === 'number' && rows >= 1 && rows <= 10) playfieldRows = Math.floor(rows);
    }

    function setReelStartDelayMs(ms) {
      reelStartDelayMs = typeof ms === 'number' && ms >= 0 ? ms : 0;
    }

    function getReelStartDelayMs() {
      return reelStartDelayMs;
    }

    function animationLoop(now) {
      if (!animationRunning) return;
      updateCubes(now);
      draw();
      drawCubes();
      requestAnimationFrame(animationLoop);
    }

    return {
      start: function () {
        spawnAllCubes();
        requestAnimationFrame(animationLoop);
      },
      drawCubes: drawCubes,
      getPreviewBounds: getPreviewBounds,
      getPosition: getPosition,
      setPosition: setPosition,
      setPlayfieldSize: setPlayfieldSize,
      setReelStartDelayMs: setReelStartDelayMs,
      getReelStartDelayMs: getReelStartDelayMs
    };
  }

  global.createTimingPreview = createTimingPreview;
})(typeof window !== 'undefined' ? window : this);
