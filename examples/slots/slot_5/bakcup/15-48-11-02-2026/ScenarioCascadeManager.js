/**
 * ScenarioCascadeManager — каскад только по сценарию.
 * Наследует CascadeManager, переопределяет только логику проверки выигрыша и продвижения шагов.
 * Нет веток "режим сценария / не сценарий" — одна линейная логика по сценарию.
 */
import { CascadeManager } from './CascadeManager.js';

const GAME_STATE = {
  IDLE: 'idle',
  SPINNING: 'spinning',
  CHECKING_WINS: 'checking_wins',
  REMOVING_WINS: 'removing_wins',
  COMPACTING: 'compacting',
  FILLING: 'filling',
  WAITING_LANDING: 'waiting_landing'
};

export class ScenarioCascadeManager extends CascadeManager {
  constructor(config) {
    super(config);
    this.scenarioMode = true;
  }

  /**
   * Только сценарий: выигрыш из текущего шага, продвижение только по правилам сценария.
   */
  async _onAllLanded() {
    if (this.gameState === GAME_STATE.REMOVING_WINS ||
        this.gameState === GAME_STATE.COMPACTING ||
        this.gameState === GAME_STATE.FILLING ||
        this.gameState === GAME_STATE.SPINNING) {
      return;
    }
    if (this.winCheckProcessed || this.winCheckPending) return;
    if (!this.currentScenario) return;

    // Проверяем текущий шаг на spin-bomb или cascade-bomb ДО проверки выигрышей
    const curStep = this.getCurrentScenarioStep();
    if (curStep && (curStep.event === 'spin-bomb' || curStep.event === 'cascade-bomb') && 
        curStep.bombType === 'explode' && curStep.explodedPositions) {
      console.log(`💣 [${curStep.event.toUpperCase()}] Обработка взрыва бомбы на шаге ${this.currentScenarioStep + 1}`);
      this.gameState = GAME_STATE.CHECKING_WINS;
      this.winCheckProcessed = true;
      
      // Удаляем бомбу и соседние символы
      await this._handleBombExplode(curStep);
      
      // После взрыва переходим к следующему шагу (cascade или cascade-win) - закольцовывание
      const nextStepIndex = (this.currentScenarioStep + 1) % this.currentScenario.length;
      const nextStepAfterBomb = this.currentScenario[nextStepIndex];
      // Следующий шаг должен быть cascade или cascade-win (описывает состояние ПОСЛЕ взрыва)
      if (nextStepAfterBomb.event === 'cascade' || nextStepAfterBomb.event === 'cascade-win' || 
          nextStepAfterBomb.event === 'cascade-win-bomb') {
        // Переходим к следующему шагу и продолжаем обработку каскада (уплотнение + досыпание)
        this.currentScenarioStep = nextStepIndex;
        console.log(`💣 [${curStep.event.toUpperCase()}] Переход к шагу ${nextStepIndex + 1} (${nextStepAfterBomb.event}), запуск уплотнения и досыпания`);
        await this.processCascade();
      } else {
        console.warn(`⚠️ [${curStep.event.toUpperCase()}] Ожидалось событие cascade/cascade-win после взрыва, получено: ${nextStepAfterBomb.event}`);
        this._setIdle();
        this.winCheckProcessed = false;
      }
      return;
    }

    this.gameState = GAME_STATE.CHECKING_WINS;
    this.winCheckProcessed = true;
    this.winCheckPending = true;

    const DELAY_MS = 100;
    setTimeout(async () => {
      this.winCheckPending = false;
      const winningSymbols = this._getWinningSymbolsFromScenario();
      const wins = Array.isArray(winningSymbols) ? winningSymbols : [];

      const nextStepIndex = (this.currentScenarioStep + 1) % this.currentScenario.length;
      const nextStep = this.currentScenario[nextStepIndex];
      if (nextStep.event === 'cascade' || nextStep.event === 'cascade-win' || nextStep.event === 'cascade-win-bomb') {
        await this._handleScenarioWinCheck(wins);
        return;
      }

      if (wins.length > 0) {
        await this._handleScenarioWinCheck(wins);
        return;
      }

      const currentStep = this.getCurrentScenarioStep();
      if (currentStep && (currentStep.event === 'cascade' || currentStep.event === 'spin' || currentStep.event === 'spin-win-bomb' || 
          currentStep.event === 'spin-bomb' || currentStep.event === 'cascade-bomb' || currentStep.event === 'cascade-win-bomb')) {
        // На шаге cascade/spin/spin-win-bomb/spin-bomb/cascade-bomb/cascade-win-bomb дальше только по нажатию спин
      } else {
        this._handleScenarioNoWin();
      }
      this._setIdle();
      this.winCheckProcessed = false;
    }, DELAY_MS);
  }

