// Keyboard + mouse input for VERDE BAY. Tracks held keys (`down`) and
// keys pressed since the last frame (`pressed`, cleared by the game loop
// after each update so a press fires exactly once).

export function createInput(canvas) {
  const input = {
    down: new Set(),
    pressed: new Set(),
    mouse: { x: 0, y: 0, down: false },
    attach() {
      window.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        if (!e.repeat) input.pressed.add(e.code);
        input.down.add(e.code);
      });
      window.addEventListener('keyup', (e) => input.down.delete(e.code));
      window.addEventListener('blur', () => { input.down.clear(); });
      canvas.addEventListener('mousemove', (e) => {
        const r = canvas.getBoundingClientRect();
        input.mouse.x = e.clientX - r.left;
        input.mouse.y = e.clientY - r.top;
      });
      canvas.addEventListener('mousedown', () => { input.mouse.down = true; });
      window.addEventListener('mouseup', () => { input.mouse.down = false; });
    },
    endFrame() { input.pressed.clear(); },
  };
  return input;
}
