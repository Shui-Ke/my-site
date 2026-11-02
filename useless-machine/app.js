/* ==========================================================================
   The Useless Machine
   A small interactive automaton built with Three.js.
   ========================================================================== */
(function () {
  "use strict";

  const canvas = document.getElementById("scene");
  const errorPanel = document.getElementById("webglError");
  const curtain = document.getElementById("curtain");
  const TAU = Math.PI * 2;
  const DEG = Math.PI / 180;

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const saturate = (v) => clamp(v, 0, 1);
  const lerp = (a, b, t) => a + (b - a) * t;
  const invLerp = (a, b, v) => saturate((v - a) / (b - a));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInCubic = (t) => t * t * t;
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
  const easeInOutQuint = (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2);
  const smoothstep = (t) => {
    t = saturate(t);
    return t * t * (3 - 2 * t);
  };
  const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

  function seededRandom(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeCanvas(width, height) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    return c;
  }

  function trackText(ctx, text, centerX, y, tracking) {
    const glyphs = Array.from(text);
    let width = 0;
    glyphs.forEach((ch) => {
      width += ctx.measureText(ch).width;
    });
    width += tracking * Math.max(0, glyphs.length - 1);
    let x = centerX - width / 2;
    glyphs.forEach((ch) => {
      ctx.fillText(ch, x, y);
      x += ctx.measureText(ch).width + tracking;
    });
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false
    });
  } catch (error) {
    console.error(error);
    curtain.style.display = "none";
    errorPanel.classList.add("is-visible");
    return;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  if ("outputColorSpace" in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  } else if ("outputEncoding" in renderer) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }
  if ("useLegacyLights" in renderer) {
    renderer.useLegacyLights = false;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe2d8c8);
  scene.fog = new THREE.FogExp2(0xd9cbb8, 0.008);
  const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.08, 80);

  const textureAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  function finishTexture(texture, options) {
    options = options || {};
    texture.wrapS = options.wrapS || THREE.ClampToEdgeWrapping;
    texture.wrapT = options.wrapT || THREE.ClampToEdgeWrapping;
    texture.anisotropy = textureAnisotropy;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    if (options.srgb !== false) {
      if ("colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
      else if ("encoding" in texture) texture.encoding = THREE.sRGBEncoding;
    }
    texture.needsUpdate = true;
    return texture;
  }

  /* ------------------------------------------------------------------
     Procedural textures
     ------------------------------------------------------------------ */

  function makeWoodTexture() {
    const random = seededRandom(7007);
    const c = makeCanvas(1024, 1024);
    const ctx = c.getContext("2d");

    const base = ctx.createLinearGradient(0, 0, 1024, 0);
    base.addColorStop(0, "#4b3021");
    base.addColorStop(0.17, "#67432d");
    base.addColorStop(0.4, "#513424");
    base.addColorStop(0.63, "#714a31");
    base.addColorStop(0.83, "#5b3a27");
    base.addColorStop(1, "#452b1d");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 1024, 1024);

    // Broad, softly lit bands in the grain.
    for (let i = 0; i < 42; i++) {
      const x = random() * 1024;
      const w = 10 + random() * 110;
      const grad = ctx.createLinearGradient(x - w, 0, x + w, 0);
      const light = random() > 0.48;
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(0.5, light ? "rgba(210,151,103,0.08)" : "rgba(20,8,3,0.11)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - w, 0, w * 2, 1024);
    }

    // Wandering growth lines give the boards their figure without becoming
    // so contrasty that they read as painted stripes.
    for (let i = 0; i < 25; i++) {
      const startX = random() * 1024;
      const phase = random() * TAU;
      const amp = 7 + random() * 23;
      const freq = 0.001 + random() * 0.0032;
      ctx.beginPath();
      for (let y = -30; y <= 1054; y += 12) {
        const x = startX + Math.sin(y * freq + phase) * amp + Math.sin(y * 0.0085 + phase * 0.6) * 10;
        if (y === -30) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = random() > 0.3 ? "rgba(25,10,3,0.085)" : "rgba(228,179,127,0.075)";
      ctx.lineWidth = 1.2 + random() * 3.6;
      ctx.stroke();
    }

    // Long, wavy grain fibres.
    for (let i = 0; i < 540; i++) {
      const startX = random() * 1024;
      const phase = random() * TAU;
      const amp = 2 + random() * 18;
      const freq = 0.0015 + random() * 0.006;
      const drift = (random() - 0.5) * 52;
      ctx.beginPath();
      for (let y = -20; y <= 1044; y += 15) {
        const x = startX + Math.sin(y * freq + phase) * amp + Math.sin(y * 0.022 + phase) * 1.4 + (y / 1024) * drift;
        if (y === -20) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      const dark = random() > 0.3;
      ctx.strokeStyle = dark
        ? "rgba(22,9,3," + (0.05 + random() * 0.15).toFixed(3) + ")"
        : "rgba(232,181,126," + (0.035 + random() * 0.09).toFixed(3) + ")";
      ctx.lineWidth = 0.55 + random() * 1.9;
      ctx.stroke();
    }

    // A couple of soft knots.
    for (let k = 0; k < 4; k++) {
      const cx = 130 + random() * 760;
      const cy = 100 + random() * 820;
      const rx = 8 + random() * 18;
      const ry = 30 + random() * 100;
      for (let ring = 1; ring < 13; ring++) {
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * (1 + ring * 0.21), ry * (1 + ring * 0.16), (random() - 0.5) * 0.055, 0, TAU);
        ctx.strokeStyle = "rgba(31,13,4," + (0.12 - ring * 0.007).toFixed(3) + ")";
        ctx.lineWidth = 1.3 + random() * 0.8;
        ctx.stroke();
      }
    }

    // Fine pore noise.
    const image = ctx.getImageData(0, 0, 1024, 1024);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (random() - 0.5) * 14;
      data[i] = clamp(data[i] + n, 0, 255);
      data[i + 1] = clamp(data[i + 1] + n * 0.8, 0, 255);
      data[i + 2] = clamp(data[i + 2] + n * 0.6, 0, 255);
    }
    ctx.putImageData(image, 0, 0);

    return finishTexture(new THREE.CanvasTexture(c), {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping
    });
  }

  function makeVelvetTexture() {
    const random = seededRandom(1977);
    const c = makeCanvas(512, 512);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#1b2c21";
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) {
      const x = random() * 512;
      const y = random() * 512;
      const a = 0.012 + random() * 0.06;
      ctx.fillStyle = random() > 0.52 ? "rgba(146,171,148," + a + ")" : "rgba(3,13,7," + a + ")";
      ctx.fillRect(x, y, 0.8 + random() * 2.2, 1 + random() * 4);
    }
    // A quiet diamond tufting.
    ctx.lineWidth = 1;
    for (let offset = -512; offset <= 1024; offset += 86) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + 512, 512);
      ctx.strokeStyle = "rgba(4,13,8,0.3)";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + 512, 512);
      ctx.translate(0.8, 0.8);
      ctx.strokeStyle = "rgba(165,187,160,0.055)";
      ctx.stroke();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath();
      ctx.moveTo(offset, 512);
      ctx.lineTo(offset + 512, 0);
      ctx.strokeStyle = "rgba(4,13,8,0.24)";
      ctx.stroke();
    }
    for (let y = 43; y < 512; y += 86) {
      for (let x = 43 + ((y / 86) % 2 === 0 ? 43 : 0); x < 512; x += 86) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, TAU);
        ctx.fillStyle = "rgba(3,12,7,0.6)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x - 0.5, y - 0.5, 2.8, 0, TAU);
        ctx.fillStyle = "rgba(148,167,143,0.055)";
        ctx.fill();
      }
    }
    return finishTexture(new THREE.CanvasTexture(c), {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping
    });
  }

  function makePlasterTexture() {
    const random = seededRandom(450);
    const c = makeCanvas(768, 768);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#d9cdbc";
    ctx.fillRect(0, 0, 768, 768);
    for (let i = 0; i < 170; i++) {
      const x = random() * 768;
      const y = random() * 768;
      const r = 18 + random() * 130;
      const shade = random() > 0.52 ? 255 : 88;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(" + shade + "," + shade + "," + shade + ",0.018)");
      g.addColorStop(1, "rgba(" + shade + "," + shade + "," + shade + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const image = ctx.getImageData(0, 0, 768, 768);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (random() - 0.5) * 12;
      data[i] = clamp(data[i] + n, 0, 255);
      data[i + 1] = clamp(data[i + 1] + n, 0, 255);
      data[i + 2] = clamp(data[i + 2] + n, 0, 255);
    }
    ctx.putImageData(image, 0, 0);
    return finishTexture(new THREE.CanvasTexture(c), {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping
    });
  }

  function makeStoneTexture() {
    const random = seededRandom(801);
    const c = makeCanvas(1024, 1024);
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 1024, 0);
    g.addColorStop(0, "#c6b7a2");
    g.addColorStop(0.45, "#d3c5b1");
    g.addColorStop(1, "#bfae98");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 1024);

    // Travertine-like horizontal veins and tiny pits.
    for (let i = 0; i < 260; i++) {
      const y = random() * 1024;
      const w = 50 + random() * 900;
      const x = random() * 1024 - w * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 18; j++) {
        ctx.lineTo(x + (w / 18) * j, y + Math.sin(j * 0.85 + i) * (1 + random() * 3.2));
      }
      ctx.strokeStyle = random() > 0.48 ? "rgba(106,87,66,0.04)" : "rgba(255,251,241,0.055)";
      ctx.lineWidth = 0.7 + random() * 3.4;
      ctx.stroke();
    }
    for (let i = 0; i < 1400; i++) {
      const x = random() * 1024;
      const y = random() * 1024;
      const r = 0.3 + random() * 2;
      ctx.fillStyle = random() > 0.5 ? "rgba(92,73,54,0.055)" : "rgba(255,249,236,0.07)";
      ctx.beginPath();
      ctx.ellipse(x, y, r * (0.5 + random()), r, 0, 0, TAU);
      ctx.fill();
    }
    return finishTexture(new THREE.CanvasTexture(c), {
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.RepeatWrapping
    });
  }

  function makeGlowTexture() {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
    g.addColorStop(0, "rgba(255,240,205,1)");
    g.addColorStop(0.16, "rgba(255,209,141,0.9)");
    g.addColorStop(0.46, "rgba(255,167,82,0.24)");
    g.addColorStop(1, "rgba(255,145,55,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return finishTexture(new THREE.CanvasTexture(c));
  }

  function makeDeckLabelTexture(text, isOn) {
    const c = makeCanvas(512, 256);
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 512, 256);
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = isOn ? "rgba(247,225,185,1)" : "rgba(229,214,190,0.82)";
    ctx.font = '600 84px "Bahnschrift", "Segoe UI", sans-serif';
    trackText(ctx, text, 256, 112, 12);
    ctx.strokeStyle = isOn ? "rgba(221,184,123,0.9)" : "rgba(210,192,163,0.5)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(185, 176);
    ctx.lineTo(327, 176);
    ctx.stroke();
    ctx.fillStyle = isOn ? "rgba(241,199,132,0.96)" : "rgba(202,186,161,0.55)";
    ctx.beginPath();
    ctx.arc(isOn ? 350 : 162, 112, 5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    if (isOn) {
      ctx.moveTo(268, 193);
      ctx.lineTo(286, 207);
      ctx.lineTo(268, 221);
    } else {
      ctx.moveTo(244, 193);
      ctx.lineTo(226, 207);
      ctx.lineTo(244, 221);
    }
    ctx.stroke();
    return finishTexture(new THREE.CanvasTexture(c));
  }

  function makePlaqueTexture() {
    const c = makeCanvas(1024, 340);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#24221c";
    ctx.fillRect(0, 0, 1024, 340);
    const v = ctx.createLinearGradient(0, 0, 1024, 340);
    v.addColorStop(0, "rgba(255,244,222,0.045)");
    v.addColorStop(0.48, "rgba(255,244,222,0)");
    v.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, 1024, 340);

    ctx.strokeStyle = "rgba(180,143,88,0.7)";
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, 980, 296);
    ctx.strokeStyle = "rgba(180,143,88,0.25)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(34, 34, 956, 272);

    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = "#d9c6a4";
    ctx.font = '600 51px "Bahnschrift", "Segoe UI", sans-serif';
    trackText(ctx, "THE USELESS MACHINE", 512, 121, 8.3);

    ctx.strokeStyle = "rgba(180,143,88,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(312, 173);
    ctx.lineTo(712, 173);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(512, 163);
    ctx.lineTo(520, 173);
    ctx.lineTo(512, 183);
    ctx.lineTo(504, 173);
    ctx.closePath();
    ctx.fillStyle = "rgba(180,143,88,0.9)";
    ctx.fill();

    ctx.fillStyle = "rgba(209,191,161,0.66)";
    ctx.font = '600 27px "Bahnschrift", "Segoe UI", sans-serif';
    trackText(ctx, "ARTICULATED HAND · PATENT PENDING", 512, 238, 4.2);
    ctx.fillStyle = "rgba(192,154,97,0.7)";
    ctx.font = '500 22px "Bahnschrift", "Segoe UI", sans-serif';
    ctx.fillText("MK. I", 138, 285);
    ctx.fillText("Nº 007", 886, 285);
    return finishTexture(new THREE.CanvasTexture(c));
  }

  function makeLidInlayTexture() {
    const c = makeCanvas(1024, 512);
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 1024, 512);
    const gold = "rgba(195,157,97,0.82)";
    const faded = "rgba(195,157,97,0.38)";
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3;
    roundRect(ctx, 34, 34, 956, 444, 28);
    ctx.stroke();
    ctx.strokeStyle = faded;
    ctx.lineWidth = 1.3;
    roundRect(ctx, 52, 52, 920, 408, 20);
    ctx.stroke();

    // Corner registration marks.
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2.2;
    const corners = [
      [90, 108, 1, 1],
      [934, 108, -1, 1],
      [90, 404, 1, -1],
      [934, 404, -1, -1]
    ];
    corners.forEach(function (p) {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] + p[3] * 29);
      ctx.lineTo(p[0], p[1]);
      ctx.lineTo(p[0] + p[2] * 29, p[1]);
      ctx.stroke();
      ctx.fillStyle = gold;
      ctx.beginPath();
      ctx.arc(p[0] + p[2] * 39, p[1] + p[3] * 39, 2.5, 0, TAU);
      ctx.fill();
    });

    ctx.beginPath();
    ctx.arc(512, 236, 75, 0, TAU);
    ctx.strokeStyle = faded;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(512, 236, 57, -0.2, Math.PI + 0.2);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(512, 236);
    ctx.lineTo(548, 176);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(548, 176, 9, 0, TAU);
    ctx.fillStyle = "rgba(195,157,97,0.9)";
    ctx.fill();

    ctx.fillStyle = "rgba(205,170,111,0.66)";
    ctx.font = '600 22px "Bahnschrift", "Segoe UI", sans-serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    trackText(ctx, "ACTIVITY · NONE", 512, 342, 7.2);
    ctx.fillStyle = "rgba(205,170,111,0.42)";
    ctx.font = '500 17px "Bahnschrift", "Segoe UI", sans-serif';
    trackText(ctx, "Nº 007 / DOMESTIC AUTOMATON", 512, 374, 4.2);
    return finishTexture(new THREE.CanvasTexture(c));
  }

  function makeInnerPlaqueTexture() {
    const c = makeCanvas(640, 220);
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 640, 220);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(197,162,104,0.72)";
    ctx.lineWidth = 2;
    roundRect(ctx, 24, 24, 592, 172, 8);
    ctx.stroke();
    ctx.fillStyle = "rgba(221,197,157,0.9)";
    ctx.font = '600 53px "Bahnschrift", "Segoe UI", sans-serif';
    trackText(ctx, "PLEASE STOP.", 320, 104, 6.8);
    ctx.fillStyle = "rgba(197,162,104,0.53)";
    ctx.font = '500 18px "Bahnschrift", "Segoe UI", sans-serif';
    trackText(ctx, "THANK YOU FOR YOUR COOPERATION", 320, 154, 3.1);
    return finishTexture(new THREE.CanvasTexture(c));
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  const textures = {
    wood: makeWoodTexture(),
    velvet: makeVelvetTexture(),
    plaster: makePlasterTexture(),
    stone: makeStoneTexture(),
    glow: makeGlowTexture(),
    labelOn: makeDeckLabelTexture("ON", true),
    labelOff: makeDeckLabelTexture("OFF", false),
    plaque: makePlaqueTexture(),
    lidInlay: makeLidInlayTexture(),
    innerPlaque: makeInnerPlaqueTexture()
  };

  /* ------------------------------------------------------------------
     Materials
     ------------------------------------------------------------------ */

  function physicalMaterial(params) {
    return new THREE.MeshPhysicalMaterial(params);
  }

  const materials = {
    wood: physicalMaterial({
      map: textures.wood,
      bumpMap: textures.wood,
      bumpScale: 0.009,
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.24,
      clearcoatRoughness: 0.46,
      envMapIntensity: 0.45,
      color: 0xffffff
    }),
    woodDark: physicalMaterial({
      map: textures.wood,
      bumpMap: textures.wood,
      bumpScale: 0.009,
      roughness: 0.57,
      clearcoat: 0.18,
      clearcoatRoughness: 0.52,
      envMapIntensity: 0.36,
      color: 0xbba18b
    }),
    woodEdge: physicalMaterial({
      color: 0x3e2719,
      roughness: 0.58,
      clearcoat: 0.14,
      clearcoatRoughness: 0.55,
      envMapIntensity: 0.3
    }),
    brass: physicalMaterial({
      color: 0xa17a43,
      metalness: 1,
      roughness: 0.33,
      clearcoat: 0.15,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.95
    }),
    brassDark: physicalMaterial({
      color: 0x5e472b,
      metalness: 1,
      roughness: 0.42,
      envMapIntensity: 0.72
    }),
    brassSoft: physicalMaterial({
      color: 0x93703f,
      metalness: 0.92,
      roughness: 0.46,
      envMapIntensity: 0.8
    }),
    ivory: physicalMaterial({
      color: 0xdfcfb5,
      roughness: 0.4,
      metalness: 0,
      clearcoat: 0.58,
      clearcoatRoughness: 0.26,
      envMapIntensity: 0.6
    }),
    ivoryWarm: physicalMaterial({
      color: 0xcfbea2,
      roughness: 0.5,
      clearcoat: 0.4,
      clearcoatRoughness: 0.36,
      envMapIntensity: 0.5
    }),
    velvet: physicalMaterial({
      map: textures.velvet,
      color: 0xffffff,
      roughness: 0.93,
      metalness: 0,
      sheen: 0.85,
      sheenColor: new THREE.Color(0x8fa18d),
      sheenRoughness: 0.72,
      envMapIntensity: 0.3
    }),
    leather: physicalMaterial({
      color: 0x272720,
      roughness: 0.58,
      clearcoat: 0.25,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.38
    }),
    stone: physicalMaterial({
      map: textures.stone,
      bumpMap: textures.stone,
      bumpScale: 0.03,
      color: 0xd3c4b0,
      roughness: 0.83,
      metalness: 0,
      envMapIntensity: 0.3
    }),
    cove: new THREE.MeshStandardMaterial({
      color: 0xcfc0ad,
      roughness: 1,
      metalness: 0,
      bumpMap: textures.plaster,
      bumpScale: 0.04
    }),
    black: physicalMaterial({
      color: 0x151510,
      roughness: 0.46,
      metalness: 0.2,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
      envMapIntensity: 0.55
    }),
    led: new THREE.MeshStandardMaterial({
      color: 0x3b1c0d,
      emissive: 0xffa146,
      emissiveIntensity: 0.1,
      roughness: 0.25,
      metalness: 0
    }),
    hidden: new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      colorWrite: false,
      side: THREE.DoubleSide
    })
  };

  /* ------------------------------------------------------------------
     Geometry helpers
     ------------------------------------------------------------------ */

  function roundedRectShape(width, height, radius) {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;
    const r = Math.min(radius, width / 2 - 0.0005, height / 2 - 0.0005);
    shape.moveTo(x + r, y);
    shape.lineTo(x + width - r, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + r);
    shape.lineTo(x + width, y + height - r);
    shape.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    shape.lineTo(x + r, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - r);
    shape.lineTo(x, y + r);
    shape.quadraticCurveTo(x, y, x + r, y);
    shape.closePath();
    return shape;
  }

  function applyBoxUV(geometry) {
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const pos = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const nx = Math.abs(normal.getX(i));
      const ny = Math.abs(normal.getY(i));
      const nz = Math.abs(normal.getZ(i));
      let u;
      let v;
      if (ny >= nx && ny >= nz) {
        u = (x - bbox.min.x) / size.x;
        v = (z - bbox.min.z) / size.z;
      } else if (nz >= nx) {
        u = (x - bbox.min.x) / size.x;
        v = (y - bbox.min.y) / size.y;
      } else {
        u = (z - bbox.min.z) / size.z;
        v = (y - bbox.min.y) / size.y;
      }
      uv[i * 2] = u;
      uv[i * 2 + 1] = v;
    }
    geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  }

  function roundedBoxGeometry(width, height, depth, radius, bevel) {
    const b = Math.min(bevel === undefined ? 0.014 : bevel, height * 0.34, width * 0.2, depth * 0.2);
    const innerW = Math.max(width - b * 2, 0.002);
    const innerD = Math.max(depth - b * 2, 0.002);
    const shape = roundedRectShape(innerW, innerD, Math.min(radius, innerW / 2, innerD / 2));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(height - b * 2, 0.002),
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: b,
      bevelThickness: b,
      curveSegments: 8
    });
    geo.center();
    geo.rotateX(Math.PI / 2);
    applyBoxUV(geo);
    geo.computeVertexNormals();
    return geo;
  }

  function addRoundedBox(parent, width, height, depth, radius, x, y, z, material, options) {
    options = options || {};
    const geometry = roundedBoxGeometry(width, height, depth, radius, options.bevel);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = options.castShadow !== false;
    mesh.receiveShadow = options.receiveShadow !== false;
    parent.add(mesh);
    return mesh;
  }

  function createGearGeometry(teeth, outerRadius, rootRadius, holeRadius, thickness) {
    const shape = new THREE.Shape();
    const steps = teeth * 4;
    for (let i = 0; i < steps; i++) {
      const segment = i / steps;
      const toothPhase = (i % 4) / 4;
      const r = toothPhase < 0.5 ? outerRadius : rootRadius;
      const angle = segment * TAU;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    const hole = new THREE.Path();
    hole.absarc(0, 0, holeRadius, 0, TAU, true);
    shape.holes.push(hole);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.005,
      bevelThickness: 0.004,
      curveSegments: 12,
      steps: 1
    });
    geometry.center();
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }

  /* ------------------------------------------------------------------
     Environment map
     ------------------------------------------------------------------ */

  function buildEnvironment() {
    const envScene = new THREE.Scene();
    const envCanvas = makeCanvas(1024, 512);
    const ctx = envCanvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, "#fff7e8");
    grad.addColorStop(0.22, "#e6d3b7");
    grad.addColorStop(0.5, "#bfa98b");
    grad.addColorStop(0.78, "#7a6650");
    grad.addColorStop(1, "#4d3d2d");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);
    // A warm sun and a softbox-shaped highlight for metal reflections.
    const sun = ctx.createRadialGradient(760, 120, 0, 760, 120, 160);
    sun.addColorStop(0, "rgba(255,251,237,1)");
    sun.addColorStop(0.22, "rgba(255,239,213,0.72)");
    sun.addColorStop(1, "rgba(255,230,196,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(560, 0, 400, 340);
    ctx.fillStyle = "rgba(255,248,235,0.82)";
    ctx.fillRect(190, 96, 250, 118);
    ctx.fillStyle = "rgba(216,232,235,0.34)";
    ctx.fillRect(720, 230, 190, 100);
    const envTexture = new THREE.CanvasTexture(envCanvas);
    envTexture.mapping = THREE.EquirectangularReflectionMapping;
    if ("colorSpace" in envTexture) envTexture.colorSpace = THREE.SRGBColorSpace;
    envTexture.needsUpdate = true;
    envScene.background = envTexture;

    const panelGeometry = new THREE.PlaneGeometry(8, 5);
    const keyPanel = new THREE.Mesh(
      panelGeometry,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(3.6, 3.18, 2.6),
        side: THREE.DoubleSide
      })
    );
    keyPanel.position.set(-8, 7, 6);
    keyPanel.lookAt(0, 1, 0);
    envScene.add(keyPanel);

    const fillPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 4),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.5, 0.66, 0.82),
        side: THREE.DoubleSide
      })
    );
    fillPanel.position.set(9, 4, 4);
    fillPanel.lookAt(0, 1, 0);
    envScene.add(fillPanel);

    const rimPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 3),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(2.2, 1.45, 0.9),
        side: THREE.DoubleSide
      })
    );
    rimPanel.position.set(2, 4, -9);
    rimPanel.lookAt(0, 1, 0);
    envScene.add(rimPanel);

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const renderTarget = pmrem.fromScene(envScene, 0.035);
    scene.environment = renderTarget.texture;
    pmrem.dispose();
    keyPanel.geometry.dispose();
    keyPanel.material.dispose();
    fillPanel.geometry.dispose();
    fillPanel.material.dispose();
    rimPanel.geometry.dispose();
    rimPanel.material.dispose();
    envTexture.dispose();
  }

  buildEnvironment();

  /* ------------------------------------------------------------------
     Studio set: a seamless cyclorama and stone display dais
     ------------------------------------------------------------------ */

  const stageTop = 0.34;

  function buildCyclorama() {
    const xSegments = 26;
    const floorSegments = 14;
    const arcSegments = 26;
    const wallSegments = 6;
    const halfWidth = 19;
    const path = [];

    for (let i = 0; i <= floorSegments; i++) {
      const t = i / floorSegments;
      path.push({ y: 0, z: lerp(13, -2.8, t) });
    }
    for (let i = 1; i <= arcSegments; i++) {
      const t = i / arcSegments;
      const angle = -Math.PI / 2 - t * (Math.PI / 2);
      path.push({
        y: 4 + Math.sin(angle) * 4,
        z: -2.8 + Math.cos(angle) * 4
      });
    }
    for (let i = 1; i <= wallSegments; i++) {
      const t = i / wallSegments;
      path.push({ y: lerp(4, 13, t), z: -6.8 });
    }

    const positions = [];
    const uvs = [];
    const indices = [];
    const rowCount = path.length;
    let pathLength = 0;
    const pathLengths = [0];
    for (let j = 1; j < rowCount; j++) {
      const dy = path[j].y - path[j - 1].y;
      const dz = path[j].z - path[j - 1].z;
      pathLength += Math.sqrt(dy * dy + dz * dz);
      pathLengths.push(pathLength);
    }

    for (let i = 0; i <= xSegments; i++) {
      const x = lerp(-halfWidth, halfWidth, i / xSegments);
      for (let j = 0; j < rowCount; j++) {
        positions.push(x, path[j].y, path[j].z);
        uvs.push((x + halfWidth) / 7.5, pathLengths[j] / 7.5);
      }
    }
    for (let i = 0; i < xSegments; i++) {
      for (let j = 0; j < rowCount - 1; j++) {
        const a = i * rowCount + j;
        const b = (i + 1) * rowCount + j;
        const c = i * rowCount + j + 1;
        const d = (i + 1) * rowCount + j + 1;
        indices.push(a, b, c, b, d, c);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, materials.cove);
    mesh.receiveShadow = true;
    scene.add(mesh);

    // Very faint dust in the light.
    const random = seededRandom(11);
    const dustCount = 100;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSeeds = [];
    for (let i = 0; i < dustCount; i++) {
      const x = (random() - 0.5) * 10;
      const y = 0.45 + random() * 4.2;
      const z = -2.6 + random() * 7;
      dustPositions[i * 3] = x;
      dustPositions[i * 3 + 1] = y;
      dustPositions[i * 3 + 2] = z;
      dustSeeds.push({ x, y, z, phase: random() * TAU, speed: 0.04 + random() * 0.09, amp: 0.05 + random() * 0.14 });
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      color: 0xfff1d7,
      size: 0.018,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      sizeAttenuation: true
    });
    const dust = new THREE.Points(dustGeometry, dustMaterial);
    dust.frustumCulled = false;
    scene.add(dust);

    return { dust, dustSeeds };
  }

  const cyclorama = buildCyclorama();

  function makeSoftShadowTexture() {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 512, 512);
    ctx.save();
    ctx.filter = "blur(28px)";
    ctx.fillStyle = "rgba(20, 12, 6, 0.62)";
    roundRect(ctx, 92, 92, 328, 328, 68);
    ctx.fill();
    ctx.restore();
    // A second, tighter pass gives the object a convincing point of contact.
    ctx.save();
    ctx.filter = "blur(12px)";
    ctx.fillStyle = "rgba(16, 9, 4, 0.38)";
    roundRect(ctx, 138, 138, 236, 236, 48);
    ctx.fill();
    ctx.restore();
    return finishTexture(new THREE.CanvasTexture(c));
  }

  function buildDais() {
    const profile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(2.25, 0),
      new THREE.Vector2(2.42, 0.022),
      new THREE.Vector2(2.5, 0.08),
      new THREE.Vector2(2.5, 0.23),
      new THREE.Vector2(2.45, 0.3),
      new THREE.Vector2(2.34, 0.34),
      new THREE.Vector2(0, 0.34)
    ];
    const geo = new THREE.LatheGeometry(profile, 96);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, materials.stone);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    // A narrow recessed shadow gap beneath the dais.
    const under = new THREE.Mesh(
      new THREE.CylinderGeometry(2.23, 2.28, 0.05, 96),
      new THREE.MeshStandardMaterial({ color: 0x7f6e5a, roughness: 1 })
    );
    under.position.y = 0.016;
    under.receiveShadow = true;
    under.castShadow = false;
    scene.add(under);

    const shadowMaterial = new THREE.MeshBasicMaterial({
      map: makeSoftShadowTexture(),
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      color: 0x22160b
    });
    const contactShadow = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.35), shadowMaterial);
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.set(0, 0.343, 0.04);
    contactShadow.renderOrder = 1;
    scene.add(contactShadow);

    const inlay = new THREE.Mesh(
      new THREE.TorusGeometry(2.285, 0.006, 8, 128),
      new THREE.MeshStandardMaterial({ color: 0x80643f, metalness: 0.9, roughness: 0.48 })
    );
    inlay.rotation.x = Math.PI / 2;
    inlay.position.y = 0.344;
    scene.add(inlay);
    return mesh;
  }

  buildDais();

  /* ------------------------------------------------------------------
     Lighting
     ------------------------------------------------------------------ */

  const lights = {};

  function buildLights() {
    const hemi = new THREE.HemisphereLight(0xfff4e4, 0x786550, 0.78);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffe6c4, 3.35);
    key.position.set(-4.8, 7.4, 5.2);
    key.target.position.set(0, 0.9, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 24;
    key.shadow.camera.left = -6.4;
    key.shadow.camera.right = 6.4;
    key.shadow.camera.top = 6.4;
    key.shadow.camera.bottom = -4.7;
    key.shadow.bias = -0.00035;
    key.shadow.normalBias = 0.022;
    key.shadow.radius = 3;
    scene.add(key);
    scene.add(key.target);

    const fill = new THREE.DirectionalLight(0xc9d8df, 0.58);
    fill.position.set(6, 3.4, 4.5);
    fill.target.position.set(0, 0.9, 0);
    scene.add(fill);
    scene.add(fill.target);

    const rim = new THREE.DirectionalLight(0xffd2a0, 1.9);
    rim.position.set(4.5, 5.2, -6.5);
    rim.target.position.set(0, 1.2, 0);
    scene.add(rim);
    scene.add(rim.target);

    const glow = new THREE.PointLight(0xffb069, 0, 4.2, 2);
    glow.position.set(0, 1.68, -0.22);
    scene.add(glow);

    const ledLight = new THREE.PointLight(0xffb46a, 0, 1.4, 2);
    lights.key = key;
    lights.fill = fill;
    lights.rim = rim;
    lights.hemi = hemi;
    lights.interior = glow;
    lights.led = ledLight;
  }

  buildLights();

  /* ------------------------------------------------------------------
     Camera choreography
     ------------------------------------------------------------------ */

  const cameraRig = {
    introStart: performance.now(),
    introDuration: 2300,
    introMix: 0,
    px: 0,
    py: 0,
    pointerX: 0,
    pointerY: 0,
    currentPos: new THREE.Vector3(),
    currentTarget: new THREE.Vector3(),
    initialized: false,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches
  };

  function getCameraProfile() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = Math.max(0.35, w / h);
    const mobile = w <= 900;
    const landscapePhone = mobile && aspect > 1.25;
    const fov = mobile ? 33 : 30;
    let distance;
    let target;
    let elevation;
    let azimuth;

    if (landscapePhone) {
      // Short landscape screens need a wider, lower composition for the title.
      distance = 12.6;
      target = new THREE.Vector3(-0.3, 1.52, 0);
      elevation = 18.5 * DEG;
      azimuth = 22 * DEG;
    } else if (mobile) {
      const shortPhone = w <= 620 && h <= 750;
      const desiredWidth = 4.7;
      distance = (desiredWidth * 0.5) / (Math.tan((fov * DEG) / 2) * aspect);
      distance = clamp(distance, 11.8, 18.8);
      if (shortPhone) {
        distance *= 1.15;
        target = new THREE.Vector3(-0.36, 2.75, 0);
      } else {
        target = new THREE.Vector3(-0.36, 2.24, 0);
      }
      elevation = 21 * DEG;
      azimuth = 20 * DEG;
    } else {
      // At narrower desktop widths the left-hand editorial column needs more
      // room, so the camera pulls back and the specimen shifts to the right.
      let targetX = -0.6;
      if (w <= 1060) {
        distance = 13.0;
        targetX = -1.1;
      } else if (w <= 1200) {
        distance = 12.0;
        targetX = -0.9;
      } else if (w <= 1320) {
        distance = 10.6;
        targetX = -0.78;
      } else {
        distance = aspect < 1.45 ? 9.5 : 9.1;
      }
      target = new THREE.Vector3(targetX, 1.55, 0);
      elevation = 20.5 * DEG;
      azimuth = 23.5 * DEG;
    }
    return {
      mobile,
      fov,
      distance,
      azimuth,
      elevation,
      target
    };
  }

  let cameraProfile = getCameraProfile();

  function updateCamera(dt, elapsed, openFactor) {
    const profile = cameraProfile;
    const reduced = cameraRig.reducedMotion;
    const introTarget = reduced ? 1 : easeOutCubic(clamp((performance.now() - cameraRig.introStart) / cameraRig.introDuration, 0, 1));

    cameraRig.pointerX = damp(cameraRig.pointerX, cameraRig.px, 4.6, dt);
    cameraRig.pointerY = damp(cameraRig.pointerY, cameraRig.py, 4.6, dt);

    const pointerInfluence = reduced ? 0 : profile.mobile ? 0.25 : 1;
    const px = cameraRig.pointerX * pointerInfluence;
    const py = cameraRig.pointerY * pointerInfluence;
    const introEase = introTarget;
    const boost = 1 + (1 - introEase) * (profile.mobile ? 0.045 : 0.1);

    const openLift = reduced ? 0 : smoothstep(openFactor);
    const az = profile.azimuth + px * 0.022 + (1 - introEase) * 0.035 + openLift * 0.018;
    const el = profile.elevation - py * 0.014 + (1 - introEase) * 0.028 + openLift * 3.2 * DEG;
    const dist = profile.distance * boost * (1 - openLift * 0.012);
    const target = profile.target.clone();
    target.y += (1 - introEase) * 0.1;
    target.x += (1 - introEase) * 0.08;
    target.y += openLift * 0.11;
    target.x += openLift * 0.035;
    target.z += px * 0.018;

    const dir = new THREE.Vector3(
      Math.sin(az) * Math.cos(el),
      Math.sin(el),
      Math.cos(az) * Math.cos(el)
    );
    const desiredPos = target.clone().addScaledVector(dir, dist);

    if (!cameraRig.initialized) {
      cameraRig.currentPos.copy(desiredPos);
      cameraRig.currentTarget.copy(target);
      cameraRig.initialized = true;
    } else {
      const follow = cameraRig.reducedMotion ? 1 : 3.9;
      cameraRig.currentPos.x = damp(cameraRig.currentPos.x, desiredPos.x, follow, dt);
      cameraRig.currentPos.y = damp(cameraRig.currentPos.y, desiredPos.y, follow, dt);
      cameraRig.currentPos.z = damp(cameraRig.currentPos.z, desiredPos.z, follow, dt);
      cameraRig.currentTarget.x = damp(cameraRig.currentTarget.x, target.x, follow, dt);
      cameraRig.currentTarget.y = damp(cameraRig.currentTarget.y, target.y, follow, dt);
      cameraRig.currentTarget.z = damp(cameraRig.currentTarget.z, target.z, follow, dt);
    }

    camera.fov = profile.fov;
    camera.position.copy(cameraRig.currentPos);
    camera.lookAt(cameraRig.currentTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    cameraProfile = getCameraProfile();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    cameraRig.initialized = false;
  }

  window.addEventListener("resize", resize, { passive: true });

  /* ------------------------------------------------------------------
     The Useless Machine
     ------------------------------------------------------------------ */

  const machineRoot = new THREE.Group();
  machineRoot.position.y = stageTop;
  machineRoot.name = "useless-machine";
  scene.add(machineRoot);

  machineRoot.add(lights.interior);
  lights.interior.position.set(0, 1.48, -0.2);
  lights.interior.intensity = 0;
  machineRoot.add(lights.led);
  lights.led.position.set(0, 1.79, 1.0);
  lights.led.intensity = 0;

  const machineParts = {
    machineRoot,
    interactionObjects: [],
    hoverRing: null,
    led: null,
    ledGlow: null,
    lidGroup: null,
    leverGroup: null,
    knob: null,
    arm: null,
    gears: []
  };

  function addPlane(parent, width, height, material, x, y, z, rx, ry, rz) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx || 0, ry || 0, rz || 0);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    parent.add(mesh);
    return mesh;
  }

  function markShadows(group) {
    group.traverse(function (child) {
      if (child.isMesh && child.material !== materials.hidden) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  function buildMachineBody() {
    const brassFootProfile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.1, 0),
      new THREE.Vector2(0.125, 0.022),
      new THREE.Vector2(0.095, 0.068),
      new THREE.Vector2(0.07, 0.1),
      new THREE.Vector2(0.079, 0.125),
      new THREE.Vector2(0.055, 0.142),
      new THREE.Vector2(0, 0.142)
    ];
    const footGeometry = new THREE.LatheGeometry(brassFootProfile, 28);
    const footPositions = [
      [-1.33, 0.0, -0.81],
      [1.33, 0.0, -0.81],
      [-1.33, 0.0, 0.81],
      [1.33, 0.0, 0.81]
    ];
    footPositions.forEach(function (p) {
      const foot = new THREE.Mesh(footGeometry, materials.brassDark);
      foot.position.set(p[0], p[1], p[2]);
      foot.castShadow = true;
      foot.receiveShadow = true;
      machineRoot.add(foot);
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 0.012, 20),
        new THREE.MeshStandardMaterial({ color: 0x2c241b, roughness: 0.96 })
      );
      pad.position.set(p[0], 0.005, p[2]);
      pad.castShadow = false;
      pad.receiveShadow = true;
      machineRoot.add(pad);
    });

    // Overhanging plinth and the four wooden walls.
    addRoundedBox(machineRoot, 3.34, 0.1, 2.34, 0.07, 0, 0.17, 0, materials.woodDark, { bevel: 0.025 });
    addRoundedBox(machineRoot, 3.18, 1.36, 0.14, 0.035, 0, 0.9, 1.03, materials.wood);
    addRoundedBox(machineRoot, 3.18, 1.36, 0.14, 0.035, 0, 0.9, -1.03, materials.wood);
    addRoundedBox(machineRoot, 0.14, 1.36, 1.92, 0.035, -1.52, 0.9, 0, materials.wood);
    addRoundedBox(machineRoot, 0.14, 1.36, 1.92, 0.035, 1.52, 0.9, 0, materials.wood);

    // A raised frame-and-panel front, so the face catches light like cabinetry.
    addRoundedBox(machineRoot, 2.94, 1.16, 0.018, 0.055, 0, 0.87, 1.1, materials.woodDark, { bevel: 0.012 });
    addRoundedBox(machineRoot, 2.82, 1.04, 0.022, 0.045, 0, 0.87, 1.108, materials.wood, { bevel: 0.012 });

    // Matching side panels are mostly felt as edge shadows.
    [-1, 1].forEach(function (side) {
      addRoundedBox(machineRoot, 0.018, 1.02, 1.62, 0.05, side * 1.59, 0.91, -0.06, materials.woodDark, {
        bevel: 0.012
      });
      addRoundedBox(machineRoot, 0.022, 0.9, 1.5, 0.042, side * 1.598, 0.91, -0.06, materials.wood, {
        bevel: 0.011
      });
    });

    // A fine brass line near the bottom edge.
    const trimGeometry = new THREE.BoxGeometry(3.08, 0.009, 0.008);
    const trimFront = new THREE.Mesh(trimGeometry, materials.brassDark);
    trimFront.position.set(0, 0.3, 1.104);
    machineRoot.add(trimFront);
    const trimBack = trimFront.clone();
    trimBack.position.z = -1.104;
    machineRoot.add(trimBack);
    const sideTrimGeometry = new THREE.BoxGeometry(0.008, 0.009, 1.86);
    const trimLeft = new THREE.Mesh(sideTrimGeometry, materials.brassDark);
    trimLeft.position.set(-1.594, 0.3, 0);
    machineRoot.add(trimLeft);
    const trimRight = trimLeft.clone();
    trimRight.position.x = 1.594;
    machineRoot.add(trimRight);

    // Interior: a dark green velvet-lined cavity.
    const linerMaterial = materials.velvet;
    addPlane(machineRoot, 1.75, 1.22, linerMaterial, -1.442, 0.89, -0.01, 0, Math.PI / 2, 0);
    addPlane(machineRoot, 1.75, 1.22, linerMaterial, 1.442, 0.89, -0.01, 0, -Math.PI / 2, 0);
    addPlane(machineRoot, 2.82, 1.22, linerMaterial, 0, 0.89, -0.95, 0, 0, 0);
    addPlane(machineRoot, 2.82, 1.22, linerMaterial, 0, 0.89, 0.89, 0, Math.PI, 0);
    addPlane(machineRoot, 2.82, 1.78, linerMaterial, 0, 0.255, -0.03, -Math.PI / 2, 0, 0);

    // The small padded platform that houses the arm.
    addRoundedBox(machineRoot, 0.72, 0.06, 0.58, 0.045, 0, 0.285, -0.44, materials.leather, { bevel: 0.012 });

    // Internal mechanical dressing: gears, a service plate and an ivory dial.
    const gearA = new THREE.Mesh(createGearGeometry(20, 0.29, 0.225, 0.062, 0.036), materials.brassDark);
    gearA.position.set(0.76, 0.278, -0.57);
    gearA.rotation.y = 0.21;
    gearA.castShadow = true;
    gearA.receiveShadow = true;
    machineRoot.add(gearA);
    machineParts.gears.push({ mesh: gearA, speed: 0.22, phase: 0.4 });

    const gearB = new THREE.Mesh(createGearGeometry(14, 0.21, 0.154, 0.042, 0.032), materials.brassSoft);
    gearB.position.set(-0.72, 0.272, -0.64);
    gearB.rotation.y = -0.16;
    gearB.castShadow = true;
    gearB.receiveShadow = true;
    machineRoot.add(gearB);
    machineParts.gears.push({ mesh: gearB, speed: -0.31, phase: 1.2 });

    const gearHubMaterial = materials.brass;
    [gearA, gearB].forEach(function (gear) {
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.055, 20), gearHubMaterial);
      hub.position.copy(gear.position);
      hub.position.y += 0.028;
      hub.castShadow = true;
      hub.receiveShadow = true;
      machineRoot.add(hub);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.07, 12), materials.brassDark);
      pin.position.copy(hub.position);
      pin.position.y += 0.034;
      machineRoot.add(pin);
    });

    addRoundedBox(machineRoot, 0.76, 0.42, 0.025, 0.025, 0.25, 1.12, -0.932, materials.brassDark, {
      bevel: 0.008
    });
    const dialRing = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.009, 8, 40), materials.brass);
    dialRing.position.set(0.25, 1.13, -0.916);
    machineRoot.add(dialRing);
    const dialFace = new THREE.Mesh(new THREE.CircleGeometry(0.09, 32), materials.ivoryWarm);
    dialFace.position.set(0.25, 1.13, -0.918);
    machineRoot.add(dialFace);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.075, 0.004), materials.black);
    needle.position.set(0.267, 1.15, -0.912);
    needle.rotation.z = -0.55;
    machineRoot.add(needle);
    const screwGeometry = new THREE.SphereGeometry(0.013, 10, 8);
    [-0.54, 0.79].forEach(function (x, i) {
      const screw = new THREE.Mesh(screwGeometry, materials.brass);
      screw.scale.z = 0.45;
      screw.position.set(x, i ? 1.3 : 0.94, -0.916);
      machineRoot.add(screw);
    });

    // Two small gears are mounted on the rear service wall. They are only
    // visible once the lid is open, and give the cavity a little machinery.
    function addRearGear(x, y, teeth, radius, speed) {
      const mount = new THREE.Group();
      mount.position.set(x, y, -0.938);
      mount.rotation.x = Math.PI / 2;
      machineRoot.add(mount);
      const gear = new THREE.Mesh(createGearGeometry(teeth, radius, radius * 0.78, radius * 0.25, 0.026), materials.brassDark);
      gear.castShadow = true;
      gear.receiveShadow = true;
      gear.rotation.y = 0.23;
      mount.add(gear);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.23, 0.06, 18), materials.brass);
      hub.rotation.x = Math.PI / 2;
      hub.position.set(x, y, -0.92);
      hub.castShadow = true;
      machineRoot.add(hub);
      machineParts.gears.push({ mesh: gear, speed: speed, phase: 0.8 });
    }
    addRearGear(-0.64, 1.03, 18, 0.23, 0.42);
    addRearGear(-0.25, 0.83, 11, 0.145, -0.7);

    // Lid resting on the back edge, hinged at the rear.
    const lidGroup = new THREE.Group();
    lidGroup.position.set(0, 1.63, -1.02);
    machineRoot.add(lidGroup);
    const lid = addRoundedBox(lidGroup, 3.2, 0.11, 1.32, 0.05, 0, 0.055, 0.66, materials.wood, { bevel: 0.022 });
    lid.receiveShadow = true;

    // A softly raised field on top of the lid.
    addRoundedBox(lidGroup, 2.88, 0.014, 1.06, 0.04, 0, 0.117, 0.66, materials.wood, { bevel: 0.008 });

    // Inlaid geometric decoration on the lid. MeshBasic keeps the fine gold
    // lines legible instead of letting them disappear in the reflections.
    const inlayMaterial = new THREE.MeshBasicMaterial({
      map: textures.lidInlay,
      transparent: true,
      opacity: 1,
      alphaTest: 0.01,
      depthWrite: false,
      toneMapped: false
    });
    const inlay = addPlane(lidGroup, 2.56, 1.0, inlayMaterial, 0, 0.13, 0.66, -Math.PI / 2, 0, 0);
    inlay.renderOrder = 3;

    // A physical brass border gives the inlay a real, raking-light presence.
    const inlayFrameMaterial = materials.brassSoft;
    const frameY = 0.1265;
    [-1.26, 1.26].forEach(function (x) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.005, 0.79), inlayFrameMaterial);
      rail.position.set(x, frameY, 0.66);
      rail.castShadow = false;
      rail.receiveShadow = true;
      lidGroup.add(rail);
    });
    [0.265, 1.055].forEach(function (z) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.53, 0.005, 0.012), inlayFrameMaterial);
      rail.position.set(0, frameY, z);
      rail.castShadow = false;
      rail.receiveShadow = true;
      lidGroup.add(rail);
    });
    [
      [-1.26, 0.265],
      [1.26, 0.265],
      [-1.26, 1.055],
      [1.26, 1.055]
    ].forEach(function (corner) {
      const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.004, 16), inlayFrameMaterial);
      dot.position.set(corner[0], frameY + 0.001, corner[1]);
      lidGroup.add(dot);
    });

    const lidMedallion = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.0075, 8, 64), materials.brassSoft);
    lidMedallion.rotation.x = -Math.PI / 2;
    lidMedallion.position.set(0, 0.1265, 0.66);
    lidMedallion.castShadow = false;
    lidGroup.add(lidMedallion);
    const lidMedallionInner = new THREE.Mesh(new THREE.TorusGeometry(0.215, 0.0035, 6, 64), materials.brassSoft);
    lidMedallionInner.rotation.x = -Math.PI / 2;
    lidMedallionInner.position.set(0, 0.1265, 0.66);
    lidGroup.add(lidMedallionInner);

    // The underside of the lid is lined with velvet and a polite note.
    addPlane(
      lidGroup,
      2.9,
      1.06,
      new THREE.MeshPhysicalMaterial({
        map: textures.velvet,
        color: 0xffffff,
        roughness: 0.92,
        sheen: 0.8,
        sheenColor: new THREE.Color(0x91a18d),
        sheenRoughness: 0.74
      }),
      0,
      -0.0014,
      0.66,
      Math.PI / 2,
      0,
      0
    );
    const innerPlaqueMaterial = new THREE.MeshBasicMaterial({
      map: textures.innerPlaque,
      transparent: true,
      depthWrite: false,
      toneMapped: true
    });
    const innerPlaque = addPlane(lidGroup, 1.38, 0.474, innerPlaqueMaterial, 0, -0.0042, 0.68, Math.PI / 2, 0, 0);
    innerPlaque.renderOrder = 3;

    // Hinge hardware: two compact barrel hinges, without a rod floating
    // across the cavity when the lid is open.
    const hingeY = 1.644;
    const hingeZ = -1.017;
    [-0.86, 0.86].forEach(function (x) {
      const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.29, 24), materials.brass);
      knuckle.rotation.z = Math.PI / 2;
      knuckle.position.set(x, hingeY, hingeZ);
      knuckle.castShadow = true;
      machineRoot.add(knuckle);
      const collarA = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.009, 8, 20), materials.brassDark);
      collarA.rotation.y = Math.PI / 2;
      collarA.position.set(x - 0.155, hingeY, hingeZ);
      machineRoot.add(collarA);
      const collarB = collarA.clone();
      collarB.position.x = x + 0.155;
      machineRoot.add(collarB);
      addRoundedBox(lidGroup, 0.24, 0.016, 0.25, 0.012, x, 0.009, 0.018, materials.brass, {
        bevel: 0.005,
        castShadow: false
      });
      addRoundedBox(machineRoot, 0.24, 0.016, 0.24, 0.012, x, 1.573, -1.047, materials.brass, {
        bevel: 0.005,
        castShadow: false
      });
    });

    // Front control deck above the interior cavity.
    addRoundedBox(machineRoot, 3.14, 0.08, 0.78, 0.04, 0, 1.57, 0.69, materials.wood);
    addRoundedBox(machineRoot, 1.11, 0.024, 0.59, 0.06, 0, 1.616, 0.68, materials.brass, { bevel: 0.009 });
    addRoundedBox(machineRoot, 1.055, 0.024, 0.535, 0.052, 0, 1.63, 0.68, materials.leather, { bevel: 0.008 });

    const labelMaterialOn = new THREE.MeshBasicMaterial({
      map: textures.labelOn,
      transparent: true,
      depthWrite: false,
      toneMapped: false
    });
    const labelMaterialOff = new THREE.MeshBasicMaterial({
      map: textures.labelOff,
      transparent: true,
      depthWrite: false,
      toneMapped: false
    });
    const labelOn = addPlane(machineRoot, 0.25, 0.125, labelMaterialOn, 0.335, 1.647, 0.85, -Math.PI / 2, 0, 0);
    labelOn.renderOrder = 3;
    const labelOff = addPlane(machineRoot, 0.25, 0.125, labelMaterialOff, -0.335, 1.647, 0.85, -Math.PI / 2, 0, 0);
    labelOff.renderOrder = 3;

    // LED and its brass escutcheon.
    const ledBase = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.018, 24), materials.brass);
    ledBase.position.set(0, 1.611, 0.99);
    machineRoot.add(ledBase);
    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.033, 20, 12, 0, TAU, 0, Math.PI * 0.5),
      materials.led
    );
    led.scale.set(1, 0.72, 1);
    led.position.set(0, 1.622, 0.99);
    machineRoot.add(led);
    machineParts.led = led;

    const glowMaterial = new THREE.SpriteMaterial({
      map: textures.glow,
      color: 0xffb466,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: true
    });
    const ledGlow = new THREE.Sprite(glowMaterial);
    ledGlow.position.set(0, 1.655, 0.99);
    ledGlow.scale.set(0.48, 0.48, 1);
    machineRoot.add(ledGlow);
    machineParts.ledGlow = ledGlow;

    // Front maker's plaque.
    addRoundedBox(machineRoot, 1.0, 0.35, 0.024, 0.035, 0, 0.84, 1.121, materials.brassDark, {
      bevel: 0.008
    });
    const plaqueMaterial = new THREE.MeshStandardMaterial({
      map: textures.plaque,
      roughness: 0.49,
      metalness: 0.18,
      envMapIntensity: 0.52
    });
    addPlane(machineRoot, 0.942, 0.312, plaqueMaterial, 0, 0.84, 1.134, 0, 0, 0);

    // Tiny keyhole below the plaque.
    const keyholeRing = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.006, 8, 24), materials.brassDark);
    keyholeRing.position.set(0, 0.59, 1.122);
    machineRoot.add(keyholeRing);
    const keyhole = new THREE.Mesh(new THREE.CircleGeometry(0.015, 18), materials.black);
    keyhole.position.set(0, 0.59, 1.124);
    machineRoot.add(keyhole);
    const keySlot = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.052, 0.003), materials.black);
    keySlot.position.set(0, 0.555, 1.124);
    machineRoot.add(keySlot);

    machineParts.lidGroup = lidGroup;
    machineParts.lid = lid;
  }

  buildMachineBody();

  function buildLever() {
    const pivotY = 1.655;
    const pivotZ = 0.68;
    const deckTop = 1.6435;

    const bezel = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.178, 0.028, 36), materials.brass);
    bezel.position.set(0, deckTop + 0.014, pivotZ);
    bezel.castShadow = true;
    bezel.receiveShadow = true;
    machineRoot.add(bezel);

    const bezelInset = new THREE.Mesh(new THREE.CylinderGeometry(0.126, 0.132, 0.014, 32), materials.black);
    bezelInset.position.set(0, deckTop + 0.031, pivotZ);
    machineRoot.add(bezelInset);

    const leverGroup = new THREE.Group();
    leverGroup.position.set(0, pivotY, pivotZ);
    machineRoot.add(leverGroup);

    const pivotPin = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.19, 20), materials.brassDark);
    pivotPin.rotation.x = Math.PI / 2;
    pivotPin.position.set(0, 0, 0);
    pivotPin.castShadow = true;
    machineRoot.add(pivotPin);

    const baseCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.052, 24), materials.brassDark);
    baseCollar.position.y = 0.028;
    leverGroup.add(baseCollar);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.037, 0.42, 20), materials.brass);
    shaft.position.y = 0.235;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    leverGroup.add(shaft);

    const shaftCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 20), materials.brassDark);
    shaftCollar.position.y = 0.335;
    leverGroup.add(shaftCollar);

    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.084, 32, 24), materials.ivory);
    knob.scale.set(1.02, 0.92, 0.92);
    knob.position.y = 0.466;
    knob.castShadow = true;
    knob.receiveShadow = true;
    leverGroup.add(knob);

    const knobCap = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.039, 0.02, 20), materials.brass);
    knobCap.position.y = 0.536;
    knobCap.castShadow = true;
    leverGroup.add(knobCap);

    // An invisible, generous click target around the knob.
    const knobHit = new THREE.Mesh(new THREE.SphereGeometry(0.285, 12, 10), materials.hidden);
    knobHit.position.y = 0.47;
    knobHit.userData.isLeverTarget = true;
    leverGroup.add(knobHit);

    const deckHit = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.35, 12), materials.hidden);
    deckHit.position.set(0, 1.76, pivotZ);
    deckHit.userData.isLeverTarget = true;
    machineRoot.add(deckHit);

    // A quiet brass pulse around the switch.
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd99c,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      toneMapped: true
    });
    const hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.21, 0.228, 64), ringMaterial);
    hoverRing.rotation.x = -Math.PI / 2;
    hoverRing.position.set(0, deckTop + 0.034, pivotZ);
    hoverRing.renderOrder = 4;
    machineRoot.add(hoverRing);

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.245, 0.255, 64),
      new THREE.MeshBasicMaterial({
        color: 0xd5b06f,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(0, deckTop + 0.033, pivotZ);
    halo.renderOrder = 4;
    machineRoot.add(halo);

    machineParts.leverGroup = leverGroup;
    machineParts.knob = knob;
    machineParts.hoverRing = hoverRing;
    machineParts.halo = halo;
    machineParts.interactionObjects.push(knobHit, deckHit);
  }

  buildLever();

  function createPalmGeometry() {
    const shape = new THREE.Shape();
    shape.moveTo(-0.072, 0.075);
    shape.bezierCurveTo(-0.086, 0.16, -0.126, 0.265, -0.132, 0.335);
    shape.quadraticCurveTo(-0.136, 0.382, -0.088, 0.386);
    shape.lineTo(0.088, 0.386);
    shape.quadraticCurveTo(0.136, 0.382, 0.132, 0.335);
    shape.bezierCurveTo(0.126, 0.265, 0.086, 0.16, 0.072, 0.075);
    shape.quadraticCurveTo(0, 0.045, -0.072, 0.075);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.062,
      bevelEnabled: true,
      bevelThickness: 0.024,
      bevelSize: 0.024,
      bevelSegments: 4,
      steps: 1,
      curveSegments: 16
    });
    geo.computeBoundingBox();
    const centerZ = (geo.boundingBox.min.z + geo.boundingBox.max.z) / 2;
    geo.translate(0, 0, -centerZ);
    geo.computeVertexNormals();
    return geo;
  }

  function createHand() {
    const group = new THREE.Group();
    group.name = "ivory-hand";

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.073, 0.094, 0.076, 28), materials.ivoryWarm);
    cuff.position.y = 0.035;
    cuff.castShadow = true;
    cuff.receiveShadow = true;
    group.add(cuff);

    const brassCuff = new THREE.Mesh(new THREE.TorusGeometry(0.091, 0.011, 10, 30), materials.brass);
    brassCuff.rotation.x = Math.PI / 2;
    brassCuff.position.y = 0.002;
    brassCuff.castShadow = true;
    group.add(brassCuff);

    const wristRing = new THREE.Mesh(new THREE.TorusGeometry(0.077, 0.007, 8, 28), materials.brassDark);
    wristRing.rotation.x = Math.PI / 2;
    wristRing.position.y = 0.066;
    group.add(wristRing);

    const palm = new THREE.Mesh(createPalmGeometry(), materials.ivory);
    palm.castShadow = true;
    palm.receiveShadow = true;
    group.add(palm);

    const palmHeel = new THREE.Mesh(new THREE.SphereGeometry(0.071, 20, 14), materials.ivoryWarm);
    palmHeel.scale.set(1.36, 0.85, 0.6);
    palmHeel.position.set(0, 0.095, -0.006);
    palmHeel.castShadow = true;
    group.add(palmHeel);

    // A shallow carved palm line and a small pinch of wrist anatomy.
    const creaseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.082, 0.235, 0.083),
      new THREE.Vector3(-0.025, 0.193, 0.089),
      new THREE.Vector3(0.064, 0.222, 0.083)
    ]);
    const crease = new THREE.Mesh(new THREE.TubeGeometry(creaseCurve, 16, 0.0032, 6, false), materials.ivoryWarm);
    group.add(crease);
    const creaseCurve2 = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.113, 0.237, 0.075),
      new THREE.Vector3(-0.055, 0.282, 0.085),
      new THREE.Vector3(0.055, 0.285, 0.085)
    ]);
    const crease2 = new THREE.Mesh(new THREE.TubeGeometry(creaseCurve2, 16, 0.0025, 6, false), materials.ivoryWarm);
    group.add(crease2);

    const fingers = [];
    const fingerDefinitions = [
      { x: -0.106, spread: 0.13, radius: 0.029, lengths: [0.118, 0.077, 0.052] },
      { x: -0.037, spread: 0.04, radius: 0.031, lengths: [0.132, 0.085, 0.057] },
      { x: 0.033, spread: -0.05, radius: 0.03, lengths: [0.124, 0.081, 0.053] },
      { x: 0.102, spread: -0.135, radius: 0.0255, lengths: [0.098, 0.065, 0.044] }
    ];

    fingerDefinitions.forEach(function (definition, fingerIndex) {
      const root = new THREE.Group();
      root.position.set(definition.x, 0.388, 0.022);
      root.rotation.z = definition.spread;
      group.add(root);

      const finger = { root, segments: [], baseSpread: definition.spread };
      let parent = root;
      for (let s = 0; s < definition.lengths.length; s++) {
        const length = definition.lengths[s];
        const radius = definition.radius * (1 - s * 0.075);
        const pivot = new THREE.Group();
        if (s > 0) pivot.position.y = definition.lengths[s - 1];
        parent.add(pivot);

        const capsule = new THREE.Mesh(
          new THREE.CapsuleGeometry(radius, Math.max(0.012, length - radius * 2), 4, 10),
          s === 2 ? materials.ivoryWarm : materials.ivory
        );
        capsule.position.y = length / 2;
        capsule.castShadow = true;
        capsule.receiveShadow = true;
        pivot.add(capsule);

        if (s > 0) {
          const knuckle = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.02, 12, 8), materials.ivory);
          knuckle.scale.set(1.08, 0.82, 0.9);
          knuckle.castShadow = true;
          pivot.add(knuckle);
          const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, radius * 2.35, 8), materials.brassSoft);
          pin.rotation.z = Math.PI / 2;
          pin.position.set(0, 0.002, -0.002);
          pivot.add(pin);
        }

        if (s === 2) {
          const nail = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), materials.ivoryWarm);
          nail.scale.set(radius * 0.69, length * 0.31, 0.0075);
          nail.position.set(0, length * 0.52, -radius * 0.82);
          pivot.add(nail);
        }

        finger.segments.push({ pivot, length });
        parent = pivot;
      }
      fingers.push(finger);
    });

    // Knuckle pads at the top of the palm.
    for (let i = 0; i < 4; i++) {
      const knuckle = new THREE.Mesh(new THREE.SphereGeometry(0.037, 12, 10), materials.ivoryWarm);
      knuckle.scale.set(1.1, 0.7, 0.86);
      knuckle.position.set(fingerDefinitions[i].x, 0.386, 0.044);
      knuckle.castShadow = true;
      group.add(knuckle);
    }

    // The thumb is deliberately a little oversized and theatrical.
    const thumbRoot = new THREE.Group();
    thumbRoot.position.set(-0.132, 0.188, 0.034);
    thumbRoot.rotation.z = 1.04;
    thumbRoot.rotation.x = 0.26;
    group.add(thumbRoot);

    const thumbSegments = [];
    const thumbDefinitions = [
      { length: 0.135, radius: 0.041 },
      { length: 0.1, radius: 0.033 }
    ];
    let thumbParent = thumbRoot;
    thumbDefinitions.forEach(function (definition, index) {
      const pivot = new THREE.Group();
      if (index > 0) pivot.position.y = thumbDefinitions[index - 1].length;
      thumbParent.add(pivot);
      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(definition.radius, Math.max(0.014, definition.length - definition.radius * 2), 4, 10),
        materials.ivory
      );
      mesh.position.y = definition.length / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      pivot.add(mesh);
      if (index > 0) {
        const knuckle = new THREE.Mesh(new THREE.SphereGeometry(definition.radius * 1.04, 12, 8), materials.ivory);
        knuckle.castShadow = true;
        pivot.add(knuckle);
      }
      thumbSegments.push({ pivot, length: definition.length });
      thumbParent = pivot;
    });

    markShadows(group);
    return { group, fingers, thumbRoot, thumbSegments };
  }

  function createBone(length, upperRadius, lowerRadius) {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(upperRadius, lowerRadius, length, 22, 1), materials.brass);
    shaft.position.y = length / 2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    group.add(shaft);

    const collarTop = new THREE.Mesh(new THREE.CylinderGeometry(upperRadius + 0.014, upperRadius + 0.01, 0.04, 22), materials.brassDark);
    collarTop.position.y = length * 0.64;
    collarTop.castShadow = true;
    group.add(collarTop);

    const collarLow = new THREE.Mesh(new THREE.CylinderGeometry(lowerRadius + 0.018, lowerRadius + 0.012, 0.035, 22), materials.brassDark);
    collarLow.position.y = length * 0.19;
    collarLow.castShadow = true;
    group.add(collarLow);

    const inlay = new THREE.Mesh(new THREE.BoxGeometry(0.009, length * 0.44, 0.009), materials.ivoryWarm);
    inlay.position.set(lowerRadius * 0.76, length * 0.46, 0.035);
    group.add(inlay);
    return group;
  }

  function buildArm() {
    const assembly = new THREE.Group();
    assembly.name = "arm-assembly";
    assembly.visible = false;
    machineRoot.add(assembly);

    const handRig = createHand();
    const arm = {
      assembly,
      shoulder: new THREE.Vector3(0, 0.68, -0.46),
      upperLength: 1.14,
      foreLength: 0.98,
      handRig,
      upperBone: createBone(1.14, 0.052, 0.083),
      foreBone: createBone(0.98, 0.043, 0.063),
      hand: handRig.group,
      elbowJoint: new THREE.Mesh(new THREE.SphereGeometry(0.095, 24, 18), materials.brassDark),
      wristJoint: new THREE.Mesh(new THREE.SphereGeometry(0.059, 22, 16), materials.brass),
      shoulderJoint: new THREE.Mesh(new THREE.SphereGeometry(0.125, 26, 20), materials.brass),
      mount: new THREE.Group(),
      currentHandQuat: new THREE.Quaternion(),
      handQuatInitialized: false
    };
    arm.elbowJoint.castShadow = true;
    arm.wristJoint.castShadow = true;
    arm.shoulderJoint.castShadow = true;

    const mount = arm.mount;
    const mountBase = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.055, 28), materials.brassDark);
    mountBase.castShadow = true;
    mountBase.receiveShadow = true;
    mountBase.position.set(0, 0.315, -0.46);
    mount.add(mountBase);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.095, 0.33, 24), materials.brassDark);
    column.position.set(0, 0.47, -0.46);
    column.castShadow = true;
    mount.add(column);
    const yoke = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.13, 24), materials.brass);
    yoke.position.set(0, 0.62, -0.46);
    yoke.castShadow = true;
    mount.add(yoke);
    const yokeAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.31, 16), materials.black);
    yokeAxle.rotation.x = Math.PI / 2;
    yokeAxle.position.set(0, 0.68, -0.46);
    mount.add(yokeAxle);
    mount.add(arm.shoulderJoint);

    assembly.add(mount);
    assembly.add(arm.upperBone);
    assembly.add(arm.foreBone);
    assembly.add(arm.elbowJoint);
    assembly.add(arm.wristJoint);
    assembly.add(arm.hand);

    machineParts.arm = arm;
    return arm;
  }

  buildArm();

  /* ------------------------------------------------------------------
     The automaton's one and only performance
     ------------------------------------------------------------------ */

  const LEVER_OFF = 0.5;
  const LEVER_ON = -0.5;
  const LID_OPEN = -2.0;
  const CYCLE = {
    lidOpenStart: 0.32,
    lidOpenEnd: 1.27,
    armStart: 0.95,
    gripStart: 1.9,
    pushStart: 2.15,
    pushEnd: 2.55,
    releaseStart: 2.62,
    retractEnd: 3.65,
    lidCloseStart: 3.78,
    lidCloseEnd: 4.78,
    end: 5.05
  };

  const Z_AXIS = new THREE.Vector3(0, 0, 1);
  const Y_AXIS = new THREE.Vector3(0, 1, 0);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  const tmpQ = new THREE.Quaternion();
  const tmpM = new THREE.Matrix4();
  const leverPivot = new THREE.Vector3(0, 1.655, 0.68);
  const contactOffset = new THREE.Vector3(0.22, 0.2, -0.018);
  const armHome = new THREE.Vector3(0.42, 0.99, -0.38);
  const armEmerge = new THREE.Vector3(0.47, 2.0, -0.02);
  const armHigh = new THREE.Vector3(0.62, 2.69, 0.27);
  const armLift = new THREE.Vector3(-0.06, 2.74, 0.38);
  const armRetractHigh = new THREE.Vector3(0.18, 2.24, -0.08);

  const knobWorld = new THREE.Vector3();
  const projectedKnob = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const pointerClient = { x: 0, y: 0, inside: false };

  const cycle = {
    active: false,
    time: 0,
    freeze: false,
    attempts: 0,
    hoverAmount: 0
  };

  let currentLidFactor = 0;
  let hoveredLever = false;
  let elapsedWorldTime = 0;
  let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ui = {
    soundToggle: document.getElementById("soundToggle"),
    soundLabel: document.getElementById("soundLabel")
  };

  function easeOutBack(t, strength) {
    const s = strength === undefined ? 1.35 : strength;
    const x = saturate(t) - 1;
    return 1 + (s + 1) * x * x * x + s * x * x;
  }

  function syncHoverClass() {
    document.body.classList.toggle("lever-hovered", hoveredLever);
  }

  function refreshHoverState() {
    if (!cycle.active && pointerClient.inside) {
      pointerNdc.x = (pointerClient.x / window.innerWidth) * 2 - 1;
      pointerNdc.y = -(pointerClient.y / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      hoveredLever = raycaster.intersectObjects(machineParts.interactionObjects, false).length > 0;
    } else {
      hoveredLever = false;
    }
    syncHoverClass();
  }

  function canInteract() {
    return !cycle.active;
  }

  function triggerMachine(options) {
    options = options || {};
    if (!canInteract()) return false;
    if (!document.body.classList.contains("is-ready")) return false;
    sound.init();
    hoveredLever = false;
    syncHoverClass();
    cycle.attempts += 1;
    cycle.active = true;
    cycle.time = options.at || 0;
    cycle.freeze = !!options.freeze;
    machineParts.arm.assembly.visible = false;
    if (!options.silent) sound.playCycle();
    if (navigator.vibrate) {
      try {
        navigator.vibrate(9);
      } catch (e) {
        /* no haptics, no hard feelings */
      }
    }
    return true;
  }

  function finishCycle() {
    cycle.active = false;
    cycle.freeze = false;
    cycle.time = CYCLE.end;
    machineParts.arm.assembly.visible = false;
  }

  /* ------------------------------------------------------------------
     Mechanical pose
     ------------------------------------------------------------------ */

  function getLidFactor(time) {
    let open = 0;
    if (time > CYCLE.lidOpenStart) {
      open = easeInOutCubic(invLerp(CYCLE.lidOpenStart, CYCLE.lidOpenEnd, time));
    }
    let close = 0;
    if (time > CYCLE.lidCloseStart) {
      close = easeInOutCubic(invLerp(CYCLE.lidCloseStart, CYCLE.lidCloseEnd, time));
    }
    let factor = open * (1 - close);

    if (time > CYCLE.lidOpenEnd && time < CYCLE.lidCloseStart) {
      const settle = Math.exp(-(time - CYCLE.lidOpenEnd) * 11) * Math.sin((time - CYCLE.lidOpenEnd) * 31);
      factor += settle * 0.011;
    }
    if (time > CYCLE.lidCloseEnd) {
      const settle = Math.exp(-(time - CYCLE.lidCloseEnd) * 12) * Math.sin((time - CYCLE.lidCloseEnd) * 34);
      factor += settle * 0.008;
    }
    return clamp(factor, 0, 1.025);
  }

  function getLeverAngle(time) {
    if (time < 0.28) {
      const t = easeOutBack(invLerp(0, 0.27, time), 1.2);
      return lerp(LEVER_OFF, LEVER_ON, t);
    }
    if (time < CYCLE.pushStart) {
      return LEVER_ON;
    }
    if (time < CYCLE.pushEnd) {
      const t = easeInOutCubic(invLerp(CYCLE.pushStart, CYCLE.pushEnd, time));
      return lerp(LEVER_ON, LEVER_OFF, t);
    }
    const settleTime = time - CYCLE.pushEnd;
    const wobble = Math.exp(-settleTime * 10) * Math.sin(settleTime * 26) * 0.022;
    return LEVER_OFF + wobble;
  }

  function computeKnobLocal(out, leverAngle) {
    out.set(0, 0.466, 0);
    out.applyAxisAngle(Z_AXIS, leverAngle);
    out.x += leverPivot.x;
    out.y += leverPivot.y;
    out.z += leverPivot.z;
    return out;
  }

  function makeHandQuaternion(direction, palmNormal) {
    const y = direction.clone().normalize();
    const z = palmNormal.clone();
    z.addScaledVector(y, -z.dot(y));
    if (z.lengthSq() < 0.00001) z.set(0, 0, 1);
    z.normalize();
    const x = new THREE.Vector3().crossVectors(y, z).normalize();
    tmpM.makeBasis(x, y, z);
    return new THREE.Quaternion().setFromRotationMatrix(tmpM);
  }

  function solveArm(wrist, dt) {
    const arm = machineParts.arm;
    const shoulder = arm.shoulder;
    const target = tmpC.copy(wrist);

    const delta = target.clone().sub(shoulder);
    let distance = delta.length();
    const maxReach = arm.upperLength + arm.foreLength - 0.025;
    if (distance > maxReach) {
      delta.multiplyScalar(maxReach / distance);
      target.copy(shoulder).add(delta);
      distance = maxReach;
    }
    distance = Math.max(distance, 0.18);
    const dir = delta.normalize();

    const upper = arm.upperLength;
    const fore = arm.foreLength;
    const a = (upper * upper - fore * fore + distance * distance) / (2 * distance);
    const h = Math.sqrt(Math.max(upper * upper - a * a, 0.0001));
    const pole = new THREE.Vector3(1.0, 0.35, -0.52);
    pole.addScaledVector(dir, -pole.dot(dir));
    if (pole.lengthSq() < 0.0001) pole.set(1, 0, 0);
    pole.normalize();
    const elbow = shoulder.clone().addScaledVector(dir, a).addScaledVector(pole, h);

    arm.upperBone.position.copy(shoulder);
    arm.upperBone.quaternion.setFromUnitVectors(Y_AXIS, elbow.clone().sub(shoulder).normalize());
    arm.foreBone.position.copy(elbow);
    arm.foreBone.quaternion.setFromUnitVectors(Y_AXIS, target.clone().sub(elbow).normalize());
    arm.elbowJoint.position.copy(elbow);
    arm.wristJoint.position.copy(target);
    arm.hand.position.copy(target);

    return target;
  }

  function poseHand(curl, spread) {
    const rig = machineParts.arm.handRig;
    const openness = 1 - saturate(curl);
    rig.fingers.forEach(function (finger, index) {
      const base = finger.baseSpread;
      finger.root.rotation.z = base * (0.65 + openness * 0.85) + spread * 0.02 * (index - 1.5);
      const curlBias = 0.8 + index * 0.11;
      finger.segments[0].pivot.rotation.x = 0.1 + curl * 0.82 * curlBias;
      finger.segments[1].pivot.rotation.x = 0.09 + curl * 1.04 * curlBias;
      finger.segments[2].pivot.rotation.x = 0.08 + curl * 0.7 * curlBias;
    });
    rig.thumbRoot.rotation.z = 1.04 - curl * 0.08 + spread * 0.018;
    rig.thumbRoot.rotation.x = 0.26 + curl * 0.16;
    rig.thumbSegments[0].pivot.rotation.x = 0.1 + curl * 0.38;
    rig.thumbSegments[1].pivot.rotation.x = 0.08 + curl * 0.58;
  }

  function updateArm(time, dt) {
    const arm = machineParts.arm;
    const leverAngle = machineParts.leverGroup.rotation.z;
    const knob = getKnobPositionForArm(leverAngle);
    const contact = knob.clone().add(contactOffset);

    const wrist = new THREE.Vector3();
    let handCurl = 0.2;
    let handSpread = 1;
    let fingerDir;
    let palmNormal = new THREE.Vector3(0.18, 0.16, 0.98);

    if (time < CYCLE.armStart) {
      wrist.copy(armHome);
      fingerDir = new THREE.Vector3(0.08, 0.98, 0.15);
      handCurl = 0.18;
    } else if (time < 1.35) {
      const u = smoothstep(invLerp(CYCLE.armStart, 1.35, time));
      wrist.lerpVectors(armHome, armEmerge, u);
      fingerDir = new THREE.Vector3(0.08, 0.88, 0.47);
      handCurl = lerp(0.18, 0.22, u);
    } else if (time < 1.7) {
      const u = smoothstep(invLerp(1.35, 1.7, time));
      wrist.lerpVectors(armEmerge, armHigh, u);
      fingerDir = tmpA.set(0.02, 0.67, 0.74).lerp(tmpB.set(-0.2, -0.1, 0.97), u * 0.55).normalize();
      handCurl = lerp(0.22, 0.12, u);
    } else if (time < CYCLE.gripStart) {
      const u = smoothstep(invLerp(1.7, CYCLE.gripStart, time));
      wrist.lerpVectors(armHigh, contact, u);
      const aim = knob.clone().sub(wrist).normalize();
      fingerDir = tmpA.set(-0.06, 0.32, 0.94).lerp(aim, smoothstep(u)).normalize();
      handCurl = lerp(0.12, 0.72, smoothstep(invLerp(0.28, 1, u)));
      handSpread = lerp(1, 0.42, u);
    } else if (time < CYCLE.releaseStart) {
      wrist.copy(contact);
      if (time > CYCLE.gripStart && time < CYCLE.pushStart) {
        const hesitation = Math.sin((time - CYCLE.gripStart) * 17) * 0.005;
        wrist.y += hesitation;
      }
      const aim = knob.clone().sub(wrist).normalize();
      fingerDir = aim;
      handCurl = lerp(0.72, 0.92, smoothstep(invLerp(CYCLE.gripStart, CYCLE.pushStart, time)));
      handSpread = lerp(0.42, 0.14, smoothstep(invLerp(CYCLE.gripStart, CYCLE.pushStart, time)));
    } else if (time < 3.0) {
      const u = smoothstep(invLerp(CYCLE.releaseStart, 3.0, time));
      wrist.lerpVectors(contact, armLift, u);
      const aim = knob.clone().sub(wrist).normalize();
      fingerDir = aim.lerp(tmpA.set(0.08, 0.7, 0.66), smoothstep(clamp(u * 1.55, 0, 1))).normalize();
      handCurl = lerp(0.92, 0.06, smoothstep(u));
      handSpread = lerp(0.1, 1, smoothstep(u));
    } else if (time < CYCLE.retractEnd) {
      const u = smoothstep(invLerp(3.0, CYCLE.retractEnd, time));
      wrist.lerpVectors(armLift, armRetractHigh, smoothstep(clamp(u * 1.9, 0, 1)));
      wrist.lerp(armRetractHigh.clone().lerp(armHome, smoothstep(invLerp(0.35, 1, u))), saturate((u - 0.28) * 1.5));
      fingerDir = tmpA
        .set(0.1, 0.77, 0.61)
        .lerp(tmpB.set(0.18, 0.32, 0.93), smoothstep(invLerp(0.5, 1, u)))
        .normalize();
      handCurl = lerp(0.08, 0.2, u);
      handSpread = 1;
    } else {
      wrist.copy(armHome);
      fingerDir = new THREE.Vector3(0.18, 0.3, 0.94);
      handCurl = 0.2;
    }

    if (time >= CYCLE.releaseStart && time < 3.0) {
      palmNormal.set(0.04, 0.28, 0.96);
    } else if (time >= 1.45) {
      palmNormal.set(-0.46, 0.2, 0.86);
    }

    const solvedWrist = solveArm(wrist, dt);
    const q = makeHandQuaternion(fingerDir, palmNormal);
    if (!arm.handQuatInitialized) {
      arm.currentHandQuat.copy(q);
      arm.handQuatInitialized = true;
    } else {
      const blend = 1 - Math.exp(-20 * Math.max(dt, 0.001));
      arm.currentHandQuat.slerp(q, blend);
    }
    arm.hand.quaternion.copy(arm.currentHandQuat);
    arm.hand.position.copy(solvedWrist);
    poseHand(handCurl, handSpread);

    arm.assembly.visible = time > 0.34 && time < CYCLE.lidCloseEnd - 0.06;
  }

  function getKnobPositionForArm(leverAngle) {
    const knob = new THREE.Vector3();
    computeKnobLocal(knob, leverAngle);
    return knob;
  }

  function updateMachinePose(time, dt) {
    const leverAngle = getLeverAngle(time);
    machineParts.leverGroup.rotation.z = leverAngle;

    const lidFactor = getLidFactor(time);
    currentLidFactor = lidFactor;
    machineParts.lidGroup.rotation.x = LID_OPEN * lidFactor;

    const ledOn = time < CYCLE.pushStart + 0.25;
    let ledLevel = 0;
    if (ledOn) {
      ledLevel = easeOutCubic(invLerp(0.03, 0.24, time));
      if (time > 2.4) ledLevel = 1 - smoothstep(invLerp(2.4, 2.72, time));
    } else {
      ledLevel = 0;
    }
    materials.led.emissiveIntensity = 0.06 + ledLevel * 4.4;
    machineParts.ledGlow.material.opacity = ledLevel * 0.74;
    lights.led.intensity = ledLevel * 0.53;
    lights.interior.intensity = smoothstep(lidFactor) * 3.2;

    updateArm(time, dt);

    // A slow idle pulse on the switch's brass halo; it disappears while busy.
    const hoverTarget = !cycle.active && hoveredLever ? 1 : 0;
    cycle.hoverAmount = damp(cycle.hoverAmount, hoverTarget, 8, dt);
    const idlePulse = 0.5 + Math.sin(elapsedWorldTime * 2.1) * 0.5;
    if (machineParts.hoverRing) {
      const ringMat = machineParts.hoverRing.material;
      ringMat.opacity = cycle.active
        ? damp(ringMat.opacity, 0, 8, dt)
        : 0.1 + cycle.hoverAmount * 0.52 + idlePulse * 0.055;
      machineParts.hoverRing.rotation.z += dt * (0.14 + cycle.hoverAmount * 0.34);
      const scale = 1 + cycle.hoverAmount * 0.04 + Math.sin(elapsedWorldTime * 1.7) * 0.008;
      machineParts.hoverRing.scale.setScalar(scale);
    }
    if (machineParts.halo) {
      machineParts.halo.material.opacity = cycle.active
        ? damp(machineParts.halo.material.opacity, 0, 8, dt)
        : 0.13 + cycle.hoverAmount * 0.16;
    }

    // The little mechanism inside catches the light and keeps turning.
    const gearActivity = cycle.active ? 1 : 0.08;
    machineParts.gears.forEach(function (gear) {
      gear.mesh.rotation.y += dt * gear.speed * gearActivity;
    });
  }

  /* ------------------------------------------------------------------
     Pointer interaction
     ------------------------------------------------------------------ */

  function updatePointerCoordinates(event) {
    pointerClient.x = event.clientX;
    pointerClient.y = event.clientY;
    pointerClient.inside = true;
    pointerNdc.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerNdc.y = -(event.clientY / window.innerHeight) * 2 + 1;
    cameraRig.px = pointerNdc.x;
    cameraRig.py = pointerNdc.y;
  }

  function onCanvasPointerMove(event) {
    updatePointerCoordinates(event);
    refreshHoverState();
  }

  function onCanvasPointerLeave() {
    pointerClient.inside = false;
    hoveredLever = false;
    cameraRig.px = 0;
    cameraRig.py = 0;
    syncHoverClass();
  }

  function onCanvasPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.pointerType !== "mouse" && event.isPrimary === false) return;
    updatePointerCoordinates(event);
    if (!canInteract()) return;
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObjects(machineParts.interactionObjects, false);
    if (hit.length > 0) {
      event.preventDefault();
      triggerMachine();
    }
  }

  canvas.addEventListener("pointermove", onCanvasPointerMove, { passive: true });
  canvas.addEventListener("pointerleave", onCanvasPointerLeave, { passive: true });
  canvas.addEventListener("pointerdown", onCanvasPointerDown, { passive: false });
  canvas.addEventListener("pointercancel", onCanvasPointerLeave, { passive: true });

  window.addEventListener("keydown", function (event) {
    const target = event.target;
    const isControl =
      target &&
      (target.tagName === "BUTTON" ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable);
    if ((event.code === "Space" || event.key === "Enter") && !isControl) {
      if (triggerMachine()) {
        event.preventDefault();
      }
    }
  });

  /* ------------------------------------------------------------------
     Sound
     ------------------------------------------------------------------ */

  const sound = (function () {
    let context = null;
    let master = null;
    let compressor = null;
    let noiseBuffer = null;
    let enabled = true;

    function init() {
      if (!enabled) return null;
      if (context) {
        if (context.state === "suspended") context.resume();
        return context;
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = enabled ? 0.2 : 0;
      compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 22;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.22;
      master.connect(compressor);
      compressor.connect(context.destination);

      const length = Math.floor(context.sampleRate * 0.55);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const channel = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) channel[i] = Math.random() * 2 - 1;
      return context;
    }

    function setEnabled(value) {
      enabled = value;
      if (enabled) init();
      if (master && context) {
        const now = context.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setTargetAtTime(enabled ? 0.2 : 0, now, 0.03);
      }
    }

    function tick(when, frequency, level, pitchFall) {
      if (!context || !enabled) return;
      const start = when;
      const osc = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(frequency, start);
      if (pitchFall) osc.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.52), start + 0.075);
      filter.type = "highpass";
      filter.frequency.value = 280;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(level, start + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (pitchFall ? 0.1 : 0.06));
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + 0.14);

      if (noiseBuffer) {
        const noise = context.createBufferSource();
        const noiseGain = context.createGain();
        const noiseFilter = context.createBiquadFilter();
        noise.buffer = noiseBuffer;
        noiseFilter.type = "bandpass";
        noiseFilter.frequency.setValueAtTime(1500, start);
        noiseFilter.Q.value = 1.2;
        noiseGain.gain.setValueAtTime(level * 0.22, start);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.04);
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(master);
        noise.start(start);
        noise.stop(start + 0.07);
      }
    }

    function motor(when, duration, from, to, level) {
      if (!context || !enabled) return;
      const start = when;
      const end = when + duration;
      const osc = context.createOscillator();
      const osc2 = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      osc.type = "sawtooth";
      osc2.type = "triangle";
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(Math.max(35, to), end);
      osc2.frequency.setValueAtTime(from * 1.51, start);
      osc2.frequency.exponentialRampToValueAtTime(Math.max(35, to * 1.36), end);
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(420, start);
      filter.frequency.linearRampToValueAtTime(610, end);
      filter.Q.value = 0.7;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(level, start + Math.min(0.12, duration * 0.18));
      gain.gain.setValueAtTime(level, Math.max(start + 0.13, end - 0.16));
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      const mixGain = context.createGain();
      mixGain.gain.value = 0.45;
      osc.connect(filter);
      osc2.connect(mixGain);
      mixGain.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc2.start(start);
      osc.stop(end + 0.02);
      osc2.stop(end + 0.02);
    }

    function thud(when) {
      if (!context || !enabled) return;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(92, when);
      osc.frequency.exponentialRampToValueAtTime(46, when + 0.18);
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(0.12, when + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
      osc.connect(gain);
      gain.connect(master);
      osc.start(when);
      osc.stop(when + 0.32);
      if (noiseBuffer) {
        const noise = context.createBufferSource();
        const filter = context.createBiquadFilter();
        const nGain = context.createGain();
        noise.buffer = noiseBuffer;
        filter.type = "lowpass";
        filter.frequency.value = 380;
        nGain.gain.setValueAtTime(0.035, when);
        nGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(master);
        noise.start(when);
        noise.stop(when + 0.16);
      }
    }

    function playCycle() {
      const ctx = init();
      if (!ctx) return;
      const now = ctx.currentTime + 0.035;
      tick(now, 192, 0.16, true);
      motor(now + CYCLE.lidOpenStart, 0.94, 91, 142, 0.085);
      tick(now + 1.31, 118, 0.075, false);
      motor(now + 0.96, 0.75, 158, 294, 0.05);
      tick(now + 1.93, 176, 0.11, false);
      motor(now + CYCLE.pushStart, 0.37, 292, 172, 0.07);
      tick(now + 2.38, 108, 0.15, true);
      motor(now + CYCLE.releaseStart, 0.58, 220, 138, 0.045);
      motor(now + CYCLE.lidCloseStart, 0.97, 128, 73, 0.075);
      thud(now + CYCLE.lidCloseEnd - 0.05);
    }

    return {
      init,
      setEnabled,
      playCycle,
      isEnabled: function () {
        return enabled;
      }
    };
  })();

  function updateSoundUI() {
    const enabled = sound.isEnabled();
    ui.soundToggle.setAttribute("aria-pressed", enabled ? "true" : "false");
    ui.soundToggle.setAttribute("aria-label", enabled ? "关闭声音" : "开启声音");
    ui.soundLabel.textContent = enabled ? "Sound on" : "Sound off";
  }

  ui.soundToggle.addEventListener("click", function () {
    sound.init();
    sound.setEnabled(!sound.isEnabled());
    updateSoundUI();
  });

  /* ------------------------------------------------------------------
     Animation loop
     ------------------------------------------------------------------ */

  function updateScene(dt, now) {
    elapsedWorldTime += dt;
    if (cycle.active) {
      if (!cycle.freeze) cycle.time += dt;
      const t = Math.min(cycle.time, CYCLE.end);
      updateMachinePose(t, dt);
      if (!cycle.freeze && cycle.time >= CYCLE.end) {
        updateMachinePose(CYCLE.end, dt);
        finishCycle();
      }
    } else {
      // Keep the brass ring breathing while the machine waits.
      const hoverTarget = hoveredLever ? 1 : 0;
      cycle.hoverAmount = damp(cycle.hoverAmount, hoverTarget, 8, dt);
      if (machineParts.hoverRing) {
        const ringMat = machineParts.hoverRing.material;
        ringMat.opacity = 0.1 + cycle.hoverAmount * 0.52 + (0.5 + Math.sin(elapsedWorldTime * 2.1) * 0.5) * 0.055;
        machineParts.hoverRing.rotation.z += dt * (0.14 + cycle.hoverAmount * 0.34);
        machineParts.hoverRing.scale.setScalar(
          1 + cycle.hoverAmount * 0.04 + Math.sin(elapsedWorldTime * 1.7) * 0.008
        );
      }
      if (machineParts.halo) {
        machineParts.halo.material.opacity = 0.13 + cycle.hoverAmount * 0.16;
      }
      machineParts.gears.forEach(function (gear) {
        gear.mesh.rotation.y += dt * gear.speed * 0.08;
      });
    }

    updateCamera(dt, elapsedWorldTime, cycle.active ? currentLidFactor : currentLidFactor);
    refreshHoverState();

    const positions = cyclorama.dust.geometry.getAttribute("position");
    for (let i = 0; i < cyclorama.dustSeeds.length; i++) {
      const seed = cyclorama.dustSeeds[i];
      positions.setXYZ(
        i,
        seed.x + Math.sin(elapsedWorldTime * seed.speed + seed.phase) * seed.amp,
        seed.y + Math.cos(elapsedWorldTime * seed.speed * 0.62 + seed.phase) * seed.amp * 0.6,
        seed.z + Math.sin(elapsedWorldTime * seed.speed * 0.43 + seed.phase * 1.7) * seed.amp * 0.5
      );
    }
    positions.needsUpdate = true;
  }

  function initialisePose() {
    machineParts.leverGroup.rotation.z = LEVER_OFF;
    machineParts.lidGroup.rotation.x = 0;
    machineParts.arm.assembly.visible = false;
    currentLidFactor = 0;
    lights.interior.intensity = 0;
    lights.led.intensity = 0;
    materials.led.emissiveIntensity = 0.06;
    machineParts.ledGlow.material.opacity = 0;
    // Put the arm into its resting fold, out of sight.
    machineParts.arm.upperBone.position.copy(machineParts.arm.shoulder);
    machineParts.arm.foreBone.position.copy(machineParts.arm.shoulder);
    machineParts.arm.hand.position.copy(armHome);
  }

  function initialiseInterface() {
    updateSoundUI();
  }

  // A tiny, deliberately over-engineered hook for visual QA.
  window.__USELESS_MACHINE__ = {
    trigger: function (options) {
      return triggerMachine(Object.assign({ silent: true }, options || {}));
    },
    seek: function (time) {
      if (!cycle.active) {
        triggerMachine({ silent: true, freeze: true, at: time });
      } else {
        cycle.freeze = true;
        cycle.time = clamp(time, 0, CYCLE.end);
      }
    },
    resume: function () {
      cycle.freeze = false;
    },
    state: function () {
      return {
        active: cycle.active,
        time: cycle.time,
        attempts: cycle.attempts,
        lidFactor: currentLidFactor,
        leverAngle: machineParts.leverGroup.rotation.z
      };
    },
    projectKnob: function () {
      machineParts.knob.getWorldPosition(knobWorld);
      projectedKnob.copy(knobWorld).project(camera);
      return {
        x: (projectedKnob.x * 0.5 + 0.5) * window.innerWidth,
        y: (-projectedKnob.y * 0.5 + 0.5) * window.innerHeight,
        z: projectedKnob.z
      };
    }
  };

  initialisePose();
  initialiseInterface();

  window.addEventListener("visibilitychange", function () {
    if (!document.hidden) lastTime = performance.now();
  });

  /* === ANIMATION_AND_INTERACTION === */

  /* ------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------ */

  resize();
  updateCamera(1 / 60, 0, 0);
  renderer.render(scene, camera);
  document.body.classList.add("is-ready");
  cameraRig.introStart = performance.now();

  let lastTime = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    updateScene(dt, now);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
