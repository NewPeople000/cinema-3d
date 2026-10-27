import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ==========================================================================
   CINEMA 3D — LUMIERE GRAND AUDITORIUM
   Realistic, Interactive 3D Cinema Experience with VideoTexture & Seat Booking
   ========================================================================== */

// ==========================================================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================================================

const AUDITORIUM_CONFIG = {
  width: 23.0,
  depth: 30.0,
  height: 9.4,
  screenZ: -12.9,
  screenY: 5.2,
  screenWidth: 15.2,
  screenHeight: 6.6,
  rowsCount: 8,
  seatsPerRow: 10, // 5 left + aisle + 5 right
  rowSpacing: 2.0,
  rowRise: 0.42,
  firstRowZ: -6.2,
  firstRowElevation: 0.38,
  aisleWidth: 2.4,
  ticketPrice: 180000,
};

// ==========================================================================
// 2. SCENE, RENDERER & CAMERA INITIALIZATION
// ==========================================================================

const container = document.getElementById("scene");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#08080d");
scene.fog = new THREE.FogExp2("#08080d", 0.015);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  160,
);

// Initial Center Overview Position
const defaultCameraPos = new THREE.Vector3(0, 5.2, 4.8);
const defaultCameraTarget = new THREE.Vector3(0, 3.8, AUDITORIUM_CONFIG.screenZ);

camera.position.copy(defaultCameraPos);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(defaultCameraTarget);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 2.5;
controls.maxDistance = 28;
controls.maxPolarAngle = Math.PI * 0.49; // Never go under floor
controls.minPolarAngle = 0.15;

// ==========================================================================
// 3. SOUND SYNTHESIZER (WEB AUDIO API - AMBIENT CINEMA DRONE)
// ==========================================================================

let audioCtx = null;
let masterGain = null;
let soundEnabled = false;

function initAudio() {
  if (audioCtx) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.0;
    masterGain.connect(audioCtx.destination);

    // Deep sub-bass cinema drone (55Hz)
    const subOsc = audioCtx.createOscillator();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(55, audioCtx.currentTime);

    const subFilter = audioCtx.createBiquadFilter();
    subFilter.type = "lowpass";
    subFilter.frequency.setValueAtTime(120, audioCtx.currentTime);

    const subGain = audioCtx.createGain();
    subGain.gain.value = 0.45;

    subOsc.connect(subFilter);
    subFilter.connect(subGain);
    subGain.connect(masterGain);
    subOsc.start();

    // Warm ambient pad chord (110Hz + 165Hz)
    const padOsc1 = audioCtx.createOscillator();
    padOsc1.type = "triangle";
    padOsc1.frequency.setValueAtTime(110, audioCtx.currentTime);

    const padOsc2 = audioCtx.createOscillator();
    padOsc2.type = "sine";
    padOsc2.frequency.setValueAtTime(164.81, audioCtx.currentTime);

    const padGain = audioCtx.createGain();
    padGain.gain.value = 0.15;

    padOsc1.connect(padGain);
    padOsc2.connect(padGain);
    padGain.connect(masterGain);
    padOsc1.start();
    padOsc2.start();
  } catch (err) {
    console.warn("AudioContext init error:", err);
  }
}

function toggleAudio() {
  initAudio();
  if (!audioCtx) return;

  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }

  soundEnabled = !soundEnabled;
  if (masterGain) {
    masterGain.gain.setTargetAtTime(soundEnabled ? 0.35 : 0.0, audioCtx.currentTime, 0.2);
  }

  const icon = document.getElementById("soundIcon");
  const label = document.getElementById("soundLabel");
  const btn = document.getElementById("soundToggleBtn");

  if (soundEnabled) {
    icon.textContent = "🔊";
    label.textContent = "Yoqilgan";
    btn.classList.add("active");
  } else {
    icon.textContent = "🔇";
    label.textContent = "Ovoz";
    btn.classList.remove("active");
  }
}

function playClickSound() {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(580, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, audioCtx.currentTime + 0.06);
    g.gain.setValueAtTime(0.12, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.06);
    osc.connect(g);
    g.connect(masterGain);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.06);
  } catch (e) {}
}

// ==========================================================================
// 4. SHARED MATERIALS & PROCEDURAL LEATHER MAPS
// ==========================================================================

// High-fidelity procedural leather bump map generator
function createProceduralLeatherBump() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  // Neutral grey baseline
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;

  // Organic leather cellular grain
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const f1 = Math.sin(x * 0.42) * Math.cos(y * 0.42);
      const f2 = Math.sin((x + y) * 0.38) * Math.sin((x - y) * 0.38);
      const f3 = Math.sin(x * 0.85 + y * 0.25) * Math.cos(y * 0.85 - x * 0.25);
      const grain = (Math.random() - 0.5) * 18;
      const noise = (f1 + f2 * 0.8 + f3 * 0.5) * 22;

      const v = Math.min(255, Math.max(0, 128 + noise + grain));
      d[idx] = v;
      d[idx + 1] = v;
      d[idx + 2] = v;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Soft organic creases & stitches
  ctx.strokeStyle = "rgba(45, 45, 45, 0.22)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    const sy = (i * 18 + Math.random() * 6) % size;
    ctx.moveTo(0, sy);
    ctx.bezierCurveTo(
      size * 0.25, sy + (Math.random() - 0.5) * 14,
      size * 0.75, sy + (Math.random() - 0.5) * 14,
      size, sy,
    );
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  return texture;
}

const leatherBump = createProceduralLeatherBump();

const materials = {
  wall: new THREE.MeshStandardMaterial({
    color: "#181922",
    roughness: 0.88,
    metalness: 0.1,
  }),
  wallPanel: new THREE.MeshStandardMaterial({
    color: "#12131a",
    roughness: 0.95,
  }),
  stageFloor: new THREE.MeshStandardMaterial({
    color: "#0c0d12",
    roughness: 0.5,
    metalness: 0.2,
  }),
  mainFloor: new THREE.MeshStandardMaterial({
    color: "#15161e",
    roughness: 0.85,
  }),
  carpet: new THREE.MeshStandardMaterial({
    color: "#46101c", // Rich Burgundy Carpet
    roughness: 0.96,
    metalness: 0.04,
  }),
  terraceBase: new THREE.MeshStandardMaterial({
    color: "#1b1c26",
    roughness: 0.9,
  }),
  goldTrim: new THREE.MeshStandardMaterial({
    color: "#c99b50",
    metalness: 0.75,
    roughness: 0.28,
  }),
  goldEmissive: new THREE.MeshStandardMaterial({
    color: "#bc9251",
    emissive: "#d6a85c",
    emissiveIntensity: 0.6,
    roughness: 0.3,
  }),
  ledStepLight: new THREE.MeshBasicMaterial({
    color: "#f5d38a",
  }),
  blackSpeaker: new THREE.MeshStandardMaterial({
    color: "#0d0e12",
    roughness: 0.6,
    metalness: 0.3,
  }),
  speakerGrille: new THREE.MeshStandardMaterial({
    color: "#171820",
    roughness: 0.8,
  }),

  // Ultra-Realistic Cinema Recliner Materials
  seatUpholsteryAvailable: new THREE.MeshStandardMaterial({
    color: "#841728", // Luxurious Cinema Red (matching reference)
    roughness: 0.44,
    metalness: 0.1,
    bumpMap: leatherBump,
    bumpScale: 0.009,
  }),
  seatHeadrestAvailable: new THREE.MeshStandardMaterial({
    color: "#4a0e19", // Deep Accent Wine Red
    roughness: 0.46,
    metalness: 0.08,
    bumpMap: leatherBump,
    bumpScale: 0.008,
  }),
  seatUpholsterySelected: new THREE.MeshStandardMaterial({
    color: "#d8a758", // Glowing Antique Gold
    emissive: "#8c611e",
    emissiveIntensity: 0.5,
    roughness: 0.36,
    metalness: 0.32,
    bumpMap: leatherBump,
    bumpScale: 0.008,
  }),
  seatUpholsteryReserved: new THREE.MeshStandardMaterial({
    color: "#1c1d25", // Dark Charcoal Leather (matching screenshot)
    roughness: 0.52,
    metalness: 0.08,
    bumpMap: leatherBump,
    bumpScale: 0.009,
  }),
  seatShell: new THREE.MeshStandardMaterial({
    color: "#0f1015", // Matte dark back & bottom protective shell
    roughness: 0.74,
    metalness: 0.25,
  }),
  seatArmpad: new THREE.MeshStandardMaterial({
    color: "#0a0a0e", // Padded black armrest top
    roughness: 0.55,
    metalness: 0.1,
    bumpMap: leatherBump,
    bumpScale: 0.006,
  }),
  stanchionMat: new THREE.MeshStandardMaterial({
    color: "#13141a", // Heavy steel leg stanchion
    roughness: 0.65,
    metalness: 0.5,
  }),
  cupholderGold: new THREE.MeshStandardMaterial({
    color: "#c99b50", // Polished brass cup holder rim
    roughness: 0.28,
    metalness: 0.78,
  }),
  cupholderInterior: new THREE.MeshStandardMaterial({
    color: "#050608",
    roughness: 0.9,
  }),
  aisleEndPanel: new THREE.MeshStandardMaterial({
    color: "#101117",
    roughness: 0.62,
    metalness: 0.3,
  }),
  aisleMarkerLED: new THREE.MeshBasicMaterial({
    color: "#ffd47f",
  }),
  ceiling: new THREE.MeshStandardMaterial({
    color: "#0a0a0f",
    roughness: 0.95,
  }),

  // Wall Decor & Surround Sound Materials
  exitSignGreen: new THREE.MeshBasicMaterial({
    color: "#00e676",
  }),
  doorFrame: new THREE.MeshStandardMaterial({
    color: "#0d0e14",
    roughness: 0.6,
    metalness: 0.4,
  }),
  panicBar: new THREE.MeshStandardMaterial({
    color: "#d6a85c",
    roughness: 0.28,
    metalness: 0.8,
  }),
  surroundSpeaker: new THREE.MeshStandardMaterial({
    color: "#0b0c10",
    roughness: 0.65,
    metalness: 0.35,
  }),
  posterFrame: new THREE.MeshStandardMaterial({
    color: "#08080d",
    roughness: 0.5,
    metalness: 0.4,
  }),
  posterGlow: new THREE.MeshBasicMaterial({
    color: "#ffc266",
  }),
};

// ==========================================================================
// 5. PROCEDURAL CINEMA SCREEN & DYNAMIC CANVAS VIDEO TEXTURE
// ==========================================================================

const screenCanvas = document.createElement("canvas");
screenCanvas.width = 1920;
screenCanvas.height = 800;
const screenCtx = screenCanvas.getContext("2d");

const screenTexture = new THREE.CanvasTexture(screenCanvas);
screenTexture.colorSpace = THREE.SRGBColorSpace;
screenTexture.minFilter = THREE.LinearFilter;
screenTexture.magFilter = THREE.LinearFilter;

