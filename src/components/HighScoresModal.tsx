import React from 'react';
import { X, Trophy } from 'lucide-react';
import type { HighScoreEntry } from '../game/types';

interface HighScoresModalProps {
  scores: HighScoreEntry[];
  onClose: () => void;
}

export const HighScoresModal: React.FC<HighScoresModalProps> = ({ scores, onClose }) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020612]/85 p-4">
      <div className="w-full max-w-lg bg-[#071124]/95 border border-sky-500/50 p-6 hud-chamfer">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[11px] font-hud uppercase tracking-widest text-amber-400">
              FLEET LEADERBOARD
            </div>
            <h2 className="font-display text-2xl font-black text-white">HIGH SCORES</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close High Scores"
            className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {scores.length === 0 ? (
          <div className="py-10 text-center bg-slate-950/70 border border-slate-800 mb-5">
            <Trophy className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="font-hud text-sm text-slate-400">
              No combat sorties recorded yet. Launch a mission to set a record.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950/80 mb-5 max-h-72 overflow-y-auto">
            {scores.map((entry, idx) => (
              <div key={entry.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-amber-400 w-5">#{idx + 1}</span>
                  <div>
                    <div className="font-display font-bold text-white">
                      {entry.score.toLocaleString()}
                    </div>
                    <div className="text-[11px] font-hud uppercase text-slate-400">
                      {entry.mode.replace('_', ' ')} · LV.{entry.level} · {entry.kills} KILLS
                    </div>
                  </div>
                </div>
                <span className="text-xs font-hud text-slate-500">{entry.date}</span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-sm tracking-widest hud-chamfer-sm cursor-pointer"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};
