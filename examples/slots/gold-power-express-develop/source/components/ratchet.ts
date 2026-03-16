import { MiniSignal } from 'mini-signals'

interface RatchetOptions {
  startValue?: number
  endValue?: number
  divider?: number
}

export default class Ratchet {
  #endValue = 0

  #divider = 0
  #border = 0

  #ended = false

  #initialOptions: Required<RatchetOptions>
  onTick: MiniSignal | null
  onEnd: MiniSignal | null

  constructor({ startValue = 0, endValue = 0, divider = 0 }: RatchetOptions) {
    this.#initialOptions = {
      startValue,
      endValue,
      divider
    }

    this.reset()

    this.onTick = new MiniSignal()
    this.onEnd = new MiniSignal()
  }

  update(value: number) {
    if (value >= this.#endValue && !this.#ended) {
      this.onEnd!.dispatch()
      this.#ended = true
    } else if (Math.abs(value) >= Math.abs(this.#border + this.#divider)) {
      this.#border += this.#divider
      this.onTick!.dispatch()
    }
  }

  reset() {
    this.#border = this.#initialOptions.startValue
    this.#divider = this.#initialOptions.divider
    this.#endValue = this.#initialOptions.endValue
  }

  divider(value: number) {
    this.#divider = value;
    this.#initialOptions.divider = value
  }

  startValue(value: number) {
    this.#initialOptions.startValue = value
  }

  endValue(value: number) {
    this.#initialOptions.endValue = value
    this.#endValue = value
  }

  destroy() {
    this.onTick!.detachAll()
    this.onTick = null

    this.onEnd!.detachAll()
    this.onEnd = null
  }
}
