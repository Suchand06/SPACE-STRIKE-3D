import type { EnemyType, GraphicsQuality, LevelConfig, PowerUpType, WeaponId, WeaponSpec } from './types';

export const PLAYFIELD_BOUNDS = {
  x: 34,
  y: 18,
  zMin: -12,
  zMax: 16,
  spawnZ: -175,
  despawnZ: 28,
} as const;

export const WEAPON_SPECS: Record<WeaponId, WeaponSpec> = {
  dual_laser: {
    id: 'dual_laser',
    name: 'Dual Laser',
    role: 'Rapid Twin Bolts',
    keyHint: '1',
    cooldown: 0.16,
    damage: 18,
    speed: 175,
    color: 0x38bdf8,
    hex: '#38bdf8',
    projectileRadius: 0.65,
  },
  plasma_cannon: {
    id: 'plasma_cannon',
    name: 'Plasma Cannon',
    role: 'Heavy Blast Orb',
    keyHint: '2',
    cooldown: 0.36,
    damage: 46,
    speed: 135,
    color: 0x22d3ee,
    hex: '#22d3ee',
    projectileRadius: 1.25,
  },
  missile_launcher: {
    id: 'missile_launcher',
    name: 'Seeker Missiles',
    role: 'Homing Warheads',
    keyHint: '3',
    cooldown: 0.55,
    damage: 62,
    speed: 105,
    color: 0xf59e0b,
    hex: '#f59e0b',
    projectileRadius: 1.1,
  },
  triple_laser: {
    id: 'triple_laser',
    name: 'Triple Laser',
    role: 'Wide Tri-Spread',
    keyHint: '4',
    cooldown: 0.19,
    damage: 16,
    speed: 178,
    color: 0x818cf8,
    hex: '#818cf8',
    projectileRadius: 0.65,
  },
  ultimate_blast: {
    id: 'ultimate_blast',
    name: 'Nova Beam',
    role: 'Area Overload',
    keyHint: 'X',
    cooldown: 1.0,
    damage: 260,
    speed: 160,
    color: 0x67e8f9,
    hex: '#67e8f9',
    projectileRadius: 5.5,
  },
};

export const ENEMY_SPECS: Record<
  EnemyType,
  {
    name: string;
    hp: number;
    speed: number;
    score: number;
    radius: number;
    fireCooldown: number;
    projectileSpeed: number;
    projectileDamage: number;
    color: number;
  }
> = {
  scout: {
    name: 'Scout Fighter',
    hp: 34,
    speed: 30,
    score: 120,
    radius: 2.1,
    fireCooldown: 1.9,
    projectileSpeed: 64,
    projectileDamage: 10,
    color: 0xf97316,
  },
  interceptor: {
    name: 'Interceptor',
    hp: 56,
    speed: 36,
    score: 220,
    radius: 2.4,
    fireCooldown: 1.5,
    projectileSpeed: 74,
    projectileDamage: 13,
    color: 0xec4899,
  },
  destroyer: {
    name: 'Heavy Destroyer',
    hp: 165,
    speed: 18,
    score: 480,
    radius: 4.5,
    fireCooldown: 2.1,
    projectileSpeed: 58,
    projectileDamage: 18,
    color: 0xef4444,
  },
  stealth: {
    name: 'Stealth Fighter',
    hp: 48,
    speed: 38,
    score: 290,
    radius: 2.2,
    fireCooldown: 1.75,
    projectileSpeed: 78,
    projectileDamage: 14,
    color: 0xa855f7,
  },
  bomber: {
    name: 'Alien Bomber',
    hp: 98,
    speed: 22,
    score: 360,
    radius: 3.3,
    fireCooldown: 2.4,
    projectileSpeed: 52,
    projectileDamage: 18,
    color: 0x84cc16,
  },
};

export const POWERUP_SPECS: Record<
  PowerUpType,
  { label: string; color: number; hex: string }
> = {
  health: { label: 'HULL REPAIR +35', color: 0x22c55e, hex: '#22c55e' },
  shield: { label: 'ENERGY SHIELD +50', color: 0x38bdf8, hex: '#38bdf8' },
  rapid_fire: { label: 'RAPID OVERCLOCK', color: 0xfacc15, hex: '#facc15' },
  triple_laser: { label: 'TRIPLE LASER UNLOCKED', color: 0x818cf8, hex: '#818cf8' },
  missile_upgrade: { label: 'SEEKER MISSILES READY', color: 0xf97316, hex: '#f97316' },
  damage_boost: { label: 'AMPLIFIED CORE 2X', color: 0xf43f5e, hex: '#f43f5e' },
  invincibility: { label: 'PHASE INVULNERABILITY', color: 0xe2e8f0, hex: '#e2e8f0' },
  special_charge: { label: 'NOVA CORE CHARGED', color: 0x2dd4bf, hex: '#2dd4bf' },
};

