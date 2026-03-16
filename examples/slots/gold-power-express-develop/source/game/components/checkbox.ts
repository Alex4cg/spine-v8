import { Container, Rectangle, Sprite } from 'pixi.js'
import { ui } from '@clawbuster/facade'
import mainAtlas from '@/assets/atlas/main/atlas.gen'
import { Tween, cubicIn, backOut } from '@/gkit/tweens'

export const CHECKBOX_SIZE = 42
export const CHECKBOX_OFFSET = 25
const CHECKBOX_SCALE = 0.85

export default class Checkbox extends Container {
  #activeState: Sprite

  constructor(textWidth: number) {
    super()

    const checkbox = this.addChild(new Sprite(mainAtlas.getTexture(`checkbox-disable`)))
    checkbox.scale.set(CHECKBOX_SCALE)

    this.#activeState = this.addChild(new Sprite(mainAtlas.getTexture(`checkbox-active`)))
    this.#activeState.scale.set(CHECKBOX_SCALE)
    this.#activeState.tint = 0xfffe00
    this.#activeState.anchor.set(0.5)
    this.#activeState.position.set(checkbox.width * 0.5, checkbox.height * 0.5)
    this.#activeState.alpha = Number(!ui.showWelcomeScreen())

    const hitArea = new Rectangle(0, -10, CHECKBOX_SIZE + CHECKBOX_OFFSET + textWidth + 10, 60)

    this.eventMode = `static`
    this.cursor = `pointer`
    this.hitArea = hitArea

    this.on(`pointertap`, () => {
      ui.toggleWelcomeScreen()

      if (!ui.showWelcomeScreen()) {
        Tween.to(this.#activeState, { alpha: 1, scaleX: 0.85, scaleY: 0.85 }, { duration: 150, easing: backOut }).start()
      } else {
        Tween.to(this.#activeState, { alpha: 0, scaleX: 0, scaleY: 0 }, { duration: 150, easing: cubicIn }).start()
      }
    })
  }
}
