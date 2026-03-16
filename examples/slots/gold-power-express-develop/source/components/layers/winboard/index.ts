import { BitmapText, Container, Sprite, Texture } from 'pixi.js'
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { MiniSignal } from 'mini-signals'
import { Chain, IndefiniteTween, Parallel, Tween, endTweenIfExist, remove, quadInOut, stopTweenIfExist } from '@/gkit/tweens'

import bigwinsSpine from '@/assets/spine/bigwins/skeleton'
import fonts from '@/assets/fonts/bitmap.gen'
import i18n from '@/assets/i18n/text.json'

import game, { eventBus } from '@/game/game'
import type { onResizeProps } from '@/types'
import { ui } from '@clawbuster/facade'
import TextureNumber from '@/components/texture-number'
import WinBoardNumbers from './win-board-numbers'
import Ratchet from '@/components/ratchet'
import { GAME_HEIGHT, GAME_WIDTH, SAFE_ZONE_HEIGHT, SAFE_ZONE_WIDTH } from '@/const'

import {
  WinBoardTypes,
  WinBoardEvent,
  WinGradesTypes,
  WIN_GRADES,
  DEFAULT_ANIMATION_TIME_IN_SEC,
  MAX_GRADE,
  PAUSE_DURATION,
  MAX_GRADE_ANIMATION_TIME,
  FreeSpinsMode
} from './config'
import BonusModal from '@/components/bonus-modal'
import type { IDBase, IDSpecial } from '@/components/items/const'
import soundsSfx from '@/assets/sounds/sfx/sound.gen'

const SPINE_Y = -80
const NUMBERS_START_Y = 20
const NUMBERS_BIG_Y = NUMBERS_START_Y + 180
const CLICK_TO_CONTINUE_BASE_Y = 350
const CLICK_TO_CONTINUE_Y_OFFSET_RATIO = 0.1

const DEFAULT_BG_ALPHA = 0.92

const FREESPINS_NUMBERS_DEFAULT_Y = 20

interface RatchetData {
  instance: Ratchet,
  listeners: {
    onTick?: () => void,
    onEnd?: () => void
  }
}

export default class WinBoard extends Container {
  #defaultScale: number = 1
  #winsSpine!: Spine
  #winsNumbers!: WinBoardNumbers
  #winGrade!: WinGradesTypes
  #isCounting: boolean = false
  #startWord: string = ``
  #isWinOutCalled: boolean = false
  #bg: Sprite
  xWinnings: number = 0
  onWinSpineClick: MiniSignal
  currentGradeType!: WinGradesTypes
  #popupText: BitmapText
  #currencyText: BitmapText
  #linkOnEnterFrame
  #freeSpinsModal!: BonusModal
  #freeSpinsNumbers!: TextureNumber
  #freeSpinsTotal: number = 0
  #isFreeSpinsOutCalled: boolean = false
  onFreeSpinsModalClick: MiniSignal
  #bonusScatters: (IDBase | IDSpecial)[] = []
  #freeSpinsCount: number = 0

