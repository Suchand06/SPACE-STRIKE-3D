import React from 'react';
import { Lock, Play, X } from 'lucide-react';
import { LEVELS } from '../game/constants';

interface LevelSelectModalProps {
  highestUnlockedLevel: number;
  onSelectLevel: (levelId: number) => void;
  onClose: () => void;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  highestUnlockedLevel,
  onSelectLevel,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020612]/85 p-4">
      <div className="w-full max-w-2xl bg-[#071124]/95 border border-sky-500/50 p-6 hud-chamfer max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[11px] font-hud uppercase tracking-widest text-sky-400">
              CAMPAIGN SECTORS
            </div>
            <h2 className="font-display text-2xl font-black text-white">SELECT LEVEL</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Level Select"
            className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {LEVELS.map((lvl) => {
            const locked = lvl.id > highestUnlockedLevel;
            return (
              <div
                key={lvl.id}
                className={`flex items-center justify-between gap-4 p-3.5 border hud-chamfer-sm ${
                  locked
                    ? 'bg-slate-950/60 border-slate-800/80 opacity-60'
                    : 'bg-[#0a1830]/90 border-sky-500/40'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-sky-500/20 border border-sky-400/50 text-sky-300 font-display text-xs font-bold">
                      LV.{lvl.id}
                    </span>
                    <h3 className="font-display font-bold text-base text-white truncate">
                      {lvl.name}
                    </h3>
                  </div>
                  <p className="text-xs font-hud text-slate-300 mt-1">{lvl.subtitle} · {lvl.objective}</p>
                  <p className="text-[11px] font-hud text-amber-300/90 mt-0.5">
                    BOSS: {lvl.bossName.toUpperCase()}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={locked}
                  onClick={() => onSelectLevel(lvl.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2 font-display text-xs font-bold tracking-wider hud-chamfer-sm ${
                    locked
                      ? 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                      : 'bg-sky-500 hover:bg-sky-400 text-slate-950 cursor-pointer'
                  }`}
                >
                  {locked ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      LOCKED
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      DEPLOY
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
