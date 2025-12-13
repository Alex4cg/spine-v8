export class SpinButton {
  constructor(config, app, onSpinClick) {
    this.config = config;
    this.app = app;
    this.onSpinClick = onSpinClick;
    this.container = null; // Контейнер для обоих спрайтов
    this.button = null; // Интерактивный спрайт (default/hover/pressed)
    this.disabledButton = null; // Отдельный спрайт для disabled состояния
    this.textures = {};
    this.currentState = 'default';
    this.isDisabled = false;
    
    this.init();
  }
  
  async init() {
    // Загружаем текстуры
    await this.loadTextures();
    
    const posX = this.config.spinButton.position.x;
    const posY = this.config.spinButton.position.y;
    const zIndex = this.config.spinButton.zIndex;
    
    // Создаем контейнер для кнопки
    this.container = new PIXI.Container();
    this.container.x = posX;
    this.container.y = posY;
    this.container.zIndex = zIndex;
    
    // Создаем интерактивный спрайт кнопки (default/hover/pressed)
    // Позиция 0,0 относительно контейнера (центр)
    this.button = new PIXI.Sprite(this.textures.default);
    this.button.anchor.set(0.5);
    this.button.x = 0;
    this.button.y = 0;
    this.button.eventMode = 'static';
    this.button.cursor = 'pointer';
    this.button.visible = true;
    
    // Создаем отдельный спрайт для disabled состояния
    // Позиция 0,0 относительно контейнера (центр) - текстуры с общим центром
    this.disabledButton = new PIXI.Sprite(this.textures.disabled);
    this.disabledButton.anchor.set(0.5);
    this.disabledButton.x = 0;
    this.disabledButton.y = 0;
    this.disabledButton.eventMode = 'none';
    this.disabledButton.cursor = 'not-allowed';
    this.disabledButton.visible = false; // По умолчанию скрыт
    
    // Добавляем оба спрайта в контейнер
    this.container.addChild(this.button);
    this.container.addChild(this.disabledButton);
    
    // Добавляем обработчики событий
    this.setupEvents();
    
    // Добавляем контейнер на сцену
    this.app.stage.addChild(this.container);
    
    // Обновляем сортировку для правильного zIndex
    this.app.stage.sortChildren();
    
    console.log('SpinButton initialized with container and two sprites');
  }
  
  async loadTextures() {
    const texturesConfig = this.config.spinButton.textures;
    const path = this.config.spinButton.texturesPath;
    
    try {
      const defaultRes = await PIXI.Assets.load(path + texturesConfig.default);
      const disabledRes = await PIXI.Assets.load(path + texturesConfig.disabled);
      const hoverRes = await PIXI.Assets.load(path + texturesConfig.hover);
      const pressedRes = await PIXI.Assets.load(path + texturesConfig.pressed);
      
      // PIXI.Assets.load может вернуть текстуру или объект с текстурой
      this.textures.default = defaultRes?.texture || defaultRes;
      this.textures.disabled = disabledRes?.texture || disabledRes;
      this.textures.hover = hoverRes?.texture || hoverRes;
      this.textures.pressed = pressedRes?.texture || pressedRes;
      
      console.log('SpinButton textures loaded:', {
        default: !!this.textures.default,
        disabled: !!this.textures.disabled,
        hover: !!this.textures.hover,
        pressed: !!this.textures.pressed,
        paths: {
          default: path + texturesConfig.default,
          disabled: path + texturesConfig.disabled,
          hover: path + texturesConfig.hover,
          pressed: path + texturesConfig.pressed
        }
      });
    } catch (error) {
      console.error('Failed to load SpinButton textures:', error);
    }
  }
  
  setupEvents() {
    // Наведение мыши
    this.button.on('pointerenter', () => {
      if (!this.isDisabled && this.currentState !== 'pressed' && this.currentState !== 'disabled') {
        this.setState('hover');
      }
    });
    
    // Уход мыши
    this.button.on('pointerleave', () => {
      if (!this.isDisabled && this.currentState !== 'pressed' && this.currentState !== 'disabled') {
        this.setState('default');
      }
    });
    
    // Нажатие мыши
    this.button.on('pointerdown', () => {
      if (!this.isDisabled) {
        this.setState('pressed');
      }
    });
    
    // Отпускание мыши
    this.button.on('pointerup', () => {
      if (!this.isDisabled) {
        if (this.currentState === 'pressed') {
          // Вызываем обработчик клика
          if (this.onSpinClick) {
            this.onSpinClick();
          }
          // После клика проверяем, находится ли мышь над кнопкой
          // Если да - показываем hover, если нет - default
          // Но это будет обработано pointerenter/pointerleave
          this.setState('default');
        }
      }
    });
    
    // Отпускание мыши вне кнопки
    this.button.on('pointerupoutside', () => {
      if (!this.isDisabled) {
        this.setState('default');
      }
    });
  }
  
  setState(state) {
    if (this.currentState === state) return;
    
    this.currentState = state;
    
    if (this.button && this.textures[state]) {
      this.button.texture = this.textures[state];
      console.log(`SpinButton: State changed to ${state}`);
    } else {
      console.warn(`SpinButton: Cannot set state ${state} - texture not found or button not initialized`);
    }
  }
  
  setDisabled(disabled) {
    const wasDisabled = this.isDisabled;
    this.isDisabled = disabled;
    
    if (disabled) {
      // Скрываем интерактивный спрайт
      this.button.visible = false;
      this.button.eventMode = 'none';
      
      // Показываем disabled спрайт
      this.disabledButton.visible = true;
      
      console.log(`SpinButton: Set to disabled state - showing disabled sprite`);
    } else {
      // Показываем интерактивный спрайт
      this.button.visible = true;
      this.button.eventMode = 'static';
      this.button.cursor = 'pointer';
      
      // Скрываем disabled спрайт
      this.disabledButton.visible = false;
      
      // Устанавливаем default состояние
      this.setState('default');
      
      console.log(`SpinButton: Set to enabled state - showing interactive sprite`);
    }
  }
  
  destroy() {
    if (this.container) {
      if (this.button) {
        this.container.removeChild(this.button);
        this.button.destroy();
        this.button = null;
      }
      if (this.disabledButton) {
        this.container.removeChild(this.disabledButton);
        this.disabledButton.destroy();
        this.disabledButton = null;
      }
      this.app.stage.removeChild(this.container);
      this.container.destroy();
      this.container = null;
    }
    this.textures = {};
  }
  
  // Метод для получения контейнера для дебаггера
  getButton() {
    return this.container;
  }
}

