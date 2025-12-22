/**
 * Контроллер для управления анимациями и скинами первого экземпляра Eggs
 */
class EggsAnimationController {
  constructor(spineObject) {
    this.spine = spineObject;
    this.currentSkin = "00_gold";
    
    // Треки для анимаций
    this.TRACK_IDLE = 0; // Базовый трек для null (всегда включен)
    this.TRACK_MAIN = 1; // Трек для разовых анимаций (поверх null)
    this.TRACK_TRACK = 2; // Трек для track анимаций (поверх всего)
    
    // Маппинг названий анимаций
    this.ANIM_NAME_MAP = {
      "appearance": "02_appearance",
      "start": "02_start",
      "hit": "02_hit",
      "shot": "02_shot",
      "shot_to_total": "02_shot_to_total",
      "color_to_gold": "02_color_to_gold",
      "jp_to_mult": "02_jp_to_mult",
      "win": "02_win"
    };
    
    this.TRACK_ANIM_NAME_MAP = {
      "track_jp_mult": "01_track_jp_mult",
      "track_no_jp_mult": "01_track_no_jp_mult"
    };
    
    // Инициализация
    this.spine.state.setAnimation(this.TRACK_IDLE, "00_idle", true);
    this.setupListeners();
  }
  
  /**
   * Установка скина
   */
  updateSkin(skinName) {
    const skin = this.spine.skeleton.data.findSkin(skinName);
    if (skin) {
      this.spine.skeleton.setSkin(skin);
      this.spine.skeleton.setSlotsToSetupPose();
      if (this.spine.skeleton.physics) {
        this.spine.skeleton.updateWorldTransform(this.spine.skeleton.physics.update);
      }
      this.currentSkin = skinName;
      const skinElement = document.getElementById("currentSkin");
      if (skinElement) {
        skinElement.textContent = skinName;
      }
      console.log(`✅ Скин '${skinName}' установлен`);
    } else {
      console.warn(`⚠️ Скин '${skinName}' не найден`);
    }
  }
  
  /**
   * Воспроизведение анимации на треке 1 (поверх null)
   */
  playAnimation(animName, loop = false) {
    // Если это idle, idle_no_text или null, играем на треке 0
    if (animName === "idle" || animName === "idle_no_text" || animName === "null") {
      const fullAnimName = animName === "idle" ? "00_idle" : 
                           animName === "idle_no_text" ? "00_idle_no_text" : "00_null";
      this.spine.state.setAnimation(this.TRACK_IDLE, fullAnimName, true);
      const animElement = document.getElementById("currentAnim");
      if (animElement) {
        animElement.textContent = animName;
      }
      return;
    }
    
    const fullAnimName = this.ANIM_NAME_MAP[animName] || animName;
    
    // Для остальных анимаций используем трек 1 (поверх null)
    const entry = this.spine.state.setAnimation(this.TRACK_MAIN, fullAnimName, loop);
    if (entry) {
      // Для appearance используем нулевой микс (мгновенное появление)
      // Для остальных анимаций устанавливаем быстрый переход
      if (animName === "appearance") {
        entry.mixDuration = 0; // Мгновенное появление для appearance
      } else {
        entry.mixDuration = 0.1; // Быстрый переход для остальных
      }
      const animElement = document.getElementById("currentAnim");
      if (animElement) {
        animElement.textContent = animName;
      }
      console.log(`✅ Анимация '${fullAnimName}' запущена на треке ${this.TRACK_MAIN}`);
    } else {
      console.warn(`⚠️ Анимация '${fullAnimName}' не найдена`);
    }
  }
  
  /**
   * Воспроизведение track анимации на треке 2
   */
  playTrackAnimation(animName, loop = false) {
    const fullAnimName = this.TRACK_ANIM_NAME_MAP[animName] || animName;
    
    const entry = this.spine.state.setAnimation(this.TRACK_TRACK, fullAnimName, loop);
    if (entry) {
      entry.mixDuration = 0.2; // Быстрое переключение track анимации
      console.log(`✅ Анимация '${fullAnimName}' запущена на треке ${this.TRACK_TRACK}`);
    } else {
      console.warn(`⚠️ Анимация '${fullAnimName}' не найдена`);
    }
  }
  
  /**
   * Настройка слушателей событий анимаций
   */
  setupListeners() {
    this.spine.state.addListener({
      complete: (entry) => {
        // После завершения разовых анимаций на треке 1 просто очищаем трек
        // null продолжает играть на треке 0
        if (entry.trackIndex === this.TRACK_MAIN) {
          console.log(`✅ Анимация '${entry.animation.name}' завершена`);
          // Быстро очищаем трек - idle на треке 0 продолжит играть
          this.spine.state.setEmptyAnimation(this.TRACK_MAIN, 0.1);
          const animElement = document.getElementById("currentAnim");
          if (animElement) {
            animElement.textContent = "idle";
          }
        }
      },
      event: (entry, event) => {
        console.log(`📢 Событие: ${event.data.name}`);
      }
    });
  }
  
  /**
   * Настройка обработчиков кнопок UI
   */
  setupUIHandlers() {
    // Обработчики для скинов
    document.getElementById("skin_00_gold").onclick = () => this.updateSkin("00_gold");
    document.getElementById("skin_01_blue").onclick = () => this.updateSkin("01_blue");
    document.getElementById("skin_02_red").onclick = () => this.updateSkin("02_red");
    document.getElementById("skin_03_purple").onclick = () => this.updateSkin("03_purple");
    document.getElementById("skin_04_mini").onclick = () => this.updateSkin("04_mini");
    document.getElementById("skin_05_midi").onclick = () => this.updateSkin("05_midi");
    document.getElementById("skin_06_major").onclick = () => this.updateSkin("06_major");
    document.getElementById("skin_07_grand").onclick = () => this.updateSkin("07_grand");
    
    // Обработчики для анимаций (трек 0)
    document.getElementById("anim_null").onclick = () => this.playAnimation("null", true);
    document.getElementById("anim_idle").onclick = () => this.playAnimation("idle", true);
    document.getElementById("anim_idle_no_text").onclick = () => this.playAnimation("idle_no_text", true);
    document.getElementById("anim_appearance").onclick = () => this.playAnimation("appearance", false);
    document.getElementById("anim_start").onclick = () => this.playAnimation("start", false);
    document.getElementById("anim_hit").onclick = () => this.playAnimation("hit", false);
    document.getElementById("anim_shot").onclick = () => this.playAnimation("shot", false);
    document.getElementById("anim_shot_to_total").onclick = () => this.playAnimation("shot_to_total", false);
    document.getElementById("anim_color_to_gold").onclick = () => this.playAnimation("color_to_gold", false);
    document.getElementById("anim_jp_to_mult").onclick = () => this.playAnimation("jp_to_mult", false);
    document.getElementById("anim_win").onclick = () => this.playAnimation("win", false);
    
    // Обработчики для track анимации (трек 2)
    document.getElementById("anim_track_jp_mult").onclick = () => this.playTrackAnimation("track_jp_mult", true);
    document.getElementById("anim_track_no_jp_mult").onclick = () => this.playTrackAnimation("track_no_jp_mult", true);
    
    // Устанавливаем начальный скин
    this.updateSkin("00_gold");
  }
}
