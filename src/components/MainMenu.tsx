import React from 'react';
import { Play, RotateCcw, Layers, HelpCircle, Settings as SettingsIcon, Trophy } from 'lucide-react';
import type { GameMode } from '../game/types';

interface MainMenuProps {
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  highestUnlockedLevel: number;
  bestScore: number;
  onStartNew: () => void;
  onContinue: () => void;
  onOpenLevels: () => void;
  onOpenHowToPlay: () => void;
  onOpenSettings: () => void;
  onOpenHighScores: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  selectedMode,
  onSelectMode,
  highestUnlockedLevel,
  bestScore,
  onStartNew,
  onContinue,
  onOpenLevels,
  onOpenHowToPlay,
  onOpenSettings,
  onOpenHighScores,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 md:p-10">
      {/* Left-aligned title & command column leaving right/center open for the 3D Starfighter */}
      <div className="flex flex-col items-start max-w-md pt-2 md:pt-6 pointer-events-auto">
        {/* Bespoke Inline SVG Title Lockup */}
        <svg
          viewBox="0 0 460 128"
          className="w-72 sm:w-96 md:w-[430px] h-auto mb-5 drop-shadow-[0_6px_18px_rgba(2,132,199,0.35)]"
          role="img"
          aria-label="SPACE STRIKE 3D"
        >
          <defs>
            <linearGradient id="ss3d_wing" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="60%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          {/* Wing Emblem Crest */}
          <polygon points="8,24 62,14 48,32 16,38" fill="#0ea5e9" opacity="0.9" />
          <polygon points="14,42 54,36 42,50 20,52" fill="#38bdf8" opacity="0.65" />
          <polygon points="68,14 78,24 66,46 56,34" fill="#f8fafc" />
          {/* Main Title Typography */}
          <text
            x="90"
            y="48"
            fill="url(#ss3d_wing)"
            fontFamily="Orbitron, sans-serif"
            fontWeight="900"
            fontSize="38"
            letterSpacing="3"
          >
            SPACE
          </text>
          <text
            x="8"
            y="96"
            fill="#f8fafc"
            fontFamily="Orbitron, sans-serif"
            fontWeight="900"
            fontSize="46"
            letterSpacing="4"
          >
            STRIKE
          </text>
          {/* 3D Tactical Badge */}
          <polygon points="274,58 344,58 332,100 262,100" fill="#0284c7" stroke="#7dd3fc" strokeWidth="2" />
          <text
            x="280"
            y="91"
            fill="#ffffff"
            fontFamily="Orbitron, sans-serif"
            fontWeight="900"
            fontSize="32"
            letterSpacing="2"
          >
            3D
          </text>
          {/* Underscore Rule */}
          <rect x="8" y="110" width="230" height="3" fill="#38bdf8" />
          <rect x="244" y="110" width="88" height="3" fill="#0ea5e9" opacity="0.45" />
        </svg>

        {/* Mode Selector Tabs */}
        <div
          className="flex items-center gap-1.5 p-1 mb-4 bg-[#071124]/90 border border-sky-500/35 hud-chamfer-sm"
          role="group"
          aria-label="Game Mode"
        >
          {(
            [
              { id: 'campaign', label: 'CAMPAIGN' },
              { id: 'endless', label: 'ENDLESS' },
              { id: 'time_attack', label: 'TIME ATTACK' },
            ] as { id: GameMode; label: string }[]
          ).map((m) => {
            const active = selectedMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMode(m.id)}
                className={`px-3 py-1.5 text-xs font-display tracking-wider transition-colors cursor-pointer ${
                  active
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-300 hover:text-white hover:bg-sky-950/60'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Primary Launch CTA */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            type="button"
            data-start="true"
            onClick={onStartNew}
            className="flex items-center gap-2.5 px-7 py-3.5 bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-slate-950 font-display font-extrabold text-base tracking-widest hud-chamfer cursor-pointer shadow-[0_0_24px_rgba(56,189,248,0.45)] transition-transform active:scale-[0.98]"
          >
            <Play className="w-5 h-5 fill-current" />
            LAUNCH MISSION
          </button>

          {highestUnlockedLevel > 1 && selectedMode === 'campaign' && (
            <button
              type="button"
              onClick={onContinue}
              className="flex items-center gap-2 px-5 py-3.5 bg-[#09152b]/95 hover:bg-[#0f2347] border border-sky-400/50 text-sky-200 font-display font-bold text-sm tracking-wider hud-chamfer cursor-pointer transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              CONTINUE LV.{highestUnlockedLevel}
            </button>
          )}
        </div>

        {/* Secondary Menu Actions */}
        <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
          <button
            type="button"
            onClick={onOpenLevels}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#071124]/90 hover:bg-[#0d1f3d] border border-slate-700/80 hover:border-sky-500/60 text-slate-200 font-display text-xs tracking-wider hud-chamfer-sm cursor-pointer transition-colors"
          >
            <Layers className="w-4 h-4 text-sky-400" />
            SELECT LEVEL
          </button>
          <button
            type="button"
            onClick={onOpenHighScores}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#071124]/90 hover:bg-[#0d1f3d] border border-slate-700/80 hover:border-sky-500/60 text-slate-200 font-display text-xs tracking-wider hud-chamfer-sm cursor-pointer transition-colors"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            HIGH SCORES
          </button>
          <button
            type="button"
            onClick={onOpenHowToPlay}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#071124]/90 hover:bg-[#0d1f3d] border border-slate-700/80 hover:border-sky-500/60 text-slate-200 font-display text-xs tracking-wider hud-chamfer-sm cursor-pointer transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            HOW TO PLAY
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-[#071124]/90 hover:bg-[#0d1f3d] border border-slate-700/80 hover:border-sky-500/60 text-slate-200 font-display text-xs tracking-wider hud-chamfer-sm cursor-pointer transition-colors"
          >
            <SettingsIcon className="w-4 h-4 text-slate-300" />
            SETTINGS
          </button>
        </div>

        {bestScore > 0 && (
          <div className="mt-4 text-xs font-hud tracking-widest uppercase text-sky-300/85 hud-text-shadow">
            HIGH SCORE RECORD: <span className="text-white font-bold">{bestScore.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Single flat control-hint line in bottom safe margin */}
      <div className="w-full flex justify-center pb-1">
        <p className="text-xs md:text-sm font-hud tracking-widest uppercase text-slate-300/85 hud-text-shadow text-center">
          WASD / Arrows Move · Space Fire · Shift Boost · Q / E Barrel Roll · X Nova Blast · Esc Pause
        </p>
      </div>
    </div>
  );
};
