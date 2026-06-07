// Keyboard controls
// Movement: Arrow keys
// Actions:  Z = Pass | X = Shoot (hold to charge) | C = Through ball
//           Space = Tackle | Tab = Switch player
export function setupControls(scene) {
  return scene.input.keyboard.addKeys({
    up:          Phaser.Input.Keyboard.KeyCodes.UP,
    down:        Phaser.Input.Keyboard.KeyCodes.DOWN,
    left:        Phaser.Input.Keyboard.KeyCodes.LEFT,
    right:       Phaser.Input.Keyboard.KeyCodes.RIGHT,
    pass_key:    Phaser.Input.Keyboard.KeyCodes.Z,
    shoot_key:   Phaser.Input.Keyboard.KeyCodes.X,
    through_key: Phaser.Input.Keyboard.KeyCodes.C,
    tackle_key:  Phaser.Input.Keyboard.KeyCodes.SPACE,
    switch_key:  Phaser.Input.Keyboard.KeyCodes.TAB,
    pause_key:   Phaser.Input.Keyboard.KeyCodes.ESC,
  });
}
