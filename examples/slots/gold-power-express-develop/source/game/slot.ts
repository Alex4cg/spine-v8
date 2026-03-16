import { Container } from "pixi.js";

import { ui, state, ruleSettings } from "@clawbuster/facade";
import { Howler } from "howler";
import soundManager, { playSfx } from '@/gkit/utils/sound-manager'
import { Tween } from "@/gkit/tweens";
import { getDevtoolsValues, isTurboMode } from "@/devtools";

import WelcomeScreen from "@/game/components/welcome-screen";
import Background from "@/game/components/background";
import BackgroundSpineLayer from "@/game/components/background-spine-layer";
import Field from "@/game/components/field";
import LogoSpine from "@/game/components/logo-spine";
import TrainSpine from "@/game/components/train-spine";
import CollectEffect from "@/game/components/collect-effect";
import WinBoard from "@/components/layers/winboard";
import { WinBoardTypes, WinBoardEvent } from "@/components/layers/winboard/config";
import TrainAnimationManager from "@/game/train-animation-manager";
import BuyFeature from '@/components/buy-feature'
import game, { eventBus } from '@/game/game';
import FSM from "@/gkit/FSM";
import StepsManager from "@/game/steps-manager";
import type { GameStep } from "@/types";
import { IDSpecial } from "@/components/items/const";
import { COLS, ROWS, SAFE_ZONE_WIDTH } from "@/const";
import { changeParent } from '@/gkit/utils/change-parent';
import type ItemCoin from '@/components/items/item-coin'
import type ItemCollector from '@/components/items/item-collector'
import { resolveJackpotType } from '@/game/steps/initial-step'
import { FIELD_TOP_OFFSET, SLOT_Y_OFFSET_DESKTOP, SLOT_Y_OFFSET_MOBILE } from '@/game/components/field-layout'
import { GameEvents } from '@/game/events'

declare const BUILD_CONFIG: { MODE: string };

type PendingAction = {
  ok?: boolean;
  outcome?: {
    steps?: GameStep[];
  };
} & Record<string, unknown>;

type ExtractedSpinState = {
  freespins: number;
  roundWinnings: number;
  roundEnd: boolean;
  maxWin: boolean;
};

function deepFindSpinState(value: unknown, maxDepth: number): ExtractedSpinState | null {
  const seen = new Set<unknown>();
  const queue: Array<{ v: unknown; d: number }> = [{ v: value, d: 0 }];

  while (queue.length) {
    const { v, d } = queue.shift()!;
    if (!v || typeof v !== `object`) continue;
    if (seen.has(v)) continue;
    seen.add(v);

    const obj = v as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fs = (obj.freespins ?? (obj as any).freeSpins) as unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const re = (obj.roundEnd ?? (obj as any).round_end ?? (obj as any).roundEnded) as unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rw = (obj.roundWinnings ?? (obj as any).round_winnings ?? (obj as any).winnings) as unknown;

    if (typeof fs === `number` && typeof re === `boolean` && typeof rw === `number`) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mw = (obj.maxWin ?? (obj as any).max_win ?? false) as boolean;

      return { freespins: fs, roundEnd: re, roundWinnings: rw, maxWin: !!mw };
    }

    if (d >= maxDepth) continue;

    if (Array.isArray(v)) {
      for (const item of v) queue.push({ v: item, d: d + 1 });
    } else {
      for (const key of Object.keys(obj)) {
        queue.push({ v: obj[key], d: d + 1 });
      }
    }
  }

  return null;
}

