import * as THREE from 'three';
import { createFresnelShieldMaterial, ProceduralTextureSet } from './ProceduralAssets';
import type { BossType, EnemyType } from './types';

export interface PlayerShipRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  leftFlame: THREE.Mesh;
  rightFlame: THREE.Mesh;
  shieldMesh: THREE.Mesh;
  shieldMat: THREE.ShaderMaterial;
  hullMaterials: THREE.MeshStandardMaterial[];
  leftMuzzle: THREE.Object3D;
  rightMuzzle: THREE.Object3D;
  centerMuzzle: THREE.Object3D;
  dispose: () => void;
}

export interface BossShipRig {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  turrets: THREE.Group[];
  weakPoints: {
    id: number;
    mesh: THREE.Mesh;
    ring: THREE.Mesh;
    hp: number;
    maxHp: number;
    destroyed: boolean;
    localPos: THREE.Vector3;
  }[];
  shieldMesh: THREE.Mesh;
  shieldMat: THREE.ShaderMaterial;
  beamMuzzle: THREE.Object3D;
  outerRing?: THREE.Group;
  hullMaterials: THREE.MeshStandardMaterial[];
  dispose: () => void;
}

function makeWingShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0.9);
  s.lineTo(3.4, -1.1);
  s.lineTo(3.6, -1.9);
  s.lineTo(0.8, -1.6);
  s.lineTo(0, -1.8);
  s.closePath();
  return s;
}

function makeFinShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(1.2, 0);
  s.lineTo(0.3, 1.15);
  s.lineTo(-0.3, 1.15);
  s.closePath();
  return s;
}

