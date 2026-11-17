import React from 'react';
import { X } from 'lucide-react';
import type { GraphicsQuality, GraphicsSettings } from '../game/types';

interface SettingsProps {
  settings: GraphicsSettings;
  onChange: (next: GraphicsSettings) => void;
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onChange, onClose }) => {
  const qualities: GraphicsQuality[] = ['low', 'medium', 'high'];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#020612]/85 p-4">
      <div className="w-full max-w-md bg-[#071124]/95 border border-sky-500/50 p-6 hud-chamfer">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[11px] font-hud uppercase tracking-widest text-sky-400">
              SYSTEM CONFIGURATION
            </div>
            <h2 className="font-display text-2xl font-black text-white">SETTINGS</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="w-9 h-9 flex items-center justify-center bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Graphics Quality */}
          <div>
            <label className="block text-xs font-display tracking-wider text-slate-300 uppercase mb-2">
              GRAPHICS QUALITY
            </label>
            <div className="grid grid-cols-3 gap-2">
              {qualities.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => onChange({ ...settings, quality: q })}
                  className={`py-2 font-display text-xs uppercase tracking-wider border cursor-pointer ${
                    settings.quality === q
                      ? 'bg-sky-500 text-slate-950 border-sky-300 font-bold'
                      : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-sky-500/60'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Music Volume */}
          <div>
            <div className="flex justify-between text-xs font-display tracking-wider text-slate-300 mb-1.5">
              <label htmlFor="music-vol">MUSIC VOLUME</label>
              <span className="font-hud">{Math.round(settings.musicVolume * 100)}%</span>
            </div>
            <input
              id="music-vol"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => onChange({ ...settings, musicVolume: Number(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* SFX Volume */}
          <div>
            <div className="flex justify-between text-xs font-display tracking-wider text-slate-300 mb-1.5">
              <label htmlFor="sfx-vol">SFX VOLUME</label>
              <span className="font-hud">{Math.round(settings.sfxVolume * 100)}%</span>
            </div>
            <input
              id="sfx-vol"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) => onChange({ ...settings, sfxVolume: Number(e.target.value) })}
              className="w-full accent-sky-400 cursor-pointer"
            />
          </div>

          {/* Toggles */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => onChange({ ...settings, muted: !settings.muted })}
              className={`py-2.5 px-3 border font-display text-xs tracking-wider cursor-pointer ${
                settings.muted
                  ? 'bg-rose-950/90 border-rose-500 text-rose-200'
                  : 'bg-slate-950 border-slate-700 text-slate-200'
              }`}
            >
              AUDIO: {settings.muted ? 'MUTED' : 'ACTIVE'}
            </button>

            <button
              type="button"
              onClick={() => onChange({ ...settings, mouseAim: !settings.mouseAim })}
              className={`py-2.5 px-3 border font-display text-xs tracking-wider cursor-pointer ${
                settings.mouseAim
                  ? 'bg-sky-950/90 border-sky-400 text-sky-200'
                  : 'bg-slate-950 border-slate-700 text-slate-300'
              }`}
            >
              MOUSE AIM: {settings.mouseAim ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-3 bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-extrabold text-sm tracking-widest hud-chamfer-sm cursor-pointer"
        >
          APPLY & CLOSE
        </button>
      </div>
    </div>
  );
};
