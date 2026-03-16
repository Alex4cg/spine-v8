import Pool from '@/gkit/utils/pool'

import ItemBase from './item-base'
import ItemCoin from './item-coin'
import ItemCollector from './item-collector'
import ItemWild from './item-wild'
import ItemFake, { ItemFakeWithMultiplier } from './item-fake'
import { IDBase, IDSpecial } from './const'

import type { ContainerChild } from 'pixi.js'

export type Item = ItemCoin | ItemCollector | ItemWild | ItemBase
export type DummyItem = ItemFake | ItemFakeWithMultiplier

function resolveBaseItemClass(id: IDBase | IDSpecial) {
  switch (id) {
    case IDSpecial.Coin:
      return new ItemCoin()

    case IDSpecial.Jackpot:
      return new ItemCoin(IDSpecial.Jackpot)

    case IDSpecial.Collector:
      return new ItemCollector()

    case IDBase.W:
      return new ItemWild()

    case IDSpecial.Blank:
      throw new Error(`Cannot create item for BLANK symbol — it should be filtered out before getItem()`)

    default:
      return new ItemBase(id)
  }
}

function resolveDummyItemClass(id: IDBase | IDSpecial): DummyItem {
  if (id === IDSpecial.Coin || id === IDSpecial.Collector) {
    return new ItemFakeWithMultiplier(id as IDSpecial)
  }

  return new ItemFake(id)
}

const itemPool = new Pool<Item, IDBase | IDSpecial>(resolveBaseItemClass, `items`)
const dummyPool = new Pool<DummyItem, IDBase | IDSpecial>(resolveDummyItemClass, `dummies`)

export function getItem(id: IDBase | IDSpecial) {
  const item = itemPool.acquire(id)
  item.reset()

  return item
}

export function removeItem(item: ContainerChild) {
  const removeItem = item as Item

  if (removeItem.parent !== null) {
    removeItem.parent.removeChild(removeItem)
  } else {
    throw new Error(`Item has no parent`)
  }

  itemPool.release(removeItem, removeItem.id)
}

export function getDummyItem(id: IDBase | IDSpecial) {
  const item = dummyPool.acquire(id)
  item.reset()

  return item
}

export function removeDummyItem(item: ContainerChild) {
  const fakeItem = item as DummyItem

  if (fakeItem.parent !== null) {
    fakeItem.parent.removeChild(fakeItem)
  } else {
    // console.error(fakeItem)
    throw new Error(`Fake item has no parent`)
  }

  dummyPool.release(fakeItem, fakeItem.id)
}
