// Setup keyboard controls for the match scene
export function setupControls(scene) {
  const keys = scene.input.keyboard.addKeys({
    up: Phaser.Input.Keyboard.KeyCodes.UP,
    down: Phaser.Input.Keyboard.KeyCodes.DOWN,
    left: Phaser.Input.Keyboard.KeyCodes.LEFT,
    right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
    w_key: Phaser.Input.Keyboard.KeyCodes.W,
    s_key: Phaser.Input.Keyboard.KeyCodes.S,
    a_key: Phaser.Input.Keyboard.KeyCodes.A,
    d_key: Phaser.Input.Keyboard.KeyCodes.D,
    pass_key: Phaser.Input.Keyboard.KeyCodes.Q,      // Q = Pass (to avoid WASD conflict)
    shoot_key: Phaser.Input.Keyboard.KeyCodes.E,     // E = Shoot (hold to charge)
    through_key: Phaser.Input.Keyboard.KeyCodes.R,   // R = Through ball
    tackle_key: Phaser.Input.Keyboard.KeyCodes.SPACE,
    switch_key: Phaser.Input.Keyboard.KeyCodes.TAB,
    pause_key: Phaser.Input.Keyboard.KeyCodes.ESC,
  });

  // Map WASD for movement only, separate action keys
  // Note: In the WASD scheme:
  // - WASD = movement
  // - Q = pass
  // - E = shoot (hold)
  // - R = through ball
  // - Space = tackle
  // - Tab = switch player

  return keys;
}

// Get normalized movement vector from inputs
export function getMovementVector(keys, mobileJoystick) {
  let vx = 0;
  let vy = 0;

  if (mobileJoystick && mobileJoystick.active) {
    vx = mobileJoystick.dx;
    vy = mobileJoystick.dy;
  } else {
    if (keys.left.isDown || keys.a_key.isDown) vx -= 1;
    if (keys.right.isDown || keys.d_key.isDown) vx += 1;
    if (keys.up.isDown || keys.w_key.isDown) vy -= 1;
    if (keys.down.isDown || keys.s_key.isDown) vy += 1;

    // Normalize diagonal
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707;
      vy *= 0.707;
    }
  }

  return { vx, vy };
}

// Helper: check if key was just pressed this frame
export function justPressed(key) {
  return Phaser.Input.Keyboard.JustDown(key);
}

// Helper: check if key was just released this frame
export function justReleased(key) {
  return Phaser.Input.Keyboard.JustUp(key);
}
