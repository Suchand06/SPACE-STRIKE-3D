import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AudioManager } from './AudioManager';
import {
  ENEMY_SPECS,
  GRAPHICS_PRESETS,
  LEVELS,
  PLAYFIELD_BOUNDS,
  POWERUP_SPECS,
  TIME_ATTACK_DURATION,
  WEAPON_SPECS,
} from './constants';
import { EnvironmentManager } from './EnvironmentManager';
import { ParticleSystem } from './ParticleSystem';
import { createProceduralTextures, ProceduralTextureSet } from './ProceduralAssets';
import {
  applyShieldAndHullDamage,
  calculateKillScore,
  clampDeltaTime,
  computeBossPhase,
  computeDifficultyScale,
  getEffectiveWeaponStats,
  getRankFromScore,
  segmentSphereCollision,
  sphereCollision,
} from './rules';
import { BossShipRig, createBossMesh, createEnemyShipMesh, createPlayerShipMesh, PlayerShipRig } from './ShipFactory';
import type {
  BossType,
  EnemyType,
  GameMode,
  GameScreenState,
  GraphicsSettings,
  HudSnapshot,
  InputState,
  PowerUpType,
  RunOutcome,
  WeaponId,
} from './types';

// Pre-allocated scratch math objects (Zero-GC render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();

interface ActiveProjectile {
  active: boolean;
  fromPlayer: boolean;
  kind: 'laser' | 'plasma' | 'missile' | 'ultimate' | 'enemy_laser' | 'enemy_missile' | 'mine';
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  prevX: number;
  prevY: number;
  prevZ: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  damage: number;
  life: number;
  homingTargetId: number | null;
}

interface ActiveEnemy {
  id: number;
  type: EnemyType;
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  coreMesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hp: number;
  maxHp: number;
  radius: number;
  score: number;
  fireCooldown: number;
  age: number;
  phaseOffset: number;
  hitFlashTimer: number;
  dying: boolean;
  deathTimer: number;
  spinSpeed: number;
}

interface ActivePowerUp {
  active: boolean;
  type: PowerUpType;
  group: THREE.Group;
  x: number;
  y: number;
  z: number;
  age: number;
}

interface ActiveBoss {
  type: BossType;
  name: string;
  rig: BossShipRig;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  phase: number;
  shielded: boolean;
  shieldCooldown: number;
  fireCooldown: number;
  missileCooldown: number;
  beamState: 'idle' | 'telegraph' | 'firing';
  beamTimer: number;
  beamMesh: THREE.Mesh;
  telegraphMesh: THREE.Mesh;
  beamAngle: number;
  hitFlashTimer: number;
  dying: boolean;
  deathTimer: number;
  explosionTick: number;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onGameOver: (outcome: RunOutcome) => void;
  onStateChange: (state: GameScreenState) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  public audio: AudioManager;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private pmremEnv: THREE.Texture;

  private textures: ProceduralTextureSet;
  private environment: EnvironmentManager;
  private particles: ParticleSystem;
  private playerRig: PlayerShipRig;
  private muzzleLight: THREE.PointLight;

  private projectilePool: ActiveProjectile[] = [];
  private enemies: ActiveEnemy[] = [];
  private nextEnemyId = 1;
  private powerUps: ActivePowerUp[] = [];
  private boss: ActiveBoss | null = null;

  private screenState: GameScreenState = 'title';
  private gameMode: GameMode = 'campaign';
  private currentLevelIdx = 0; // 0..4
  private graphics: GraphicsSettings;

  // Player state
  private px = 0;
  private py = 0;
  private pz = 4;
  private pvx = 0;
  private pvy = 0;
  private pvz = 0;
  private health = 100;
  private maxHealth = 100;
  private shield = 50;
  private maxShield = 50;
  private boost = 100;
  private maxBoost = 100;
  private specialCharge = 100;
  private maxSpecialCharge = 100;
  private invulnTimer = 0;
  private playerHitFlash = 0;
  private playerDying = false;
  private playerDeathTimer = 0;

  // Roll & Firing
  private rollDir = 0; // -1, 0, 1
  private rollProgress = 0;
  private rollCooldown = 0;
  private fireCooldown = 0;
  private activeWeapon: WeaponId = 'dual_laser';
  private unlockedWeapons: WeaponId[] = ['dual_laser', 'plasma_cannon', 'missile_launcher', 'triple_laser'];

  // Buffs & Scoring
  private rapidFireTimer = 0;
  private damageBoostTimer = 0;
  private phaseInvulnTimer = 0;
  private score = 0;
  private bestScore = 0;
  private combo = 0;
  private comboTimer = 0;
  private kills = 0;
  private damageTaken = 0;

  // Wave / Level Progression
  private wave = 1;
  private waveSpawnQueue: EnemyType[] = [];
  private waveSpawnTimer = 0;
  private waveBreakTimer = 0;
  private bossPending = false;
  private bossWarningTimer = 0;
  private bossWarningText = '';
  private activePowerUpBanner = '';
  private powerUpBannerTimer = 0;

  // Timing & Juice
  private elapsedTime = 0;
  private runTime = 0;
  private timeAttackRemaining = TIME_ATTACK_DURATION;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private damageFlash = 0;
  private ultimateFlash = 0;
  private hudThrottleTimer = 0;
  private lastFrameTime = performance.now();
  private frameId = 0;
  private disposed = false;

