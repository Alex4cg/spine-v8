export class HoldNWin {
  constructor(slotMachine) {
    this.slotMachine = slotMachine;
    this.heldSymbols = new Map();
  }
  
  async stopReels() {
    const reels = this.slotMachine.reels;
    const stopDelay = this.slotMachine.config.reelStopDelay;
    
    for (let i = 0; i < reels.length; i++) {
      const finalSymbols = this.generateFinalSymbols(i);
      reels[i].stopSpin(finalSymbols);
      
      if (i < reels.length - 1) {
        await this.delay(stopDelay);
      }
    }
    
    this.checkAndHoldSymbols();
    this.slotMachine.onAllReelsStopped();
  }
  
  generateFinalSymbols(reelIndex) {
    const symbols = [];
    const heldIndices = this.heldSymbols.get(reelIndex) || [];
    
    for (let i = 0; i < this.slotMachine.config.reels.symbolsPerReel; i++) {
      if (heldIndices.includes(i)) {
        symbols.push(this.slotMachine.reels[reelIndex].currentSymbols[i]);
      } else {
        symbols.push(
          Math.floor(Math.random() * this.slotMachine.config.symbolColors.length)
        );
      }
    }
    
    return symbols;
  }
  
  checkAndHoldSymbols() {
    // Замораживаем символы при 3+ одинаковых в строке
    this.heldSymbols.clear();
    
    const reels = this.slotMachine.reels;
    const symbolsPerReel = this.slotMachine.config.reels.symbolsPerReel;
    
    for (let row = 0; row < symbolsPerReel; row++) {
      const rowSymbols = reels.map(reel => reel.currentSymbols[row]);
      
      let currentSymbol = rowSymbols[0];
      let count = 1;
      let startIndex = 0;
      
      for (let i = 1; i < rowSymbols.length; i++) {
        if (rowSymbols[i] === currentSymbol) {
          count++;
        } else {
          if (count >= 3) {
            for (let j = startIndex; j < startIndex + count; j++) {
              if (!this.heldSymbols.has(j)) {
                this.heldSymbols.set(j, []);
              }
              this.heldSymbols.get(j).push(row);
            }
          }
          currentSymbol = rowSymbols[i];
          count = 1;
          startIndex = i;
        }
      }
      
      if (count >= 3) {
        for (let j = startIndex; j < startIndex + count; j++) {
          if (!this.heldSymbols.has(j)) {
            this.heldSymbols.set(j, []);
          }
          this.heldSymbols.get(j).push(row);
        }
      }
    }
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  reset() {
    this.heldSymbols.clear();
  }
}

