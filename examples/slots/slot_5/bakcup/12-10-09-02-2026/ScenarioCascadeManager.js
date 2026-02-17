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
  _onAllLanded() {
    if (!this.hasSpunOnce) return;
    if (this.gameState === GAME_STATE.REMOVING_WINS ||
        this.gameState === GAME_STATE.COMPACTING ||
        this.gameState === GAME_STATE.FILLING ||
        this.gameState === GAME_STATE.SPINNING) {
      return;
    }
    if (this.winCheckProcessed || this.winCheckPending) return;
    if (!this.currentScenario) return;

    this.gameState = GAME_STATE.CHECKING_WINS;
    this.winCheckProcessed = true;
    this.winCheckPending = true;

    const DELAY_MS = 100;
    setTimeout(async () => {
      this.winCheckPending = false;
      const winningSymbols = this._getWinningSymbolsFromScenario();
      const wins = Array.isArray(winningSymbols) ? winningSymbols : [];

      const nextStepIndex = this.currentScenarioStep + 1;
      if (nextStepIndex < this.currentScenario.length) {
        const nextStep = this.currentScenario[nextStepIndex];
        if (nextStep.event === 'cascade' || nextStep.event === 'cascade-win') {
          await this._handleScenarioWinCheck(wins);
          return;
        }
      }

      if (wins.length > 0) {
        await this._handleScenarioWinCheck(wins);
        return;
      }

      const curStep = this.getCurrentScenarioStep();
      if (curStep && (curStep.event === 'cascade' || curStep.event === 'spin')) {
        // На шаге cascade/spin дальше только по нажатию спин
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
      if (curStep && (curStep.event === 'cascade' || curStep.event === 'spin')) {
        this._setIdle();
        this.winCheckProcessed = true;
        return;
      }
      const nextStepIndex = this.currentScenarioStep + 1;
      if (nextStepIndex < this.currentScenario.length) {
        const nextStep = this.currentScenario[nextStepIndex];
        if (nextStep.event === 'spin' || nextStep.event === 'cascade') {
          this.currentScenarioStep = nextStepIndex;
          this._setIdle();
          this.winCheckProcessed = true;
          return;
        }
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
    if (step.event === 'cascade' || step.event === 'spin') return [];
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
    return winningSymbols;
  }
}