const screenMaterial = new THREE.MeshBasicMaterial({
  map: screenTexture,
  side: THREE.FrontSide,
});

// Movie Data for 3 Movies
const MOVIES = {
  lastlight: {
    id: "lastlight",
    title: "THE LAST LIGHT",
    subtitle: "Where the light ends, the journey begins...",
    genre: "Sci-Fi • Kosmik Drama",
    duration: "2 soat 18 daqiqa",
    rating: "IMAX Laser 3D",
    color: "#ff7700",
  },
  sintel: {
    id: "sintel",
    title: "SINTEL",
    subtitle: "The Dragon Seeker's Quest",
    genre: "Drama • Fantastika",
    duration: "1 soat 52 daqiqa",
    rating: "Dolby Vision",
    color: "#ff2a6d",
  },
  quieter: {
    id: "quieter",
    title: "A QUIETER WORLD",
    subtitle: "Earth from the Edge of Space",
    genre: "Kosmos • Hujjatli",
    duration: "1 soat 35 daqiqa",
    rating: "4K High Dynamic Range",
    color: "#00d2ff",
  },
};

let currentMovieKey = "lastlight";
let isVideoPlaying = true;
let screenAnimTime = 0;

// Draw dynamic movie graphic on canvas (Keeps the screen vividly ON and active!)
function updateScreenCanvas(delta) {
  // Only advance animation time when playing; static frame shown when paused
  if (isVideoPlaying) {
    screenAnimTime += delta;
  }

  const w = screenCanvas.width;
  const h = screenCanvas.height;

  // Clear canvas
  screenCtx.fillStyle = "#05060b";
  screenCtx.fillRect(0, 0, w, h);

  if (currentMovieKey === "lastlight") {
    // ==========================================
    // 1. THE LAST LIGHT (Sci-Fi Solar Eclipse Epic)
    // ==========================================
    const nebGrad = screenCtx.createRadialGradient(w * 0.72, h * 0.5, 50, w * 0.72, h * 0.5, 700);
    nebGrad.addColorStop(0, "rgba(255, 90, 0, 0.45)");
    nebGrad.addColorStop(0.35, "rgba(180, 20, 0, 0.25)");
    nebGrad.addColorStop(0.7, "rgba(40, 10, 50, 0.15)");
    nebGrad.addColorStop(1, "rgba(5, 6, 11, 0)");
    screenCtx.fillStyle = nebGrad;
    screenCtx.fillRect(0, 0, w, h);

    // Starfield
    for (let i = 0; i < 65; i++) {
      const sx = (i * 127.3 + screenAnimTime * 14) % w;
      const sy = (i * 83.7) % h;
      const sa = 0.35 + 0.55 * Math.sin(screenAnimTime * 2.5 + i);
      screenCtx.fillStyle = `rgba(255, 245, 230, ${sa})`;
      screenCtx.beginPath();
      screenCtx.arc(sx, sy, i % 4 === 0 ? 2.2 : 1.2, 0, Math.PI * 2);
      screenCtx.fill();
    }

    const cx = w * 0.72;
    const cy = h * 0.5;
    const pulse = 1.0 + Math.sin(screenAnimTime * 2.0) * 0.06;

    // Fiery Solar Corona Rays (Rotated animated rays)
    screenCtx.save();
    screenCtx.translate(cx, cy);
    screenCtx.rotate(screenAnimTime * 0.15);
    for (let r = 0; r < 24; r++) {
      const angle = (r * Math.PI) / 12;
      const rayLen = 280 + Math.sin(screenAnimTime * 3 + r) * 60;
      screenCtx.strokeStyle = "rgba(255, 140, 0, 0.18)";
      screenCtx.lineWidth = 14;
      screenCtx.beginPath();
      screenCtx.moveTo(0, 0);
      screenCtx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen);
      screenCtx.stroke();
    }
    screenCtx.restore();

    // Radiant Solar Corona Glow
    const coronaGrad = screenCtx.createRadialGradient(cx, cy, 80, cx, cy, 390 * pulse);
    coronaGrad.addColorStop(0, "rgba(255, 240, 180, 0.98)");
    coronaGrad.addColorStop(0.2, "rgba(255, 120, 10, 0.85)");
    coronaGrad.addColorStop(0.5, "rgba(200, 30, 0, 0.45)");
    coronaGrad.addColorStop(0.85, "rgba(40, 8, 30, 0.12)");
    coronaGrad.addColorStop(1, "rgba(5, 6, 11, 0)");
    screenCtx.fillStyle = coronaGrad;
    screenCtx.beginPath();
    screenCtx.arc(cx, cy, 400 * pulse, 0, Math.PI * 2);
    screenCtx.fill();

    // Dark Eclipse Planet Silhouette
    screenCtx.fillStyle = "#07080f";
    screenCtx.beginPath();
    screenCtx.arc(cx, cy, 115, 0, Math.PI * 2);
    screenCtx.fill();

    // Burning Ring Atmosphere
    screenCtx.strokeStyle = "rgba(255, 215, 120, 0.95)";
    screenCtx.lineWidth = 4.5;
    screenCtx.stroke();

    // Cruising Explorer Spaceship
    const shipX = w - ((screenAnimTime * 85 + 200) % (w + 400));
    const shipY = cy - 80 + Math.sin(screenAnimTime * 1.5) * 20;

    // Blue Ion Engine Trail
    screenCtx.strokeStyle = "rgba(0, 200, 255, 0.75)";
    screenCtx.lineWidth = 3;
    screenCtx.beginPath();
    screenCtx.moveTo(shipX + 45, shipY);
    screenCtx.lineTo(shipX + 130, shipY);
    screenCtx.stroke();

    // Spaceship Silhouette
    screenCtx.fillStyle = "#0f1118";
    screenCtx.beginPath();
    screenCtx.moveTo(shipX, shipY);
    screenCtx.lineTo(shipX + 35, shipY - 9);
    screenCtx.lineTo(shipX + 45, shipY - 3);
    screenCtx.lineTo(shipX + 45, shipY + 3);
    screenCtx.lineTo(shipX + 35, shipY + 9);
    screenCtx.closePath();
    screenCtx.fill();
    screenCtx.strokeStyle = "rgba(255, 200, 100, 0.8)";
    screenCtx.lineWidth = 1.2;
    screenCtx.stroke();

    // Movie Title Typography
    screenCtx.textAlign = "left";
    screenCtx.font = "bold 66px 'Cinzel', serif";
    screenCtx.fillStyle = "#ffffff";
    screenCtx.shadowColor = "rgba(255, 120, 0, 0.85)";
    screenCtx.shadowBlur = 24;
    screenCtx.fillText("THE LAST LIGHT", 110, h * 0.46);

    // Lens Flare sweep line
    const flareX = 110 + ((screenAnimTime * 280) % 750);
    const flareGrad = screenCtx.createLinearGradient(flareX - 90, 0, flareX + 90, 0);
    flareGrad.addColorStop(0, "rgba(255, 200, 50, 0)");
    flareGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.85)");
    flareGrad.addColorStop(1, "rgba(255, 200, 50, 0)");
    screenCtx.fillStyle = flareGrad;
    screenCtx.fillRect(flareX - 90, h * 0.46 - 45, 180, 4);

    screenCtx.shadowBlur = 0;
    screenCtx.font = "600 22px 'Inter', sans-serif";
    screenCtx.fillStyle = "rgba(255, 180, 80, 0.95)";
    screenCtx.fillText("WHERE THE LIGHT ENDS, THE ODYSSEY BEGINS", 112, h * 0.55);

    screenCtx.font = "500 16px 'Inter', sans-serif";
    screenCtx.fillStyle = "rgba(255, 255, 255, 0.65)";
    screenCtx.fillText("DOLBY ATMOS 64   |   IMAX LASER 3D   |   4K ULTRA HD", 112, h * 0.64);
  } else if (currentMovieKey === "sintel") {
    // ==========================================
    // 2. SINTEL (Fantasy Dragon Adventure)
    // ==========================================
    const sunsetGrad = screenCtx.createLinearGradient(0, 0, 0, h);
    sunsetGrad.addColorStop(0, "#190828");
    sunsetGrad.addColorStop(0.4, "#5a113d");
    sunsetGrad.addColorStop(0.75, "#c0392b");
    sunsetGrad.addColorStop(1, "#f39c12");
    screenCtx.fillStyle = sunsetGrad;
    screenCtx.fillRect(0, 0, w, h);

    // Jagged Mountain Silhouettes
    screenCtx.fillStyle = "#120818";
    screenCtx.beginPath();
    screenCtx.moveTo(0, h);
    screenCtx.lineTo(0, h * 0.65);
    screenCtx.lineTo(w * 0.2, h * 0.48);
    screenCtx.lineTo(w * 0.35, h * 0.62);
    screenCtx.lineTo(w * 0.55, h * 0.42);
    screenCtx.lineTo(w * 0.72, h * 0.58);
    screenCtx.lineTo(w * 0.88, h * 0.45);
    screenCtx.lineTo(w, h * 0.6);
    screenCtx.lineTo(w, h);
    screenCtx.closePath();
    screenCtx.fill();

    // Flying Dragon Silhouette
    const dragX = ((screenAnimTime * 110) % (w + 300)) - 100;
    const dragY = h * 0.28 + Math.sin(screenAnimTime * 2.2) * 35;
    const wingFlap = Math.sin(screenAnimTime * 8);

    screenCtx.save();
    screenCtx.translate(dragX, dragY);
    screenCtx.fillStyle = "#180a22";
    screenCtx.beginPath();
    screenCtx.ellipse(0, 0, 36, 12, 0.2, 0, Math.PI * 2);
    screenCtx.fill();
    // Head & Neck
    screenCtx.beginPath();
    screenCtx.moveTo(25, -2);
    screenCtx.lineTo(48, -12);
    screenCtx.lineTo(54, -8);
    screenCtx.lineTo(35, 4);
    screenCtx.closePath();
    screenCtx.fill();
    // Beating Wings
    screenCtx.beginPath();
    screenCtx.moveTo(-5, -6);
    screenCtx.lineTo(15, -42 * wingFlap);
    screenCtx.lineTo(-25, -28 * wingFlap);
    screenCtx.closePath();
    screenCtx.fill();
    screenCtx.restore();

    // 70 Swirling Golden Embers & Sparks
    for (let i = 0; i < 70; i++) {
      const ex = (i * 73.1 + Math.sin(screenAnimTime * 1.5 + i) * 45) % w;
      const ey = h - ((screenAnimTime * 85 + i * 35) % (h + 60));
      const ea = 0.4 + 0.6 * Math.sin(screenAnimTime * 3 + i);
      screenCtx.fillStyle = `rgba(255, 220, 110, ${ea})`;
      screenCtx.beginPath();
      screenCtx.arc(ex, ey, i % 3 === 0 ? 2.5 : 1.5, 0, Math.PI * 2);
      screenCtx.fill();
    }

    // Fantasy Title Typography
    screenCtx.textAlign = "left";
    screenCtx.font = "bold 72px 'Cinzel', serif";
    screenCtx.fillStyle = "#ffd56b";
    screenCtx.shadowColor = "rgba(255, 70, 0, 0.9)";
    screenCtx.shadowBlur = 22;
    screenCtx.fillText("S I N T E L", 110, h * 0.46);

    screenCtx.shadowBlur = 0;
    screenCtx.font = "600 22px 'Inter', sans-serif";
    screenCtx.fillStyle = "rgba(255, 235, 190, 0.95)";
    screenCtx.fillText("THE DRAGON SEEKER'S DESTINY", 112, h * 0.55);

    screenCtx.font = "500 16px 'Inter', sans-serif";
    screenCtx.fillStyle = "rgba(255, 255, 255, 0.65)";
    screenCtx.fillText("BLENDER OPEN MOVIE   |   4K DOLBY VISION   |   DURATION: 1h 52m", 112, h * 0.64);
  } else {
    // ==========================================
    // 3. A QUIETER WORLD (Earth & Aurora Borealis)
    // ==========================================
    const spaceGrad = screenCtx.createLinearGradient(0, 0, 0, h);
    spaceGrad.addColorStop(0, "#020409");
    spaceGrad.addColorStop(0.5, "#081324");
    spaceGrad.addColorStop(1, "#0f2845");
    screenCtx.fillStyle = spaceGrad;
    screenCtx.fillRect(0, 0, w, h);

    // Distant Stars
    for (let i = 0; i < 60; i++) {
      const sx = (i * 131.7) % w;
      const sy = (i * 67.3) % (h * 0.65);
      const sa = 0.3 + 0.7 * Math.sin(screenAnimTime * 2 + i);
      screenCtx.fillStyle = `rgba(200, 240, 255, ${sa})`;
      screenCtx.beginPath();
      screenCtx.arc(sx, sy, 1.3, 0, Math.PI * 2);
      screenCtx.fill();
    }

    // Glowing Blue Earth Curvature
    const earthCenterX = w * 0.55;
    const earthCenterY = h * 1.55;
    const earthRadius = h * 1.05;

    const earthGrad = screenCtx.createRadialGradient(
      earthCenterX, earthCenterY, earthRadius * 0.7,
      earthCenterX, earthCenterY, earthRadius,
    );
    earthGrad.addColorStop(0, "#081c3a");
    earthGrad.addColorStop(0.85, "#14487f");
    earthGrad.addColorStop(0.97, "#288ae6");
    earthGrad.addColorStop(1, "rgba(70, 180, 255, 0.95)");

    screenCtx.fillStyle = earthGrad;
    screenCtx.beginPath();
    screenCtx.arc(earthCenterX, earthCenterY, earthRadius, 0, Math.PI * 2);
    screenCtx.fill();

    // Atmospheric Blue Glow Rim
    screenCtx.strokeStyle = "rgba(90, 200, 255, 0.85)";
    screenCtx.lineWidth = 12;
    screenCtx.stroke();

    // Shimmering Aurora Borealis Curtains
    for (let a = 0; a < 3; a++) {
      screenCtx.beginPath();
      screenCtx.moveTo(0, h * 0.62 + a * 15);
      for (let x = 0; x <= w; x += 30) {
        const y = h * 0.62 + a * 15 + Math.sin(x * 0.005 + screenAnimTime * 1.4 + a) * 32;
        screenCtx.lineTo(x, y);
      }
      screenCtx.strokeStyle = a === 0 ? "rgba(0, 255, 170, 0.45)" : "rgba(0, 190, 255, 0.35)";
      screenCtx.lineWidth = 18;
      screenCtx.stroke();
    }

    // Drifting Orbital Spacecraft / Satellite
    const satX = ((screenAnimTime * 65 + 150) % (w + 200)) - 100;
    const satY = h * 0.38 + Math.sin(screenAnimTime * 0.8) * 15;

    screenCtx.save();
    screenCtx.translate(satX, satY);
    screenCtx.fillStyle = "#0c1524";
    screenCtx.fillRect(-15, -6, 30, 12);
    screenCtx.fillStyle = "rgba(0, 220, 255, 0.85)";
    screenCtx.fillRect(-50, -4, 30, 8);
    screenCtx.fillRect(20, -4, 30, 8);
    screenCtx.restore();

    // Title Typography
    screenCtx.textAlign = "left";
    screenCtx.font = "bold 64px 'Cinzel', serif";
    screenCtx.fillStyle = "#e6f8ff";
    screenCtx.shadowColor = "rgba(0, 210, 255, 0.85)";
    screenCtx.shadowBlur = 24;
    screenCtx.fillText("A QUIETER WORLD", 110, h * 0.46);

    screenCtx.shadowBlur = 0;
    screenCtx.font = "600 22px 'Inter', sans-serif";
    screenCtx.fillStyle = "rgba(100, 225, 255, 0.95)";
    screenCtx.fillText("A VOYAGE ACROSS SILENT OCEANS OF SPACE", 112, h * 0.55);

    screenCtx.font = "500 16px 'Inter', sans-serif";
    screenCtx.fillStyle = "rgba(255, 255, 255, 0.65)";
    screenCtx.fillText("70MM IMAX PROJECTION   |   NASA SOUND ARCHIVES   |   4K HDR", 112, h * 0.64);
  }

  // Live Audio Equalizer Bars along bottom
  const barCount = 48;
  const barW = 8;
  const startX = 112;
  const startY = h * 0.74;

  for (let b = 0; b < barCount; b++) {
    const barH = 6 + Math.sin(screenAnimTime * 6 + b * 0.7) * 16 + Math.cos(screenAnimTime * 4 + b) * 10;
    screenCtx.fillStyle = `rgba(214, 168, 92, ${0.4 + (b / barCount) * 0.45})`;
    screenCtx.fillRect(startX + b * 13, startY - Math.abs(barH), barW, Math.abs(barH));
  }

  screenTexture.needsUpdate = true;
}

