import { ClassicReels } from './ClassicReels.js';
import { HoldNWin } from './HoldNWin.js';
import { SlotReel } from './SlotReel.js';
import { WinFrameAnimation } from './WinFrameAnimation.js';
import { GameScenarios } from './GameScenarios.js';
import { SpineAnimation } from './SpineAnimation.js';
import { DebugPositionEditor } from './DebugPositionEditor.js';

export class SlotMachine {
  constructor(config, app) {
    this.config = config;
    this.app = app;
    this.reels = [];
    this.currentMode = null;
    this.isSpinning = false;
    this.spinCount = 0;
    this.onSpinComplete = null;
    
    this.reelsContainer = new PIXI.Container();
    this.reelsContainer.zIndex = 100;
    this.app.stage.addChild(this.reelsContainer);
    
    // Контейнер для эффектов поверх символов
    this.effectsContainer = new PIXI.Container();
    this.effectsContainer.zIndex = 200;
    this.app.stage.addChild(this.effectsContainer);
    
    // Контейнер для Spine анимаций
    this.spineContainer = new PIXI.Container();
    this.spineContainer.zIndex = 150;
    this.spineContainer.sortableChildren = true; // Включаем сортировку для работы zIndex у дочерних элементов
    this.app.stage.addChild(this.spineContainer);
    
    const gameAreaWidth = this.config.reels.count * this.config.symbolSize.width + 
      (this.config.reels.count - 1) * this.config.reelSpacing;
    const gameAreaHeight = this.config.reels.symbolsPerReel * this.config.symbolSize.height;
    
    this.config.startPosition = {
      x: this.config.resolution.width / 2 - gameAreaWidth / 2,
      y: this.config.resolution.height / 2 - gameAreaHeight / 2
    };
    
    this.gameAreaWidth = gameAreaWidth;
    this.gameAreaHeight = gameAreaHeight;
    
    this.winFrameAnimation = new WinFrameAnimation(config, app, this.effectsContainer);
    this.scenarios = new GameScenarios(config);
    this.spineAnimations = {};
    
    // Контейнер для фоновых элементов
    this.bgContainer = new PIXI.Container();
    this.bgContainer.zIndex = 50; // Ниже всего остального
    this.bgContainer.sortableChildren = true; // Включаем сортировку для работы zIndex у дочерних элементов
    this.app.stage.addChild(this.bgContainer);
    this.bgElements = {}; // Хранилище фоновых элементов
    
    this.spinButton = null; // Ссылка на кнопку спин (устанавливается извне)
  }
  
  async init() {
    await this.loadSymbolTextures();
    await this.winFrameAnimation.loadAtlas();
    
    // Загружаем фоновые элементы
    await this.loadBackgroundElements();
    
    // Загружаем сценарий если указан путь
    if (this.config.scenarios && this.config.scenarios.enabled && this.config.scenarios.scenarioPath) {
      await this.scenarios.loadScenario(this.config.scenarios.scenarioPath);
    }
    
    // Загружаем Spine анимации
    await this.loadSpineAnimations();
    
    this.initMode();
    this.initReels();
    this.drawGameAreaFrame();
    
    // Инициализируем отладчик позиции (если включен в конфиге)
    // Делаем это после загрузки всех элементов, чтобы фоновые элементы были доступны
    if (this.config.debug && this.config.debug.positionEditor) {
      console.log('SlotMachine: Initializing DebugPositionEditor...');
      this.debugEditor = new DebugPositionEditor(this.app, this);
      // Обновляем список элементов после инициализации (на случай если элементы загрузились)
      if (this.debugEditor && this.debugEditor.updateElementList) {
        setTimeout(() => {
          this.debugEditor.updateElementList();
        }, 100);
      }
      console.log('SlotMachine: DebugPositionEditor initialized');
    } else {
      console.log('SlotMachine: DebugPositionEditor disabled in config');
    }
  }
  
