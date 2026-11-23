// Keyboard and touch input for VERDE BAY v2. Tracks held keys (`down`)
// and fresh presses (`pressed`, consumed each frame by the world).
// Touch: left half drag = move, right half = steer, plus on-screen
// buttons wired from index.html.

export function createInput() {
  const input = {
    down: new Set(),
    pressed: new Set(),
    touch: { x: 0, y: 0, active: false },
  };

  function codeOf(e) {
    return e.code || 'Key' + (e.key || '').toUpperCase();
  }

  window.addEventListener('keydown', (e) => {
    const c = codeOf(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)) e.preventDefault();
    if (!input.down.has(c)) input.pressed.add(c);
    input.down.add(c);
  });
  window.addEventListener('keyup', (e) => input.down.delete(codeOf(e)));
  window.addEventListener('blur', () => { input.down.clear(); });

  // Touch steering: hold-and-drag on the left half moves, on the right
  // half steers; buttons below handle E / enter-exit / punch.
  const canvas = document.getElementById('game');
  if (canvas) {
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      input.touch.active = true;
      input.touch.x = t.clientX;
      input.touch.y = t.clientY;
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      input.touch.x = t.clientX;
      input.touch.y = t.clientY;
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      input.touch.active = false;
    }, { passive: false });
  }

  // Buttons marked data-key emit that key code on press/release.
  for (const el of document.querySelectorAll('[data-key]')) {
    const code = el.getAttribute('data-key');
    const on = (e) => {
      e.preventDefault();
      if (!input.down.has(code)) input.pressed.add(code);
      input.down.add(code);
    };
    const off = (e) => { e.preventDefault(); input.down.delete(code); };
    el.addEventListener('pointerdown', on);
    el.addEventListener('pointerup', off);
    el.addEventListener('pointerleave', off);
    el.addEventListener('pointercancel', off);
  }

  input.endFrame = () => { input.pressed.clear(); };
  return input;
}
