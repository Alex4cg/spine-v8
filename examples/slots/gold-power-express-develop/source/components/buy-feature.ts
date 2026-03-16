import {
  Container,
  Sprite,
  BitmapText,
  Texture,
  NineSliceSprite,
  Color,
  type DestroyOptions
} from 'pixi.js'

import { ui, launchParams, type ExtraBet } from '@clawbuster/facade'

import MultiShadowBitmapText from '@/gkit/multi-shadow-text'
import { Parallel, remove, Tween } from '@/gkit/tweens'

import game, { eventBus } from '@/game/game'
import { GameEvents } from '@/game/events'
import { GAME_HEIGHT, GAME_WIDTH } from '@/const'

import buttonsAtlas from '@/assets/atlas/btn/atlas.gen'
import mainAtlas from '@/assets/atlas/main/atlas.gen'
import fonts from '@/assets/fonts/bitmap.gen'
import i18n from '@/assets/i18n/text.json'
import { playSfx } from '@/gkit/utils/sound-manager'

const COLORS_DATA = {
  fade: {
    color: 0x000000,
    alpha: 0.8
  }
}

interface SubscribedText {
  [ui.extraBetType.BonusBet1]?: BitmapText
  [ui.extraBetType.BonusBet2]?: BitmapText
  [ui.extraBetType.BuyBonus1]?: BitmapText
  [ui.extraBetType.BuyBonus2]?: BitmapText
}

interface TextureNames {
  beforeClickState: {
    default: string
    hover: string
    pressed: string
  }
  afterClickState: {
    default: string
    hover: string
    pressed: string
  }
}

interface ButtonProps {
  text: {
    beforeClick: string
    afterClick: string
  }
  offset: number
  height: number
  textYOffset: number
  isBold: boolean
  textureNames: TextureNames
}

