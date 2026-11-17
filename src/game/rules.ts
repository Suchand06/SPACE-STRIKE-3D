import { LEVELS, WEAPON_SPECS } from './constants';
import type { GameMode, WeaponId, WeaponSpec } from './types';

export function clampDeltaTime(rawDt: number): number {
  if (!Number.isFinite(rawDt) || rawDt < 0) return 0.016;
  return Math.min(rawDt, 0.05);
}

export function sphereCollision(
  ax: number,
  ay: number,
  az: number,
  ar: number,
  bx: number,
  by: number,
  bz: number,
  br: number
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const dz = az - bz;
  const radSum = ar + br;
  return dx * dx + dy * dy + dz * dz <= radSum * radSum;
}

export function segmentSphereCollision(
  x1: number,
  y1: number,
  z1: number,
  x2: number,
  y2: number,
  z2: number,
  cx: number,
  cy: number,
  cz: number,
  r: number
): boolean {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const vz = z2 - z1;
  const lenSq = vx * vx + vy * vy + vz * vz;
  if (lenSq <= 1e-6) {
    return sphereCollision(x1, y1, z1, 0, cx, cy, cz, r);
  }
  const wx = cx - x1;
  const wy = cy - y1;
  const wz = cz - z1;
  let t = (wx * vx + wy * vy + wz * vz) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * vx;
  const py = y1 + t * vy;
  const pz = z1 + t * vz;
  const dx = cx - px;
  const dy = cy - py;
  const dz = cz - pz;
  return dx * dx + dy * dy + dz * dz <= r * r;
}

export interface DamageResult {
  newHealth: number;
  newShield: number;
  hullDamageTaken: number;
  shieldDamageTaken: number;
  destroyed: boolean;
}

export function applyShieldAndHullDamage(
  health: number,
  shield: number,
  incomingDamage: number,
  invulnerable: boolean
): DamageResult {
  if (invulnerable || incomingDamage <= 0) {
    return {
      newHealth: health,
      newShield: shield,
      hullDamageTaken: 0,
      shieldDamageTaken: 0,
      destroyed: health <= 0,
    };
  }
  const shieldAbsorb = Math.min(shield, incomingDamage);
  const remaining = incomingDamage - shieldAbsorb;
  const newShield = Math.max(0, shield - shieldAbsorb);
  const newHealth = Math.max(0, health - remaining);
  return {
    newHealth,
    newShield,
    hullDamageTaken: remaining,
    shieldDamageTaken: shieldAbsorb,
    destroyed: newHealth <= 0,
  };
}

export function getEffectiveWeaponStats(
  weaponId: WeaponId,
  rapidFireActive: boolean,
  damageBoostActive: boolean
): WeaponSpec {
  const base = WEAPON_SPECS[weaponId];
  return {
    ...base,
    cooldown: rapidFireActive ? base.cooldown * 0.52 : base.cooldown,
    damage: damageBoostActive ? Math.round(base.damage * 1.85) : base.damage,
  };
}

export function calculateKillScore(baseScore: number, combo: number, level: number): number {
  const comboMultiplier = 1 + Math.min(combo, 12) * 0.15;
  const levelMultiplier = 1 + (level - 1) * 0.15;
  return Math.round(baseScore * comboMultiplier * levelMultiplier);
}

export function computeBossPhase(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 1;
  const ratio = hp / maxHp;
  if (ratio > 0.66) return 1;
  if (ratio > 0.33) return 2;
  return 3;
}

export function computeDifficultyScale(mode: GameMode, level: number, wave: number): number {
  if (mode === 'endless') {
    return 1 + (wave - 1) * 0.14;
  }
  if (mode === 'time_attack') {
    return 1.1 + (wave - 1) * 0.1;
  }
  return 1 + (level - 1) * 0.22 + (wave - 1) * 0.08;
}

export function getNextUnlockedLevel(
  currentLevel: number,
  highestUnlocked: number,
  victory: boolean,
  mode: GameMode
): number {
  if (!victory || mode !== 'campaign') return highestUnlocked;
  const maxLevel = LEVELS.length;
  return Math.min(maxLevel, Math.max(highestUnlocked, currentLevel + 1));
}

export function getRankFromScore(score: number, damageTaken: number, victory: boolean): 'S' | 'A' | 'B' | 'C' {
  if (!victory) return 'C';
  const net = score - damageTaken * 12;
  if (net >= 6500) return 'S';
  if (net >= 3800) return 'A';
  if (net >= 1800) return 'B';
  return 'C';
}
