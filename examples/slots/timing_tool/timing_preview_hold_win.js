/**
 * Hold & Win Preview — отдельный модуль превью для режима Hold & Win.
 * Сетка ячеек N×M; у каждой ячейки фрейм-маска в 1 прямоугольник (высота = step).
 * Задержки: слева направо, сверху вниз (reelIndex = row×cols+col).
 * API совместим с createTimingPreview для подмены в bounce_canvas.
 */
(function (global) {
  const CUBE_SIZE = 10;
  const CUBE_COUNT = 5;
  const PHASE_WAIT = 500;
  const PHASE_WAIT_END = 500;
  const MAX_CYCLES = 2;

  function createHoldWinPreview(api) {
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
    const getReelStartDelayMsFromApi = typeof api.getReelStartDelayMs === 'function' ? api.getReelStartDelayMs : null;
    const getReelWidthPxFromApi = typeof api.getReelWidthPx === 'function' ? api.getReelWidthPx : null;
    const getPreviewMode = typeof api.getPreviewMode === 'function' ? api.getPreviewMode : function () { return 'holdAndWin'; };
    const getPreviewSymbolStyle = typeof api.getPreviewSymbolStyle === 'function' ? api.getPreviewSymbolStyle : function () { return 'rectangles'; };
    const getTextureByIndex = typeof api.getTextureByIndex === 'function' ? api.getTextureByIndex : function () { return null; };

    function getCellWidth() {
      if (getReelWidthPxFromApi) {
        const v = getReelWidthPxFromApi();
        return typeof v === 'number' && v >= 12 && v <= 250 ? v : 28;
      }
      return 28;
    }

    const cubes = [];
    let cubesSpawned = false;
    let animationStartTime = 0;
    let animationRunning = true;
    let reelStartDelayMs = 0;

    function getColumnRunDuration(reelIndex) {
      return PHASE_WAIT + getStartDuration() + getLinearDuration(reelIndex) + getEndDuration() + PHASE_WAIT_END;
    }

    function getCubeProgressNoWrap(elapsed, reelIndex) {
      const startMs = getStartDuration();
      const linearMs = getLinearDuration(reelIndex);
      const endMs = getEndDuration();
      const runDuration = PHASE_WAIT + startMs + linearMs + endMs + PHASE_WAIT_END;
      const startVal = startKeyframes.length > 0 ? startKeyframes[0].value : 0;

      if (elapsed < 0) return startVal;
      if (elapsed >= runDuration) {
        const startTMax = startKeyframes.length > 0 ? startKeyframes[startKeyframes.length - 1].t : 1;
        const startEndVal = evaluateStartBezier(startTMax);
        const endTMin = endKeyframes.length > 0 ? endKeyframes[0].t : 0;
        const endTMax = endKeyframes.length > 0 ? endKeyframes[endKeyframes.length - 1].t : 1;
        return startEndVal + getLinearDistance(reelIndex) + (evaluateEndBezier(endTMax) - evaluateEndBezier(endTMin));
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
      const linearPx = getLinearDistance(reelIndex);

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

    function getCubeProgress(elapsed, reelIndex) {
      const startMs = getStartDuration();
      const linearMs = getLinearDuration(reelIndex);
      const endMs = getEndDuration();
      const cycleDuration = PHASE_WAIT + startMs + linearMs + endMs + PHASE_WAIT_END;
      const cycleTime = elapsed % cycleDuration;
      return getCubeProgressNoWrap(cycleTime, reelIndex);
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

    function getCycleProgressDelta(reelIndex) {
      const startTMin = startKeyframes.length > 0 ? startKeyframes[0].t : 0;
      const startTMax = startKeyframes.length > 0 ? startKeyframes[startKeyframes.length - 1].t : 1;
      const endTMin = endKeyframes.length > 0 ? endKeyframes[0].t : 0;
      const endTMax = endKeyframes.length > 0 ? endKeyframes[endKeyframes.length - 1].t : 1;
      const startVal = evaluateStartBezier(startTMin);
      const startEndVal = evaluateStartBezier(startTMax);
      const afterLinear = startEndVal + getLinearDistance(reelIndex);
      const endDelta = evaluateEndBezier(endTMax) - evaluateEndBezier(endTMin);
      return afterLinear + endDelta - startVal;
    }

    function getReelStartDelayPerReelMs() {
      if (getReelStartDelayMsFromApi) {
        const v = getReelStartDelayMsFromApi();
        return typeof v === 'number' && v >= 0 ? v : 0;
      }
      return reelStartDelayMs;
    }

    /** Hold & Win: total reels = cols × rows; last reel index = totalReels - 1. */
    function getGlobalSpinDuration() {
      const totalReels = playfieldCols * playfieldRows;
      if (totalReels <= 0) return PHASE_WAIT + getStartDuration() + getLinearDuration(0) + getEndDuration() + PHASE_WAIT_END;
      const lastReelIndex = totalReels - 1;
      const delayPerReelMs = getReelStartDelayPerReelMs();
      return lastReelIndex * delayPerReelMs + getColumnRunDuration(lastReelIndex);
    }

    function updateCubes(now) {
      if (!cubesSpawned) return;

      const elapsed = now - animationStartTime;
      const step = getSymbolStep();
      const cycleDuration = step > 0
        ? getGlobalSpinDuration()
        : (PHASE_WAIT + getStartDuration() + getLinearDuration(0) + getEndDuration() + PHASE_WAIT_END);
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

    /** Hold & Win: grid of cells; each cell = one reel with frame mask height = step. */
    function getHoldWinGridDimensions(step) {
      if (step <= 0) {
        return { gridWidth: 0, gridHeight: 0, cellW: getCellWidth(), cellH: 0 };
      }
      const cellW = getCellWidth();
      const cellH = step;
      const gridWidth = playfieldCols * cellW;
      const gridHeight = playfieldRows * cellH;
      return { gridWidth, gridHeight, cellW, cellH };
    }

    /** Draw one reel strip clipped to cell rect (frame mask = 1 rectangle). */
    function drawHoldWinCell(baseX, baseY, reelIndex, elapsed, step) {
      const delayPerReelMs = getReelStartDelayPerReelMs();
      const globalSpinDuration = getGlobalSpinDuration();
      const spinIndex = Math.floor(elapsed / globalSpinDuration);
      const spinTime = elapsed % globalSpinDuration;
      const effectiveElapsed = spinTime - reelIndex * delayPerReelMs;
      const runProgress = getCubeProgressNoWrap(effectiveElapsed, reelIndex);
      let progress = spinIndex * getCycleProgressDelta(reelIndex) + runProgress;
      if (!Number.isFinite(progress)) progress = 0;

      const poolSize = 4;
      const base = Math.floor(progress / step);
      const kMin = base - 2;
      const cellW = getCellWidth();
      const cellH = step;

      ctx.save();
      ctx.beginPath();
      ctx.rect(baseX, baseY, cellW, cellH);
      ctx.clip();

      for (let i = 0; i < poolSize; i++) {
        const k = kMin + i;
        const y = baseY - step + (progress - k * step);
        const useTextures = getPreviewSymbolStyle() === 'textures';
        const img = useTextures ? getTextureByIndex(k) : null;
        if (img) {
          const cx = baseX + cellW / 2;
          const cy = y + step / 2;
          const drawW = img.naturalWidth;
          const drawH = img.naturalHeight;
          ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
        } else {
          const hue = (k % 16) * 24;
          ctx.fillStyle = 'hsl(' + hue + ', 55%, 50%)';
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.lineWidth = 1;
          ctx.fillRect(baseX, y, cellW, step);
          ctx.strokeRect(baseX, y, cellW, step);
        }
      }
      ctx.restore();
    }

    function drawHoldWinGrid(baseX, baseY, elapsed, step) {
      const { gridWidth, gridHeight, cellW, cellH } = getHoldWinGridDimensions(step);
      for (let row = 0; row < playfieldRows; row++) {
        for (let col = 0; col < playfieldCols; col++) {
          const reelIndex = row * playfieldCols + col;
          const cellX = baseX + col * cellW;
          const cellY = baseY + row * cellH;
          drawHoldWinCell(cellX, cellY, reelIndex, elapsed, step);
        }
      }
    }

    function drawCubes() {
      if (getPreviewMode() !== 'holdAndWin') return;
      const step = getSymbolStep();
      let boxW, boxH;
      if (step > 0) {
        const { gridWidth, gridHeight } = getHoldWinGridDimensions(step);
        boxW = gridWidth + 20;
        boxH = 38 + gridHeight;
      } else {
        boxW = CUBE_COUNT * (CUBE_SIZE + 4) + 20;
        boxH = 120;
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
        const delayPerReelMs = getReelStartDelayPerReelMs();
        const gridStr = step > 0 ? '  ' + playfieldCols + '×' + playfieldRows + (delayPerReelMs > 0 ? ' d=' + delayPerReelMs + 'ms' : '') : '';
        ctx.fillText('Hold & Win  v=' + Math.round(currentVal) + gridStr, previewX, previewY - 4);

        if (step > 0) {
          const elapsed = performance.now() - animationStartTime;
          drawHoldWinGrid(previewX + 10, baseY, elapsed, step);
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillText('step=0 → задайте Шаг (px)', previewX, previewY + 10);
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
        const { gridWidth, gridHeight } = getHoldWinGridDimensions(step);
        return {
          w: gridWidth + 20,
          h: 38 + gridHeight
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
      if (getPreviewMode() !== 'holdAndWin') {
        requestAnimationFrame(animationLoop);
        return;
      }
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

  global.createHoldWinPreview = createHoldWinPreview;
})(typeof window !== 'undefined' ? window : this);
