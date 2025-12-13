export class GameScenarios {
  constructor(config) {
    this.config = config;
    this.scenario = null;
    this.currentSpinIndex = 0;
  }
  
  async loadScenario(scenarioPath) {
    try {
      const response = await fetch(scenarioPath);
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid scenario format: must be a non-empty array');
      }
      
      // Валидация структуры
      for (let i = 0; i < data.length; i++) {
        const matrix = data[i];
        if (!Array.isArray(matrix) || matrix.length !== this.config.reels.count) {
          throw new Error(`Invalid matrix at spin ${i + 1}: must be array of ${this.config.reels.count} reels`);
        }
        
        for (let reelIndex = 0; reelIndex < matrix.length; reelIndex++) {
          const reel = matrix[reelIndex];
          if (!Array.isArray(reel) || reel.length !== this.config.reels.symbolsPerReel) {
            throw new Error(`Invalid reel ${reelIndex} at spin ${i + 1}: must be array of ${this.config.reels.symbolsPerReel} symbols`);
          }
          
          // Проверяем что значения в допустимом диапазоне
          const maxTextureIndex = this.config.symbolTextureFiles ? this.config.symbolTextureFiles.length - 1 : 9;
          for (let symbolIndex = 0; symbolIndex < reel.length; symbolIndex++) {
            const value = reel[symbolIndex];
            if (typeof value !== 'number' || value < 0 || value > maxTextureIndex) {
              throw new Error(`Invalid texture index ${value} at spin ${i + 1}, reel ${reelIndex}, symbol ${symbolIndex} (max: ${maxTextureIndex})`);
            }
          }
        }
      }
      
      this.scenario = data;
      this.currentSpinIndex = 0;
      console.log(`Scenario loaded: ${data.length} spins`);
      return true;
    } catch (error) {
      console.error('Failed to load scenario:', error);
      return false;
    }
  }
  
  getCurrentMatrix() {
    if (!this.scenario || this.currentSpinIndex >= this.scenario.length) {
      return null;
    }
    return this.scenario[this.currentSpinIndex];
  }
  
  nextSpin() {
    if (this.scenario && this.currentSpinIndex < this.scenario.length) {
      this.currentSpinIndex++;
    }
  }
  
  reset() {
    this.currentSpinIndex = 0;
  }
  
  hasMoreSpins() {
    return this.scenario && this.currentSpinIndex < this.scenario.length;
  }
}