  #skip = {
    [WinBoardTypes.WinIn]: false,
    [WinBoardTypes.WinOut]: false,
    [WinBoardTypes.FreeSpinsIn]: false,
    [WinBoardTypes.FreeSpinsOut]: false,
    [WinBoardTypes.TotalWinIn]: false,
    [WinBoardTypes.TotalWinOut]: false,
    [WinBoardTypes.MaxWinIn]: false,
    [WinBoardTypes.MaxWinOut]: false
  }

  #winCountSoundId: number | null = null
  #bigWinSoundId: number | null = null
  #popupTextPulseTween: ReturnType<typeof Tween.fromTo> | null = null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  #fieldInstance: any = null
  #soundThemeInstance: {
    fadeOutTheme: (volume: number, duration: number) => void
    fadeInTheme: (volume: number, duration: number) => void
  } | null = null
  #immediatelySkip: boolean = false

  constructor() {
    super()

    this.x = SAFE_ZONE_WIDTH * 0.5
    this.y = (GAME_HEIGHT * 0.5) - (((GAME_HEIGHT / 2) - (SAFE_ZONE_HEIGHT / 2)) / 2)

    const bg = this.addChild(new Sprite(Texture.WHITE))
    bg.anchor.set(0.5)
    bg.width = GAME_WIDTH
    bg.height = GAME_HEIGHT
    bg.tint = 0x0C0114
    bg.alpha = 0
    bg.visible = false

    this.#bg = bg

    this.#initWinsSpine()
    this.#initFreeSpinsModal()

    this.onWinSpineClick = new MiniSignal()
    this.onFreeSpinsModalClick = new MiniSignal()

    this.on(`pointertap`, () => {
      this.emitClick()
    })

    this.#linkOnEnterFrame = game.onEnterFrame.add((dt) => this.#onEnterFrame(dt))

    this.#popupText = this.addChild(new BitmapText({
      text: ``,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 36,
        fill: 0xFFFFFF,
        align: `center`
      }
    }))

    this.#popupText.anchor.set(0.5)
    this.#popupText.y = (GAME_HEIGHT / 2) - 124

    this.#currencyText = this.addChild(new BitmapText({
      text: ui.getCurrencySign(),
      style: {
        ...fonts.montserratExtraBold,
        fill: 0xFFFFFF,
        fontSize: 58,
        align: `center`
      }
    }))

    this.#currencyText.tint = 0xFFDB2D
    this.#currencyText.alpha = 0
    this.#currencyText.visible = false
    this.#currencyText.anchor.set(0.5)
    this.visible = false

    eventBus.on(`WinBoardSkip`, (type: WinBoardTypes) => {
      this.#skip[type] = true
    })

    eventBus.on(`WinBoardSkipBySpace`, () => {
      this.emitClick()
    })

    game.onResize.add((options) => this.#onResize(options))
  }

  emitClick() {
    this.onWinSpineClick.dispatch()
    this.onFreeSpinsModalClick.dispatch()
  }

  #onEnterFrame(dt: number) {
    if (this.visible) {
      this.#winsSpine.update(dt)
    }
  }

  #onResize(options: onResizeProps) {
    this.#bg.width = options.viewport.width * (1 / options.safeRectRatioScale) * 2
    this.#bg.height = options.viewport.height * (1 / options.safeRectRatioScale) * 2

    if (this.visible && this.#popupText.visible && this.#winGrade !== WinGradesTypes.Small) {
      this.#popupText.y = CLICK_TO_CONTINUE_BASE_Y + (options.viewport.height * CLICK_TO_CONTINUE_Y_OFFSET_RATIO)
    } else {
      this.#popupText.y = options.mobile ? 600 : (options.viewport.height / 2) - 100
    }

    this.#freeSpinsModal.scale.set(options.mobile ? 1.5 : 1)
  }

  #initWinsSpine() {
    this.#winsSpine = this.addChild(new Spine(bigwinsSpine.spineData))
    this.#winsSpine.autoUpdate = false
    this.#winsSpine.scale.set(this.#defaultScale)
    this.#winsSpine.alpha = 0

    this.#winsNumbers = this.addChild(new WinBoardNumbers())
    this.#winsNumbers.setFormattingSettings({ postConvertValue: true })
    this.#winsNumbers.setSize(96)
    this.#winsNumbers.alpha = 0

    this.#winsSpine.visible = false
    this.#winsNumbers.visible = false
    this.#winsNumbers.alpha = 0

    const listener = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      event: (entry: any, event: any) => {
        switch (event.data.name) {
          case `big`:
            eventBus.emit(WinBoardEvent.Big)
            break
          case `sweet`:
            eventBus.emit(WinBoardEvent.Sweet)
            break
          case `victor`:
            eventBus.emit(WinBoardEvent.Victory)
            break
          case `legend`:
            eventBus.emit(WinBoardEvent.Legend)
            break
        }
      }
    }

    this.#winsSpine.state.addListener(listener)
  }

  #initFreeSpinsModal() {
    this.#freeSpinsModal = this.addChild(new BonusModal())
    this.#freeSpinsModal.alpha = 0

    this.#freeSpinsNumbers = this.addChild(new TextureNumber())
    this.#freeSpinsNumbers.setFormattingSettings({ postConvertValue: true })
    this.#freeSpinsNumbers.setSize(120)
    this.#freeSpinsNumbers.alpha = 0
    this.#freeSpinsNumbers.y = 20

    this.#freeSpinsModal.visible = false
    this.#freeSpinsNumbers.visible = false
  }

  isShowWin() {
    return this.#winsSpine.visible
  }

  isShowFreeSpinModal() {
    return this.#freeSpinsModal.visible
  }

  isCounting() {
    return this.#isCounting
  }

  setWinnings(winnings: number) {
    this.#winsNumbers.value = winnings
  }

  setXWinnings(xWinnings: number) {
    this.xWinnings = xWinnings
  }

  setWinGrade(grade: WinGradesTypes) {
    this.#winGrade = grade
  }

  setFreeSpinsTotal(value: number) {
    this.#freeSpinsTotal = value
    this.#freeSpinsModal.setTotalWinValue(value)
  }

  setFreeSpinsCount(value: number) {
    this.#freeSpinsCount = value
  }

  setBonusScatters(scattersIds: (IDBase | IDSpecial)[]) {
    this.#bonusScatters.push(...scattersIds)
  }

  getAnimation(type: WinBoardTypes) {
    const { mobile } = ui.screenProperties.value!
    this.#startWord = mobile ? i18n.winBoard.popUp.tap : i18n.winBoard.popUp.click

    switch (type) {
      case WinBoardTypes.WinIn:
        return this.#getWinInAnimation()
      case WinBoardTypes.WinOut:
        return this.#getWinOutAnimation()
      case WinBoardTypes.FreeSpinsIn:
        return this.#getFreeSpinsInAnimationByType(FreeSpinsMode.Default)
      case WinBoardTypes.FreeSpinsOut:
        return this.#getFreeSpinsOutAnimationByType(FreeSpinsMode.Default)
      case WinBoardTypes.TotalWinIn:
        return this.#getFreeSpinsInAnimationByType(FreeSpinsMode.Total)
      case WinBoardTypes.TotalWinOut:
        return this.#getFreeSpinsOutAnimationByType(FreeSpinsMode.Total)
      case WinBoardTypes.MaxWinIn:
        return this.#getFreeSpinsInAnimationByType(FreeSpinsMode.MaxWin)
      case WinBoardTypes.MaxWinOut:
        return this.#getFreeSpinsOutAnimationByType(FreeSpinsMode.MaxWin)
      default:
        throw new Error(`Win board type: ${type}, doesn't exist`)
    }
  }

  #enableInteraction() {
    this.eventMode = `static`
    this.cursor = `pointer`
  }

  #disableInteraction() {
    this.eventMode = `none`
    this.cursor = `default`
  }

  #getWinInAnimation() {
    return new IndefiniteTween((stopTween: () => void) => {
      if (this.#immediatelySkip && this.#winGrade === WinGradesTypes.Small) {
        stopTween()

        return
      }

      this.#winsSpine.skeleton.setToSetupPose()

      if (this.#winGrade === WinGradesTypes.Small) {
        this.#winsNumbers.position.y = ((GAME_HEIGHT / 2) - (SAFE_ZONE_HEIGHT / 2)) / 2
        this.#winsNumbers.setSize(64)
      } else {
        ui.gameFullScreenModal(true)

        this.#winsNumbers.position.y = NUMBERS_START_Y

        const screeProperties = ui.screenProperties.value!
        this.#winsNumbers.setSize(screeProperties.mobile ? 140 : 96)

        this.#winsSpine.position.y = SPINE_Y
        this.#winsSpine.scale.set(screeProperties.mobile ? 1.5 : 1.1)
      }

      this.visible = true
      this.#winsSpine.visible = true
      this.#winsNumbers.visible = this.#winGrade !== WinGradesTypes.Small

      const showParallel = new Parallel()

      const outSpineTween = Tween.to(this.#winsSpine, { alpha: 1 }, { duration: 150 })
      const outNumbersTween = Tween.to(this.#winsNumbers, { alpha: 1 }, { duration: 150 })
      showParallel.add(outSpineTween, outNumbersTween)

      if (this.#winGrade !== WinGradesTypes.Small) {
        this.#bg.visible = true
        this.#winsNumbers.enableShadow()

        this.#currencyText.visible = true
        this.#currencyText.y = this.#winsNumbers.y
          + (this.#winsNumbers.height / 2)
          + (this.#currencyText.height / 2)
          + 45

        showParallel.add(Tween.to(this.#currencyText, { alpha: 1 }, { duration: 150 }))

        const bgTween = Tween.to(this.#bg, { alpha: DEFAULT_BG_ALPHA }, { duration: 150 })

        showParallel.add(bgTween)

        if (this.#fieldInstance && this.#fieldInstance.hideAnimation) {
          showParallel.add(this.#fieldInstance.hideAnimation(150))
        }
      } else {
        this.#winsNumbers.enableShadow()

        showParallel.add(this.#winsNumbers.getShowShadowTween())
      }

      showParallel.start()

      const animationStages = [
        WinGradesTypes.Big,
        WinGradesTypes.Sweet,
        WinGradesTypes.Victory,
        WinGradesTypes.Legend
      ] as const satisfies readonly Exclude<WinGradesTypes, WinGradesTypes.Small>[]

      const winnings = this.#winsNumbers.value
      this.#winsNumbers.value = this.#winGrade === WinGradesTypes.Small ? winnings : 0

      const mainChain = new Chain()

      mainChain.once(`start`, () => {
        if (this.#winGrade !== WinGradesTypes.Small) {
          this.#enableInteraction()

          if (this.#soundThemeInstance && this.#soundThemeInstance.fadeOutTheme) {
            this.#soundThemeInstance.fadeOutTheme(0.1, 1000)
          }

          eventBus.emit(`default_win`)

          this.#popupText.text = `${this.#startWord} ${i18n.winBoard.popUp.toContinue}`
          this.#popupText.y = CLICK_TO_CONTINUE_BASE_Y + (GAME_HEIGHT * CLICK_TO_CONTINUE_Y_OFFSET_RATIO)
          this.#popupText.visible = true
          this.#startPopupTextPulse()
        }
      })

      this.currentGradeType = WinGradesTypes.Small

      if (this.#winGrade !== WinGradesTypes.Small && this.#winGrade !== WinGradesTypes.Big) {
        const animationMaxLevel = animationStages.findIndex((stage) => stage === this.#winGrade)

        for (let i = 0; i <= animationMaxLevel; i++) {
          const stage = animationStages[i]

          const gradeValue = WIN_GRADES[stage] * ui.bet.value!

          let ratchet: RatchetData | null = {
            instance: new Ratchet({
              divider: Math.ceil(gradeValue / DEFAULT_ANIMATION_TIME_IN_SEC / 20),
              startValue: this.#winsNumbers.value,
              endValue: gradeValue
            }),

            listeners: {
              onTick: () => {
                this.#playWinCountSound()
              }
            }
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let listenerLink: any

          mainChain.add(
            Tween
              .to(this.#winsNumbers, { value: gradeValue }, { duration: DEFAULT_ANIMATION_TIME_IN_SEC * 1000 })
              .once(`start`, () => {
                listenerLink = ratchet!.instance.onTick!.add(ratchet!.listeners.onTick!)

                this.#isCounting = true
              })
              .on(`update`, () => {
                ratchet!.instance.update(this.#winsNumbers.value)
              })
              .once(`complete`, () => {
                ratchet!.instance.onTick!.detach(listenerLink!)

                this.#stopWinCountSound()

                ratchet!.instance.destroy()
                ratchet = null
              })
          )
        }
      }

      const currentGradeX = this.#winGrade === WinGradesTypes.Small
        ? 0
        : WIN_GRADES[this.#winGrade]

      let nextGradeX

      switch (currentGradeX) {
        case 0:
          nextGradeX = WIN_GRADES.BIG
          break
        case WIN_GRADES.BIG:
          nextGradeX = WIN_GRADES.SWEET
          break
        case WIN_GRADES.SWEET:
          nextGradeX = WIN_GRADES.VICTORY
          break
        case WIN_GRADES.VICTORY:
          nextGradeX = WIN_GRADES.LEGEND
          break
        default:
          nextGradeX = MAX_GRADE
      }

      let additionalTime = 0

      if (this.#winGrade === WinGradesTypes.Legend) {
        const diffX = this.xWinnings - currentGradeX
        const diffGradeX = nextGradeX - currentGradeX

        const gradeTimeDiff = MAX_GRADE_ANIMATION_TIME
          - (DEFAULT_ANIMATION_TIME_IN_SEC * (animationStages.length - 1))

        const lastStageTime = (diffX * gradeTimeDiff) / diffGradeX
        additionalTime = lastStageTime > MAX_GRADE_ANIMATION_TIME
          ? MAX_GRADE_ANIMATION_TIME
          : lastStageTime
      }

      const lastAnimationDuration = this.#winGrade === WinGradesTypes.Small
        ? 0.8
        : DEFAULT_ANIMATION_TIME_IN_SEC + additionalTime

      let ratchet: RatchetData | null = {
        instance: new Ratchet({
          divider: Math.ceil(winnings / lastAnimationDuration / 20),
          startValue: this.#winsNumbers.value,
          endValue: winnings
        }),

        listeners: {
          onTick: () => {
            this.#playWinCountSound()
          },

          onEnd: () => {
            this.#stopWinCountSound()
            soundsSfx.volume(soundsSfx.play(`total_win`), 0.3)
          }
        }
      }

      const winNumbersTween = Tween
        .to(
          this.#winsNumbers,
          { value: winnings },
          { duration: lastAnimationDuration * 1000 }
        )
        .once(`start`, () => {
          ratchet!.instance.onTick!.add(ratchet!.listeners.onTick!)
          ratchet!.instance.onEnd!.add(ratchet!.listeners.onEnd!)
        })
        .on(`update`, () => {
          ratchet!.instance.update(this.#winsNumbers.value)
        })
        .once(`complete`, () => {
          this.#isCounting = false

          this.#stopWinCountSound()

          ratchet!.instance.destroy()
          ratchet = null
        })

      mainChain.add(winNumbersTween)

      const fastCompleteTweenListener = () => {
        this.#stopWinCountSound()
        endTweenIfExist(mainChain)
      }
      const linkOnFastComplete = this.onWinSpineClick.add(fastCompleteTweenListener)

      mainChain
        .once(`complete`, () => {
          this.#changeWinInState()

          this.onWinSpineClick.detach(linkOnFastComplete)

          if (this.#winGrade !== WinGradesTypes.Small) {
            soundsSfx.volume(soundsSfx.play(`total_win`), 0.4)
          }

          let completeByDuration: Tween | null = null

          const winOutAnimationListener = () => {
            const winOutAnimation = this.#getWinOutAnimation()

            winOutAnimation.start()

            if (completeByDuration) {
              remove(completeByDuration)
            }

            this.onWinSpineClick.detachAll()
          }

          completeByDuration = Tween.wait(5000).once(`complete`, () => {
            winOutAnimationListener()
          })

          completeByDuration.start()

          this.onWinSpineClick.add(winOutAnimationListener)

          if (this.#winGrade !== WinGradesTypes.Small && this.#soundThemeInstance && this.#soundThemeInstance.fadeInTheme) {
            this.#soundThemeInstance.fadeInTheme(0.1, 1000)
          }
        })
        .once(`start`, () => {
          if (this.#winGrade === WinGradesTypes.Small) {
            eventBus.emit(WinBoardEvent.Win)
          }
        })
        .on(`update`, () => {
          if (this.#skip[WinBoardTypes.WinIn]) {
            fastCompleteTweenListener()

            this.#skip[WinBoardTypes.WinIn] = false
          }

          this.#changeWinInState()
        })

      const subChain = new Chain()

      subChain
        .add(mainChain)
        .once(`complete`, () => {
          this.#skip[WinBoardTypes.WinIn] = false

          stopTween()
        })

      if (this.#winGrade !== WinGradesTypes.Small) {
        subChain.add(Tween.to({}, {}, { duration: PAUSE_DURATION * 1000 }))
      }

      subChain.start()
    })
  }

  #changeWinInState() {
    if (this.#winGrade === WinGradesTypes.Small) {
      return
    }

    if (this.currentGradeType === WinGradesTypes.Small) {
      this.#winsSpine.state.setAnimation(0, `big_start`, false)
      this.#winsSpine.state.addAnimation(0, `big_loop`, true)

      const screeProperties = ui.screenProperties.value!
      const endPoint = screeProperties.mobile ? NUMBERS_BIG_Y + 50 : NUMBERS_BIG_Y

      Tween.to(this.#winsNumbers, { y: endPoint }, { duration: 250 }).start()
      Tween.to(this.#currencyText, { y: endPoint + 65 + (this.#currencyText.height / 2) }, { duration: 250 }).start()

      this.#playBigWinSound(`big_catch`)
      this.currentGradeType = WinGradesTypes.Big
    }

    if (this.#winsNumbers.value >= WIN_GRADES.SWEET * ui.bet.value!
      && this.currentGradeType === WinGradesTypes.Big) {
      this.#winsSpine.state.setAnimation(0, `super_start`, false)
      this.#winsSpine.state.addAnimation(0, `super_loop`, true)

      this.#playBigWinSound(`sweet_catch`)
      this.currentGradeType = WinGradesTypes.Sweet
    }

    if (this.#winsNumbers.value >= WIN_GRADES.VICTORY * ui.bet.value!
      && this.currentGradeType === WinGradesTypes.Sweet) {
      this.#winsSpine.state.setAnimation(0, `epic_start`, false)
      this.#winsSpine.state.addAnimation(0, `epic_loop`, true)

      this.#playBigWinSound(`victorious_catch`)
      this.currentGradeType = WinGradesTypes.Victory
    }

    if (this.#winsNumbers.value >= WIN_GRADES.LEGEND * ui.bet.value!
      && this.currentGradeType === WinGradesTypes.Victory) {
      this.#winsSpine.state.setAnimation(0, `mega_start`, false)
      this.#winsSpine.state.addAnimation(0, `mega_loop`, true)

      this.#playBigWinSound(`legendary_catch`)
      this.currentGradeType = WinGradesTypes.Legend
    }
  }

  #getWinOutAnimation() {
    return new IndefiniteTween((stopTween: () => void) => {
      if (!this.visible || this.#isWinOutCalled) {
        this.#immediatelySkip = false

        stopTween()

        return
      }

      this.#isWinOutCalled = true

      this.#disableInteraction()
      this.onWinSpineClick.detachAll()

      const mainParallel = new Parallel()

      mainParallel.once(`start`, () => {
        ui.gameFullScreenModal(false)
      })

      const duration = this.#immediatelySkip ? 50 : 250
      const outSpineTween = Tween.to(this.#winsSpine, { alpha: 0 }, { duration })
      const outNumbersTween = Tween.to(this.#winsNumbers, { alpha: 0 }, { duration })

      mainParallel.add(outSpineTween, outNumbersTween)

      if (this.#winGrade !== WinGradesTypes.Small) {
        const bgTween = Tween.to(this.#bg, { alpha: 0 }, { duration })
        const outCurrencyText = Tween.to(this.#currencyText, { alpha: 0 }, { duration: 150 })
        const outPopupText = Tween.to(this.#popupText, { alpha: 0 }, { duration: 150 })

        mainParallel.add(bgTween, outCurrencyText, outPopupText)

        if (this.#fieldInstance && this.#fieldInstance.revealAnimation) {
          mainParallel.add(this.#fieldInstance.revealAnimation(duration))
        }
      } else {
        mainParallel.add(this.#winsNumbers.getHideShadowTween())
      }

      mainParallel.on(`update`, () => {
        if (this.#skip[WinBoardTypes.WinOut]) {
          endTweenIfExist(mainParallel)

          this.#skip[WinBoardTypes.WinOut] = false
        }
      })

      mainParallel.once(`complete`, () => {
        this.#playWinGradeEndSound()

        this.#winsSpine.state.clearTrack(0)
        this.visible = false
        this.#winsSpine.visible = false
        this.#winsNumbers.visible = false
        this.#bg.visible = false
        this.#winsNumbers.value = 0
        this.#currencyText.visible = false
        this.#popupText.visible = false
        this.#popupText.alpha = 0
        this.#stopPopupTextPulse()
        this.#immediatelySkip = false
        this.#winsNumbers.disableShadow()
        this.#isWinOutCalled = false
        this.#skip[WinBoardTypes.WinOut] = false

        stopTween()
      })

      mainParallel.start()
    })
  }

  #getFreeSpinsInAnimationByType(type: FreeSpinsMode) {
    const isTotal = type === FreeSpinsMode.Total || type === FreeSpinsMode.MaxWin
    const isMaxWin = type === FreeSpinsMode.MaxWin

    return new IndefiniteTween((stopTween: () => void) => {
      ui.gameFullScreenModal(true)
      this.#freeSpinsModal.setTotalMode(isTotal, isMaxWin)

      const screenProperties = ui.screenProperties.value!

      if (screenProperties.mobile) {
        this.#freeSpinsModal.y = screenProperties.safeViewportRect.height / 2
        this.#freeSpinsNumbers.y = FREESPINS_NUMBERS_DEFAULT_Y + (screenProperties.safeViewportRect.height / 2)

        this.#popupText.y = this.#freeSpinsModal.y + 600
      } else {
        this.#popupText.y = this.#freeSpinsModal.y + 400
      }

      eventBus.emit(`open_bonus_model`, isTotal)
      this.#popupText.alpha = 0
      this.#popupText.visible = false
      this.#stopPopupTextPulse()
      this.visible = true
      this.#freeSpinsModal.visible = true
      this.#bg.visible = true

      const mainChain = new Chain()

      if (!isTotal) {
        this.#freeSpinsModal.setItems(this.#bonusScatters)
      }

      const showParallel = new Parallel()

      showParallel.add(
        this.#freeSpinsModal.getShowTween(),
        Tween.to(this.#bg, { alpha: DEFAULT_BG_ALPHA }, { duration: 300 })
      )

      showParallel.once(`complete`, () => {
        if (isMaxWin) {
          eventBus.emit(WinBoardEvent.BackdropCoveredMaxWinIn)
        } else if (isTotal) {
          eventBus.emit(WinBoardEvent.BackdropCoveredTotalWinIn)
        } else {
          eventBus.emit(WinBoardEvent.BackdropCoveredFreeSpinsIn)
        }
      })

      mainChain.add(showParallel)

      const subParallel = new Parallel()

      if (isTotal) {
        subParallel.once(`start`, () => {
          soundsSfx.volume(soundsSfx.play(`bg_coins_totalwin_panel`), 0.4)
          eventBus.emit(WinBoardEvent.AfterTotalWinIn)
        })
      }

      subParallel.add(
        Tween.to({}, {}, { duration: 0 }).once(`start`, () => {
          this.#enableInteraction()
        })
      )

      mainChain.add(subParallel)

      const fastCompleteTweenListener = () => {
        this.#stopWinCountSound()
        endTweenIfExist(mainChain)
      }
      const linkOnFastComplete = this.onFreeSpinsModalClick.add(fastCompleteTweenListener)

      mainChain.once(`start`, () => {
        if (isTotal) {
          soundsSfx.volume(soundsSfx.play(`bg_coins_totalwin`), 0.5)
        } else {
          soundsSfx.volume(soundsSfx.play(`bg_transition`), 0.5)
          eventBus.emit(WinBoardEvent.FreeSpinsIn)
        }
      })

      let currentWinBoardType = WinBoardTypes.FreeSpinsIn
      if (isMaxWin) currentWinBoardType = WinBoardTypes.MaxWinIn
      else if (isTotal) currentWinBoardType = WinBoardTypes.TotalWinIn

      mainChain.on(`update`, () => {
        if (this.#skip[currentWinBoardType]) {
          endTweenIfExist(mainChain)

          this.#skip[currentWinBoardType] = false
        }
      })

      mainChain.once(`complete`, () => {
        this.onFreeSpinsModalClick.detach(linkOnFastComplete)

        const freeSpinsOutAnimationListener = () => {
          const freeSpinsOutAnimation = this.#getFreeSpinsOutAnimationByType(type)

          freeSpinsOutAnimation.start()
          freeSpinsOutAnimation.once(`complete`, () => {
            stopTween()
          })

          this.onFreeSpinsModalClick.detachAll()
        }

        this.onFreeSpinsModalClick.add(freeSpinsOutAnimationListener)
        this.#skip[currentWinBoardType] = false
      })

      mainChain.start()
    })
  }

  #getFreeSpinsOutAnimationByType(type: FreeSpinsMode) {
    return new IndefiniteTween((stopTween) => {
      if (!this.visible || this.#isFreeSpinsOutCalled) {
        stopTween()

        return
      }

      this.#isFreeSpinsOutCalled = true
      this.#disableInteraction()
      this.onFreeSpinsModalClick.detachAll()

      const mainParallel = new Parallel()

      mainParallel.once(`start`, () => {
        ui.gameFullScreenModal(false)
      })

      mainParallel.add(
        this.#freeSpinsModal.getHideTween(),
        Tween.to(this.#popupText, { alpha: 0 }, { duration: 300 }),
        Tween.to(this.#bg, { alpha: 0 }, { duration: 300 })
      )

      let currentWinBoardType = WinBoardTypes.FreeSpinsIn
      if (type === FreeSpinsMode.MaxWin) currentWinBoardType = WinBoardTypes.MaxWinIn
      else if (type === FreeSpinsMode.Total) currentWinBoardType = WinBoardTypes.TotalWinIn

      mainParallel.on(`update`, () => {
        if (this.#skip[currentWinBoardType]) {
          endTweenIfExist(mainParallel)

          this.#skip[currentWinBoardType] = false
        }
      })

      mainParallel.once(`complete`, () => {
        this.visible = false
        this.#freeSpinsModal.visible = false
        this.#bg.visible = false

        if (type === FreeSpinsMode.Total || type === FreeSpinsMode.MaxWin) {
          this.#freeSpinsTotal = 0
          this.#freeSpinsCount = 0
          this.#bonusScatters.length = 0
        }

        this.#isFreeSpinsOutCalled = false
        this.#skip[currentWinBoardType] = false

        stopTween()
      })

      mainParallel.start()
    })
  }

  #playWinCountSound() {
    if (this.#winCountSoundId !== null) {
      return
    }

    this.#winCountSoundId = soundsSfx.play(`line_hit`)
    soundsSfx.volume(this.#winCountSoundId, 0.3)
    soundsSfx.loop(this.#winCountSoundId, true)
  }

  #stopWinCountSound() {
    if (this.#winCountSoundId !== null) {
      soundsSfx.stop(this.#winCountSoundId)
      this.#winCountSoundId = null
    }
  }

  #playBigWinSound(soundName: string) {
    if (this.#bigWinSoundId !== null) {
      soundsSfx.stop(this.#bigWinSoundId)
    }

    this.#bigWinSoundId = soundsSfx.play(soundName)
    soundsSfx.volume(this.#bigWinSoundId, 0.4)
  }

  #stopBigWinSound() {
    if (this.#bigWinSoundId !== null) {
      soundsSfx.stop(this.#bigWinSoundId)
      this.#bigWinSoundId = null
    }
  }

  #playWinGradeEndSound() {
    this.#stopBigWinSound()

    const endSoundMap: Record<string, string> = {
      [WinGradesTypes.Big]: `big_catch_end`,
      [WinGradesTypes.Sweet]: `sweet_catch_end`,
      [WinGradesTypes.Victory]: `victorious_catch_end`,
      [WinGradesTypes.Legend]: `legendary_catch_end`
    }

    const soundName = endSoundMap[this.currentGradeType]
    if (soundName) {
      soundsSfx.volume(soundsSfx.play(soundName), 0.3)
    }
  }

  setImmediatelySkip(value: boolean) {
    this.#immediatelySkip = value
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFieldInstance(instance: any) {
    this.#fieldInstance = instance
  }

  setSoundsThemeInstance(instance: {
    fadeOutTheme: (volume: number, duration: number) => void
    fadeInTheme: (volume: number, duration: number) => void
  }) {
    this.#soundThemeInstance = instance
  }

  #startPopupTextPulse() {
    if (this.#popupTextPulseTween) {
      stopTweenIfExist(this.#popupTextPulseTween)
      this.#popupTextPulseTween = null
    }

    this.#popupText.alpha = 0.75

    this.#popupTextPulseTween = Tween.fromTo(
      this.#popupText,
      { alpha: 0.75 },
      { alpha: 0 },
      { duration: 1000, yoyo: true, delay: 0, repeat: Infinity, easing: quadInOut }
    )

    this.#popupTextPulseTween.start()
  }

  #stopPopupTextPulse() {
    if (!this.#popupTextPulseTween) return

    stopTweenIfExist(this.#popupTextPulseTween)
    this.#popupTextPulseTween = null
  }

  destroy() {
    game.onEnterFrame.detach(this.#linkOnEnterFrame)

    this.#stopWinCountSound()
    this.#stopBigWinSound()

    super.destroy()
  }
}