function extractSpinStateFromAction(action: PendingAction): ExtractedSpinState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actionAny: any = action as any;

  const fallback: ExtractedSpinState = { freespins: 0, roundWinnings: 0, roundEnd: false, maxWin: false };

  if (actionAny?.gameState) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gs: any = actionAny.gameState;

    return {
      freespins: gs.freespins ?? gs.freeSpins ?? 0,
      roundWinnings: gs.roundWinnings ?? gs.round_winnings ?? 0,
      roundEnd: gs.roundEnd ?? gs.round_end ?? false,
      maxWin: !!(gs.maxWin ?? gs.max_win ?? false)
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = (action as any).payload;

  if (payload?.state) {
    return {
      freespins: payload.state.freespins ?? payload.state.freeSpins ?? 0,
      roundWinnings: payload.state.roundWinnings ?? payload.state.round_winnings ?? 0,
      roundEnd: payload.state.roundEnd ?? payload.state.round_end ?? false,
      maxWin: !!(payload.state.maxWin ?? payload.state.max_win ?? false)
    };
  }

  if (Array.isArray(payload?.spins) && payload.spins[0]?.roundState) {
    const rs = payload.spins[0].roundState;

    return {
      freespins: rs.freespins ?? rs.freeSpins ?? 0,
      roundWinnings: rs.roundWinnings ?? rs.round_winnings ?? 0,
      roundEnd: rs.roundEnd ?? rs.round_end ?? false,
      maxWin: !!(rs.maxWin ?? rs.max_win ?? false)
    };
  }

  if (Array.isArray(payload?.spins) && payload.spins[0]?.state) {
    const rs = payload.spins[0].state;

    return {
      freespins: rs.freespins ?? rs.freeSpins ?? 0,
      roundWinnings: rs.roundWinnings ?? rs.round_winnings ?? 0,
      roundEnd: rs.roundEnd ?? rs.round_end ?? false,
      maxWin: !!(rs.maxWin ?? rs.max_win ?? false)
    };
  }

  if (Array.isArray(payload) && payload[0]?.state) {
    const rs = payload[0].state;

    return {
      freespins: rs.freespins ?? rs.freeSpins ?? 0,
      roundWinnings: rs.roundWinnings ?? rs.round_winnings ?? 0,
      roundEnd: rs.roundEnd ?? rs.round_end ?? false,
      maxWin: !!(rs.maxWin ?? rs.max_win ?? false)
    };
  }

  const deep = deepFindSpinState(actionAny, 6);
  if (deep) return deep;

  return fallback;
}

function extractStepsFromAction(action: PendingAction): GameStep[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const direct = (action as any).outcome?.steps;
  if (Array.isArray(direct)) return direct;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = (action as any).payload;

  if (Array.isArray(payload?.spins) && Array.isArray(payload.spins[0]?.outcome?.steps)) {
    return payload.spins[0].outcome.steps;
  }

  if (Array.isArray(payload) && Array.isArray(payload[0]?.outcome?.steps)) {
    return payload[0].outcome.steps;
  }

  return [];
}

enum FsmState {
  Intro = `INTRO`,
  WaitingForSpin = `WAITING_FOR_SPIN`,
  PreSpin = `PRE_SPIN`,
  Spin = `SPIN`,
}

export default class Slot extends Container {
  readonly #fsm: FSM<typeof FsmState, this>;

  #welcomeScreen!: WelcomeScreen;
  #background!: Background;
  #backgroundSpineLayer!: BackgroundSpineLayer;
  #field!: Field;
  #logo!: LogoSpine;
  #train!: TrainSpine;
  #collectEffect!: CollectEffect;
  #winBoard!: WinBoard;
  #buyFeature!: BuyFeature;
  #stepsManager!: StepsManager;
  #trainAnimationManager!: TrainAnimationManager;
  #pendingAction: unknown | null = null;
  #lastEnterState: unknown | null = null;
  #isRestoredRound = false;
  #spinStartTime: number = 0;
  #isActionInProgress = false;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #extractBaseTriggerGridFromState(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const roundAny = (state as any)?.round
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentAny = (state as any)?.current

    const data0 = Array.isArray(roundAny?.data) ? roundAny.data[0] : undefined
    const gridFromRound0 = data0?.state?.grid ?? data0?.state?.reels
    if (gridFromRound0 && Array.isArray(gridFromRound0)) {
      return gridFromRound0
    }

