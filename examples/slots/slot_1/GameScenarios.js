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
        let matrix;
        let winLines = [];
        
        // Проверяем формат: объект с matrix и winLines или просто массив (старый формат)
        if (data[i] && typeof data[i] === 'object' && !Array.isArray(data[i])) {
          // Новый формат: объект
          if (!data[i].matrix) {
            throw new Error(`Invalid scenario format at spin ${i + 1}: object must have "matrix" property`);
          }
          matrix = data[i].matrix;
          winLines = data[i].winLines || [];
          
          // Валидация winLines
          if (!Array.isArray(winLines)) {
            throw new Error(`Invalid winLines at spin ${i + 1}: must be an array`);
          }
          for (let lineNum of winLines) {
            if (typeof lineNum !== 'number' || lineNum < 1 || lineNum > 5) {
              throw new Error(`Invalid winLine number ${lineNum} at spin ${i + 1}: must be between 1 and 5`);
            }
          }
        } else {
          // Старый формат: просто массив матрицы
          matrix = data[i];
        }
        
        // Валидация матрицы
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
    
    const currentSpin = this.scenario[this.currentSpinIndex];
    
        // Если новый формат (объект с matrix и winLines)
        if (currentSpin && typeof currentSpin === 'object' && currentSpin.matrix) {
          return {
            matrix: currentSpin.matrix,
            coinValues: currentSpin.coinValues || null
          };
        }
        
        // Если старый формат (массив) - возвращаем как есть
        return {
          matrix: currentSpin,
          coinValues: null
        };
      }
  
  getCurrentWinLines() {
    if (!this.scenario || this.currentSpinIndex >= this.scenario.length) {
      return [];
    }
    
    const currentSpin = this.scenario[this.currentSpinIndex];
    
    // Если сценарий в новом формате (объект с winLines)
    if (currentSpin && typeof currentSpin === 'object' && currentSpin.winLines) {
      return currentSpin.winLines;
    }
    
    // Если старый формат (только матрица) - возвращаем пустой массив
    return [];
  }

  /**
   * Получает события текущего спина
   * @returns {Array<string>} Массив событий
   */
  getCurrentEvents() {
    if (!this.scenario || this.currentSpinIndex >= this.scenario.length) {
      return [];
    }
    
    const currentSpin = this.scenario[this.currentSpinIndex];
    
    // Если сценарий в новом формате (объект с events)
    if (currentSpin && typeof currentSpin === 'object' && Array.isArray(currentSpin.events)) {
      return currentSpin.events;
    }
    
    // Если событий нет - возвращаем пустой массив
    return [];
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

