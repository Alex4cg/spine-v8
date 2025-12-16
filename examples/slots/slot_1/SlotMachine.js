import { ClassicReels } from './ClassicReels.js';
import { HoldNWin } from './HoldNWin.js';
import { SlotReel } from './SlotReel.js';
import { WinFrameAnimation } from './WinFrameAnimation.js';
import { GameScenarios } from './GameScenarios.js';
import { SpineAnimation } from './SpineAnimation.js';
import { DebugPositionEditor } from './DebugPositionEditor.js';
import { ParticleSystem } from './ParticleSystem.js';
import { CollectEffect } from './CollectEffect.js';
import { MiniWinText } from './MiniWinText.js';
import { WinLineManager } from './WinLineManager.js';
import { CoinManager } from './CoinManager.js';
import { CollectorManager } from './CollectorManager.js';
import { AclonicaText } from './AclonicaText.js';
import { TrainManager } from './TrainManager.js';

export class SlotMachine {
  constructor(config, app) {
    this.config = config;
    this.app = app;
    this.reels = [];
    this.currentMode = null;
    this.isSpinning = false;
    this.spinCount = 0;
    this.onSpinComplete = null;
    this.currentScenarioData = null; // Сохраняем данные сценария для обработки индикаторов по рилам
    this.currentEvents = null; // Сохраняем события текущего спина
    this.intrigueAnimation = null; // Анимация intrigue
    this.intrigueCoins = {}; // Отдельные экземпляры Spine монет для интриги: { "reelIndex_positionIndex": SpineAnimation }
    this.intrigueCollectors = {}; // Отдельные экземпляры Spine коллекторов для интриги: { "reelIndex_positionIndex": SpineAnimation }
    this.logoAnimationInProgress = false; // Флаг выполнения последовательности анимаций логотипа
    
    this.reelsContainer = new PIXI.Container();
    this.reelsContainer.zIndex = 100;
    this.reelsContainer.sortableChildren = true; // Включаем сортировку для работы zIndex у дочерних элементов (символы и индикаторы рилов)
    this.app.stage.addChild(this.reelsContainer);
    
    // Контейнер для эффектов поверх символов
    this.effectsContainer = new PIXI.Container();
    this.effectsContainer.zIndex = 200;
    this.app.stage.addChild(this.effectsContainer);
    
    // Контейнер для индикаторов монеток (отдельный на stage, чтобы маска не резала)
    this.coinIndicatorsContainer = new PIXI.Container();
    this.coinIndicatorsContainer.sortableChildren = true;
    this.coinIndicatorsContainer.x = 507; // Дефолтная позиция (настроено через дебаггер)
    this.coinIndicatorsContainer.y = 832; // Дефолтная позиция (настроено через дебаггер)
    this.coinIndicatorsContainer.zIndex = 104; // Под монетками (105), но над символами (100)
    this.app.stage.addChild(this.coinIndicatorsContainer);
    
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
    
    // Системы партиклов и эффектов
    this.particleSystem = null;
    this.collectEffect = null;
    
    // Генератор текста для выигрышей
    this.miniWinText = new MiniWinText();
    
    // Менеджер винлайнов
    this.winLineManager = null;
    
    // Менеджер монеток
    this.coinManager = null;
    
    // Менеджер коллекторов
    this.collectorManager = null;
    
    // Менеджер поезда
    this.trainManager = null;
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
    
    // Инициализируем менеджер поезда
    this.trainManager = new TrainManager(this.config, this.app, this.app.stage);
    await this.trainManager.init();
    
    // Загружаем Spine анимации (logo, winline и т.д.)
    await this.loadSpineAnimations();
    
    // Инициализируем систему партиклов (после загрузки поезда)
    if (this.trainManager && this.trainManager.isLoaded) {
      this.particleSystem = new ParticleSystem(this.app, this.app.stage);
      await this.particleSystem.init(this.trainManager.getSpineAnimation());
    }
    
    // Инициализируем collect effect (до CoinManager, чтобы передать ссылку)
    // Передаем trainManager для получения позиции поезда
    this.collectEffect = new CollectEffect(this.config, this.app, this.app.stage, this.trainManager);
    await this.collectEffect.init();
    
    // Загружаем шрифт Aclonica для текста на монетах ПЕРЕД созданием CoinManager
    // Очищаем кеш и ждем полной загрузки шрифта
    this.aclonicaText = new AclonicaText();
    await this.aclonicaText.loadFont();
    
    console.log('SlotMachine: Шрифт Aclonica загружен, кеш очищен');
    
    // Инициализируем менеджер монеток
    // Монетки добавляются в spineContainer, индикаторы - в coinIndicatorsContainer
    // Передаем уже загруженный aclonicaText и ссылку на collectEffect
    // Также передаем reelsContainer для индикаторов рилов (чтобы были под символами)
    this.coinManager = new CoinManager(this.config, this.app, this.spineContainer, this.coinIndicatorsContainer, this.aclonicaText, this.collectEffect, this.reelsContainer);
    // Синхронизируем с reelsContainer для учета сдвига от дебаггера (для монеток)
    this.coinManager.syncWithReelsContainer(this.reelsContainer);
    // Инициализируем статичные индикаторы монеток
    await this.coinManager.initIndicators();
    // Инициализируем индикаторы рилов
    await this.coinManager.initReelIndicators();
    
    // Инициализируем менеджер коллекторов
    // Передаем aclonicaText для отображения текста значений
    this.collectorManager = new CollectorManager(this.config, this.app, this.spineContainer, this.reelsContainer, this.aclonicaText);
    // Загружаем конфиг коллектора
    await this.collectorManager.loadConfig();
    // Устанавливаем ссылку на collectEffect для перелетов
    this.collectorManager.setCollectEffect(this.collectEffect);
    // Устанавливаем ссылку на miniWinText для показа выигрышей
    this.collectorManager.setMiniWinText(this.miniWinText);
    // Синхронизируем с reelsContainer для учета сдвига от дебаггера
    this.collectorManager.syncWithReelsContainer(this.reelsContainer);
    
    // Устанавливаем callback для поезда (первый перелет)
    if (this.collectEffect) {
      this.collectEffect.setOnHitCallback(() => {
        // Реакция поезда - проигрываем анимацию active
        if (this.trainManager) {
          this.trainManager.playActiveAnimation();
        }
        
        // Реакция частиц - всплеск монет
        if (this.particleSystem) {
          this.particleSystem.triggerHitBurst();
        }
        
        // Реакция логотипа - проигрываем анимацию
        this.playLogoAnimation();
      });
      
      // Устанавливаем отдельный callback для коллектора (второй перелет)
      this.collectEffect.setOnCollectorHitCallback((collectorInfo) => {
        // Реакция коллектора - проигрываем анимацию train_to_mult только для конкретного коллектора
        if (this.collectorManager && collectorInfo) {
          this.collectorManager.playHitAnimation(collectorInfo.reelIndex, collectorInfo.positionIndex);
        }
      });
    }
    
    // Инициализируем менеджер винлайнов
    if (this.config.spine && this.config.spine.winline && this.config.spine.winline.enabled) {
      this.winLineManager = new WinLineManager(this.config, this.app, this.app.stage);
      await this.winLineManager.init();
      
      // Сохраняем ссылку на reelsContainer для синхронизации
      // Позиционирование винлайнов будет выполнено после загрузки дебаггера
      // чтобы они получили тот же сдвиг, что и игровое поле
      this.winLineManager.syncWithReelsContainer(this.reelsContainer, this);
      
      // Передаем ссылку на CoinManager для управления прозрачностью индикаторов рилов
      if (this.coinManager) {
        this.winLineManager.setCoinManager(this.coinManager);
      }
      
      // Передаем ссылку на winFrameAnimation и reels для синхронизации
      // Это делается после initReels(), поэтому вызовем позже
    }
    
    this.initMode();
    this.initReels();
    this.drawGameAreaFrame();
    
    // После initReels() устанавливаем ссылки на winFrameAnimation и reels в WinLineManager
    if (this.winLineManager) {
      this.winLineManager.setWinFrameAnimation(this.winFrameAnimation, this.reels);
    }
    
    // Передаем ссылку на reels в CoinManager для скрытия/показа спрайтовых монеток
    if (this.coinManager) {
      this.coinManager.setReels(this.reels);
    }
    
    // Передаем ссылку на reels в CollectorManager для скрытия/показа спрайтовых коллекторов
    if (this.collectorManager) {
      this.collectorManager.setReels(this.reels);
    }
    
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
    
    // Позиционируем винлайны и показываем стартовый экран ПОСЛЕ загрузки дебаггера
    // чтобы они получили тот же сдвиг, что и игровое поле (дебаггер загружает настройки через 100ms)
    if (this.config.spine && this.config.spine.winline && this.config.spine.winline.enabled) {
      setTimeout(() => {
        // Позиционируем винлайны так, чтобы их 0,0 координата совпадала с центром игрового поля
        // Центр поля = начальная позиция поля + половина ширины/высоты + сдвиг от дебаггера
        const centerX = this.config.startPosition.x + this.gameAreaWidth / 2 + this.reelsContainer.x;
        const centerY = this.config.startPosition.y + this.gameAreaHeight / 2 + this.reelsContainer.y;
        const winlineSpine = this.winLineManager.getSpineAnimation();
        if (winlineSpine) {
          winlineSpine.setPosition(centerX, centerY);
          console.log(`SlotMachine: Winlines positioned at center of game field: (${centerX}, ${centerY})`);
        }
        
        // Обновляем позиции монеток (чтобы учесть сдвиг от дебаггера)
        if (this.coinManager) {
          this.coinManager.updateAllCoinPositions();
        }
        
        // Показываем стартовый экран
        this.showStartScreen();
      }, 200); // Задержка чтобы дебаггер успел применить сдвиги к reelsContainer
    } else {
      // Если винлайны отключены, все равно обновляем позиции монеток
      if (this.coinManager) {
        setTimeout(() => {
          this.coinManager.updateAllCoinPositions();
        }, 200);
      }
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
    // Поезд теперь управляется через TrainManager (инициализируется раньше)
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
  
  // Показывает стартовый экран (start_screen) на 2 секунды с затуханием
  async showStartScreen() {
    try {
      // Создаем отдельный одноразовый экземпляр Spine для start_screen
      const startScreenSpine = new SpineAnimation(
        this.config,
        this.app,
        this.app.stage,
        'winline',
        'start_screen',
        false // без зацикливания
      );
      
      const loaded = await startScreenSpine.load();
      if (!loaded) {
        console.warn('SlotMachine: Failed to load start_screen Spine');
        return;
      }
      
      // Позиционируем start_screen так, чтобы его 0,0 координата совпадала с центром игрового поля
      // Центр поля = начальная позиция поля + половина ширины/высоты + сдвиг от дебаггера
      const centerX = this.config.startPosition.x + this.gameAreaWidth / 2 + this.reelsContainer.x;
      const centerY = this.config.startPosition.y + this.gameAreaHeight / 2 + this.reelsContainer.y;
      startScreenSpine.setPosition(centerX, centerY);
      
      console.log(`SlotMachine: Start screen positioned at center of game field: (${centerX}, ${centerY})`);
      
      // Устанавливаем zIndex выше всего
      const container = startScreenSpine.getContainer();
      container.zIndex = 400; // Выше всего
      
      console.log('SlotMachine: Start screen shown');
      
      // Запускаем таймер сразу после установки позиции
      // Ждем 2 секунды показа, затем плавно скрываем
      const showDuration = 2000; // 2 секунды показа
      const fadeOutDuration = 1000; // 1 секунда затухания
      
      const startTime = Date.now();
      
      const checkAndFade = () => {
        const elapsed = Date.now() - startTime;
        
        if (elapsed < showDuration) {
          // Еще показываем - продолжаем проверку
          requestAnimationFrame(checkAndFade);
        } else if (elapsed < showDuration + fadeOutDuration) {
          // Начинаем затухание
          const fadeProgress = (elapsed - showDuration) / fadeOutDuration;
          container.alpha = 1 - fadeProgress;
          requestAnimationFrame(checkAndFade);
        } else {
          // Затухание завершено - удаляем
          container.alpha = 0;
          startScreenSpine.destroy();
          console.log('SlotMachine: Start screen faded out and removed');
        }
      };
      
      // Начинаем отсчет сразу после создания и позиционирования
      requestAnimationFrame(checkAndFade);
      
    } catch (error) {
      console.error('SlotMachine: Error showing start screen:', error);
    }
  }
  
  // Метод для запуска разовой анимации поезда при спине (использует TrainManager)
  playTrainSpinAnimation() {
    if (this.trainManager) {
      this.trainManager.playSpinAnimation();
    }
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
      // Передаем aclonicaText в рил для добавления текста на монетки
      if (this.aclonicaText) {
        reel.aclonicaText = this.aclonicaText;
      }
      reel.onSpinComplete = () => {
        this.checkAllReelsStopped();
      };
      reel.onReelStopped = (reelIndex) => {
        this.handleReelIndicator(reelIndex);
        
        // Проверяем событие "intriga" при остановке рила 1
        if (reelIndex === 1 && this.currentEvents && this.currentEvents.includes('intriga')) {
          this.showIntrigueCoins();
          this.showIntrigueCollectors();
          this.showIntrigueAnimation();
        }
        
        // Скрываем анимацию intrigue при остановке рила 2
        if (reelIndex === 2 && this.intrigueAnimation) {
          this.hideIntrigueAnimation();
        }
      };
      this.reels.push(reel);
    }
  }
  
  handleReelIndicator(reelIndex) {
    // Обрабатываем индикаторы для конкретного рила при его остановке
    // Монетки и коллекторы показываются только после остановки всех рилов в onAllReelsStopped
    if (!this.currentScenarioData) return;
    
    const scenarioData = this.currentScenarioData;
    const currentMatrix = scenarioData?.matrix || scenarioData; // Поддержка старого формата
    
    if (!currentMatrix || !Array.isArray(currentMatrix)) return;
    
    let hasCoin = false;
    let hasCollector = false;
    
    // Проверяем наличие монетки (индекс 8) или коллектора (индекс 10) на этом риле
    // Проверяем нижний видимый (currentMatrix[2]) -> positionIndex 0
    if (currentMatrix[2] && currentMatrix[2][reelIndex] === 8) hasCoin = true;
    if (currentMatrix[2] && currentMatrix[2][reelIndex] === 10) hasCollector = true;
    
    // Проверяем средний (currentMatrix[1]) -> positionIndex 1
    if (currentMatrix[1] && currentMatrix[1][reelIndex] === 8) hasCoin = true;
    if (currentMatrix[1] && currentMatrix[1][reelIndex] === 10) hasCollector = true;
    
    // Проверяем верхний видимый (currentMatrix[0]) -> positionIndex 2
    if (currentMatrix[0] && currentMatrix[0][reelIndex] === 8) hasCoin = true;
    if (currentMatrix[0] && currentMatrix[0][reelIndex] === 10) hasCollector = true;
    
    // Показываем или скрываем индикатор монетки под рилом
    // Индикаторы показываются если есть монетка ИЛИ коллектор (или оба)
    if (hasCoin || hasCollector) {
      this.coinManager.showIndicator(reelIndex);
      // Показываем индикатор рила (coin_indicator_reel) если есть монетка или коллектор
      this.coinManager.showReelIndicator(reelIndex);
    } else {
      this.coinManager.hideIndicator(reelIndex);
      // Скрываем индикатор рила если нет ни монетки, ни коллектора
      this.coinManager.hideReelIndicator(reelIndex);
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
    // Сдвиг маски на 22 пикселя для выравнивания с символами
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
    this.gameFrame.visible = false; // Контур скрыт
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
    
    // Останавливаем и скрываем винлайны перед новым спином
    if (this.winLineManager) {
      this.winLineManager.hideAllLines();
    }
    
    // Останавливаем winframe анимации
    if (this.winFrameAnimation) {
      this.winFrameAnimation.stop();
    }
    
    // Скрываем все монетки и индикаторы перед новым спином
    if (this.coinManager) {
      this.coinManager.hideAllCoins();
      // Скрываем win текст коллектора при начале нового спина
      if (this.collectorManager) {
        this.collectorManager.hideCollectorWinText();
      }
      this.coinManager.hideAllIndicators();
      this.coinManager.hideAllReelIndicators();
    }
    
    // Скрываем монетки и коллекторы интриги перед новым спином
    this.hideIntrigueCoins();
    this.hideIntrigueCollectors();
    
    // Скрываем все коллекторы перед новым спином
    if (this.collectorManager) {
      this.collectorManager.hideAllCollectors();
    }
    
    // Скрываем анимацию intrigue перед новым спином
    if (this.intrigueAnimation) {
      this.hideIntrigueAnimation();
    }
    
    // Получаем матрицу результатов из сценария (если есть)
    // Важно: получаем ПЕРЕД nextSpin(), чтобы использовать правильный спин
    let scenarioData = null;
    let events = null;
    if (this.config.scenarios && this.config.scenarios.enabled) {
      scenarioData = this.scenarios.getCurrentMatrix();
      events = this.scenarios.getCurrentEvents();
      if (scenarioData) {
        console.log(`Spin ${this.spinCount}: Using scenario matrix`, scenarioData.matrix, 'coinValues:', scenarioData.coinValues);
      }
    }
    
    // Сохраняем данные сценария для обработки индикаторов по рилам
    this.currentScenarioData = scenarioData;
    this.currentEvents = events; // Сохраняем события для использования в onReelStopped
    
    // Проверяем событие "intriga" и применяем специальные настройки для рилов
    const hasIntrigaEvent = events && events.includes('intriga');
    if (hasIntrigaEvent) {
      console.log('SlotMachine: Intriga event detected - applying special reel settings');
      
      // Применяем настройки для интриги из конфига
      if (this.config.intriga && this.config.intriga.reelConfigs) {
        this.config.intriga.reelConfigs.forEach((reelConfig, index) => {
          const reel = this.reels[index];
          if (reel && reelConfig) {
            // Сохраняем оригинальные настройки
            if (!reel.originalSpinOffset) {
              reel.originalSpinOffset = reel.spinOffset;
            }
            if (!reel.originalTotalSymbols) {
              reel.originalTotalSymbols = reel.totalSymbols;
            }
            
            // Применяем настройки для интриги
            if (reelConfig.spinOffset !== undefined) {
              reel.spinOffset = reelConfig.spinOffset;
            }
            if (reelConfig.totalSymbols !== undefined) {
              reel.updateTotalSymbols(reelConfig.totalSymbols);
            }
            
            console.log(`SlotMachine: Reel ${index} settings changed for intriga - spinOffset: ${reel.spinOffset}, totalSymbols: ${reel.totalSymbols}`);
          }
        });
      }
    } else {
      // Восстанавливаем оригинальные настройки, если они были изменены
      this.reels.forEach((reel, index) => {
        if (reel && reel.originalSpinOffset !== undefined) {
          reel.spinOffset = reel.originalSpinOffset;
          if (reel.originalTotalSymbols !== undefined) {
            reel.updateTotalSymbols(reel.originalTotalSymbols);
          }
          reel.originalSpinOffset = undefined;
          reel.originalTotalSymbols = undefined;
          console.log(`SlotMachine: Reel ${index} settings restored to original`);
        }
      });
    }
    
    this.isSpinning = true;
    this.spinCount++;
    
    // Запускаем разовую анимацию поезда при спине
    this.playTrainSpinAnimation();
    
    this.reels.forEach((reel, index) => {
      reel.startSpin(scenarioData?.matrix || null, scenarioData?.coinValues || null);
    });
    
    // Переходим к следующему спину в сценарии ПОСЛЕ запуска спинов
    // чтобы onAllReelsStopped использовал винлайны текущего (только что показанного) спина
    // и только потом переходили к следующему
    if (this.config.scenarios && this.config.scenarios.enabled) {
      // nextSpin() будет вызван ПОСЛЕ показа винлайнов в onAllReelsStopped
      // Но для матрицы мы уже использовали текущий спин, так что это нормально
    }
  }
  
  onAllReelsStopped() {
    this.isSpinning = false;
    
    // Получаем винлайны и события из сценария для ТЕКУЩЕГО спина (который только что показался)
    // Важно: делаем это ПЕРЕД nextSpin()
    const winLines = this.scenarios.getCurrentWinLines();
    const events = this.scenarios.getCurrentEvents();
    const scenarioData = this.scenarios.getCurrentMatrix(); // Теперь это объект { matrix, coinValues, collectorValue }
    const currentMatrix = scenarioData?.matrix || scenarioData; // Поддержка старого формата - просто массив
    const coinValues = scenarioData?.coinValues || null;
    const collectorValue = scenarioData?.collectorValue || null;
    
    // Устанавливаем флаги в CoinManager
    if (this.coinManager) {
      this.coinManager.setHasWinLines(winLines && winLines.length > 0);
      // Проверяем наличие события coin_collector и находим все позиции коллекторов
      const hasCoinCollectorEvent = events && events.includes('coin_collector');
      let collectorPositions = [];
      
      if (hasCoinCollectorEvent && currentMatrix && Array.isArray(currentMatrix)) {
        // Ищем все коллекторы (индекс 10) в матрице
        // currentMatrix[position][reelIndex]
        // position: 0 = верхний видимый, 1 = средний, 2 = нижний видимый
        // В сетке: positionIndex 0 = нижний, 1 = средний, 2 = верхний
        for (let position = 0; position < currentMatrix.length; position++) {
          for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
            if (currentMatrix[position] && currentMatrix[position][reelIndex] === 10) {
              // Преобразуем position в positionIndex для сетки
              // position 0 (верхний) -> positionIndex 2 (верхний)
              // position 1 (средний) -> positionIndex 1 (средний)
              // position 2 (нижний) -> positionIndex 0 (нижний)
              const positionIndex = 2 - position;
              collectorPositions.push({ reelIndex, positionIndex });
              console.log(`SlotMachine: Collector found at reelIndex ${reelIndex}, positionIndex ${positionIndex}`);
            }
          }
        }
      }
      
      this.coinManager.setHasCoinCollectorEvent(hasCoinCollectorEvent, collectorPositions);
      if (hasCoinCollectorEvent) {
        if (collectorPositions.length > 0) {
          console.log(`SlotMachine: Coin collector event detected - ${collectorPositions.length} collector(s) found, coins will play second shot and fly simultaneously to all collectors`);
        } else {
          console.warn('SlotMachine: Coin collector event detected but no collectors found in matrix');
        }
      }
    }
    
    // Скрываем монетки и коллекторы интриги после остановки всех рилов
    this.hideIntrigueCoins();
    this.hideIntrigueCollectors();
    
    // Проверяем матрицу на наличие монеток (индекс 8) и показываем их
    if (this.coinManager && currentMatrix && Array.isArray(currentMatrix)) {
      // currentMatrix[position][reelIndex]
      // position: 0 = верхний видимый, 1 = средний, 2 = нижний видимый
      // В сетке: positionIndex 0 = нижний, 1 = средний, 2 = верхний
      for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
        let hasCoin = false;
        let hasCollector = false;
        
        // Проверяем монетки (индекс 8)
        // Проверяем нижний видимый (currentMatrix[2]) -> positionIndex 0
        if (currentMatrix[2] && currentMatrix[2][reelIndex] === 8) {
          const coinValue = coinValues && coinValues[2] ? coinValues[2][reelIndex] : null;
          const formattedValue = coinValue !== null ? `${Math.round(coinValue)}х` : '5х';
          this.coinManager.showCoin(reelIndex, 0, 'regular', formattedValue);
          hasCoin = true;
        }
        // Проверяем средний (currentMatrix[1]) -> positionIndex 1
        if (currentMatrix[1] && currentMatrix[1][reelIndex] === 8) {
          const coinValue = coinValues && coinValues[1] ? coinValues[1][reelIndex] : null;
          const formattedValue = coinValue !== null ? `${Math.round(coinValue)}х` : '5х';
          this.coinManager.showCoin(reelIndex, 1, 'regular', formattedValue);
          hasCoin = true;
        }
        // Проверяем верхний видимый (currentMatrix[0]) -> positionIndex 2
        if (currentMatrix[0] && currentMatrix[0][reelIndex] === 8) {
          const coinValue = coinValues && coinValues[0] ? coinValues[0][reelIndex] : null;
          const formattedValue = coinValue !== null ? `${Math.round(coinValue)}х` : '5х';
          this.coinManager.showCoin(reelIndex, 2, 'regular', formattedValue);
          hasCoin = true;
        }
        
        // Проверяем коллекторы (индекс 10) и показываем их
        if (this.collectorManager) {
          // Берем значение коллектора из сценария (как для монеток)
          // Если collectorValue не указан, используем 0 (как fallback)
          const value = collectorValue !== null && collectorValue !== undefined ? collectorValue : 0;
          
          // Проверяем нижний видимый (currentMatrix[2]) -> positionIndex 0
          if (currentMatrix[2] && currentMatrix[2][reelIndex] === 10) {
            this.collectorManager.showCollector(reelIndex, 0, value);
            hasCollector = true;
          }
          // Проверяем средний (currentMatrix[1]) -> positionIndex 1
          if (currentMatrix[1] && currentMatrix[1][reelIndex] === 10) {
            this.collectorManager.showCollector(reelIndex, 1, value);
            hasCollector = true;
          }
          // Проверяем верхний видимый (currentMatrix[0]) -> positionIndex 2
          if (currentMatrix[0] && currentMatrix[0][reelIndex] === 10) {
            this.collectorManager.showCollector(reelIndex, 2, value);
            hasCollector = true;
          }
        }
        
      }
    }
    
    // Переходим к следующему спину в сценарии
    if (this.config.scenarios && this.config.scenarios.enabled) {
      this.scenarios.nextSpin();
    }
    
    // Показываем винлайны (если есть)
    // Winframes будут показаны автоматически внутри WinLineManager
    if (winLines && winLines.length > 0 && this.winLineManager) {
      // Проверяем, есть ли монетки на экране
      const hasCoins = this.coinManager && this.coinManager.hasActiveCoins();
      
      if (hasCoins) {
        // Если есть монетки, ждем завершения их полета и добавляем задержку 0.5 секунды
        console.log('SlotMachine: Coins detected, waiting for flight completion before showing win lines');
        this.waitForCoinFlightsAndShowWinLines(winLines);
      } else {
        // Если монеток нет, показываем винлайны с небольшой задержкой
        setTimeout(async () => {
          await this.winLineManager.showWinLines(winLines);
        }, 100);
      }
    }
    
    if (this.onSpinComplete) {
      this.onSpinComplete();
    }
  }