    return currentAny?.grid ?? currentAny?.reels
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #restoreFieldFromGrid(grid: any) {
    if (!grid) return

    const barIds = this.#field.exportData.gridToBarFormat(grid)
    const bars = this.#field.exportData.bars

    for (let c = 0; c < COLS; c++) {
      const bar = bars[c]
      bar.unsetHoldItems()
      bar.clearAllItems()

      const hasBlank = barIds[c].some((id) => id === IDSpecial.Blank)
      if (!hasBlank) {
        bar.setItems(barIds[c])
      } else {
        for (let r = 0; r < ROWS; r++) {
          if (barIds[c][r] !== IDSpecial.Blank) {
            bar.setMiniReelItemByPositionIndex(r, barIds[c][r])
          }
        }
      }

      for (let r = 0; r < ROWS; r++) {
        const cell = grid?.[c]?.[r]
        const item = bar.getItemByPositionIndex(r)

        if (item) {
          item.visible = true

          if ([IDSpecial.Coin, IDSpecial.Collector, IDSpecial.Jackpot].includes(item.id as IDSpecial)) {
            item.zIndex = this.#field.exportData.getLayerOrder(`FieldFrame`) + 1
            changeParent(item, this.#field.exportData.instance)
            this.#field.exportData.instance.sortChildren()
            bar.setMiniReelHoldItemByPositionIndex(r)

            if (typeof cell?.coinValue === `number`) {
              if (item.id === IDSpecial.Coin) {
                (item as unknown as ItemCoin).setInitialMultiplier(cell.coinValue)
              }
              if (item.id === IDSpecial.Jackpot) {
                const coinItem = item as unknown as ItemCoin
                coinItem.setInitialMultiplier(cell.coinValue)
                coinItem.setSkinByJackpotType(resolveJackpotType(cell.coinValue))
              }
              if (item.id === IDSpecial.Collector) {
                (item as unknown as ItemCollector).setInitialMultiplier(cell.coinValue)
              }
            }
          }
        }
      }
    }
  }

  constructor() {
    super()

    const fsm = new FSM<typeof FsmState, typeof this>(BUILD_CONFIG.MODE === `development`);
    fsm.setContext(this);

    fsm
      .next(FsmState.Intro, {
        enter: this.#onIntroState
      })
      .next(FsmState.WaitingForSpin, {
        from: [FsmState.Intro, FsmState.Spin],
        enter: this.#onWaitingForSpinState
      })
      .next(FsmState.Spin, {
        from: [FsmState.WaitingForSpin],
        enter: this.#onSpinState
      });

    this.#fsm = fsm;

    this.#create();

    game.onEnterFrame.add(() => {
      this.#fsm.process();
    });
  }

