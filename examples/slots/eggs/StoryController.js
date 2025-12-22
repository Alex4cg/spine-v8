/**
 * Контроллер для управления сюжетом и вторым экземпляром Eggs
 */
class StoryController {
  constructor(spineObject) {
    this.spine = spineObject;
    this.storyInProgress = false;
    this.storyTimeout = null;
    
    // Маппинг названий анимаций для второго экземпляра
    this.ANIM_NAME_MAP = {
      "idle": "00_idle",
      "idle_no_text": "00_idle_no_text",
      "null": "00_null",
      "appearance": "02_appearance",
      "color_to_gold": "02_color_to_gold",
      "win": "02_win",
      "shot_to_total": "02_shot_to_total"
    };
    
    // Устанавливаем начальную анимацию null
    this.spine.state.setAnimation(0, "00_null", true);
  }
  
  /**
   * Установка скина для второго экземпляра
   */
  updateSkin(skinName) {
    const skin = this.spine.skeleton.data.findSkin(skinName);
    if (skin) {
      this.spine.skeleton.setSkin(skin);
      this.spine.skeleton.setSlotsToSetupPose();
      if (this.spine.skeleton.physics) {
        this.spine.skeleton.updateWorldTransform(this.spine.skeleton.physics.update);
      }
      console.log(`✅ Скин '${skinName}' установлен для второго экземпляра`);
    } else {
      console.warn(`⚠️ Скин '${skinName}' не найден`);
    }
  }
  
  /**
   * Воспроизведение анимации на втором экземпляре
   */
  playAnimation(animName, loop = false, track = 1) {
    const fullAnimName = this.ANIM_NAME_MAP[animName] || animName;
    
    // Если это idle или idle_no_text, играем на треке 0
    if (animName === "idle" || animName === "idle_no_text" || animName === "null") {
      this.spine.state.setAnimation(0, fullAnimName, loop);
      return;
    }
    
    // Для остальных анимаций используем указанный трек
    const entry = this.spine.state.setAnimation(track, fullAnimName, loop);
    if (entry) {
      if (animName === "appearance") {
        entry.mixDuration = 0; // Мгновенное появление
      } else {
        entry.mixDuration = 0.2; // Переход
      }
      console.log(`✅ Анимация '${fullAnimName}' запущена на треке ${track} для второго экземпляра`);
    } else {
      console.warn(`⚠️ Анимация '${fullAnimName}' не найдена`);
    }
  }
  
  /**
   * Проигрывание сюжета
   */
  playStory() {
    if (this.storyInProgress) {
      console.log("⚠️ Сюжет уже проигрывается");
      return;
    }
    
    this.storyInProgress = true;
    console.log("🎬 Начало сюжета");
    
    // Очищаем все треки перед началом
    this.spine.state.clearTracks();
    
    // Часть 1: Скин 01_blue
    this.updateSkin("01_blue");
    
    // Устанавливаем начальное состояние - idle на треке 0
    this.spine.state.setAnimation(0, "00_idle", true);
    
    // Шаг 1: Appearance (мгновенно)
    const appearanceEntry = this.spine.state.setAnimation(1, "02_appearance", false);
    if (appearanceEntry) {
      appearanceEntry.mixDuration = 0;
      
      // После завершения appearance переходим к idle
      const controller = this;
      appearanceEntry.listener = {
        complete: () => {
          console.log("✅ Appearance завершена, переход к idle");
          controller.playAnimation("idle", true, 0);
          
          // Через 1 секунду переходим к color_to_gold
          controller.storyTimeout = setTimeout(() => {
            console.log("✅ Idle проиграна 1 секунду, переход к color_to_gold");
            const colorToGoldEntry = controller.spine.state.setAnimation(1, "02_color_to_gold", false);
            if (colorToGoldEntry) {
              colorToGoldEntry.mixDuration = 0.2;
              
              // После завершения color_to_gold начинаем часть 2
              colorToGoldEntry.listener = {
                complete: () => {
                  console.log("✅ Color to gold завершена, начало части 2");
                  
                  // Часть 2: Смена скина на 00_gold
                  controller.updateSkin("00_gold");
                  
                  // Очищаем трек 1 и устанавливаем idle на треке 0
                  controller.spine.state.setEmptyAnimation(1, 0.2);
                  controller.playAnimation("idle", true, 0);
                  
                  // Через 1 секунду переходим к win
                  controller.storyTimeout = setTimeout(() => {
                    console.log("✅ Idle проиграна 1 секунду, переход к win");
                    const winEntry = controller.spine.state.setAnimation(1, "02_win", false);
                    if (winEntry) {
                      winEntry.mixDuration = 0.2;
                      
                      // После завершения win переходим к shot_to_total
                      winEntry.listener = {
                        complete: () => {
                          console.log("✅ Win завершена, переход к shot_to_total");
                          const shotToTotalEntry = controller.spine.state.setAnimation(1, "02_shot_to_total", false);
                          if (shotToTotalEntry) {
                            shotToTotalEntry.mixDuration = 0.2;
                            
                            // После завершения shot_to_total переходим к idle_no_text (финал)
                            shotToTotalEntry.listener = {
                              complete: () => {
                                console.log("✅ Shot to total завершена, переход к idle_no_text (финал)");
                                controller.playAnimation("idle_no_text", true, 0);
                                controller.spine.state.setEmptyAnimation(1, 0.2);
                                controller.storyInProgress = false;
                                console.log("🎬 Сюжет завершен");
                              }
                            };
                          }
                        }
                      };
                    }
                  }, 1000);
                }
              };
            }
          }, 1000);
        }
      };
    }
  }
  
  /**
   * Остановка сюжета
   */
  stopStory() {
    if (this.storyTimeout) {
      clearTimeout(this.storyTimeout);
      this.storyTimeout = null;
    }
    this.spine.state.clearTracks();
    this.storyInProgress = false;
  }
  
  /**
   * Настройка обработчика кнопки Action
   */
  setupUIHandlers() {
    document.getElementById("action_btn").onclick = () => {
      // Останавливаем предыдущий сюжет, если он был запущен
      this.stopStory();
      
      // Запускаем новый сюжет
      this.playStory();
    };
  }
}