export default class BuyFeature extends Container {
  #bg: Sprite
  #mainContainer: Container
  #mainTitle: MultiShadowBitmapText
  #titleLine: Sprite
  #sideBetsTitle: BitmapText
  #features: Container & { resetAll: () => void }
  #featuresInstance: Partial<Record<ExtraBet, Container & {
    isActive: boolean
    setActive: (value: boolean, isReset?: boolean) => void
  }>> = {}
  #featureDescription: BitmapText
  #bonusGameTitle: BitmapText
  #bonusGameFeatures: Container
  #activeSideBet: ExtraBet = ui.extraBetType.None

  #subscribedText: SubscribedText = {}

  #linkOnResize

  constructor() {
    super()

    const bg = this.addChild(new Sprite(Texture.WHITE))
    bg.tint = COLORS_DATA.fade.color
    bg.alpha = COLORS_DATA.fade.alpha
    bg.width = GAME_WIDTH
    bg.height = GAME_HEIGHT

    this.#bg = bg

    const mainContainer = this.addChild(new Container())
    this.#mainContainer = mainContainer

    this.#mainTitle = mainContainer.addChild(new MultiShadowBitmapText(
      i18n.karantinaRegular.buyModal.title.main,
      {
        ...fonts.karantinaRegular,
        fontSize: 78,
        fill: 0xFFEA00
      },
      [
        {
          offsetX: -2,
          offsetY: 3,
          color: 0x351C06
        },
        {
          offsetX: 2,
          offsetY: 3,
          color: 0x351C06
        },
        {
          offsetX: 0,
          offsetY: 2,
          color: 0x743A00
        }
      ]
    ))

    this.#mainTitle.position.set(GAME_WIDTH * 0.5, 50)

    this.#titleLine = mainContainer.addChild(new Sprite(mainAtlas.getTexture(`buy-modal/title-line`)))
    this.#titleLine.anchor.set(0.5)
    this.#titleLine.position.set(GAME_WIDTH * 0.5, 136)

    this.#sideBetsTitle = mainContainer.addChild(new BitmapText({
      text: i18n.karantinaRegular.buyModal.title.sideBets,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 44
      }
    }))

    this.#sideBetsTitle.anchor.set(0.5)
    this.#sideBetsTitle.position.set(GAME_WIDTH * 0.5, 580)

    this.#features = this.#createSidebetsFeatures()
    this.#features.position.set(GAME_WIDTH * 0.5, 710)

    const featureDescription = mainContainer.addChild(new BitmapText({
      text: i18n.robotoCondensedRegular.buyModal.description.common,
      style: {
        ...fonts.robotoCondensedRegular
      }
    }))

    featureDescription.anchor.set(0.5)
    featureDescription.alpha = 0.8
    featureDescription.position.set(GAME_WIDTH * 0.5, 820)

    this.#featureDescription = featureDescription

    const bonusGameTitle = mainContainer.addChild(new BitmapText({
      text: i18n.karantinaRegular.buyModal.title.bonusGame,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 44
      }
    }))

    bonusGameTitle.anchor.set(0.5)
    bonusGameTitle.position.set(GAME_WIDTH * 0.5, 190)

    this.#bonusGameTitle = bonusGameTitle

    this.#bonusGameFeatures = this.#createBonusGameFeatures()
    this.#bonusGameFeatures.position.set(GAME_WIDTH * 0.5, 230)

    this.alpha = 0
    this.visible = false

    const ExtraBet = ui.extraBetType

    ui.extraBetsValues.bind((values) => {
      if (this.#subscribedText[ExtraBet.BuyBonus1]) {
        this.#subscribedText[ExtraBet.BuyBonus1]!.text = `${ui.formatCurrency(
          values[ExtraBet.BuyBonus1]!, false, false, true
        )}`
      }

      if (this.#subscribedText[ExtraBet.BuyBonus2]) {
        this.#subscribedText[ExtraBet.BuyBonus2]!.text = `${ui.formatCurrency(
          values[ExtraBet.BuyBonus2]!, false, false, true
        )}`
      }
    })

    ui.extraBetsDeltaValues.bind((values) => {
      if (this.#subscribedText[ExtraBet.BonusBet1]) {
        this.#subscribedText[ExtraBet.BonusBet1]!.text = `+${ui.formatCurrency(
          values[ExtraBet.BonusBet1]!, false, false, true
        )}`
      }

      if (this.#subscribedText[ExtraBet.BonusBet2]) {
        this.#subscribedText[ExtraBet.BonusBet2]!.text = `+${ui.formatCurrency(
          values[ExtraBet.BonusBet2]!, false, false, true
        )}`
      }
    })

    this.#linkOnResize = game.onResize.add((options) => {
      const { viewport } = options
      const isPortrait = viewport.height > viewport.width

      if (options.mobile && isPortrait) {
        this.#mainContainer.scale.set(1)
        const bounds = this.#mainContainer.getLocalBounds()

        const padding = 5
        const scaleX = (viewport.width - (padding * 2)) / bounds.width
        const scaleY = (viewport.height - (padding * 2)) / bounds.height
        const scale = Math.min(scaleX, scaleY)

        this.#mainContainer.scale.set(scale)
        this.#mainContainer.pivot.set(
          bounds.x + (bounds.width / 2),
          bounds.y + (bounds.height / 2)
        )

        this.#mainContainer.position.set(viewport.width / 2, viewport.height / 2)
      } else {
        const scale = options.mobile
          ? options.foundations.scales.fullSizeByOrientationRatioScale
          : options.safeRectRatioScale

        this.#mainContainer.scale.set(scale)

        const bounds = this.#mainContainer.getLocalBounds()
        this.#mainContainer.pivot.set(
          bounds.x + (bounds.width / 2),
          bounds.y + (bounds.height / 2)
        )

        const centerX = options.safeRect.x + (options.safeRect.width / 2)
        const centerY = options.safeRect.y + (options.safeRect.height / 2)
        this.#mainContainer.position.set(centerX, centerY)
      }

      this.#bg.width = viewport.width
      this.#bg.height = viewport.height
    })
  }

  restore(extraBet: ExtraBet) {
    switch (extraBet) {
      case ui.extraBetType.BonusBet1:
      case ui.extraBetType.BonusBet2:
        this.#featuresInstance[extraBet]!.setActive(true)
        break
      case ui.extraBetType.None:
        this.#features.resetAll()
        break
      case ui.extraBetType.BuyBonus1:
      case ui.extraBetType.BuyBonus2:
        return
      default:
        return
    }
  }

  #createSidebetsFeatures() {
    const container = this.#mainContainer.addChild(new Container()) as Container & { resetAll: () => void }

    const commonOffsetX = 8

    const feature1Container = container.addChild(new Container()) as Container & {
      setActive: (value: boolean, isReset?: boolean) => void
      isActive: boolean
    }

    const feature1Glow = feature1Container.addChild(new Sprite(mainAtlas.getTexture(`buy-modal/glow`)))
    feature1Glow.anchor.set(0.5)
    feature1Glow.alpha = 0

    const feature1 = feature1Container.addChild(new Sprite(mainAtlas.getTexture(`buy-modal/feature-1`)))
    feature1.anchor.set(0.5)

    const feature1Text = feature1Container.addChild(new BitmapText({
      text: i18n.robotoCondensedBold.buyModal.description.sidebet,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 20,
        align: `left`
      }
    }))

    feature1Text.anchor.set(0, 0.5)
    feature1Text.x = -20
    feature1Text.y = -(feature1.height / 2) + feature1Text.height

    const buttonData = this.#createToggleButton()
    const buttonContainer = feature1Container.addChild(buttonData)

    buttonContainer.position.set(
      (feature1.width / 2) - (buttonContainer.width / 2) - 12,
      (feature1.height / 2) - (buttonContainer.height / 2) - 8
    )

    const feature1Price = feature1Container.addChild(new BitmapText({
      text: `+0`,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 33,
        align: `center`,
        fill: 0xFAFF00
      }
    }))

    feature1Price.anchor.set(0.5)

    const availableWidth = feature1.width - buttonContainer.width

    feature1Price.position.set(
      -(feature1.width / 2) + (availableWidth / 2),
      buttonContainer.y
    )

    this.#subscribedText[ui.extraBetType.BonusBet1] = feature1Price

    const feature2Container = container.addChild(new Container()) as Container & {
      setActive: (value: boolean, isReset?: boolean) => void
      isActive: boolean
    }

    const feature2Glow = feature2Container.addChild(new Sprite(mainAtlas.getTexture(`buy-modal/glow`)))
    feature2Glow.anchor.set(0.5)
    feature2Glow.alpha = 0

    const feature2 = feature2Container.addChild(new Sprite(mainAtlas.getTexture(`buy-modal/feature-2`)))
    feature2.anchor.set(0.5)

    const feature2Text = feature2Container.addChild(new BitmapText({
      text: i18n.robotoCondensedBold.buyModal.description.sidebet,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 20,
        align: `left`
      }
    }))

    feature2Text.anchor.set(0, 0.5)
    feature2Text.x = -20
    feature2Text.y = -(feature2.height / 2) + feature2Text.height

    const buttonData2 = this.#createToggleButton()
    const buttonContainer2 = feature2Container.addChild(buttonData2)

    buttonContainer2.position.set(
      (feature2.width / 2) - (buttonContainer2.width / 2) - 12,
      (feature2.height / 2) - (buttonContainer2.height / 2) - 8
    )

    const feature2Price = feature2Container.addChild(new BitmapText({
      text: `+0`,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 33,
        align: `center`,
        fill: 0xFAFF00
      }
    }))

    feature2Price.anchor.set(0.5)

    const availableWidth2 = feature2.width - buttonContainer2.width

    feature2Price.position.set(
      -(feature2.width / 2) + (availableWidth2 / 2),
      buttonContainer2.y
    )

    this.#subscribedText[ui.extraBetType.BonusBet2] = feature2Price

    feature1Container.x = -(commonOffsetX + (feature1Container.width / 2))
    feature2Container.x = commonOffsetX + (feature2Container.width / 2)

    feature2Container.eventMode = feature1Container.eventMode = `static`
    feature2Container.cursor = feature1Container.cursor = `pointer`

    let enableTween: Tween | null = null
    let disableTween: Tween | null = null

    let enableTween2: Tween | null = null
    let disableTween2: Tween | null = null

    buttonContainer.defaultDuration = 300
    buttonContainer2.defaultDuration = 300

    feature1Container.isActive = false

    feature1Container.setActive = (value, isReset = false) => {
      if (value) {
        if (disableTween && disableTween.isPlaying()) {
          remove(disableTween)
          disableTween = null
        }

        enableTween = Tween.to(feature1Glow, { alpha: 1 }, { duration: buttonContainer.defaultDuration })
        enableTween.once(`complete`, () => {
          enableTween = null
        })
        enableTween.start()

        this.#activeSideBet = ui.extraBetType.BonusBet1
      } else {
        if (enableTween && enableTween.isPlaying()) {
          remove(enableTween)
          enableTween = null
        }

        disableTween = Tween.to(feature1Glow, { alpha: 0 }, { duration: buttonContainer.defaultDuration })
        disableTween.once(`complete`, () => {
          disableTween = null
        })
        disableTween.start()
      }

      buttonContainer.active = value
      feature1Container.isActive = value

      if (buttonContainer.active && buttonContainer2.active) {
        feature2Container.setActive(false)
      }

      if (!buttonContainer.active && !buttonContainer2.active) {
        this.#activeSideBet = ui.extraBetType.None
      }

      if (!isReset) {
        ui.setExtraBet(ui.extraBetType.BonusBet1, value)
      }
    }

    feature2Container.isActive = false

    feature2Container.setActive = (value, isReset = false) => {
      if (value) {
        if (disableTween2 && disableTween2.isPlaying()) {
          remove(disableTween2)
          disableTween2 = null
        }

        enableTween2 = Tween.to(feature2Glow, { alpha: 1 }, { duration: buttonContainer2.defaultDuration })
        enableTween2.once(`complete`, () => {
          enableTween2 = null
        })

        enableTween2.start()

        this.#activeSideBet = ui.extraBetType.BonusBet2
      } else {
        if (enableTween2 && enableTween2.isPlaying()) {
          remove(enableTween2)
          enableTween2 = null
        }

        disableTween2 = Tween.to(feature2Glow, { alpha: 0 }, { duration: buttonContainer2.defaultDuration })
        disableTween2.once(`complete`, () => {
          disableTween2 = null
        })

        disableTween2.start()
      }

      buttonContainer2.active = value
      feature2Container.isActive = value

      if (buttonContainer2.active && buttonContainer.active) {
        feature1Container.setActive(false)
      }

      if (!buttonContainer.active && !buttonContainer2.active) {
        this.#activeSideBet = ui.extraBetType.None
      }

      if (!isReset) {
        ui.setExtraBet(ui.extraBetType.BonusBet2, value)
      }
    }

    feature1Container.on(`pointerdown`, () => {
      playSfx(feature1Container.isActive ? `sidebet_off` : `sidebet_on`, 0.5)
      feature1Container.setActive(!feature1Container.isActive)
    })

    feature2Container.on(`pointerdown`, () => {
      playSfx(feature2Container.isActive ? `sidebet_off` : `sidebet_on`, 0.5)
      feature2Container.setActive(!feature2Container.isActive)
    })

    this.#featuresInstance[ui.extraBetType.BonusBet1] = feature1Container
    this.#featuresInstance[ui.extraBetType.BonusBet2] = feature2Container

    container.resetAll = () => {
      if (feature1Container.isActive) {
        feature1Container.setActive(false, true)
      }

      if (feature2Container.isActive) {
        feature2Container.setActive(false, true)
      }

      this.#activeSideBet = ui.extraBetType.None
    }

    return container
  }

  #createBonusGameFeatures() {
    const container = this.#mainContainer.addChild(new Container())

    const offsetX = 28

    const feature1Container = container.addChild(new Container())

    const feature1 = feature1Container.addChild(new Sprite(mainAtlas.getTexture(`buy-modal/feature-3`)))
    feature1.anchor.set(0.5, 0)

    const feature1Text = feature1Container.addChild(new BitmapText({
      text: i18n.robotoCondensedBold.buyModal.description.regular,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: launchParams.language === `zh-CN` ? 22 : 30,
        align: `center`
      }
    }))

    feature1Text.anchor.set(0.5)
    feature1Text.position.set(0, 145)

    const buttonData = this.#createFeatureButton({
      text: {
        beforeClick: i18n.karantinaBold.buyModal.buy,
        afterClick: i18n.karantinaBold.buyModal.buy
      },
      offset: this.#resolveBuyTextOffsetY(),
      height: 74,
      textYOffset: 6,
      isBold: true,
      textureNames: {
        beforeClickState: {
          default: `buy/default`,
          hover: `buy/hover`,
          pressed: `buy/pressed`
        },
        afterClickState: {
          default: `buy/default`,
          hover: `buy/hover`,
          pressed: `buy/pressed`
        }
      }
    })

    const buttonContainer = feature1Container.addChild(buttonData)

    buttonContainer.position.set(0, 260)

    const feature1Price = feature1Container.addChild(new BitmapText({
      text: `0`,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 36,
        align: `center`,
        fill: 0xffffff
      }
    }))

    feature1Price.anchor.set(0.5)
    feature1Price.position.set(0, buttonContainer.y - 55)

    this.#subscribedText[ui.extraBetType.BuyBonus1] = feature1Price

    const feature2Container = container.addChild(new Container())

    const feature2 = feature2Container.addChild(new Sprite(mainAtlas.getTexture(`buy-modal/feature-4`)))
    feature2.anchor.set(0.5, 0)
    feature2.y = -15

    const feature2Text = feature2Container.addChild(new BitmapText({
      text: i18n.robotoCondensedBold.buyModal.description.jackpot,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: launchParams.language === `zh-CN` ? 22 : 30,
        align: `center`
      }
    }))

    feature2Text.anchor.set(0.5)
    feature2Text.position.set(0, 145)

    const buttonData2 = this.#createFeatureButton({
      text: {
        beforeClick: i18n.karantinaBold.buyModal.buy,
        afterClick: i18n.karantinaBold.buyModal.buy
      },
      offset: this.#resolveBuyTextOffsetY(),
      height: 74,
      textYOffset: 6,
      isBold: true,
      textureNames: {
        beforeClickState: {
          default: `buy/default`,
          hover: `buy/hover`,
          pressed: `buy/pressed`
        },
        afterClickState: {
          default: `buy/default`,
          hover: `buy/hover`,
          pressed: `buy/pressed`
        }
      }
    })

    const buttonContainer2 = feature2Container.addChild(buttonData2)

    buttonContainer2.position.set(0, 260)

    const feature2Price = feature2Container.addChild(new BitmapText({
      text: `0`,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 36,
        align: `center`,
        fill: 0xffffff
      }
    }))

    feature2Price.anchor.set(0.5)
    feature2Price.position.set(0, buttonContainer2.y - 55)

    this.#subscribedText[ui.extraBetType.BuyBonus2] = feature2Price

    feature1Container.x = -(offsetX + (feature1Container.width / 2))
    feature2Container.x = offsetX + (feature2Container.width / 2)

    feature1Container.on(`pointerup`, () => {
      playSfx(`buybonus_buy`, 0.5)
      this.#features.resetAll()

      this.#activeSideBet = ui.extraBetType.BuyBonus1

      ui.setExtraBet(ui.extraBetType.BuyBonus1, true)
      ui.closeBuyFeatureModal()

      Tween.to({}, {}, { duration: 500 }).once(`complete`, () => {
        eventBus.emit(GameEvents.EmulateClick)
      }).start()
    })

    feature1Container.eventMode = `static`
    feature1Container.cursor = `pointer`

    feature2Container.on(`pointerup`, () => {
      playSfx(`buybonus_buy`, 0.5)
      this.#features.resetAll()

      this.#activeSideBet = ui.extraBetType.BuyBonus2

      ui.setExtraBet(ui.extraBetType.BuyBonus2, true)
      ui.closeBuyFeatureModal()

      Tween.to({}, {}, { duration: 500 }).once(`complete`, () => {
        eventBus.emit(GameEvents.EmulateClick)
      }).start()
    })

    feature2Container.eventMode = `static`
    feature2Container.cursor = `pointer`

    return container
  }

  #resolveKarantinaRegularFontSize() {
    switch (launchParams.language) {
      case `fr-FR`:
        return 50
      case `pt-BR`:
        return 40
      case `ru-RU`:
        return 35
      case `zh-CN`:
        return 40
      default:
        return 48
    }
  }

  #resolveBuyTextOffsetY() {
    switch (launchParams.language) {
      case `fr-FR`:
        return 3
      case `pt-BR`:
        return 3
      case `ru-RU`:
        return 5
      case `zh-CN`:
        return 3
      default:
        return 3
    }
  }

  #createFeatureButton(options: ButtonProps) {
    const { text, offset, height, textYOffset, isBold, textureNames } = options

    const container = new Container() as Container & { isActive: boolean }

    const font = {
      ...(isBold ? fonts.karantinaBold : fonts.karantinaRegular),
      fontSize: this.#resolveKarantinaRegularFontSize()
    }

    const feature1ButtonText = container.addChild(new MultiShadowBitmapText(
      text.beforeClick,
      {
        ...font
      },
      [
        {
          offsetX: -2,
          offsetY: -2
        },
        {
          offsetX: -2,
          offsetY: 2
        },
        {
          offsetX: 2,
          offsetY: 2
        },
        {
          offsetX: 2,
          offsetY: -2
        },
        {
          offsetX: 2,
          offsetY: 4
        },
        {
          offsetX: -2,
          offsetY: 4
        }
      ],
      0x045800
    ))

    feature1ButtonText.zIndex = 1
    feature1ButtonText.y += offset

    container.isActive = false

    const feature1Button = container.addChild(new NineSliceSprite({
      texture: buttonsAtlas.getTexture(textureNames.beforeClickState.default),
      leftWidth: 60,
      rightWidth: 60,
      topHeight: 20,
      bottomHeight: 20,
      width: 150,
      height
    }))

    feature1Button.anchor.set(0.5)
    feature1Button.y = textYOffset

    container.on(`pointerover`, () => {
      const textureName = container.isActive
        ? textureNames.afterClickState.hover
        : textureNames.beforeClickState.hover
      feature1Button.texture = buttonsAtlas.getTexture(textureName)
    })

    container.on(`pointerout`, () => {
      const textureName = container.isActive
        ? textureNames.afterClickState.default
        : textureNames.beforeClickState.default

      feature1Button.texture = buttonsAtlas.getTexture(textureName)
    })

    container.on(`pointerdown`, () => {
      if (textureNames.beforeClickState.pressed !== undefined) {
        const textureName = container.isActive
          ? textureNames.afterClickState.pressed
          : textureNames.beforeClickState.pressed

        feature1Button.texture = buttonsAtlas.getTexture(textureName)
      }
    })

    container.on(`pointerup`, () => {
      const textureName = container.isActive
        ? textureNames.afterClickState.default
        : textureNames.beforeClickState.default

      feature1Button.texture = buttonsAtlas.getTexture(textureName)

      const currentText = container.isActive ? text.beforeClick : text.afterClick

      feature1ButtonText.setText(currentText)

      container.isActive = !container.isActive
    })

    container.eventMode = `static`
    container.cursor = `pointer`

    return container
  }

  #createToggleButton() {
    const container = new Container() as Container & {
      defaultDuration: number
      active: boolean
    }

    const background = container.addChild(new Sprite(buttonsAtlas.getTexture(`toggle/bg`)))
    background.anchor.set(0.5)
    background.scale.set(0.5)
    background.tint = 0xFF471E

    const disableIcon = container.addChild(new Sprite(buttonsAtlas.getTexture(`toggle/off`)))
    disableIcon.anchor.set(0.5)
    disableIcon.scale.set(0.5)
    disableIcon.x = 28

    const enableIcon = container.addChild(new Sprite(buttonsAtlas.getTexture(`toggle/on`)))
    enableIcon.anchor.set(0.5)
    enableIcon.scale.set(0.5)
    enableIcon.x = -29
    enableIcon.alpha = 0

    const innerShadow = background.addChild(new Sprite(buttonsAtlas.getTexture(`toggle/inner-shadow`)))
    innerShadow.anchor.set(0.5, 1)

    const handle = container.addChild(new Sprite(buttonsAtlas.getTexture(`toggle/handle`)))
    handle.anchor.set(0.5)
    handle.scale.set(0.5)
    handle.y = 4
    handle.x = -32

    let enableTween: Parallel | null = null
    let disableTween: Parallel | null = null

    const colorInstance = new Color()

    function changeTintFromDisableToEnable(data: { progress: number }) {
      const redFactor = (46 + ((1 - data.progress) * 209)) / 255
      const greenFactor = (71 + (166 * data.progress)) / 255
      const blueFactor = (30 + (22 * data.progress)) / 255

      background.tint = colorInstance.setValue([redFactor, greenFactor, blueFactor]).toHex()
    }

    function changeTintFromEnableToDisable(data: { progress: number }) {
      const redFactor = (46 + (data.progress * 209)) / 255
      const greenFactor = (237 - (166 * data.progress)) / 255
      const blueFactor = (52 - (22 * data.progress)) / 255

      background.tint = colorInstance.setValue([redFactor, greenFactor, blueFactor]).toHex()
    }

    let isActive = false

    container.defaultDuration = 300

    Object.defineProperty(container, `active`, {
      get: () => isActive,
      set: (value: boolean) => {
        if (value) {
          if (disableTween && disableTween.isPlaying()) {
            remove(disableTween)
          }

          const positionTween = Tween.to(handle, { x: 32 }, { duration: container.defaultDuration })

          const enableIconTween = Tween.to(enableIcon, { alpha: 1 }, { duration: container.defaultDuration })
          const disableIconTween = Tween.to(disableIcon, { alpha: 0 }, { duration: container.defaultDuration })

          const o = { progress: 0 }
          const colorChangeTween = Tween.to(o, { progress: 1 }, { duration: container.defaultDuration })
          colorChangeTween.on(`update`, changeTintFromDisableToEnable)

          enableTween = new Parallel(positionTween, colorChangeTween, enableIconTween, disableIconTween)
          enableTween.once(`complete`, () => {
            enableTween = null
          })

          enableTween.start()
        } else {
          if (enableTween && enableTween.isPlaying()) {
            remove(enableTween)
          }

          const positionTween = Tween.to(handle, { x: -32 }, { duration: container.defaultDuration })

          const enableIconTween = Tween.to(enableIcon, { alpha: 0 }, { duration: container.defaultDuration })
          const disableIconTween = Tween.to(disableIcon, { alpha: 1 }, { duration: container.defaultDuration })

          const o = { progress: 0 }
          const colorChangeTween = Tween.to(o, { progress: 1 }, { duration: container.defaultDuration })
          colorChangeTween.on(`update`, changeTintFromEnableToDisable)

          disableTween = new Parallel(positionTween, colorChangeTween, enableIconTween, disableIconTween)
          disableTween.once(`complete`, () => {
            disableTween = null
          })

          disableTween.start()
        }

        isActive = value
      }
    })

    return container
  }

  show() {
    playSfx(`buybonus_open`, 0.5)
    Tween
      .to(this, { alpha: 1 }, { duration: 300 })
      .once(`start`, () => {
        this.visible = true
      })
      .start()
  }

  hide() {
    Tween
      .to(this, { alpha: 0 }, { duration: 300 })
      .once(`complete`, () => {
        this.visible = false
      })
      .start()
  }

  destroy(options?: DestroyOptions): void {
    game.onResize.detach(this.#linkOnResize)
    super.destroy(options)
  }
}
