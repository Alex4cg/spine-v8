// Конфигурация приложения
export const CONFIG = {
  // Имена костей для управления
  controlBoneNames: [
    "control_point_1",
    "control_point_1_t",
    "control_point_2",
    "control_point_2_t",
  ],
  
  // Кость для эмиттера частиц
  emitterBoneName: "trail_gradient1",
  
  // Анимации для систем
  animations: ["hit", "end_effect"],
  
  // Анимация idle
  idleAnimationName: "null",
  
  // Начальный скин
  initialSkin: "green",
  
  // Расстояние между системами
  systemSpacing: 250,
  
  // Начальная позиция систем (отступ снизу)
  systemStartYOffset: 200,
  
  // Позиция claw
  clawYOffset: 440,
  clawZIndex: 0.5,
  
  // Позиция боковых пиньят
  sidePinataDistance: 250,
  sidePinataZIndex: 0.4,
  
  // Mix duration для анимаций
  animationMixDuration: 0.3,
  systemAnimationMixDuration: 0.1,
  
  // Вероятности для claw анимаций
  clawProbabilities: {
    hit: 0.7,
    hitup: 0.2,
    boom: 0.1
  }
};

// Маппинг анимаций claw по типу и уровню
export const CLAW_ANIMATIONS = {
  idle: { 1: "00_idle_1", 2: "05_idle_2", 3: "10_idle_3" },
  hit: { 1: "01_hit_1", 2: "06_hit_2", 3: "11_hit_3" },
  hitup: { 1: "03_hitup_1", 2: "08_hitup_2" },
  boom: { 1: "04_boom_1", 2: "09_boom_2", 3: "14_boom_3" }
};

// Конфигурация систем
export const SYSTEMS_CONFIG = [
  { id: "a", controlPointColor: 0xff0000 }, // Красный
  { id: "b", controlPointColor: 0x00ff00 }, // Зелёный
  { id: "c", controlPointColor: 0x0000ff }, // Синий
];