// ==========================================================================
// 6. BUILD CINEMA AUDITORIUM ARCHITECTURE
// ==========================================================================

const auditoriumGroup = new THREE.Group();
auditoriumGroup.name = "Auditorium";
scene.add(auditoriumGroup);

// Helper function to build solid boxes
function makeBox(name, x, y, z, w, h, d, mat, castShadow = false, receiveShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  auditoriumGroup.add(mesh);
  return mesh;
}

// 6.1 Main Floor
makeBox(
  "Main Floor Base",
  0,
  -0.2,
  1.0,
  AUDITORIUM_CONFIG.width,
  0.4,
  AUDITORIUM_CONFIG.depth,
  materials.mainFloor,
);

// 6.2 Front Stage
makeBox(
  "Front Stage",
  0,
  0.22,
  -12.2,
  16.2,
  0.44,
  2.8,
  materials.stageFloor,
);
// Stage gold lip
makeBox(
  "Stage Gold Lip",
  0,
  0.44,
  -10.82,
  16.0,
  0.06,
  0.06,
  materials.goldTrim,
);

// Stage Subwoofers
for (const side of [-1, 1]) {
  const subGroup = new THREE.Group();
  subGroup.position.set(side * 6.8, 0.85, -12.1);

  const subBox = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.9, 0.9),
    materials.blackSpeaker,
  );
  subBox.castShadow = true;
  subGroup.add(subBox);

  // Subwoofer cone circles
  for (const coneX of [-0.4, 0.4]) {
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.05, 24),
      materials.speakerGrille,
    );
    cone.rotation.x = Math.PI / 2;
    cone.position.set(coneX, 0, 0.46);
    subGroup.add(cone);
  }

  // Gold emblem badge
  const badge = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.08, 0.02),
    materials.goldTrim,
  );
  badge.position.set(0, 0.32, 0.46);
  subGroup.add(badge);

  auditoriumGroup.add(subGroup);
}

// 6.3 Walls & Ceiling
// Left and Right Walls
makeBox(
  "Left Wall",
  -AUDITORIUM_CONFIG.width / 2,
  AUDITORIUM_CONFIG.height / 2,
  1.0,
  0.5,
  AUDITORIUM_CONFIG.height,
  AUDITORIUM_CONFIG.depth,
  materials.wall,
);

makeBox(
  "Right Wall",
  AUDITORIUM_CONFIG.width / 2,
  AUDITORIUM_CONFIG.height / 2,
  1.0,
  0.5,
  AUDITORIUM_CONFIG.height,
  AUDITORIUM_CONFIG.depth,
  materials.wall,
);

// Rear Wall
makeBox(
  "Rear Wall",
  0,
  AUDITORIUM_CONFIG.height / 2,
  AUDITORIUM_CONFIG.depth / 2,
  AUDITORIUM_CONFIG.width,
  AUDITORIUM_CONFIG.height,
  0.5,
  materials.wall,
);

// Front Wall (behind screen)
makeBox(
  "Front Wall",
  0,
  AUDITORIUM_CONFIG.height / 2,
  -AUDITORIUM_CONFIG.depth / 2,
  AUDITORIUM_CONFIG.width,
  AUDITORIUM_CONFIG.height,
  0.5,
  materials.wall,
);

// Ceiling with Acoustic Slats
makeBox(
  "Ceiling Base",
  0,
  AUDITORIUM_CONFIG.height,
  1.0,
  AUDITORIUM_CONFIG.width,
  0.3,
  AUDITORIUM_CONFIG.depth,
  materials.ceiling,
);

// Ceiling acoustic beams & linear recessed warm lights
for (let z = -10; z <= 12; z += 3.2) {
  // Transverse ceiling beam
  makeBox(
    "Ceiling Beam",
    0,
    AUDITORIUM_CONFIG.height - 0.2,
    z,
    AUDITORIUM_CONFIG.width - 1.0,
    0.25,
    0.35,
    materials.wallPanel,
  );

  // Recessed warm LED strip
  makeBox(
    "Ceiling LED Strip",
    0,
    AUDITORIUM_CONFIG.height - 0.31,
    z,
    14.0,
    0.04,
    0.08,
    materials.ledStepLight,
  );
}

