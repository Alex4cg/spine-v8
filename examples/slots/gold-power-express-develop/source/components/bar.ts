import {
  Container,
  Sprite,
  Graphics,
  type ContainerChild
} from 'pixi.js'

import { ROWS } from '@/const'
import { ITEM_V_GAP, ITEM_H_GAP } from '@/game/components/field-layout'
import { getDummyItem, getItem, removeDummyItem, removeItem, type DummyItem } from './items'
import { IDBase, IDSpecial } from './items/const'
import bgAtlas from '@/assets/atlas/background/atlas.gen'
import { eventBus } from '@/game/game'
import { GameEvents } from '@/game/events'

import { Chain, IndefiniteTween, Parallel, Tween, quadInOut, sineInOut, cubicOut } from '@/gkit/tweens'
import { changeParent } from '@/gkit/utils/change-parent'

import type ItemBase from '@/components/items/item-base'

type ID = IDBase | IDSpecial

type ScrollItem = ItemBase | DummyItem

function isDummyItem(item: ScrollItem): item is DummyItem {
  return `isDummy` in item
}

interface BarOptions {
  index?: number
  size?: number
  x?: number
  y?: number
}

interface Cells {
  [key: number]: {
    x: number,
    y: number,
    c: number,
    r: number,
    item: ItemBase | null,
    isMedBar: boolean,
  }
}

export enum BarEvents {
  OnCompleteBeforeAnimationScroll = `on_complete_before_animation_scroll`,
  OnCompleteFullAnimationScroll = `on_complete_full_animation_scroll`,
  OnCompleteBeforeSpecialAnimationScroll = `on_complete_before_special_animation_scroll`,
  OnCompleteFullSpecialAnimationScroll = `on_complete_full_special_animation_scroll`
}

const DEFAULT_Z_INDEX = 0

export default class Bar extends Container {
  #itemsToSweep: (ItemBase | null)[] = []
  #fakeItems: DummyItem[] = []
  #anticipationItems: DummyItem[] = []
  #items: (ItemBase | null)[] = []
  #lastY: number = 0

  #barIndex: number
  #barSize: number
  #cells: Cells = {}

  #isTeased = false

  #itemsData: ScrollItem[] = []
  #preScrollItemsData: ScrollItem[] = []
  #scrollTo = 0

  #defaultPositionX = 0
  #defaultPositionY = 0

  #destructionThresholdPosition: number
  #visibleFromPosition: number

  #isStopped: boolean = false
  #isResponseReceived: boolean = false

  #isFreeSpinsMode: boolean = false

  #fakeItemsByCells: Record<number, DummyItem[]> = {}
  #holdItemsByCells: Record<number, boolean> = {}
  #containersForHoldItemsMode: Record<number, Container> = {}
  #itemsToSweepByCells: Record<number, (ItemBase | null)[]> = {}
  #preScrollItemsDataByCells: Record<number, ScrollItem[]> = {}
  #destructionThresholdPositionByCells: Record<number, number> = {}
  #visibleFromPositionByCells: Record<number, number> = {}
  #defaultPositionsByCells: Record<number, { x: number, y: number }> = {}
  #isStoppedByCells: Record<number, boolean> = {}
  #itemsDataByCells: Record<number, ScrollItem[]> = {}
  #anticipationItemsByCells: Record<number, DummyItem[]> = {}
  #scrollToByCells: Record<number, number> = {}
  #isResponseReceivedByCells: Record<number, boolean> = {}
  #wrappedBgByCells: Record<number, ContainerChild[]> = {}
  #lastYByCells: Record<number, number> = {}

  #endScrollingInnerTween: Chain | Tween | null = null
  #forceEndOnStart = false
  #endMiniReelInnerTweens: Map<number, Chain> = new Map()
  #forceEndMiniReelOnStart: Map<number, boolean> = new Map()
  #miniReelScrollTweens: Map<number, Tween> = new Map()