export function createPlayerShipMesh(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): PlayerShipRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.hullMap,
    bumpMap: textures.hullBump,
    bumpScale: 0.03,
    metalness: 0.78,
    roughness: 0.34,
  });

  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.55,
    roughness: 0.65,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.55,
    metalness: 0.4,
    roughness: 0.25,
  });

  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x0369a1,
    emissiveIntensity: 0.55,
    metalness: 0.1,
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transmission: isSoftwareGl ? 0 : 0.45,
    transparent: true,
    opacity: isSoftwareGl ? 0.85 : 1.0,
  });

  const thrusterRingMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x38bdf8,
    emissiveIntensity: 2.2,
    roughness: 0.2,
    metalness: 0.2,
  });

  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.88,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  // 1. Primary aerodynamic central fuselage (pointed along -Z)
  const fuselageGeo = new THREE.CylinderGeometry(0.32, 0.78, 4.4, 8);
  fuselageGeo.rotateX(Math.PI / 2);
  fuselageGeo.scale(1.15, 0.65, 1.0);
  const fuselage = new THREE.Mesh(fuselageGeo, hullMat);
  fuselage.castShadow = true;
  fuselage.receiveShadow = true;
  bodyGroup.add(fuselage);

  // 2. Nose sensor spear
  const noseGeo = new THREE.ConeGeometry(0.36, 1.8, 8);
  noseGeo.rotateX(-Math.PI / 2);
  noseGeo.scale(1.1, 0.6, 1.0);
  const nose = new THREE.Mesh(noseGeo, trimMat);
  nose.position.set(0, -0.02, -3.0);
  bodyGroup.add(nose);

  // 3. Glowing armored cockpit canopy
  const canopyGeo = new THREE.CapsuleGeometry(0.34, 1.05, 6, 12);
  canopyGeo.rotateX(Math.PI / 2);
  canopyGeo.scale(0.95, 0.72, 1.0);
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.34, -0.65);
  bodyGroup.add(canopy);

  // 4 & 5. Left and Right swept beveled wings
  const wingShape = makeWingShape();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  wingGeo.rotateX(-Math.PI / 2);

  const rightWing = new THREE.Mesh(wingGeo, hullMat);
  rightWing.position.set(0.38, -0.05, 0.25);
  rightWing.castShadow = true;
  bodyGroup.add(rightWing);

  const leftWing = new THREE.Mesh(wingGeo, hullMat);
  leftWing.scale.x = -1;
  leftWing.position.set(-0.38, -0.05, 0.25);
  leftWing.castShadow = true;
  bodyGroup.add(leftWing);

  // 6 & 7. Wingtip laser cannon pods + glowing muzzles
  const podGeo = new THREE.CylinderGeometry(0.14, 0.17, 1.9, 8);
  podGeo.rotateX(Math.PI / 2);
  const tipGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.5, 8);
  tipGeo.rotateX(Math.PI / 2);

  const leftPod = new THREE.Mesh(podGeo, trimMat);
  leftPod.position.set(-2.35, -0.06, 0.2);
  bodyGroup.add(leftPod);
  const leftTip = new THREE.Mesh(tipGeo, accentMat);
  leftTip.position.set(-2.35, -0.06, -0.95);
  bodyGroup.add(leftTip);

  const rightPod = new THREE.Mesh(podGeo, trimMat);
  rightPod.position.set(2.35, -0.06, 0.2);
  bodyGroup.add(rightPod);
  const rightTip = new THREE.Mesh(tipGeo, accentMat);
  rightTip.position.set(2.35, -0.06, -0.95);
  bodyGroup.add(rightTip);

  const leftMuzzle = new THREE.Object3D();
  leftMuzzle.position.set(-2.35, -0.06, -1.25);
  bodyGroup.add(leftMuzzle);

  const rightMuzzle = new THREE.Object3D();
  rightMuzzle.position.set(2.35, -0.06, -1.25);
  bodyGroup.add(rightMuzzle);

  const centerMuzzle = new THREE.Object3D();
  centerMuzzle.position.set(0, -0.05, -3.5);
  bodyGroup.add(centerMuzzle);

  // 8 & 9. Twin angled dorsal stabilizer fins
  const finShape = makeFinShape();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
  });
  finGeo.rotateY(Math.PI / 2);

  const leftFin = new THREE.Mesh(finGeo, accentMat);
  leftFin.position.set(-0.62, 0.2, 1.55);
  leftFin.rotation.z = 0.28;
  bodyGroup.add(leftFin);

  const rightFin = new THREE.Mesh(finGeo, accentMat);
  rightFin.position.set(0.54, 0.2, 1.55);
  rightFin.rotation.z = -0.28;
  bodyGroup.add(rightFin);

  // 10 & 11. Twin rear engine nacelles + exhaust rings + flames
  const nacelleGeo = new THREE.CylinderGeometry(0.36, 0.3, 1.5, 12);
  nacelleGeo.rotateX(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(0.24, 0.06, 8, 16);
  const flameGeo = new THREE.ConeGeometry(0.26, 2.2, 10);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 1.1);

  const leftNacelle = new THREE.Mesh(nacelleGeo, trimMat);
  leftNacelle.position.set(-0.62, 0.02, 1.75);
  bodyGroup.add(leftNacelle);
  const leftRing = new THREE.Mesh(ringGeo, thrusterRingMat);
  leftRing.position.set(-0.62, 0.02, 2.5);
  bodyGroup.add(leftRing);
  const leftFlame = new THREE.Mesh(flameGeo, flameMat);
  leftFlame.position.set(-0.62, 0.02, 2.45);
  bodyGroup.add(leftFlame);

  const rightNacelle = new THREE.Mesh(nacelleGeo, trimMat);
  rightNacelle.position.set(0.62, 0.02, 1.75);
  bodyGroup.add(rightNacelle);
  const rightRing = new THREE.Mesh(ringGeo, thrusterRingMat);
  rightRing.position.set(0.62, 0.02, 2.5);
  bodyGroup.add(rightRing);
  const rightFlame = new THREE.Mesh(flameGeo, flameMat);
  rightFlame.position.set(0.62, 0.02, 2.45);
  bodyGroup.add(rightFlame);

  // 12. Energy Shield Sphere (Fresnel shader)
  const shieldMat = createFresnelShieldMaterial(0x38bdf8);
  const shieldGeo = new THREE.SphereGeometry(3.75, 24, 24);
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.visible = false;
  group.add(shieldMesh);

  return {
    group,
    bodyGroup,
    leftFlame,
    rightFlame,
    shieldMesh,
    shieldMat,
    hullMaterials: [hullMat, trimMat, accentMat],
    leftMuzzle,
    rightMuzzle,
    centerMuzzle,
    dispose: () => {
      fuselageGeo.dispose();
      noseGeo.dispose();
      canopyGeo.dispose();
      wingGeo.dispose();
      podGeo.dispose();
      tipGeo.dispose();
      finGeo.dispose();
      nacelleGeo.dispose();
      ringGeo.dispose();
      flameGeo.dispose();
      shieldGeo.dispose();
      hullMat.dispose();
      trimMat.dispose();
      accentMat.dispose();
      canopyMat.dispose();
      thrusterRingMat.dispose();
      flameMat.dispose();
      shieldMat.dispose();
    },
  };
}

