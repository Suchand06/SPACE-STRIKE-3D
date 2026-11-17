import React from 'react';
import { X } from 'lucide-react';

interface HowToPlayModalProps {
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ onClose }) => {
  const controls = [
    ['W / S or Up / Down', 'Pitch Up / Down & Vertical Maneuver'],
    ['A / D or Left / Right', 'Strafe & Bank Starfighter'],
    ['Space or Left Click', 'Fire Active Weapon'],
    ['Mouse Cursor', 'Optional Precision Aiming'],
    ['Shift', 'Engage Afterburner Boost'],
    ['Q / E', 'Evasive Barrel Roll (Brief Invulnerability)'],
    ['1 / 2 / 3 / 4', 'Switch Dual Laser, Plasma, Seeker Missiles, Triple Laser'],
    ['X', 'Unleash Nova Energy Blast (When Charged)'],
    ['Esc or P', 'Pause Mission · M Mute Audio'],
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020612]/85 p-4">
      <div className="w-full max-w-lg bg-[#071124]/95 border border-sky-500/50 p-6 hud-chamfer max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] font-hud uppercase tracking-widest text-sky-400">
              PILOT BRIEFING
            </div>
            <h2 className="font-display text-2xl font-black text-white">HOW TO PLAY</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close How to Play"
            className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm font-hud text-slate-300 mb-4 leading-relaxed">
          Defend the galaxy across five hostile sectors. Destroy alien squadrons, shatter asteroids for
          power-ups, target glowing boss weak points to collapse their energy shields, and dodge
          sweeping capital-ship beams.
        </p>

        <div className="divide-y divide-slate-800 border border-slate-800 bg-slate-950/80 mb-5">
          {controls.map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs">
              <span className="font-display font-bold text-sky-300 shrink-0">{key}</span>
              <span className="font-hud text-slate-300 text-right">{desc}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-sm tracking-widest hud-chamfer-sm cursor-pointer"
        >
          READY FOR LAUNCH
        </button>
      </div>
    </div>
  );
};