  constructor(options: BarOptions) {
    super()

    this.#barIndex = options.index || 0
    this.#barSize = options.size || ROWS
    this.#defaultPositionX = options.x || 0
    this.#defaultPositionY = options.y || 0

    this.position.set(this.#defaultPositionX, this.#defaultPositionY)

    for (let i = 0; i < this.#barSize; i++) {
      const cellY = Math.round(i * ITEM_V_GAP)

      this.#cells[i] = {
        x: 0,
        y: cellY,
        c: this.#barIndex,
        r: i,
        item: null,
        isMedBar: false
      }

      this.#fakeItemsByCells[i] = []
      this.#holdItemsByCells[i] = false
      const container = this.addChild(new Container())
      container.y = cellY
      container.alpha = 0

      this.#containersForHoldItemsMode[i] = container

      this.#itemsToSweepByCells[i] = []
      this.#preScrollItemsDataByCells[i] = []

      this.#visibleFromPositionByCells[i] = -(ITEM_V_GAP + (0.3 * ITEM_V_GAP))
      this.#destructionThresholdPositionByCells[i] = ITEM_V_GAP + (0.1 * ITEM_V_GAP)
      this.#defaultPositionsByCells[i] = {
        x: 0,
        y: cellY
      }

      const cellW = Math.ceil(ITEM_H_GAP)
      const cellH = Math.ceil(ITEM_V_GAP)

      let startBgY = -cellH

      const labels = [`up`, `default`, `down`]

      for (let index = 0; index < 3; index++) {
        const textureName = this.#barIndex === 1 ? `item_bg_med_bar.png` : `item_bg.png`
        const bg = container.addChild(new Sprite(bgAtlas.getTexture(textureName)))
        bg.anchor.set(0.5)
        bg.y = startBgY
        bg.label = labels[index]

        bg.roundPixels = true
        bg.width = cellW
        bg.height = cellH

        bg.visible = bg.label === `default`

        startBgY += cellH

        if (!this.#wrappedBgByCells[i]) {
          this.#wrappedBgByCells[i] = [bg]
        } else {
          this.#wrappedBgByCells[i].push(bg)
        }
      }

      const graphics = this.addChild(new Graphics())

      const maskWidth = cellW
      const maskHeight = cellH

      graphics.rect(0, 0, maskWidth, maskHeight)
      graphics.fill(0xde3249)

      const maskX = -(maskWidth * 0.5)
      const maskY = cellY - (maskHeight * 0.5)

      graphics.position.set(maskX, maskY)

      container.mask = graphics

      this.#isStoppedByCells[i] = true
      this.#itemsDataByCells[i] = []
      this.#anticipationItemsByCells[i] = []

      this.#scrollToByCells[i] = 0
      this.#isResponseReceivedByCells[i] = false
      this.#lastYByCells[i] = 0
    }

    this.#destructionThresholdPosition = this.#cells[this.#barSize - 1].y + (ITEM_V_GAP * 2)
    this.#visibleFromPosition = this.#cells[0].y - (ITEM_V_GAP * 2.5)

