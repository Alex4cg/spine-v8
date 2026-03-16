import { getRandomInt } from '@clawbuster/claw-core'

export function getRandomIndicesByShare<T>(percent: number, arr: Array<T>) {
  if (percent === 0) {
    return []
  }

  const total = arr.length
  const count = Math.max(1, Math.floor((percent / 100) * total))
  const indices = Array.from({ length: total }, (_, i) => i)

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

    const iValue = indices[i]
    const jValue = indices[j]

    indices[i] = jValue
    indices[j] = iValue
  }

  return indices.slice(0, count)
}

export function weightedPick<T>(items: T[], weights: number[] | null = null) {
  if (items.length === 0) {
    throw new Error(`items must not be empty`)
  }

  if (weights === null) {
    const checkItem = items[0] as T & { weight: number }

    if (typeof checkItem.weight !== `number`) {
      throw new Error(`items must have .weight number when weights is not provided`)
    }

    const weightedItems = items as Array<T & { weight: number }>

    let weight = 0

    for (let i = 0; i < weightedItems.length; i++) {
      weight += weightedItems[i].weight
    }

    weight = getRandomInt(0, weight - 1)

    let i = 0

    do {
      weight -= weightedItems[i].weight

      i++
    } while (weight >= 0)

    return items[i - 1]
  }

  if (weights.length !== items.length) {
    if (weights.length < items.length) {
      let lastWeight = 0

      for (let i = 0; i < items.length; i++) {
        if (weights[i] !== undefined) {
          lastWeight = weights[i] > lastWeight ? weights[i] : lastWeight
        } else {
          weights[i] = lastWeight
        }
      }
    }
  }

  let weight = 0

  for (let i = 0; i < items.length; i++) {
    weight += weights[i]
  }

  weight = getRandomInt(0, weight - 1)

  let i = 0

  do {
    weight -= weights[i]
    i++
  } while (weight >= 0)

  return items[i - 1]
}
