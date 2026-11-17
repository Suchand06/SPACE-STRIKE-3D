import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from './components/GameHUD';
import { GameOver } from './components/GameOver';
import { HighScoresModal } from './components/HighScoresModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { LevelSelectModal } from './components/LevelSelectModal';
import { MainMenu } from './components/MainMenu';
import { PauseMenu } from './components/PauseMenu';
import { Settings } from './components/Settings';
import { GameEngine } from './game/GameEngine';
import { getNextUnlockedLevel } from './game/rules';
import type {
  GameMode,
  GameScreenState,
  GraphicsSettings,
  HighScoreEntry,
  HudSnapshot,
  RunOutcome,
  WeaponId,
} from './game/types';

const STORAGE_KEYS = {
  settings: 'ss3d_settings_v1',
  unlocked: 'ss3d_unlocked_v1',
  scores: 'ss3d_highscores_v1',
};

const DEFAULT_SETTINGS: GraphicsSettings = {
  quality: 'high',
  musicVolume: 0.45,
  sfxVolume: 0.75,
  muted: false,
  mouseAim: true,
};

const INITIAL_HUD: HudSnapshot = {
  health: 100,
  maxHealth: 100,
  shield: 50,
  maxShield: 50,
  boost: 100,
  maxBoost: 100,
  specialCharge: 100,
  maxSpecialCharge: 100,
  score: 0,
  bestScore: 0,
  combo: 0,
  level: 1,
  levelName: 'First Contact',
  wave: 1,
  totalWaves: 3,
  enemiesRemaining: 0,
  kills: 0,
  activeWeapon: 'dual_laser',
  unlockedWeapons: ['dual_laser', 'plasma_cannon', 'missile_launcher', 'triple_laser'],
  rapidFireTimer: 0,
  damageBoostTimer: 0,
  invincibleTimer: 0,
  objectiveText: 'Intercept vanguard alien scouts & battle cruiser',
  timeRemaining: 90,
  elapsedTime: 0,
  bossActive: false,
  bossName: '',
  bossHp: 0,
  bossMaxHp: 1,
  bossPhase: 1,
  bossShielded: false,
  bossWarningText: '',
  activePowerUpBanner: '',
  damageFlash: 0,
  ultimateFlash: 0,
};

function loadSettings(): GraphicsSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadUnlockedLevel(): number {
  try {
    const val = Number(localStorage.getItem(STORAGE_KEYS.unlocked) || '1');
    return Number.isFinite(val) && val >= 1 ? Math.min(5, val) : 1;
  } catch {
    return 1;
  }
}

function loadHighScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.scores);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [screenState, setScreenState] = useState<GameScreenState>('title');
  const [selectedMode, setSelectedMode] = useState<GameMode>('campaign');
  const [currentLevel, setCurrentLevel] = useState<number>(1);
  const [highestUnlocked, setHighestUnlocked] = useState<number>(() => loadUnlockedLevel());
  const [settings, setSettings] = useState<GraphicsSettings>(() => loadSettings());
  const [highScores, setHighScores] = useState<HighScoreEntry[]>(() => loadHighScores());
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);

  const [activeModal, setActiveModal] = useState<
    'none' | 'levels' | 'howto' | 'settings' | 'scores'
  >('none');

  const screenStateRef = useRef(screenState);
  screenStateRef.current = screenState;
  const activeModalRef = useRef(activeModal);
  activeModalRef.current = activeModal;
  const selectedModeRef = useRef(selectedMode);
  selectedModeRef.current = selectedMode;
  const currentLevelRef = useRef(currentLevel);
  currentLevelRef.current = currentLevel;
  const highestUnlockedRef = useRef(highestUnlocked);
  highestUnlockedRef.current = highestUnlocked;

  const bestScore = highScores.length > 0 ? highScores[0].score : 0;

  // Sync body[data-state] for deterministic shell verification
  useEffect(() => {
    document.body.dataset.state = screenState;
  }, [screenState]);

  const clearAllHeldInputs = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.input.forward = false;
    eng.input.backward = false;
    eng.input.left = false;
    eng.input.right = false;
    eng.input.up = false;
    eng.input.down = false;
    eng.input.fire = false;
    eng.input.boost = false;
    eng.input.rollLeft = false;
    eng.input.rollRight = false;
    eng.input.specialJustPressed = false;
    eng.input.pointerActive = false;
  }, []);

  const launchMission = useCallback(
    (mode: GameMode, levelId: number) => {
      const eng = engineRef.current;
      if (!eng) return;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      clearAllHeldInputs();
      setActiveModal('none');
      setOutcome(null);
      setSelectedMode(mode);
      setCurrentLevel(levelId);
      document.body.dataset.state = 'playing';
      eng.startNewGame(mode, levelId);
    },
    [clearAllHeldInputs]
  );

  // Mount Three.js GameEngine ONCE
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const initialBest = loadHighScores()[0]?.score ?? 0;
    const engine = new GameEngine(mount, settings, initialBest, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onStateChange: (next) => {
        document.body.dataset.state = next;
        setScreenState(next);
      },
      onGameOver: (runResult) => {
        setOutcome(runResult);
        const nextUnlocked = getNextUnlockedLevel(
          runResult.level,
          highestUnlockedRef.current,
          runResult.victory,
          runResult.mode
        );
        if (nextUnlocked > highestUnlockedRef.current) {
          highestUnlockedRef.current = nextUnlocked;
          setHighestUnlocked(nextUnlocked);
          try {
            localStorage.setItem(STORAGE_KEYS.unlocked, String(nextUnlocked));
          } catch {
            // ignore storage errors
          }
        }
        if (runResult.score > 0) {
          setHighScores((prev) => {
            const nextList: HighScoreEntry[] = [
              ...prev,
              {
                id: `${Date.now()}`,
                mode: runResult.mode,
                score: runResult.score,
                level: runResult.level,
                kills: runResult.kills,
                date: new Date().toLocaleDateString(),
              },
            ]
              .sort((a, b) => b.score - a.score)
              .slice(0, 10);
            try {
              localStorage.setItem(STORAGE_KEYS.scores, JSON.stringify(nextList));
            } catch {
              // ignore
            }
            engine.setBestScore(nextList[0]?.score ?? 0);
            return nextList;
          });
        }
      },
    });

    engineRef.current = engine;

    // Support ?autostart=1&level=N query parameters
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const requestedLvl = Math.max(1, Math.min(5, Number(params.get('level') || '1') || 1));
      setCurrentLevel(requestedLvl);
      document.body.dataset.state = 'playing';
      engine.startNewGame('campaign', requestedLvl);
    }

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync Settings changes to engine + localStorage
  const handleSettingsChange = useCallback((next: GraphicsSettings) => {
    setSettings(next);
    engineRef.current?.updateSettings(next);
    try {
      localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  // Unified Window Keyboard & Blur Hygiene
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;

      // Title Screen Start Handshake (Enter or Space)
      if (screenStateRef.current === 'title' && activeModalRef.current === 'none') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          launchMission(selectedModeRef.current, currentLevelRef.current);
          return;
        }
      }

      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (activeModalRef.current !== 'none') {
          setActiveModal('none');
          return;
        }
        if (screenStateRef.current === 'playing') {
          e.preventDefault();
          clearAllHeldInputs();
          eng.setPaused(true);
          return;
        }
        if (screenStateRef.current === 'paused') {
          e.preventDefault();
          clearAllHeldInputs();
          eng.setPaused(false);
          return;
        }
      }

      if (e.code === 'KeyM') {
        handleSettingsChange({ ...settings, muted: !settings.muted });
        return;
      }

      if (screenStateRef.current !== 'playing') return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          eng.input.up = true;
          eng.input.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          eng.input.down = true;
          eng.input.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          eng.input.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          eng.input.right = true;
          break;
        case 'Space':
          e.preventDefault();
          eng.audio.resume();
          eng.input.fire = true;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          eng.input.boost = true;
          break;
        case 'KeyQ':
          eng.input.rollLeft = true;
          break;
        case 'KeyE':
          eng.input.rollRight = true;
          break;
        case 'KeyX':
          if (!e.repeat) eng.input.specialJustPressed = true;
          break;
        case 'Digit1':
          eng.selectWeapon('dual_laser');
          break;
        case 'Digit2':
          eng.selectWeapon('plasma_cannon');
          break;
        case 'Digit3':
          eng.selectWeapon('missile_launcher');
          break;
        case 'Digit4':
          eng.selectWeapon('triple_laser');
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          eng.input.up = false;
          eng.input.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          eng.input.down = false;
          eng.input.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          eng.input.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          eng.input.right = false;
          break;
        case 'Space':
          eng.input.fire = false;
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          eng.input.boost = false;
          break;
        case 'KeyQ':
          eng.input.rollLeft = false;
          break;
        case 'KeyE':
          eng.input.rollRight = false;
          break;
      }
    };

    const onBlurOrHidden = () => {
      clearAllHeldInputs();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlurOrHidden);
    document.addEventListener('visibilitychange', onBlurOrHidden);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlurOrHidden);
      document.removeEventListener('visibilitychange', onBlurOrHidden);
    };
  }, [clearAllHeldInputs, handleSettingsChange, launchMission, settings]);

  // Pointer aiming & click-fire on the isolated WebGL canvas container
  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const eng = engineRef.current;
    if (!eng || screenState !== 'playing') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    eng.input.aimX = Math.max(-1, Math.min(1, nx));
    eng.input.aimY = Math.max(-1, Math.min(1, ny));
    eng.input.pointerActive = true;
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const eng = engineRef.current;
    if (!eng || screenState !== 'playing') return;
    if (e.pointerType === 'mouse' && e.button === 0) {
      eng.audio.resume();
      eng.input.fire = true;
    }
  };

  const handleCanvasPointerUp = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.input.fire = false;
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#030712]">
      {/* Isolated WebGL Canvas Mount (never re-rendered on HUD state updates) */}
      <div
        ref={canvasMountRef}
        data-testid="webgl-viewport"
        onPointerMove={handleCanvasPointerMove}
        onPointerDown={handleCanvasPointerDown}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={() => {
          if (engineRef.current) {
            engineRef.current.input.fire = false;
            engineRef.current.input.pointerActive = false;
          }
        }}
        className="absolute inset-0 w-full h-full"
      />

      {/* Screen 1: Title / Main Menu */}
      {screenState === 'title' && (
        <MainMenu
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          highestUnlockedLevel={highestUnlocked}
          bestScore={bestScore}
          onStartNew={() => launchMission(selectedMode, 1)}
          onContinue={() => launchMission('campaign', highestUnlocked)}
          onOpenLevels={() => setActiveModal('levels')}
          onOpenHowToPlay={() => setActiveModal('howto')}
          onOpenSettings={() => setActiveModal('settings')}
          onOpenHighScores={() => setActiveModal('scores')}
        />
      )}

      {/* Screen 2: Live Gameplay HUD */}
      {screenState === 'playing' && (
        <GameHUD
          hud={hud}
          mode={selectedMode}
          muted={settings.muted}
          onToggleMute={() => handleSettingsChange({ ...settings, muted: !settings.muted })}
          onPause={() => {
            clearAllHeldInputs();
            engineRef.current?.setPaused(true);
          }}
          onOpenSettings={() => {
            clearAllHeldInputs();
            engineRef.current?.setPaused(true);
            setActiveModal('settings');
          }}
          onSelectWeapon={(w: WeaponId) => engineRef.current?.selectWeapon(w)}
          onTriggerUltimate={() => engineRef.current?.triggerUltimate()}
          onTouchMove={(dx, dy) => {
            const eng = engineRef.current;
            if (!eng) return;
            eng.input.left = dx < -0.22;
            eng.input.right = dx > 0.22;
            eng.input.up = dy > 0.22;
            eng.input.down = dy < -0.22;
          }}
          onTouchFire={(firing) => {
            const eng = engineRef.current;
            if (!eng) return;
            eng.audio.resume();
            eng.input.fire = firing;
          }}
          onTouchBoost={(boosting) => {
            if (engineRef.current) engineRef.current.input.boost = boosting;
          }}
          onTouchRoll={(dir) => engineRef.current?.triggerBarrelRoll(dir)}
        />
      )}

      {/* Screen 3: Pause Modal */}
      {screenState === 'paused' && activeModal === 'none' && (
        <PauseMenu
          levelName={hud.levelName}
          score={hud.score}
          onResume={() => engineRef.current?.setPaused(false)}
          onRestart={() => launchMission(selectedMode, currentLevel)}
          onOpenSettings={() => setActiveModal('settings')}
          onMainMenu={() => engineRef.current?.returnToTitle()}
        />
      )}

      {/* Screen 4: Victory / Game Over Modal */}
      {screenState === 'gameover' && outcome && (
        <GameOver
          outcome={outcome}
          onRetry={() => launchMission(selectedMode, currentLevel)}
          onNextLevel={(nextLvl) => launchMission('campaign', nextLvl)}
          onMainMenu={() => engineRef.current?.returnToTitle()}
        />
      )}

      {/* Utility Modals */}
      {activeModal === 'levels' && (
        <LevelSelectModal
          highestUnlockedLevel={highestUnlocked}
          onSelectLevel={(lvl) => launchMission('campaign', lvl)}
          onClose={() => setActiveModal('none')}
        />
      )}
      {activeModal === 'howto' && <HowToPlayModal onClose={() => setActiveModal('none')} />}
      {activeModal === 'settings' && (
        <Settings
          settings={settings}
          onChange={handleSettingsChange}
          onClose={() => setActiveModal('none')}
        />
      )}
      {activeModal === 'scores' && (
        <HighScoresModal scores={highScores} onClose={() => setActiveModal('none')} />
      )}
    </main>
  );
}
