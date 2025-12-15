// Класс для системы эффектов Spine с частицами

export class SpineEffectSystem {
  constructor(options) {
    this.id = options.id;
    this.app = options.app;
    this.stage = options.stage;
    this.x = options.x;
    this.y = options.y;
    this.zIndexBase = options.zIndex ?? 1;
    this.controlBoneNames = options.controlBoneNames;
    this.emitterBoneName = options.emitterBoneName;
    this.animations = options.animations;
    this.idleAnimationName = options.idleAnimationName;
    this.initialSkin = options.initialSkin;
    this.rawEmitterConfig = options.rawEmitterConfig;
    this.particleNamespace = options.particleNamespace;
    this.particleTextures = options.particleTextures;
    this.dragState = options.dragState;
    this.waitNextFrame = options.waitNextFrame;
    this.log = options.log;
    this.controlPointColor = options.controlPointColor ?? 0xffffff;

    this.controlBones = [];
    this.activeTracks = new Set();
    this.controlledTracks = [0, 1];
    this.bonePoint = { x: 0, y: 0 };
  }

  async init() {
    this.spine = spine.Spine.from({
      skeleton: "pinataSkeleton",
      atlas: "pinataAtlas",
      scale: 1,
    });

    this.ensurePhysics();

    this.spine.state.data.defaultMix = 0.1;
    this.spine.x = this.x;
    this.spine.y = this.y;
    this.spine.zIndex = this.zIndexBase;
    this.stage.addChild(this.spine);

    await this.waitNextFrame();

    // Устанавливаем начальный скин
    const initialSkin = this.spine.skeleton.data.findSkin(this.initialSkin);
    if (initialSkin) {
      this.spine.skeleton.setSkin(initialSkin);
      this.currentSkin = this.initialSkin;
    }

    this.setupControlBones();
    this.setupEmitter(this.initialSkin);
    this.setupEvents();
  }

  ensurePhysics() {
    if (!this.spine.skeleton.physics) {
      this.spine.skeleton.physics = {
        update: () => {},
        updateGlobal: () => {},
      };
    }
  }

  setupControlBones() {
    for (const name of this.controlBoneNames) {
      const bone = this.spine.skeleton.findBone(name);
      if (!bone) continue;

      const world = { x: bone.worldX, y: bone.worldY };
      this.spine.skeletonToPixiWorldCoordinates(world);

      const handle = new PIXI.Graphics()
        .lineStyle({ width: 1, color: this.controlPointColor, alpha: 0.9 })
        .beginFill(this.controlPointColor, 0.4)
        .drawCircle(0, 0, 9)
        .endFill();
      handle.x = world.x;
      handle.y = world.y;
      handle.cursor = "pointer";
      handle.eventMode = "static";
      handle.zIndex = this.zIndexBase + 2;

      handle.on("pointerdown", ({ x, y }) => {
        this.dragState.node = handle;
        this.dragState.system = this;
        this.dragState.lastX = x;
        this.dragState.lastY = y;
      });

      this.stage.addChild(handle);
      this.controlBones.push({ bone, handle });
    }

    const convertPoint = { x: 0, y: 0 };
    this.spine.beforeUpdateWorldTransforms = () => {
      for (const { bone, handle } of this.controlBones) {
        convertPoint.x = handle.x;
        convertPoint.y = handle.y;
        this.spine.pixiWorldCoordinatesToBone(convertPoint, bone);
        bone.x = convertPoint.x;
        bone.y = convertPoint.y;
      }
    };
  }

  setupEmitter(skinName) {
    this.particleLayer = new PIXI.Container();
    this.particleLayer.zIndex = this.zIndexBase + 1;
    this.stage.addChild(this.particleLayer);

    const texture = this.particleTextures[skinName] ?? null;
    const emitterConfig = this.createEmitterConfig(texture);
    this.emitter = new this.particleNamespace.Emitter(
      this.particleLayer,
      emitterConfig
    );
    this.emitter.autoUpdate = true;
    this.emitter.emit = false;

    this.targetBone = this.spine.skeleton.findBone(this.emitterBoneName);
  }

  createEmitterConfig(texture) {
    const clone = JSON.parse(JSON.stringify(this.rawEmitterConfig));
    if (this.particleNamespace.upgradeConfig) {
      return this.particleNamespace.upgradeConfig(clone, texture ? [texture] : []);
    }
    if (texture) {
      clone.texture = texture;
    }
    return clone;
  }

  updateEmitterTexture(skinName) {
    const texture = this.particleTextures[skinName];
    if (!texture || !this.emitter) return;

    let updated = false;
    
    // Пробуем найти behavior через разные пути
    const behaviorPaths = [
      this.emitter.behaviors,
      this.emitter.initBehaviors,
      this.emitter._behaviors,
      this.emitter.config?.behaviors
    ];

    for (const behaviors of behaviorPaths) {
      if (!behaviors || !Array.isArray(behaviors)) continue;
      
      for (const behavior of behaviors) {
        if (!behavior) continue;
        
        // Проверяем разные возможные типы
        const behaviorType = behavior.type || behavior.constructor?.name || '';
        if (behaviorType.includes('texture') || behaviorType.includes('Texture')) {
          if (behavior.texture !== undefined) {
            behavior.texture = texture;
            updated = true;
            this.log(`[${this.id}] Texture updated via behavior type: ${behaviorType}`);
            break;
          }
        }
      }
      if (updated) break;
    }

    if (updated) {
      this.log(`[${this.id}] Skin and particles switched to: ${skinName}`);
      return;
    }

    // Если не удалось обновить напрямую, пересоздаем эмиттер
    this.log(`[${this.id}] Could not update texture directly, recreating emitter for ${skinName}`);
    this.recreateEmitter(texture);
  }