// 6.4 Acoustic Wall Columns, Gold Fins & Wall Sconces
for (const side of [-1, 1]) {
  const wallX = side * (AUDITORIUM_CONFIG.width / 2 - 0.25);

  for (let z = -9.5; z <= 11.5; z += 3.0) {
    // 3D Acoustic vertical rib
    makeBox(
      "Acoustic Fin",
      wallX,
      AUDITORIUM_CONFIG.height / 2,
      z,
      0.35,
      AUDITORIUM_CONFIG.height * 0.75,
      1.6,
      materials.wallPanel,
    );

    // Gold vertical trim line
    makeBox(
      "Gold Fin Trim",
      wallX - side * 0.18,
      AUDITORIUM_CONFIG.height / 2,
      z,
      0.04,
      AUDITORIUM_CONFIG.height * 0.72,
      0.04,
      materials.goldTrim,
    );

    // Warm LED Wall Sconce
    const sconceY = 4.2;
    const sconceMesh = makeBox(
      "Wall Sconce",
      wallX - side * 0.2,
      sconceY,
      z,
      0.08,
      0.7,
      0.25,
      materials.goldEmissive,
    );

    // Warm point light for wall wash
    const sconceLight = new THREE.PointLight("#e8ad5b", 22, 6.5, 1.6);
    sconceLight.position.set(wallX - side * 0.5, sconceY, z);
    auditoriumGroup.add(sconceLight);
  }
}

// 6.4.1 Continuous Architectural Gold Skirting & LED Baseboards
for (const side of [-1, 1]) {
  const wallX = side * (AUDITORIUM_CONFIG.width / 2 - 0.2);

  // Gold skirting board along bottom of wall
  makeBox(
    "Wall Base Skirting",
    wallX,
    0.12,
    1.0,
    0.06,
    0.24,
    AUDITORIUM_CONFIG.depth,
    materials.goldTrim,
  );

  // Warm LED floor wash line
  makeBox(
    "Wall LED Floor Wash",
    wallX - side * 0.03,
    0.02,
    1.0,
    0.03,
    0.04,
    AUDITORIUM_CONFIG.depth,
    materials.ledStepLight,
  );

  // Mid-wall horizontal gold reveal moulding (at y = 3.2m)
  makeBox(
    "Wall Mid Gold Trim",
    wallX - side * 0.02,
    3.2,
    1.0,
    0.04,
    0.08,
    AUDITORIUM_CONFIG.depth,
    materials.goldTrim,
  );
}

// 6.4.2 Dolby Atmos Surround Sound Wall Speakers (Side & Rear Walls)
// Side Wall Surround Speakers
for (const side of [-1, 1]) {
  const wallX = side * (AUDITORIUM_CONFIG.width / 2 - 0.38);

  for (const z of [-7.0, -3.0, 1.0, 5.0, 9.0]) {
    const spkGroup = new THREE.Group();
    spkGroup.position.set(wallX, 5.2, z);
    spkGroup.rotation.y = -side * 0.25; // angled slightly towards audience center
    spkGroup.rotation.x = 0.18; // angled downwards towards seats

    // Speaker trapezoid cabinet
    const spkBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.42, 0.32),
      materials.surroundSpeaker,
    );
    spkBody.castShadow = true;
    spkGroup.add(spkBody);

    // Front acoustic fabric grille
    const spkFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.51, 0.38),
      materials.speakerGrille,
    );
    spkFace.position.set(0, 0, 0.165);
    spkGroup.add(spkFace);

    // Gold Dolby Atmos logo badge
    const badge = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.04, 0.01),
      materials.goldTrim,
    );
    badge.position.set(0, -0.14, 0.17);
    spkGroup.add(badge);

    auditoriumGroup.add(spkGroup);
  }
}

// Rear Wall Surround Speakers
for (const x of [-7.0, -2.5, 2.5, 7.0]) {
  const spkGroup = new THREE.Group();
  spkGroup.position.set(x, 5.8, AUDITORIUM_CONFIG.depth / 2 - 0.35);
  spkGroup.rotation.y = Math.PI; // facing forward toward screen
  spkGroup.rotation.x = 0.18; // angled downward

  const spkBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.42, 0.32),
    materials.surroundSpeaker,
  );
  spkBody.castShadow = true;
  spkGroup.add(spkBody);

  const spkFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.51, 0.38),
    materials.speakerGrille,
  );
  spkFace.position.set(0, 0, 0.165);
  spkGroup.add(spkFace);

  auditoriumGroup.add(spkGroup);
}

// 6.4.3 Illuminated Emergency Exit Doors & Glowing Green Signs
const exitDoorLocations = [
  // Front Left & Right Exits (near stage)
  { x: -AUDITORIUM_CONFIG.width / 2 + 0.12, y: 1.3, z: -10.5, rotY: Math.PI / 2 },
  { x: AUDITORIUM_CONFIG.width / 2 - 0.12, y: 1.3, z: -10.5, rotY: -Math.PI / 2 },
  // Rear Left & Right Exits (near back)
  { x: -AUDITORIUM_CONFIG.width / 2 + 0.12, y: 3.6, z: 12.0, rotY: Math.PI / 2 },
  { x: AUDITORIUM_CONFIG.width / 2 - 0.12, y: 3.6, z: 12.0, rotY: -Math.PI / 2 },
];

exitDoorLocations.forEach((loc) => {
  const doorGroup = new THREE.Group();
  doorGroup.position.set(loc.x, loc.y, loc.z);
  doorGroup.rotation.y = loc.rotY;

  // Dark steel door frame
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(1.5, 2.4, 0.08),
    materials.doorFrame,
  );
  doorGroup.add(frame);

  // Metallic emergency panic push bar
  const panicBar = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.06, 0.08),
    materials.panicBar,
  );
  panicBar.position.set(0, -0.15, 0.08);
  doorGroup.add(panicBar);

  // Glowing Green Exit Sign Box
  const signBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.28, 0.12),
    materials.doorFrame,
  );
  signBox.position.set(0, 1.42, 0.08);
  doorGroup.add(signBox);

  // Glowing Green Acrylic Face (CHIQISH / EXIT)
  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.24),
    materials.exitSignGreen,
  );
  signFace.position.set(0, 1.42, 0.145);
  doorGroup.add(signFace);

  // Soft green point light illuminating the door & step
  const exitLight = new THREE.PointLight("#00e676", 6.0, 4.0, 1.8);
  exitLight.position.set(0, 1.3, 0.4);
  doorGroup.add(exitLight);

  auditoriumGroup.add(doorGroup);
});

// 6.4.4 Backlit Cinema Poster Lightboxes on Side Walkway Walls
for (const side of [-1, 1]) {
  const wallX = side * (AUDITORIUM_CONFIG.width / 2 - 0.26);

  for (const z of [2.0, 7.0]) {
    const posterGroup = new THREE.Group();
    posterGroup.position.set(wallX, 4.0, z);
    posterGroup.rotation.y = (-side * Math.PI) / 2;

    // Beveled outer black frame
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 1.9, 0.08),
      materials.posterFrame,
    );
    posterGroup.add(frame);

    // Gold inner border
    const goldRim = new THREE.Mesh(
      new THREE.BoxGeometry(1.22, 1.82, 0.09),
      materials.goldTrim,
    );
    posterGroup.add(goldRim);

    // Glowing backlit poster face
    const posterFace = new THREE.Mesh(
      new THREE.PlaneGeometry(1.14, 1.74),
      materials.posterGlow,
    );
    posterFace.position.set(0, 0, 0.05);
    posterGroup.add(posterFace);

    // Soft warm backlight
    const posterLight = new THREE.PointLight("#ffd580", 8.0, 3.2);
    posterLight.position.set(0, 0, 0.3);
    posterGroup.add(posterLight);

    auditoriumGroup.add(posterGroup);
  }
}

// 6.5 Pro Line-Array Hanging Speakers (Clusters on Left & Right near screen)
for (const side of [-1, 1]) {
  const clusterGroup = new THREE.Group();
  clusterGroup.position.set(side * 9.2, 6.2, -11.5);
  clusterGroup.rotation.y = -side * 0.45; // Angled toward audience

  // Hanging bracket beam
  const bracket = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 1.8, 0.12),
    materials.blackSpeaker,
  );
  bracket.position.set(0, 0.9, 0);
  clusterGroup.add(bracket);

  // 4 curved line array speaker boxes
  for (let i = 0; i < 4; i++) {
    const boxGroup = new THREE.Group();
    boxGroup.position.set(0, -i * 0.45, i * 0.08);
    boxGroup.rotation.x = 0.08 + i * 0.06; // progressive downward curve!

    const spkBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.38, 0.65),
      materials.blackSpeaker,
    );
    spkBox.castShadow = true;
    boxGroup.add(spkBox);

    // Front grille
    const spkGrille = new THREE.Mesh(
      new THREE.PlaneGeometry(1.04, 0.34),
      materials.speakerGrille,
    );
    spkGrille.position.set(0, 0, 0.33);
    boxGroup.add(spkGrille);

    clusterGroup.add(boxGroup);
  }

  auditoriumGroup.add(clusterGroup);
}

// 6.6 Rear Wall Projection Booth & Volumetric Beam
const boothWindow = makeBox(
  "Booth Window Frame",
  0,
  6.2,
  AUDITORIUM_CONFIG.depth / 2 - 0.2,
  3.2,
  1.4,
  0.2,
  materials.blackSpeaker,
);

const boothGlass = new THREE.Mesh(
  new THREE.PlaneGeometry(2.8, 1.0),
  new THREE.MeshBasicMaterial({
    color: "#e6f2ff",
    transparent: true,
    opacity: 0.4,
  }),
);
boothGlass.position.set(0, 6.2, AUDITORIUM_CONFIG.depth / 2 - 0.28);
boothGlass.rotation.y = Math.PI;
auditoriumGroup.add(boothGlass);

// Soft Projector Volumetric Cone Beam
const coneLength = 26.5;
const coneRadius = 7.8;
const beamGeom = new THREE.ConeGeometry(coneRadius, coneLength, 32, 1, true);
const beamMat = new THREE.MeshBasicMaterial({
  color: "#99c4ff",
  transparent: true,
  opacity: 0.038,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});

const projectorBeam = new THREE.Mesh(beamGeom, beamMat);
projectorBeam.position.set(0, 5.7, 1.2);
projectorBeam.rotation.x = Math.PI / 2 + 0.04;
auditoriumGroup.add(projectorBeam);

// 6.7 Giant Cinema Screen & Luxury Frame
// Outer matte black frame
makeBox(
  "Screen Outer Frame",
  0,
  AUDITORIUM_CONFIG.screenY,
  AUDITORIUM_CONFIG.screenZ - 0.15,
  AUDITORIUM_CONFIG.screenWidth + 0.9,
  AUDITORIUM_CONFIG.screenHeight + 0.9,
  0.35,
  materials.blackSpeaker,
);

// Inner gold metallic border
makeBox(
  "Screen Gold Border",
  0,
  AUDITORIUM_CONFIG.screenY,
  AUDITORIUM_CONFIG.screenZ - 0.03,
  AUDITORIUM_CONFIG.screenWidth + 0.14,
  AUDITORIUM_CONFIG.screenHeight + 0.14,
  0.1,
  materials.goldTrim,
);

