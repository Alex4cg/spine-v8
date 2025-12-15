// Конфигурация слота
export const SLOT_CONFIG = {
  // Фиксированное разрешение
  resolution: { width: 1920, height: 1080 },
  
  // Количество барабанов и символов
  reels: { 
    count: 3, 
    symbolsPerReel: 3,
    // Опционально: индивидуальная конфигурация для каждого рила
    // Если не задано, используются значения по умолчанию (spinOffset=max, totalSymbols=40)
    // Пример: разные смещения для каждого рила (5, 6, 7, 8, 9)
    reelConfigs: [
      { spinOffset: 7, totalSymbols: 20 },  // рил 0: смещение 5, всего 20 символов
      { spinOffset: 8, totalSymbols: 20 },  // рил 1: смещение 6, всего 25 символов
      { spinOffset: 9, totalSymbols: 20 },  // рил 2: смещение 7, всего 30 символов
      { spinOffset: 10, totalSymbols: 20 },  // рил 3: смещение 8, всего 35 символов
      { spinOffset: 11, totalSymbols: 20 },  // рил 4: смещение 9, всего 40 символов
    ]
  },
  
  // Режим игры: 'classic' или 'holdnwin'
  gameMode: 'classic',
  
  // Настройки спина
  spinDuration: { min: 2000, max: 3000 },
  reelStopDelay: 200, // задержка между остановками барабанов (мс)
  
  // Настройки анимации барабанов
  reelAnimation: {
    accelerationTime: 100, // время разгона в миллисекундах (0.5 сек)
    decelerationTime: 300, // время торможения в миллисекундах (0.5 сек)
    linearSpeed: 15, // скорость линейного движения (символов в секунду)
  },
  
  // Лимит спинов для тестирования
  maxSpins: 30,
  
  // Размеры символов (размер плейсхолдера для сетки)
  symbolSize: { width: 302, height: 166 },
  
  // Показать отладочную рамку плейсхолдеров (для визуализации сетки)
  showPlaceholderDebug: false,
  
  // Расстояние между барабанами (0 = вплотную)
  reelSpacing: 0,
  
  // Позиция начала барабанов (центрирование)
  startPosition: { x: 0, y: 0 }, // будет вычисляться автоматически
  
  // Путь к папке с текстурами символов
  symbolTexturesPath: './sym_st/',
  
  // Список файлов текстур (загружаются автоматически)
  symbolTextureFiles: [
    'h1_diamond.png',
    'h2_gold.png',
    'h3_silver.png',
    'h4_copper.png',
    'l1_watermelon.png',
    'l2_grape.png',
    'l3_lemon.png',
    'l4_cherry.png',
    'regular_coin_empty.png',
    'wild.png',
  ],
  
  // Массив загруженных текстур (заполняется автоматически)
  symbolTextures: [],
  
  // Настройки анимации winframe
  winFrameAnimation: {
    atlasPath: './atlas/winframe_60_fps/winframe_60_fps.json',
    frameCount: 60,
    animationSpeed: 1.0, // 60 fps (1.0 = 60 кадров в секунду)
    loop: false // проиграть 1 раз
  },
  
  // Настройки сценариев игры
  scenarios: {
    enabled: true, // включить систему сценариев
    scenarioPath: './matrix/scenario.json' // путь к файлу сценария
  },
  
  // Настройки Spine анимаций
  spine: {
    train: {
      enabled: true, // включить поезд
      animationName: '00_idle', // имя анимации для проигрывания
      loop: true, // зациклить анимацию
      position: { x: 0, y: 0 }, // позиция (будет установлена автоматически)
      scale: { x: 1, y: 1 }, // масштаб
      zIndex: 90 // порядок отрисовки (из debug_positions.json)
    },
    logo: {
      enabled: true, // включить логотип
      animationName: 'idle', // имя анимации для проигрывания (или первая доступная)
      loop: true, // зациклить анимацию
      position: { x: 0, y: 0 }, // позиция (будет установлена автоматически)
      scale: { x: 1, y: 1 }, // масштаб
      zIndex: 250 // порядок отрисовки (выше эффектов)
    },
    winline: {
      enabled: true, // включить винлайны
      position: { x: 960, y: 540 }, // позиция (будет настроена через дебаггер)
      scale: 1,
      zIndex: 99 // под символами (символы zIndex = 100)
    }
  },
  
  // Настройки отладки
  debug: {
    positionEditor: true, // включить отладчик позиции
    positionsFilePath: './debug_position/debug_positions.json' // путь к файлу с настройками позиций
  },
  
  // Настройки кнопки спин
  spinButton: {
    texturesPath: './ui/spn_btn/',
    textures: {
      default: 'spin_default.png',
      disabled: 'spin_disabled.png',
      hover: 'spin_hover.png',
      pressed: 'spin_pressed.png'
    },
    position: { x: 1759, y: 571 }, // позиция кнопки (из debug_positions.json)
    zIndex: 300 // порядок отрисовки (выше всего)
  }
};

