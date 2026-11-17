import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyShieldAndHullDamage,
  calculateKillScore,
  clampDeltaTime,
  computeBossPhase,
  computeDifficultyScale,
  getEffectiveWeaponStats,
  getNextUnlockedLevel,
  getRankFromScore,
  segmentSphereCollision,
  sphereCollision,
} from './rules';

test('clampDeltaTime caps large spikes at 0.05s and handles invalid inputs', () => {
  assert.equal(clampDeltaTime(0.016), 0.016);
  assert.equal(clampDeltaTime(1.5), 0.05);
  assert.equal(clampDeltaTime(-0.2), 0.016);
  assert.equal(clampDeltaTime(Number.NaN), 0.016);
});

test('sphereCollision detects overlap and separation accurately', () => {
  assert.equal(sphereCollision(0, 0, 0, 2, 3, 0, 0, 1.5), true);
  assert.equal(sphereCollision(0, 0, 0, 1, 5, 0, 0, 1), false);
});

test('segmentSphereCollision catches fast projectile swept through sphere', () => {
  assert.equal(segmentSphereCollision(0, 0, -20, 0, 0, 20, 1.0, 0, 0, 1.5), true);
  assert.equal(segmentSphereCollision(0, 0, -20, 0, 0, 20, 5.0, 0, 0, 1.5), false);
});

test('applyShieldAndHullDamage absorbs damage via shield before hull and respects invulnerability', () => {
  const absorbed = applyShieldAndHullDamage(100, 40, 25, false);
  assert.equal(absorbed.newShield, 15);
  assert.equal(absorbed.newHealth, 100);
  assert.equal(absorbed.destroyed, false);

  const overflow = applyShieldAndHullDamage(100, 20, 50, false);
  assert.equal(overflow.newShield, 0);
  assert.equal(overflow.newHealth, 70);
  assert.equal(overflow.hullDamageTaken, 30);

  const lethal = applyShieldAndHullDamage(20, 0, 35, false);
  assert.equal(lethal.newHealth, 0);
  assert.equal(lethal.destroyed, true);

  const invuln = applyShieldAndHullDamage(20, 0, 35, true);
  assert.equal(invuln.newHealth, 20);
  assert.equal(invuln.destroyed, false);
});

test('getEffectiveWeaponStats applies rapid fire cooldown reduction and damage boost', () => {
  const normal = getEffectiveWeaponStats('dual_laser', false, false);
  const boosted = getEffectiveWeaponStats('dual_laser', true, true);
  assert.ok(boosted.cooldown < normal.cooldown);
  assert.ok(boosted.damage > normal.damage);
});

test('calculateKillScore scales with combo and level', () => {
  const base = calculateKillScore(100, 0, 1);
  const combo = calculateKillScore(100, 4, 2);
  assert.equal(base, 100);
  assert.ok(combo > base);
});

test('computeBossPhase transitions across 3 phases', () => {
  assert.equal(computeBossPhase(1000, 1000), 1);
  assert.equal(computeBossPhase(600, 1000), 2);
  assert.equal(computeBossPhase(250, 1000), 3);
});

test('progression unlocks next level on campaign victory up to level 5', () => {
  assert.equal(getNextUnlockedLevel(1, 1, true, 'campaign'), 2);
  assert.equal(getNextUnlockedLevel(5, 5, true, 'campaign'), 5);
  assert.equal(getNextUnlockedLevel(2, 2, false, 'campaign'), 2);
  assert.equal(getNextUnlockedLevel(2, 2, true, 'endless'), 2);
});

test('difficulty scaling increases smoothly with wave and level', () => {
  assert.ok(computeDifficultyScale('campaign', 3, 2) > computeDifficultyScale('campaign', 1, 1));
  assert.ok(computeDifficultyScale('endless', 1, 5) > computeDifficultyScale('endless', 1, 1));
});

test('getRankFromScore assigns expected ranks', () => {
  assert.equal(getRankFromScore(8000, 20, true), 'S');
  assert.equal(getRankFromScore(4200, 10, true), 'A');
  assert.equal(getRankFromScore(1500, 0, false), 'C');
});
