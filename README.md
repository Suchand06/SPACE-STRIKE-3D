# SPACE STRIKE 3D

A browser-based 3D third-person space combat game built with **React**, **TypeScript**, **Vite**, and **Three.js**. Pilot an advanced starfighter across five alien-occupied sectors, shatter asteroid fields, collect weapon and defensive power-ups, and take down multi-phase capital-ship bosses.

---
# HOSTED IN BELOW LINK
  https://space-strike-3d.ai.studio/
## Features

- **Real-Time 3D Space Environment**
  - Custom GLSL fractional Brownian motion (FBM) nebula sky domes per sector
  - Dual-layer parallax starfields with additive glow sprites
  - Procedural planets (including ringed gas giants) with canvas-generated textures
  - Instanced destructible asteroid belts, drifting debris, and distant combat flashes
  - GPU `EffectComposer` + `UnrealBloomPass` post-processing (with configurable Low / Medium / High presets)
- **Player Starfighter & Flight Physics**
  - Procedural multi-part 3D starfighter with metallic hull/bump textures, glowing cockpit, dual wings, weapon pods, and animated engine exhaust flames
  - Smooth third-person chase camera with lateral/vertical inertia, turn banking, afterburner boost, and evasive barrel rolls (`Q`/`E`) granting brief invulnerability
  - Fresnel energy shield shader that reacts on impact, barrel rolls, and phase invulnerability
- **5-Weapon Arsenal**
  1. **Dual Laser** (`1`) — Rapid twin bolts for sustained dogfighting
  2. **Plasma Cannon** (`2`) — Heavy high-impact blast orbs
  3. **Seeker Missiles** (`3`) — Homing warheads with tracking behavior
  4. **Triple Laser** (`4`) — Wide three-bolt spread pattern
  5. **Nova Beam** (`X`) — Charged area-overload ultimate energy blast
- **5 Enemy Archetypes & Wave AI**
  - **Scout Fighter**, **Interceptor**, **Heavy Destroyer**, **Stealth Fighter** (cloaking/ambush behavior), and **Alien Bomber** (mine/missile threats)
- **3 Multi-Phase Boss Encounters**
  - **Vanguard Corvette / Ironclad Battle Cruiser** (Sectors 1 & 2)
  - **Multi-Winged Destroyer / Rift Leviathan** (Sectors 3 & 4)
  - **Omega Alien Mothership** (Sector 5)
  - Features rotating turrets, destructible weak points, energy shield phases, sweeping beam attacks, homing salvos, and cinematic boss HUD alerts
- **8 Power-Up Drops**
  - `Hull Repair +35`, `Energy Shield +50`, `Rapid Overclock`, `Triple Laser`, `Seeker Missiles`, `Amplified Core 2X`, `Phase Invulnerability`, and `Nova Core Charge`
- **3 Game Modes**
  - **Campaign** — Progress through 5 sectors and unlock missions sequentially
  - **Endless Survival** — Escalating waves and boss encounters until hull failure
  - **Time Attack** — 90-second high-score sprint against relentless hostiles
- **Procedural Web Audio & Persistence**
  - Synthesized laser, plasma, missile, explosion, shield impact, engine hum, boss warning, and dynamic music audio via Web Audio API (no external audio assets required)
  - `localStorage` persistence for settings (quality, music/SFX volume, mute, mouse aim), unlocked campaign sectors, and top 10 high scores
- **Desktop & Mobile Input**
  - Full keyboard + optional mouse cursor aiming, plus responsive on-screen touch controls (virtual joystick + Roll L/R, Boost, Nova, and Fire buttons)

---

## Controls

### Desktop

| Input | Action |
| --- | --- |
| `W` / `S` or `↑` / `↓` | Pitch up/down & vertical maneuver |
| `A` / `D` or `←` / `→` | Strafe & bank starfighter |
| `Mouse Cursor` | Optional precision aiming (toggleable in Settings) |
| `Space` or `Left Click` | Fire active weapon |
| `Shift` | Engage afterburner boost |
| `Q` / `E` | Evasive barrel roll (brief invulnerability) |
| `1` / `2` / `3` / `4` | Switch Dual Laser / Plasma / Seeker Missiles / Triple Laser |
| `X` | Unleash Nova Beam ultimate (when charged) |
| `Esc` or `P` | Pause / resume mission (or close open modal) |
| `M` | Mute / unmute audio |
| `Enter` or `Space` (on Title) | Launch mission immediately |