  // Input state
  public input: InputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    fire: false,
    boost: false,
    rollLeft: false,
    rollRight: false,
    specialJustPressed: false,
    aimX: 0,
    aimY: 0,
    pointerActive: false,
  };

  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    initialGraphics: GraphicsSettings,
    bestScore: number,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.graphics = { ...initialGraphics };
    this.bestScore = bestScore;
    this.callbacks = callbacks;
    this.audio = new AudioManager();

    this.isSoftwareGl = GameEngine.detectSoftwareGl();

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: this.isSoftwareGl,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setSize(width, height);
    this.applyQualityToRenderer();

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.2, 650);
    this.camera.position.set(0.4, 1.8, 9.6);

    // Studio Reflection Environment (mandatory for PBR metallics)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremEnv = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.pmremEnv;
    pmremGenerator.dispose();

    // 3-Point Space Lighting Rig (Warm Sun Key + Cool Hemisphere Fill + Rim)
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x0f172a, 0.72);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.3);
    keyLight.position.set(45, 55, 35);
    if (!this.isSoftwareGl && this.graphics.quality === 'high') {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 5;
      keyLight.shadow.camera.far = 160;
      const d = 40;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.bias = -0.0005;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x6366f1, 1.15);
    rimLight.position.set(-40, -25, -45);
    this.scene.add(rimLight);

    // Procedural textures & world managers
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);

    const preset = GRAPHICS_PRESETS[this.graphics.quality];
    this.environment = new EnvironmentManager(
      this.scene,
      preset.starCount,
      maxAniso,
      this.textures.glowSprite
    );
    this.environment.applyLevelTheme(LEVELS[0]);

    this.particles = new ParticleSystem(this.scene, preset.particleCap);

    // Player 3D Starfighter
    this.playerRig = createPlayerShipMesh(this.textures, this.isSoftwareGl);
    this.scene.add(this.playerRig.group);

    this.muzzleLight = new THREE.PointLight(0x38bdf8, 0, 14);
    this.scene.add(this.muzzleLight);

    // Pre-allocate Projectile Pool
    this.initProjectilePool();

    // Post-processing (GPU only; skipped on software WebGL)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        preset.bloomStrength,
        0.45,
        0.72
      );
      this.bloomPass.enabled = preset.bloomEnabled;
      this.composer.addPass(this.bloomPass);
    }

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    this.audio.setSettings(this.graphics.musicVolume, this.graphics.sfxVolume, this.graphics.muted);

    this.lastFrameTime = performance.now();
    this.tick();
  }

  private static detectSoftwareGl(): boolean {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      return true;
    }
  }

  private applyQualityToRenderer(): void {
    const preset = GRAPHICS_PRESETS[this.graphics.quality];
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, preset.pixelRatioCap)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && preset.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (this.bloomPass) {
      this.bloomPass.enabled = !this.isSoftwareGl && preset.bloomEnabled;
      this.bloomPass.strength = preset.bloomStrength;
    }
  }

  public updateSettings(settings: GraphicsSettings): void {
    this.graphics = { ...settings };
    this.applyQualityToRenderer();
    this.audio.setSettings(settings.musicVolume, settings.sfxVolume, settings.muted);
  }

  public setBestScore(score: number): void {
    this.bestScore = Math.max(this.bestScore, score);
  }

  private initProjectilePool(): void {
    const laserGeo = new THREE.CylinderGeometry(0.14, 0.14, 3.2, 6);
    laserGeo.rotateX(Math.PI / 2);

    const plasmaGeo = new THREE.SphereGeometry(0.7, 10, 10);
    const missileGeo = new THREE.ConeGeometry(0.32, 1.9, 8);
    missileGeo.rotateX(-Math.PI / 2);
    const ultGeo = new THREE.SphereGeometry(3.2, 16, 16);

    for (let i = 0; i < 140; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(laserGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.projectilePool.push({
        active: false,
        fromPlayer: true,
        kind: 'laser',
        mesh,
        x: 0,
        y: 0,
        z: 0,
        prevX: 0,
        prevY: 0,
        prevZ: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        radius: 0.65,
        damage: 18,
        life: 0,
        homingTargetId: null,
      });
    }
    // Store shared geometries in userData for swap
    this.scene.userData.projGeos = { laserGeo, plasmaGeo, missileGeo, ultGeo };
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
    if (this.isSoftwareGl || !this.composer) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }
  }

  public startNewGame(mode: GameMode, levelNumber = 1): void {
    this.audio.resume();
    this.gameMode = mode;
    this.currentLevelIdx = Math.max(0, Math.min(LEVELS.length - 1, levelNumber - 1));
    this.clearActiveCombatEntities();

    // Reset player
    this.px = 0;
    this.py = 0;
    this.pz = 4;
    this.pvx = 0;
    this.pvy = 0;
    this.pvz = 0;
    this.health = 100;
    this.maxHealth = 100;
    this.shield = 50;
    this.maxShield = 50;
    this.boost = 100;
    this.specialCharge = 100;
    this.invulnTimer = 1.0;
    this.playerHitFlash = 0;
    this.playerDying = false;
    this.playerDeathTimer = 0;
    this.playerRig.group.visible = true;
    this.playerRig.group.position.set(0, 0, 4);
    this.playerRig.group.rotation.set(0, 0, 0);
    this.playerRig.bodyGroup.rotation.set(0, 0, 0);

    this.rollDir = 0;
    this.rollProgress = 0;
    this.rollCooldown = 0;
    this.fireCooldown = 0;
    this.activeWeapon = 'dual_laser';
    this.unlockedWeapons = ['dual_laser', 'plasma_cannon', 'missile_launcher', 'triple_laser'];

    this.rapidFireTimer = 0;
    this.damageBoostTimer = 0;
    this.phaseInvulnTimer = 0;
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.kills = 0;
    this.damageTaken = 0;
    this.runTime = 0;
    this.timeAttackRemaining = TIME_ATTACK_DURATION;
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;
    this.damageFlash = 0;
    this.ultimateFlash = 0;

    this.wave = 1;
    this.bossPending = false;
    this.bossWarningTimer = 0;
    this.bossWarningText = '';
    this.activePowerUpBanner = '';
    this.powerUpBannerTimer = 0;

    const levelCfg = LEVELS[this.currentLevelIdx];
    this.environment.applyLevelTheme(levelCfg);
    this.queueWave(1);

    this.screenState = 'playing';
    this.audio.setPlayingMusic(true, false);
    this.callbacks.onStateChange('playing');
    this.emitHud();
  }

  public setPaused(paused: boolean): void {
    if (this.screenState !== 'playing' && this.screenState !== 'paused') return;
    this.screenState = paused ? 'paused' : 'playing';
    this.audio.setPlayingMusic(!paused, Boolean(this.boss));
    if (paused) {
      this.audio.updateEngine(false, 0, false);
    }
    this.callbacks.onStateChange(this.screenState);
  }

  public returnToTitle(): void {
    this.clearActiveCombatEntities();
    this.screenState = 'title';
    this.px = 0;
    this.py = 0;
    this.pz = 0;
    this.playerRig.group.visible = true;
    this.playerRig.group.position.set(0, 0, 0);
    this.playerRig.group.rotation.set(0, 0, 0);
    this.playerRig.bodyGroup.rotation.set(0, 0, 0);
    this.environment.applyLevelTheme(LEVELS[0]);
    this.audio.setPlayingMusic(false, false);
    this.audio.updateEngine(false, 0, false);
    this.callbacks.onStateChange('title');
  }

  public selectWeapon(id: WeaponId): void {
    if (id === 'ultimate_blast') {
      this.triggerUltimate();
      return;
    }
    if (this.unlockedWeapons.includes(id)) {
      this.activeWeapon = id;
      this.emitHud();
    }
  }

  public triggerBarrelRoll(dir: -1 | 1): void {
    if (this.screenState !== 'playing' || this.playerDying) return;
    if (this.rollCooldown <= 0 && this.rollDir === 0) {
      this.rollDir = dir;
      this.rollProgress = 0;
      this.rollCooldown = 0.75;
      this.invulnTimer = Math.max(this.invulnTimer, 0.38);
      this.audio.playRoll();
    }
  }

  public triggerUltimate(): void {
    if (this.screenState !== 'playing' || this.playerDying) return;
    if (this.specialCharge < this.maxSpecialCharge) return;

    this.specialCharge = 0;
    this.ultimateFlash = 1.0;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.7);
    this.hitstopTimer = 0.055;
    this.audio.playUltimateBlast();

    // Launch massive central Nova Beam projectile
    const spec = WEAPON_SPECS.ultimate_blast;
    this.spawnProjectile({
      fromPlayer: true,
      kind: 'ultimate',
      x: this.px,
      y: this.py,
      z: this.pz - 3.5,
      vx: 0,
      vy: 0,
      vz: -spec.speed,
      radius: spec.projectileRadius,
      damage: spec.damage,
      color: spec.color,
      life: 2.2,
    });
    this.particles.spawnShockwave(this.px, this.py, this.pz - 3, 0x67e8f9, 18, 0.55);
    this.emitHud();
  }

  private clearActiveCombatEntities(): void {
    for (const p of this.projectilePool) {
      p.active = false;
      p.mesh.visible = false;
    }
    for (const e of this.enemies) {
      this.scene.remove(e.group);
      e.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).geometry.dispose();
        }
      });
      e.materials.forEach((m) => m.dispose());
    }
    this.enemies = [];

    for (const pu of this.powerUps) {
      this.scene.remove(pu.group);
      pu.group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          const m = o as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
          else m.material.dispose();
        }
      });
    }
    this.powerUps = [];

    if (this.boss) {
      this.scene.remove(this.boss.rig.group);
      this.scene.remove(this.boss.beamMesh);
      this.scene.remove(this.boss.telegraphMesh);
      this.boss.beamMesh.geometry.dispose();
      (this.boss.beamMesh.material as THREE.Material).dispose();
      this.boss.telegraphMesh.geometry.dispose();
      (this.boss.telegraphMesh.material as THREE.Material).dispose();
      this.boss.rig.dispose();
      this.boss = null;
    }
  }

  private queueWave(waveNum: number): void {
    this.wave = waveNum;
    const levelCfg = LEVELS[this.currentLevelIdx];
    const diff = computeDifficultyScale(this.gameMode, levelCfg.id, waveNum);

    const count =
      this.gameMode === 'campaign'
        ? Math.round(levelCfg.enemiesPerWave + (waveNum - 1) * 2)
        : Math.round(6 + waveNum * 2);

    const pool: EnemyType[] =
      this.gameMode === 'campaign'
        ? levelCfg.enemyTypes
        : waveNum >= 4
          ? ['scout', 'interceptor', 'destroyer', 'stealth', 'bomber']
          : waveNum >= 2
            ? ['scout', 'interceptor', 'bomber']
            : ['scout', 'interceptor'];

    this.waveSpawnQueue = [];
    for (let i = 0; i < count; i++) {
      // Keep opening few enemies accessible
      const chosen = i < 2 && waveNum === 1 ? 'scout' : pool[Math.floor(Math.random() * pool.length)];
      this.waveSpawnQueue.push(chosen);
    }
    this.waveSpawnTimer = 0.05;
    this.waveBreakTimer = 0;

    if (waveNum === 1 && this.waveSpawnQueue.length >= 2) {
      this.spawnEnemy(this.waveSpawnQueue.shift()!, -82);
      this.spawnEnemy(this.waveSpawnQueue.shift()!, -102);
    }

    // Gentle scale check unused var guard
    void diff;
  }

  private spawnEnemy(type: EnemyType, overrideZ?: number): void {
    const spec = ENEMY_SPECS[type];
    const levelCfg = LEVELS[this.currentLevelIdx];
    const scale = computeDifficultyScale(this.gameMode, levelCfg.id, this.wave);

    const { group, materials, coreMesh } = createEnemyShipMesh(type);
    group.scale.setScalar(1.22);
    const x = (Math.random() - 0.5) * (PLAYFIELD_BOUNDS.x * (overrideZ ? 0.9 : 1.6));
    const y = (Math.random() - 0.5) * (PLAYFIELD_BOUNDS.y * (overrideZ ? 0.7 : 1.4));
    const z = overrideZ ?? PLAYFIELD_BOUNDS.spawnZ - Math.random() * 25;

    group.position.set(x, y, z);
    this.scene.add(group);

    this.enemies.push({
      id: this.nextEnemyId++,
      type,
      group,
      materials,
      coreMesh,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: spec.speed * (0.9 + Math.min(0.5, (scale - 1) * 0.3)),
      hp: Math.round(spec.hp * scale),
      maxHp: Math.round(spec.hp * scale),
      radius: spec.radius,
      score: spec.score,
      fireCooldown: 0.9 + Math.random() * spec.fireCooldown,
      age: 0,
      phaseOffset: Math.random() * Math.PI * 2,
      hitFlashTimer: 0,
      dying: false,
      deathTimer: 0,
      spinSpeed: (Math.random() - 0.5) * 8,
    });
  }

  private spawnBoss(type: BossType, name: string): void {
    const rig = createBossMesh(type, this.textures);
    rig.group.position.set(0, 2, -165);
    this.scene.add(rig.group);

    const baseHp = type === 'mothership' ? 2400 : type === 'winged_destroyer' ? 1650 : 1100;
    const levelMult = 1 + this.currentLevelIdx * 0.14;
    const maxHp = Math.round(baseHp * levelMult);

    // Volumetric Laser Beam & Windup Telegraph Cylinder
    const beamGeo = new THREE.CylinderGeometry(1.4, 1.8, 120, 14);
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.translate(0, 0, 60);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.visible = false;
    this.scene.add(beamMesh);

    const teleGeo = new THREE.CylinderGeometry(0.18, 0.18, 120, 8);
    teleGeo.rotateX(Math.PI / 2);
    teleGeo.translate(0, 0, 60);
    const teleMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const telegraphMesh = new THREE.Mesh(teleGeo, teleMat);
    telegraphMesh.visible = false;
    this.scene.add(telegraphMesh);

    this.boss = {
      type,
      name,
      rig,
      x: 0,
      y: 2,
      z: -155,
      hp: maxHp,
      maxHp,
      phase: 1,
      shielded: false,
      shieldCooldown: 9.0,
      fireCooldown: 1.8,
      missileCooldown: 4.5,
      beamState: 'idle',
      beamTimer: 5.5,
      beamMesh,
      telegraphMesh,
      beamAngle: 0,
      hitFlashTimer: 0,
      dying: false,
      deathTimer: 0,
      explosionTick: 0,
    };

    this.bossWarningTimer = 3.2;
    this.bossWarningText = `WARNING: ${name.toUpperCase()} DETECTED`;
    this.audio.playBossWarning();
    this.audio.setPlayingMusic(true, true);
    this.emitHud();
  }

  private spawnProjectile(opts: {
    fromPlayer: boolean;
    kind: ActiveProjectile['kind'];
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    radius: number;
    damage: number;
    color: number;
    life: number;
    homingTargetId?: number | null;
  }): void {
    const geos = this.scene.userData.projGeos as {
      laserGeo: THREE.BufferGeometry;
      plasmaGeo: THREE.BufferGeometry;
      missileGeo: THREE.BufferGeometry;
      ultGeo: THREE.BufferGeometry;
    };

    for (let i = 0; i < this.projectilePool.length; i++) {
      const p = this.projectilePool[i];
      if (!p.active) {
        p.active = true;
        p.fromPlayer = opts.fromPlayer;
        p.kind = opts.kind;
        p.x = opts.x;
        p.y = opts.y;
        p.z = opts.z;
        p.prevX = opts.x;
        p.prevY = opts.y;
        p.prevZ = opts.z;
        p.vx = opts.vx;
        p.vy = opts.vy;
        p.vz = opts.vz;
        p.radius = opts.radius;
        p.damage = opts.damage;
        p.life = opts.life;
        p.homingTargetId = opts.homingTargetId ?? null;

        if (opts.kind === 'plasma' || opts.kind === 'mine') {
          p.mesh.geometry = geos.plasmaGeo;
          p.mesh.scale.setScalar(opts.kind === 'mine' ? 1.4 : 1.15);
        } else if (opts.kind === 'missile' || opts.kind === 'enemy_missile') {
          p.mesh.geometry = geos.missileGeo;
          p.mesh.scale.setScalar(1.2);
        } else if (opts.kind === 'ultimate') {
          p.mesh.geometry = geos.ultGeo;
          p.mesh.scale.setScalar(1.4);
        } else {
          p.mesh.geometry = geos.laserGeo;
          p.mesh.scale.set(1, 1, opts.fromPlayer ? 1.3 : 1.0);
        }

        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(opts.color);
        p.mesh.position.set(opts.x, opts.y, opts.z);
        p.mesh.visible = true;
        return;
      }
    }
  }

  private spawnPowerUp(x: number, y: number, z: number, forceType?: PowerUpType): void {
    const types: PowerUpType[] = [
      'health',
      'shield',
      'rapid_fire',
      'triple_laser',
      'missile_upgrade',
      'damage_boost',
      'invincibility',
      'special_charge',
    ];
    const type = forceType ?? types[Math.floor(Math.random() * types.length)];
    const spec = POWERUP_SPECS[type];

    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.95, 0),
      new THREE.MeshStandardMaterial({
        color: spec.color,
        emissive: spec.color,
        emissiveIntensity: 1.6,
        roughness: 0.2,
        metalness: 0.3,
      })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.12, 8, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
      })
    );
    group.add(core);
    group.add(ring);
    group.position.set(x, y, z);
    this.scene.add(group);

    this.powerUps.push({
      active: true,
      type,
      group,
      x,
      y,
      z,
      age: 0,
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastFrameTime) / 1000;
    this.lastFrameTime = now;
    const dt = clampDeltaTime(rawDt);

    if (this.screenState !== 'paused') {
      this.elapsedTime += dt;
    }

    if (this.screenState === 'title') {
      this.updateTitleShowcase(dt);
    } else if (this.screenState === 'playing') {
      this.updateGameplay(dt);
    } else if (this.screenState === 'gameover') {
      this.particles.update(dt);
      this.environment.update(dt, this.elapsedTime, 0.45);
    }

    if (this.isSoftwareGl || !this.composer) {
      this.renderer.render(this.scene, this.camera);
    } else {
      this.composer.render();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 75);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 75);
    }
  }

  private updateTitleShowcase(dt: number): void {
    this.environment.update(dt, this.elapsedTime, 0.65);
    this.particles.update(dt);

    // Heroic hover & banking of the player starfighter in right-center showcase zone
    const hoverY = Math.sin(this.elapsedTime * 1.4) * 0.38;
    const bankZ = -0.18 + Math.sin(this.elapsedTime * 0.85) * 0.14;
    this.playerRig.group.position.set(2.8, hoverY - 0.2, 0);
    this.playerRig.group.rotation.set(0.08 + Math.sin(this.elapsedTime * 0.7) * 0.05, -0.52, bankZ);
    this.playerRig.shieldMesh.visible = false;

    // Exhaust flicker
    const pulse = 1.05 + Math.sin(this.elapsedTime * 28) * 0.2;
    this.playerRig.leftFlame.scale.set(1, 1, pulse);
    this.playerRig.rightFlame.scale.set(1, 1, pulse);

    // Smooth camera framing ship on right half so left negative space holds title lockup
    const camAngle = Math.sin(this.elapsedTime * 0.3) * 0.28;
    _camTarget.set(0.4 + Math.sin(camAngle) * 1.6, 1.85 + Math.cos(this.elapsedTime * 0.45) * 0.35, 9.6);
    this.camera.position.lerp(_camTarget, 1 - Math.exp(-3.5 * dt));
    _camLookTarget.set(0.7, 0.05, -4.0);
    this.camera.lookAt(_camLookTarget);
  }

  private updateGameplay(dt: number): void {
    // Hitstop freeze for heavy impacts while camera shake & flashes still decay
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateCamera(dt);
      this.particles.update(dt * 0.35);
      return;
    }

    this.runTime += dt;
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - dt * 28);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 2.8);
    this.ultimateFlash = Math.max(0, this.ultimateFlash - dt * 1.9);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    if (this.rapidFireTimer > 0) this.rapidFireTimer = Math.max(0, this.rapidFireTimer - dt);
    if (this.damageBoostTimer > 0) this.damageBoostTimer = Math.max(0, this.damageBoostTimer - dt);
    if (this.phaseInvulnTimer > 0) this.phaseInvulnTimer = Math.max(0, this.phaseInvulnTimer - dt);
    if (this.bossWarningTimer > 0) {
      this.bossWarningTimer = Math.max(0, this.bossWarningTimer - dt);
      if (this.bossWarningTimer === 0) this.bossWarningText = '';
    }
    if (this.powerUpBannerTimer > 0) {
      this.powerUpBannerTimer = Math.max(0, this.powerUpBannerTimer - dt);
      if (this.powerUpBannerTimer === 0) this.activePowerUpBanner = '';
    }

    // Time Attack timer
    if (this.gameMode === 'time_attack') {
      this.timeAttackRemaining = Math.max(0, this.timeAttackRemaining - dt);
      if (this.timeAttackRemaining <= 0) {
        this.finishRun(true);
        return;
      }
    }

    const boosting = this.input.boost && this.boost > 2 && !this.playerDying;
    const speedMult = boosting ? 1.75 : 1.0;

    this.environment.update(dt, this.elapsedTime, speedMult);
    this.particles.update(dt);

    if (this.playerDying) {
      this.playerDeathTimer -= dt;
      this.playerRig.bodyGroup.rotation.z += dt * 9;
      this.playerRig.bodyGroup.rotation.x += dt * 4;
      if (Math.random() < 0.45) {
        this.particles.spawnBurst(this.px, this.py, this.pz, 6, 0xf97316, 12, 0.9, 0.45);
      }
      this.updateCamera(dt);
      if (this.playerDeathTimer <= 0) {
        this.finishRun(false);
      }
      return;
    }

    this.updatePlayer(dt, boosting);
    this.updateWaveAndBossSpawner(dt);
    this.updateEnemies(dt);
    this.updateBoss(dt);
    this.updateProjectiles(dt);
    this.updatePowerUps(dt);
    this.checkAsteroidCollisions();
    this.updateCamera(dt);

    // Throttled HUD updates (~15Hz)
    this.hudThrottleTimer += dt;
    if (this.hudThrottleTimer >= 0.065) {
      this.hudThrottleTimer = 0;
      this.emitHud();
    }
  }

  private updatePlayer(dt: number, boosting: boolean): void {
    // Energy regeneration
    if (boosting) {
      this.boost = Math.max(0, this.boost - 34 * dt);
    } else {
      this.boost = Math.min(this.maxBoost, this.boost + 18 * dt);
    }
    this.specialCharge = Math.min(this.maxSpecialCharge, this.specialCharge + 4.5 * dt);
    if (this.shield < this.maxShield && this.invulnTimer <= 0) {
      this.shield = Math.min(this.maxShield, this.shield + 2.2 * dt);
    }
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    // Barrel roll input
    if (this.rollCooldown > 0) this.rollCooldown = Math.max(0, this.rollCooldown - dt);
    if (this.input.rollLeft) this.triggerBarrelRoll(-1);
    if (this.input.rollRight) this.triggerBarrelRoll(1);

    if (this.input.specialJustPressed) {
      this.input.specialJustPressed = false;
      this.triggerUltimate();
    }

    // Flight velocity & bounds
    const accel = boosting ? 125 : 88;
    const maxSpeed = boosting ? 48 : 34;

    const moveX = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const moveY = (this.input.up ? 1 : 0) - (this.input.down ? 1 : 0);
    const moveZ = (this.input.backward ? 1 : 0) - (this.input.forward ? 1 : 0);

    // Optional subtle mouse-aim steering when pointer is active and mouseAim enabled
    let aimSteerX = 0;
    let aimSteerY = 0;
    if (this.graphics.mouseAim && this.input.pointerActive) {
      aimSteerX = this.input.aimX * 0.45;
      aimSteerY = this.input.aimY * 0.45;
    }

    const rollBoostX = this.rollDir !== 0 ? this.rollDir * 24 : 0;

    this.pvx += (moveX + aimSteerX) * accel * dt + rollBoostX * dt * 3;
    this.pvy += (moveY + aimSteerY) * accel * dt;
    this.pvz += moveZ * accel * 0.8 * dt;

    // Exponential damping
    const damp = Math.exp(-5.8 * dt);
    this.pvx *= damp;
    this.pvy *= damp;
    this.pvz *= damp;

    this.pvx = THREE.MathUtils.clamp(this.pvx, -maxSpeed, maxSpeed);
    this.pvy = THREE.MathUtils.clamp(this.pvy, -maxSpeed * 0.85, maxSpeed * 0.85);
    this.pvz = THREE.MathUtils.clamp(this.pvz, -24, 24);

    this.px = THREE.MathUtils.clamp(this.px + this.pvx * dt, -PLAYFIELD_BOUNDS.x, PLAYFIELD_BOUNDS.x);
    this.py = THREE.MathUtils.clamp(this.py + this.pvy * dt, -PLAYFIELD_BOUNDS.y, PLAYFIELD_BOUNDS.y);
    this.pz = THREE.MathUtils.clamp(
      this.pz + this.pvz * dt,
      PLAYFIELD_BOUNDS.zMin,
      PLAYFIELD_BOUNDS.zMax
    );

    this.playerRig.group.position.set(this.px, this.py, this.pz);

    // Ship banking, pitch, and barrel roll animation
    let rollAngle = -this.pvx * 0.022;
    if (this.rollDir !== 0) {
      this.rollProgress += dt * 2.8;
      if (this.rollProgress >= 1) {
        this.rollDir = 0;
        this.rollProgress = 0;
      } else {
        rollAngle += -this.rollDir * this.rollProgress * Math.PI * 2;
      }
    }
    const targetPitch = this.pvy * 0.016;
    const targetYaw = -this.pvx * 0.008 - (this.graphics.mouseAim && this.input.pointerActive ? this.input.aimX * 0.18 : 0);

    this.playerRig.bodyGroup.rotation.z = THREE.MathUtils.damp(
      this.playerRig.bodyGroup.rotation.z,
      rollAngle,
      11,
      dt
    );
    this.playerRig.bodyGroup.rotation.x = THREE.MathUtils.damp(
      this.playerRig.bodyGroup.rotation.x,
      targetPitch,
      10,
      dt
    );
    this.playerRig.bodyGroup.rotation.y = THREE.MathUtils.damp(
      this.playerRig.bodyGroup.rotation.y,
      targetYaw,
      10,
      dt
    );

    // Exhaust flames & trail particles
    const flameLen = boosting ? 1.9 + Math.random() * 0.45 : 0.95 + Math.random() * 0.25;
    this.playerRig.leftFlame.scale.set(boosting ? 1.3 : 1, boosting ? 1.3 : 1, flameLen);
    this.playerRig.rightFlame.scale.set(boosting ? 1.3 : 1, boosting ? 1.3 : 1, flameLen);

    if (Math.random() < (boosting ? 0.9 : 0.45)) {
      this.particles.spawnTrail(
        this.px - 0.62,
        this.py,
        this.pz + 2.6,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        14,
        boosting ? 0x67e8f9 : 0x38bdf8,
        boosting ? 0.52 : 0.32,
        0.24
      );
      this.particles.spawnTrail(
        this.px + 0.62,
        this.py,
        this.pz + 2.6,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        14,
        boosting ? 0x67e8f9 : 0x38bdf8,
        boosting ? 0.52 : 0.32,
        0.24
      );
    }

    // Shield visibility & Fresnel animation (flash only on impact, roll, or phase invulnerability)
    const shieldVisible =
      this.phaseInvulnTimer > 0 || (this.shield > 0 && (this.invulnTimer > 0 || this.rollDir !== 0));
    this.playerRig.shieldMesh.visible = shieldVisible;
    if (shieldVisible) {
      this.playerRig.shieldMat.uniforms.uTime.value = this.elapsedTime;
      const targetOpacity =
        this.phaseInvulnTimer > 0 ? 0.82 : this.invulnTimer > 0 ? Math.min(0.7, this.invulnTimer * 1.4) : 0.45;
      this.playerRig.shieldMat.uniforms.uOpacity.value = targetOpacity;
      this.playerRig.shieldMat.uniforms.uColor.value.setHex(
        this.phaseInvulnTimer > 0 ? 0xfef08a : 0x38bdf8
      );
    }

    // Hit flash recovery
    if (this.playerHitFlash > 0) {
      this.playerHitFlash = Math.max(0, this.playerHitFlash - dt * 5);
      this.playerRig.hullMaterials[0].emissive.setHex(0xef4444);
      this.playerRig.hullMaterials[0].emissiveIntensity = this.playerHitFlash * 1.8;
    } else {
      this.playerRig.hullMaterials[0].emissiveIntensity = 0;
    }

    // Update engine audio
    const speedRatio = Math.hypot(this.pvx, this.pvy, this.pvz) / 36;
    this.audio.updateEngine(true, speedRatio, boosting);

    // Weapon firing
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.input.fire && this.fireCooldown <= 0) {
      this.firePlayerWeapon();
    }
  }

  private firePlayerWeapon(): void {
    const spec = getEffectiveWeaponStats(
      this.activeWeapon,
      this.rapidFireTimer > 0,
      this.damageBoostTimer > 0
    );
    this.fireCooldown = spec.cooldown;

    // Calculate slight aim direction vector
    const aimOffsetX = this.graphics.mouseAim && this.input.pointerActive ? this.input.aimX * 26 : 0;
    const aimOffsetY = this.graphics.mouseAim && this.input.pointerActive ? this.input.aimY * 18 : 0;

    this.playerRig.leftMuzzle.getWorldPosition(_v1);
    this.playerRig.rightMuzzle.getWorldPosition(_v2);
    this.playerRig.centerMuzzle.getWorldPosition(_v3);

    this.muzzleLight.position.copy(_v3);
    this.muzzleLight.color.setHex(spec.color);
    this.muzzleLight.intensity = 4.2;

    if (spec.id === 'dual_laser') {
      this.audio.playLaser('dual');
      this.spawnProjectile({
        fromPlayer: true,
        kind: 'laser',
        x: _v1.x,
        y: _v1.y,
        z: _v1.z,
        vx: aimOffsetX,
        vy: aimOffsetY,
        vz: -spec.speed,
        radius: spec.projectileRadius,
        damage: spec.damage,
        color: spec.color,
        life: 1.5,
      });
      this.spawnProjectile({
        fromPlayer: true,
        kind: 'laser',
        x: _v2.x,
        y: _v2.y,
        z: _v2.z,
        vx: aimOffsetX,
        vy: aimOffsetY,
        vz: -spec.speed,
        radius: spec.projectileRadius,
        damage: spec.damage,
        color: spec.color,
        life: 1.5,
      });
    } else if (spec.id === 'triple_laser') {
      this.audio.playLaser('triple');
      for (const spread of [-14, 0, 14]) {
        const startX = spread === 0 ? _v3.x : spread < 0 ? _v1.x : _v2.x;
        const startY = spread === 0 ? _v3.y : _v1.y;
        const startZ = spread === 0 ? _v3.z : _v1.z;
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'laser',
          x: startX,
          y: startY,
          z: startZ,
          vx: aimOffsetX + spread,
          vy: aimOffsetY,
          vz: -spec.speed,
          radius: spec.projectileRadius,
          damage: spec.damage,
          color: spec.color,
          life: 1.4,
        });
      }
    } else if (spec.id === 'plasma_cannon') {
      this.audio.playLaser('plasma');
      this.spawnProjectile({
        fromPlayer: true,
        kind: 'plasma',
        x: _v3.x,
        y: _v3.y,
        z: _v3.z,
        vx: aimOffsetX * 0.85,
        vy: aimOffsetY * 0.85,
        vz: -spec.speed,
        radius: spec.projectileRadius,
        damage: spec.damage,
        color: spec.color,
        life: 1.8,
      });
    } else if (spec.id === 'missile_launcher') {
      this.audio.playMissileLaunch();
      // Acquire nearest living enemy or boss
      let targetId: number | null = null;
      let bestDist = Infinity;
      for (const e of this.enemies) {
        if (e.dying) continue;
        const d = Math.hypot(e.x - this.px, e.y - this.py, e.z - this.pz);
        if (d < bestDist) {
          bestDist = d;
          targetId = e.id;
        }
      }
      for (const sx of [-1.8, 1.8]) {
        this.spawnProjectile({
          fromPlayer: true,
          kind: 'missile',
          x: this.px + sx,
          y: this.py - 0.3,
          z: this.pz - 1.5,
          vx: sx * 4 + aimOffsetX * 0.4,
          vy: aimOffsetY * 0.4,
          vz: -spec.speed,
          radius: spec.projectileRadius,
          damage: spec.damage,
          color: spec.color,
          life: 2.6,
          homingTargetId: targetId,
        });
      }
    }
  }

  private updateWaveAndBossSpawner(dt: number): void {
    if (this.bossPending && !this.boss) {
      this.bossWarningTimer -= dt;
      if (this.bossWarningTimer <= 0) {
        this.bossPending = false;
        const lvl = LEVELS[this.currentLevelIdx];
        if (lvl.bossType) {
          this.spawnBoss(lvl.bossType, lvl.bossName);
        }
      }
      return;
    }

    if (this.boss) return;

    if (this.waveSpawnQueue.length > 0) {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0) {
        const nextType = this.waveSpawnQueue.shift()!;
        this.spawnEnemy(nextType);
        this.waveSpawnTimer = Math.max(0.45, 1.05 - this.wave * 0.08);
      }
      return;
    }

    // Wave cleared?
    const livingEnemies = this.enemies.filter((e) => !e.dying).length;
    if (livingEnemies === 0) {
      this.waveBreakTimer += dt;
      if (this.waveBreakTimer >= 1.2) {
        const levelCfg = LEVELS[this.currentLevelIdx];
        if (this.gameMode === 'campaign' && this.wave >= levelCfg.wavesCount) {
          if (levelCfg.bossType) {
            this.bossPending = true;
            this.bossWarningTimer = 1.6;
            this.bossWarningText = `ALERT: ${levelCfg.bossName.toUpperCase()} APPROACHING`;
            this.audio.playBossWarning();
          } else {
            this.finishRun(true);
          }
        } else {
          this.queueWave(this.wave + 1);
        }
      }
    }
  }

  private updateEnemies(dt: number): void {
    // Crowd attack token pool (max 3 simultaneous attackers)
    let attackersThisFrame = 0;
    const maxAttackers = 3;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.age += dt;

      if (e.dying) {
        e.deathTimer -= dt;
        e.group.rotation.z += e.spinSpeed * dt;
        e.group.rotation.x += dt * 4;
        e.group.scale.setScalar(Math.max(0.01, e.deathTimer / 0.35));
        if (e.deathTimer <= 0) {
          this.scene.remove(e.group);
          e.materials.forEach((m) => m.dispose());
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (e.hitFlashTimer > 0) {
        e.hitFlashTimer = Math.max(0, e.hitFlashTimer - dt);
        e.materials[0].emissive.setHex(0xffffff);
        e.materials[0].emissiveIntensity = e.hitFlashTimer > 0 ? 1.8 : 0;
      } else {
        e.materials[0].emissiveIntensity = 0;
      }

      // 5 genuinely distinct enemy movement & behavior policies
      if (e.type === 'scout') {
        // Policy 1: Fast sine-wave weaver advancing steadily
        e.x += Math.sin(e.age * 3.4 + e.phaseOffset) * 18 * dt;
        e.y += Math.cos(e.age * 2.5 + e.phaseOffset) * 10 * dt;
        e.z += e.vz * dt;
        e.group.rotation.z = -Math.sin(e.age * 3.4 + e.phaseOffset) * 0.45;
      } else if (e.type === 'interceptor') {
        // Policy 2: Hunter tracking player XY with evasive barrel jinks
        const dx = this.px - e.x;
        const dy = this.py - e.y;
        e.x += THREE.MathUtils.clamp(dx * 1.4, -22, 22) * dt + Math.sin(e.age * 6) * 5 * dt;
        e.y += THREE.MathUtils.clamp(dy * 1.4, -14, 14) * dt;
        e.z += (e.z < -42 ? e.vz : e.vz * 0.45) * dt;
        e.group.rotation.z = -THREE.MathUtils.clamp(dx * 0.04, -0.6, 0.6);
      } else if (e.type === 'destroyer') {
        // Policy 3: Slow armored gunship holding firing line at z = -55..-35
        const targetZ = -48 + Math.sin(e.phaseOffset) * 10;
        if (e.z < targetZ) {
          e.z += e.vz * dt;
        } else {
          e.x += Math.sin(e.age * 0.8 + e.phaseOffset) * 9 * dt;
        }
      } else if (e.type === 'stealth') {
        // Policy 4: Flanker with cloak shimmer & lateral dashes
        const cloakAlpha = 0.22 + 0.78 * Math.pow(Math.sin(e.age * 2.4 + e.phaseOffset), 2);
        e.materials.forEach((m) => {
          m.opacity = cloakAlpha;
        });
        e.x += Math.cos(e.age * 2.8 + e.phaseOffset) * 24 * dt;
        e.y += Math.sin(e.age * 3.2) * 12 * dt;
        e.z += e.vz * 0.9 * dt;
        e.group.rotation.z = Math.sin(e.age * 2.8) * 0.6;
      } else {
        // Policy 5: Alien Bomber - broad sweeping arc dropping mines/missiles
        e.x += Math.sin(e.age * 1.2 + e.phaseOffset) * 14 * dt;
        e.y += Math.cos(e.age * 1.5) * 6 * dt;
        e.z += (e.z < -38 ? e.vz : e.vz * 0.55) * dt;
      }

      e.x = THREE.MathUtils.clamp(e.x, -PLAYFIELD_BOUNDS.x * 1.1, PLAYFIELD_BOUNDS.x * 1.1);
      e.y = THREE.MathUtils.clamp(e.y, -PLAYFIELD_BOUNDS.y * 1.05, PLAYFIELD_BOUNDS.y * 1.05);
      e.group.position.set(e.x, e.y, e.z);
      e.coreMesh.rotation.y += dt * 3;

      // Enemy Attack Logic (respecting token pool & player distance)
      e.fireCooldown -= dt;
      if (e.fireCooldown <= 0 && e.z > -150 && e.z < this.pz - 12 && attackersThisFrame < maxAttackers) {
        attackersThisFrame++;
        const spec = ENEMY_SPECS[e.type];
        e.fireCooldown = spec.fireCooldown * (0.85 + Math.random() * 0.4);
        this.fireEnemyAttack(e);
      }

      // Ship-to-ship collision with player
      if (sphereCollision(e.x, e.y, e.z, e.radius, this.px, this.py, this.pz, 2.0)) {
        this.damagePlayer(22);
        this.damageEnemy(e, e.hp + 10);
        continue;
      }

      // Past player
      if (e.z > PLAYFIELD_BOUNDS.despawnZ) {
        if (this.gameMode === 'campaign') {
          // Respawn behind in wave rather than softlocking wave clear
          e.z = -155 - Math.random() * 20;
          e.x = (Math.random() - 0.5) * 45;
        } else {
          this.scene.remove(e.group);
          e.materials.forEach((m) => m.dispose());
          this.enemies.splice(i, 1);
        }
      }
    }
  }

  private fireEnemyAttack(e: ActiveEnemy): void {
    const spec = ENEMY_SPECS[e.type];
    const dx = this.px - e.x;
    const dy = this.py - e.y;
    const dz = this.pz - e.z;
    const dist = Math.max(1, Math.hypot(dx, dy, dz));
    const speed = spec.projectileSpeed;

    if (e.type === 'bomber') {
      // Drop proximity mine / slow plasma orb
      this.spawnProjectile({
        fromPlayer: false,
        kind: 'mine',
        x: e.x,
        y: e.y - 0.8,
        z: e.z + 1.5,
        vx: (dx / dist) * 14,
        vy: (dy / dist) * 14,
        vz: 24,
        radius: 1.5,
        damage: spec.projectileDamage,
        color: 0xa3e635,
        life: 5.5,
      });
      this.audio.playLaser('enemy');
    } else if (e.type === 'destroyer') {
      // Twin heavy bolts
      for (const sx of [-2.2, 2.2]) {
        this.spawnProjectile({
          fromPlayer: false,
          kind: 'enemy_laser',
          x: e.x + sx,
          y: e.y,
          z: e.z + 3,
          vx: (dx / dist) * speed * 0.85,
          vy: (dy / dist) * speed * 0.85,
          vz: (dz / dist) * speed,
          radius: 0.9,
          damage: spec.projectileDamage,
          color: 0xef4444,
          life: 3.4,
        });
      }
      this.audio.playLaser('enemy');
    } else {
      this.spawnProjectile({
        fromPlayer: false,
        kind: 'enemy_laser',
        x: e.x,
        y: e.y,
        z: e.z + 1.8,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        vz: (dz / dist) * speed,
        radius: 0.75,
        damage: spec.projectileDamage,
        color: spec.color,
        life: 3.2,
      });
      this.audio.playLaser('enemy');
    }
  }

  private updateBoss(dt: number): void {
    const b = this.boss;
    if (!b) return;

    if (b.dying) {
      b.deathTimer -= dt;
      b.explosionTick -= dt;
      if (b.explosionTick <= 0) {
        b.explosionTick = 0.16;
        const ox = (Math.random() - 0.5) * 20;
        const oy = (Math.random() - 0.5) * 10;
        const oz = (Math.random() - 0.5) * 12;
        this.particles.spawnBurst(b.x + ox, b.y + oy, b.z + oz, 22, 0xf97316, 26, 1.4, 0.7);
        this.particles.spawnShockwave(b.x + ox, b.y + oy, b.z + oz, 0xfacc15, 16, 0.45);
        this.audio.playExplosion('large');
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
      }
      b.rig.group.rotation.z += dt * 0.45;
      b.rig.group.rotation.x += dt * 0.25;
      if (b.deathTimer <= 0) {
        this.particles.spawnBurst(b.x, b.y, b.z, 65, 0x67e8f9, 36, 1.8, 0.9);
        this.particles.spawnShockwave(b.x, b.y, b.z, 0x38bdf8, 34, 0.75);
        this.audio.playExplosion('boss');
        this.score += calculateKillScore(2500, this.combo, LEVELS[this.currentLevelIdx].id);
        this.kills += 1;
        this.scene.remove(b.rig.group);
        this.scene.remove(b.beamMesh);
        this.scene.remove(b.telegraphMesh);
        b.rig.dispose();
        this.boss = null;
        this.finishRun(true);
      }
      return;
    }

    // Approach target engagement distance
    const targetZ = -68;
    if (b.z < targetZ) {
      b.z = THREE.MathUtils.damp(b.z, targetZ, 2.2, dt);
    } else {
      const swaySpeed = b.phase === 3 ? 1.35 : b.phase === 2 ? 0.95 : 0.65;
      b.x = Math.sin(this.elapsedTime * swaySpeed) * 18;
      b.y = 2.5 + Math.cos(this.elapsedTime * swaySpeed * 1.3) * 5.5;
    }

    b.rig.group.position.set(b.x, b.y, b.z);
    b.rig.coreMesh.rotation.y += dt * 2.4;
    b.rig.coreMesh.rotation.x += dt * 1.4;
    if (b.rig.outerRing) {
      b.rig.outerRing.rotation.z += dt * (b.phase === 3 ? 1.4 : 0.65);
    }

    // Rotate turrets toward player
    for (const turret of b.rig.turrets) {
      turret.lookAt(this.px, this.py, this.pz);
    }

    // Rotate active weakpoint rings
    for (const wp of b.rig.weakPoints) {
      if (!wp.destroyed) {
        wp.ring.rotation.z += dt * 3;
        wp.ring.rotation.x += dt * 1.5;
      }
    }

    // Hit flash decay
    if (b.hitFlashTimer > 0) {
      b.hitFlashTimer = Math.max(0, b.hitFlashTimer - dt);
      b.rig.hullMaterials[0].emissive.setHex(0xffffff);
      b.rig.hullMaterials[0].emissiveIntensity = b.hitFlashTimer > 0 ? 0.9 : 0;
    } else {
      b.rig.hullMaterials[0].emissiveIntensity = 0;
    }

    // Phase updates
    const newPhase = computeBossPhase(b.hp, b.maxHp);
    if (newPhase !== b.phase) {
      b.phase = newPhase;
      b.shielded = true;
      b.shieldCooldown = 4.5;
      this.bossWarningTimer = 2.5;
      this.bossWarningText = `${b.name.toUpperCase()} — PHASE ${newPhase} OVERDRIVE`;
      this.particles.spawnShockwave(b.x, b.y, b.z, 0xf43f5e, 24, 0.6);
      this.audio.playBossWarning();
    }

    // Shield cycling
    if (b.shielded) {
      b.shieldCooldown -= dt;
      b.rig.shieldMesh.visible = true;
      b.rig.shieldMat.uniforms.uTime.value = this.elapsedTime;
      b.rig.shieldMat.uniforms.uOpacity.value = 0.62;
      if (b.shieldCooldown <= 0) {
        b.shielded = false;
        b.shieldCooldown = 11.0;
      }
    } else {
      b.rig.shieldMesh.visible = false;
      b.shieldCooldown -= dt;
      if (b.shieldCooldown <= 0 && b.phase >= 2) {
        b.shielded = true;
        b.shieldCooldown = 4.0;
      }
    }

    // Turret laser volleys
    b.fireCooldown -= dt;
    if (b.fireCooldown <= 0 && b.z > -85) {
      b.fireCooldown = b.phase === 3 ? 0.95 : b.phase === 2 ? 1.3 : 1.7;
      for (let t = 0; t < b.rig.turrets.length; t++) {
        if (b.phase === 1 && t % 2 === 1) continue;
        b.rig.turrets[t].getWorldPosition(_v1);
        const dx = this.px - _v1.x + (Math.random() - 0.5) * 6;
        const dy = this.py - _v1.y + (Math.random() - 0.5) * 4;
        const dz = this.pz - _v1.z;
        const d = Math.max(1, Math.hypot(dx, dy, dz));
        const spd = 62;
        this.spawnProjectile({
          fromPlayer: false,
          kind: 'enemy_laser',
          x: _v1.x,
          y: _v1.y,
          z: _v1.z,
          vx: (dx / d) * spd,
          vy: (dy / d) * spd,
          vz: (dz / d) * spd,
          radius: 0.95,
          damage: 14,
          color: 0xf43f5e,
          life: 3.2,
        });
      }
      this.audio.playLaser('enemy');
    }

    // Homing Missile Salvo
    b.missileCooldown -= dt;
    if (b.missileCooldown <= 0 && b.z > -85) {
      b.missileCooldown = b.phase === 3 ? 3.2 : 5.0;
      const count = b.phase === 3 ? 3 : 2;
      for (let m = 0; m < count; m++) {
        this.spawnProjectile({
          fromPlayer: false,
          kind: 'enemy_missile',
          x: b.x + (m - (count - 1) / 2) * 8,
          y: b.y + 3,
          z: b.z + 5,
          vx: (m - (count - 1) / 2) * 10,
          vy: 6,
          vz: 36,
          radius: 1.15,
          damage: 18,
          color: 0xf59e0b,
          life: 4.2,
        });
      }
      this.audio.playMissileLaunch();
    }

    // Sweeping Energy Beam Attack with 0.65s Windup Telegraph
    b.beamTimer -= dt;
    b.rig.beamMuzzle.getWorldPosition(_v1);
    if (b.beamState === 'idle') {
      b.beamMesh.visible = false;
      b.telegraphMesh.visible = false;
      if (b.beamTimer <= 0 && b.z > -85) {
        b.beamState = 'telegraph';
        b.beamTimer = 0.7;
        b.beamAngle = Math.atan2(this.px - _v1.x, this.pz - _v1.z);
        this.audio.playBossWarning();
      }
    } else if (b.beamState === 'telegraph') {
      b.telegraphMesh.visible = true;
      b.telegraphMesh.position.copy(_v1);
      b.telegraphMesh.rotation.set(0, b.beamAngle, 0);
      if (b.beamTimer <= 0) {
        b.beamState = 'firing';
        b.beamTimer = 1.45;
        b.telegraphMesh.visible = false;
        this.audio.playUltimateBlast();
      }
    } else if (b.beamState === 'firing') {
      b.beamMesh.visible = true;
      b.beamMesh.position.copy(_v1);
      b.beamAngle += (this.px > _v1.x ? 1 : -1) * 0.28 * dt;
      b.beamMesh.rotation.set(0, b.beamAngle, 0);

      // Beam collision vs player along beam ray
      const bx2 = _v1.x + Math.sin(b.beamAngle) * 120;
      const bz2 = _v1.z + Math.cos(b.beamAngle) * 120;
      if (
        segmentSphereCollision(_v1.x, _v1.y, _v1.z, bx2, _v1.y, bz2, this.px, this.py, this.pz, 2.9)
      ) {
        this.damagePlayer(18);
      }

      if (b.beamTimer <= 0) {
        b.beamState = 'idle';
        b.beamMesh.visible = false;
        b.beamTimer = b.phase === 3 ? 4.2 : 6.2;
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = 0; i < this.projectilePool.length; i++) {
      const p = this.projectilePool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        continue;
      }

      p.prevX = p.x;
      p.prevY = p.y;
      p.prevZ = p.z;

      // Homing behavior for player missiles
      if (p.fromPlayer && p.kind === 'missile') {
        let tx = 0;
        let ty = 0;
        let tz = -150;
        let hasTarget = false;

        if (p.homingTargetId !== null) {
          const found = this.enemies.find((e) => e.id === p.homingTargetId && !e.dying);
          if (found) {
            tx = found.x;
            ty = found.y;
            tz = found.z;
            hasTarget = true;
          }
        }
        if (!hasTarget && this.boss && !this.boss.dying) {
          tx = this.boss.x;
          ty = this.boss.y;
          tz = this.boss.z;
          hasTarget = true;
        }
        if (hasTarget) {
          const dx = tx - p.x;
          const dy = ty - p.y;
          const dz = tz - p.z;
          const dist = Math.max(0.1, Math.hypot(dx, dy, dz));
          const spd = 108;
          p.vx = THREE.MathUtils.lerp(p.vx, (dx / dist) * spd, dt * 6.5);
          p.vy = THREE.MathUtils.lerp(p.vy, (dy / dist) * spd, dt * 6.5);
          p.vz = THREE.MathUtils.lerp(p.vz, (dz / dist) * spd, dt * 6.5);
        }
        if (Math.random() < 0.75) {
          this.particles.spawnTrail(p.x, p.y, p.z + 0.8, 0, 0, 8, 0xfbbf24, 0.36, 0.25);
        }
      }

      // Homing behavior for enemy missiles
      if (!p.fromPlayer && p.kind === 'enemy_missile') {
        const dx = this.px - p.x;
        const dy = this.py - p.y;
        const dz = this.pz - p.z;
        const dist = Math.max(0.1, Math.hypot(dx, dy, dz));
        const spd = 48;
        p.vx = THREE.MathUtils.lerp(p.vx, (dx / dist) * spd, dt * 2.3);
        p.vy = THREE.MathUtils.lerp(p.vy, (dy / dist) * spd, dt * 2.3);
        p.vz = THREE.MathUtils.lerp(p.vz, (dz / dist) * spd, dt * 2.3);
        if (Math.random() < 0.65) {
          this.particles.spawnTrail(p.x, p.y, p.z - 0.8, 0, 0, -6, 0xf97316, 0.35, 0.22);
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);

      if (p.fromPlayer) {
        let consumed = false;

        // Check enemies
        for (let ei = 0; ei < this.enemies.length; ei++) {
          const e = this.enemies[ei];
          if (e.dying) continue;
          if (
            segmentSphereCollision(
              p.prevX,
              p.prevY,
              p.prevZ,
              p.x,
              p.y,
              p.z,
              e.x,
              e.y,
              e.z,
              e.radius + p.radius
            )
          ) {
            this.damageEnemy(e, p.damage);
            this.particles.spawnBurst(p.x, p.y, p.z, p.kind === 'ultimate' ? 24 : 8, 0x38bdf8, 16, 0.65, 0.35);
            if (p.kind === 'plasma' || p.kind === 'missile') {
              this.particles.spawnShockwave(p.x, p.y, p.z, 0x22d3ee, 6, 0.3);
            }
            if (p.kind !== 'ultimate') {
              consumed = true;
              break;
            }
          }
        }

        // Check boss & weak points
        if (!consumed && this.boss && !this.boss.dying) {
          const b = this.boss;
          // Weak points first
          for (const wp of b.rig.weakPoints) {
            if (wp.destroyed) continue;
            wp.mesh.getWorldPosition(_v1);
            if (
              segmentSphereCollision(
                p.prevX,
                p.prevY,
                p.prevZ,
                p.x,
                p.y,
                p.z,
                _v1.x,
                _v1.y,
                _v1.z,
                2.2 + p.radius
              )
            ) {
              const dmg = p.damage * 1.8;
              wp.hp -= dmg;
              this.damageBoss(dmg);
              this.particles.spawnBurst(p.x, p.y, p.z, 10, 0xfacc15, 18, 0.7, 0.4);
              if (wp.hp <= 0) {
                wp.destroyed = true;
                wp.mesh.visible = false;
                wp.ring.visible = false;
                b.shielded = false;
                this.hitstopTimer = 0.05;
                this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.45);
                this.particles.spawnBurst(_v1.x, _v1.y, _v1.z, 26, 0xf97316, 26, 1.2, 0.65);
                this.particles.spawnShockwave(_v1.x, _v1.y, _v1.z, 0xfacc15, 14, 0.45);
                this.audio.playExplosion('large');
                this.score += 500;
              }
              if (p.kind !== 'ultimate') {
                consumed = true;
                break;
              }
            }
          }

          // Main boss hull
          if (
            !consumed &&
            segmentSphereCollision(
              p.prevX,
              p.prevY,
              p.prevZ,
              p.x,
              p.y,
              p.z,
              b.x,
              b.y,
              b.z,
              10.5 + p.radius
            )
          ) {
            const mult = b.shielded ? 0.32 : 1.0;
            this.damageBoss(p.damage * mult);
            this.particles.spawnBurst(
              p.x,
              p.y,
              p.z,
              8,
              b.shielded ? 0x38bdf8 : 0xf97316,
              14,
              0.6,
              0.32
            );
            if (p.kind !== 'ultimate') {
              consumed = true;
            }
          }
        }

        // Check asteroids
        if (!consumed) {
          for (let ai = 0; ai < this.environment.asteroids.length; ai++) {
            const a = this.environment.asteroids[ai];
            if (!a.active) continue;
            if (
              segmentSphereCollision(
                p.prevX,
                p.prevY,
                p.prevZ,
                p.x,
                p.y,
                p.z,
                a.x,
                a.y,
                a.z,
                a.radius + p.radius
              )
            ) {
              a.hp -= p.damage;
              this.particles.spawnBurst(p.x, p.y, p.z, 6, 0x94a3b8, 12, 0.5, 0.3);
              if (a.hp <= 0) {
                this.particles.spawnBurst(a.x, a.y, a.z, 18, 0xf59e0b, 18, 0.9, 0.55);
                this.particles.spawnShockwave(a.x, a.y, a.z, 0x94a3b8, 7, 0.35);
                this.audio.playExplosion('small');
                this.score += 65;
                if (Math.random() < 0.22) {
                  this.spawnPowerUp(a.x, a.y, a.z);
                }
                this.environment.respawnAsteroid(a);
              }
              if (p.kind !== 'ultimate') {
                consumed = true;
                break;
              }
            }
          }
        }

        if (consumed) {
          p.active = false;
          p.mesh.visible = false;
        }
      } else {
        // Enemy projectile vs Player
        if (
          segmentSphereCollision(
            p.prevX,
            p.prevY,
            p.prevZ,
            p.x,
            p.y,
            p.z,
            this.px,
            this.py,
            this.pz,
            1.85 + p.radius
          )
        ) {
          this.damagePlayer(p.damage);
          this.particles.spawnBurst(p.x, p.y, p.z, 10, 0xef4444, 15, 0.6, 0.35);
          p.active = false;
          p.mesh.visible = false;
        }
      }
    }
  }

  private damageEnemy(e: ActiveEnemy, dmg: number): void {
    e.hp -= dmg;
    e.hitFlashTimer = 0.08;
    this.audio.playHit(false);

    if (e.hp <= 0 && !e.dying) {
      e.dying = true;
      e.deathTimer = 0.34;
      this.combo += 1;
      this.comboTimer = 4.2;
      this.kills += 1;
      const lvlId = LEVELS[this.currentLevelIdx].id;
      this.score += calculateKillScore(e.score, this.combo, lvlId);
      this.specialCharge = Math.min(this.maxSpecialCharge, this.specialCharge + 14);

      this.hitstopTimer = e.type === 'destroyer' ? 0.045 : 0.025;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + (e.type === 'destroyer' ? 0.32 : 0.14));
      this.particles.spawnBurst(e.x, e.y, e.z, e.type === 'destroyer' ? 28 : 16, 0xf97316, 22, 0.95, 0.55);
      this.particles.spawnShockwave(e.x, e.y, e.z, 0xfacc15, e.type === 'destroyer' ? 12 : 6.5, 0.38);
      this.audio.playExplosion(e.type === 'destroyer' ? 'large' : 'small');

      // Power-up drop chance
      const dropChance = e.type === 'destroyer' ? 0.65 : e.type === 'bomber' ? 0.42 : 0.24;
      if (Math.random() < dropChance) {
        this.spawnPowerUp(e.x, e.y, e.z);
      }
    }
  }

  private damageBoss(dmg: number): void {
    if (!this.boss || this.boss.dying) return;
    this.boss.hp = Math.max(0, this.boss.hp - dmg);
    this.boss.hitFlashTimer = 0.06;
    this.audio.playHit(true);
    this.specialCharge = Math.min(this.maxSpecialCharge, this.specialCharge + 2.5);

    if (this.boss.hp <= 0) {
      this.boss.dying = true;
      this.boss.deathTimer = 2.0;
      this.boss.beamMesh.visible = false;
      this.boss.telegraphMesh.visible = false;
      this.hitstopTimer = 0.07;
      this.cameraTrauma = 0.8;
    }
  }

  private damagePlayer(dmg: number): void {
    if (this.playerDying) return;
    const invuln = this.invulnTimer > 0 || this.phaseInvulnTimer > 0;
    const res = applyShieldAndHullDamage(this.health, this.shield, dmg, invuln);
    if (res.hullDamageTaken === 0 && res.shieldDamageTaken === 0) return;

    this.health = res.newHealth;
    this.shield = res.newShield;
    this.damageTaken += res.hullDamageTaken + res.shieldDamageTaken;
    this.invulnTimer = 0.45;
    this.playerHitFlash = 1.0;
    this.damageFlash = 0.9;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.48);

    if (res.hullDamageTaken > 0) {
      this.audio.playHit(true);
      this.hitstopTimer = 0.035;
    } else {
      this.audio.playShieldHit();
    }

    if (res.destroyed) {
      this.playerDying = true;
      this.playerDeathTimer = 0.75;
      this.particles.spawnBurst(this.px, this.py, this.pz, 45, 0xef4444, 28, 1.3, 0.75);
      this.particles.spawnShockwave(this.px, this.py, this.pz, 0xf97316, 16, 0.55);
      this.audio.playExplosion('large');
    }
    this.emitHud();
  }

  private updatePowerUps(dt: number): void {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pu = this.powerUps[i];
      pu.age += dt;
      pu.z += 22 * dt;
      pu.group.position.set(pu.x, pu.y + Math.sin(pu.age * 4) * 0.4, pu.z);
      pu.group.rotation.y += dt * 2.5;
      pu.group.rotation.x += dt * 1.2;

      if (sphereCollision(pu.x, pu.y, pu.z, 2.2, this.px, this.py, this.pz, 2.4)) {
        this.applyPowerUp(pu.type);
        this.scene.remove(pu.group);
        this.powerUps.splice(i, 1);
        continue;
      }

      if (pu.z > PLAYFIELD_BOUNDS.despawnZ) {
        this.scene.remove(pu.group);
        this.powerUps.splice(i, 1);
      }
    }
  }

  private applyPowerUp(type: PowerUpType): void {
    this.audio.playPowerUp();
    this.particles.spawnBurst(this.px, this.py, this.pz, 14, POWERUP_SPECS[type].color, 14, 0.6, 0.4);
    this.activePowerUpBanner = POWERUP_SPECS[type].label;
    this.powerUpBannerTimer = 2.6;

    switch (type) {
      case 'health':
        this.health = Math.min(this.maxHealth, this.health + 35);
        break;
      case 'shield':
        this.shield = Math.min(this.maxShield, this.shield + 50);
        break;
      case 'rapid_fire':
        this.rapidFireTimer = 10;
        break;
      case 'triple_laser':
        this.activeWeapon = 'triple_laser';
        break;
      case 'missile_upgrade':
        this.activeWeapon = 'missile_launcher';
        break;
      case 'damage_boost':
        this.damageBoostTimer = 10;
        break;
      case 'invincibility':
        this.phaseInvulnTimer = 7;
        break;
      case 'special_charge':
        this.specialCharge = this.maxSpecialCharge;
        break;
    }
    this.emitHud();
  }

  private checkAsteroidCollisions(): void {
    for (let i = 0; i < this.environment.asteroids.length; i++) {
      const a = this.environment.asteroids[i];
      if (!a.active) continue;
      if (sphereCollision(a.x, a.y, a.z, a.radius * 0.88, this.px, this.py, this.pz, 1.85)) {
        this.damagePlayer(18);
        this.particles.spawnBurst(a.x, a.y, a.z, 16, 0xf97316, 18, 0.85, 0.5);
        this.audio.playExplosion('small');
        this.environment.respawnAsteroid(a);
      }
    }
  }

  private updateCamera(dt: number): void {
    const isBoss = Boolean(this.boss);
    const boosting = this.input.boost && this.boost > 2;

    // FOV boost kick
    const targetFov = boosting ? 72 : isBoss ? 66 : 62;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    this.camera.updateProjectionMatrix();

    // Third-person chase camera behind & slightly above player ship
    const offsetZ = isBoss ? 15.5 : 12.5;
    const offsetY = isBoss ? 4.8 : 3.6;

    _camTarget.set(this.px * 0.82, this.py * 0.82 + offsetY, this.pz + offsetZ);
    this.camera.position.lerp(_camTarget, 1 - Math.exp(-7.5 * dt));

    // Decaying trauma * trauma shake
    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.65);
    const shake = this.cameraTrauma * this.cameraTrauma;
    const sx = (Math.random() * 2 - 1) * shake * 1.15;
    const sy = (Math.random() * 2 - 1) * shake * 0.95;

    _camLookTarget.set(this.px * 0.9 + sx, this.py * 0.9 + sy, this.pz - 28);
    this.camera.lookAt(_camLookTarget);
  }

  private finishRun(victory: boolean): void {
    this.screenState = 'gameover';
    this.audio.setPlayingMusic(false, false);
    this.audio.updateEngine(false, 0, false);

    if (victory) this.audio.playVictory();
    else this.audio.playDefeat();

    const lvl = LEVELS[this.currentLevelIdx];
    const finalBest = Math.max(this.bestScore, this.score);
    this.bestScore = finalBest;

    this.emitHud();
    this.callbacks.onStateChange('gameover');
    this.callbacks.onGameOver({
      victory,
      mode: this.gameMode,
      score: this.score,
      bestScore: finalBest,
      level: lvl.id,
      levelName: lvl.name,
      wave: this.wave,
      kills: this.kills,
      elapsedTime: this.runTime,
      damageTaken: Math.round(this.damageTaken),
      bossHpRemaining: this.boss ? Math.round(this.boss.hp) : 0,
      bossMaxHp: this.boss ? this.boss.maxHp : 0,
      rank: getRankFromScore(this.score, this.damageTaken, victory),
      nextLevelUnlocked: victory && this.gameMode === 'campaign' && lvl.id < LEVELS.length ? lvl.id + 1 : null,
    });
  }

  private emitHud(): void {
    const lvl = LEVELS[this.currentLevelIdx];
    const remainingEnemies =
      this.waveSpawnQueue.length + this.enemies.filter((e) => !e.dying).length + (this.boss ? 1 : 0);

    this.callbacks.onHudUpdate({
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      shield: Math.round(this.shield),
      maxShield: this.maxShield,
      boost: Math.round(this.boost),
      maxBoost: this.maxBoost,
      specialCharge: Math.round(this.specialCharge),
      maxSpecialCharge: this.maxSpecialCharge,
      score: this.score,
      bestScore: Math.max(this.bestScore, this.score),
      combo: this.combo,
      level: lvl.id,
      levelName: this.gameMode === 'campaign' ? lvl.name : this.gameMode === 'endless' ? 'Endless Sector' : 'Time Attack',
      wave: this.wave,
      totalWaves: this.gameMode === 'campaign' ? lvl.wavesCount : 99,
      enemiesRemaining: remainingEnemies,
      kills: this.kills,
      activeWeapon: this.activeWeapon,
      unlockedWeapons: this.unlockedWeapons,
      rapidFireTimer: this.rapidFireTimer,
      damageBoostTimer: this.damageBoostTimer,
      invincibleTimer: this.phaseInvulnTimer,
      objectiveText: this.boss
        ? `Destroy ${this.boss.name} weak points & core`
        : this.gameMode === 'time_attack'
          ? 'Score maximum kills before time expires'
          : lvl.objective,
      timeRemaining: this.timeAttackRemaining,
      elapsedTime: this.runTime,
      bossActive: Boolean(this.boss),
      bossName: this.boss ? this.boss.name : '',
      bossHp: this.boss ? Math.round(this.boss.hp) : 0,
      bossMaxHp: this.boss ? this.boss.maxHp : 1,
      bossPhase: this.boss ? this.boss.phase : 1,
      bossShielded: this.boss ? this.boss.shielded : false,
      bossWarningText: this.bossWarningText,
      activePowerUpBanner: this.activePowerUpBanner,
      damageFlash: this.damageFlash,
      ultimateFlash: this.ultimateFlash,
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.clearActiveCombatEntities();
    this.playerRig.dispose();
    this.environment.dispose();
    this.particles.dispose();
    this.textures.dispose();
    this.pmremEnv.dispose();
    this.audio.dispose();

    const geos = this.scene.userData.projGeos as Record<string, THREE.BufferGeometry> | undefined;
    if (geos) {
      Object.values(geos).forEach((g) => g.dispose());
    }
    this.projectilePool.forEach((p) => (p.mesh.material as THREE.Material).dispose());

    if (this.composer) this.composer.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
