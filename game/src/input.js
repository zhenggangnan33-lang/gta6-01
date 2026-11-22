// Keyboard + mouse input. Keys are tracked as a set; edge presses (E, F,
// R, G, P, Escape, Enter, digits) are consumed once by the game loop via
// takeEdge(). The game reads a plain input snapshot each frame.
export function createInput() {
  const held = new Set();
  const edges = new Set();
  let mouse = { x: 0, y: 0, clicked: false };

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    if (!e.repeat) edges.add(e.code);
    held.add(e.code);
  }
  function onKeyUp(e) {
    held.delete(e.code);
  }
  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  function onMouseDown(e) {
    mouse.clicked = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }

  return {
    attach() {
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mousedown', onMouseDown);
    },
    detach() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
    },
    // Edge press, consumed once.
    takeEdge(code) {
      if (edges.has(code)) {
        edges.delete(code);
        return true;
      }
      return false;
    },
    has(code) {
      return held.has(code);
    },
    takeClick() {
      const c = mouse.clicked;
      mouse.clicked = false;
      return c;
    },
    // Plain snapshot for the world step. `auto` is an autopilot override
    // ({up, down, left, right, sprint}) that replaces the keys when set.
    snapshot(auto) {
      const s = {
        up: auto ? !!auto.up : held.has('KeyW') || held.has('ArrowUp'),
        down: auto ? !!auto.down : held.has('KeyS') || held.has('ArrowDown'),
        left: auto ? !!auto.left : held.has('KeyA') || held.has('ArrowLeft'),
        right: auto ? !!auto.right : held.has('KeyD') || held.has('ArrowRight'),
        sprint: auto ? false : held.has('ShiftLeft') || held.has('ShiftRight'),
        handbrake: held.has('Space'),
        action: this.takeEdge('KeyE'),
        punch: this.takeEdge('KeyF'),
        radio: this.takeEdge('KeyR'),
        shop: this.takeEdge('KeyG'),
        pause: this.takeEdge('KeyP') || this.takeEdge('Escape'),
        confirm: this.takeEdge('Enter') || this.takeEdge('Space'),
      };
      return s;
    },
    // Test/autopilot helper: pretend a key is held.
    press(code) {
      held.add(code);
      edges.add(code);
    },
    release(code) {
      held.delete(code);
    },
  };
}
