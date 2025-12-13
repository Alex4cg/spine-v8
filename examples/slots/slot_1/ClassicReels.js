export class ClassicReels {
  constructor(slotMachine) {
    this.slotMachine = slotMachine;
  }
  
  async stopReels() {
    const reels = this.slotMachine.reels;
    const stopDelay = this.slotMachine.config.reelStopDelay;
    
    for (let i = 0; i < reels.length; i++) {
      const finalSymbols = this.generateFinalSymbols();
      reels[i].stopSpin(finalSymbols);
      
      if (i < reels.length - 1) {
        await this.delay(stopDelay);
      }
    }
    
    this.slotMachine.onAllReelsStopped();
  }
  
  generateFinalSymbols() {
    const symbols = [];
    for (let i = 0; i < this.slotMachine.config.reels.symbolsPerReel; i++) {
      symbols.push(
        Math.floor(Math.random() * this.slotMachine.config.symbolColors.length)
      );
    }
    return symbols;
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

