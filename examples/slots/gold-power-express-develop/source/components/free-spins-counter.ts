import { Container, Sprite, Texture } from 'pixi.js'
import { Parallel, Tween } from '@/gkit/tweens'

import mainAtlas from '@/assets/atlas/main/atlas.gen'

const INACTIVE_ALPHA = 0.4
const ANIMATION_DURATION = 250
const TILE_SCALE = 0.94

const TEXTURES_BY_NUMBER: Record<number, Texture> = {
  1: mainAtlas.getTexture(`free-spins-counter/fs_counter_1.png`),
  2: mainAtlas.getTexture(`free-spins-counter/fs_counter_2.png`),
  3: mainAtlas.getTexture(`free-spins-counter/fs_counter_3.png`)
}

class Tile extends Container {
  #sprite: Sprite
  #isActive: boolean = true

  constructor(number: number) {
    super()
    this.#sprite = this.addChild(new Sprite(TEXTURES_BY_NUMBER[number]))
    this.#sprite.anchor.set(0.5)
    this.#sprite.scale.set(TILE_SCALE)
  }

  get isActive() {
    return this.#isActive
  }

  setActive() {
    if (this.#isActive) {
      return
    }

    this.#isActive = true
    this.#sprite.alpha = 1
  }

  setInactive() {
    if (!this.#isActive) {
      return
    }

    this.#isActive = false
    this.#sprite.alpha = INACTIVE_ALPHA
  }

  getShowTween() {
    if (this.#isActive) {
      return Tween.to({}, {}, { duration: 0 })
    }

    const tween = Tween.to(this.#sprite, { alpha: 1 }, { duration: ANIMATION_DURATION })

    tween.once(`complete`, () => {
      this.#isActive = true
    })

    return tween
  }

  getHideTween() {
    if (!this.#isActive) {
      return Tween.to({}, {}, { duration: 0 })
    }

    const tween = Tween.to(this.#sprite, { alpha: INACTIVE_ALPHA }, { duration: ANIMATION_DURATION })

    tween.once(`start`, () => {
      this.#isActive = false
    })

    return tween
  }
}

const FREESPINS_TILE_AMOUNT = 3
const TILE_GAP = -1

export default class FreeSpinsCounter extends Container {
  #tiles: Tile[] = []
  #currentActive = 3

  constructor() {
    super()

    for (let i = 0; i < FREESPINS_TILE_AMOUNT; i++) {
      const tile = new Tile(i + 1)
      this.#tiles.push(this.addChild(tile))
    }

    this.#layoutTiles()
  }

  #layoutTiles() {
    if (this.#tiles.length === 0) {
      return
    }

    const tileWidth = this.#tiles[0].width
    const totalWidth = (tileWidth * FREESPINS_TILE_AMOUNT) + (TILE_GAP * (FREESPINS_TILE_AMOUNT - 1))
    const startX = (-totalWidth / 2) + (tileWidth / 2)

    for (let i = 0; i < this.#tiles.length; i++) {
      this.#tiles[i].x = startX + (i * (tileWidth + TILE_GAP))
    }
  }

  get activeTiles() {
    return this.#currentActive
  }

  setActiveByNumber(number: number) {
    this.#currentActive = number

    for (let i = 0; i < this.#tiles.length; i++) {
      const tile = this.#tiles[i]

      if (i < number) {
        tile.setActive()
      } else {
        tile.setInactive()
      }
    }
  }

  getAnimationTweenByNumber(number: number) {
    const mainParallel = new Parallel()

    if (number === this.#currentActive) {
      return mainParallel
    }

    for (let i = 0; i < this.#tiles.length; i++) {
      const tile = this.#tiles[i]

      if (i < number) {
        mainParallel.add(tile.getShowTween())
      } else {
        mainParallel.add(tile.getHideTween())
      }
    }

    this.#currentActive = number

    return mainParallel
  }

  reset() {
    this.setActiveByNumber(FREESPINS_TILE_AMOUNT)
  }
}
