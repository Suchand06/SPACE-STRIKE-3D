import * as THREE from 'three';

export interface ProceduralTextureSet {
  hullMap: THREE.CanvasTexture;
  hullBump: THREE.CanvasTexture;
  glowSprite: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  // 1. Metallic sci-fi hull panel texture + grayscale bump map
  const hullCanvas = document.createElement('canvas');
  hullCanvas.width = 256;
  hullCanvas.height = 256;
  const hctx = hullCanvas.getContext('2d')!;
  hctx.fillStyle = '#cbd5e1';
  hctx.fillRect(0, 0, 256, 256);

  // Subtle brushed metal streaks
  for (let y = 0; y < 256; y += 2) {
    const v = 195 + Math.floor(Math.random() * 26);
    hctx.fillStyle = `rgb(${v}, ${v + 5}, ${v + 14})`;
    hctx.fillRect(0, y, 256, 1);
  }
  // Armor panel seams
  hctx.strokeStyle = '#475569';
  hctx.lineWidth = 2;
  hctx.strokeRect(8, 8, 112, 112);
  hctx.strokeRect(132, 8, 116, 112);
  hctx.strokeRect(8, 132, 240, 116);
  // Technical accent stripe
  hctx.fillStyle = '#38bdf8';
  hctx.fillRect(16, 144, 224, 6);

  const hullMap = new THREE.CanvasTexture(hullCanvas);
  hullMap.colorSpace = THREE.SRGBColorSpace;
  hullMap.wrapS = THREE.RepeatWrapping;
  hullMap.wrapT = THREE.RepeatWrapping;
  hullMap.anisotropy = maxAnisotropy;

  // Bump map (linear space)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 256;
  bumpCanvas.height = 256;
  const bctx = bumpCanvas.getContext('2d')!;
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, 256, 256);
  bctx.strokeStyle = '#202020';
  bctx.lineWidth = 3;
  bctx.strokeRect(8, 8, 112, 112);
  bctx.strokeRect(132, 8, 116, 112);
  bctx.strokeRect(8, 132, 240, 116);

  const hullBump = new THREE.CanvasTexture(bumpCanvas);
  hullBump.wrapS = THREE.RepeatWrapping;
  hullBump.wrapT = THREE.RepeatWrapping;
  hullBump.anisotropy = maxAnisotropy;

  // 2. Soft radial glow sprite for stars/particles
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 64;
  glowCanvas.height = 64;
  const gctx = glowCanvas.getContext('2d')!;
  const grad = gctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(220,245,255,0.8)');
  grad.addColorStop(0.65, 'rgba(56,189,248,0.2)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 64, 64);

  const glowSprite = new THREE.CanvasTexture(glowCanvas);
  glowSprite.colorSpace = THREE.SRGBColorSpace;

  return {
    hullMap,
    hullBump,
    glowSprite,
    dispose: () => {
      hullMap.dispose();
      hullBump.dispose();
      glowSprite.dispose();
    },
  };
}

export function createPlanetTexture(
  primaryHex: number,
  accentHex: number,
  cratered: boolean,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const c1 = new THREE.Color(primaryHex);
  const c2 = new THREE.Color(accentHex);

  const bgGrad = ctx.createLinearGradient(0, 0, 0, 256);
  bgGrad.addColorStop(0, `#${c1.getHexString()}`);
  bgGrad.addColorStop(0.5, `#${c2.getHexString()}`);
  bgGrad.addColorStop(1, `#${c1.clone().multiplyScalar(0.55).getHexString()}`);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 256);

  if (cratered) {
    for (let i = 0; i < 65; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 256;
      const r = 4 + Math.random() * 18;
      ctx.fillStyle = 'rgba(10, 15, 30, 0.28)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else {
    // Gas giant atmospheric storm bands
    for (let y = 0; y < 256; y += 6) {
      const alpha = 0.08 + Math.random() * 0.18;
      ctx.fillStyle = y % 12 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(5,10,25,${alpha})`;
      ctx.fillRect(0, y, 512, 3 + Math.random() * 5);
    }
    // Swirling vortex eye
    ctx.fillStyle = `rgba(255, 240, 200, 0.26)`;
    ctx.beginPath();
    ctx.ellipse(320, 145, 34, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createFresnelShieldMaterial(colorHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(colorHex) },
      uOpacity: { value: 0.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      varying vec2 vUv;
      void main() {
        vec3 viewDir = normalize(vViewPos);
        float fresnel = pow(1.0 - max(0.0, dot(viewDir, vNormal)), 2.5);
        float hexWave = 0.75 + 0.25 * sin(vUv.y * 42.0 - uTime * 6.0) * cos(vUv.x * 28.0 + uTime * 3.0);
        float alpha = (fresnel * 0.9 + 0.08 * hexWave) * uOpacity;
        gl_FragColor = vec4(uColor * (1.2 + fresnel * 0.8), clamp(alpha, 0.0, 0.92));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
}

export function createNebulaSkyMaterial(primaryHex: number, secondaryHex: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPrimary: { value: new THREE.Color(primaryHex) },
      uSecondary: { value: new THREE.Color(secondaryHex) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uPrimary;
      uniform vec3 uSecondary;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
              mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
              mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p = p * 2.05 + vec3(0.15, -0.08, 0.12);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 p = vDir * 2.4 + vec3(uTime * 0.012, -uTime * 0.008, uTime * 0.01);
        float n1 = fbm(p);
        float n2 = fbm(p * 1.9 - vec3(n1 * 0.7));
        float band = smoothstep(0.18, 0.82, n1 * 0.65 + n2 * 0.5);
        vec3 deepSpace = vec3(0.016, 0.026, 0.062);
        vec3 nebula = mix(uPrimary * 1.6, uSecondary * 1.45, smoothstep(0.25, 0.82, n2));
        vec3 col = mix(deepSpace, nebula, band * 0.78);
        float horizon = exp(-abs(vDir.y + 0.15 * vDir.x) * 3.0) * 0.42;
        col += uSecondary * horizon * (0.4 + 0.8 * n1);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
  });
}