  /**
   * Ждет завершения полетов монеток и показывает винлайны с задержкой 0.5 секунды
   * @param {Array<number>} winLines - Массив номеров выигрышных линий
   */
  waitForCoinFlightsAndShowWinLines(winLines) {
    const checkInterval = 50; // Проверяем каждые 50мс
    const maxWaitTime = 5000; // Максимальное время ожидания 5 секунд
    const delayAfterFlights = 500; // Задержка 0.5 секунды после завершения полетов
    let elapsedTime = 0;

    const checkFlights = () => {
      const hasActiveFlights = this.collectEffect && this.collectEffect.hasActiveFlights();
      
      if (!hasActiveFlights || elapsedTime >= maxWaitTime) {
        // Все полеты завершены или превышено время ожидания
        console.log(`SlotMachine: Coin flights completed (or timeout), showing win lines after ${delayAfterFlights}ms delay`);
        setTimeout(async () => {
          await this.winLineManager.showWinLines(winLines);
        }, delayAfterFlights);
      } else {
        // Продолжаем проверку
        elapsedTime += checkInterval;
        setTimeout(checkFlights, checkInterval);
      }
    };

    // Начинаем проверку
    setTimeout(checkFlights, checkInterval);
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
  
  /**
   * Показывает анимированный выигрыш (будет использоваться позже)
   * @param {number} amount - Сумма выигрыша
   * @param {object} position - Позиция {x, y} (опционально)
   * @returns {PIXI.Sprite} Спрайт с текстом выигрыша
   */
  showWinAmount(amount, position = null) {
    const pos = position || {
      x: this.config.resolution.width / 2,
      y: this.config.resolution.height / 2
    };
    
    const winText = this.miniWinText.createAnimatedGoldenText(
      amount,
      pos,
      { fontSize: 120, padding: 40 }
    );
    
    winText.zIndex = 400; // Выше всего
    this.app.stage.addChild(winText);
    
    // Простая анимация появления
    const startTime = Date.now();
    const duration = 600; // 600ms
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out back функция
      const easeOutBack = (t) => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      };
      
      const eased = easeOutBack(progress);
      
      winText.scale.set(eased);
      winText.alpha = progress;
      winText.rotation = -0.1 * (1 - progress);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Анимация завершена, через 2 секунды начинаем исчезновение
        setTimeout(() => {
          const fadeStart = Date.now();
          const fadeDuration = 500;
          
          const fade = () => {
            const fadeElapsed = Date.now() - fadeStart;
            const fadeProgress = Math.min(fadeElapsed / fadeDuration, 1);
            
            winText.scale.set(1 + fadeProgress * 0.2);
            winText.alpha = 1 - fadeProgress;
            winText.y = pos.y - fadeProgress * 100;
            
            if (fadeProgress < 1) {
              requestAnimationFrame(fade);
            } else {
              this.app.stage.removeChild(winText);
              winText.destroy();
            }
          };
          
          requestAnimationFrame(fade);
        }, 2000);
      }
    };
    
    requestAnimationFrame(animate);
    
    return winText;
  }
  
  async showIntrigueAnimation() {
    if (this.intrigueAnimation) {
      // Если анимация уже существует, плавно показываем её
      const container = this.intrigueAnimation.getContainer();
      container.visible = true;
      
      // Плавное появление через альфа-канал
      const fadeInDuration = 300; // 300ms для появления
      const startTime = performance.now();
      container.alpha = 0;
      
      const fadeIn = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / fadeInDuration, 1);
        container.alpha = progress;
        
        if (progress < 1) {
          requestAnimationFrame(fadeIn);
        }
      };
      
      requestAnimationFrame(fadeIn);
      return;
    }
    
    try {
      // Получаем позицию рила 2
      const reel2 = this.reels[2];
      if (!reel2) {
        console.warn('SlotMachine: Cannot show intrigue animation - reel 2 not found');
        return;
      }
      
      const reel2X = reel2.reelContainer.x;
      const reel2Y = reel2.reelContainer.y;
      
      // Создаем анимацию intrigue
      this.intrigueAnimation = new SpineAnimation(
        this.config,
        this.app,
        this.spineContainer,
        'intrigue',
        'animation', // имя анимации из skeleton.json
        true // loop = true
      );
      
      const loaded = await this.intrigueAnimation.load();
      if (loaded) {
        // Устанавливаем позицию поверх рила 2
        // Центрируем по горизонтали рила (ширина символа / 2)
        const symbolWidth = this.config.symbolSize.width;
        const symbolHeight = this.config.symbolSize.height;
        const visibleSymbols = this.config.reels.symbolsPerReel;
        
        // Центрируем по вертикали: центр видимой области рила + 22 пикселя вниз
        const reelHeight = visibleSymbols * symbolHeight;
        const intrigueX = reel2X + symbolWidth / 2;
        const intrigueY = reel2Y + reelHeight / 2 + 22;
        
        this.intrigueAnimation.setPosition(intrigueX, intrigueY);
        
        // Устанавливаем zIndex выше рилов
        const container = this.intrigueAnimation.getContainer();
        container.zIndex = 110; // Выше рилов (zIndex = 100)
        container.alpha = 0; // Начинаем с прозрачности
        container.visible = true;
        
        // Плавное появление через альфа-канал
        const fadeInDuration = 300; // 300ms для появления
        const startTime = performance.now();
        
        const fadeIn = () => {
          const elapsed = performance.now() - startTime;
          const progress = Math.min(elapsed / fadeInDuration, 1);
          container.alpha = progress;
          
          if (progress < 1) {
            requestAnimationFrame(fadeIn);
          }
        };
        
        requestAnimationFrame(fadeIn);
        
        console.log(`SlotMachine: Intrigue animation shown at (${intrigueX}, ${intrigueY})`);
      } else {
        console.error('SlotMachine: Failed to load intrigue animation');
        this.intrigueAnimation = null;
      }
    } catch (error) {
      console.error('SlotMachine: Error showing intrigue animation:', error);
      this.intrigueAnimation = null;
    }
  }
  
  hideIntrigueAnimation() {
    if (this.intrigueAnimation) {
      const container = this.intrigueAnimation.getContainer();
      
      // Плавное исчезновение через альфа-канал
      const fadeOutDuration = 300; // 300ms для исчезновения
      const startTime = performance.now();
      const startAlpha = container.alpha;
      
      const fadeOut = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / fadeOutDuration, 1);
        container.alpha = startAlpha * (1 - progress);
        
        if (progress < 1) {
          requestAnimationFrame(fadeOut);
        } else {
          // После завершения затухания скрываем контейнер
          container.visible = false;
          container.alpha = 0;
          console.log('SlotMachine: Intrigue animation hidden');
        }
      };
      
      requestAnimationFrame(fadeOut);
    }
  }
  
  /**
   * Вычисляет позицию для монетки на сетке (аналогично CoinManager.getGridPosition)
   * @param {number} reelIndex - Индекс рила (0, 1, 2)
   * @param {number} positionIndex - Индекс позиции (0=нижний, 1=средний, 2=верхний видимый)
   * @returns {object} {x, y} - Координаты центра ячейки
   */
  getGridPosition(reelIndex, positionIndex) {
    const startX = this.config.startPosition.x;
    const startY = this.config.startPosition.y;
    const symbolWidth = this.config.symbolSize.width;
    const symbolHeight = this.config.symbolSize.height;

    // Учитываем сдвиг от дебаггера (если reelsContainer сдвинут)
    const offsetX = this.reelsContainer ? this.reelsContainer.x : 0;
    const offsetY = this.reelsContainer ? this.reelsContainer.y : 0;

    // positionIndex: 0 = нижний видимый (второй ряд), 1 = средний, 2 = верхний
    // Инвертируем positionIndex для Y: нижний (0) должен быть ниже (больший Y), верхний (2) - выше (меньший Y)
    const maxPositionIndex = this.config.reels.symbolsPerReel - 1; // 2 (для 3 позиций: 0, 1, 2)
    const invertedPositionIndex = maxPositionIndex - positionIndex; // 0->2 (нижний), 1->1 (средний), 2->0 (верхний)
    
    const x = startX + (reelIndex * symbolWidth) + (symbolWidth / 2) + offsetX;
    const y = startY + (invertedPositionIndex * symbolHeight) + (symbolHeight / 2) + offsetY;

    return { x, y };
  }
  
  /**
   * Показывает отдельные экземпляры Spine монет для интриги (играют anticipation)
   */
  async showIntrigueCoins() {
    if (!this.currentScenarioData || !this.coinManager) {
      return;
    }
    
    const scenarioData = this.currentScenarioData;
    const currentMatrix = scenarioData?.matrix || scenarioData;
    const coinValues = scenarioData?.coinValues || null;
    
    if (!currentMatrix || !Array.isArray(currentMatrix)) {
      return;
    }
    
    // Показываем монетки (индекс 8) из матрицы
    // НЕ показываем на риле 2, так как там происходит вращение во время интриги
    for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
      // Пропускаем рил 2
      if (reelIndex === 2) {
        continue;
      }
      
      // Проверяем нижний видимый (currentMatrix[2]) -> positionIndex 0
      if (currentMatrix[2] && currentMatrix[2][reelIndex] === 8) {
        await this.createIntrigueCoin(reelIndex, 0, coinValues ? coinValues[2]?.[reelIndex] : null);
      }
      // Проверяем средний (currentMatrix[1]) -> positionIndex 1
      if (currentMatrix[1] && currentMatrix[1][reelIndex] === 8) {
        await this.createIntrigueCoin(reelIndex, 1, coinValues ? coinValues[1]?.[reelIndex] : null);
      }
      // Проверяем верхний видимый (currentMatrix[0]) -> positionIndex 2
      if (currentMatrix[0] && currentMatrix[0][reelIndex] === 8) {
        await this.createIntrigueCoin(reelIndex, 2, coinValues ? coinValues[0]?.[reelIndex] : null);
      }
    }
    
    console.log('SlotMachine: Intrigue coins shown with anticipation animation');
  }
  
  /**
   * Создает отдельный экземпляр Spine монетки для интриги
   * @param {number} reelIndex - Индекс рила
   * @param {number} positionIndex - Индекс позиции
   * @param {number|null} coinValue - Значение монетки
   */
  async createIntrigueCoin(reelIndex, positionIndex, coinValue) {
    const key = `${reelIndex}_${positionIndex}`;
    
    // Если монетка уже существует, просто показываем её
    if (this.intrigueCoins[key]) {
      const container = this.intrigueCoins[key].getContainer();
      container.visible = true;
      if (this.intrigueCoins[key].spine && this.intrigueCoins[key].spine.state) {
        this.intrigueCoins[key].spine.state.setAnimation(0, 'anticipation', true);
      }
      return;
    }
    
    // Создаем новый экземпляр Spine монетки
    const position = this.getGridPosition(reelIndex, positionIndex);
    
    const coinSpine = new SpineAnimation(
      this.config,
      this.app,
      this.spineContainer,
      'coin',
      'anticipation', // Начинаем с anticipation анимации
      true // loop = true
    );

    const loaded = await coinSpine.load();
    if (!loaded) {
      console.warn(`SlotMachine: Failed to load intrigue coin Spine at ${key}`);
      return;
    }

    // Устанавливаем скин
    if (coinSpine.spine && coinSpine.spine.skeleton) {
      coinSpine.spine.skeleton.setSkinByName('regular');
    }

    // Устанавливаем позицию
    coinSpine.setPosition(position.x, position.y);

    // Устанавливаем zIndex (над символами, но под winframes)
    const container = coinSpine.getContainer();
    container.zIndex = 105; // Символы = 100, монетки = 105, winframes = 110
    container.visible = true;

    // Добавляем текст в слот text_holder (используем те же параметры, что и в CoinManager)
    const formattedValue = coinValue !== null ? `${Math.round(coinValue)}х` : '5х';
    if (coinSpine.spine && this.coinManager && this.coinManager.aclonicaText) {
      const textSlot = coinSpine.spine.skeleton.findSlot('text_holder');
      if (textSlot) {
        const textSprite = this.coinManager.aclonicaText.createText(formattedValue, {
          fontSize: 45,
          lineHeight: 52,
          color: '#FFFFFF',
          borderColor: '#6B0060',
          borderWidth: 4
        });
        if (textSprite) {
          // Центрируем текст (anchor в центре)
          textSprite.anchor.set(0.5);
          coinSpine.spine.addSlotObject('text_holder', textSprite);
        }
      }
    }

    this.intrigueCoins[key] = coinSpine;
    console.log(`SlotMachine: Intrigue coin created at ${key} with value ${formattedValue}`);
  }
  
  /**
   * Скрывает и уничтожает все монетки интриги
   */
  hideIntrigueCoins() {
    Object.entries(this.intrigueCoins).forEach(([key, coinSpine]) => {
      if (coinSpine) {
        // Очищаем все треки и listeners перед уничтожением
        if (coinSpine.spine && coinSpine.spine.state) {
          const state = coinSpine.spine.state;
          // Очищаем все listeners
          if (state.tracks) {
            state.tracks.forEach((track, index) => {
              if (track && track.entry) {
                const entry = track.entry;
                if (entry.listener) {
                  entry.listener = null;
                }
              }
            });
          }
          // Очищаем все треки
          state.clearTracks();
          
          // Удаляем текст из слота (если есть)
          try {
            coinSpine.spine.removeSlotObject('text_holder');
          } catch (e) {
            // Игнорируем ошибки, если слот не существует
          }
        }
        
        // Удаляем контейнер из stage
        if (coinSpine.getContainer) {
          const container = coinSpine.getContainer();
          if (container && container.parent) {
            container.parent.removeChild(container);
          }
        }
        
        // Уничтожаем Spine экземпляр
        if (coinSpine.destroy) {
          coinSpine.destroy();
        }
      }
    });
    
    // Очищаем объект
    this.intrigueCoins = {};
    console.log('SlotMachine: Intrigue coins hidden and destroyed');
  }
  
  /**
   * Показывает отдельные экземпляры Spine коллекторов для интриги (играют anticipation или idle)
   */
  async showIntrigueCollectors() {
    if (!this.currentScenarioData || !this.collectorManager) {
      return;
    }
    
    const scenarioData = this.currentScenarioData;
    const currentMatrix = scenarioData?.matrix || scenarioData;
    const collectorValue = scenarioData?.collectorValue || null;
    
    if (!currentMatrix || !Array.isArray(currentMatrix)) {
      return;
    }
    
    // Показываем коллекторы (индекс 10) из матрицы
    // НЕ показываем на риле 2, так как там происходит вращение во время интриги
    for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
      // Пропускаем рил 2
      if (reelIndex === 2) {
        continue;
      }
      
      // Проверяем нижний видимый (currentMatrix[2]) -> positionIndex 0
      if (currentMatrix[2] && currentMatrix[2][reelIndex] === 10) {
        await this.createIntrigueCollector(reelIndex, 0, collectorValue);
      }
      // Проверяем средний (currentMatrix[1]) -> positionIndex 1
      if (currentMatrix[1] && currentMatrix[1][reelIndex] === 10) {
        await this.createIntrigueCollector(reelIndex, 1, collectorValue);
      }
      // Проверяем верхний видимый (currentMatrix[0]) -> positionIndex 2
      if (currentMatrix[0] && currentMatrix[0][reelIndex] === 10) {
        await this.createIntrigueCollector(reelIndex, 2, collectorValue);
      }
    }
    
    console.log('SlotMachine: Intrigue collectors shown with anticipation/idle animation');
  }
  
  /**
   * Создает отдельный экземпляр Spine коллектора для интриги
   * @param {number} reelIndex - Индекс рила
   * @param {number} positionIndex - Индекс позиции
   * @param {number|null} collectorValue - Значение коллектора
   */
  async createIntrigueCollector(reelIndex, positionIndex, collectorValue) {
    const key = `${reelIndex}_${positionIndex}`;
    
    // Если коллектор уже существует, просто показываем его
    if (this.intrigueCollectors[key]) {
      const container = this.intrigueCollectors[key].getContainer();
      container.visible = true;
      if (this.intrigueCollectors[key].spine && this.intrigueCollectors[key].spine.state) {
        // Пробуем установить anticipation, если нет - используем idle
        const spine = this.intrigueCollectors[key].spine;
        const hasAnticipation = spine.state.data.skeletonData.animations.some(
          anim => anim.name === 'anticipation'
        );
        if (hasAnticipation) {
          spine.state.setAnimation(0, 'anticipation', true);
        } else {
          spine.state.setAnimation(0, 'idle', true);
        }
      }
      return;
    }
    
    // Создаем новый экземпляр Spine коллектора
    const position = this.getGridPosition(reelIndex, positionIndex);
    
    // Используем конфиг коллектора из CollectorManager
    const spineName = this.collectorManager && this.collectorManager.collectorConfig 
      ? this.collectorManager.collectorConfig.spineName 
      : 'coin_collector';
    
    const collectorSpine = new SpineAnimation(
      this.config,
      this.app,
      this.spineContainer,
      spineName,
      null, // Начальная анимация будет установлена после загрузки
      false
    );

    const loaded = await collectorSpine.load();
    if (!loaded) {
      console.warn(`SlotMachine: Failed to load intrigue collector Spine at ${key}`);
      return;
    }

    // Устанавливаем масштаб из конфига коллектора
    if (this.collectorManager && this.collectorManager.collectorConfig && this.collectorManager.collectorConfig.scale) {
      const container = collectorSpine.getContainer();
      container.scale.x = this.collectorManager.collectorConfig.scale.x;
      container.scale.y = this.collectorManager.collectorConfig.scale.y;
    }

    // Устанавливаем позицию
    collectorSpine.setPosition(position.x, position.y);

    // Устанавливаем zIndex (над символами, но под winframes)
    const container = collectorSpine.getContainer();
    const zIndex = this.collectorManager && this.collectorManager.collectorConfig 
      ? this.collectorManager.collectorConfig.zIndex 
      : 105;
    container.zIndex = zIndex;
    container.visible = true;

    // Пробуем установить anticipation, если нет - используем idle
    if (collectorSpine.spine && collectorSpine.spine.state) {
      const hasAnticipation = collectorSpine.spine.state.data.skeletonData.animations.some(
        anim => anim.name === 'anticipation'
      );
      if (hasAnticipation) {
        collectorSpine.spine.state.setAnimation(0, 'anticipation', true);
      } else {
        collectorSpine.spine.state.setAnimation(0, 'idle', true);
      }
    }

    // Добавляем текст в слот text_holder (используем те же параметры, что и в CollectorManager)
    const formattedValue = collectorValue !== null && collectorValue !== undefined 
      ? `${Math.round(collectorValue)}х` 
      : '0х';
    if (collectorSpine.spine && this.collectorManager && this.collectorManager.aclonicaText) {
      const textSlot = collectorSpine.spine.skeleton.findSlot('text_holder');
      if (textSlot) {
        const textSprite = this.collectorManager.aclonicaText.createText(formattedValue, {
          fontSize: 45,
          lineHeight: 52,
          color: '#FFFFFF',
          borderColor: '#6B0060',
          borderWidth: 4
        });
        if (textSprite) {
          // Центрируем текст (anchor в центре)
          textSprite.anchor.set(0.5);
          collectorSpine.spine.addSlotObject('text_holder', textSprite);
          
          // Устанавливаем обновление альфы текста синхронно с альфой слота (как в CollectorManager)
          if (!collectorSpine._textAlphaUpdateSet) {
            collectorSpine._textAlphaUpdateSet = new Set();
            const originalAfterUpdate = collectorSpine.spine.afterUpdateWorldTransforms;
            collectorSpine.spine.afterUpdateWorldTransforms = () => {
              if (originalAfterUpdate) {
                originalAfterUpdate.call(collectorSpine.spine);
              }
              collectorSpine._textAlphaUpdateSet.forEach(updateFn => updateFn());
            };
          }
          
          const updateTextAlpha = () => {
            if (textSlot && textSlot.color && textSprite) {
              textSprite.alpha = textSlot.color.a;
            }
          };
          collectorSpine._textAlphaUpdateSet.add(updateTextAlpha);
          updateTextAlpha();
        }
      }
    }

    this.intrigueCollectors[key] = collectorSpine;
    console.log(`SlotMachine: Intrigue collector created at ${key} with value ${formattedValue}`);
  }
  
  /**
   * Скрывает и уничтожает все коллекторы интриги
   */
  hideIntrigueCollectors() {
    Object.entries(this.intrigueCollectors).forEach(([key, collectorSpine]) => {
      if (collectorSpine) {
        // Очищаем все треки и listeners перед уничтожением
        if (collectorSpine.spine && collectorSpine.spine.state) {
          const state = collectorSpine.spine.state;
          // Очищаем все listeners
          if (state.tracks) {
            state.tracks.forEach((track, index) => {
              if (track && track.entry) {
                const entry = track.entry;
                if (entry.listener) {
                  entry.listener = null;
                }
              }
            });
          }
          // Очищаем все треки
          state.clearTracks();
          
          // Удаляем текст из слота (если есть)
          try {
            collectorSpine.spine.removeSlotObject('text_holder');
          } catch (e) {
            // Игнорируем ошибки, если слот не существует
          }
          
          // Удаляем функцию обновления альфы, если она была установлена
          if (collectorSpine._textAlphaUpdateSet) {
            collectorSpine._textAlphaUpdateSet.clear();
            delete collectorSpine._textAlphaUpdateSet;
          }
        }
        
        // Удаляем контейнер из stage
        if (collectorSpine.getContainer) {
          const container = collectorSpine.getContainer();
          if (container && container.parent) {
            container.parent.removeChild(container);
          }
        }
        
        // Уничтожаем Spine экземпляр
        if (collectorSpine.destroy) {
          collectorSpine.destroy();
        }
      }
    });
    
    // Очищаем объект
    this.intrigueCollectors = {};
    console.log('SlotMachine: Intrigue collectors hidden and destroyed');
  }
  
  /**
   * Проигрывает анимацию win логотипа при перелете монетки в поезд
   */
  playLogoAnimation() {
    if (!this.spineAnimations || !this.spineAnimations.logo) {
      return;
    }
    
    const logoAnimation = this.spineAnimations.logo;
    if (!logoAnimation || !logoAnimation.spine || !logoAnimation.spine.state) {
      return;
    }
    
    // Если последовательность уже выполняется, не запускаем повторно
    if (this.logoAnimationInProgress) {
      console.log('SlotMachine: Logo animation already in progress, skipping');
      return;
    }
    
    // Устанавливаем флаг выполнения
    this.logoAnimationInProgress = true;
    
    // Проигрываем win на треке 0 (простой способ как в basic_copy.html)
    const trackEntry = logoAnimation.spine.state.setAnimation(0, 'win', false);
    if (trackEntry) {
      trackEntry.listener = {
        complete: () => {
          // После завершения win возвращаемся к idle в цикле
          if (logoAnimation.spine && logoAnimation.spine.state) {
            logoAnimation.spine.state.setAnimation(0, 'idle', true);
            console.log('SlotMachine: Logo animation "win" completed, returning to idle');
          }
          // Сбрасываем флаг
          this.logoAnimationInProgress = false;
        }
      };
      console.log('SlotMachine: Playing logo animation "win" on track 0');
    } else {
      console.warn('SlotMachine: Failed to play logo animation "win"');
      // В случае ошибки возвращаемся к idle
      if (logoAnimation.spine && logoAnimation.spine.state) {
        logoAnimation.spine.state.setAnimation(0, 'idle', true);
      }
      // Сбрасываем флаг
      this.logoAnimationInProgress = false;
    }
  }
}

