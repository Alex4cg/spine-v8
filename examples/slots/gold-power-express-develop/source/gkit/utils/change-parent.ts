import type { ContainerChild, Container } from 'pixi.js'

export function changeParent(child: ContainerChild, newParent: Container) {
  if (child.parent === null) {
    throw new Error(`Child has no parent`)
  }

  const global = child.parent.toGlobal(child.position)
  child.position.copyFrom(newParent.toLocal(global))

  return newParent.addChild(child)
}