  async loadBackgroundElements() {
    // Список файлов фоновых элементов
    const bgFiles = [
      { name: 'bg_desktop_reg', file: 'bg_desktop_reg.png' },
      { name: 'field', file: 'field.png' },
      { name: 'jp', file: 'jp.png' },
      { name: 'top', file: 'top.png' }
    ];
    
    for (const bgItem of bgFiles) {
      try {
        const texturePath = `./bg_png/${bgItem.file}`;
        const texture = await PIXI.Assets.load(texturePath);
        
        // Создаем спрайт
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5); // Центрируем якорь для удобства позиционирования
        
        // Позиционируем фоновые элементы (значения из debug_positions.json)
        const bgPositions = {
          bg_desktop_reg: { x: 960, y: 540, zIndex: 10 },
          field: { x: 960, y: 540, zIndex: 95 },
          jp: { x: 960, y: 540, zIndex: 30 },
          top: { x: 960, y: 540, zIndex: 40 }
        };
        
        const bgPos = bgPositions[bgItem.name] || { 
          x: this.config.resolution.width / 2, 
          y: this.config.resolution.height / 2,
          zIndex: 50
        };
        
        sprite.x = bgPos.x;
        sprite.y = bgPos.y;
        sprite.zIndex = bgPos.zIndex;
        
        // Добавляем напрямую на stage для глобальной сортировки
        // (не в bgContainer, чтобы zIndex работал глобально)
        this.app.stage.addChild(sprite);
        
        // Сохраняем ссылку
        this.bgElements[bgItem.name] = sprite;
        
        console.log(`Loaded background element: ${bgItem.name} on stage with zIndex: ${sprite.zIndex}`);
      } catch (error) {
        console.warn(`Failed to load background element ${bgItem.name}:`, error);
      }
    }
  }
  
  async loadSpineAnimations() {
    // Загружаем поезд если включен в конфиге
    if (this.config.spine && this.config.spine.train && this.config.spine.train.enabled) {
      const trainConfig = this.config.spine.train;
      // Создаем поезд в отдельном контейнере на stage
      const trainAnimation = new SpineAnimation(
        this.config,
        this.app,
        this.app.stage, // Добавляем контейнер поезда напрямую на stage
        'train',
        trainConfig.animationName || '00_idle',
        trainConfig.loop !== undefined ? trainConfig.loop : true
      );
      
      const loaded = await trainAnimation.load();
      if (loaded) {
        // Получаем контейнер поезда и устанавливаем zIndex
        const trainContainer = trainAnimation.getContainer();
        trainContainer.zIndex = 90; // Значение из debug_positions.json
        
        // Размещаем поезд (значения из debug_positions.json)
        const trainX = 960;
        const trainY = 236;
        
        trainAnimation.setPosition(trainX, trainY);
        
        if (trainConfig.scale) {
          trainAnimation.setScale(trainConfig.scale.x, trainConfig.scale.y);
        }
        
        this.spineAnimations.train = trainAnimation;
        
        // Запускаем постоянные анимации в цикле на разных треках
        // Трек 0: базовая idle анимация (уже запущена при load)
        // Трек 1: piles of gold (зациклено)
        trainAnimation.setAnimationOnTrack(1, '01_piles_of_gold', true);
        
        // Трек 2: speed effect (зациклено)
        trainAnimation.setAnimationOnTrack(2, '02_bg_speed_effect', true);
        
        console.log('Train Spine animation loaded with continuous tracks (idle, piles, speed)');
      }
    }
    
    // Загружаем logo если включен в конфиге
    if (this.config.spine && this.config.spine.logo && this.config.spine.logo.enabled) {
      const logoConfig = this.config.spine.logo;
      // Создаем logo в отдельном контейнере на stage
      const logoAnimation = new SpineAnimation(
        this.config,
        this.app,
        this.app.stage, // Добавляем контейнер logo напрямую на stage
        'logo',
        logoConfig.animationName || 'idle',
        logoConfig.loop !== undefined ? logoConfig.loop : true
      );
      
      const loaded = await logoAnimation.load();
      if (loaded) {
        // Получаем контейнер logo и устанавливаем zIndex
        const logoContainer = logoAnimation.getContainer();
        logoContainer.zIndex = logoConfig.zIndex !== undefined ? logoConfig.zIndex : 250;
        
        // Размещаем logo (значения из debug_positions.json)
        const logoX = 960;
        const logoY = 275;
        
        logoAnimation.setPosition(logoX, logoY);
        
        if (logoConfig.scale) {
          logoAnimation.setScale(logoConfig.scale.x, logoConfig.scale.y);
        }
        
        this.spineAnimations.logo = logoAnimation;
        console.log('Logo Spine animation loaded and positioned in its own container');
      }
    }
  }
  
  // Метод для запуска разовой анимации поезда при спине
  playTrainSpinAnimation() {
    const trainAnimation = this.spineAnimations.train;
    if (!trainAnimation || !trainAnimation.spine) return;
    
    // Список разовых анимаций
    const spinAnimations = ['03_blick_add', '04_steam_1', '05_steam_2'];
    
    // Выбираем случайную анимацию
    const randomAnim = spinAnimations[Math.floor(Math.random() * spinAnimations.length)];
    
    // Трек 3 для разовых анимаций
    const TRACK_ONESHOT = 3;
    
    // Очищаем трек перед запуском
    trainAnimation.clearTrack(TRACK_ONESHOT);
    trainAnimation.setEmptyAnimation(TRACK_ONESHOT, 0);
    
    // Запускаем разовую анимацию
    trainAnimation.setAnimationOnTrack(TRACK_ONESHOT, randomAnim, false);
    
    console.log(`Train: Playing spin animation "${randomAnim}"`);
  }
  
  async loadSymbolTextures() {
    this.config.symbolTextures = [];
    
    for (const file of this.config.symbolTextureFiles) {
      const texturePath = this.config.symbolTexturesPath + file;
      const texture = await PIXI.Assets.load(texturePath);
      this.config.symbolTextures.push(texture);
    }
    
    console.log(`Loaded ${this.config.symbolTextures.length} symbol textures`);
  }
  
  initMode() {
    if (this.config.gameMode === 'classic') {
      this.currentMode = new ClassicReels(this);
    } else if (this.config.gameMode === 'holdnwin') {
      this.currentMode = new HoldNWin(this);
    } else {
      this.currentMode = new ClassicReels(this);
    }
  }
  
  initReels() {
    for (let i = 0; i < this.config.reels.count; i++) {
      let spinOffset = null;
      let totalSymbols = null;
      
      if (this.config.reels.reelConfigs && this.config.reels.reelConfigs[i]) {
        const reelConfig = this.config.reels.reelConfigs[i];
        spinOffset = reelConfig.spinOffset !== undefined ? reelConfig.spinOffset : null;
        totalSymbols = reelConfig.totalSymbols !== undefined ? reelConfig.totalSymbols : null;
      }
      
      const reel = new SlotReel(this.config, i, this.reelsContainer, this.app, spinOffset, totalSymbols);
      reel.onSpinComplete = () => {
        this.checkAllReelsStopped();
      };
      this.reels.push(reel);
    }
  }
  
  checkAllReelsStopped() {
    const allStopped = this.reels.every(reel => !reel.isSpinning && reel.animationId === null);
    if (allStopped) {
      this.onAllReelsStopped();
    }
  }
  
  drawGameAreaFrame() {
    const x = this.config.startPosition.x;
    const y = this.config.startPosition.y;
    const width = this.gameAreaWidth;
    const height = this.gameAreaHeight;
    
    // Маска скрывает символы вне игровой зоны
    // Маска создается на базовой позиции startPosition
    // Все смещения применяются через дебаггер (синхронизация с reelsContainer)
    const maskOffsetY = 0;
    
    this.gameMask = new PIXI.Graphics();
    this.gameMask.rect(0, 0, width, height);
    this.gameMask.fill(0xFFFFFF);
    this.gameMask.x = x;
    this.gameMask.y = y + maskOffsetY;
    this.gameMask.zIndex = 999;
    this.app.stage.addChild(this.gameMask);
    this.reelsContainer.mask = this.gameMask;
    
    // Рама игрового поля
    this.gameFrame = new PIXI.Graphics();
    this.gameFrame.rect(0, 0, width, height);
    this.gameFrame.stroke({ width: 2, color: 0xFF0000, alpha: 1 });
    this.gameFrame.x = x;
    this.gameFrame.y = y + maskOffsetY;
    this.gameFrame.zIndex = 1000;
    this.gameFrame.visible = true; // Показываем красный контур
    this.app.stage.addChild(this.gameFrame);
    
    console.log('Frame drawn at:', x, y + maskOffsetY, width, height);
    console.log('Mask applied at:', x, y + maskOffsetY, width, height);
  }
  
  async spin() {
    if (this.isSpinning) return;
    if (this.spinCount >= this.config.maxSpins) {
      console.log('Достигнут лимит спинов для тестирования');
      return;
    }
    
    // Получаем матрицу результатов из сценария (если есть)
    let resultMatrix = null;
    if (this.config.scenarios && this.config.scenarios.enabled) {
      resultMatrix = this.scenarios.getCurrentMatrix();
      if (resultMatrix) {
        console.log(`Spin ${this.spinCount}: Using scenario matrix`, resultMatrix);
      }
    }
    
    this.isSpinning = true;
    this.spinCount++;
    
    // Запускаем разовую анимацию поезда при спине
    this.playTrainSpinAnimation();
    
    this.reels.forEach((reel, index) => {
      reel.startSpin(resultMatrix);
    });
    
    // Переходим к следующему спину в сценарии
    if (this.config.scenarios && this.config.scenarios.enabled) {
      this.scenarios.nextSpin();
    }
  }
  
  onAllReelsStopped() {
    this.isSpinning = false;
    
    // Показываем 3 анимации winframe поверх случайных символов
    this.winFrameAnimation.playOnRandomSymbols(this.reels);
    
    if (this.onSpinComplete) {
      this.onSpinComplete();
    }
  }
  
  reset() {
    this.spinCount = 0;
    if (this.scenarios) {
      this.scenarios.reset();
    }
    if (this.currentMode && this.currentMode.reset) {
      this.currentMode.reset();
    }
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  setGameMode(mode) {
    this.config.gameMode = mode;
    this.initMode();
  }
}