export const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: 'First Contact',
    subtitle: 'Outer Orbital Perimeter',
    objective: 'Intercept vanguard alien scouts & battle cruiser',
    wavesCount: 3,
    enemiesPerWave: 6,
    enemyTypes: ['scout', 'interceptor'],
    asteroidCount: 16,
    asteroidSpeed: 18,
    bossType: 'cruiser',
    bossName: 'Vanguard Corvette',
    skyPrimary: 0x071a38,
    skySecondary: 0x164e63,
    fogColor: 0x040b18,
    planetColor: 0x2563eb,
    planetAccent: 0x38bdf8,
    hasRingedPlanet: false,
  },
  {
    id: 2,
    name: 'Asteroid Field',
    subtitle: 'Kepler Shattered Belt',
    objective: 'Navigate dense asteroid hazards & interceptors',
    wavesCount: 3,
    enemiesPerWave: 7,
    enemyTypes: ['scout', 'interceptor', 'bomber'],
    asteroidCount: 42,
    asteroidSpeed: 28,
    bossType: 'cruiser',
    bossName: 'Ironclad Battle Cruiser',
    skyPrimary: 0x1e132c,
    skySecondary: 0x7c2d12,
    fogColor: 0x0b0712,
    planetColor: 0xd97706,
    planetAccent: 0xfbbf24,
    hasRingedPlanet: true,
  },
  {
    id: 3,
    name: 'Enemy Armada',
    subtitle: 'Cygnus Staging Sector',
    objective: 'Break heavy destroyer formations & command cruiser',
    wavesCount: 4,
    enemiesPerWave: 8,
    enemyTypes: ['scout', 'interceptor', 'destroyer', 'bomber'],
    asteroidCount: 24,
    asteroidSpeed: 24,
    bossType: 'winged_destroyer',
    bossName: 'Multi-Winged Destroyer',
    skyPrimary: 0x0f172a,
    skySecondary: 0x4c1d95,
    fogColor: 0x060916,
    planetColor: 0x7c3aed,
    planetAccent: 0xc084fc,
    hasRingedPlanet: true,
  },
  {
    id: 4,
    name: 'Alien Territory',
    subtitle: 'Crimson Rift Citadel',
    objective: 'Survive stealth ambushes & missile barrages',
    wavesCount: 4,
    enemiesPerWave: 9,
    enemyTypes: ['interceptor', 'stealth', 'destroyer', 'bomber'],
    asteroidCount: 28,
    asteroidSpeed: 30,
    bossType: 'winged_destroyer',
    bossName: 'Rift Leviathan',
    skyPrimary: 0x280915,
    skySecondary: 0x881337,
    fogColor: 0x11040a,
    planetColor: 0xe11d48,
    planetAccent: 0xfb7185,
    hasRingedPlanet: false,
  },
  {
    id: 5,
    name: 'Final Encounter',
    subtitle: 'Dread Sovereign Core',
    objective: 'Destroy the Giant Alien Mothership',
    wavesCount: 3,
    enemiesPerWave: 9,
    enemyTypes: ['interceptor', 'stealth', 'destroyer', 'bomber'],
    asteroidCount: 20,
    asteroidSpeed: 26,
    bossType: 'mothership',
    bossName: 'Omega Alien Mothership',
    skyPrimary: 0x03191e,
    skySecondary: 0x115e59,
    fogColor: 0x020c10,
    planetColor: 0x0d9488,
    planetAccent: 0x5eead4,
    hasRingedPlanet: true,
  },
];

export const GRAPHICS_PRESETS: Record<
  GraphicsQuality,
  {
    starCount: number;
    particleCap: number;
    bloomStrength: number;
    bloomEnabled: boolean;
    shadows: boolean;
    pixelRatioCap: number;
  }
> = {
  low: {
    starCount: 700,
    particleCap: 220,
    bloomStrength: 0.4,
    bloomEnabled: false,
    shadows: false,
    pixelRatioCap: 1,
  },
  medium: {
    starCount: 1300,
    particleCap: 420,
    bloomStrength: 0.65,
    bloomEnabled: true,
    shadows: false,
    pixelRatioCap: 1.5,
  },
  high: {
    starCount: 2200,
    particleCap: 700,
    bloomStrength: 0.85,
    bloomEnabled: true,
    shadows: true,
    pixelRatioCap: 2,
  },
};

export const TIME_ATTACK_DURATION = 90;