// Cinema Screen Mesh
let screenMesh = null;
const screenGeometry = new THREE.PlaneGeometry(
  AUDITORIUM_CONFIG.screenWidth,
  AUDITORIUM_CONFIG.screenHeight,
);
screenMesh = new THREE.Mesh(screenGeometry, screenMaterial);
screenMesh.name = "Cinema Screen Surface";
screenMesh.position.set(0, AUDITORIUM_CONFIG.screenY, AUDITORIUM_CONFIG.screenZ);
auditoriumGroup.add(screenMesh);

// ==========================================================================
// 7. CINEMATIC LIGHTING SETUP
// ==========================================================================

// Ambient light (low intensity, cinematic contrast)
const ambientLight = new THREE.AmbientLight("#9db1db", 0.7);
scene.add(ambientLight);

// Screen bounce light (soft blue/warm glow casting on stage and audience)
const screenBounceLight = new THREE.PointLight("#ffb066", 75, 24, 1.4);
screenBounceLight.position.set(0, AUDITORIUM_CONFIG.screenY - 0.5, AUDITORIUM_CONFIG.screenZ + 2.5);
scene.add(screenBounceLight);

// Overhead stage spotlight
const stageSpot = new THREE.SpotLight("#fff0d4", 110);
stageSpot.position.set(0, AUDITORIUM_CONFIG.height - 0.8, -4.5);
stageSpot.target.position.set(0, 0.4, -12.0);
stageSpot.angle = Math.PI / 4.5;
stageSpot.penumbra = 0.65;
stageSpot.castShadow = true;
stageSpot.shadow.bias = -0.0005;
stageSpot.shadow.mapSize.width = 1024;
stageSpot.shadow.mapSize.height = 1024;
scene.add(stageSpot);
scene.add(stageSpot.target);

// Soft central fill light
const auditoriumFillLight = new THREE.PointLight("#ffdca8", 60, 28, 1.8);
auditoriumFillLight.position.set(0, 7.5, 3.0);
scene.add(auditoriumFillLight);

// Screen frontal key light (illuminates the front faces of the seats, creating rich specular highlights on the leather bolsters)
const seatFrontKeyLight = new THREE.DirectionalLight("#ffe2b8", 0.65);
seatFrontKeyLight.position.set(0, 5.8, -10.0);
seatFrontKeyLight.target.position.set(0, 2.2, 3.5);
scene.add(seatFrontKeyLight);
scene.add(seatFrontKeyLight.target);

// ==========================================================================
// 8. STEPPED SEATING TERRACES, AISLES & ULTRA-REALISTIC RECLINERS
// ==========================================================================

const selectableSeatMeshes = [];
const allSeatsMap = new Map(); // seatId -> seatObject
const selectedSeatsSet = new Set(); // set of seatIds

// Reserved seats matching the reference screenshot distribution
const PRE_RESERVED_SEATS = new Set([
  // Middle & center rows booked (VIP area like in reference!)
  "C-5", "C-6",
  "D-4", "D-5", "D-6", "D-7",
  "E-3", "E-4", "E-5", "E-6", "E-7", "E-8",
  "F-4", "F-5", "F-6", "F-7",
  "G-5", "G-6", "G-8", "G-9",
  "H-4", "H-5", "H-6",
]);

const ROW_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

// Reusable geometries template (instantiated once, shared by 80 chairs for optimal 60fps performance!)
const RECLINER_GEOMS = {
  // 1. Cushion
  cushionShell: new THREE.BoxGeometry(0.86, 0.12, 0.76),
  cushionCenter: new THREE.BoxGeometry(0.56, 0.18, 0.72),
  cushionBolster: new THREE.BoxGeometry(0.14, 0.22, 0.74),
  cushionWaterfall: new THREE.CylinderGeometry(0.09, 0.09, 0.84, 18),

  // 2. Backrest (Segmented dual vertical bolsters as in reference!)
  backShell: new THREE.BoxGeometry(0.86, 0.98, 0.08),
  lumbarPad: new THREE.BoxGeometry(0.80, 0.32, 0.18),
  upperBackPad: new THREE.BoxGeometry(0.38, 0.62, 0.18),
  backSideBolster: new THREE.BoxGeometry(0.07, 0.94, 0.18),
  centerCrease: new THREE.BoxGeometry(0.025, 0.62, 0.06),

  // 3. Headrest
  headrestBase: new THREE.BoxGeometry(0.68, 0.28, 0.22),
  headrestTopRoll: new THREE.CylinderGeometry(0.065, 0.065, 0.68, 18),
  headrestCollar: new THREE.BoxGeometry(0.38, 0.10, 0.12),

  // 4. Armrests & Stanchions
  armpad: new THREE.BoxGeometry(0.16, 0.10, 0.70),
  armpadNose: new THREE.CylinderGeometry(0.05, 0.05, 0.16, 18),
  stanchion: new THREE.BoxGeometry(0.12, 0.58, 0.62),
  cupholderRim: new THREE.CylinderGeometry(0.075, 0.075, 0.04, 20),
  cupholderCavity: new THREE.CylinderGeometry(0.058, 0.058, 0.045, 20),

  // 5. Undercarriage & Base Mounting
  pedestalColumn: new THREE.BoxGeometry(0.09, 0.38, 0.09),
  pedestalFloorPlate: new THREE.BoxGeometry(0.24, 0.03, 0.24),
  pivotPlate: new THREE.BoxGeometry(0.04, 0.18, 0.22),

  // 6. Aisle End Accents
  aisleEndPlate: new THREE.BoxGeometry(0.03, 0.65, 0.68),
  aisleMarker: new THREE.CylinderGeometry(0.035, 0.035, 0.015, 16),
  rowBadge: new THREE.BoxGeometry(0.012, 0.06, 0.08),
};

/**
 * Builds an ultra-realistic cinema recliner chair matching reference photo
 */
function buildReclinerModel(seatId, isReserved, seatNumber) {
  const seatGroup = new THREE.Group();
  seatGroup.name = `Seat_${seatId}`;

  const upholsteryMat = isReserved
    ? materials.seatUpholsteryReserved
    : materials.seatUpholsteryAvailable;

  const headrestMat = isReserved
    ? materials.seatUpholsteryReserved
    : materials.seatHeadrestAvailable;

  const upholsteredParts = [];

  // ----------------------------------------------------
  // 1. CONTOURED SEAT CUSHION (with waterfall edge & bolsters)
  // ----------------------------------------------------
  // Bottom protective shell
  const cushionShell = new THREE.Mesh(RECLINER_GEOMS.cushionShell, materials.seatShell);
  cushionShell.position.set(0, 0.38, -0.04);
  cushionShell.castShadow = true;
  seatGroup.add(cushionShell);

  // Center seat pad
  const cushionCenter = new THREE.Mesh(RECLINER_GEOMS.cushionCenter, upholsteryMat);
  cushionCenter.position.set(0, 0.47, -0.04);
  cushionCenter.castShadow = true;
  cushionCenter.receiveShadow = true;
  seatGroup.add(cushionCenter);
  upholsteredParts.push(cushionCenter);

  // Left & Right thigh bolsters
  for (const side of [-1, 1]) {
    const bolster = new THREE.Mesh(RECLINER_GEOMS.cushionBolster, upholsteryMat);
    bolster.position.set(side * 0.35, 0.50, -0.04);
    bolster.castShadow = true;
    bolster.receiveShadow = true;
    seatGroup.add(bolster);
    upholsteredParts.push(bolster);
  }

  // Rounded front waterfall nose
  const waterfall = new THREE.Mesh(RECLINER_GEOMS.cushionWaterfall, upholsteryMat);
  waterfall.rotation.z = Math.PI / 2;
  waterfall.position.set(0, 0.44, -0.40);
  waterfall.castShadow = true;
  waterfall.receiveShadow = true;
  seatGroup.add(waterfall);
  upholsteredParts.push(waterfall);

  // ----------------------------------------------------
  // 2. SEGMENTED RECLINED BACKREST (Dual vertical bolsters & lumbar)
  // ----------------------------------------------------
  const backGroup = new THREE.Group();
  backGroup.rotation.x = 0.10; // realistic recliner tilt

  // Rigid back shell casing
  const backShell = new THREE.Mesh(RECLINER_GEOMS.backShell, materials.seatShell);
  backShell.position.set(0, 1.02, 0.30);
  backShell.castShadow = true;
  backGroup.add(backShell);

  // Lower lumbar support cushion
  const lumbarPad = new THREE.Mesh(RECLINER_GEOMS.lumbarPad, upholsteryMat);
  lumbarPad.position.set(0, 0.70, 0.22);
  lumbarPad.castShadow = true;
  lumbarPad.receiveShadow = true;
  backGroup.add(lumbarPad);
  upholsteredParts.push(lumbarPad);

  // Upper backrest divided into dual vertical padded bolsters
  for (const side of [-1, 1]) {
    const upperPad = new THREE.Mesh(RECLINER_GEOMS.upperBackPad, upholsteryMat);
    upperPad.position.set(side * 0.20, 1.15, 0.24);
    upperPad.castShadow = true;
    upperPad.receiveShadow = true;
    backGroup.add(upperPad);
    upholsteredParts.push(upperPad);

    const sideBolster = new THREE.Mesh(RECLINER_GEOMS.backSideBolster, upholsteryMat);
    sideBolster.position.set(side * 0.41, 1.02, 0.22);
    sideBolster.castShadow = true;
    backGroup.add(sideBolster);
    upholsteredParts.push(sideBolster);
  }

  // Recessed center seam channel (shadow crease)
  const centerCrease = new THREE.Mesh(RECLINER_GEOMS.centerCrease, materials.seatShell);
  centerCrease.position.set(0, 1.15, 0.22);
  backGroup.add(centerCrease);

  seatGroup.add(backGroup);

  // ----------------------------------------------------
  // 3. SCULPTED HEADREST
  // ----------------------------------------------------
  const headrestBase = new THREE.Mesh(RECLINER_GEOMS.headrestBase, headrestMat);
  headrestBase.position.set(0, 1.62, 0.32);
  headrestBase.rotation.x = 0.10;
  headrestBase.castShadow = true;
  seatGroup.add(headrestBase);
  upholsteredParts.push(headrestBase);

  const headrestTopRoll = new THREE.Mesh(RECLINER_GEOMS.headrestTopRoll, headrestMat);
  headrestTopRoll.rotation.z = Math.PI / 2;
  headrestTopRoll.rotation.x = 0.10;
  headrestTopRoll.position.set(0, 1.76, 0.32);
  headrestTopRoll.castShadow = true;
  seatGroup.add(headrestTopRoll);
  upholsteredParts.push(headrestTopRoll);

  const headrestCollar = new THREE.Mesh(RECLINER_GEOMS.headrestCollar, materials.seatShell);
  headrestCollar.position.set(0, 1.48, 0.30);
  seatGroup.add(headrestCollar);

  // ----------------------------------------------------
  // 4. ARMRESTS, STANCHIONS & METALLIC CUPHOLDERS
  // ----------------------------------------------------
  for (const side of [-1, 1]) {
    const armX = side * 0.48;

    // Vertical stanchion divider
    const stanchion = new THREE.Mesh(RECLINER_GEOMS.stanchion, materials.stanchionMat);
    stanchion.position.set(armX, 0.29, 0.02);
    stanchion.castShadow = true;
    seatGroup.add(stanchion);

    // Padded armrest top
    const armpad = new THREE.Mesh(RECLINER_GEOMS.armpad, materials.seatArmpad);
    armpad.position.set(armX, 0.62, 0.02);
    armpad.castShadow = true;
    seatGroup.add(armpad);

    const armpadNose = new THREE.Mesh(RECLINER_GEOMS.armpadNose, materials.seatArmpad);
    armpadNose.rotation.z = Math.PI / 2;
    armpadNose.position.set(armX, 0.62, -0.33);
    armpadNose.castShadow = true;
    seatGroup.add(armpadNose);

    // Brass Cup Holder Rim
    const cupholderRim = new THREE.Mesh(RECLINER_GEOMS.cupholderRim, materials.cupholderGold);
    cupholderRim.position.set(armX, 0.68, -0.22);
    seatGroup.add(cupholderRim);

    // Dark Cupholder Interior
    const cupholderCavity = new THREE.Mesh(RECLINER_GEOMS.cupholderCavity, materials.cupholderInterior);
    cupholderCavity.position.set(armX, 0.685, -0.22);
    seatGroup.add(cupholderCavity);
  }

  // ----------------------------------------------------
  // 5. AISLE END ACCENTS (For walkway-bordering chairs)
  // ----------------------------------------------------
  const isAisleEdge = seatNumber === 1 || seatNumber === 5 || seatNumber === 6 || seatNumber === 10;
  if (isAisleEdge) {
    const aisleSide = (seatNumber === 1 || seatNumber === 5) ? -1 : 1;

    // Outer decorative end plate
    const endPlate = new THREE.Mesh(RECLINER_GEOMS.aisleEndPlate, materials.aisleEndPanel);
    endPlate.position.set(aisleSide * 0.55, 0.35, 0.02);
    seatGroup.add(endPlate);

    // Warm LED aisle courtesy marker light
    const marker = new THREE.Mesh(RECLINER_GEOMS.aisleMarker, materials.aisleMarkerLED);
    marker.rotation.z = Math.PI / 2;
    marker.position.set(aisleSide * 0.57, 0.22, 0.02);
    seatGroup.add(marker);

    // Gold row badge
    const badge = new THREE.Mesh(RECLINER_GEOMS.rowBadge, materials.goldTrim);
    badge.position.set(aisleSide * 0.57, 0.48, 0.02);
    seatGroup.add(badge);
  }

  // ----------------------------------------------------
  // 6. UNDERCARRIAGE & FLOOR MOUNTING BRACKETS
  // ----------------------------------------------------
  for (const legX of [-0.28, 0.28]) {
    const col = new THREE.Mesh(RECLINER_GEOMS.pedestalColumn, materials.stanchionMat);
    col.position.set(legX, 0.19, 0.02);
    col.castShadow = true;
    seatGroup.add(col);

    const plate = new THREE.Mesh(RECLINER_GEOMS.pedestalFloorPlate, materials.stanchionMat);
    plate.position.set(legX, 0.015, 0.02);
    seatGroup.add(plate);
  }

  // Pivot mechanism brackets
  for (const side of [-1, 1]) {
    const pivot = new THREE.Mesh(RECLINER_GEOMS.pivotPlate, materials.stanchionMat);
    pivot.position.set(side * 0.42, 0.46, 0.20);
    seatGroup.add(pivot);
  }

  // Tag upholstered meshes for raycasting
  upholsteredParts.forEach((part) => {
    part.userData = { isSeat: true, seatId, seatGroup };
    if (!isReserved) {
      selectableSeatMeshes.push(part);
    }
  });

  return { seatGroup, upholsteredParts, headrestBase, headrestTopRoll };
}

