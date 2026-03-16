export { }

declare global {
  namespace TWEEN {
    const Events: {
      readonly start: `start`
      readonly stop: `stop`
      readonly complete: `complete`
      readonly update: `update`
      readonly repeat: `repeat`
    }

    type Event = typeof Events[keyof typeof Events]
  }
}
