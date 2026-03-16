import { Container, Sprite, BitmapText } from 'pixi.js'
import { Tween, quadInOut, stopTweenIfExist } from '@/gkit/tweens'
import MultiShadowBitmapText from '@/gkit/multi-shadow-text'

import type { IDBase, IDSpecial } from '@/components/items/const'
import game from '@/game/game'
import type { onResizeProps } from '@/types'

import bonusModalAtlas from '@/assets/atlas/bonus-modal/atlas.gen'
import fonts from '@/assets/fonts/bitmap.gen'
import i18n from '@/assets/i18n/text.json'
import { ui } from '@clawbuster/facade'

interface Properties {
  crownY: number
  titleY: number
  card1Y: number
  card2Y: number
  card1X: number
  card2X: number
  label1Y: number
  label2Y: number
  clickTextY: number
  totalWinFrameY?: number
  cardScale: number
}

const defaultPositions: Record<string, Properties> = {
  desktop: {
    crownY: -370,
    titleY: -270,
    card1X: -220,
    card2X: 220,
    card1Y: -70,
    card2Y: -70,
    label1Y: 100,
    label2Y: 100,
    clickTextY: 270,
    totalWinFrameY: 30,
    cardScale: 1 / 1.5
  },
  mobile: {
    crownY: -550,
    titleY: -430,
    card1X: 0,
    card2X: 0,
    card1Y: -210,
    card2Y: 20,
    label1Y: -95,
    label2Y: 135,
    clickTextY: 260,
    totalWinFrameY: 20,
    cardScale: 0.75 / 1.5
  }
}

interface TotalPositionProps {
  titleY: number
  frameY: number
  amountY: number
  currencyY: number
  clickTextY: number
}

const totalPositions: Record<string, TotalPositionProps> = {
  desktop: {
    titleY: -185,
    frameY: -165,
    amountY: -40,
    currencyY: 42,
    clickTextY: 320
  },
  mobile: {
    titleY: -265,
    frameY: -245,
    amountY: -130,
    currencyY: -44,
    clickTextY: 182.5
  }
}

export default class BonusModal extends Container {
  #crown: Sprite
  #title: MultiShadowBitmapText
  #totalWinBg: Sprite
  #totalWinFrame: Sprite
  #totalWinAmount: MultiShadowBitmapText
  #totalWinCurrency: BitmapText
  #cardsBg: Sprite
  #card1: Sprite
  #card2: Sprite
  #label1: BitmapText
  #label2: BitmapText
  #clickText: BitmapText
  #clickPulseTween: Tween | null = null
  #isTotalMode: boolean = false
  #isMaxWinMode: boolean = false
  #totalWinValue: number = 0