// 8.1 Construct All Stepped Rows & Platforms
for (let r = 0; r < AUDITORIUM_CONFIG.rowsCount; r++) {
  const rowLetter = ROW_LETTERS[r];
  const z = AUDITORIUM_CONFIG.firstRowZ + r * AUDITORIUM_CONFIG.rowSpacing;
  const height = AUDITORIUM_CONFIG.firstRowElevation + r * AUDITORIUM_CONFIG.rowRise;

  // Tier Platforms: Solid platforms meeting the floor
  const platformDepth = 1.96;
  const platformW = 7.0;

  // Left Platform Slab
  const leftPlatform = makeBox(
    `Platform_L_${rowLetter}`,
    -4.9,
    height / 2,
    z,
    platformW,
    height,
    platformDepth,
    materials.terraceBase,
  );

  // Right Platform Slab
  const rightPlatform = makeBox(
    `Platform_R_${rowLetter}`,
    4.9,
    height / 2,
    z,
    platformW,
    height,
    platformDepth,
    materials.terraceBase,
  );

  // Central Aisle Step matching tier height
  makeBox(
    `AisleStep_${rowLetter}`,
    0,
    height / 2,
    z,
    AUDITORIUM_CONFIG.aisleWidth,
    height,
    platformDepth,
    materials.carpet,
  );

  // Illuminated Warm Gold LED Step Edge on Central Aisle!
  makeBox(
    `StepLED_${rowLetter}`,
    0,
    height + 0.015,
    z - platformDepth / 2 + 0.02,
    AUDITORIUM_CONFIG.aisleWidth - 0.05,
    0.03,
    0.04,
    materials.ledStepLight,
  );

  // Carpet tops on Left & Right Platforms
  makeBox(
    `Carpet_L_${rowLetter}`,
    -4.9,
    height + 0.01,
    z,
    platformW - 0.2,
    0.02,
    platformDepth - 0.1,
    materials.carpet,
  );

  makeBox(
    `Carpet_R_${rowLetter}`,
    4.9,
    height + 0.01,
    z,
    platformW - 0.2,
    0.02,
    platformDepth - 0.1,
    materials.carpet,
  );

  // Place 10 Seats for this Row
  for (let s = 1; s <= AUDITORIUM_CONFIG.seatsPerRow; s++) {
    const seatId = `${rowLetter}-${s}`;
    const isReserved = PRE_RESERVED_SEATS.has(seatId);

    // Calculate X position: 5 on left, 5 on right, with clear central aisle
    let x = 0;
    if (s <= 5) {
      // Left Block (seats 1 to 5)
      x = -AUDITORIUM_CONFIG.aisleWidth / 2 - 0.75 - (5 - s) * 1.25;
    } else {
      // Right Block (seats 6 to 10)
      x = AUDITORIUM_CONFIG.aisleWidth / 2 + 0.75 + (s - 6) * 1.25;
    }

    const { seatGroup, upholsteredParts, headrestBase, headrestTopRoll } = buildReclinerModel(seatId, isReserved, s);

    // Position seat on its platform top
    // Front of recliner faces -Z (toward screen)
    seatGroup.position.set(x, height, z);

    auditoriumGroup.add(seatGroup);

    allSeatsMap.set(seatId, {
      seatId,
      rowLetter,
      seatNumber: s,
      position: new THREE.Vector3(x, height, z),
      isReserved,
      isSelected: false,
      group: seatGroup,
      upholsteredParts,
      headrestBase,
      headrestTopRoll,
    });
  }
}

// ==========================================================================
// 9. RAYCASTER & INTERACTION SYSTEM
// ==========================================================================

const raycaster = new THREE.Raycaster();
const mousePointer = new THREE.Vector2(-999, -999);
let hoveredSeatId = null;
let pointerDownX = 0;
let pointerDownY = 0;

// UI Elements for Raycaster
const tooltipEl = document.getElementById("seatTooltip");
const tooltipSeatName = document.getElementById("tooltipSeatName");
const tooltipSeatPrice = document.getElementById("tooltipSeatPrice");
const tooltipSeatStatus = document.getElementById("tooltipSeatStatus");

