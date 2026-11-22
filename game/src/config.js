// VERDE BAY — configuration for the gta6-01 open-world crime game.
// Third build: every value below was chosen fresh for this session.
// The city is a 2560x1920 coastal town: a road grid, a beach along the
// south edge, a marina in the south-east corner, and named landmarks the
// story missions visit. Nothing here is copied from an earlier build.

export const CFG = {
  world: { w: 2560, h: 1920 },
  // Road centrelines. Vertical roads run the full height, horizontal the
  // full width; intersections are the routing graph's nodes.
  roadsX: [160, 480, 800, 1120, 1440, 1760, 2080, 2400],
  roadsY: [120, 360, 600, 840, 1080, 1320, 1560, 1800],
  roadHalf: 26, // half-width of the asphalt
  lane: 13, // right-hand lane offset from the centreline
  // South strip is beach sand; the south-east corner is marina water.
  beachY: 1820,
  marina: { x0: 2280, y0: 1560, x1: 2560, y1: 1920 },

  // Named places. `at` is the front-door / interaction point, `r` the
  // radius inside which the player counts as "there".
  places: {
    garage: { name: 'Vega Motors', at: [1300, 960], r: 90, note: 'garage + chop shop' },
    bank: { name: 'Meridian Bank', at: [960, 600], r: 70 },
    hotel: { name: 'Hotel Miramar', at: [1920, 360], r: 70 },
    cafe: { name: 'Café Luna', at: [640, 1320], r: 70 },
    jewels: { name: 'Casa Diamante', at: [1600, 1320], r: 70 },
    dealer: { name: 'Cometa Motors', at: [320, 720], r: 80 },
    safehouse: { name: 'La Rosa House', at: [960, 1800], r: 80 },
    docks: { name: 'The Docks', at: [2240, 1680], r: 80 },
    stadium: { name: 'Estadio Verde', at: [2240, 720], r: 90 },
    plaza: { name: 'Palma Plaza', at: [1280, 480], r: 90 },
    yacht: { name: 'Yacht La Rosa', at: [2300, 1690], r: 80 },
    pier: { name: 'Pier', at: [2040, 1860], r: 80 },
  },

  // People.
  hero: 'Dante Vega',
  boss: "Carmen 'La Rosa' Ibarra",
  fence: "El Gato",
  hacker: 'Nadia',

  // Tuning (all fresh numbers for this build).
  tuning: {
    walkSpeed: 195, sprintSpeed: 305, punchRange: 46, punchDamage: 34,
    carAccel: 420, carBrake: 640, carReverse: 190, carTop: 430,
    carTopSports: 540, carTurn: 2.9, carGrip: 3.4,
    carHealth: 200, ramDamage: 1, ramCooldown: 2.5, ramPush: 260,
    wallHitCooldown: 0.4, wallDamageRate: 0.045,
    trafficCount: 14, pedCount: 26,
    trafficSpeed: [130, 205], pedSpeed: [42, 78], pedFleeMult: 2.3,
    heatSteal: 12, heatPunch: 6, heatPed: 18, heatAlarm: 20, heatCrash: 4,
    heatDecay: 2.2, heatDecayHidden: 6.0,
    starsAt: [10, 30, 50, 70, 90], // heat thresholds for 1..5 stars
    policeByStars: [1, 2, 3, 4, 6],
    heliAtStars: 3, roadblockAtStars: 4,
    policeChaseSpeed: 505, policeRamRange: 52,
    chopPay: 125, startMoney: 200,
    shop: { armor: 450, turbo: 750, tires: 275 },
    bustPenalty: 0.10, // fraction of money lost on a bust
    dayLength: 150, // seconds per in-game hour
  },

  // Palette.
  colors: {
    grass: '#5d8a4a', grassDry: '#7a9a52', sand: '#d9c48a', sea: '#2f6f8f',
    seaDeep: '#25607e', asphalt: '#3a3d44', asphaltEdge: '#2c2f36',
    sidewalk: '#8d8f96', line: '#e8d44d', buildingRoof: '#b0563a',
    buildingRoof2: '#7a6a8f', buildingRoof3: '#4f7a5a', buildingWall: '#c9b18c',
    park: '#4c7a3d', lot: '#555860', plaza: '#a89a7a',
  },

  // Radio stations (synthesised, no audio files).
  radio: [
    { name: 'SOL FM', desc: 'sunset drive', root: 55, minor: true, bpm: 96 },
    { name: 'BAY 102', desc: 'marina nights', root: 60, minor: false, bpm: 112 },
  ],

  // Controls shown on the title screen.
  controls: [
    ['WASD / Arrows', 'walk / drive'],
    ['Shift', 'sprint'],
    ['E', 'enter car / interact'],
    ['F', 'punch'],
    ['Space', 'handbrake'],
    ['G', 'garage shop (at Vega Motors, in a car)'],
    ['R', 'change radio station'],
    ['M', 'mute'],
    ['P / Esc', 'pause'],
    ['O', 'autopilot demo'],
  ],
};

// Mission reward table (money, respect) for the eight story missions.
export const MISSION_REWARDS = [
  [500, 8], [700, 10], [900, 12], [1500, 15],
  [1800, 18], [2200, 20], [3000, 25], [5000, 40],
];
