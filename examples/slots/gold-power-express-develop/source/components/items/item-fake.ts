import { Container, Sprite } from 'pixi.js'

import itemsAtlas from '@/assets/atlas/items/atlas.gen'
import { IDBase, IDSpecial, TEXTURE_MAP } from './const'
import { MultiplierLabel } from '@/components/texture-number'

const BLUR_SYMBOLS = new Set<IDBase>([
  IDBase.H1, IDBase.H2, IDBase.H3, IDBase.H4,
  IDBase.L1, IDBase.L2, IDBase.L3, IDBase.L4
])

const STATIC_SYMBOLS = new Set<IDSpecial>([
  IDSpecial.Jackpot
])

const JACKPOT_TEXTURES = [`grand_coin`, `major_coin`, `midi_coin`, `mini_coin`]

export default class ItemFake extends Sprite {
  isPooling: boolean = false
  isDummy: boolean = false
  isHided: boolean = false
  id: IDBase | IDSpecial

  constructor(id: IDBase | IDSpecial) {
    let texturePath: string

    if (STATIC_SYMBOLS.has(id as IDSpecial)) {
      if (id === IDSpecial.Jackpot) {
        const randomTexture = JACKPOT_TEXTURES[Math.floor(Math.random() * JACKPOT_TEXTURES.length)]
        texturePath = `static/${randomTexture}.png`
      } else {
        texturePath = `static/${TEXTURE_MAP[id]}.png`
      }
    } else if (BLUR_SYMBOLS.has(id as IDBase)) {
      texturePath = `blur/${TEXTURE_MAP[id]}_blur.png`
    } else {
      texturePath = `blur/${TEXTURE_MAP[id]}.png`
    }

    super(itemsAtlas.getTexture(texturePath))

    this.id = id
    this.anchor.set(0.5)

    if (STATIC_SYMBOLS.has(id as IDSpecial) || BLUR_SYMBOLS.has(id as IDBase)) {
      this.scale.set(1 / 2)
    }
  }

  reset() {
    this.alpha = 1
    this.position.set(0, 0)
    this.zIndex = 0
    this.isDummy = false
    this.isHided = false
  }
}

const COIN_MULTIPLIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export class ItemFakeWithMultiplier extends Container {
  isPooling: boolean = false
  isDummy: boolean = false
  isHided: boolean = false
  id: IDSpecial
  #multiplierValue: number = 1
  #sprite: Sprite
  #multiplierLabel: MultiplierLabel

  constructor(id: IDSpecial) {
    super()

    this.id = id

    this.#sprite = this.addChild(new Sprite(itemsAtlas.getTexture(`static/${TEXTURE_MAP[id]}.png`)))
    this.#sprite.anchor.set(0.5)

    this.#multiplierLabel = this.addChild(new MultiplierLabel(true))
    this.#multiplierLabel.setSize(60)
    this.#multiplierLabel.position.set(0, 0)

    if (id === IDSpecial.Collector) {
      this.#multiplierLabel.alpha = 0
    }

    this.#setRandomMultiplier()
  }

  #setRandomMultiplier() {
    if (this.id === IDSpecial.Coin) {
      const randomIndex = Math.floor(Math.random() * COIN_MULTIPLIERS.length)
      this.#multiplierValue = COIN_MULTIPLIERS[randomIndex]
      this.#multiplierLabel.value = this.#multiplierValue
    }
  }

  get multiplier() {
    return this.#multiplierValue
  }

  setMultiplier(value: number) {
    this.#multiplierValue = value
    this.#multiplierLabel.value = value
  }

  reset() {
    this.alpha = 1
    this.position.set(0, 0)
    this.zIndex = 0
    this.isDummy = false
    this.isHided = false
    this.#setRandomMultiplier()
  }
}
