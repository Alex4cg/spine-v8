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
    if (this._findLastFallingSymbol()) return;

    // Проверяем текущий шаг на spin-bomb или cascade-bomb ДО проверки выигрышей
    const curStep = this.getCurrentScenarioStep();
    if (curStep && (curStep.event === 'spin-bomb' || curStep.event === 'cascade-bomb') &&
        curStep.bombType === 'explode' && curStep.explodedPositions) {
      console.log(`💣 [${curStep.event.toUpperCase()}] Обработка взрыва бомбы на шаге ${this.currentScenarioStep + 1}`);
      this.gameState = GAME_STATE.CHECKING_WINS;
      this.winCheckProcessed = true;

      await this._handleBombExplode(curStep);

      const nextStepIndex = (this.currentScenarioStep + 1) % this.currentScenario.length;
      const nextStepAfterBomb = this.currentScenario[nextStepIndex];
      // Уплотнение и досыпание после взрыва: следующий шаг может быть cascade, cascade-win, cascade-win-bomb или ещё один cascade-bomb/spin-bomb
      if (nextStepAfterBomb.event === 'cascade' || nextStepAfterBomb.event === 'cascade-win' ||
          nextStepAfterBomb.event === 'cascade-win-bomb' || nextStepAfterBomb.event === 'cascade-bomb' ||
          nextStepAfterBomb.event === 'spin-bomb') {
        this.currentScenarioStep = nextStepIndex;
        console.log(`💣 [${curStep.event.toUpperCase()}] Переход к шагу ${nextStepIndex + 1} (${nextStepAfterBomb.event}), запуск уплотнения и досыпания`);
        await this.processCascade();
      } else {
        console.warn(`⚠️ [${curStep.event.toUpperCase()}] Ожидалось событие cascade/cascade-win/cascade-bomb после взрыва, получено: ${nextStepAfterBomb.event}`);
        this._setIdle();
        this.winCheckProcessed = false;
      }
      return;
    }

    this.gameState = GAME_STATE.CHECKING_WINS;
    this.winCheckProcessed = true;
    this.winCheckPending = true;
    this.scatterHitAnimationsPlayed = false;

    const DELAY_MS = 100;
    setTimeout(async () => {
      this.winCheckPending = false;
      const winningSymbols = this._getWinningSymbolsFromScenario();
      const wins = Array.isArray(winningSymbols) ? winningSymbols : [];

      const nextStepIndex = (this.currentScenarioStep + 1) % this.currentScenario.length;
      const nextStep = this.currentScenario[nextStepIndex];
      if (nextStep && (nextStep.event === 'cascade' || nextStep.event === 'cascade-win' || nextStep.event === 'cascade-win-bomb')) {
        await this._handleScenarioWinCheck(wins);
        // Hit анимация скаттеров не здесь: проиграется один раз при приземлении в ветке «нет выигрыша»
        return;
      }

      if (wins.length > 0) {
        await this._handleScenarioWinCheck(wins);
        // Hit анимация скаттеров не здесь: проиграется один раз при приземлении в ветке «нет выигрыша»
        return;
      }

      if (nextStep && (nextStep.event === 'cascade-bomb' || nextStep.event === 'spin-bomb') && nextStep.bombType === 'explode' && nextStep.explodedPositions) {
        this.currentScenarioStep = nextStepIndex;
        await this._handleBombExplode(nextStep);
        const stepAfterBombIndex = (nextStepIndex + 1) % this.currentScenario.length;
        this.currentScenarioStep = stepAfterBombIndex;
        const stepAfterBomb = this.currentScenario[stepAfterBombIndex];
        if (stepAfterBomb && (stepAfterBomb.event === 'cascade' || stepAfterBomb.event === 'cascade-win' || stepAfterBomb.event === 'cascade-win-bomb' ||
            stepAfterBomb.event === 'cascade-bomb' || stepAfterBomb.event === 'spin-bomb')) {
          await this.processCascade();
        } else {
          this._setIdle();
          this.winCheckProcessed = false;
        }
        return;
      }

      const currentStep = this.getCurrentScenarioStep();
      if (currentStep && (currentStep.event === 'cascade' || currentStep.event === 'spin' || currentStep.event === 'spin-win-bomb' ||
          currentStep.event === 'spin-bomb' || currentStep.event === 'cascade-bomb' || currentStep.event === 'cascade-win-bomb')) {
        if (currentStep.event === 'spin' || currentStep.event === 'cascade') {
          this.scatterHitAnimationsPlayed = false;
          this._playScatterHitAnimations();
        }
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
    } else {
      const curStep = this.getCurrentScenarioStep();
      if (curStep && (curStep.event === 'cascade' || curStep.event === 'spin' || curStep.event === 'spin-win-bomb' ||
          curStep.event === 'spin-bomb' || curStep.event === 'cascade-bomb' || curStep.event === 'cascade-win-bomb')) {
        if (curStep.event === 'cascade') {
          this.scatterHitAnimationsPlayed = false;
          this._playScatterHitAnimations();
        }
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
