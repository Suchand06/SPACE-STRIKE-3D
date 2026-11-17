import React from 'react';
import { Play, RotateCcw, Settings as SettingsIcon, Home } from 'lucide-react';

interface PauseMenuProps {
  levelName: string;
  score: number;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onMainMenu: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  levelName,
  score,
  onResume,
  onRestart,
  onOpenSettings,
  onMainMenu,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#020612]/80 p-4">
      <div className="w-full max-w-sm bg-[#071124]/95 border border-sky-500/50 p-6 hud-chamfer shadow-[0_0_40px_rgba(2,132,199,0.25)]">
        <div className="text-xs font-hud uppercase tracking-widest text-sky-400 mb-1">
          FLIGHT SYSTEMS SUSPENDED
        </div>
        <h2 className="font-display text-2xl font-black tracking-wider text-white mb-4">
          MISSION PAUSED
        </h2>

        <div className="grid grid-cols-2 gap-2.5 mb-5 p-3 bg-slate-950/80 border border-slate-800">
          <div>
            <div className="text-[10px] font-hud uppercase text-slate-400">SECTOR</div>
            <div className="text-sm font-display font-bold text-sky-200 truncate">{levelName}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-hud uppercase text-slate-400">SCORE</div>
            <div className="text-sm font-display font-bold text-white">{score.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="flex items-center justify-center gap-2 py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-sm tracking-widest hud-chamfer-sm cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            RESUME MISSION
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="flex items-center justify-center gap-2 py-2.5 bg-[#0c1b36] hover:bg-[#132952] border border-sky-500/40 text-sky-100 font-display text-xs tracking-widest hud-chamfer-sm cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            RESTART SECTOR
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-2 py-2.5 bg-[#0c1b36] hover:bg-[#132952] border border-slate-700 text-slate-200 font-display text-xs tracking-widest hud-chamfer-sm cursor-pointer"
          >
            <SettingsIcon className="w-4 h-4" />
            SETTINGS
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