### Mobile / Touch

- **Left Virtual Joystick**: 360° flight maneuvering
- **Action Buttons**: `ROLL L`, `ROLL R`, `BOOST`, `NOVA`, and `FIRE`

---

## Campaign Sectors

| Sector | Name | Location | Boss Encounter |
| --- | --- | --- | --- |
| 1 | **First Contact** | Outer Orbital Perimeter | Vanguard Corvette |
| 2 | **Asteroid Field** | Kepler Shattered Belt | Ironclad Battle Cruiser |
| 3 | **Enemy Armada** | Cygnus Staging Sector | Multi-Winged Destroyer |
| 4 | **Alien Territory** | Crimson Rift Citadel | Rift Leviathan |
| 5 | **Final Encounter** | Dread Sovereign Core | Omega Alien Mothership |

---

## Tech Stack

- **Framework & Language**: React 19, TypeScript, Vite
- **3D Engine & Effects**: Three.js (`WebGLRenderer`, `EffectComposer`, `UnrealBloomPass`, `RoomEnvironment`, `InstancedMesh`, custom GLSL shaders), GSAP
- **UI & Styling**: Tailwind CSS v4, Lucide React
- **Audio**: Web Audio API procedural synthesizer
- **Testing**: Node.js built-in test runner (`node:test`) executed via `tsx`

---

## Project Structure

```text
├── index.html
├── metadata.json
├── package.json
└── src/
    ├── App.tsx                       # Root state, localStorage persistence, input & engine mount
    ├── index.css                     # Tailwind CSS v4 + custom HUD typography & chamfer utilities
    ├── main.tsx
    ├── components/
    │   ├── GameHUD.tsx               # In-flight HUD, boss bar, weapon rack, mobile touch controls
    │   ├── GameOver.tsx              # Post-mission summary, rank (S/A/B/C), retry/next sector
    │   ├── HighScoresModal.tsx       # Persistent top-10 leaderboard
    │   ├── HowToPlayModal.tsx        # Pilot briefing & controls reference
    │   ├── LevelSelectModal.tsx      # 5-sector campaign selector & unlock progression
    │   ├── MainMenu.tsx              # Title overlay & mode selection
    │   ├── PauseMenu.tsx             # Pause overlay
    │   └── Settings.tsx              # Graphics quality, audio volumes, mute & mouse aim toggles
    └── game/
        ├── AudioManager.ts           # Web Audio API synth SFX & dynamic music sequencer
        ├── EnvironmentManager.ts     # Nebula sky, parallax stars, planets, asteroids & flashes
        ├── GameEngine.ts             # Core 3D loop, physics, weapons, enemy AI, bosses & VFX
        ├── ParticleSystem.ts         # InstancedMesh particle ring buffer & shockwave pool
        ├── ProceduralAssets.ts       # Procedural textures, Fresnel shield & FBM nebula shaders
        ├── ShipFactory.ts            # Composite 3D meshes for player, enemies & multi-part bosses
        ├── constants.ts              # Playfield bounds, weapon/enemy/level/graphics configs
        ├── rules.ts                  # Pure gameplay math, damage, scoring & progression logic
        ├── rules.test.ts             # Unit tests for pure game rules
        └── types.ts                  # Shared TypeScript interfaces and types
```

---

## Getting Started

### Prerequisites

- Node.js 20+ and npm

### Installation & Development

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:3000`.

You can also skip directly into gameplay via URL query parameters:

- `http://localhost:3000/?autostart=1` — Launches Campaign Sector 1 immediately
- `http://localhost:3000/?autostart=1&level=5` — Launches Campaign Sector 5 immediately

### Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server on port `3000` |
| `npm run build` | Build the production bundle to `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run TypeScript type-checking (`tsc --noEmit`) |
| `npx --yes tsx --test src/game/rules.test.ts` | Run the gameplay rules unit tests |
