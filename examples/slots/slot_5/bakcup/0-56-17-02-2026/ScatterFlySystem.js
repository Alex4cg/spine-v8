/**
 * Scatter flights from symbols to target chests.
 * Designed to handle many simultaneous flights safely.
 */
export class ScatterFlySystem {
  constructor(app, config = {}) {
    this.app = app;
    this.chests = null;

    this.config = {
      flyDuration: config.flyDuration ?? 0.45,
      baseArcHeight: config.baseArcHeight ?? 80,
      maxDistance: config.maxDistance ?? 500,
      coinScale: config.coinScale ?? 0.66,
      explosionScale: config.explosionScale ?? 0.7,
      chestOffsetX: config.chestOffsetX ?? 30,
      chestOffsetY: config.chestOffsetY ?? 20,
      onFlightComplete: typeof config.onFlightComplete === "function" ? config.onFlightComplete : null,
      getBonusState: typeof config.getBonusState === "function" ? config.getBonusState : null,
    };

    this.activeFlights = [];
    this.activeExplosions = [];
    this.activeParticles = [];
    this.nextFlightId = 1;
    this.destroyQueue = new Set();
    this.activeChests = []; // Массив цветов сундуков, получивших монетки
    this.freeSpinsTarget = null; // Контейнер индикатора фриспинов (цель для перелётов в бонусной игре)

    // Trail particle config
    this.trailConfig = {
      emitInterval: config.trailEmitInterval ?? 0.003,
      particleLifetime: config.trailParticleLifetime ?? 0.25,
      particleStartScale: config.trailParticleStartScale ?? 1.05,
      particleEndScale: config.trailParticleEndScale ?? 0.21,
      particleStartAlpha: config.trailParticleStartAlpha ?? 0.9,
      particleEndAlpha: config.trailParticleEndAlpha ?? 0,
      particleSpeed: config.trailParticleSpeed ?? 15,
      particleSize: config.trailParticleSize ?? 17,
    };

    this.particleTextures = {};

    this.assetsReady = false;
    this.assetsLoadingPromise = null;

    this.coinSkeletonAlias = "slot5ScatterCoinSkeleton";
    this.coinAtlasAlias = "slot5ScatterCoinAtlas";
    this.explosionSkeletonAlias = "slot5ScatterExplosionSkeleton";
    this.explosionAtlasAlias = "slot5ScatterExplosionAtlas";

    this.container = new PIXI.Container();
    this.container.zIndex = 9999;
    this.container.sortableChildren = true;
    this.initialized = false;

    // Isolated particle rendering (additive among particles, normal to scene)
    this.particleContainer = new PIXI.Container();
    this.particleRenderTexture = null;
    this.particleSprite = null;
  }

  setChests(chests) {
    this.chests = chests;
  }

  /**
   * Устанавливает контейнер индикатора фриспинов как цель для перелётов
   * @param {PIXI.Container} container - Контейнер индикатора фриспинов
   */
  setFreeSpinsTarget(container) {
    this.freeSpinsTarget = container;
  }

  async init() {
    if (!this.initialized) {
      this.app.stage.addChild(this.container);
      this.app.stage.sortChildren();
      this.initialized = true;

      // Setup isolated particle rendering
      this._setupParticleRenderTexture();
    }

    this._createParticleTextures();
    await this._ensureAssetsLoaded();
    console.log("✅ [ScatterFlySystem] Initialized");
  }

  _setupParticleRenderTexture() {
    const width = this.app.screen.width;
    const height = this.app.screen.height;

    // Create RenderTexture for particles
    this.particleRenderTexture = PIXI.RenderTexture.create({
      width,
      height,
      resolution: this.app.renderer.resolution || 1,
    });

    // Sprite to display the rendered particles (normal blend with scene)
    this.particleSprite = new PIXI.Sprite(this.particleRenderTexture);
    this.particleSprite.blendMode = "normal";
    this.particleSprite.zIndex = -1; // Below coins/explosions in container
    this.container.addChild(this.particleSprite);
    this.container.sortChildren();
  }

