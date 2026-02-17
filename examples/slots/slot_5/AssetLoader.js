/**
 * Утилиты для загрузки ресурсов
 */
export class AssetLoader {
  /**
   * Загружает текстуры символов
   * @param {Array<string>} files - Массив имен файлов текстур
   * @param {string} basePath - Базовый путь к текстурам
   * @returns {Promise<Array<PIXI.Texture>>} Массив загруженных текстур
   */
  static async loadSymbolTextures(files, basePath) {
    const textures = [];
    
    for (const file of files) {
      const texture = await PIXI.Assets.load(`${basePath}${file}`);
      textures.push(texture);
    }
    
    return textures;
  }

  /**
   * Загружает конфигурацию выплат из JSON файла
   * @param {string} path - Путь к JSON файлу с выплатами
   * @returns {Promise<Object>} Объект с конфигурацией выплат
   */
  static async loadPayouts(path = './payouts.json') {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`Failed to load payouts: ${response.statusText}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Ошибка загрузки payouts.json:', error);
      throw error;
    }
  }
}
