export default class SimpleStack extends Array<string> {
  constructor(size: number) {
    super(size)
  }

  override push(item: string) {
    for (let i = 0; i < this.length; i++) {
      this[i] = this[i + 1]
    }

    this[this.length - 1] = item

    return this.length
  }

  get() {
    return this.toReversed()
  }

  getByOriginalOrder() {
    return this
  }
}
