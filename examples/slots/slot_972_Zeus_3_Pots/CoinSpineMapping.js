/**
 * Маппинг meta-объекта символа на конкретный Spine-скин монетки.
 */

import { fontManager } from './FontManager.js';

/**
 * @typedef {import('./SymbolMapping.js').SymbolMeta} SymbolMeta
 */

/**
 * Прикрепить текст значения (например, "2X") в слот text_holder монетки.
 * @param {import('spine-pixi').Spine} spineCoin
 * @param {SymbolMeta | null} meta
 */
export function attachCoinText(spineCoin, meta) {
  if (!spineCoin || !meta) return;
  if (meta.type !== 'regular' && meta.type !== 'sticky') return;
  if (meta.multiplier == null) return;

  const slot = spineCoin.skeleton?.findSlot?.('text_holder');
  if (!slot) return;

  // Маленькая буква x, общий текст на 20% меньше базового стиля.
  const text = `${meta.multiplier}x`;

  let styleName = 'coinRegular';
  if (meta.type === 'sticky') {
    styleName = 'coinSticky';
  } else if (meta.type === 'regular') {
    // Пот-цветы для регулярных монет: свои стили шрифта.
    if (meta.pot === 'green') {
      styleName = 'coinRegularGreen';
    } else if (meta.pot === 'violet') {
      styleName = 'coinRegularViolet';
    } else if (meta.pot === 'red') {
      styleName = 'coinRegularRed';
    }
  }

  const textSprite = fontManager.createText(styleName, text, {
    // Чуть крупнее (≈ +5% к 96)
    fontSize: 101,
  });
  if (!textSprite) return;

  textSprite.anchor?.set?.(0.5);
  // Опустить надпись ещё ниже относительно центра слота.
  textSprite.y += 160;
  if (typeof spineCoin.addSlotObject === 'function') {
    spineCoin.addSlotObject('text_holder', textSprite);
  }

  const originalAfterUpdate = spineCoin.afterUpdateWorldTransforms;
  spineCoin.afterUpdateWorldTransforms = () => {
    if (originalAfterUpdate) originalAfterUpdate.call(spineCoin);
    if (slot?.color && textSprite && !textSprite.destroyed) {
      textSprite.alpha = slot.color.a;
    }
  };
  if (slot.color && !textSprite.destroyed) {
    textSprite.alpha = slot.color.a;
  }
}

/**
 * Применить meta-данные к Spine-монетке: выбрать нужный скин и прикрепить текст.
 * Возвращает true, если скин был изменён (нужно перезапустить анимацию).
 *
 * @param {import('spine-pixi').Spine} spineCoin
 * @param {SymbolMeta | null} meta
 * @returns {boolean}
 */
export function applyCoinMetaToSpine(spineCoin, meta) {
  if (!spineCoin || !meta) return false;
  if (meta.type === 'empty' || meta.type === 'collector') return false;

  const skeletonData = spineCoin.skeleton.data;
  if (!skeletonData || typeof skeletonData.findSkin !== 'function') return false;

  /** @type {string | null} */
  let skinName = null;

  switch (meta.type) {
    case 'regular':
      // Жёсткое соответствие для regular:
      // - без pot: обычный mult
      // - _V: multi_mult
      // - _R: eternal_mult
      // - _G: expand_mult
      if (meta.pot === 'violet') {
        skinName = 'multi_mult';
      } else if (meta.pot === 'red') {
        skinName = 'eternal_mult';
      } else if (meta.pot === 'green') {
        skinName = 'expand_mult';
      } else {
        skinName = 'mult';
      }
      break;
    case 'sticky':
      skinName = 'sticky';
      break;
    case 'jackpot':
      // Жёсткое соответствие для джекпотов:
      // mini/midi/major/grand × (no pot | _V | _R | _G)
      if (meta.jackpot === 'mini') {
        if (meta.pot === 'violet') skinName = 'multi_mini';
        else if (meta.pot === 'red') skinName = 'eternal_mini';
        else if (meta.pot === 'green') skinName = 'expand_mini';
        else skinName = 'mini';
      } else if (meta.jackpot === 'midi') {
        if (meta.pot === 'violet') skinName = 'multi_midi';
        else if (meta.pot === 'red') skinName = 'eternal_midi';
        else if (meta.pot === 'green') skinName = 'expand_midi';
        else skinName = 'midi';
      } else if (meta.jackpot === 'major') {
        if (meta.pot === 'violet') skinName = 'multi_major';
        else if (meta.pot === 'red') skinName = 'eternal_major';
        else if (meta.pot === 'green') skinName = 'expand_major';
        else skinName = 'major';
      } else if (meta.jackpot === 'grand') {
        if (meta.pot === 'violet') skinName = 'multi_grand';
        else if (meta.pot === 'red') skinName = 'eternal_grand';
        else if (meta.pot === 'green') skinName = 'expand_grand';
        else skinName = 'grand';
      }
      break;
    case 'mystery':
      skinName = 'mistery';
      break;
    case 'mysteryJackpot':
      if (meta.jackpot) {
        // mistery_jackpot_grand / _major / _midi / _mini
        skinName = `mistery_jackpot_${meta.jackpot}`;
      } else {
        skinName = 'mistery';
      }
      break;
    default:
      break;
  }

  if (!skinName) {
    return false;
  }

  // Не трогаем скин, если он уже выставлен — setSlotsToSetupPose() сбрасывает
  // текущий кадр анимации, и при вызове каждый тик анимация '1' ломается.
  if (spineCoin._appliedSkinName === skinName) return false;

  const skin = skeletonData.findSkin(skinName);
  if (!skin) return false;

  spineCoin.skeleton.setSkin(skin);
  spineCoin.skeleton.setSlotsToSetupPose();
  spineCoin._appliedSkinName = skinName;

  // После применения скина привязываем текст значения к text_holder.
  attachCoinText(spineCoin, meta);
  return true;
}

