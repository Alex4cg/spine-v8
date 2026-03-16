export interface StatePayload<S extends string, P extends object, SN extends S = S> {
  name: SN | null
  payload: P | null
}

export interface StateOptions<S extends Record<string, string>> {
  from?: (S[keyof S] | null)[],
  enter?: (currentState: S[keyof S] | null, exitState: S[keyof S] | null) => void
}
