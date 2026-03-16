import SimpleStack from '@/gkit/utils/simple-stack'

import type { StatePayload, StateOptions } from './index.d'

export class FSMError extends Error {
  public originalError: Error | null = null
  constructor(message: string, stack: SimpleStack | null = null, originalError = null) {
    super(message)

    this.originalError = originalError
    this.stack = `${message}\n    at order\n ${stack && stack.get().join(`\n `)}`
  }
}

export default class FSM<
  S extends Record<string, string>,
  // PayloadMaps extends Record<S, object>,
  ContextType extends object
  > {
  #verbose: boolean
  #internalState: StatePayload<S[keyof S], object> // PayloadMaps[S]>
  #pendingState: StatePayload<S[keyof S], object> | null // PayloadMaps[S]> | null
  #context: ContextType | null
  #options: Partial<Record<S[keyof S], StateOptions<S>>>
  #previousStateName: S[keyof S] | null
  #stack: SimpleStack
  #enterStateCallback: ((currentState: S[keyof S] | null, exitState: S[keyof S] | null) => void) | null

  constructor(verbose = false, stackSize = 5) {
    this.#verbose = verbose
    this.#internalState = { name: null, payload: null }
    this.#pendingState = null
    this.#context = null
    this.#options = {}
    this.#previousStateName = null // initial
    this.#stack = new SimpleStack(stackSize)
    this.#enterStateCallback = null
  }

  setContext(value: ContextType) {
    this.#context = value
  }

  setEnterStateCallback(callback: (currentState: S[keyof S] | null, exitState: S[keyof S] | null) => void) {
    this.#enterStateCallback = callback
  }

  next(stateName: S[keyof S], options: StateOptions<S>) {
    this.#options[stateName] = {
      from: [this.#previousStateName],
      ...options
    }

    if (!this.#pendingState) {
      this.#pendingState = { name: stateName, payload: null }
    }

    this.#previousStateName = stateName

    return this
  }

  switch(stateName: S[keyof S], payload: object | null = null) { // TODO: object -> PayloadMaps[S]
    const options = this.#options[stateName]

    if (!options) {
      throw new FSMError(`Request to switch to unregistered state: ${stateName}`, this.#stack)
    }

    this.#pendingState = { name: stateName, payload }

    if (this.#verbose) {
      // Error.captureStackTrace(this._#pendingState)

      if (stateName === this.#internalState.name) {
        // eslint-disable-next-line
        console.warn(`Request to switch to the same state: ${stateName}`, this.#stack)
      }
    }
  }

  get state() {
    return this.#internalState.name
  }

  get payload() {
    return this.#internalState.payload
  }

  canSwitch(stateName: S[keyof S]) {
    const options = this.#options[stateName]
    const can = options!.from!.indexOf(this.#internalState.name) > -1

    if (this.#verbose) {
      // eslint-disable-next-line
      console.log(`canSwitch to ${stateName} from ${this.#internalState.name}: ${can ? `YES` : `NO`}`)
    }

    return can
  }

  process() {
    while (this.#internalState.name !== this.#pendingState?.name) {
      const pending = this.#pendingState!
      const options = this.#options[pending.name!] as StateOptions<S>

      if (options.from!.indexOf(this.#internalState.name) > -1) {
        if (this.#verbose) {
          // eslint-disable-next-line
          console.log(`${this.#internalState.name} -> ${pending.name}`)
        }

        const exitState = this.#internalState
        this.#internalState = pending

        if (this.#enterStateCallback) {
          this.#enterStateCallback.call(this.#context, this.#internalState.name, exitState.name)
        }

        if (options.enter) {
          options.enter.call(this.#context, this.#internalState.name, exitState.name)
        }

        this.#stack.push(this.#internalState.name!)
      } else {
        throw new FSMError(`Denied state switch from ${this.#internalState.name} to ${pending.name}`, this.#stack)
      }
    }

    return this.state
  }
}

