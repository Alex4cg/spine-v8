import {
  Container,
  Sprite,
  BitmapText,
  Texture,
  NineSliceSprite
} from 'pixi.js';

import MultiShadowBitmapText from '@/gkit/multi-shadow-text';
import { launchParams, ui, ruleSettings, gameSettings } from '@clawbuster/facade';

import Checkbox, { CHECKBOX_OFFSET, CHECKBOX_SIZE } from './checkbox';
import { COLORS_DATA, IDSpecialPack } from '@/components/items/const';
import { GAME_HEIGHT, GAME_WIDTH } from '@/const';
import game from '@/game/game';
import type { onResizeProps } from '@/types';

import welcomeScreenAtlas from '@/assets/atlas/welcome-screen/atlas.gen';
import buttonsAtlas from '@/assets/atlas/btn/atlas.gen';
import mainAtlas from '@/assets/atlas/main/atlas.gen';
import fonts from '@/assets/fonts/bitmap.gen';
import i18n from '@/assets/i18n/text.json';
import LocalizationFormatter from './utils';
import { playSfx } from '@/gkit/utils/sound-manager';

enum Layers {
  Default = 0,
  TextBg = 1,
  TextFg = 2
}

interface FeatureData {
  sprite: Sprite
  text: BitmapText
  container: Container
}

type FeatureConfigePros = {
  textureName: string;
  positionX: number;
};

const FEATURES_CONFIG: Record<IDSpecialPack, FeatureConfigePros> = Object.freeze({
  [IDSpecialPack.BonusGame]: {
    textureName: `welcome_1`,
    positionX: -473
  },
  [IDSpecialPack.GrandJackpot]: {
    textureName: `welcome_2`,
    positionX: 0
  },
  [IDSpecialPack.Boosters]: {
    textureName: `welcome_3`,
    positionX: 473
  }
});

const MOBILE_PORTRAIT_CONFIG = Object.freeze({
  LAYOUT: {
    LOGO_TOP_PERCENT: 0.02,
    WIN_UP_GAP: 8,
    FEATURES_CENTER_PERCENT: 0.52,
    BUTTON_BOTTOM_PERCENT: 0.05,
    CHECKBOX_GAP: 20
  },
  LOGO: {
    BASE_SCALE: 0.9,
    SCALE_FACTOR: 0.0002
  },
  WIN_UP: {
    BASE_SCALE: 0.75,
    SCALE_FACTOR: 0.00035
  },
  FEATURES: {
    BASE_SCALE: 0.6,
    SCALE_FACTOR: 0.0006,
    CARD_GAP_PERCENT: 0.1,
    ROW_GAP_PERCENT: 0.08
  },
  BUTTON: {
    WIDTH_PERCENT: 0.88,
    MAX_WIDTH: 400
  }
});

type FeatureLocalizationKey = keyof typeof i18n.aclonicaRegularSmall.welcomeScreen;

type ButtonSizeProps = {
  width: number;
  height: number;
};

export default class WelcomeScreen extends Container {
  readonly #background: Sprite;
  readonly #logo: Sprite;

  readonly #checkboxText: BitmapText;
  readonly #winUp: MultiShadowBitmapText;

  readonly #fitByHeightContainer: Container;
  readonly #fitByWidthContainer: Container;
  readonly #buttonContainer: Container;
  readonly #features: Container;
  readonly #button: Container;
  #soundButton!: Sprite;
  #checkBoxContainer!: Container;

  readonly #defaultButtonSize: ButtonSizeProps = { width: 0, height: 0 };
  readonly #featuresData: FeatureData[] = [];

  readonly #localizationFormatter = new LocalizationFormatter();

  #uiRevealFired = false;
  #showed = false;
  #isSoundOff = ui.muted.value!;

  #fullHide: () => void;
  #onCloseCb: (() => void) | null = null;
  #linkOnResize;