  recreateEmitter(texture) {
    if (!this.emitter) return;

    const wasEmitting = this.emitter.emit;
    const position = { x: 0, y: 0 };
    if (this.targetBone) {
      position.x = this.targetBone.worldX;
      position.y = this.targetBone.worldY;
      this.spine.skeletonToPixiWorldCoordinates(position);
    }

    this.emitter.emit = false;
    this.emitter.autoUpdate = false;

    try {
      this.emitter.destroy();
    } catch (error) {
      this.log(`Error destroying emitter: ${error.message}`);
    }

    this.particleLayer.removeChildren();

    const newConfig = this.createEmitterConfig(texture);
    this.emitter = new this.particleNamespace.Emitter(
      this.particleLayer,
      newConfig
    );
    this.emitter.autoUpdate = true;
    this.emitter.emit = wasEmitting;
    this.emitter.updateOwnerPos(position.x, position.y);
  }

  setupEvents() {
    this.spine.state.addListener({
      start: (entry) => {
        if (!this.isControlledTrack(entry.trackIndex)) return;
        if (entry.animation && entry.animation.name !== this.idleAnimationName) {
          this.activeTracks.add(entry.trackIndex);
        }
      },
      event: (entry, event) => {
        if (!this.isControlledTrack(entry.trackIndex)) return;
        if (!event?.data?.name) return;
        const name = event.data.name;
        this.log(`[${this.id}] Event received: "${name}"`);
        if (name === "p_on") {
          this.emitter.emit = true;
          this.log(`[${this.id}] Particles ON`);
        } else if (name === "p_off") {
          this.emitter.emit = false;
          this.log(`[${this.id}] Particles OFF`);
        }
      },
      complete: (entry) => this.handleTrackStop(entry.trackIndex),
      end: (entry) => this.handleTrackStop(entry.trackIndex),
      interrupt: (entry) => this.handleTrackStop(entry.trackIndex),
      dispose: (entry) => this.handleTrackStop(entry.trackIndex),
    });
  }

  isControlledTrack(trackIndex) {
    return this.controlledTracks.includes(trackIndex);
  }

  handleTrackStop(trackIndex) {
    if (!this.isControlledTrack(trackIndex)) return;
    this.activeTracks.delete(trackIndex);
    this.emitter.emit = false;
  }

  setTrackToIdle(trackIndex) {
    const current = this.spine.state.getCurrent(trackIndex);
    if (
      current &&
      current.animation &&
      current.animation.name === this.idleAnimationName
    ) {
      return;
    }
    const idleEntry = this.spine.state.setAnimation(
      trackIndex,
      this.idleAnimationName,
      true
    );
    if (idleEntry) {
      idleEntry.mixDuration = 0;
      idleEntry.mixTime = idleEntry.mixDuration;
    }
  }

  setSkin(skinName) {
    const skin = this.spine.skeleton.data.findSkin(skinName);
    if (!skin) {
      this.log(`[${this.id}] Skin '${skinName}' not found`);
      return;
    }

    requestAnimationFrame(() => {
      this.spine.skeleton.setSkin(skin);
      this.spine.skeleton.setSlotsToSetupPose();
      this.spine.skeleton.updateWorldTransform(spine.Physics.update);
      this.currentSkin = skinName;
      this.updateEmitterTexture(skinName);
    });
  }

  play() {
    // Выключаем эмиттер перед запуском
    this.emitter.emit = false;
    this.activeTracks.clear();
    
    // Очищаем только контролируемые треки
    this.controlledTracks.forEach((track) => {
      this.spine.state.clearTrack(track);
    });

    // Небольшая задержка для гарантии, что треки очищены
    requestAnimationFrame(() => {
      const firstAnimation = this.animations[0];
      const secondAnimation = this.animations[1];

      // Запускаем анимации заново
      const entryA = this.spine.state.setAnimation(
        this.controlledTracks[0],
        firstAnimation,
        false
      );
      if (entryA) {
        entryA.mixDuration = 0.1;
        this.log(`[${this.id}] Track ${this.controlledTracks[0]} set to ${firstAnimation}`);
      } else {
        this.log(`[${this.id}] Failed to set animation on track ${this.controlledTracks[0]}`);
      }

      const entryB = this.spine.state.setAnimation(
        this.controlledTracks[1],
        secondAnimation,
        false
      );
      if (entryB) {
        entryB.mixDuration = 0.1;
        this.log(`[${this.id}] Track ${this.controlledTracks[1]} set to ${secondAnimation}`);
      } else {
        this.log(`[${this.id}] Failed to set animation on track ${this.controlledTracks[1]}`);
      }

      if (typeof this.emitter.resetPositionTracking === "function") {
        this.emitter.resetPositionTracking();
      }

      this.log(`[${this.id}] Animations restarted`);
    });
  }

  update() {
    if (this.spine && this.spine.skeleton && this.spine.skeleton.physics) {
      this.spine.skeleton.updateWorldTransform(spine.Physics.update);
    }

    if (!this.targetBone || !this.emitter) return;
    this.bonePoint.x = this.targetBone.worldX;
    this.bonePoint.y = this.targetBone.worldY;
    this.spine.skeletonToPixiWorldCoordinates(this.bonePoint);
    this.emitter.updateOwnerPos(this.bonePoint.x, this.bonePoint.y);
  }
}