  _createParticleTextures() {
    const colors = {
      blue: 0x4aa3ff,
      gold: 0xffd24a,
      red: 0xff5b5b,
    };

    for (const [name, color] of Object.entries(colors)) {
      const size = this.trailConfig.particleSize * 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");

      // Radial gradient for soft glow
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      const r = (color >> 16) & 0xff;
      const g = (color >> 8) & 0xff;
      const b = color & 0xff;
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
      gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.8)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      this.particleTextures[name] = PIXI.Texture.from(canvas);
    }
  }

  startFlightFromScatter(symbol) {
    if (!symbol || !symbol.isScatter) {
      return;
    }

    // Capture data immediately (symbol state may change later)
    const scatterType = symbol.scatterType || "red";
    const chestColor = this._resolveChestColor(scatterType);
    
    // Получаем состояние бонусной игры (если есть колбэк)
    let bonusState = null;
    if (this.config.getBonusState) {
      try {
        bonusState = this.config.getBonusState();
      } catch (error) {
        console.warn("[ScatterFlySystem] Error getting bonus state:", error);
      }
    }

    // Логика выбора цели в зависимости от режима игры
    let targetType = 'chest'; // 'chest' или 'freespins'
    let targetChest = null;
    let targetContainer = null;

    if (bonusState && bonusState.isBonus === true) {
      // В бонусной игре все скаттеры летят в индикатор фриспинов (в сундуки не стреляем — они уже активированы или не цель)
      if (!this.freeSpinsTarget) {
        console.warn("[ScatterFlySystem] Free spins target not set, cannot create flight");
        return;
      }
      targetType = 'freespins';
      targetContainer = this.freeSpinsTarget;
    } else {
      // Регулярная игра - летим в сундук
      targetChest = this.chests?.[chestColor];
      if (!targetChest) {
        console.warn("[ScatterFlySystem] Chest not found for:", chestColor);
        return;
      }
    }

    // Get global (stage) coordinates of symbol center
    // This accounts for any parent container offsets (e.g., debug position editor)
    let startX, startY;
    if (symbol.cellContainer && symbol.cellContainer.toGlobal && symbol.SYMBOL_SIZE) {
      const globalPos = symbol.cellContainer.toGlobal(
        new PIXI.Point(symbol.SYMBOL_SIZE / 2, symbol.SYMBOL_SIZE / 2)
      );
      startX = globalPos.x;
      startY = globalPos.y;
    } else {
      // Fallback to local coordinates if cellContainer not available
      startX = Number(symbol.currentX);
      startY = Number(symbol.currentY);
    }

    // Определяем координаты цели
    let endX, endY;
    if (targetType === 'freespins') {
      // Координаты индикатора фриспинов
      const globalPos = targetContainer.toGlobal(new PIXI.Point(0, 0));
      endX = globalPos.x;
      endY = globalPos.y;
    } else {
      // Координаты сундука
      endX = Number(targetChest.x) + this.config.chestOffsetX;
      endY = Number(targetChest.y) + this.config.chestOffsetY;
    }

    if (![startX, startY, endX, endY].every(Number.isFinite)) {
      console.warn("[ScatterFlySystem] Invalid flight coordinates");
      return;
    }

    // Defer scene modification to next frame to avoid spine-pixi render corruption
    // when called from Spine event callback
    requestAnimationFrame(() => {
      this._createFlight(scatterType, chestColor, startX, startY, endX, endY, targetType);
    });
  }

  _createFlight(scatterType, chestColor, startX, startY, endX, endY, targetType = 'chest') {
    const display = this._createCoinDisplay(scatterType, startX, startY);
    if (!display) {
      console.warn("[ScatterFlySystem] Failed to create coin display");
      return;
    }

    display.zIndex = 100; // Above particles (-1), below explosions (10000)
    this.container.addChild(display);
    this.container.sortChildren();

    const dx = endX - startX;
    const dy = endY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const normalizedDistance = Math.min(distance / this.config.maxDistance, 1);
    const arcHeight = Math.max(24, this.config.baseArcHeight * (1.5 - normalizedDistance));

    const flight = {
      id: this.nextFlightId++,
      display,
      scatterType,
      chestColor,
      targetType, // 'chest' или 'freespins'
      startX,
      startY,
      endX,
      endY,
      arcHeight,
      time: 0,
      duration: this.config.flyDuration,
      emitTimer: 0,
      emitting: true,
    };

    this.activeFlights.push(flight);
  }

  update(deltaTime) {
    if (!Number.isFinite(deltaTime) || deltaTime <= 0) {
      return;
    }

    for (let i = this.activeFlights.length - 1; i >= 0; i--) {
      const flight = this.activeFlights[i];
      if (!flight || !flight.display || flight.display.destroyed) {
        this.activeFlights.splice(i, 1);
        continue;
      }

      flight.time += deltaTime;
      const t = Math.min(flight.time / flight.duration, 1);

      const baseX = flight.startX + (flight.endX - flight.startX) * t;
      const baseY = flight.startY + (flight.endY - flight.startY) * t;

      const dx = flight.endX - flight.startX;
      const dy = flight.endY - flight.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      let x = baseX;
      let y = baseY;

      if (distance > 0) {
        const dirX = dx / distance;
        const dirY = dy / distance;
        const perpX = -dirY;
        const perpY = dirX;
        const arcProgress = -4 * flight.arcHeight * t * (t - 1);
        x = baseX + perpX * arcProgress;
        y = baseY + perpY * arcProgress;
      }

      flight.display.x = x;
      flight.display.y = y;
      this._updateSpineInstance(flight.display);

      // Emit trail particles
      if (flight.emitting) {
        flight.emitTimer += deltaTime;
        while (flight.emitTimer >= this.trailConfig.emitInterval) {
          flight.emitTimer -= this.trailConfig.emitInterval;
          this._emitParticle(x, y, flight.scatterType);
        }
      }

      if (t >= 1) {
        this._completeFlight(i, flight);
      }
    }

    // Update trail particles
    this._updateParticles(deltaTime);

    // Render particles to isolated RenderTexture (additive among themselves, normal to scene)
    this._renderParticlesToTexture();

    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      const explosion = this.activeExplosions[i];
      if (!explosion || !explosion.instance || explosion.instance.destroyed || explosion.finished) {
        this.activeExplosions.splice(i, 1);
        continue;
      }
      this._updateSpineInstance(explosion.instance);
    }
  }

  playExplosion(x, y, onComplete = null) {
    if (!this._canUseSpineEffect()) {
      if (typeof onComplete === "function") {
        onComplete();
      }
      return;
    }

    let explosion = null;
    try {
      explosion = spine.Spine.from({
        skeleton: this.explosionSkeletonAlias,
        atlas: this.explosionAtlasAlias,
        scale: 1,
      });
    } catch (error) {
      console.warn("[ScatterFlySystem] Failed to create explosion spine:", error);
      if (typeof onComplete === "function") {
        onComplete();
      }
      return;
    }

    this._ensureSpinePhysicsStub(explosion);

    explosion.scale.set(this.config.explosionScale);
    explosion.x = x;
    explosion.y = y;
    explosion.zIndex = 10000; // Above coins (100), above particles (-1)
    this.container.addChild(explosion);
    this.container.sortChildren();

    const explosionInfo = {
      instance: explosion,
      finished: false,
    };
    this.activeExplosions.push(explosionInfo);

    const entry = explosion.state?.setAnimation(0, "animation", false);
    if (!entry) {
      this._cleanupSpineInstance(explosion);
      explosionInfo.finished = true;
      if (typeof onComplete === "function") {
        onComplete();
      }
      return;
    }

    entry.listener = {
      complete: () => {
        explosionInfo.finished = true;
        requestAnimationFrame(() => {
          this._cleanupSpineInstance(explosion);
          if (typeof onComplete === "function") {
            onComplete();
          }
        });
      },
    };
  }

  destroy() {
    for (let i = this.activeFlights.length - 1; i >= 0; i--) {
      this._cleanupDisplay(this.activeFlights[i]?.display);
    }
    this.activeFlights.length = 0;

    for (let i = this.activeExplosions.length - 1; i >= 0; i--) {
      this._cleanupSpineInstance(this.activeExplosions[i]?.instance);
    }
    this.activeExplosions.length = 0;

    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      this._cleanupParticle(this.activeParticles[i]);
    }
    this.activeParticles.length = 0;

    // Cleanup particle rendering resources
    if (this.particleContainer && !this.particleContainer.destroyed) {
      this.particleContainer.destroy({ children: true });
    }
    if (this.particleRenderTexture && !this.particleRenderTexture.destroyed) {
      this.particleRenderTexture.destroy(true);
    }

    if (this.container && this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    if (this.container && !this.container.destroyed) {
      this.container.destroy({ children: true });
    }
  }

  _resolveChestColor(scatterType) {
    const map = { blue: "blue", gold: "yellow", red: "red" };
    return map[scatterType] || "red";
  }

  _createCoinDisplay(scatterType, x, y) {
    const spineCoin = this._createSpineCoin(scatterType, x, y);
    if (spineCoin) {
      return spineCoin;
    }

    // Safe fallback to keep gameplay stable if spine assets are unavailable.
    const colorMap = {
      blue: 0x4aa3ff,
      gold: 0xffd24a,
      red: 0xff5b5b,
    };

    const graphics = new PIXI.Graphics();
    graphics.beginFill(colorMap[scatterType] || colorMap.red);
    graphics.drawCircle(0, 0, 12);
    graphics.endFill();
    graphics.x = x;
    graphics.y = y;
    return graphics;
  }

  _createSpineCoin(scatterType, x, y) {
    if (!this._canUseSpineEffect()) {
      return null;
    }

    let coin = null;
    try {
      coin = spine.Spine.from({
        skeleton: this.coinSkeletonAlias,
        atlas: this.coinAtlasAlias,
        scale: 1,
      });
    } catch (error) {
      console.warn("[ScatterFlySystem] Failed to create coin spine:", error);
      return null;
    }

    this._ensureSpinePhysicsStub(coin);

    const safeSkin = ["blue", "gold", "red"].includes(scatterType) ? scatterType : "red";
    const skin = coin.skeleton?.data?.findSkin(safeSkin);
    if (skin && coin.skeleton) {
      coin.skeleton.setSkin(skin);
      coin.skeleton.setSlotsToSetupPose();
    }

    coin.scale.set(this.config.coinScale);
    coin.x = x;
    coin.y = y;

    const animEntry = coin.state?.setAnimation(0, "animation", true);
    if (!animEntry) {
      this._cleanupSpineInstance(coin);
      return null;
    }

    return coin;
  }

  _completeFlight(index, flight) {
    const endX = flight.endX;
    const endY = flight.endY;
    const chestColor = flight.chestColor;

    flight.emitting = false;
    this._cleanupDisplay(flight.display);
    this.activeFlights.splice(index, 1);

    // Добавляем цвет сундука в массив активных только если цель была сундук (не индикатор фриспинов)
    if (flight.targetType === 'chest' && chestColor && !this.activeChests.includes(chestColor)) {
      this.activeChests.push(chestColor);
    }

    this.playExplosion(endX, endY);

    if (typeof this.config.onFlightComplete === "function") {
      try {
        // Если цель была индикатор фриспинов, передаём специальный флаг
        const targetColor = flight.targetType === 'freespins' ? 'freespins' : chestColor;
        this.config.onFlightComplete(targetColor);
      } catch (error) {
        console.warn("[ScatterFlySystem] onFlightComplete error:", error);
      }
    }
  }

  /**
   * Получить массив активных сундуков (получивших монетки) и очистить его
   * @returns {string[]} Массив цветов сундуков
   */
  getActiveChestsAndClear() {
    const chests = [...this.activeChests];
    this.activeChests = [];
    return chests;
  }

  _renderParticlesToTexture() {
    if (!this.particleRenderTexture || !this.particleContainer || !this.app?.renderer) {
      return;
    }

    // Clear the texture (transparent)
    this.app.renderer.render({
      container: this.particleContainer,
      target: this.particleRenderTexture,
      clear: true,
    });
  }

  _emitParticle(x, y, scatterType) {
    const texture = this.particleTextures[scatterType] || this.particleTextures.red;
    if (!texture) {
      return;
    }

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.blendMode = "add";
    sprite.x = x;
    sprite.y = y;
    sprite.scale.set(this.trailConfig.particleStartScale);
    sprite.alpha = this.trailConfig.particleStartAlpha;

    // Random velocity for spread
    const angle = Math.random() * Math.PI * 2;
    const speed = this.trailConfig.particleSpeed * (0.5 + Math.random() * 0.5);

    const particle = {
      sprite,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0,
      maxLife: this.trailConfig.particleLifetime * (0.8 + Math.random() * 0.4),
    };

    this.particleContainer.addChild(sprite);
    this.activeParticles.push(particle);
  }

  _updateParticles(deltaTime) {
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      if (!p || !p.sprite || p.sprite.destroyed) {
        this.activeParticles.splice(i, 1);
        continue;
      }

      p.life += deltaTime;
      const progress = Math.min(p.life / p.maxLife, 1);

      if (progress >= 1) {
        this._cleanupParticle(p);
        this.activeParticles.splice(i, 1);
        continue;
      }

      // Move
      p.sprite.x += p.vx * deltaTime;
      p.sprite.y += p.vy * deltaTime;

      // Fade and shrink
      const startScale = this.trailConfig.particleStartScale;
      const endScale = this.trailConfig.particleEndScale;
      const startAlpha = this.trailConfig.particleStartAlpha;
      const endAlpha = this.trailConfig.particleEndAlpha;

      p.sprite.scale.set(startScale + (endScale - startScale) * progress);
      p.sprite.alpha = startAlpha + (endAlpha - startAlpha) * progress;
    }
  }

  _cleanupParticle(particle) {
    if (!particle || !particle.sprite) {
      return;
    }
    if (particle.sprite.parent) {
      try {
        particle.sprite.parent.removeChild(particle.sprite);
      } catch (e) {
        // no-op
      }
    }
    if (!particle.sprite.destroyed) {
      try {
        particle.sprite.destroy();
      } catch (e) {
        // no-op
      }
    }
  }

  _cleanupDisplay(display) {
    if (!display || display.destroyed) {
      return;
    }
    this._deferredDestroy(display);
  }

  _cleanupSpineInstance(instance) {
    if (!instance || instance.destroyed) {
      return;
    }
    this._deferredDestroy(instance);
  }

  _updateSpineInstance(instance) {
    if (!instance || instance.destroyed || !instance.skeleton) {
      return;
    }

    if (instance.parent && instance.parent.children?.includes(instance)) {
      try {
        const physics = instance.skeleton.physics;
        if (physics && typeof physics.update === "function") {
          instance.skeleton.updateWorldTransform(physics.update);
        }
      } catch (error) {
        // no-op
      }
    }
  }

  _ensureSpinePhysicsStub(spineInstance) {
    if (!spineInstance || !spineInstance.skeleton) {
      return;
    }

    if (!spineInstance.skeleton.physics) {
      spineInstance.skeleton.physics = {
        update: () => {},
        updateGlobal: () => {},
      };
    }
  }

  _canUseSpineEffect() {
    return (
      this.assetsReady &&
      typeof spine !== "undefined" &&
      PIXI?.Assets?.get &&
      PIXI.Assets.get(this.coinSkeletonAlias) &&
      PIXI.Assets.get(this.coinAtlasAlias) &&
      PIXI.Assets.get(this.explosionSkeletonAlias) &&
      PIXI.Assets.get(this.explosionAtlasAlias)
    );
  }

  async _ensureAssetsLoaded() {
    if (this.assetsReady) {
      return true;
    }

    if (!PIXI?.Assets?.load) {
      return false;
    }

    if (!this.assetsLoadingPromise) {
      this.assetsLoadingPromise = PIXI.Assets.load([
        { alias: this.coinSkeletonAlias, src: "./spine/coin_p/skeleton.json" },
        { alias: this.coinAtlasAlias, src: "./spine/coin_p/skeleton.atlas" },
        { alias: this.explosionSkeletonAlias, src: "./spine/explosion/skeleton.json" },
        { alias: this.explosionAtlasAlias, src: "./spine/explosion/skeleton.atlas" },
      ])
        .then(() => {
          this.assetsReady = true;
          return true;
        })
        .catch((error) => {
          console.warn("[ScatterFlySystem] Failed to load spine assets:", error);
          return false;
        });
    }

    return this.assetsLoadingPromise;
  }

  _deferredDestroy(instance) {
    if (!instance || instance.destroyed || this.destroyQueue.has(instance)) {
      return;
    }

    this.destroyQueue.add(instance);
    instance.visible = false;

    requestAnimationFrame(() => {
      if (!instance.destroyed && instance.parent) {
        try {
          instance.parent.removeChild(instance);
        } catch (error) {
          // no-op
        }
      }

      requestAnimationFrame(() => {
        if (!instance.destroyed) {
          try {
            if (instance.state?.clearTracks) {
              instance.state.clearTracks();
            }
            instance.destroy();
          } catch (error) {
            // no-op
          }
        }
        this.destroyQueue.delete(instance);
      });
    });
  }
}
