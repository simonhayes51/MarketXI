export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Background
    this.cameras.main.setBackgroundColor('#0a1a0a');

    // Title
    this.add.text(width / 2, height / 2 - 60, 'MARKETXI FOOTBALL', {
      fontFamily: 'monospace',
      fontSize: '28px',
      fill: '#ffd700',
      stroke: '#000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2, 'Press ENTER to start', {
      fontFamily: 'monospace',
      fontSize: '14px',
      fill: '#ffffff',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-ENTER', () => {
      this.scene.start('MatchScene');
    });
  }
}
