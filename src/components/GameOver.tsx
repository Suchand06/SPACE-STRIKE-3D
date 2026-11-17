import React from 'react';
import { RotateCcw, ArrowRight, Home } from 'lucide-react';
import type { RunOutcome } from '../game/types';

interface GameOverProps {
  outcome: RunOutcome;
  onRetry: () => void;
  onNextLevel: (level: number) => void;
  onMainMenu: () => void;
}

export const GameOver: React.FC<GameOverProps> = ({
  outcome,
  onRetry,
  onNextLevel,
  onMainMenu,
}) => {
  const isVictory = outcome.victory;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#020612]/85 p-4">
      <div
        className={`w-full max-w-md bg-[#071124]/95 border p-6 hud-chamfer shadow-[0_0_50px_rgba(0,0,0,0.6)] ${
          isVictory ? 'border-emerald-400/60' : 'border-rose-500/60'
        }`}
      >
        <div className="flex items-center justify-between mb-1">
          <span
            className={`text-xs font-hud uppercase tracking-widest font-bold ${
              isVictory ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isVictory ? 'SECTOR SECURED' : 'STARFIGHTER DESTROYED'}
          </span>
          {isVictory && (
            <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-display font-black text-xs">
              RANK {outcome.rank}
            </span>
          )}
        </div>

        <h2 className="font-display text-3xl font-black tracking-wider text-white mb-5">
          {isVictory
            ? outcome.mode === 'time_attack'
              ? 'TIME EXPIRED'
              : 'VICTORY'
            : 'MISSION FAILED'}
        </h2>

        {/* Outcome-Matched Metrics */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-slate-950/85 border border-slate-800">
            <div className="text-[10px] font-hud uppercase text-slate-400">FINAL SCORE</div>
            <div className="font-display text-xl font-black text-white">
              {outcome.score.toLocaleString()}
            </div>
            <div className="text-[11px] font-hud text-sky-400">
              BEST: {outcome.bestScore.toLocaleString()}
            </div>
          </div>

          <div className="p-3 bg-slate-950/85 border border-slate-800">
            <div className="text-[10px] font-hud uppercase text-slate-400">
              {isVictory ? 'CLEAR TIME' : 'PROGRESS REACHED'}
            </div>
            <div className="font-display text-xl font-black text-white">
              {isVictory
                ? `${outcome.elapsedTime.toFixed(1)}s`
                : `LV.${outcome.level} · W${outcome.wave}`}
            </div>
            <div className="text-[11px] font-hud text-slate-300">
              {isVictory
                ? `DAMAGE TAKEN: ${outcome.damageTaken}`
                : outcome.bossMaxHp > 0
                  ? `BOSS HP LEFT: ${outcome.bossHpRemaining}`
                  : `HOSTILES DESTROYED: ${outcome.kills}`}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {isVictory && outcome.nextLevelUnlocked && (
            <button
              type="button"
              data-start="true"
              onClick={() => onNextLevel(outcome.nextLevelUnlocked!)}
              className="flex items-center justify-center gap-2 py-3.5 bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-display font-extrabold text-sm tracking-widest hud-chamfer-sm cursor-pointer"
            >
              NEXT SECTOR (LV.{outcome.nextLevelUnlocked})
              <ArrowRight className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            data-start={!isVictory || !outcome.nextLevelUnlocked ? 'true' : undefined}
            onClick={onRetry}
            className={`flex items-center justify-center gap-2 py-3 font-display font-extrabold text-sm tracking-widest hud-chamfer-sm cursor-pointer ${
              !isVictory || !outcome.nextLevelUnlocked
                ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                : 'bg-[#0c1b36] hover:bg-[#132952] border border-sky-500/40 text-sky-100'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            {isVictory ? 'REPLAY SECTOR' : 'TRY AGAIN'}
          </button>

          <button
            type="button"
            onClick={onMainMenu}
            className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-display text-xs tracking-widest hud-chamfer-sm cursor-pointer"
          >
            <Home className="w-4 h-4" />
            MAIN MENU
          </button>
        </div>
      </div>
    </div>
  );
};