export function createEnemyShipMesh(type: EnemyType): {
  group: THREE.Group;
  materials: THREE.MeshStandardMaterial[];
  coreMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  const materials: THREE.MeshStandardMaterial[] = [];

  if (type === 'scout') {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.72,
      roughness: 0.38,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.85,
      metalness: 0.3,
      roughness: 0.3,
    });
    materials.push(bodyMat, accentMat);

    // Central needle dart (+Z faces player)
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.75, 3.6, 6), bodyMat);
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1.1, 0.55, 1.0);
    group.add(hull);

    // Forward swept razor wings
    const wingGeo = new THREE.BoxGeometry(3.8, 0.12, 1.1);
    const wings = new THREE.Mesh(wingGeo, bodyMat);
    wings.position.set(0, 0, -0.35);
    group.add(wings);

    const bladeL = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.9, 4), accentMat);
    bladeL.rotation.x = Math.PI / 2;
    bladeL.position.set(-1.75, 0, 0.35);
    group.add(bladeL);

    const bladeR = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.9, 4), accentMat);
    bladeR.rotation.x = Math.PI / 2;
    bladeR.position.set(1.75, 0, 0.35);
    group.add(bladeR);

    const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), accentMat);
    coreMesh.position.set(0, 0.28, 0.1);
    group.add(coreMesh);

    return { group, materials, coreMesh };
  }

  if (type === 'interceptor') {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1e1b4b,
      metalness: 0.85,
      roughness: 0.25,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0xbe185d,
      metalness: 0.45,
      roughness: 0.45,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf472b6,
      emissive: 0xec4899,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    materials.push(bodyMat, wingMat, coreMat);

    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.85, 3.8, 8), bodyMat);
    hull.rotation.x = Math.PI / 2;
    hull.scale.set(1.2, 0.6, 1);
    group.add(hull);

    // Split quad-interceptor wings
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.9), wingMat);
        fin.position.set(sx * 1.25, sy * 0.45, -0.2);
        fin.rotation.z = sx * sy * 0.35;
        group.add(fin);
      }
      const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.2, 6), bodyMat);
      cannon.rotation.x = Math.PI / 2;
      cannon.position.set(sx * 1.8, 0, 0.6);
      group.add(cannon);
    }

    const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), coreMat);
    coreMesh.position.set(0, 0.25, 0.9);
    group.add(coreMesh);

    return { group, materials, coreMesh };
  }

  if (type === 'destroyer') {
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x450a0a,
      metalness: 0.78,
      roughness: 0.42,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      metalness: 0.6,
      roughness: 0.55,
    });
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xef4444,
      emissiveIntensity: 1.6,
      roughness: 0.2,
    });
    materials.push(armorMat, trimMat, coreMat);

    // Heavy armored spine
    const spine = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 7.6), armorMat);
    group.add(spine);

    // Armored prow wedge
    const prow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.0, 4), trimMat);
    prow.rotation.x = Math.PI / 2;
    prow.rotation.y = Math.PI / 4;
    prow.scale.set(1.2, 1.0, 0.7);
    prow.position.set(0, 0, 4.8);
    group.add(prow);

    // Bridge superstructure
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 2.2), trimMat);
    bridge.position.set(0, 1.4, -1.2);
    group.add(bridge);

    // Side weapon sponsons
    for (const sx of [-1, 1]) {
      const sponson = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 4.5), trimMat);
      sponson.position.set(sx * 2.5, -0.1, 0.2);
      group.add(sponson);

      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.8, 8), armorMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(sx * 2.5, 0.2, 2.8);
      group.add(barrel);
    }

    const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.95, 1), coreMat);
    coreMesh.position.set(0, 0.35, 2.9);
    group.add(coreMesh);

    return { group, materials, coreMesh };
  }

  if (type === 'stealth') {
    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0x3b0764,
      metalness: 0.9,
      roughness: 0.15,
      transparent: true,
      opacity: 0.9,
    });
    const edgeMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0xa855f7,
      emissiveIntensity: 1.3,
      transparent: true,
      opacity: 0.95,
    });
    materials.push(cloakMat, edgeMat);

    // Angular faceted stealth flying wing
    const wing = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3.6, 4), cloakMat);
    wing.rotation.x = Math.PI / 2;
    wing.rotation.y = Math.PI / 4;
    wing.scale.set(1.4, 1.0, 0.22);
    group.add(wing);

    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 2.6), edgeMat);
    crest.position.set(0, 0.25, -0.2);
    group.add(crest);

    const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), edgeMat);
    coreMesh.position.set(0, 0.15, 0.9);
    group.add(coreMesh);

    return { group, materials, coreMesh };
  }

  // Alien Bomber
  const bioMat = new THREE.MeshStandardMaterial({
    color: 0x1a2e05,
    metalness: 0.45,
    roughness: 0.55,
  });
  const podMat = new THREE.MeshStandardMaterial({
    color: 0x4d7c0f,
    metalness: 0.3,
    roughness: 0.4,
  });
  const sacMat = new THREE.MeshStandardMaterial({
    color: 0xbef264,
    emissive: 0x84cc16,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  materials.push(bioMat, podMat, sacMat);

  const hull = new THREE.Mesh(new THREE.DodecahedronGeometry(1.65, 1), bioMat);
  hull.scale.set(1.25, 0.85, 1.5);
  group.add(hull);

  for (const sx of [-1, 1]) {
    const pod = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.8, 4, 8), podMat);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(sx * 2.0, -0.1, 0);
    group.add(pod);
  }

  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 12), sacMat);
  coreMesh.position.set(0, -0.5, 0.8);
  group.add(coreMesh);

  return { group, materials, coreMesh };
}

