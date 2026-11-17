import React, { useRef, useState } from 'react';
import { Pause, Volume2, VolumeX, Settings as SettingsIcon } from 'lucide-react';
import { WEAPON_SPECS } from '../game/constants';
import type { GameMode, HudSnapshot, WeaponId } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  mode: GameMode;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onOpenSettings: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onTriggerUltimate: () => void;
  onTouchMove: (dx: number, dy: number) => void;
  onTouchFire: (firing: boolean) => void;
  onTouchBoost: (boosting: boolean) => void;
  onTouchRoll: (dir: -1 | 1) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  mode,
  muted,
  onToggleMute,
  onPause,
  onOpenSettings,
  onSelectWeapon,
  onTriggerUltimate,
  onTouchMove,
  onTouchFire,
  onTouchBoost,
  onTouchRoll,
}) => {
  const [joyOffset, setJoyOffset] = useState({ x: 0, y: 0 });
  const joyOrigin = useRef<{ x: number; y: number } | null>(null);

  const hullPct = Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100));
  const shieldPct = Math.max(0, Math.min(100, (hud.shield / hud.maxShield) * 100));
  const boostPct = Math.max(0, Math.min(100, (hud.boost / hud.maxBoost) * 100));
  const specialPct = Math.max(0, Math.min(100, (hud.specialCharge / hud.maxSpecialCharge) * 100));
  const bossPct = Math.max(0, Math.min(100, (hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100));
  const specialReady = hud.specialCharge >= hud.maxSpecialCharge;

  const weaponOrder: WeaponId[] = ['dual_laser', 'plasma_cannon', 'missile_launcher', 'triple_laser'];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none overflow-hidden">
      {/* Screen-space damage & ultimate flashes */}
      {hud.damageFlash > 0.02 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, transparent 42%, rgba(239, 68, 68, ${Math.min(
              0.68,
              hud.damageFlash * 0.72
            )}) 100%)`,
          }}
        />
      )}
      {hud.ultimateFlash > 0.02 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: `rgba(103, 232, 249, ${Math.min(0.38, hud.ultimateFlash * 0.35)})`,
          }}
        />
      )}

      {/* Critical Low HP Peripheral Vignette */}
      {hud.health <= 30 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 90px rgba(220, 38, 38, 0.55)',
          }}
        />
      )}

      {/* Center Reticle (0,0) */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-65">
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="22" r="14" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="4 4" />
          <line x1="22" y1="3" x2="22" y2="10" stroke="#7dd3fc" strokeWidth="1.5" />
          <line x1="22" y1="34" x2="22" y2="41" stroke="#7dd3fc" strokeWidth="1.5" />
          <line x1="3" y1="22" x2="10" y2="22" stroke="#7dd3fc" strokeWidth="1.5" />
          <line x1="34" y1="22" x2="41" y2="22" stroke="#7dd3fc" strokeWidth="1.5" />
          <circle cx="22" cy="22" r="1.8" fill="#e0f2fe" />
        </svg>
      </div>

      {/* TOP BAR: 3 Compact Corner/Edge Clusters */}
      <div className="flex items-start justify-between gap-3 p-3 md:p-5">
        {/* Top-Left: Ship Systems (Hull, Shield, Boost, Nova) */}
        <div className="w-56 sm:w-64 bg-[#050d1c]/88 border border-sky-500/40 px-3.5 py-2.5 hud-chamfer">
          {/* Hull Integrity */}
          <div className="flex items-center justify-between text-xs font-hud uppercase tracking-wider mb-1">
            <span className="flex items-center gap-1.5 text-slate-200 font-semibold">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
                <path d="M12 2L4 6v6c0 5.5 3.4 9.7 8 11 4.6-1.3 8-5.5 8-11V6l-8-4z" fill="#0f172a" stroke="#22c55e" strokeWidth="2" />
              </svg>
              HULL
            </span>
            <span className="font-display text-sm font-bold text-white" data-testid="hud-health">
              {hud.health}
            </span>
          </div>
          <div className="h-2 bg-slate-900/90 border border-slate-700/70 mb-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-150 ${
                hullPct > 50 ? 'bg-emerald-400' : hullPct > 25 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
              style={{ width: `${hullPct}%` }}
            />
          </div>

          {/* Energy Shield */}
          <div className="flex items-center justify-between text-xs font-hud uppercase tracking-wider mb-1">
            <span className="text-sky-300 font-semibold">SHIELD</span>
            <span className="font-display text-xs font-bold text-sky-200">{hud.shield}</span>
          </div>
          <div className="h-1.5 bg-slate-900/90 border border-slate-700/70 mb-2 overflow-hidden">
            <div className="h-full bg-sky-400 transition-all duration-150" style={{ width: `${shieldPct}%` }} />
          </div>

          {/* Thruster Boost & Nova Special */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div>
              <div className="flex justify-between text-[10px] font-hud uppercase text-cyan-200/80 mb-0.5">
                <span>BOOST</span>
                <span>{hud.boost}%</span>
              </div>
              <div className="h-1 bg-slate-900 overflow-hidden">
                <div className="h-full bg-cyan-300" style={{ width: `${boostPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-hud uppercase text-teal-200/90 mb-0.5">
                <span>NOVA [X]</span>
                <span>{specialReady ? 'READY' : `${hud.specialCharge}%`}</span>
              </div>
              <div className="h-1 bg-slate-900 overflow-hidden">
                <div
                  className={`h-full ${specialReady ? 'bg-teal-300' : 'bg-teal-600'}`}
                  style={{ width: `${specialPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top-Center: Mission Objective / Boss Health / Warning */}
        <div className="hidden md:flex flex-col items-center max-w-md flex-1">
          <div className="bg-[#050d1c]/88 border border-sky-500/35 px-4 py-1.5 hud-chamfer-sm text-center">
            <div className="flex items-center justify-center gap-3 text-xs font-display tracking-widest text-sky-300">
              <span>LV.{hud.level} {hud.levelName.toUpperCase()}</span>
              <span className="text-slate-500">·</span>
              <span>
                WAVE {hud.wave}
                {mode === 'campaign' ? `/${hud.totalWaves}` : ''}
              </span>
              {mode === 'time_attack' && (
                <>
                  <span className="text-slate-500">·</span>
                  <span className="text-amber-300 font-bold">{Math.ceil(hud.timeRemaining)}S</span>
                </>
              )}
            </div>
            <div className="text-[11px] font-hud tracking-wide text-slate-300 mt-0.5">
              {hud.objectiveText}
            </div>
          </div>

          {/* Boss Health Bar */}
          {hud.bossActive && (
            <div className="mt-2 w-full bg-[#1a0710]/92 border border-rose-500/70 px-4 py-2 hud-chamfer">
              <div className="flex items-center justify-between text-xs font-display tracking-wider mb-1">
                <span className="text-rose-300 font-bold uppercase">
                  {hud.bossName} · PHASE {hud.bossPhase}
                </span>
                <span className="text-white font-bold" data-testid="boss-hp">
                  {hud.bossShielded ? 'SHIELDED · ' : ''}
                  {hud.bossHp} / {hud.bossMaxHp}
                </span>
              </div>
              <div className="h-2.5 bg-slate-950 border border-rose-900/80 overflow-hidden">
                <div
                  className={`h-full transition-all duration-150 ${
                    hud.bossShielded ? 'bg-sky-400' : 'bg-rose-500'
                  }`}
                  style={{ width: `${bossPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Boss Warning Banner */}
          {hud.bossWarningText && (
            <div className="mt-2 px-5 py-1.5 bg-rose-950/95 border border-rose-400 text-rose-200 font-display text-xs tracking-widest uppercase">
              {hud.bossWarningText}
            </div>
          )}

          {/* Power-Up Pickup Banner */}
          {hud.activePowerUpBanner && (
            <div className="mt-2 px-4 py-1 bg-sky-950/95 border border-cyan-400 text-cyan-200 font-display text-xs tracking-widest uppercase">
              {hud.activePowerUpBanner}
            </div>
          )}
        </div>

        {/* Top-Right: Score & Utility Buttons */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
              className="w-9 h-9 flex items-center justify-center bg-[#050d1c]/90 hover:bg-sky-950 border border-sky-500/40 text-sky-200 hud-chamfer-sm cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenSettings();
              }}
              aria-label="Open Settings"
              className="w-9 h-9 flex items-center justify-center bg-[#050d1c]/90 hover:bg-sky-950 border border-sky-500/40 text-sky-200 hud-chamfer-sm cursor-pointer"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Pause Game"
              className="w-9 h-9 flex items-center justify-center bg-[#050d1c]/90 hover:bg-sky-950 border border-sky-500/40 text-sky-200 hud-chamfer-sm cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-[#050d1c]/88 border border-sky-500/40 px-3.5 py-2 hud-chamfer text-right min-w-[148px]">
            <div className="text-[10px] font-hud uppercase tracking-widest text-sky-300">SCORE</div>
            <div className="font-display text-2xl font-black text-white leading-tight" data-testid="hud-score">
              {hud.score.toLocaleString()}
            </div>
            <div className="flex items-center justify-end gap-2.5 text-[11px] font-hud uppercase text-slate-300 mt-0.5">
              <span>HOSTILES {hud.enemiesRemaining}</span>
              {hud.combo > 1 && <span className="text-amber-300 font-bold">{hud.combo}X COMBO</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Active Buff Pills (non-intrusive left edge) */}
      {(hud.rapidFireTimer > 0 || hud.damageBoostTimer > 0 || hud.invincibleTimer > 0) && (
        <div className="absolute left-3 md:left-5 top-36 flex flex-col gap-1.5">
          {hud.rapidFireTimer > 0 && (
            <div className="px-2.5 py-1 bg-amber-950/90 border border-amber-400/70 text-amber-200 text-xs font-hud uppercase tracking-wider">
              RAPID FIRE {hud.rapidFireTimer.toFixed(1)}s
            </div>
          )}
          {hud.damageBoostTimer > 0 && (
            <div className="px-2.5 py-1 bg-rose-950/90 border border-rose-400/70 text-rose-200 text-xs font-hud uppercase tracking-wider">
              2X DAMAGE {hud.damageBoostTimer.toFixed(1)}s
            </div>
          )}
          {hud.invincibleTimer > 0 && (
            <div className="px-2.5 py-1 bg-slate-900/95 border border-white/80 text-white text-xs font-hud uppercase tracking-wider">
              PHASE SHIELD {hud.invincibleTimer.toFixed(1)}s
            </div>
          )}
        </div>
      )}

      {/* BOTTOM: Compact Weapon Selector Dock (Desktop) */}
      <div className="hidden md:flex fixed bottom-4 left-1/2 -translate-x-1/2 items-center gap-2 pointer-events-auto">
        {weaponOrder.map((wId) => {
          const spec = WEAPON_SPECS[wId];
          const active = hud.activeWeapon === wId;
          return (
            <button
              key={wId}
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onSelectWeapon(wId);
              }}
              className={`px-3 py-1.5 border text-left hud-chamfer-sm cursor-pointer transition-colors ${
                active
                  ? 'bg-sky-500/25 border-sky-300 text-white'
                  : 'bg-[#050d1c]/88 border-slate-700/80 text-slate-300 hover:border-sky-500/60'
              }`}
            >
              <div className="flex items-center gap-1.5 text-[11px] font-display font-bold tracking-wider">
                <span className="px-1 bg-slate-900 text-sky-300 border border-sky-500/40">{spec.keyHint}</span>
                <span>{spec.name.toUpperCase()}</span>
              </div>
              <div className="text-[10px] font-hud text-slate-400">{spec.role}</div>
            </button>
          );
        })}

        <button
          type="button"
          tabIndex={-1}
          disabled={!specialReady}
          onClick={(e) => {
            e.currentTarget.blur();
            onTriggerUltimate();
          }}
          className={`px-3.5 py-1.5 border text-left hud-chamfer-sm transition-colors ${
            specialReady
              ? 'bg-teal-500/30 border-teal-300 text-white cursor-pointer hover:bg-teal-500/45'
              : 'bg-[#050d1c]/75 border-slate-800 text-slate-500 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-display font-bold tracking-wider">
            <span className="px-1 bg-slate-900 text-teal-300 border border-teal-500/40">X</span>
            <span>NOVA BEAM</span>
          </div>
          <div className="text-[10px] font-hud">{specialReady ? 'READY TO FIRE' : `${hud.specialCharge}% CHARGING`}</div>
        </button>
      </div>

      {/* MOBILE TOUCH CONTROLS (Shown only on small screens) */}
      <div className="md:hidden fixed inset-x-0 bottom-4 px-4 flex items-end justify-between pointer-events-none">
        {/* Virtual Joystick */}
        <div
          className="w-28 h-28 rounded-full bg-[#071124]/80 border-2 border-sky-400/50 relative pointer-events-auto flex items-center justify-center"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();
            joyOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
          }}
          onPointerMove={(e) => {
            if (!joyOrigin.current) return;
            const maxR = 38;
            const dx = Math.max(-maxR, Math.min(maxR, e.clientX - joyOrigin.current.x));
            const dy = Math.max(-maxR, Math.min(maxR, e.clientY - joyOrigin.current.y));
            setJoyOffset({ x: dx, y: dy });
            onTouchMove(dx / maxR, -dy / maxR);
          }}
          onPointerUp={() => {
            joyOrigin.current = null;
            setJoyOffset({ x: 0, y: 0 });
            onTouchMove(0, 0);
          }}
          onPointerCancel={() => {
            joyOrigin.current = null;
            setJoyOffset({ x: 0, y: 0 });
            onTouchMove(0, 0);
          }}
        >
          <div
            className="w-11 h-11 rounded-full bg-sky-400/80 border border-white/70"
            style={{ transform: `translate(${joyOffset.x}px, ${joyOffset.y}px)` }}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col items-end gap-2 pointer-events-auto">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onTouchRoll(-1)}
              className="px-3 py-2 bg-[#071124]/90 border border-sky-500/50 text-sky-200 font-display text-xs hud-chamfer-sm"
            >
              ROLL L
            </button>
            <button
              type="button"
              onClick={() => onTouchRoll(1)}
              className="px-3 py-2 bg-[#071124]/90 border border-sky-500/50 text-sky-200 font-display text-xs hud-chamfer-sm"
            >
              ROLL R
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={() => onTouchBoost(true)}
              onPointerUp={() => onTouchBoost(false)}
              onPointerCancel={() => onTouchBoost(false)}
              className="w-14 h-14 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-200 font-display text-[10px] font-bold"
            >
              BOOST
            </button>
            <button
              type="button"
              onClick={onTriggerUltimate}
              disabled={!specialReady}
              className={`w-14 h-14 rounded-full border font-display text-[10px] font-bold ${
                specialReady
                  ? 'bg-teal-600/85 border-teal-200 text-white'
                  : 'bg-slate-900/80 border-slate-700 text-slate-500'
              }`}
            >
              NOVA
            </button>
            <button
              type="button"
              onPointerDown={() => onTouchFire(true)}
              onPointerUp={() => onTouchFire(false)}
              onPointerCancel={() => onTouchFire(false)}
              className="w-18 h-18 rounded-full bg-sky-500/85 border-2 border-white text-slate-950 font-display text-xs font-black"
            >
              FIRE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
