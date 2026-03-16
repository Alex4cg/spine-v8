import { Container } from 'pixi.js'

(function setAdditionalProps() {
  Object.defineProperty(Container.prototype, `scaleX`, {
    get() {
      return this.scale.x
    },
    set(value) {
      this.scale.x = value
    }
  })

  Object.defineProperty(Container.prototype, `scaleY`, {
    get() {
      return this.scale.y
    },
    set(value) {
      this.scale.y = value
    }
  })
})()