  constructor(fullHide: () => void) {
    super()

    this.visible = false

    const bg = this.addChild(new Sprite(Texture.WHITE))
    bg.tint = COLORS_DATA.fade.color
    bg.alpha = COLORS_DATA.fade.alpha
    bg.width = GAME_WIDTH
    bg.height = GAME_HEIGHT
    bg.eventMode = `static`
    bg.cursor = `pointer`
    bg.on(`pointerup`, () => this.#onClick())

    this.#background = bg

    this.#fitByWidthContainer = this.addChild(new Container());
    this.#fitByHeightContainer = this.addChild(new Container());

    this.#logo = this.#fitByWidthContainer.addChild(new Sprite(mainAtlas.getTexture(`logo`)))
    this.#logo.anchor.set(0.5, 0)

    const maxWinValue = ruleSettings.maxWin || 10000
    const winUpText = `${i18n.aclonicaRegular.welcomeScreen.winUpTo} ${maxWinValue}x`

    const winUpFontSize = launchParams.language === `ru-RU` ? Math.round(70 * 0.85) : 70

    const strokeWidth = 2.13
    const strokeColor = 0x000000
    const winUpShadows = [
      { offsetX: -strokeWidth, offsetY: strokeWidth, color: strokeColor },
      { offsetX: 0, offsetY: strokeWidth, color: strokeColor },
      { offsetX: strokeWidth, offsetY: strokeWidth, color: strokeColor },
      { offsetX: strokeWidth, offsetY: 0, color: strokeColor },
      { offsetX: strokeWidth, offsetY: -strokeWidth, color: strokeColor },
      { offsetX: 0, offsetY: -strokeWidth, color: strokeColor },
      { offsetX: -strokeWidth, offsetY: -strokeWidth, color: strokeColor },
      { offsetX: -strokeWidth, offsetY: 0, color: strokeColor },
      { offsetX: 0, offsetY: 4.57, color: 0x000000 }
    ]

    this.#winUp = this.#fitByWidthContainer.addChild(new MultiShadowBitmapText(
      winUpText,
      {
        ...fonts.montserratExtraBold,
        fontSize: winUpFontSize,
        fill: 0xFFDB2D
      },
      winUpShadows
    ))

    this.#winUp.setAnchor(0.5, 0)

    this.#features = this.#createFeatures()

    this.#buttonContainer = this.#fitByHeightContainer.addChild(new Container())

    this.#button = this.#buttonContainer.addChild(this.#createButton())

    const checkboxContainer = this.#buttonContainer.addChild(new Container())