  /**
   * Каскад по сценарию: без таймера проверки выигрыша, в ветке "ничего не сдвинулось" — только логика сценария.
   */
  async processCascade() {
    if (this.gameState === GAME_STATE.COMPACTING || this.gameState === GAME_STATE.FILLING) {
      console.warn('⚠️ Каскад уже в процессе, пропускаем');
      return;
    }

    this.gameState = GAME_STATE.COMPACTING;
    if (this._blockSpinButton) this._blockSpinButton();

    const { hasMoved, emptySpots } = await this._processCascadeCompacting();

    if (hasMoved || emptySpots.length > 0) {
      if (emptySpots.length > 0) {
        await this._processCascadeFilling(emptySpots);
      } else {
        this._processCascadeCompactingOnly(hasMoved);
      }
      // В сценарии проверка по приземлению через колбэки, таймер не ставим
    } else {
      const curStep = this.getCurrentScenarioStep();
      if (curStep && (curStep.event === 'cascade' || curStep.event === 'spin' || curStep.event === 'spin-win-bomb' || 
          curStep.event === 'spin-bomb' || curStep.event === 'cascade-bomb' || curStep.event === 'cascade-win-bomb')) {
        this._setIdle();
        this.winCheckProcessed = true;
        return;
      }
      const nextStepIndex = (this.currentScenarioStep + 1) % this.currentScenario.length;
      const nextStep = this.currentScenario[nextStepIndex];
      if (nextStep.event === 'spin' || nextStep.event === 'spin-win' || nextStep.event === 'spin-win-bomb' || 
          nextStep.event === 'spin-bomb' || 
          nextStep.event === 'cascade' || nextStep.event === 'cascade-win-bomb') {
        this.currentScenarioStep = nextStepIndex;
        this._setIdle();
        this.winCheckProcessed = true;
        return;
      }
      this._handleScenarioNoWin();
      this._setIdle();
      this.winCheckProcessed = true;
    }
  }

  /**
   * Выигрышные символы только из текущего шага сценария (cascade/spin без -win дают []).
   */
  _getWinningSymbolsFromScenario() {
    if (!this.currentScenario) return [];
    const step = this.getCurrentScenarioStep();
    if (!step) return [];
    // События без выигрыша: cascade, spin, spin-bomb, cascade-bomb (spin-win-bomb и cascade-win-bomb имеют выигрышные группы)
    if (step.event === 'cascade' || step.event === 'spin' || step.event === 'spin-bomb' || step.event === 'cascade-bomb') return [];
    if (!step.winningGroups || step.winningGroups.length === 0) return [];
    if (!step.groupMarkup) return [];

    const winningSymbols = [];
    const groupMarkup = step.groupMarkup;
    for (const winningGroup of step.winningGroups) {
      const groupId = winningGroup.groupId;
      const symbolType = winningGroup.symbolType;
      for (let row = 0; row < this.GRID_ROWS; row++) {
        for (let col = 0; col < this.GRID_COLS; col++) {
          if (groupMarkup[row][col] === groupId) {
            const symbol = this.grid[col][row];
            if (symbol && symbol.textureIndex === symbolType) {
              winningSymbols.push(symbol);
            }
          }
        }
      }
    }

    // spin-win-bomb / cascade-win-bomb: бомба удаляется вместе с выигрышными (multiplier)
    if ((step.event === 'spin-win-bomb' || step.event === 'cascade-win-bomb') &&
        step.bombType === 'multiplier' && step.bombPosition) {
      const col = step.bombPosition.col;
      const row = step.bombPosition.row;
      if (col >= 0 && col < this.GRID_COLS && row >= 0 && row < this.GRID_ROWS) {
        const bombSymbol = this.grid[col][row];
        if (bombSymbol && winningSymbols.indexOf(bombSymbol) === -1) {
          winningSymbols.push(bombSymbol);
        }
      }
    }

    return winningSymbols;
  }
}