  constructor() {
    super()

    this.sortableChildren = true

    this.#cardsBg = this.addChild(new Sprite(bonusModalAtlas.getTexture(`bonus_modal_bg`)))
    this.#cardsBg.anchor.set(0.5)
    this.#cardsBg.x = 0
    this.#cardsBg.y = defaultPositions.desktop.card1Y
    this.#cardsBg.alpha = 1
    this.#cardsBg.zIndex = 0

    this.#crown = this.addChild(new Sprite(bonusModalAtlas.getTexture(`crown`)))
    this.#crown.anchor.set(0.5)
    this.#crown.y = defaultPositions.desktop.crownY
    this.#crown.alpha = 1
    this.#crown.zIndex = 20

    this.#title = this.addChild(new MultiShadowBitmapText(
      i18n.freeSpinsModal.title.main,
      {
        ...fonts.karantinaRegular,
        fontSize: 140,
        fill: 0xFFEA00,
        align: `center`
      },
      [
        { offsetX: -5, offsetY: 9, color: 0x351C06 },
        { offsetX: 5, offsetY: 9, color: 0x351C06 },
        { offsetX: -5, offsetY: 0, color: 0x351C06 },
        { offsetX: 5, offsetY: 0, color: 0x351C06 },
        { offsetX: -5, offsetY: -2, color: 0x351C06 },
        { offsetX: 5, offsetY: -2, color: 0x351C06 },
        { offsetX: 0, offsetY: 5, color: 0x743A00 }
      ]
    ))
    this.#title.setAnchor(0.5)
    this.#title.y = defaultPositions.desktop.titleY
    this.#title.alpha = 1
    this.#title.zIndex = 30

    this.#totalWinBg = this.addChild(new Sprite(bonusModalAtlas.getTexture(`bonus_modal_bg`)))
    this.#totalWinBg.anchor.set(0.5)
    this.#totalWinBg.rotation = Math.PI / 2
    this.#totalWinBg.y = totalPositions.desktop.frameY
    this.#totalWinBg.alpha = 0
    this.#totalWinBg.visible = false
    this.#totalWinBg.zIndex = 5

    this.#totalWinFrame = this.addChild(new Sprite(bonusModalAtlas.getTexture(`bg_modals_frame`)))
    this.#totalWinFrame.anchor.set(0.5)
    this.#totalWinFrame.y = totalPositions.desktop.frameY
    this.#totalWinFrame.alpha = 0
    this.#totalWinFrame.visible = false
    this.#totalWinFrame.zIndex = 10

    this.#totalWinAmount = this.addChild(new MultiShadowBitmapText(
      `0.00`,
      {
        ...fonts.montserratExtraBold,
        fontSize: 96,
        fill: 0xFFDB2D,
        align: `center`
      },
      [
        { offsetX: 0, offsetY: 5, color: 0x9E5302 }
      ]
    ))
    this.#totalWinAmount.setAnchor(0.5)
    this.#totalWinAmount.y = totalPositions.desktop.amountY
    this.#totalWinAmount.alpha = 0
    this.#totalWinAmount.visible = false
    this.#totalWinAmount.zIndex = 15

    this.#totalWinCurrency = this.addChild(new BitmapText({
      text: ui.getCurrencySign(),
      style: {
        ...fonts.montserratExtraBold,
        fontSize: 64,
        fill: 0xFFFFFF,
        align: `center`
      }
    }))
    this.#totalWinCurrency.tint = 0xFFDB2D
    this.#totalWinCurrency.anchor.set(0.5)
    this.#totalWinCurrency.y = totalPositions.desktop.currencyY
    this.#totalWinCurrency.alpha = 0
    this.#totalWinCurrency.visible = false
    this.#totalWinCurrency.zIndex = 15

    this.#card1 = this.addChild(new Sprite(bonusModalAtlas.getTexture(`bonus_congratulation_1`)))
    this.#card1.anchor.set(0.5)
    this.#card1.scale.set(1 / 1.5)
    this.#card1.x = defaultPositions.desktop.card1X
    this.#card1.y = defaultPositions.desktop.card1Y
    this.#card1.alpha = 1
    this.#card1.zIndex = 5

    this.#card2 = this.addChild(new Sprite(bonusModalAtlas.getTexture(`bonus_congratulation_2`)))
    this.#card2.anchor.set(0.5)
    this.#card2.scale.set(1 / 1.5)
    this.#card2.x = defaultPositions.desktop.card2X
    this.#card2.y = defaultPositions.desktop.card2Y
    this.#card2.alpha = 1
    this.#card2.zIndex = 5

    this.#label1 = this.addChild(new BitmapText({
      text: i18n.bonusModal.feature1,
      style: {
        ...fonts.robotoCondensedRegular,
        fontSize: 28,
        fill: 0xFFFFFF,
        align: `center`
      }
    }))
    this.#label1.anchor.set(0.5)
    this.#label1.x = defaultPositions.desktop.card1X
    this.#label1.y = defaultPositions.desktop.label1Y
    this.#label1.alpha = 1
    this.#label1.zIndex = 6

    this.#label2 = this.addChild(new BitmapText({
      text: i18n.bonusModal.feature2,
      style: {
        ...fonts.robotoCondensedRegular,
        fontSize: 28,
        fill: 0xFFFFFF,
        align: `center`
      }
    }))
    this.#label2.anchor.set(0.5)
    this.#label2.x = defaultPositions.desktop.card2X
    this.#label2.y = defaultPositions.desktop.label2Y
    this.#label2.alpha = 1
    this.#label2.zIndex = 6

    this.#clickText = this.addChild(new BitmapText({
      text: i18n.bonusModal.clickToContinue,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 36,
        fill: 0xFFFFFF,
        align: `center`
      }
    }))
    this.#clickText.anchor.set(0.5)
    this.#clickText.y = defaultPositions.desktop.clickTextY
    this.#clickText.alpha = 0.75
    this.#clickText.zIndex = 6

    game.onResize.add((options) => this.#onResize(options))
  }

  #startClickPulse() {
    if (this.#clickPulseTween) {
      stopTweenIfExist(this.#clickPulseTween)
      this.#clickPulseTween = null
    }

    this.#clickText.alpha = 0.75

    this.#clickPulseTween = Tween.fromTo(
      this.#clickText,
      { alpha: 0.75 },
      { alpha: 0 },
      { duration: 1000, yoyo: true, delay: 0, repeat: Infinity, easing: quadInOut }
    )

    this.#clickPulseTween.start()
  }

  #stopClickPulse() {
    if (!this.#clickPulseTween) return

    stopTweenIfExist(this.#clickPulseTween)
    this.#clickPulseTween = null
  }

  #onResize(options: onResizeProps) {
    const props = options.mobile ? defaultPositions.mobile : defaultPositions.desktop
    const totalProps = options.mobile ? totalPositions.mobile : totalPositions.desktop

    if (this.#isTotalMode) {
      this.#title.y = totalProps.titleY
      this.#totalWinBg.y = totalProps.frameY
      this.#totalWinFrame.y = totalProps.frameY
      this.#totalWinAmount.y = totalProps.amountY
      this.#totalWinCurrency.y = totalProps.currencyY

      this.#clickText.y = totalProps.clickTextY
      this.#clickText.text = options.mobile ? i18n.bonusModal.tapToContinue : i18n.bonusModal.clickToContinue

      const mobileScale = options.mobile ? 0.8 : 1
      this.#totalWinBg.scale.set(mobileScale)
      this.#totalWinFrame.scale.set(mobileScale)
      this.#totalWinAmount.scale.set(mobileScale)
      this.#totalWinCurrency.scale.set(mobileScale)
    } else if (options.mobile) {
      this.#crown.y = props.crownY
      this.#crown.visible = true
      this.#crown.alpha = 1
      this.#title.y = props.titleY
      this.#title.scale.set(0.85)

      this.#card1.y = props.card1Y
      this.#card1.x = props.card1X
      this.#card1.scale.set(props.cardScale)

      this.#card2.y = props.card2Y
      this.#card2.x = props.card2X
      this.#card2.scale.set(props.cardScale)

      this.#label1.y = props.label1Y
      this.#label1.x = props.card1X

      this.#label2.y = props.label2Y
      this.#label2.x = props.card2X

      this.#cardsBg.y = (props.card1Y + props.card2Y) / 2
      this.#cardsBg.scale.set(props.cardScale)

      this.#clickText.y = props.clickTextY
      this.#clickText.text = i18n.bonusModal.tapToContinue
    } else {
      this.#crown.y = props.crownY
      this.#crown.visible = true
      this.#crown.alpha = 1
      this.#title.y = props.titleY
      this.#title.scale.set(1)

      this.#cardsBg.y = (props.card1Y + props.card2Y) / 2
      this.#cardsBg.scale.set(props.cardScale)

      this.#card1.y = props.card1Y
      this.#card2.y = props.card2Y
      this.#label1.y = props.label1Y
      this.#label2.y = props.label2Y

      this.#card1.x = props.card1X
      this.#card1.scale.set(props.cardScale)

      this.#card2.x = props.card2X
      this.#card2.scale.set(props.cardScale)

      this.#label1.x = props.card1X
      this.#label2.x = props.card2X

      this.#clickText.y = props.clickTextY
      this.#clickText.text = i18n.bonusModal.clickToContinue
    }
  }

  getShowTween() {
    const duration = 300

    const tween = Tween.to(this, { alpha: 1 }, { duration })

    tween.on(`start`, () => {
      this.#startClickPulse()
    })

    return tween
  }

  getHideTween() {
    const duration = 300

    const tween = Tween.to(this, { alpha: 0 }, { duration })

    tween.on(`start`, () => {
      this.#stopClickPulse()
    })

    return tween
  }

  setItems(items: (IDSpecial | IDBase)[]) {
    if (items.length < 0) {
      return
    }
  }

  setTotalMode(value: boolean, isMaxWin: boolean = false) {
    this.#isTotalMode = value
    this.#isMaxWinMode = isMaxWin

    const screenProperties = ui.screenProperties.value!
    const props = screenProperties.mobile ? defaultPositions.mobile : defaultPositions.desktop
    const totalProps = screenProperties.mobile ? totalPositions.mobile : totalPositions.desktop

    let titleText = i18n.freeSpinsModal.title.main
    if (isMaxWin) titleText = i18n.freeSpinsModal.title.max
    else if (value) titleText = i18n.freeSpinsModal.title.total
    this.#title.setText(titleText)

    if (value) {
      this.#crown.visible = false
      this.#crown.alpha = 0

      this.#title.y = totalProps.titleY
      this.#totalWinBg.y = totalProps.frameY
      this.#totalWinFrame.y = totalProps.frameY
      this.#totalWinAmount.y = totalProps.amountY
      this.#totalWinCurrency.y = totalProps.currencyY

      this.#clickText.y = totalProps.clickTextY
      this.#clickText.text = screenProperties.mobile ? i18n.bonusModal.tapToContinue : i18n.bonusModal.clickToContinue

      const mobileScale = screenProperties.mobile ? 0.8 : 1
      this.#totalWinBg.scale.set(mobileScale)
      this.#totalWinFrame.scale.set(mobileScale)
      this.#totalWinAmount.scale.set(mobileScale)
      this.#totalWinCurrency.scale.set(mobileScale)

      const formattedAmount = ui.formatCurrency(this.#totalWinValue, false, false, false)
      this.#totalWinAmount.setText(formattedAmount)
      this.#totalWinCurrency.text = ui.getCurrencySign()
    } else {
      this.#crown.y = props.crownY
      this.#crown.visible = true
      this.#crown.alpha = 1

      this.#title.y = props.titleY
      this.#clickText.y = props.clickTextY
      this.#clickText.text = screenProperties.mobile ? i18n.bonusModal.tapToContinue : i18n.bonusModal.clickToContinue
    }

    this.#totalWinBg.visible = value
    this.#totalWinBg.alpha = value ? 1 : 0
    this.#totalWinFrame.visible = value
    this.#totalWinFrame.alpha = value ? 1 : 0
    this.#totalWinAmount.visible = value
    this.#totalWinAmount.alpha = value ? 1 : 0
    this.#totalWinCurrency.visible = value
    this.#totalWinCurrency.alpha = value ? 1 : 0

    this.#cardsBg.visible = !value
    this.#card1.visible = !value
    this.#card2.visible = !value
    this.#label1.visible = !value
    this.#label2.visible = !value
    this.#clickText.visible = true

    this.#startClickPulse()
  }

  setTotalWinValue(value: number) {
    this.#totalWinValue = value
    const formattedAmount = ui.formatCurrency(value, false, false, false)
    this.#totalWinAmount.setText(formattedAmount)
    this.#totalWinCurrency.text = ui.getCurrencySign()
  }
}