    this.#checkBoxContainer = checkboxContainer
    this.#checkboxText = checkboxContainer.addChild(new BitmapText({
      text: i18n.aclonicaRegularSmall.welcomeScreen.doNotShow,
      style: {
        ...fonts.robotoCondensedBold,
        fontSize: 32,
        align: `center`
      }
    }))

    this.#checkboxText.anchor.set(0, 0.5)
    this.#checkboxText.x = CHECKBOX_SIZE + CHECKBOX_OFFSET
    this.#checkboxText.y = (CHECKBOX_SIZE * 1.30) / 2

    checkboxContainer.addChild(new Checkbox(this.#checkboxText.width))

    checkboxContainer.position.set(
      -(checkboxContainer.width / 2),
      this.#button.y + (this.#button.height / 2) + 45 + (checkboxContainer.height / 2)
    )

    this.#soundButton = this.#createSoundButton()
    this.#soundButton.x = this.#button.x + (this.#button.width / 2) + 225
    this.#soundButton.y = this.#button.y

    const positionX = [-473, 0, 473]

    for (let i = 0; i < this.#featuresData.length; i++) {
      const feature = this.#featuresData[i]
      feature.container.x = positionX[i]

      if (i === 1) {
        feature.container.y = 0
      }
    }

    this.#winUp.x = GAME_WIDTH * 0.5
    this.#winUp.y = 240

    this.#features.y = 572
    this.#features.x = GAME_WIDTH * 0.5

    this.#logo.x = GAME_WIDTH * 0.5
    this.#logo.y = 103

    this.#buttonContainer.x = GAME_WIDTH * 0.5
    this.#buttonContainer.y = GAME_HEIGHT - 106 - 10 - (this.#button.height / 2)

    this.#fullHide = fullHide

    this.#linkOnResize = game.onResize.add((options) => this.#onResize(options))
  }

  #createButtonTextShadows(strokeWidth: number, dropShadows: Array<{offsetY: number, color: number, alpha?: number}> = []) {
    const strokeColor = 0x0F6900
    const shadows: Array<{offsetX: number, offsetY: number, color: number, alpha?: number}> = [
      { offsetX: -strokeWidth, offsetY: strokeWidth, color: strokeColor },
      { offsetX: 0, offsetY: strokeWidth, color: strokeColor },
      { offsetX: strokeWidth, offsetY: strokeWidth, color: strokeColor },
      { offsetX: strokeWidth, offsetY: 0, color: strokeColor },
      { offsetX: strokeWidth, offsetY: -strokeWidth, color: strokeColor },
      { offsetX: 0, offsetY: -strokeWidth, color: strokeColor },
      { offsetX: -strokeWidth, offsetY: -strokeWidth, color: strokeColor },
      { offsetX: -strokeWidth, offsetY: 0, color: strokeColor }
    ]

    dropShadows.forEach((shadow) => {
      shadows.push({ offsetX: 0, offsetY: shadow.offsetY, color: shadow.color, alpha: shadow.alpha })
    })

    return shadows
  }

  #createSoundButton() {
    const iconName = this.#isSoundOff ? `sound_off` : `sound_on`
    const soundButton = this.#buttonContainer.addChild(new Sprite(welcomeScreenAtlas.getTexture(iconName)))
    soundButton.anchor.set(0, 0.5)
    soundButton.scale.set(0.5)
    soundButton.eventMode = `static`
    soundButton.cursor = `pointer`

    soundButton.on(`pointerup`, () => {
      this.#isSoundOff = !this.#isSoundOff
      soundButton.texture = welcomeScreenAtlas.getTexture(this.#isSoundOff ? `sound_off` : `sound_on`)
      gameSettings.setSoundEnabled(!this.#isSoundOff)
    })

    return soundButton
  }

  #createButton() {
    const buttonContainer = new Container()

    const textStates = {
      default: {
        fontSize: 56,
        strokeWidth: 1.5,
        dropShadows: [
          { offsetY: 1.5, color: 0x0D4B02 },
          { offsetY: 4.5, color: 0x2E0B06, alpha: 0.64 }
        ]
      },
      hover: {
        fontSize: 57,
        strokeWidth: 1.58,
        dropShadows: [
          { offsetY: 1.58, color: 0x0D4B02 },
          { offsetY: 4.75, color: 0x2E0B06, alpha: 0.64 }
        ]
      },
      pressed: {
        fontSize: 50,
        strokeWidth: 1.5,
        dropShadows: []
      }
    }

    const buttonTexts: Record<string, MultiShadowBitmapText> = {}

    Object.entries(textStates).forEach(([state, config]) => {
      const text = buttonContainer.addChild(new MultiShadowBitmapText(
        i18n.aclonicaRegular.welcomeScreen.continue,
        {
          ...Object.assign({}, fonts.karantina, { fontSize: config.fontSize }),
          align: `center`,
          fill: 0xFFFFFF
        },
        this.#createButtonTextShadows(config.strokeWidth, config.dropShadows)
      ))

      text.zIndex = Layers.TextFg
      text.setAnchor(0.5)
      text.y += 5
      text.visible = state === `default`

      buttonTexts[state] = text
    })

    const button = buttonContainer.addChild(new NineSliceSprite({
      texture: buttonsAtlas.getTexture(`welcome/default`),
      leftWidth: 60,
      rightWidth: 60,
      topHeight: 20,
      bottomHeight: 20,
      width: (52 * 2) + buttonTexts.default.width,
      height: 90
    }))

    this.#defaultButtonSize.width = (52 * 2) + buttonTexts.default.width
    this.#defaultButtonSize.height = 90

    button.anchor.set(0.5)
    button.y += 10
    button.interactive = true
    button.cursor = `pointer`

    const setButtonState = (state: `default` | `hover` | `pressed`) => {
      button.texture = buttonsAtlas.getTexture(`welcome/${state}`)
      Object.entries(buttonTexts).forEach(([key, text]) => {
        text.visible = key === state
      })
    }

    button.on(`pointerover`, () => setButtonState(`hover`))
    button.on(`pointerout`, () => setButtonState(`default`))
    button.on(`pointerdown`, () => setButtonState(`pressed`))
    button.on(`pointerup`, (e) => {
      setButtonState(`hover`)
      e.stopPropagation()
      this.#onClick()
    })

    buttonContainer.addChild(button)

    return buttonContainer
  }

  #createFeatures() {
    const container = this.#fitByWidthContainer.addChild(new Container())

    for (const [featureType, config] of Object.entries(FEATURES_CONFIG)) {
      const subContainer = container.addChild(new Container());

      const sprite = subContainer.addChild(new Sprite(welcomeScreenAtlas.getTexture(config.textureName)));
      sprite.anchor.set(0.5)
      sprite.scale.set(1 / 1.5)

      const text = subContainer.addChild(new BitmapText({
        text: i18n.aclonicaRegularSmall.welcomeScreen[featureType as FeatureLocalizationKey],
        style: {
          ...fonts.robotoCondensedBold,
          fontSize: 32,
          align: `center`
        }
      }));

      text.anchor.set(0.5, 0);

      subContainer.x = config.positionX;
      this.#featuresData.push({ sprite, text, container: subContainer })
    }

    return container
  }

  #onResize(options: onResizeProps) {
    this.#background.width = options.viewport.width
    this.#background.height = options.viewport.height

    const isPortrait = options.viewport.height > options.viewport.width

    if (!isPortrait) {
      const positionX = [-473, 0, 473]

      for (let i = 0; i < this.#featuresData.length; i++) {
        const feature = this.#featuresData[i]
        feature.container.x = positionX[i]
        feature.container.y = 0
        feature.container.scale.set(1)
        feature.text.y = (feature.sprite.height / 2) + 30
      }

      this.#fitByWidthContainer.scale.set(options.fullSizeRatioScale)
      this.#fitByWidthContainer.x = game.fullSizeStage.x
      this.#fitByWidthContainer.y = game.fullSizeStage.y

      this.#fitByHeightContainer.scale.set(options.fullSizeRatioScale)
      this.#fitByHeightContainer.x = game.fullSizeStage.x
      this.#fitByHeightContainer.y = game.fullSizeStage.y

      this.#winUp.x = GAME_WIDTH * 0.5
      this.#winUp.y = 240
      this.#winUp.scale.set(1)

      this.#features.y = 520
      this.#features.x = GAME_WIDTH * 0.5

      this.#logo.x = GAME_WIDTH * 0.5
      this.#logo.y = 60
      this.#logo.scale.set(1.2)

      this.#button.scale.set(1)
      this.#checkBoxContainer.scale.set(1)
      this.#soundButton.scale.set(0.5)
      this.#buttonContainer.x = GAME_WIDTH * 0.5
      this.#buttonContainer.y = GAME_HEIGHT - 220
      this.#soundButton.x = this.#button.x + (this.#button.width / 2) + 248
      this.#soundButton.y = this.#button.y + 10
    } else {
      this.#layoutPortrait(options)
    }
  }

  #layoutPortrait(options: onResizeProps) {
    const { viewport } = options
    const { width: vw, height: vh } = viewport
    const cfg = MOBILE_PORTRAIT_CONFIG

    const baseScale = options.foundations.scales.fullSizeByOrientationRatioScale

    this.#fitByWidthContainer.scale.set(baseScale)
    this.#fitByWidthContainer.position.set(
      options.foundations.containers.fullSizeByOrientationRatioScale.x,
      0
    )

    this.#fitByHeightContainer.scale.set(baseScale)
    this.#fitByHeightContainer.position.set(
      options.foundations.containers.fullSizeByOrientationRatioScale.x,
      0
    )

    const centerX = GAME_WIDTH / 2
    const toLocalY = (vpPercent: number) => (vh * vpPercent) / baseScale

    const minVh = 667
    const maxVh = 932
    const heightRatio = Math.min(Math.max((vh - minVh) / (maxVh - minVh), 0), 1)

    const adaptiveLogoTopPercent = 0.02 + (heightRatio * 0.01)
    const adaptiveFeaturesCenterPercent = 0.52 - (heightRatio * 0.07)
    const adaptiveButtonBottomPercent = 0.05 + (heightRatio * 0.04)
    const logoScale = cfg.LOGO.BASE_SCALE + (vh * cfg.LOGO.SCALE_FACTOR)
    const logoY = toLocalY(adaptiveLogoTopPercent)
    this.#logo.scale.set(logoScale)
    this.#logo.position.set(centerX, logoY)

    const winUpScale = cfg.WIN_UP.BASE_SCALE + (vh * cfg.WIN_UP.SCALE_FACTOR)
    const logoBottom = logoY + (this.#logo.height * logoScale)
    const winUpY = logoBottom + cfg.LAYOUT.WIN_UP_GAP
    this.#winUp.scale.set(winUpScale)
    this.#winUp.position.set(centerX, winUpY)

    const featuresScale = cfg.FEATURES.BASE_SCALE + (vh * cfg.FEATURES.SCALE_FACTOR)
    const featuresCenterY = toLocalY(adaptiveFeaturesCenterPercent)

    const { text: feature1Text, container: featureContainer1, sprite: sprite1 } = this.#featuresData[0]
    const { text: feature2Text, container: featureContainer2, sprite: sprite2 } = this.#featuresData[1]
    const { text: feature3Text, container: featureContainer3, sprite: sprite3 } = this.#featuresData[2]

    featureContainer1.scale.set(featuresScale)
    featureContainer2.scale.set(featuresScale)
    featureContainer3.scale.set(featuresScale)

    const cardWidth = sprite1.width * featuresScale
    const cardHeight = sprite1.height * featuresScale
    const cardGap = (vw * cfg.FEATURES.CARD_GAP_PERCENT) / baseScale
    const rowGap = (vh * cfg.FEATURES.ROW_GAP_PERCENT) / baseScale

    const topRowY = featuresCenterY - (cardHeight / 2) - (rowGap / 2)
    const bottomRowY = featuresCenterY + (cardHeight / 2) + (rowGap / 2)

    featureContainer1.position.set(centerX - (cardWidth / 2) - (cardGap / 2), topRowY)
    featureContainer2.position.set(centerX + (cardWidth / 2) + (cardGap / 2), topRowY)
    featureContainer3.position.set(centerX, bottomRowY)

    feature1Text.text = this.#localizationFormatter.tryFormatting(i18n.aclonicaRegularSmall.welcomeScreen.feature1)
    feature2Text.text = this.#localizationFormatter.tryFormatting(i18n.aclonicaRegularSmall.welcomeScreen.feature2)
    feature3Text.text = this.#localizationFormatter.tryFormatting(i18n.aclonicaRegularSmall.welcomeScreen.feature3)

    feature1Text.scale.set(1)
    feature2Text.scale.set(1)
    feature3Text.scale.set(1)

    feature1Text.y = (sprite1.height / 2) + 15
    feature2Text.y = (sprite2.height / 2) + 15
    feature3Text.y = (sprite3.height / 2) + 15

    this.#features.position.set(0, 0)

    const bottomY = toLocalY(1 - adaptiveButtonBottomPercent)
    const buttonWidth = Math.min((vw * cfg.BUTTON.WIDTH_PERCENT) / baseScale, cfg.BUTTON.MAX_WIDTH)
    const buttonScale = buttonWidth / this.#defaultButtonSize.width
    this.#button.scale.set(buttonScale)
    this.#checkBoxContainer.scale.set(buttonScale)

    const checkboxGap = cfg.LAYOUT.CHECKBOX_GAP
    this.#checkBoxContainer.x = -this.#checkBoxContainer.width / 2
    this.#checkBoxContainer.y = this.#button.y
      + (this.#button.height / 2)
      + checkboxGap
      + (this.#checkBoxContainer.height / 2)

    const bottomLocal = this.#checkBoxContainer.y + (this.#checkBoxContainer.height / 2)
    this.#buttonContainer.position.set(centerX, bottomY - bottomLocal)

    const baseSoundButtonX = ((this.#defaultButtonSize.width / 2) + 225) * buttonScale
    this.#soundButton.scale.set(0.5 * buttonScale)

    const availableHalfWidth = (vw / baseScale) * 0.5
    const edgePadding = 62
    const maxSoundButtonX = availableHalfWidth - this.#soundButton.width - edgePadding
    this.#soundButton.x = Math.max(0, Math.min(baseSoundButtonX, maxSoundButtonX))
    this.#soundButton.y = this.#button.y
  }

  show(cb: () => void) {
    if (this.#showed) {
      return
    }

    this.#showed = true
    this.#onCloseCb = cb
    this.visible = true
    playSfx(`play_splash`, 0.5)
  }

  hide() {
    if (!this.#showed) {
      return
    }

    this.visible = false

    this.#destroy()
  }

  #onClick() {
    this.#fullHide()

    if (!this.#uiRevealFired) {
      ui.reveal()

      this.#uiRevealFired = true
      this.#soundButton.eventMode = `none`
    }

    this.hide()

    if (this.#onCloseCb) {
      this.#onCloseCb()
      this.#onCloseCb = null
    }
  }

  #destroy() {
    game.onResize.detach(this.#linkOnResize)

    super.destroy({ children: true })
  }
}