    this.#lastY = this.#cells[0].y - (ITEM_V_GAP)
  }

  get delayPerBar() {
    return 0.2
  }

  setInitialItems(ids: ID[]) {
    if (ids.length !== this.#barSize) {
      throw new Error(`Ids count is not equal to bar size!`)
    }

    if (this.#items.length) {
      for (const item of this.#items) {
        if (item) {
          removeItem(item)
        }
      }

      this.#items.length = 0
    }

    for (let i = 0; i < this.#barSize; i++) {
      const cell = this.#cells[i]

      const id = ids[i]
      const item = getItem(id)
      item.zIndex = DEFAULT_Z_INDEX

      item.label = `initial-item-cell-${i}`

      item.position.copyFrom(cell)
      cell.item = item
      this.#items[i] = this.addChild(item)
    }
  }

  restoreItems(items: { item: ItemBase, index: number }[]) {
    if (items.length > this.#barSize) {
      throw new Error(`Items count is more than bar size!`)
    }

    for (let i = 0; i < items.length; i++) {
      const itemData = items[i]

      const inheritIndex = this.#items.indexOf(itemData.item)

      if (inheritIndex !== -1) {
        const cell = this.#cells[inheritIndex]

        const targetParent = this.#isFreeSpinsMode
          ? this.#containersForHoldItemsMode[itemData.index]
          : this

        const targetPosition = this.#isFreeSpinsMode
          ? { x: 0, y: 0 }
          : cell

        if (targetParent !== itemData.item.parent) {
          changeParent(itemData.item, targetParent)
        }

        itemData.item.position.copyFrom(targetPosition)
      } else {
        this.restoreItem(itemData.item, itemData.index)
      }
    }
  }

  restoreItem(item: ItemBase, index: number) {
    const cell = this.#cells[index]

    const targetParent = this.#isFreeSpinsMode
      ? this.#containersForHoldItemsMode[index]
      : this

    const targetPosition = this.#isFreeSpinsMode
      ? { x: 0, y: 0 }
      : cell

    if (targetParent !== item.parent) {
      changeParent(item, targetParent)
    }

    item.position.copyFrom(targetPosition)
    item.alpha = 1
  }

  setFakeItems(ids: ID[]) {
    for (const id of ids) {
      const fakeItem = getDummyItem(id)
      fakeItem.visible = false
      fakeItem.isDummy = true
      fakeItem.label = `fake-item`

      this.#fakeItems.push(this.addChild(fakeItem))
    }
  }

  setAnticipationItems(ids: ID[]) {
    for (const id of ids) {
      const anticipationItem = getDummyItem(id)
      anticipationItem.visible = false
      anticipationItem.isDummy = true
      anticipationItem.label = `anticipation-item`

      this.#anticipationItems.push(this.addChild(anticipationItem))
    }
  }

  setItems(ids: ID[]) {
    if (ids.length !== this.#barSize) {
      throw new Error(`Ids count is not equal to bar size!`)
    }

    for (let i = 0; i < this.#barSize; i++) {
      const cell = this.#cells[i]

      if (cell.item) {
        cell.item = null
      }

      const id = ids[i]
      const item = getItem(id)
      item.name = `placed-item-cell-${i}`

      item.position.copyFrom(cell)
      item.visible = false

      cell.item = item
      this.#items[i] = this.addChild(item)
    }
  }

  async startBaseScrolling(
    fallStepDuration: number,
    bounceConfig?: { enabled: boolean; distance: number; duration: number }
  ) {
    if (bounceConfig?.enabled && bounceConfig.distance > 0 && bounceConfig.duration > 0) {
      await this.#playPreSpinBounce(bounceConfig.distance, bounceConfig.duration)
    }

    this.#prepareItemsForScroll()

    while (!this.#isStopped) {
      await this.#singleScrollItems(fallStepDuration)
    }

    eventBus.emit(BarEvents.OnCompleteBeforeAnimationScroll, this.#barIndex)
  }

  async #playPreSpinBounce(distance: number, duration: number): Promise<void> {
    const startY = this.y

    return new Promise((resolve) => {
      const bounceUpDuration = duration * 0.45
      const bounceDownDuration = duration * 0.55

      const bounceUp = Tween.to(this, { y: startY - distance }, { duration: bounceUpDuration, easing: sineInOut })

      bounceUp.once(`complete`, () => {
        const bounceDown = Tween.to(this, { y: startY }, { duration: bounceDownDuration, easing: sineInOut })

        bounceDown.once(`complete`, () => {
          resolve()
        })

        bounceDown.start()
      })

      bounceUp.start()
    })
  }

  #prepareItemsForScroll() {
    this.#isStopped = false
    this.#isResponseReceived = false

    this.#preScrollItemsData.length = 0
    this.#itemsData.length = 0
    this.#itemsToSweep.length = 0

    for (let i = 0; i < this.#barSize; i++) {
      const cell = this.#cells[i]
      let item = cell.item as ItemBase | null

      if (!item) {
        item = getItem(IDBase.L1) as ItemBase
        item.label = `recovered-item-cell-${i}`
        item.position.copyFrom(cell)
        cell.item = item
        this.#items[i] = this.addChild(item)
      }

      item.label = `item-to-sweep-${i}`

      this.#itemsToSweep[i] = item
    }

    const rollPosition = this.#cells[this.#barSize - 1].y

    const offset = ITEM_V_GAP

    let nextRollPosition = rollPosition

    for (let i = this.#barSize - 1; i >= 0; i--) {
      if (i !== 0) {
        nextRollPosition -= offset
      }

      const item = this.#itemsToSweep[i] as ItemBase

      this.#preScrollItemsData.push(item)
    }

    for (let i = 0; i < this.#fakeItems.length; i++) {
      nextRollPosition -= offset

      const item = this.#fakeItems[i]
      item.y = nextRollPosition

      item.visible = false

      this.#preScrollItemsData.push(item)
    }
  }

  async #singleScrollItems(fallStepDuration: number): Promise<void> {
    return new Promise((resolve) => {
      const preItemsData = this.#preScrollItemsData
      const fakeCount = preItemsData.length - this.#barSize

      const tween = Tween.to(this, { y: this.y + ITEM_V_GAP }, { duration: fallStepDuration })

      tween.on(`update`, () => {
        for (const item of preItemsData) {
          const itemPositionY = item.y + this.y - this.#defaultPositionY

          if (itemPositionY > this.#visibleFromPosition) {
            if (!item.visible) item.visible = true
          }

          if (itemPositionY > this.#destructionThresholdPosition) {
            if (isDummyItem(item) && item.isDummy && !this.#isResponseReceived) {
              item.y -= ITEM_V_GAP * fakeCount
              this.#lastY = item.y
              item.visible = false
            }
          }
        }
      })

      tween.once(`complete`, () => resolve())

      tween.start()
    })
  }

  endBaseScrolling(
    fallStepDuration: number,
    backScrollDuration: number,
    bounceDistance: number,
    decelerationMultiplier: number = 1
  ) {
    return new IndefiniteTween((stopTween: () => void) => {
      this.#isStopped = true
      this.#isResponseReceived = true

      const listener = (index: number) => {
        if (index !== this.#barIndex) return

        eventBus.removeListener(BarEvents.OnCompleteBeforeAnimationScroll, listener)

        this.#secondPrepareItemsForScroll()

        const tween = this.#getEndScrollingTween(
          fallStepDuration,
          backScrollDuration,
          bounceDistance,
          decelerationMultiplier
        )
        this.#endScrollingInnerTween = tween

        if (this.#forceEndOnStart) {
          this.#forceEndOnStart = false
          this.#endScrollingInnerTween = null
          tween.once(`complete`, () => stopTween())
          tween.start()
          tween.end()

          return
        }

        tween.once(`complete`, () => {
          this.#endScrollingInnerTween = null
          stopTween()
        })

        tween.start()
      }

      eventBus.on(BarEvents.OnCompleteBeforeAnimationScroll, listener)
    })
  }

  forceEndScrolling() {
    if (this.#endScrollingInnerTween) {
      this.#endScrollingInnerTween.end()
    } else {
      this.#forceEndOnStart = true
    }
  }

  #secondPrepareItemsForScroll() {
    let index = 1
    let startFromLastItem: number | undefined

    const expectedGlobalY = this.#defaultPositionY - ITEM_V_GAP

    for (const item of this.#preScrollItemsData) {
      const currentGlobalY = item.y + this.y

      if (
        currentGlobalY > (expectedGlobalY - (ITEM_V_GAP * 0.5))
        && currentGlobalY <= (expectedGlobalY + (ITEM_V_GAP * 0.5))
      ) {
        startFromLastItem = item.y

        this.#itemsData.push(item)
      } else if (currentGlobalY <= (expectedGlobalY - (ITEM_V_GAP * 0.5))) {
        item.visible = false
      }
    }

    if (startFromLastItem === undefined) {
      startFromLastItem = this.#preScrollItemsData[0].y
    }

    const startFrom = startFromLastItem!

    for (let i = 0; i < this.#anticipationItems.length; i++) {
      const item = this.#anticipationItems[i]
      item.visible = false

      item.y = startFrom - (ITEM_V_GAP * index)
      index++
    }

    for (let i = this.#barSize - 1; i >= 0; i--) {
      const item = this.#items[i] as ItemBase
      item.visible = false
      item.y = startFrom - (ITEM_V_GAP * index)

      this.#itemsData.push(item)
      index++
    }

    this.#scrollTo = this.y
      + this.#defaultPositionY
      - (this.y + this.#itemsData.at(-1)!.y)
  }

  #getEndScrollingTween(
    fallStepDuration: number,
    backScrollDuration: number,
    bounceBackDistance: number,
    decelerationMultiplier: number = 1
  ) {
    const baseDuration = this.#itemsData.length * fallStepDuration
    const duration = decelerationMultiplier > 1 ? baseDuration * decelerationMultiplier : baseDuration
    const scrollEasing = decelerationMultiplier > 1 ? cubicOut : undefined

    if (this.#preScrollItemsData.length === 0 || this.#itemsData.length === 0) {
      return Tween.to(this, { y: this.#defaultPositionY }, { duration: backScrollDuration })
    }

    let i = 0

    const preItemsData = this.#preScrollItemsData
    const itemsData = this.#itemsData

    const scrollTween = Tween.to(this,
      { y: this.#scrollTo + bounceBackDistance },
      { duration, ...(scrollEasing && { easing: scrollEasing }) }
    )

    if (decelerationMultiplier > 1) {
      scrollTween.on(`start`, () => {
        for (let j = this.#barSize - 1; j >= 0; j--) {
          const item = this.#items[j] as ItemBase | null
          if (item && `setStaticTexture` in item) {
            item.setStaticTexture()
          }
        }
      })
    }

    scrollTween.on(`update`, () => {
      if (preItemsData[i].y + this.y - this.#defaultPositionY > this.#destructionThresholdPosition) {
        preItemsData[i].visible = false
      }

      i = i < preItemsData.length - 1 ? i + 1 : 0

      for (const item of itemsData) {
        const localY = item.y + this.y - this.#defaultPositionY
        const shouldBeVisible = localY > this.#visibleFromPosition && localY < this.#destructionThresholdPosition
        if (item.visible !== shouldBeVisible) item.visible = shouldBeVisible
      }
    })

    scrollTween.once(`complete`, () => {
      // const item1 = (this.#itemsData[this.#itemsData.length - 1] as ItemBase).id
      // const item2 = (this.#itemsData[this.#itemsData.length - 2] as ItemBase).id
      // const item3 = (this.#itemsData[this.#itemsData.length - 3] as ItemBase).id
    })

    const mainChain = new Chain()

    mainChain.add(scrollTween)

    const returnTween = Tween.to(this, { y: this.#scrollTo }, { duration: backScrollDuration, easing: quadInOut })

    returnTween.on(`start`, () => {
      for (let i = this.#barSize - 1; i >= 0; i--) {
        const item = this.#items[i] as ItemBase | null
        if (item && `setStaticTexture` in item) {
          item.setStaticTexture()
        }
      }
    })

    mainChain.add(returnTween)

    return mainChain
  }

  sweep() {
    this.#preScrollItemsData.length = 0
    this.#itemsData.length = 0

    for (const item of this.#itemsToSweep) {
      if (item && item.parent) {
        removeItem(item)
      }
    }

    this.#itemsToSweep.length = 0

    for (const item of this.#fakeItems) {
      if (item && item.parent) {
        removeDummyItem(item)
      }
    }

    for (const item of this.#anticipationItems) {
      if (item && item.parent) {
        removeDummyItem(item)
      }
    }

    this.#fakeItems.length = 0
    this.#anticipationItems.length = 0
    this.#itemsData.length = 0
    this.#preScrollItemsData.length = 0

    for (let i = 0; i < this.#barSize; i++) {
      const cell = this.#cells[i]

      cell.item!.position.copyFrom(cell)
      cell.item!.setStaticTexture()
    }

    eventBus.emit(GameEvents.ReelStop, {
      barIndex: this.#barIndex,
      ids: Array.from({ length: this.#barSize }, (_, i) => this.#cells[i].item!.id)
    })

    this.y = this.#defaultPositionY
    this.#isTeased = false

    this.#isStopped = false
    this.#isResponseReceived = false
    this.#endScrollingInnerTween = null
    this.#forceEndOnStart = false
  }

  getItems() {
    return this.#items
  }

  setTeasing() {
    this.#isTeased = true
  }

  getItemByPositionIndex(index: number) {
    return this.#items[index]
  }

  changeItemByPositionIndexTo(index: number, id: (IDSpecial | IDBase)) {
    removeItem(this.#items[index]!)

    this.#items[index] = null

    const cell = this.#cells[index]
    const item = getItem(id)
    item.label = `changed-item-cell-from-${(cell.item as ItemBase)?.id}-to-${id}`

    item.position.copyFrom(cell)
    cell.item = item

    this.#items[index] = this.addChild(item)

    return this.#items[index]
  }

  revealItemByPositionIndex(index: number, id: (IDSpecial | IDBase)) {
    const cell = this.#cells[index]
    const currentItem = cell.item!

    const item = getItem(id)
    item.label = `revealed-item-cell-from-${(cell.item as ItemBase)?.id}-to-${id}`

    item.position.copyFrom(cell)
    cell.item = item

    this.#items[index] = this.addChild(item)

    return { newItem: this.#items[index], deleteOldItem: () => removeItem(currentItem) }
  }

  setMiniReelFakeItemsByPositionIndex(ids: ID[], hidedIndices: number[], index: number) {
    for (let i = 0; i < ids.length; i++) {
      const fakeItem = getDummyItem(ids[i])

      fakeItem.visible = false
      fakeItem.isDummy = true
      fakeItem.isHided = hidedIndices.includes(i)
      fakeItem.label = `fake-item`

      this.#fakeItemsByCells[index].push(this.#containersForHoldItemsMode[index].addChild(fakeItem))
    }
  }

  setMiniReelItemByPositionIndex(index: number, id: ID) {
    if (index > this.#barSize || index < 0) {
      throw new Error(`Index is out of range!`)
    }

    const cell = this.#cells[index]
    const item = getItem(id)

    item.label = `special-item-cell-${index}`

    item.position.set(0, 0)
    cell.item = item
    this.#items[index] = this.#containersForHoldItemsMode[index].addChild(item)
  }

  setMiniReelEmptyByPositionIndex(index: number) {
    if (index > this.#barSize || index < 0) {
      throw new Error(`Index is out of range!`)
    }

    if (this.#items[index] && this.#items[index]!.parent) {
      removeItem(this.#items[index]!)
    }

    const cell = this.#cells[index]
    cell.item = null
    this.#items[index] = null
  }

  setMiniReelHoldItemByPositionIndex(index: number) {
    this.#holdItemsByCells[index] = true

    for (const bg of this.#wrappedBgByCells[index]) {
      if (bg.label !== `default`) {
        bg.visible = false
      }
    }
  }

  async startMiniReelByPositionIndex(index: number, fallStepDuration: number) {
    this.#prepareItemsForMiniReelScrollByPositionIndex(index)

    while (!this.#isStoppedByCells[index]) {
      await this.#miniReelSingleScroll(index, fallStepDuration)
    }

    eventBus.emit(BarEvents.OnCompleteBeforeSpecialAnimationScroll, this.#barIndex, index)
  }

  #prepareItemsForMiniReelScrollByPositionIndex(index: number) {
    this.#isStoppedByCells[index] = false

    const cell = this.#cells[index]
    const item = cell.item as ItemBase

    if (item) {
      item.label = `item-to-sweep-${index}`
      item.y = 0

      this.#itemsToSweepByCells[index][0] = item
      cell.item = null

      this.#preScrollItemsDataByCells[index].push(item)
    }

    const offset = ITEM_V_GAP

    let nextRollPosition = 0

    for (let fakeIndex = 0; fakeIndex < this.#fakeItemsByCells[index].length; fakeIndex++) {
      nextRollPosition -= offset

      const fakeItem = this.#fakeItemsByCells[index][fakeIndex]
      fakeItem.y = nextRollPosition

      fakeItem.visible = false

      this.#preScrollItemsDataByCells[index].push(fakeItem)
    }
  }

  #miniReelSingleScroll(index: number, fallStepDuration: number) {
    const container = this.#containersForHoldItemsMode[index]
    const preItemsData = this.#preScrollItemsDataByCells[index]
    const defaultY = this.#defaultPositionsByCells[index].y
    const visibleFrom = this.#visibleFromPositionByCells[index]
    const destructionThreshold = this.#destructionThresholdPositionByCells[index]
    const wrappedBg = this.#wrappedBgByCells[index]

    return new Promise<void>((res) => {
      const scrollTween = Tween
        .to(container, { y: container.y + ITEM_V_GAP }, { duration: fallStepDuration })
        .on(`update`, () => {
          for (const bg of wrappedBg) {
            if (bg.y + container.y - defaultY > destructionThreshold) {
              bg.y -= ITEM_V_GAP * (wrappedBg.length)
              bg.visible = false
            } else {
              bg.visible = true
            }
          }

          for (const item of preItemsData) {
            if (!item.isHided && item.y + container.y - defaultY > visibleFrom) {
              item.visible = true
            }

            if (item.y + container.y - defaultY > destructionThreshold) {
              if (isDummyItem(item) && item.isDummy && !this.#isResponseReceivedByCells[index]) {
                item.y -= ITEM_V_GAP * (preItemsData.length - 2)

                this.#lastYByCells[index] = item.y
              }
            }
          }
        })
        .once(`complete`, () => {
          this.#miniReelScrollTweens.delete(index)
          res()
        })

      this.#miniReelScrollTweens.set(index, scrollTween)
      scrollTween.start()
    })
  }

  endMiniReelByPositionIndexTween(
    index: number,
    fallStepDuration: number,
    backScrollDuration: number,
    bounceBackDistance: number
  ) {
    return new IndefiniteTween((stopTween: () => void) => {
      this.#isStoppedByCells[index] = true

      const listener = (barIndex: number, rowIndex: number) => {
        if (barIndex === this.#barIndex && rowIndex === index) {
          this.#isResponseReceivedByCells[index] = true

          this.#prepareMiniReelItemsForEndScrollByPositionIndex(index)

          const endTween = this.#getMiniReelEndScrollTween(
            index,
            fallStepDuration,
            backScrollDuration,
            bounceBackDistance
          )

          this.#endMiniReelInnerTweens.set(index, endTween)

          if (this.#forceEndMiniReelOnStart.get(index)) {
            this.#forceEndMiniReelOnStart.delete(index)
            this.#endMiniReelInnerTweens.delete(index)
            endTween.once(`complete`, () => {
              eventBus.emit(
                BarEvents.OnCompleteFullSpecialAnimationScroll,
                this.#barIndex,
                index
              )
              stopTween()
            })
            endTween.start()
            endTween.end()
            eventBus.removeListener(
              BarEvents.OnCompleteBeforeSpecialAnimationScroll,
              listener
            )

            return
          }

          endTween
            .once(`complete`, () => {
              this.#endMiniReelInnerTweens.delete(index)
              eventBus.emit(
                BarEvents.OnCompleteFullSpecialAnimationScroll,
                this.#barIndex,
                index
              )
              stopTween()
            })
            .start()

          eventBus.removeListener(
            BarEvents.OnCompleteBeforeSpecialAnimationScroll,
            listener
          )
        }
      }

      eventBus.on(BarEvents.OnCompleteBeforeSpecialAnimationScroll, listener)
    })
  }

  forceEndMiniReelScrolling(index: number) {
    const scrollTween = this.#miniReelScrollTweens.get(index)
    if (scrollTween) {
      scrollTween.end()
    }

    const innerTween = this.#endMiniReelInnerTweens.get(index)
    if (innerTween) {
      innerTween.end()
    } else {
      this.#forceEndMiniReelOnStart.set(index, true)
    }
  }

  #prepareMiniReelItemsForEndScrollByPositionIndex(index: number) {
    let itemIndex = 1

    let startFromLastItem: number

    for (const item of this.#preScrollItemsDataByCells[index]) {
      if (item.y + this.#containersForHoldItemsMode[index].y === this.#defaultPositionsByCells[index].y - ITEM_V_GAP) {
        startFromLastItem = item.y

        this.#itemsDataByCells[index].push(item)
      } else if (item.y + this.#containersForHoldItemsMode[index].y < this.#defaultPositionsByCells[index].y - ITEM_V_GAP) {
        item.visible = false
      }
    }

    for (let i = 0; i < this.#anticipationItemsByCells[index].length; i++) {
      const item = this.#anticipationItemsByCells[index][i]
      item.visible = false

      item.y = startFromLastItem! - (ITEM_V_GAP * itemIndex)

      this.#itemsDataByCells[index].push(item)
      itemIndex++
    }

    const lastItem = this.#items[index]

    if (lastItem) {
      lastItem.y = startFromLastItem! - (ITEM_V_GAP * itemIndex)

      lastItem.visible = false

      this.#itemsDataByCells[index].push(lastItem)
    }

    this.#scrollToByCells[index] = this.#containersForHoldItemsMode[index].y
      + this.#defaultPositionsByCells[index].y
      - (this.#containersForHoldItemsMode[index].y + this.#itemsDataByCells[index].at(-1)!.y)
      + (!lastItem ? ITEM_V_GAP : 0)
  }

  #getMiniReelEndScrollTween(
    index: number,
    fallStepDuration: number,
    backScrollDuration: number,
    bounceBackDistance: number
  ) {
    const itemsCount = this.#itemsDataByCells[index].length + (this.#items[index] ? 0 : 1)
    const duration = itemsCount * fallStepDuration

    const preItemsData = this.#preScrollItemsDataByCells[index]
    const itemsData = this.#itemsDataByCells[index]
    const wrappedBg = this.#wrappedBgByCells[index]

    const container = this.#containersForHoldItemsMode[index]

    const defaultY = this.#defaultPositionsByCells[index].y

    let i = 0

    const scrollTween = Tween.to(
      container,
      { y: this.#scrollToByCells[index] + bounceBackDistance },
      { duration }
    )

    scrollTween.on(`update`, () => {
      for (const bg of wrappedBg) {
        const bgGlobalY = bg.y + container.y - defaultY

        if (bgGlobalY > this.#destructionThresholdPositionByCells[index]) {
          bg.y -= ITEM_V_GAP * (wrappedBg.length)
        }

        const isInVisibleRange = bgGlobalY > (this.#visibleFromPositionByCells[index] - ITEM_V_GAP)
          && bgGlobalY < (this.#destructionThresholdPositionByCells[index] + ITEM_V_GAP)

        bg.visible = isInVisibleRange
      }

      if (preItemsData[i].y + container.y - defaultY > this.#destructionThresholdPositionByCells[index]) {
        preItemsData[i].visible = false
      }

      i = i < preItemsData.length - 1 ? i + 1 : 0

      for (const item of itemsData) {
        const localY = item.y + this.#containersForHoldItemsMode[index].y - defaultY
        item.visible = localY > this.#visibleFromPositionByCells[index]
          && localY < this.#destructionThresholdPositionByCells[index]
          && !item.isHided
      }
    })

    const mainChain = new Chain()

    mainChain.add(scrollTween)

    const returnTween = Tween.to(
      container,
      { y: this.#scrollToByCells[index] },
      { duration: backScrollDuration, easing: quadInOut }
    )

    mainChain.add(returnTween)

    return mainChain
  }

  sweepMiniReelByPositionIndex(index: number) {
    if (!this.#holdItemsByCells[index]) {
      try {
        for (const item of this.#itemsToSweepByCells[index]) {
          if (item) {
            removeItem(item)

            if (this.#items[index] === item) {
              this.#items[index] = null
            }
          }
        }

        this.#itemsToSweepByCells[index].length = 0
      } catch (error) {
        throw new Error(`sweepMiniReelByPositionIndex: ${error}`)
      }
    }

    for (const item of this.#fakeItemsByCells[index]) {
      removeDummyItem(item)
    }

    for (const item of this.#anticipationItemsByCells[index]) {
      removeDummyItem(item)
    }

    this.#fakeItemsByCells[index].length = 0
    this.#anticipationItemsByCells[index].length = 0
    this.#itemsDataByCells[index].length = 0
    this.#preScrollItemsDataByCells[index].length = 0

    for (const bg of this.#wrappedBgByCells[index]) {
      switch (bg.label) {
        case `up`:
          bg.position.y = -ITEM_V_GAP
          bg.visible = false
          break
        case `default`:
          bg.position.y = 0
          bg.visible = true
          break
        case `down`:
          bg.position.y = ITEM_V_GAP
          bg.visible = false
          break
        default:
          throw new Error(`Unexpected label ${bg.label}`)
      }
    }

    this.#containersForHoldItemsMode[index].y = this.#defaultPositionsByCells[index].y

    this.y = this.#defaultPositionY

    this.#isStoppedByCells[index] = false
    this.#isResponseReceivedByCells[index] = false
    this.#endMiniReelInnerTweens.delete(index)
    this.#forceEndMiniReelOnStart.delete(index)
    this.#miniReelScrollTweens.delete(index)
  }

  getShowItemsBackgroundTween(duration: number) {
    const mainParallel = new Parallel()

    for (let i = 0; i < this.#barSize; i++) {
      mainParallel.add(Tween.to(this.#containersForHoldItemsMode[i], { alpha: 1 }, { duration }))
    }

    return mainParallel
  }

  getHideItemsBackgroundTween(duration: number) {
    const mainParallel = new Parallel()

    for (let i = 0; i < this.#barSize; i++) {
      mainParallel.add(Tween.to(this.#containersForHoldItemsMode[i], { alpha: 0 }, { duration }))
    }

    return mainParallel
  }

  isItemHolding(index: number) {
    return this.#holdItemsByCells[index]
  }

  setFreeSpinsMode(value: boolean) {
    this.#isFreeSpinsMode = value
  }

  unsetHoldItems() {
    for (let i = 0; i < this.#barSize; i++) {
      this.#holdItemsByCells[i] = false
    }
  }

  unsetHoldItemByPositionIndex(index: number) {
    this.#holdItemsByCells[index] = false
  }

  clearAllItems() {
    for (let i = 0; i < this.#barSize; i++) {
      const item = this.#items[i]
      if (item) {
        removeItem(item)
        this.#items[i] = null
        this.#cells[i].item = null
      }

      this.#containersForHoldItemsMode[i].y = this.#defaultPositionsByCells[i].y
      this.#containersForHoldItemsMode[i].alpha = 0

      for (const bg of this.#wrappedBgByCells[i]) {
        switch (bg.label) {
          case `up`:
            bg.position.y = -ITEM_V_GAP
            bg.visible = false
            break
          case `default`:
            bg.position.y = 0
            bg.visible = true
            break
          case `down`:
            bg.position.y = ITEM_V_GAP
            bg.visible = false
            break
        }
      }
    }
  }

  dimItemByPositionIndex(index: number, alpha: number = 0.3) {
    const item = this.#items[index]
    if (item) {
      item.alpha = alpha
    }
  }

  undimItemByPositionIndex(index: number) {
    const item = this.#items[index]
    if (item) {
      item.alpha = 1
    }
  }

  undimAllItems() {
    for (let i = 0; i < this.#barSize; i++) {
      this.undimItemByPositionIndex(i)
    }
  }
}
