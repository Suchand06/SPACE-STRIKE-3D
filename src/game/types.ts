export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type GameMode = 'campaign' | 'endless' | 'time_attack';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export type WeaponId = 'dual_laser' | 'plasma_cannon' | 'missile_launcher' | 'triple_laser' | 'ultimate_blast';

export type EnemyType = 'scout' | 'interceptor' | 'destroyer' | 'stealth' | 'bomber';

export type BossType = 'cruiser' | 'winged_destroyer' | 'mothership';

export type PowerUpType =
  | 'health'
  | 'shield'
  | 'rapid_fire'
  | 'triple_laser'
  | 'missile_upgrade'
  | 'damage_boost'
  | 'invincibility'
  | 'special_charge';

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  role: string;
  keyHint: string;
  cooldown: number;
  damage: number;
  speed: number;
  color: number;
  hex: string;
  projectileRadius: number;
}

export interface LevelConfig {
  id: number;
  name: string;
  subtitle: string;
  objective: string;
  wavesCount: number;
  enemiesPerWave: number;
  enemyTypes: EnemyType[];
  asteroidCount: number;
  asteroidSpeed: number;
  bossType: BossType | null;
  bossName: string;
  skyPrimary: number;
  skySecondary: number;
  fogColor: number;
  planetColor: number;
  planetAccent: number;
  hasRingedPlanet: boolean;
}

export interface GraphicsSettings {
  quality: GraphicsQuality;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  mouseAim: boolean;
}

export interface HighScoreEntry {
  id: string;
  mode: GameMode;
  score: number;
  level: number;
  kills: number;
  date: string;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  shield: number;
  maxShield: number;
  boost: number;
  maxBoost: number;
  specialCharge: number;
  maxSpecialCharge: number;
  score: number;
  bestScore: number;
  combo: number;
  level: number;
  levelName: string;
  wave: number;
  totalWaves: number;
  enemiesRemaining: number;
  kills: number;
  activeWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
  rapidFireTimer: number;
  damageBoostTimer: number;
  invincibleTimer: number;
  objectiveText: string;
  timeRemaining: number; // for time attack, or elapsed for others
  elapsedTime: number;
  bossActive: boolean;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: number;
  bossShielded: boolean;
  bossWarningText: string;
  activePowerUpBanner: string;
  damageFlash: number;
  ultimateFlash: number;
}

export interface RunOutcome {
  victory: boolean;
  mode: GameMode;
  score: number;
  bestScore: number;
  level: number;
  levelName: string;
  wave: number;
  kills: number;
  elapsedTime: number;
  damageTaken: number;
  bossHpRemaining: number;
  bossMaxHp: number;
  rank: 'S' | 'A' | 'B' | 'C';
  nextLevelUnlocked: number | null;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fire: boolean;
  boost: boolean;
  rollLeft: boolean;
  rollRight: boolean;
  specialJustPressed: boolean;
  aimX: number; // -1..1 normalized pointer aim
  aimY: number; // -1..1 normalized pointer aim
  pointerActive: boolean;
}