  #create() {
    this.#bindUi();
    this.#createComponents();
  }

  #onIntroState() {
    game.subscribeOnResize();

    const updateSlotTransform = ({ mobile, orientation }: { mobile: boolean; orientation?: string | null }) => {
      const scale = mobile ? 1.24 : 1
      this.y = mobile ? SLOT_Y_OFFSET_MOBILE : SLOT_Y_OFFSET_DESKTOP
      this.scale.set(scale)
      this.x = mobile ? (SAFE_ZONE_WIDTH * 0.5) * (1 - scale) : 0

      const isMobilePortrait = mobile && orientation === `PORTRAIT`
      const topCenterX = SAFE_ZONE_WIDTH * 0.5
      if (isMobilePortrait) {
        this.#train.scale.set(1.4)
        this.#train.alignCenter(topCenterX + 32, -20)
      } else {
        this.#train.scale.set(0.8)
        this.#train.alignCenter(topCenterX + 320, FIELD_TOP_OFFSET - 180)
      }
      this.#train.setMobilePortrait(isMobilePortrait)
    }

    game.onResize.add(updateSlotTransform)

    const currentProps = ui.screenProperties.value
    if (currentProps) {
      updateSlotTransform({ mobile: currentProps.mobile, orientation: currentProps.orientation })
    }

    this.#restoreState();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activeExtraBet = (ui as any).activeExtraBet?.value
    if (activeExtraBet && activeExtraBet !== ui.extraBetType.None) {
      this.#buyFeature.restore(activeExtraBet)
    }

    if (!this.#isRestoredRound) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentAny = (state as any)?.current
      const stateGrid = currentAny?.grid ?? currentAny?.reels

      if (stateGrid && Array.isArray(stateGrid)) {
        this.#field.fillFromStateGrid(stateGrid)
      } else {
        this.#field.fillWithDummyItems()
      }
    }

    const playIntroDemoAndContinue = () => {
      if (!this.#isRestoredRound) {
        this.#field.playIntroDemo()
      }
      this.#fsm.switch(FsmState.WaitingForSpin)
    }

    if (ui.showWelcomeScreen()) {
      this.#field.visible = false;
      this.#train.visible = false;
      this.#logo.visible = false;
      this.#welcomeScreen.show(() => {
        this.#field.visible = true;
        this.#train.visible = true;
        this.#logo.visible = true;
        playIntroDemoAndContinue()
      });
      ui.showWelcomeScreenLayout(true);
    } else {
      ui.reveal();
      playIntroDemoAndContinue()
    }
  }

  #restoreState() {
    const { round, current } = state

    if (round && !round.ended && round.actions.includes(`FINISH_ROUND`)) {
      if (current.freespins > 0) {
        this.#background.restore(true)
        this.#field.exportData.instance.setFreespinMode(true)
        this.#restoreFieldInBonusGameMode(current)
        this.#isRestoredRound = true
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #restoreFieldInBonusGameMode(current: any) {
    const grid = current.grid || current.reels
    if (!grid) {
      return
    }

    let collectorCol = -1
    let collectorRow = -1

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const cell = grid[c]?.[r]
        if (cell?.symbol === IDSpecial.Collector || cell === IDSpecial.Collector) {
          collectorCol = c
          collectorRow = r
          break
        }
      }
      if (collectorCol !== -1) break
    }

    if (collectorCol === -1 || collectorRow === -1) {
      return
    }

    const bars = this.#field.exportData.bars
    const bar = bars[collectorCol]
    bar.setMiniReelItemByPositionIndex(collectorRow, IDSpecial.Collector)
    bar.setMiniReelHoldItemByPositionIndex(collectorRow)

    const collectorItem = bar.getItemByPositionIndex(collectorRow)
    if (collectorItem && collectorItem.parent) {
      collectorItem.visible = true
      collectorItem.zIndex = this.#field.exportData.getLayerOrder(`FieldFrame`) + 1
      changeParent(collectorItem, this.#field.exportData.instance)
      this.#field.exportData.instance.sortChildren()

      const cell = grid[collectorCol]?.[collectorRow]
      const coinValue = cell?.coinValue
      if (typeof coinValue === `number`) {
        (collectorItem as unknown as ItemCollector).setInitialMultiplier(coinValue)
      }
    }
  }

  #onWaitingForSpinState(enterState: FsmState | null, exitState: FsmState | null) {
    this.#lastEnterState = enterState
    ui.setActionSkippable(false)
    this.#field.resetSkipProps()

    let freeSpins = 0

    switch (exitState) {
      case FsmState.Intro:
        queueMicrotask(() => {
          ui.executeActionRequest()
          ui.setUserActionsEnabled(true)
        })

        return

      case FsmState.Spin: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const gameState = (state.action as any)?.gameState
        freeSpins = gameState?.freespins ?? gameState?.freeSpins ?? 0

        const actionType = freeSpins > 0
          ? ui.ACTION_TYPE.FreeSpin
          : ui.ACTION_TYPE.Spin

        ui.setUserActionsEnabled(true)
        this.#isActionInProgress = false
        ui.endAction(actionType).catch(() => undefined)

        return
      }
    }

    if (!freeSpins) {
      ui.setUserActionsEnabled(true)
    }
  }

  async #onSpinState() {
    ui.setUserActionsEnabled(false)

    if (this.#pendingAction) {
      const action = this.#pendingAction as PendingAction
      this.#pendingAction = null

      const steps: GameStep[] = extractStepsFromAction(action)
      const extracted = extractSpinStateFromAction(action)

      const devtoolsValues = getDevtoolsValues()
      const turboMode = isTurboMode()
      const { transitionSettings, barSettings } = devtoolsValues

      const minSpinDuration = this.#field.isFreespinMode
        ? (barSettings.minSpinDuration?.freeSpins || 0)
        : (barSettings.minSpinDuration?.base || 0)

      if (minSpinDuration > 0 && this.#spinStartTime > 0) {
        const elapsedTime = (game.time * 1000) - this.#spinStartTime
        const remainingTime = Math.max(0, minSpinDuration - elapsedTime)

        if (remainingTime > 0) {
          await new Promise<void>((resolve) => {
            Tween.to({}, {}, { duration: remainingTime }).once(`complete`, resolve).start()
          })
        }
      }

      this.#trainAnimationManager.onSpin()
      const isBonusTrigger = extracted.freespins > 0 && !this.#field.isFreespinMode
      if (isBonusTrigger) {
        if (steps.length > 0) {
          await this.#stepsManager.startSpinAnimation(steps, true, this.#field.skipProps, this.#field.currentAnimation)
        }

        const bonusDelay = turboMode
          ? Math.min(transitionSettings.delayBeforeShowBonusGame, 200)
          : transitionSettings.delayBeforeShowBonusGame
        await new Promise<void>((resolve) => {
          Tween.to({}, {}, { duration: bonusDelay }).once(`complete`, resolve).start()
        })

        await this.#trainAnimationManager.onBonusTrigger()
        const freeSpinsInAnimation = this.#winBoard.getAnimation(WinBoardTypes.FreeSpinsIn)

        soundManager.onBonusGameStart()

        const backdropCoveredHandler = () => {
          this.#background.restore(true)
          this.#field.setFreespinMode(true)
          this.#field.clearAllMultiplierFrames()
          this.#field.hideFieldEffect()
          this.#field.hideIntrigueAnimation()

          const bars = this.#field.exportData.bars
          for (let c = 0; c < COLS; c++) {
            const bar = bars[c]
            for (let r = 0; r < ROWS; r++) {
              const item = bar.getItemByPositionIndex(r)

              if (item && item.id === IDSpecial.Collector) {
                bar.setMiniReelHoldItemByPositionIndex(r)
              } else {
                if (item && item.parent === this.#field.exportData.instance) {
                  this.#field.exportData.instance.removeChild(item)
                }
                bar.unsetHoldItemByPositionIndex(r)
                bar.setMiniReelEmptyByPositionIndex(r)
              }
            }
          }
        }

        eventBus.once(WinBoardEvent.BackdropCoveredFreeSpinsIn, backdropCoveredHandler)

        await new Promise<void>((resolve) => {
          freeSpinsInAnimation.once(`complete`, () => {
            resolve()
          })
          freeSpinsInAnimation.start()
        })
      } else if (steps.length > 0) {
        await this.#stepsManager.startSpinAnimation(steps, false, this.#field.skipProps, this.#field.currentAnimation)

        await new Promise<void>((resolve) => {
          Tween.to({}, {}, { duration: 250 }).once(`complete`, resolve).start()
        })
      }

      if (this.#field.isFreespinMode && extracted.roundEnd) {
        await new Promise<void>((resolve) => {
          Tween.to({}, {}, { duration: 1000 }).once(`complete`, resolve).start()
        })

        const roundWinnings = extracted.roundWinnings || state.current?.roundWinnings || 0
        const maxWinMultiplier = ruleSettings.maxWin || 5000
        const bet = ui.bet.value! || 1
        const isMaxWin = roundWinnings >= bet * maxWinMultiplier
        const totalWinDelay = turboMode
          ? Math.min(transitionSettings.delayBeforeShowTotalWin, 200)
          : transitionSettings.delayBeforeShowTotalWin
        await new Promise<void>((resolve) => {
          Tween.to({}, {}, { duration: totalWinDelay }).once(`complete`, resolve).start()
        })

        this.#winBoard.setFreeSpinsTotal(roundWinnings)
        const winAnimationType = isMaxWin ? WinBoardTypes.MaxWinIn : WinBoardTypes.TotalWinIn
        const winAnimation = this.#winBoard.getAnimation(winAnimationType)

        soundManager.onBonusGameEnd()

        const backdropCoveredHandler = () => {
          this.#background.restore(false)
          this.#field.setFreespinMode(false)
          this.#field.clearAllMultiplierFrames()

          const baseGrid = this.#extractBaseTriggerGridFromState()
          this.#restoreFieldFromGrid(baseGrid)
          this.#trainAnimationManager.reset()
        }

        const backdropEvent = isMaxWin
          ? WinBoardEvent.BackdropCoveredMaxWinIn
          : WinBoardEvent.BackdropCoveredTotalWinIn
        eventBus.once(backdropEvent, backdropCoveredHandler)

        await new Promise<void>((resolve) => {
          winAnimation.once(`complete`, resolve)
          winAnimation.start()
        })
      } else if (!this.#field.isFreespinMode) {
        const roundWinnings = extracted.roundWinnings || state.current?.roundWinnings || 0
        const maxWinMultiplier = ruleSettings.maxWin || 5000
        const bet = ui.bet.value! || 1
        const isBaseMaxWin = roundWinnings >= bet * maxWinMultiplier

        if (isBaseMaxWin) {
          await new Promise<void>((resolve) => {
            Tween.to({}, {}, { duration: 500 }).once(`complete`, resolve).start()
          })

          this.#winBoard.setFreeSpinsTotal(roundWinnings)
          const maxWinAnimation = this.#winBoard.getAnimation(WinBoardTypes.MaxWinIn)

          await new Promise<void>((resolve) => {
            maxWinAnimation.once(`complete`, resolve)
            maxWinAnimation.start()
          })
        }
      }
      soundManager.onSpinEnd()
      this.#fsm.switch(FsmState.WaitingForSpin)
    }
  }

  #createComponents() {
    this.#background = new Background()
    game.root.addChildAt(this.#background, 0);

    this.#backgroundSpineLayer = new BackgroundSpineLayer();
    this.#backgroundSpineLayer.setOffsets({ desktop: { x: 190, y: 200 } });
    game.root.addChildAt(this.#backgroundSpineLayer, 1);

    this.#train = new TrainSpine();
    this.#train.scale.set(0.8);
    this.addChild(this.#train);

    this.#trainAnimationManager = new TrainAnimationManager(this.#train);

    this.#field = new Field();
    this.addChild(this.#field);
    this.#field.initWinFrames();
    this.#logo = new LogoSpine();
    this.#logo.scale.set(0.94);
    this.addChild(this.#logo);

    this.#collectEffect = new CollectEffect();
    this.addChild(this.#collectEffect);

    const topCenterX = SAFE_ZONE_WIDTH * 0.5;
    this.#logo.alignTopCenter(topCenterX + 48, 140);
    this.#train.alignCenter(topCenterX + 320, FIELD_TOP_OFFSET - 180);

    this.#buyFeature = game.root.addChild(new BuyFeature());
    this.#winBoard = this.addChild(new WinBoard());

    this.#stepsManager = new StepsManager({
      fieldData: {
        ...this.#field.exportData,
        train: this.#train,
        collectEffect: this.#collectEffect,
        trainAnimationManager: this.#trainAnimationManager
      },
      winBoard: this.#winBoard
    });

    this.#winBoard.setFieldInstance(this.#field);

    soundManager.init({
      idleTheme: { name: `idle_theme`, volume: 0.3 },
      baseTheme: { name: `base_theme`, volume: 0.3 },
      bonusTheme: { name: `bonus_theme`, volume: 0.3 }
    });

    this.#winBoard.setSoundsThemeInstance(soundManager.themeManager);
    this.#welcomeScreen = new WelcomeScreen(() => {
      this.#onWelcomeScreenClosed();
    });

    game.root.addChild(this.#welcomeScreen);
  }

  #bindUi() {
    ui.setUserActionsEnabled(true);
    ui.setGameTitle(`GOLD POWER EXPRESS`);

    ui.volume.bind((volume) => { Howler.volume(volume) });
    ui.muted.bind((muted) => { Howler.mute(muted) });

    if (ui.themeMuted) {
      ui.themeMuted.bind((muted) => { soundManager.muteTheme(muted) })
    }

    if (ui.soundEffectMuted) {
      ui.soundEffectMuted.bind((muted) => { soundManager.muteSfx(muted) })
    }
    ui.setVisibilityHandler((isHidden) => {
      if (isHidden) {
        game.ticker.stop()
      } else {
        game.ticker.start()
      }
    });

    ui.setActionButtonHandlers({
      action: () => this.#onAction(),
      skip: () => this.#onSkip()
    });

    ui.setActionStartHandler(async (_payload, deferrerAction) => {
      await this.#handleActionResponse(deferrerAction);
    });

    ui.setBuyFeatureButtonHandler({
      onClick: () => {
        this.#field.visible = false;
        this.#train.visible = false;
        this.#logo.visible = false;
        this.#buyFeature.show();
      },
      onClose: () => {
        this.#buyFeature.hide();
        this.#field.visible = true;
        this.#train.visible = true;
        this.#logo.visible = true;
      }
    })

    eventBus.on(GameEvents.EmulateClick, () => {
      if (this.#fsm.state === FsmState.WaitingForSpin) {
        this.#onAction()
      }
    })
  }

  #onAction() {
    if (this.#fsm.state === FsmState.WaitingForSpin && !this.#isActionInProgress) {
      this.#isActionInProgress = true

      playSfx(`play_button`, 0.5)
      ui.startActionIntent({});
    }
  }

  async #handleActionResponse(deferrerAction: Promise<unknown>) {
    this.#isActionInProgress = true;

    this.#field.resetSkipProps()
    ui.setActionSkippable(true);

    await this.#field.endSpinAnimation();

    this.#spinStartTime = game.time * 1000;

    soundManager.onSpinStart(this.#field.isFreespinMode)

    if (this.#field.isFreespinMode) {
      await this.#field.startBeforeSpinAnimationFreeSpins();
    } else {
      await this.#field.startBeforeSpinAnimation();
    }

    const action = await deferrerAction as { ok: boolean } & Record<string, unknown>;

    if (!action.ok) {
      this.#isActionInProgress = false;

      if (this.#fsm.canSwitch(FsmState.WaitingForSpin)) {
        this.#fsm.switch(FsmState.WaitingForSpin);
      }

      return;
    }

    this.#pendingAction = action;

    if (this.#fsm.canSwitch(FsmState.Spin)) {
      this.#fsm.switch(FsmState.Spin);
    }
  }

  #onSkip() {
    this.#field.callSkip()
    ui.setActionSkippable(false)
    ui.setUserActionsEnabled(false)
  }

  #onWelcomeScreenClosed() {
    ui.showWelcomeScreenLayout(false);
    this.#welcomeScreen.hide();
    this.#field.visible = true;
    this.#train.visible = true;
    this.#logo.visible = true;
    this.#fsm.switch(FsmState.WaitingForSpin);
  }
}
