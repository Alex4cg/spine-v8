export class WinFrameAnimation {
  constructor(config, app, container) {
    this.config = config;
    this.app = app;
    this.container = container;
    this.atlas = null;
    this.textures = [];
    this.animatedSprites = [];
    this.isPlaying = false;
  }
  
  async loadAtlas() {
    const atlasPath = this.config.winFrameAnimation.atlasPath;
    this.atlas = await PIXI.Assets.load(atlasPath);
    
    // Извлекаем текстуры в правильном порядке (00.png - 59.png)
    for (let i = 0; i < this.config.winFrameAnimation.frameCount; i++) {
      const frameName = String(i).padStart(2, '0') + '.png';
      if (this.atlas.textures[frameName]) {
        this.textures.push(this.atlas.textures[frameName]);
      }
    }
    
    if (this.textures.length === 0) {
      console.warn('WinFrame: No textures found in atlas');
      return;
    }
    
    console.log(`WinFrame: Loaded ${this.textures.length} textures`);
  }
  
  createAnimatedSprite() {
    const sprite = new PIXI.AnimatedSprite(this.textures);
    sprite.animationSpeed = 1.0; // 60 fps
    sprite.loop = false; // проиграть 1 раз
    sprite.anchor.set(0.5);
    sprite.blendMode = 'add'; // аддитивное наложение
    sprite.zIndex = 200;
    sprite.visible = false;
    this.container.addChild(sprite);
    return sprite;
  }
  
  playOnRandomSymbols(reels) {
    if (this.textures.length === 0) {
      console.warn('WinFrame animation not loaded');
      return;
    }
    
    // Получаем видимые символы для каждого рила
    const visibleSymbols = [];
    reels.forEach((reel, reelIndex) => {
      // Получаем видимые символы (верхние 3, отсортированные по Y снизу вверх)
      const sortedSymbols = reel.symbols.map((s, idx) => ({ symbol: s, index: idx, y: s.y }))
        .sort((a, b) => a.y - b.y);
      
      const reelVisibleSymbols = [];
      for (let i = 0; i < reel.visibleSymbols; i++) {
        const symbol = sortedSymbols[i].symbol;
        reelVisibleSymbols.push({
          symbol: symbol,
          textureIndex: symbol.textureIndex,
          x: reel.reelContainer.x + this.config.symbolSize.width / 2,
          y: symbol.y + reel.reelContainer.y + this.config.symbolSize.height / 2,
          reelIndex: reelIndex,
          positionIndex: i // 0=нижний, 1=средний, 2=верхний
        });
      }
      visibleSymbols.push(reelVisibleSymbols);
    });
    
    // Ищем горизонтальные линии одинаковых символов
    const winningLines = [];
    const numPositions = visibleSymbols[0].length; // количество позиций (обычно 3)
    
    // Проверяем каждую позицию (нижний, средний, верхний)
    for (let posIndex = 0; posIndex < numPositions; posIndex++) {
      // Получаем textureIndex для всех рилов на этой позиции
      const textureIndices = visibleSymbols.map(reel => reel[posIndex].textureIndex);
      
      // Проверяем, все ли одинаковые
      const firstTexture = textureIndices[0];
      const allSame = textureIndices.every(idx => idx === firstTexture);
      
      if (allSame) {
        // Найдена горизонтальная линия!
        const lineSymbols = visibleSymbols.map(reel => reel[posIndex]);
        winningLines.push(lineSymbols);
        console.log(`WinFrame: Found horizontal line at position ${posIndex} with texture ${firstTexture}`);
      }
    }
    
    // Если нет выигрышных линий - не показываем анимацию
    if (winningLines.length === 0) {
      console.log('WinFrame: No winning lines found');
      return;
    }
    
    // Очищаем старые спрайты
    this.stop();
    
    // Подсвечиваем все символы во всех найденных линиях
    winningLines.forEach(line => {
      line.forEach(symbolData => {
        const sprite = this.createAnimatedSprite();
        sprite.x = symbolData.x;
        sprite.y = symbolData.y;
        sprite.visible = true;
        sprite.gotoAndPlay(0);
        
        // Скрываем после завершения анимации
        sprite.onComplete = () => {
          sprite.visible = false;
          sprite.stop();
        };
        
        this.animatedSprites.push(sprite);
      });
    });
    
    this.isPlaying = true;
    const totalSymbols = winningLines.reduce((sum, line) => sum + line.length, 0);
    console.log(`WinFrame: Playing animation on ${winningLines.length} winning line(s), ${totalSymbols} symbols`);
  }
  
  play() {
    // Этот метод больше не используется, используем playOnRandomSymbols
    console.warn('WinFrame: Use playOnRandomSymbols() instead');
  }
  
  stop() {
    this.animatedSprites.forEach(sprite => {
      sprite.visible = false;
      sprite.stop();
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
    });
    this.animatedSprites = [];
    this.isPlaying = false;
  }
}
