export type Poolable<T> = T & { isPooling: boolean }

export default class Pool<TInstance, TType extends string = string> {
  #pool: Record<TType, Poolable<TInstance>[]> = {} as Record<TType, Poolable<TInstance>[]>
  #factory: (type: TType) => TInstance
  #name: string

  constructor(factory: (type: TType) => TInstance, name?: string) {
    this.#factory = factory
    this.#name = name || `pool`
  }

  get name(): string {
    return this.#name
  }

  acquire = (type: TType = `default` as TType): Poolable<TInstance> => {
    let instance: Poolable<TInstance>

    if (!this.#pool[type]) {
      this.#pool[type] = []
      instance = this.#factory(type) as Poolable<TInstance>
    } else if (this.#pool[type].length > 0) {
      instance = this.#pool[type].pop()!
    } else {
      instance = this.#factory(type) as Poolable<TInstance>
    }

    instance.isPooling = false

    return instance
  }

  release = (instance: Poolable<TInstance>, type: TType = `default` as TType): void => {
    if (!this.#pool[type]) {
      // This is needed to get more information about the error
      // eslint-disable-next-line
      console.log(instance)
      throw new Error(`Should not release instance of type ${type} to pool ${this.#name}`)
    }

    instance.isPooling = true
    this.#pool[type].push(instance)
  }
}