window.addEventListener("pointermove", (e) => {
  mousePointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  mousePointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener("pointerdown", (e) => {
  pointerDownX = e.clientX;
  pointerDownY = e.clientY;
});

window.addEventListener("pointerup", (e) => {
  // Check if click was a drag or clean click
  const dist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
  if (dist > 6) return; // was camera drag, ignore

  // Raycast to find clicked chair
  raycaster.setFromCamera(mousePointer, camera);
  const intersects = raycaster.intersectObjects(selectableSeatMeshes);

  if (intersects.length > 0) {
    const hitData = intersects[0].object.userData;
    if (hitData && hitData.seatId) {
      toggleSeatSelection(hitData.seatId);
    }
  }
});

function updateRaycaster() {
  raycaster.setFromCamera(mousePointer, camera);
  const intersects = raycaster.intersectObjects(selectableSeatMeshes);

  if (intersects.length > 0) {
    const hitData = intersects[0].object.userData;
    const seatId = hitData.seatId;
    const seat = allSeatsMap.get(seatId);

    if (seat && !seat.isReserved) {
      document.body.style.cursor = "pointer";

      if (hoveredSeatId !== seatId) {
        hoveredSeatId = seatId;
      }

      // Update 3D Floating Tooltip
      const screenPos = seat.position.clone();
      screenPos.y += 1.6; // head height
      screenPos.project(camera);

      // Check if in front of camera
      if (screenPos.z < 1) {
        const x = ((screenPos.x + 1) * window.innerWidth) / 2;
        const y = ((-screenPos.y + 1) * window.innerHeight) / 2;

        tooltipEl.style.left = `${x}px`;
        tooltipEl.style.top = `${y}px`;
        tooltipEl.style.display = "flex";

        tooltipSeatName.textContent = `Qator ${seat.rowLetter} • Joy ${seat.seatNumber}`;
        tooltipSeatPrice.textContent = `${AUDITORIUM_CONFIG.ticketPrice.toLocaleString("uz-UZ")} so‘m`;
        tooltipSeatStatus.textContent = seat.isSelected ? "Tanlangan (Bekor qilish)" : "Tanlash uchun bosing";
      } else {
        tooltipEl.style.display = "none";
      }
      return;
    }
  }

  document.body.style.cursor = "default";
  hoveredSeatId = null;
  tooltipEl.style.display = "none";
}

// Toggle Seat Selection
function toggleSeatSelection(seatId) {
  const seat = allSeatsMap.get(seatId);
  if (!seat || seat.isReserved) return;

  playClickSound();

  if (seat.isSelected) {
    seat.isSelected = false;
    selectedSeatsSet.delete(seatId);
    applySeatMaterial(seat, "available");
  } else {
    seat.isSelected = true;
    selectedSeatsSet.add(seatId);
    applySeatMaterial(seat, "selected");
  }

  updateBookingUI();
  update2DSeatGrid();
}

function applySeatMaterial(seat, state) {
  let targetMat = materials.seatUpholsteryAvailable;
  let headrestMat = materials.seatHeadrestAvailable;

  if (state === "selected") {
    targetMat = materials.seatUpholsterySelected;
    headrestMat = materials.seatUpholsterySelected;
  } else if (state === "reserved") {
    targetMat = materials.seatUpholsteryReserved;
    headrestMat = materials.seatUpholsteryReserved;
  }

  if (seat.upholsteredParts) {
    seat.upholsteredParts.forEach((part) => {
      if (part === seat.headrestBase || part === seat.headrestTopRoll) {
        part.material = headrestMat;
      } else {
        part.material = targetMat;
      }
    });
  }
}

// ==========================================================================
// 10. CAMERA VIEWPOINTS & CINEMATIC TRANSITIONS
// ==========================================================================

const VIEWPOINTS = {
  screen: {
    position: new THREE.Vector3(0, 3.2, -7.0),
    target: new THREE.Vector3(0, AUDITORIUM_CONFIG.screenY, AUDITORIUM_CONFIG.screenZ),
  },
  center: {
    position: new THREE.Vector3(0, 5.2, 4.8),
    target: new THREE.Vector3(0, 3.8, AUDITORIUM_CONFIG.screenZ),
  },
  back: {
    position: new THREE.Vector3(0, 7.2, 11.8),
    target: new THREE.Vector3(0, 3.6, -5.5),
  },
  frontLeft: {
    position: new THREE.Vector3(-9.2, 3.6, -7.5),
    target: new THREE.Vector3(0, 3.2, 0.0),
  },
  frontRight: {
    position: new THREE.Vector3(9.2, 3.6, -7.5),
    target: new THREE.Vector3(0, 3.2, 0.0),
  },
  backLeft: {
    position: new THREE.Vector3(-9.6, 6.4, 10.6),
    target: new THREE.Vector3(0, 3.5, -5.5),
  },
  backRight: {
    position: new THREE.Vector3(9.6, 6.4, 10.6),
    target: new THREE.Vector3(0, 3.5, -5.5),
  },
  facingSeats: {
    position: new THREE.Vector3(0, 3.6, -9.2),
    target: new THREE.Vector3(0, 3.5, 4.5), // Look back from stage at rising auditorium seats!
  },
};

let isCameraMoving = false;
let moveProgress = 0;
const moveDuration = 1.0;

const startCamPos = new THREE.Vector3();
const endCamPos = new THREE.Vector3();
const startCamTarget = new THREE.Vector3();
const endCamTarget = new THREE.Vector3();

let isFacingScreen = true;
let isTourActive = false;
let tourAngle = 0;
let isInSeatPov = false;

function transitionToCamera(targetPos, targetLookAt, onComplete = null) {
  startCamPos.copy(camera.position);
  endCamPos.copy(targetPos);

  startCamTarget.copy(controls.target);
  endCamTarget.copy(targetLookAt);

  moveProgress = 0;
  isCameraMoving = true;
  controls.enabled = false;

  window._onCameraMoveComplete = onComplete;
}

function setView(viewName) {
  const vp = VIEWPOINTS[viewName];
  if (!vp) return;

  isTourActive = false;
  isInSeatPov = false;
  document.getElementById("tourBtn").classList.remove("active");
  document.getElementById("seatPovBanner").classList.remove("active");

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });

  transitionToCamera(vp.position, vp.target);
}

// Seat POV: Zoom camera directly to selected seat
function viewFromSelectedSeat() {
  if (selectedSeatsSet.size === 0) return;
  const firstSeatId = Array.from(selectedSeatsSet)[0];
  const seat = allSeatsMap.get(firstSeatId);
  if (!seat) return;

  isInSeatPov = true;
  isTourActive = false;
  document.getElementById("tourBtn").classList.remove("active");

  // Position at seat eye level
  const seatEyePos = new THREE.Vector3(
    seat.position.x,
    seat.position.y + 1.25,
    seat.position.z + 0.1,
  );

  const screenCenterTarget = new THREE.Vector3(
    0,
    AUDITORIUM_CONFIG.screenY,
    AUDITORIUM_CONFIG.screenZ,
  );

  transitionToCamera(seatEyePos, screenCenterTarget, () => {
    controls.minDistance = 0.1;
    controls.maxDistance = 1.5; // lock in seat view
  });

  const povBanner = document.getElementById("seatPovBanner");
  document.getElementById("povSeatText").textContent = `Siz ${seatIdFormatted(firstSeatId)} o‘rindiqdasiz`;
  povBanner.classList.add("active");
}

function exitSeatPov() {
  isInSeatPov = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 28;
  document.getElementById("seatPovBanner").classList.remove("active");
  setView("center");
}

function seatIdFormatted(id) {
  const [row, num] = id.split("-");
  return `Qator ${row}, Joy ${num}`;
}

// ==========================================================================
// 11. UI SYNCHRONIZATION & BOOKING LOGIC
// ==========================================================================

const selectedSeatsCountEl = document.getElementById("selectedSeatsCount");
const selectedSeatsListEl = document.getElementById("selectedSeatsList");
const totalPriceDisplayEl = document.getElementById("totalPriceDisplay");
const checkoutBtnEl = document.getElementById("checkoutBtn");
const viewFromSeatBtnEl = document.getElementById("viewFromSeatBtn");

function updateBookingUI() {
  const count = selectedSeatsSet.size;
  selectedSeatsCountEl.textContent = `${count} ta`;

  const total = count * AUDITORIUM_CONFIG.ticketPrice;
  totalPriceDisplayEl.textContent = `${total.toLocaleString("uz-UZ")} so‘m`;

  if (count === 0) {
    selectedSeatsListEl.innerHTML = `<span class="empty-hint">Hozircha o‘rindiq tanlanmagan</span>`;
    checkoutBtnEl.disabled = true;
    viewFromSeatBtnEl.disabled = true;
  } else {
    selectedSeatsListEl.innerHTML = "";
    selectedSeatsSet.forEach((seatId) => {
      const tag = document.createElement("span");
      tag.className = "seat-tag";
      tag.innerHTML = `${seatId} <span class="remove-seat-btn" data-id="${seatId}">✕</span>`;
      selectedSeatsListEl.appendChild(tag);
    });

    checkoutBtnEl.disabled = false;
    viewFromSeatBtnEl.disabled = false;
  }

  // Remove tag handler
  selectedSeatsListEl.querySelectorAll(".remove-seat-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSeatSelection(btn.dataset.id);
    });
  });
}

// 2D Seat Map Grid Generator
const seatsGridContainer = document.getElementById("seatsGridContainer");

function build2DSeatGrid() {
  seatsGridContainer.innerHTML = "";

  for (let r = 0; r < AUDITORIUM_CONFIG.rowsCount; r++) {
    const rowLetter = ROW_LETTERS[r];
    const rowDiv = document.createElement("div");
    rowDiv.className = "grid-row";

    // Left row letter
    const leftLetter = document.createElement("span");
    leftLetter.className = "row-letter";
    leftLetter.textContent = rowLetter;
    rowDiv.appendChild(leftLetter);

    // Left seats block (1-5)
    const leftBlock = document.createElement("div");
    leftBlock.className = "seats-block";
    for (let s = 1; s <= 5; s++) {
      leftBlock.appendChild(create2DSeatButton(rowLetter, s));
    }
    rowDiv.appendChild(leftBlock);

    // Central aisle gap
    const aisleGap = document.createElement("div");
    aisleGap.className = "center-aisle-gap";
    rowDiv.appendChild(aisleGap);

    // Right seats block (6-10)
    const rightBlock = document.createElement("div");
    rightBlock.className = "seats-block";
    for (let s = 6; s <= 10; s++) {
      rightBlock.appendChild(create2DSeatButton(rowLetter, s));
    }
    rowDiv.appendChild(rightBlock);

    // Right row letter
    const rightLetter = document.createElement("span");
    rightLetter.className = "row-letter";
    rightLetter.textContent = rowLetter;
    rowDiv.appendChild(rightLetter);

    seatsGridContainer.appendChild(rowDiv);
  }
}

function create2DSeatButton(row, num) {
  const seatId = `${row}-${num}`;
  const isReserved = PRE_RESERVED_SEATS.has(seatId);
  const btn = document.createElement("button");
  btn.className = `grid-seat-btn ${isReserved ? "reserved" : "available"}`;
  btn.dataset.seatId = seatId;
  btn.textContent = num;
  btn.title = `Qator ${row}, Joy ${num} ${isReserved ? "(Band)" : ""}`;

  if (!isReserved) {
    btn.addEventListener("click", () => {
      toggleSeatSelection(seatId);
    });
  }

  return btn;
}

function update2DSeatGrid() {
  document.querySelectorAll(".grid-seat-btn").forEach((btn) => {
    const seatId = btn.dataset.seatId;
    if (PRE_RESERVED_SEATS.has(seatId)) return;

    if (selectedSeatsSet.has(seatId)) {
      btn.className = "grid-seat-btn selected";
    } else {
      btn.className = "grid-seat-btn available";
    }
  });
}

// ==========================================================================
// 12. EVENT LISTENERS & UI WIRING
// ==========================================================================

// Camera View Buttons
document.querySelectorAll(".view-btn[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    setView(btn.dataset.view);
  });
});

document.getElementById("resetCameraBtn").addEventListener("click", () => {
  setView("center");
});

// Facing Toggle: Screen vs Seats
const facingToggleBtn = document.getElementById("facingToggleBtn");
const facingToggleText = document.getElementById("facingToggleText");

facingToggleBtn.addEventListener("click", () => {
  isFacingScreen = !isFacingScreen;
  if (isFacingScreen) {
    facingToggleText.textContent = "Zalga qarash";
    setView("center");
  } else {
    facingToggleText.textContent = "Ekranga qarash";
    setView("facingSeats");
  }
});

// Tour Toggle (Auditorium panoramic auto-orbit)
const tourBtn = document.getElementById("tourBtn");
tourBtn.addEventListener("click", () => {
  isTourActive = !isTourActive;
  tourBtn.classList.toggle("active", isTourActive);
  if (isTourActive) {
    isInSeatPov = false;
    document.getElementById("seatPovBanner").classList.remove("active");
  }
});

// Sound Toggle
document.getElementById("soundToggleBtn").addEventListener("click", toggleAudio);

// Fullscreen Toggle
document.getElementById("fullscreenBtn").addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((e) => console.log(e));
  } else {
    document.exitFullscreen().catch((e) => console.log(e));
  }
});

// Hero Collapse
const hideHeroBtn = document.getElementById("hideHeroBtn");
const heroOverlay = document.getElementById("heroOverlay");
let heroCollapsed = false;

hideHeroBtn.addEventListener("click", () => {
  heroCollapsed = !heroCollapsed;
  heroOverlay.classList.toggle("collapsed", heroCollapsed);
  hideHeroBtn.innerHTML = heroCollapsed
    ? `<span>Matnni ko‘rsatish</span> ▴`
    : `<span>Matnni yashirish</span> ▾`;
});

