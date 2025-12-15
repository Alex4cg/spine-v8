// UI обработчики

export function setupUI(systems) {
  const playAll = () => systems.forEach((system) => system.play());
  
  // Функция для получения системы по ID
  const getSystemById = (id) => systems.find((s) => s.id === id);

  // Общая кнопка Play для всех систем
  document.getElementById("playAnimations").onclick = playAll;
  
  // Отдельные кнопки скинов для системы A
  document.getElementById("skinA_Blue").onclick = () => getSystemById("a")?.setSkin("blue");
  document.getElementById("skinA_Green").onclick = () => getSystemById("a")?.setSkin("green");
  document.getElementById("skinA_Red").onclick = () => getSystemById("a")?.setSkin("red");
  
  // Отдельные кнопки скинов для системы B
  document.getElementById("skinB_Blue").onclick = () => getSystemById("b")?.setSkin("blue");
  document.getElementById("skinB_Green").onclick = () => getSystemById("b")?.setSkin("green");
  document.getElementById("skinB_Red").onclick = () => getSystemById("b")?.setSkin("red");
  
  // Отдельные кнопки скинов для системы C
  document.getElementById("skinC_Blue").onclick = () => getSystemById("c")?.setSkin("blue");
  document.getElementById("skinC_Green").onclick = () => getSystemById("c")?.setSkin("green");
  document.getElementById("skinC_Red").onclick = () => getSystemById("c")?.setSkin("red");
}

