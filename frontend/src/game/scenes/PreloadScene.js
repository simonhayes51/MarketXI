export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    // Generate all textures programmatically (no external assets needed)
    this.generateTextures();
  }

  generateTextures() {
    // Ball texture
    const ballGfx = this.make.graphics({ x: 0, y: 0, add: false });
    ballGfx.fillStyle(0xffffff, 1);
    ballGfx.fillCircle(8, 8, 8);
    ballGfx.fillStyle(0x333333, 1);
    // Pentagon pattern on ball
    ballGfx.fillTriangle(8, 2, 3, 7, 13, 7);
    ballGfx.fillTriangle(2, 10, 8, 14, 6, 5);
    ballGfx.fillTriangle(14, 10, 8, 14, 10, 5);
    ballGfx.generateTexture('ball', 16, 16);
    ballGfx.destroy();

    // Player textures (red team)
    const playerRedGfx = this.make.graphics({ x: 0, y: 0, add: false });
    playerRedGfx.fillStyle(0xff2222, 1);
    playerRedGfx.fillCircle(10, 10, 10);
    playerRedGfx.lineStyle(2, 0xffffff, 1);
    playerRedGfx.strokeCircle(10, 10, 10);
    playerRedGfx.generateTexture('player_red', 20, 20);
    playerRedGfx.destroy();

    // Player texture (blue team)
    const playerBlueGfx = this.make.graphics({ x: 0, y: 0, add: false });
    playerBlueGfx.fillStyle(0x2244ff, 1);
    playerBlueGfx.fillCircle(10, 10, 10);
    playerBlueGfx.lineStyle(2, 0xffffff, 1);
    playerBlueGfx.strokeCircle(10, 10, 10);
    playerBlueGfx.generateTexture('player_blue', 20, 20);
    playerBlueGfx.destroy();

    // Goalkeeper (yellow highlight)
    const gkGfx = this.make.graphics({ x: 0, y: 0, add: false });
    gkGfx.fillStyle(0xffdd00, 1);
    gkGfx.fillCircle(10, 10, 10);
    gkGfx.lineStyle(2, 0x000000, 1);
    gkGfx.strokeCircle(10, 10, 10);
    gkGfx.generateTexture('goalkeeper', 20, 20);
    gkGfx.destroy();

    // Shadow texture
    const shadowGfx = this.make.graphics({ x: 0, y: 0, add: false });
    shadowGfx.fillStyle(0x000000, 0.3);
    shadowGfx.fillEllipse(8, 4, 16, 8);
    shadowGfx.generateTexture('shadow', 16, 8);
    shadowGfx.destroy();
  }

  create() {
    this.scene.start('MatchScene');
  }
}