// FOV Slider
const fovSlider = document.getElementById("fovSlider");
const fovValue = document.getElementById("fovValue");

fovSlider.addEventListener("input", (e) => {
  const fov = parseInt(e.target.value, 10);
  camera.fov = fov;
  camera.updateProjectionMatrix();
  fovValue.textContent = `${fov}°`;
});

// ============================================================
// Movie Selector Carousel — 3 kinoni bosib ekranda ko'rish!
// ============================================================

let movieToastTimer = null;
const movieToastEl = document.getElementById("movieToast");

function showMovieToast(title) {
  if (!movieToastEl) return;
  movieToastEl.textContent = `🎬 Ekranda: ${title}`;
  movieToastEl.classList.add("show");
  clearTimeout(movieToastTimer);
  movieToastTimer = setTimeout(() => {
    movieToastEl.classList.remove("show");
  }, 2800);
}

document.querySelectorAll(".movie-card").forEach((card) => {
  card.addEventListener("click", () => {
    document.querySelectorAll(".movie-card").forEach((c) => {
      c.classList.remove("active");
      const badge = c.querySelector(".active-badge");
      if (badge) badge.remove();
    });
    card.classList.add("active");

    // Add "NAMOYISHDA" badge dynamically
    const info = card.querySelector(".card-info");
    const badge = document.createElement("div");
    badge.className = "active-badge";
    badge.textContent = "NAMOYISHDA";
    info.prepend(badge);

    const movieKey = card.dataset.movie;
    currentMovieKey = movieKey;
    const m = MOVIES[movieKey];

    // Reset screen animation time for fresh scene start
    screenAnimTime = 0;

    // If a real video is loaded, switch back to canvas
    if (screenMesh.material !== screenMaterial) {
      screenMesh.material = screenMaterial;
    }

    // Update sidebar
    document.getElementById("sidebarMovieTitle").textContent = m.title;
    document.getElementById("sidebarGenre").textContent = m.genre;
    document.getElementById("seatMapMovieInfo").textContent = `${m.title} • 24-oktabr • 13:00`;

    // Show toast notification
    showMovieToast(m.title);

    // Auto-zoom to screen view briefly to show the new movie
    transitionToCamera(
      new THREE.Vector3(0, 4.2, -5.0),
      new THREE.Vector3(0, AUDITORIUM_CONFIG.screenY, AUDITORIUM_CONFIG.screenZ),
    );
    setTimeout(() => {
      if (!isCameraMoving) return;
    }, 1600);
  });
});

// Date Tabs
document.querySelectorAll(".date-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".date-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
  });
});

// Showtime Pills
document.querySelectorAll(".time-pill").forEach((pill) => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".time-pill").forEach((p) => p.classList.remove("active"));
    pill.classList.add("active");
    const time = pill.dataset.time;
    document.getElementById("currentShowtimeBadge").textContent = time;
  });
});

// View from Seat POV Button
viewFromSeatBtnEl.addEventListener("click", viewFromSelectedSeat);
document.getElementById("exitPovBtn").addEventListener("click", exitSeatPov);

// Modals Setup (Modern <dialog> with light-dismiss fallback)
const seatMapModal = document.getElementById("seatMapModal");
const ticketModal = document.getElementById("ticketModal");

document.getElementById("openSeatMapBtn").addEventListener("click", () => {
  build2DSeatGrid();
  update2DSeatGrid();
  seatMapModal.showModal();
});

document.getElementById("closeSeatMapBtn").addEventListener("click", () => {
  seatMapModal.close();
});

document.getElementById("confirmSeatMapBtn").addEventListener("click", () => {
  seatMapModal.close();
});

// Ticket Modal
checkoutBtnEl.addEventListener("click", () => {
  const movie = MOVIES[currentMovieKey];
  const count = selectedSeatsSet.size;
  const total = count * AUDITORIUM_CONFIG.ticketPrice;

  document.getElementById("ticketFilmName").textContent = movie.title;
  document.getElementById("ticketDateTime").textContent = "24-okt, 13:00";
  document.getElementById("ticketSeatsList").textContent = Array.from(selectedSeatsSet).join(", ");
  document.getElementById("ticketTotal").textContent = `${total.toLocaleString("uz-UZ")} so‘m`;

  ticketModal.showModal();
});

document.getElementById("closeTicketBtn").addEventListener("click", () => {
  ticketModal.close();
});

document.getElementById("finishBookingBtn").addEventListener("click", () => {
  ticketModal.close();
});

document.getElementById("printTicketBtn").addEventListener("click", () => {
  window.print();
});

// Light-dismiss fallback for browsers without native 'closedby'
[seatMapModal, ticketModal].forEach((dialog) => {
  if (!("closedBy" in HTMLDialogElement.prototype)) {
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      const inDialog =
        rect.top <= event.clientY &&
        event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX &&
        event.clientX <= rect.left + rect.width;
      if (!inDialog) dialog.close();
    });
  }
});

// Video Controls & Local File Loader
const playPauseBtn = document.getElementById("playPauseBtn");
const playIcon = document.getElementById("playIcon");
const cinemaVideoElement = document.getElementById("cinemaVideoElement");
const videoFileInput = document.getElementById("videoFileInput");

playPauseBtn.addEventListener("click", () => {
  isVideoPlaying = !isVideoPlaying;
  playIcon.textContent = isVideoPlaying ? "⏸" : "▶";

  if (cinemaVideoElement.src) {
    if (isVideoPlaying) cinemaVideoElement.play();
    else cinemaVideoElement.pause();
  }
});

videoFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const url = URL.createObjectURL(file);
    cinemaVideoElement.src = url;
    cinemaVideoElement.load();
    cinemaVideoElement.play().then(() => {
      // Use VideoTexture directly on the cinema screen
      const videoTexture = new THREE.VideoTexture(cinemaVideoElement);
      videoTexture.colorSpace = THREE.SRGBColorSpace;
      videoTexture.minFilter = THREE.LinearFilter;
      screenMesh.material = new THREE.MeshBasicMaterial({ map: videoTexture });
      isVideoPlaying = true;
      playIcon.textContent = "⏸";
      showMovieToast(`📽 Video: ${file.name}`);
    }).catch(() => {
      // Autoplay blocked — notify user
      showMovieToast("▶ Videoni ijro etish uchun bosing");
    });
  }
});

// Window Resize Handler
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// ==========================================================================
// 13. ANIMATION LOOP & CAMERA INTERPOLATION
// ==========================================================================

const clock = new THREE.Clock();
const hudDistanceEl = document.getElementById("hudDistance");
const hudHeightEl = document.getElementById("hudHeight");
const screenCenterPos = new THREE.Vector3(0, AUDITORIUM_CONFIG.screenY, AUDITORIUM_CONFIG.screenZ);

// Movie accent light colors (screen bounce glow changes per film!)
const MOVIE_LIGHT_COLORS = {
  lastlight: { r: 1.0, g: 0.55, b: 0.15 },   // Warm amber/orange — solar epic
  sintel:    { r: 1.0, g: 0.22, b: 0.15 },   // Deep crimson — fantasy fire
  quieter:   { r: 0.1, g: 0.65, b: 1.0 },   // Cool cyan-blue — space documentary
};

const lerpColor = (a, b, t) => ({
  r: a.r + (b.r - a.r) * t,
  g: a.g + (b.g - a.g) * t,
  b: a.b + (b.b - a.b) * t,
});

let currentLightColor = { ...MOVIE_LIGHT_COLORS.lastlight };
let targetLightColor  = { ...MOVIE_LIGHT_COLORS.lastlight };

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  // 1. Update Screen Canvas Animation
  updateScreenCanvas(delta);

  // 2. Smoothly interpolate screen bounce-light color to match the active movie
  const tgt = MOVIE_LIGHT_COLORS[currentMovieKey];
  if (tgt) {
    currentLightColor.r += (tgt.r - currentLightColor.r) * 0.028;
    currentLightColor.g += (tgt.g - currentLightColor.g) * 0.028;
    currentLightColor.b += (tgt.b - currentLightColor.b) * 0.028;
    screenBounceLight.color.setRGB(currentLightColor.r, currentLightColor.g, currentLightColor.b);
  }

  // 3. Camera View Transitions (Smooth Cubic Hermite Interpolation)
  if (isCameraMoving) {
    moveProgress += delta / moveDuration;
    const p = Math.min(moveProgress, 1.0);
    const t = p * p * (3.0 - 2.0 * p); // smoothstep

    camera.position.lerpVectors(startCamPos, endCamPos, t);
    controls.target.lerpVectors(startCamTarget, endCamTarget, t);

    if (p >= 1.0) {
      isCameraMoving = false;
      controls.enabled = true;
      if (window._onCameraMoveComplete) {
        window._onCameraMoveComplete();
        window._onCameraMoveComplete = null;
      }
    }
  }

  // 4. Tour Auto-Orbit Mode
  if (isTourActive && !isCameraMoving) {
    tourAngle += delta * 0.18;
    const radius = 12.0;
    camera.position.x = Math.sin(tourAngle) * radius;
    camera.position.z = Math.cos(tourAngle) * 7.0 + 2.0;
    camera.position.y = 5.2 + Math.sin(tourAngle * 0.8) * 1.4;
    controls.target.set(0, 3.8, -4.0);
  }

  controls.update();

  // 5. Update Raycaster & Seat Hover
  updateRaycaster();

  // 6. Update Camera Stats HUD
  const distToScreen = camera.position.distanceTo(screenCenterPos);
  const camHeight = camera.position.y;
  hudDistanceEl.textContent = `Ekrangacha masofa: ${distToScreen.toFixed(1)} m`;
  hudHeightEl.textContent = `Balandlik: ${camHeight.toFixed(1)} m`;

  renderer.render(scene, camera);
}

// Start Animation Loop
animate();

// Remove loading screen smoothly after scene ready
function initializeApp() {
  build2DSeatGrid();
  updateBookingUI();

  const loadProgress = document.getElementById("loadProgress");
  const loadStatus = document.getElementById("loadStatus");
  const loadingScreen = document.getElementById("loading");

  let p = 0;
  const interval = setInterval(() => {
    p += 25;
    if (loadProgress) loadProgress.style.width = `${p}%`;
    if (p >= 100) {
      clearInterval(interval);
      if (loadStatus) loadStatus.textContent = "Tayyor!";
      setTimeout(() => {
        if (loadingScreen) loadingScreen.classList.add("hidden");
      }, 300);
    }
  }, 80);
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}

// Failsafe timer to never get stuck on loading screen
setTimeout(() => {
  const loadingScreen = document.getElementById("loading");
  if (loadingScreen && !loadingScreen.classList.contains("hidden")) {
    loadingScreen.classList.add("hidden");
  }
}, 1200);
