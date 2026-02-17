/**
 * Отдельный контейнер превью: показывает ожидаемый экран символов по сценарию (текущий шаг)
 * в виде текстур. Не зависит от CascadeManager.
 */
export class ScenarioPreview {
  /**
   * @param {Object} options
   * @param {import('pixi.js').Application} options.app - PIXI Application (отдельный canvas превью)
   * @param {import('pixi.js').Texture[]} options.symbolTextures - массив текстур символов
   * @param {number} options.gridCols - колонок в сетке
   * @param {number} options.gridRows - строк в сетке
   * @param {number} [options.cellSize=40] - размер ячейки в пикселях в превью
   * @param {number} [options.paddingX=8] - отступ сетки по X
   * @param {number} [options.paddingY=28] - отступ сетки по Y (место под подпись)
   */
  constructor(options) {
    this.app = options.app;
    this.symbolTextures = options.symbolTextures || [];
    this.gridCols = options.gridCols ?? 6;
    this.gridRows = options.gridRows ?? 5;
    this.cellSize = options.cellSize ?? 40;
    this.paddingX = options.paddingX ?? 8;
    this.paddingY = options.paddingY ?? 28;

    this.container = new PIXI.Container();
    this.container.x = this.paddingX;
    this.container.y = this.paddingY;
    this.app.stage.addChild(this.container);

    this.sprites = []; // [col][row] = PIXI.Sprite
    this.label = new PIXI.Text({
      text: 'Сценарий',
      style: {
        fontFamily: 'Arial',
        fontSize: 12,
        fill: 0xcccccc
      }
    });
    this.label.x = this.paddingX;
    this.label.y = 4;
    this.app.stage.addChild(this.label);

    this._buildGridSprites();
  }

  /**
   * Конвертирует сетку сценария (row-major) во внутренний вид (col-major), как в игре.
   * @param {number[][]} scenarioGrid - scenarioGrid[row][col]
   * @returns {number[][]} internal[col][row]
   */
  convertScenarioGrid(scenarioGrid) {
    if (!scenarioGrid || !scenarioGrid.length) return [];
    const internal = [];
    for (let col = 0; col < this.gridCols; col++) {
      internal[col] = [];
      for (let row = 0; row < this.gridRows; row++) {
        internal[col][row] = scenarioGrid[row] && scenarioGrid[row][col] !== undefined
          ? scenarioGrid[row][col]
          : 0;
      }
    }
    return internal;
  }

  _buildGridSprites() {
    for (let col = 0; col < this.gridCols; col++) {
      this.sprites[col] = [];
      for (let row = 0; row < this.gridRows; row++) {
        const tex = this.symbolTextures[0] || PIXI.Texture.WHITE;
        const sprite = new PIXI.Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.x = col * this.cellSize + this.cellSize / 2;
        sprite.y = row * this.cellSize + this.cellSize / 2;
        const scale = this.cellSize / 112;
        sprite.scale.set(scale);
        this.container.addChild(sprite);
        this.sprites[col][row] = sprite;
      }
    }
  }

  /**
   * Обновляет превью по текущему шагу сценария.
   * @param {Array|null} scenario - массив шагов сценария (каждый с полем grid)
   * @param {number} stepIndex - индекс текущего шага
   */
  update(scenario, stepIndex) {
    if (!scenario || stepIndex == null || stepIndex < 0 || stepIndex >= scenario.length) {
      this._clearGrid();
      this.label.text = 'Сценарий (нет шага)';
      return;
    }

    const step = scenario[stepIndex];
    if (!step || !step.grid) {
      this._clearGrid();
      this.label.text = `Шаг ${stepIndex + 1} (нет grid)`;
      return;
    }

    const internal = this.convertScenarioGrid(step.grid);
    const numTextures = this.symbolTextures.length;

    for (let col = 0; col < this.gridCols; col++) {
      for (let row = 0; row < this.gridRows; row++) {
        const sprite = this.sprites[col] && this.sprites[col][row];
        if (!sprite) continue;
        const textureIndex = internal[col] && internal[col][row] !== undefined
          ? internal[col][row]
          : 0;
        const index = Math.max(0, textureIndex % numTextures);
        sprite.texture = this.symbolTextures[index] || this.symbolTextures[0] || PIXI.Texture.WHITE;
        sprite.visible = true;
      }
    }

    const eventName = step.event ? step.event.toUpperCase() : '?';
    this.label.text = `Шаг ${stepIndex + 1}/${scenario.length}: ${eventName}`;
  }

  _clearGrid() {
    for (let col = 0; col < this.gridCols; col++) {
      for (let row = 0; row < this.gridRows; row++) {
        const sprite = this.sprites[col] && this.sprites[col][row];
        if (sprite) sprite.visible = false;
      }
    }
  }

  destroy() {
    this._clearGrid();
    if (this.container.parent) {
      this.container.parent.removeChild(this.container);
    }
    this.container.destroy({ children: true });
    if (this.label.parent) {
      this.label.parent.removeChild(this.label);
    }
    this.label.destroy();
  }
}
