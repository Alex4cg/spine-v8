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
    
    this.reelsContainer = new PIXI.Container();
    this.reelsContainer.zIndex = 100;
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
    
    // Устанавливаем callback для реакции поезда и частиц на прилет монет
    this.collectEffect.setOnHitCallback(() => {
      // Реакция поезда - проигрываем анимацию active
      if (this.trainManager) {
        this.trainManager.playActiveAnimation();
      }
      
      // Реакция частиц - всплеск монет
      if (this.particleSystem) {
        this.particleSystem.triggerHitBurst();
      }
    });
    
    // Загружаем шрифт Aclonica для текста на монетах ПЕРЕД созданием CoinManager
    // Очищаем кеш и ждем полной загрузки шрифта
    this.aclonicaText = new AclonicaText();
    await this.aclonicaText.loadFont();
    
    console.log('SlotMachine: Шрифт Aclonica загружен, кеш очищен');
    
    // Инициализируем менеджер монеток
    // Монетки добавляются в spineContainer, индикаторы - в coinIndicatorsContainer
    // Передаем уже загруженный aclonicaText и ссылку на collectEffect
    this.coinManager = new CoinManager(this.config, this.app, this.spineContainer, this.coinIndicatorsContainer, this.aclonicaText, this.collectEffect);
    // Синхронизируем с reelsContainer для учета сдвига от дебаггера (для монеток)
    this.coinManager.syncWithReelsContainer(this.reelsContainer);
    // Инициализируем статичные индикаторы
    await this.coinManager.initIndicators();
    
    // Инициализируем менеджер винлайнов
    if (this.config.spine && this.config.spine.winline && this.config.spine.winline.enabled) {
      this.winLineManager = new WinLineManager(this.config, this.app, this.app.stage);
      await this.winLineManager.init();
      
      // Сохраняем ссылку на reelsContainer для синхронизации
      // Позиционирование винлайнов будет выполнено после загрузки дебаггера
      // чтобы они получили тот же сдвиг, что и игровое поле
      this.winLineManager.syncWithReelsContainer(this.reelsContainer, this);
      
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
      this.coinManager.hideAllIndicators();
    }
    
    // Получаем матрицу результатов из сценария (если есть)
    // Важно: получаем ПЕРЕД nextSpin(), чтобы использовать правильный спин
    let scenarioData = null;
    if (this.config.scenarios && this.config.scenarios.enabled) {
      scenarioData = this.scenarios.getCurrentMatrix();
      if (scenarioData) {
        console.log(`Spin ${this.spinCount}: Using scenario matrix`, scenarioData.matrix, 'coinValues:', scenarioData.coinValues);
      }
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
    
    // Получаем винлайны из сценария для ТЕКУЩЕГО спина (который только что показался)
    // Важно: делаем это ПЕРЕД nextSpin()
    const winLines = this.scenarios.getCurrentWinLines();
    const scenarioData = this.scenarios.getCurrentMatrix(); // Теперь это объект { matrix, coinValues }
    const currentMatrix = scenarioData?.matrix || scenarioData; // Поддержка старого формата - просто массив
    const coinValues = scenarioData?.coinValues || null;
    
    // Проверяем матрицу на наличие монеток (индекс 8) и показываем их
    if (this.coinManager && currentMatrix && Array.isArray(currentMatrix)) {
      // currentMatrix[position][reelIndex]
      // position: 0 = верхний видимый, 1 = средний, 2 = нижний видимый
      // В сетке: positionIndex 0 = нижний, 1 = средний, 2 = верхний
      for (let reelIndex = 0; reelIndex < this.config.reels.count; reelIndex++) {
        let hasCoin = false;
        
        // Проверяем нижний видимый (currentMatrix[2]) -> positionIndex 0
        if (currentMatrix[2] && currentMatrix[2][reelIndex] === 8) {
          const coinValue = coinValues && coinValues[2] ? coinValues[2][reelIndex] : null;
          this.coinManager.showCoin(reelIndex, 0, 'regular', coinValue !== null ? coinValue.toFixed(2) : '5.00');
          hasCoin = true;
        }
        // Проверяем средний (currentMatrix[1]) -> positionIndex 1
        if (currentMatrix[1] && currentMatrix[1][reelIndex] === 8) {
          const coinValue = coinValues && coinValues[1] ? coinValues[1][reelIndex] : null;
          this.coinManager.showCoin(reelIndex, 1, 'regular', coinValue !== null ? coinValue.toFixed(2) : '5.00');
          hasCoin = true;
        }
        // Проверяем верхний видимый (currentMatrix[0]) -> positionIndex 2
        if (currentMatrix[0] && currentMatrix[0][reelIndex] === 8) {
          const coinValue = coinValues && coinValues[0] ? coinValues[0][reelIndex] : null;
          this.coinManager.showCoin(reelIndex, 2, 'regular', coinValue !== null ? coinValue.toFixed(2) : '5.00');
          hasCoin = true;
        }
        
        // Показываем или скрываем индикатор под рилом
        if (hasCoin) {
          this.coinManager.showIndicator(reelIndex);
        } else {
          this.coinManager.hideIndicator(reelIndex);
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
      // Небольшая задержка перед показом винлайнов
      setTimeout(async () => {
        await this.winLineManager.showWinLines(winLines);
      }, 100);
    }
    
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
}