export function createBossMesh(type: BossType, textures: ProceduralTextureSet): BossShipRig {
  const group = new THREE.Group();
  const turrets: THREE.Group[] = [];
  const weakPoints: BossShipRig['weakPoints'] = [];

  const primaryColor = type === 'mothership' ? 0x0f766e : type === 'winged_destroyer' ? 0x581c87 : 0x334155;
  const accentColor = type === 'mothership' ? 0x2dd4bf : type === 'winged_destroyer' ? 0xf43f5e : 0xf97316;

  const hullMat = new THREE.MeshStandardMaterial({
    color: primaryColor,
    map: textures.hullMap,
    bumpMap: textures.hullBump,
    bumpScale: 0.05,
    metalness: 0.82,
    roughness: 0.36,
  });

  const darkArmorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.7,
    roughness: 0.58,
  });

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: accentColor,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });

  const weakMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 2.0,
    roughness: 0.2,
  });

  const hullMaterials = [hullMat, darkArmorMat, coreMat, weakMat];

  // Central Superstructure
  const bodyScale = type === 'mothership' ? 1.45 : type === 'winged_destroyer' ? 1.2 : 1.0;
  const mainHull = new THREE.Mesh(new THREE.BoxGeometry(10 * bodyScale, 4.2 * bodyScale, 15 * bodyScale), hullMat);
  mainHull.castShadow = true;
  mainHull.receiveShadow = true;
  group.add(mainHull);

  // Armored forward prow jaws
  for (const sx of [-1, 1]) {
    const jaw = new THREE.Mesh(
      new THREE.BoxGeometry(2.8 * bodyScale, 3.0 * bodyScale, 8.5 * bodyScale),
      darkArmorMat
    );
    jaw.position.set(sx * 4.2 * bodyScale, -0.3, 6.2 * bodyScale);
    jaw.rotation.y = sx * -0.14;
    group.add(jaw);
  }

  // Dorsal Citadel Tower
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2 * bodyScale, 3.4 * bodyScale, 3.6 * bodyScale, 8),
    darkArmorMat
  );
  tower.position.set(0, 3.2 * bodyScale, -1.5 * bodyScale);
  group.add(tower);

  // Sweeping Wings / Side Hangars
  if (type === 'winged_destroyer' || type === 'mothership') {
    for (const sx of [-1, 1]) {
      const upperWing = new THREE.Mesh(
        new THREE.BoxGeometry(12 * bodyScale, 0.7 * bodyScale, 6.5 * bodyScale),
        hullMat
      );
      upperWing.position.set(sx * 10 * bodyScale, 1.5 * bodyScale, -1 * bodyScale);
      upperWing.rotation.z = sx * 0.22;
      group.add(upperWing);

      const lowerWing = new THREE.Mesh(
        new THREE.BoxGeometry(10 * bodyScale, 0.6 * bodyScale, 5.2 * bodyScale),
        darkArmorMat
      );
      lowerWing.position.set(sx * 8.8 * bodyScale, -1.7 * bodyScale, -1.2 * bodyScale);
      lowerWing.rotation.z = sx * -0.24;
      group.add(lowerWing);
    }
  } else {
    for (const sx of [-1, 1]) {
      const sponson = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 2.6, 10.5),
        hullMat
      );
      sponson.position.set(sx * 7.2, 0, -0.5);
      group.add(sponson);
    }
  }

  // Outer rotating orbital ring for Mothership
  let outerRing: THREE.Group | undefined;
  if (type === 'mothership') {
    outerRing = new THREE.Group();
    const torus = new THREE.Mesh(new THREE.TorusGeometry(14.5, 1.05, 10, 32), darkArmorMat);
    outerRing.add(torus);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 2.2), hullMat);
      fin.position.set(Math.cos(a) * 14.5, Math.sin(a) * 14.5, 0);
      fin.rotation.z = a;
      outerRing.add(fin);
    }
    group.add(outerRing);
  }

  // Central Energy Core & Beam Emitter Maw
  const coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(2.3 * bodyScale, 1), coreMat);
  coreMesh.position.set(0, 0, 7.2 * bodyScale);
  group.add(coreMesh);

  const beamMuzzle = new THREE.Object3D();
  beamMuzzle.position.set(0, 0, 8.8 * bodyScale);
  group.add(beamMuzzle);

  // Rotating Laser Turrets (4 turrets)
  const turretOffsets: [number, number, number][] = [
    [-4.5 * bodyScale, 2.3 * bodyScale, 3.0 * bodyScale],
    [4.5 * bodyScale, 2.3 * bodyScale, 3.0 * bodyScale],
    [-4.2 * bodyScale, -2.3 * bodyScale, 2.5 * bodyScale],
    [4.2 * bodyScale, -2.3 * bodyScale, 2.5 * bodyScale],
  ];
  turretOffsets.forEach(([x, y, z]) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(x, y, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.8, 8), darkArmorMat);
    tGroup.add(base);
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 6), hullMat);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.35, 0.2, 1.1);
    tGroup.add(barrelL);
    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.4, 6), hullMat);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.35, 0.2, 1.1);
    tGroup.add(barrelR);
    group.add(tGroup);
    turrets.push(tGroup);
  });

  // Destructible Weak Points
  const wpPositions: [number, number, number][] =
    type === 'mothership'
      ? [
          [-10.5, 2.5, 2.5],
          [10.5, 2.5, 2.5],
          [-10.5, -2.5, 2.5],
          [10.5, -2.5, 2.5],
        ]
      : type === 'winged_destroyer'
        ? [
            [-9.5, 1.2, 2.0],
            [9.5, 1.2, 2.0],
            [0, 4.8, 0.5],
          ]
        : [
            [-7.2, 1.1, 3.2],
            [7.2, 1.1, 3.2],
          ];

  const wpMaxHp = type === 'mothership' ? 220 : type === 'winged_destroyer' ? 180 : 140;
  wpPositions.forEach(([x, y, z], id) => {
    const wpMesh = new THREE.Mesh(new THREE.SphereGeometry(1.35, 14, 14), weakMat.clone());
    wpMesh.position.set(x, y, z);
    group.add(wpMesh);

    const wpRing = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.14, 8, 20), coreMat);
    wpRing.position.set(x, y, z);
    group.add(wpRing);

    weakPoints.push({
      id,
      mesh: wpMesh,
      ring: wpRing,
      hp: wpMaxHp,
      maxHp: wpMaxHp,
      destroyed: false,
      localPos: new THREE.Vector3(x, y, z),
    });
  });

  // Boss Energy Shield Dome
  const shieldMat = createFresnelShieldMaterial(accentColor);
  const shieldGeo = new THREE.SphereGeometry(14 * bodyScale, 28, 28);
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.visible = false;
  group.add(shieldMesh);

  return {
    group,
    coreMesh,
    turrets,
    weakPoints,
    shieldMesh,
    shieldMat,
    beamMuzzle,
    outerRing,
    hullMaterials,
    dispose: () => {
      group.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const m = obj as THREE.Mesh;
          m.geometry.dispose();
          if (Array.isArray(m.material)) {
            m.material.forEach((mat) => mat.dispose());
          } else {
            m.material.dispose();
          }
        }
      });
    },
  };
}
