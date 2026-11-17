import * as THREE from 'three';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface ShockwaveRing {
  mesh: THREE.Mesh;
  active: boolean;
  age: number;
  maxAge: number;
  maxScale: number;
}

export class ParticleSystem {
  private instanced: THREE.InstancedMesh;
  private capacity: number;
  private cursor = 0;

  private active: Uint8Array;
  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private size: Float32Array;
  private cr: Float32Array;
  private cg: Float32Array;
  private cb: Float32Array;

  private shockwaves: ShockwaveRing[] = [];
  private shockwaveGeo: THREE.RingGeometry;

  constructor(scene: THREE.Scene, capacity = 500) {
    this.capacity = capacity;
    this.active = new Uint8Array(capacity);
    this.px = new Float32Array(capacity);
    this.py = new Float32Array(capacity);
    this.pz = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.cr = new Float32Array(capacity);
    this.cg = new Float32Array(capacity);
    this.cb = new Float32Array(capacity);

    const geo = new THREE.OctahedronGeometry(0.45, 0);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.instanced = new THREE.InstancedMesh(geo, mat, capacity);
    this.instanced.frustumCulled = false;
    this.instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Initialize all instances hidden
    _dummy.scale.setScalar(0);
    _dummy.updateMatrix();
    for (let i = 0; i < capacity; i++) {
      this.instanced.setMatrixAt(i, _dummy.matrix);
      this.instanced.setColorAt(i, _color.setRGB(1, 1, 1));
    }
    this.instanced.instanceMatrix.needsUpdate = true;
    if (this.instanced.instanceColor) {
      this.instanced.instanceColor.needsUpdate = true;
    }
    scene.add(this.instanced);

    // Pre-allocate shockwave ring pool
    this.shockwaveGeo = new THREE.RingGeometry(0.75, 1.0, 28);
    for (let i = 0; i < 16; i++) {
      const sMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.shockwaveGeo, sMat);
      mesh.visible = false;
      scene.add(mesh);
      this.shockwaves.push({
        mesh,
        active: false,
        age: 0,
        maxAge: 0.5,
        maxScale: 10,
      });
    }
  }

  public spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed = 18,
    baseSize = 0.85,
    lifetime = 0.55
  ): void {
    _color.setHex(colorHex);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const spd = speed * (0.4 + Math.random() * 0.8);

      this.active[idx] = 1;
      this.px[idx] = x;
      this.py[idx] = y;
      this.pz[idx] = z;
      this.vx[idx] = Math.sin(phi) * Math.cos(theta) * spd;
      this.vy[idx] = Math.sin(phi) * Math.sin(theta) * spd;
      this.vz[idx] = Math.cos(phi) * spd;
      this.age[idx] = 0;
      this.life[idx] = lifetime * (0.65 + Math.random() * 0.6);
      this.size[idx] = baseSize * (0.6 + Math.random() * 0.85);
      this.cr[idx] = _color.r;
      this.cg[idx] = _color.g;
      this.cb[idx] = _color.b;
    }
  }

  public spawnTrail(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    size = 0.42,
    lifetime = 0.28
  ): void {
    _color.setHex(colorHex);
    const idx = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;

    this.active[idx] = 1;
    this.px[idx] = x + (Math.random() - 0.5) * 0.18;
    this.py[idx] = y + (Math.random() - 0.5) * 0.18;
    this.pz[idx] = z;
    this.vx[idx] = vx;
    this.vy[idx] = vy;
    this.vz[idx] = vz;
    this.age[idx] = 0;
    this.life[idx] = lifetime;
    this.size[idx] = size;
    this.cr[idx] = _color.r;
    this.cg[idx] = _color.g;
    this.cb[idx] = _color.b;
  }

  public spawnShockwave(x: number, y: number, z: number, colorHex: number, maxScale = 12, duration = 0.45): void {
    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) {
        sw.active = true;
        sw.age = 0;
        sw.maxAge = duration;
        sw.maxScale = maxScale;
        sw.mesh.position.set(x, y, z);
        sw.mesh.rotation.set(Math.random() * 0.4, Math.random() * 0.4, 0);
        sw.mesh.scale.setScalar(0.5);
        sw.mesh.visible = true;
        const mat = sw.mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(colorHex);
        mat.opacity = 0.95;
        return;
      }
    }
  }

  public update(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.capacity; i++) {
      if (this.active[i] === 0) continue;
      dirty = true;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.active[i] = 0;
        _dummy.position.set(0, -9999, 0);
        _dummy.scale.setScalar(0);
        _dummy.updateMatrix();
        this.instanced.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      this.vx[i] *= 0.96;
      this.vy[i] *= 0.96;
      this.vz[i] *= 0.96;

      const t = 1 - this.age[i] / this.life[i];
      _dummy.position.set(this.px[i], this.py[i], this.pz[i]);
      _dummy.rotation.set(this.age[i] * 5, this.age[i] * 3, 0);
      _dummy.scale.setScalar(Math.max(0.01, this.size[i] * t));
      _dummy.updateMatrix();

      this.instanced.setMatrixAt(i, _dummy.matrix);
      _color.setRGB(this.cr[i] * t, this.cg[i] * t, this.cb[i] * t);
      this.instanced.setColorAt(i, _color);
    }

    if (dirty) {
      this.instanced.instanceMatrix.needsUpdate = true;
      if (this.instanced.instanceColor) {
        this.instanced.instanceColor.needsUpdate = true;
      }
    }

    for (let i = 0; i < this.shockwaves.length; i++) {
      const sw = this.shockwaves[i];
      if (!sw.active) continue;
      sw.age += dt;
      if (sw.age >= sw.maxAge) {
        sw.active = false;
        sw.mesh.visible = false;
        continue;
      }
      const p = sw.age / sw.maxAge;
      const eased = 1 - Math.pow(1 - p, 3);
      sw.mesh.scale.setScalar(0.5 + eased * sw.maxScale);
      (sw.mesh.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.9;
    }
  }

  public dispose(): void {
    this.instanced.geometry.dispose();
    (this.instanced.material as THREE.Material).dispose();
    this.shockwaveGeo.dispose();
    this.shockwaves.forEach((s) => (s.mesh.material as THREE.Material).dispose());
  }
}
