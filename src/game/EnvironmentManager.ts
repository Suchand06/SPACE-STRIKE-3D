import * as THREE from 'three';
import { createNebulaSkyMaterial, createPlanetTexture } from './ProceduralAssets';
import type { LevelConfig } from './types';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export interface AsteroidData {
  active: boolean;
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  scale: number;
  radius: number;
  hp: number;
  speed: number;
}

export class EnvironmentManager {
  private scene: THREE.Scene;
  private maxAnisotropy: number;

  private skyMesh: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;

  private starFieldFar: THREE.Points;
  private starFieldNear: THREE.Points;

  private planetGroup: THREE.Group;
  private mainPlanet: THREE.Mesh;
  private planetRing: THREE.Mesh;
  private moonPlanet: THREE.Mesh;
  private planetTex: THREE.CanvasTexture | null = null;
  private moonTex: THREE.CanvasTexture | null = null;

  private asteroidMesh: THREE.InstancedMesh;
  public asteroids: AsteroidData[] = [];
  private activeAsteroidCount = 20;
  private baseAsteroidSpeed = 20;
  private maxAsteroids = 50;

  private distantFlashes: { mesh: THREE.Mesh; timer: number; maxTimer: number }[] = [];

  constructor(
    scene: THREE.Scene,
    starCount: number,
    maxAnisotropy: number,
    glowSprite: THREE.Texture
  ) {
    this.scene = scene;
    this.maxAnisotropy = maxAnisotropy;

    // 1. Animated Procedural Nebula Sky Dome
    this.skyMat = createNebulaSkyMaterial(0x0b254f, 0x0e7490);
    const skyGeo = new THREE.SphereGeometry(420, 24, 24);
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    scene.add(this.skyMesh);

    // 2. Multi-Layer Parallax Starfield (soft glowing circular sprites, never raw squares)
    this.starFieldFar = this.createStarLayer(starCount, 280, 1.1, 0xe2e8f0, glowSprite);
    this.starFieldNear = this.createStarLayer(
      Math.floor(starCount * 0.45),
      150,
      1.65,
      0x7dd3fc,
      glowSprite
    );
    scene.add(this.starFieldFar);
    scene.add(this.starFieldNear);

    // 3. Procedural 3D Planets & Ring System
    this.planetGroup = new THREE.Group();
    scene.add(this.planetGroup);

    const mainPlanetGeo = new THREE.SphereGeometry(28, 32, 24);
    const mainPlanetMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.05,
    });
    this.mainPlanet = new THREE.Mesh(mainPlanetGeo, mainPlanetMat);
    this.mainPlanet.position.set(78, 32, -210);
    this.planetGroup.add(this.mainPlanet);

    const ringGeo = new THREE.RingGeometry(36, 54, 48);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.planetRing = new THREE.Mesh(ringGeo, ringMat);
    this.planetRing.rotation.x = Math.PI * 0.38;
    this.planetRing.rotation.y = 0.3;
    this.mainPlanet.add(this.planetRing);

    const moonGeo = new THREE.SphereGeometry(9.5, 24, 20);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
    });
    this.moonPlanet = new THREE.Mesh(moonGeo, moonMat);
    this.moonPlanet.position.set(-85, -24, -185);
    this.planetGroup.add(this.moonPlanet);

    // 4. Instanced Asteroid Belt
    const rockGeo = new THREE.DodecahedronGeometry(1.4, 1);
    const posAttr = rockGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const jitter = 0.8 + 0.35 * Math.sin(vx * 3.1 + vy * 2.7 + vz * 1.9);
      posAttr.setXYZ(i, vx * jitter, vy * jitter, vz * jitter);
    }
    rockGeo.computeVertexNormals();

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.88,
      metalness: 0.14,
      flatShading: true,
    });
    this.asteroidMesh = new THREE.InstancedMesh(rockGeo, rockMat, this.maxAsteroids);
    this.asteroidMesh.frustumCulled = false;

    for (let i = 0; i < this.maxAsteroids; i++) {
      const scale = 0.85 + Math.random() * 1.9;
      this.asteroids.push({
        active: i < this.activeAsteroidCount,
        x: (Math.random() - 0.5) * 85,
        y: (Math.random() - 0.5) * 44,
        z: -40 - Math.random() * 180,
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        rz: Math.random() * Math.PI,
        vrx: (Math.random() - 0.5) * 1.4,
        vry: (Math.random() - 0.5) * 1.4,
        scale,
        radius: 1.35 * scale,
        hp: 45 * scale,
        speed: 1.0 + Math.random() * 0.4,
      });
      const shade = 0.22 + Math.random() * 0.16;
      _color.setRGB(shade * 1.05, shade * 0.92, shade * 0.82);
      this.asteroidMesh.setColorAt(i, _color);
    }
    if (this.asteroidMesh.instanceColor) {
      this.asteroidMesh.instanceColor.needsUpdate = true;
    }
    scene.add(this.asteroidMesh);

    // 5. Distant atmospheric combat flashes
    const flashGeo = new THREE.SphereGeometry(2.5, 8, 8);
    for (let i = 0; i < 6; i++) {
      const fMat = new THREE.MeshBasicMaterial({
        color: 0xf97316,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(flashGeo, fMat);
      mesh.position.set((Math.random() - 0.5) * 240, (Math.random() - 0.5) * 110, -240 - Math.random() * 80);
      scene.add(mesh);
      this.distantFlashes.push({
        mesh,
        timer: Math.random() * 4,
        maxTimer: 3 + Math.random() * 5,
      });
    }
  }

  private createStarLayer(
    count: number,
    spread: number,
    size: number,
    colorHex: number,
    glowSprite: THREE.Texture
  ): THREE.Points {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spread * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 1.4;
      positions[i * 3 + 2] = -Math.random() * 280 + 30;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: colorHex,
      map: glowSprite,
      size,
      sizeAttenuation: true,
      transparent: true,
      alphaTest: 0.02,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return new THREE.Points(geo, mat);
  }

  public applyLevelTheme(level: LevelConfig): void {
    this.skyMat.uniforms.uPrimary.value.setHex(level.skyPrimary);
    this.skyMat.uniforms.uSecondary.value.setHex(level.skySecondary);
    this.scene.fog = new THREE.FogExp2(level.fogColor, 0.0026);
    this.scene.background = new THREE.Color(level.fogColor);

    if (this.planetTex) this.planetTex.dispose();
    if (this.moonTex) this.moonTex.dispose();

    this.planetTex = createPlanetTexture(level.planetColor, level.planetAccent, false, this.maxAnisotropy);
    this.moonTex = createPlanetTexture(0x475569, level.planetAccent, true, this.maxAnisotropy);

    const pMat = this.mainPlanet.material as THREE.MeshStandardMaterial;
    pMat.map = this.planetTex;
    pMat.needsUpdate = true;

    const mMat = this.moonPlanet.material as THREE.MeshStandardMaterial;
    mMat.map = this.moonTex;
    mMat.needsUpdate = true;

    this.planetRing.visible = level.hasRingedPlanet;
    (this.planetRing.material as THREE.MeshBasicMaterial).color.setHex(level.planetAccent);

    this.activeAsteroidCount = Math.min(this.maxAsteroids, level.asteroidCount);
    this.baseAsteroidSpeed = level.asteroidSpeed;

    for (let i = 0; i < this.maxAsteroids; i++) {
      const a = this.asteroids[i];
      a.active = i < this.activeAsteroidCount;
      a.z = -55 - Math.random() * 190;
      a.x = (Math.random() - 0.5) * 84;
      a.y = (Math.random() - 0.5) * 42;
      a.hp = 45 * a.scale;
    }
  }

  public respawnAsteroid(a: AsteroidData): void {
    a.active = true;
    a.x = (Math.random() - 0.5) * 80;
    a.y = (Math.random() - 0.5) * 38;
    a.z = -205 - Math.random() * 55;
    a.hp = 45 * a.scale;
  }

  public update(dt: number, elapsedTime: number, speedMultiplier: number): void {
    this.skyMat.uniforms.uTime.value = elapsedTime;

    // Parallax star scrolling
    this.scrollStars(this.starFieldFar, dt * 18 * speedMultiplier);
    this.scrollStars(this.starFieldNear, dt * 52 * speedMultiplier);

    // Slow celestial rotation
    this.mainPlanet.rotation.y += dt * 0.04;
    this.moonPlanet.rotation.y -= dt * 0.07;
    this.planetRing.rotation.z += dt * 0.025;

    // Asteroid belt motion
    for (let i = 0; i < this.maxAsteroids; i++) {
      const a = this.asteroids[i];
      if (!a.active || i >= this.activeAsteroidCount) {
        _dummy.position.set(0, -9999, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.asteroidMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      a.z += this.baseAsteroidSpeed * a.speed * speedMultiplier * dt;
      a.rx += a.vrx * dt;
      a.ry += a.vry * dt;

      if (a.z > 28) {
        this.respawnAsteroid(a);
      }

      _dummy.position.set(a.x, a.y, a.z);
      _dummy.rotation.set(a.rx, a.ry, a.rz);
      _dummy.scale.setScalar(a.scale);
      _dummy.updateMatrix();
      this.asteroidMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.asteroidMesh.instanceMatrix.needsUpdate = true;

    // Distant cosmic flashes
    for (let i = 0; i < this.distantFlashes.length; i++) {
      const df = this.distantFlashes[i];
      df.timer -= dt;
      if (df.timer <= 0) {
        df.timer = df.maxTimer;
        df.mesh.position.set((Math.random() - 0.5) * 230, (Math.random() - 0.5) * 100, -230 - Math.random() * 80);
      }
      const flashLife = df.maxTimer - df.timer;
      if (flashLife < 0.45) {
        const s = 1 + flashLife * 9;
        df.mesh.scale.setScalar(s);
        (df.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - flashLife / 0.45) * 0.65;
      } else {
        (df.mesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  }

  private scrollStars(points: THREE.Points, dz: number): void {
    const pos = points.geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i + 2] += dz;
      if (arr[i + 2] > 32) {
        arr[i + 2] = -250;
        arr[i] = (Math.random() - 0.5) * 420;
        arr[i + 1] = (Math.random() - 0.5) * 280;
      }
    }
    pos.needsUpdate = true;
  }

  public dispose(): void {
    this.skyMesh.geometry.dispose();
    this.skyMat.dispose();
    this.starFieldFar.geometry.dispose();
    (this.starFieldFar.material as THREE.Material).dispose();
    this.starFieldNear.geometry.dispose();
    (this.starFieldNear.material as THREE.Material).dispose();
    this.mainPlanet.geometry.dispose();
    (this.mainPlanet.material as THREE.Material).dispose();
    this.planetRing.geometry.dispose();
    (this.planetRing.material as THREE.Material).dispose();
    this.moonPlanet.geometry.dispose();
    (this.moonPlanet.material as THREE.Material).dispose();
    if (this.planetTex) this.planetTex.dispose();
    if (this.moonTex) this.moonTex.dispose();
    this.asteroidMesh.geometry.dispose();
    (this.asteroidMesh.material as THREE.Material).dispose();
    this.distantFlashes.forEach((d) => {
      d.mesh.geometry.dispose();
      (d.mesh.material as THREE.Material).dispose();
    });
  }
}
