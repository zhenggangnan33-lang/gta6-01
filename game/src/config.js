// VERDE BAY — configuration: world size, road grid, landmarks, tuning.
// All numbers are this game's own design; nothing here is copied from a starter.
export const CFG = {
  WORLD_W: 2560,
  WORLD_H: 1920,
  // Road centre lines. Roads are 72 px wide; blocks sit between them.
  ROAD_X: [160, 480, 800, 1120, 1440, 1760, 2080],
  ROAD_Y: [160, 480, 800, 1120, 1440],
  ROAD_HALF: 36,
  // Landmarks (world coordinates). Markers use a generous radius so a player
  // standing on the street can always reach a building's door.
  MARKER_R: 84,
  GARAGE: { x: 500, y: 500, w: 260, h: 260, cx: 630, cy: 630 }, // open forecourt
  BANK: { x: 1150, y: 510, w: 260, h: 200, doorX: 1280, doorY: 760 },
  HOTEL: { x: 1470, y: 830, w: 250, h: 200, doorX: 1595, doorY: 1060 },
  SAFEHOUSE: { x: 830, y: 1150, w: 250, h: 180, doorX: 955, doorY: 1360 },
  JEWELRY: { x: 510, y: 830, w: 240, h: 180, doorX: 630, doorY: 1040 },
  DEALERSHIP: { x: 1790, y: 510, w: 260, h: 240, sportX: 1920, sportY: 630 },
  MART: { x: 1150, y: 1150, w: 250, h: 190, doorX: 1275, doorY: 1370 },
  MARINA: { x: 2080, y: 1440, w: 256, h: 280, yachtX: 2200, yachtY: 1600 },
  PIER: { x: 2336, y: 780, w: 170, h: 44 },
  BEACH_X: 2336, // sand starts here; water from WATER_X
  WATER_X: 2460,
  PARK: { x: 830, y: 510, w: 250, h: 240 },
  SPAWN: { x: 700, y: 790 },
  // Player
  WALK_SPEED: 175,
  SPRINT_SPEED: 265,
  PLAYER_R: 10,
  PLAYER_HEALTH: 100,
  PUNCH_RANGE: 42,
  PUNCH_DMG: 34,
  // Cars
  CAR_LEN: 46,
  CAR_WID: 22,
  CAR_R: 16,
  CAR_HEALTH: 220,
  CAR_ACCEL: 420,
  CAR_TOP: 330,
  CAR_REVERSE_TOP: 140,
  CAR_TURN: 2.6,
  TRAFFIC_COUNT: 14,
  PARKED_COUNT: 12,
  RAM_DMG: 1,
  RAM_COOLDOWN: 2.5,
  POLICE_TOP: 520,
  // Pedestrians
  PED_COUNT: 26,
  PED_SPEED: 55,
  // Wanted / heat
  HEAT_STEAL: 15,
  HEAT_PUNCH: 8,
  HEAT_HIT_PED: 12,
  HEAT_ALARM: 20,
  HEAT_DECAY: 2.2, // per second while no police nearby
  CHOP_PAY: 150,
  // Garage shop
  SHOP: [
    { key: '1', name: 'Armor plating', price: 500, id: 'armor' },
    { key: '2', name: 'Turbo engine', price: 800, id: 'turbo' },
    { key: '3', name: 'Racing tires', price: 300, id: 'tires' },
  ],
  // Day cycle: 0 = dawn, 0.25 = noon, 0.5 = dusk, 0.75 = night
  DAY_LENGTH: 240,
  // Colours
  COLORS: {
    grass: '#3d7a3a',
    road: '#33363b',
    roadLine: '#c9a227',
    sidewalk: '#6f6f68',
    beach: '#e0c98f',
    water: '#1d6f9e',
    pier: '#8a6b45',
    buildingRoofs: ['#7a4a3a', '#4a5a7a', '#6a6a72', '#8a6a3a', '#5a7a5a', '#7a3a5a'],
    parkTree: '#2c5a28',
  },
};

export function starsForHeat(heat) {
  if (heat < 8) return 0;
  if (heat < 28) return 1;
  if (heat < 48) return 2;
  if (heat < 68) return 3;
  if (heat < 88) return 4;
  return 5;
}
