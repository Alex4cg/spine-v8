import { Container } from 'pixi.js'

import Jackpot from '@/components/jackpots/jackpot'
import { JackpotTypes, SAFE_ZONE_WIDTH } from '@/const'
import game from '@/game/game'
import type { onResizeProps } from '@/types'

export default class JackpotsContainer extends Container {
  readonly #jackpots: Map<JackpotTypes, Jackpot> = new Map()

  constructor() {
    super()

    const grand = new Jackpot(JackpotTypes.Grand)
    this.#jackpots.set(JackpotTypes.Grand, this.addChild(grand))

    const major = new Jackpot(JackpotTypes.Major)
    this.#jackpots.set(JackpotTypes.Major, this.addChild(major))

    const midi = new Jackpot(JackpotTypes.Midi)
    this.#jackpots.set(JackpotTypes.Midi, this.addChild(midi))

    const mini = new Jackpot(JackpotTypes.Mini)
    this.#jackpots.set(JackpotTypes.Mini, this.addChild(mini))

    game.onResize.add((options: onResizeProps) => this.#onResize(options))
  }

  activeJackpotByType(jackpotType: JackpotTypes, repeat = false) {
    const jackpot = this.#jackpots.get(jackpotType)
    if (!jackpot) {
      console.warn(`Jackpot ${jackpotType} not found!`) // eslint-disable-line

      return
    }

    jackpot.active(repeat)
  }

  stopJackpotByType(jackpotType: JackpotTypes) {
    const jackpot = this.#jackpots.get(jackpotType)
    if (!jackpot) {
      console.warn(`Jackpot ${jackpotType} not found!`) // eslint-disable-line

      return
    }

    jackpot.stop()
  }

  stopAllJackpots() {
    for (const jackpot of this.#jackpots.values()) {
      jackpot.stop()
    }
  }

  #onResize(options: onResizeProps) {
    const jackpotScale = 1
    const leftX = options.mobile ? 200 : 180
    const rightX = SAFE_ZONE_WIDTH - (options.mobile ? 200 : 180)
    const topRowY = options.mobile ? 45 : 35
    const bottomRowY = options.mobile ? 145 : 135

    const grand = this.#jackpots.get(JackpotTypes.Grand)
    if (grand) {
      grand.scale.set(jackpotScale)

      grand.x = leftX
      grand.y = topRowY
    }

    const major = this.#jackpots.get(JackpotTypes.Major)
    if (major) {
      major.scale.set(jackpotScale)

      major.x = rightX
      major.y = topRowY
    }

    const midi = this.#jackpots.get(JackpotTypes.Midi)
    if (midi) {
      const midiXOffset = 10
      midi.scale.set(jackpotScale)

      midi.x = leftX - midiXOffset
      midi.y = bottomRowY
    }

    const mini = this.#jackpots.get(JackpotTypes.Mini)
    if (mini) {
      const miniXOffset = 10
      mini.scale.set(jackpotScale)

      mini.x = rightX + miniXOffset
      mini.y = bottomRowY
    }
  }
}
