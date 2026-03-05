import { useRef, useEffect, useMemo, useCallback } from "react";
import * as THREE from "three";

const NEON_COLORS = ["#00ff88", "#ff3cac", "#ffee00", "#3cf"];

const TRACK_WIDTH = 800;
const TRACK_HEIGHT = 320;
const LANE_PADDING = 30;
const CAR_WIDTH = 40;
const CAR_HEIGHT = 20;
const FINISH_LINE_WIDTH = 16;
const ESTIMATED_CEILING_MS = 20000;

/**
 * Creates a pixel-art car canvas texture in the given neon color.
 */
function createCarTexture(color) {
  const w = 16;
  const h = 8;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Simple pixel car shape
  const c = color;
  const d = "#111";
  const rows = [
    [d, d, d, c, c, c, c, c, c, c, c, c, c, d, d, d],
    [d, d, c, c, c, c, c, c, c, c, c, c, c, c, d, d],
    [d, c, c, "#fff", c, c, c, c, c, c, c, "#fff", c, c, c, d],
    [c, c, c, c, c, c, c, c, c, c, c, c, c, c, c, c],
    [c, c, c, c, c, c, c, c, c, c, c, c, c, c, c, c],
    [d, c, c, "#fff", c, c, c, c, c, c, c, "#fff", c, c, c, d],
    [d, d, c, c, c, c, c, c, c, c, c, c, c, c, d, d],
    [d, d, d, c, c, c, c, c, c, c, c, c, c, d, d, d],
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      ctx.fillStyle = rows[y][x];
      ctx.fillRect(x, y, 1, 1);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

/**
 * Creates a chequered finish line canvas texture.
 */
function createFinishTexture(height) {
  const tileSize = 8;
  const tilesX = 2;
  const tilesY = Math.ceil(height / tileSize);
  const canvas = document.createElement("canvas");
  canvas.width = tilesX * tileSize;
  canvas.height = tilesY * tileSize;
  const ctx = canvas.getContext("2d");

  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#fff" : "#111";
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

/**
 * Confetti particles burst from a given position.
 */
function createConfetti(scene, x, y) {
  const count = 60;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const velocities = [];

  for (let i = 0; i < count; i++) {
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = 0;

    const color = new THREE.Color(
      NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)]
    );
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    velocities.push({
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
    });
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 4,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthTest: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  return { points, velocities, age: 0 };
}

const POSITION_LABELS = ["1ST", "2ND", "3RD", "4TH"];

/**
 * Three.js race track with orthographic camera, dynamic lanes,
 * pixel car meshes, progress animation, and finish effects.
 *
 * @param {{
 *   models: Array<{ id: string, label: string, color: string }>,
 *   modelStates: Record<string, { status: string, elapsed_ms: number|null, finish_position: number|null }>,
 *   raceStatus: string
 * }} props
 */
export default function RaceTrack({ models, modelStates, raceStatus }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const carsRef = useRef([]);
  const lightsRef = useRef([]);
  const confettiRef = useRef([]);
  const animFrameRef = useRef(null);
  const raceStartTimeRef = useRef(null);
  const timerEls = useRef({});

  const laneCount = models.length;

  // Derive position overlays from modelStates
  const positionOverlays = useMemo(() => {
    const overlays = {};
    for (const m of models) {
      const state = modelStates[m.id];
      if (state && state.status === "done" && state.finish_position) {
        overlays[m.id] = state.finish_position;
      }
    }
    return overlays;
  }, [models, modelStates]);

  // Lane Y positions — centered in track
  const laneYPositions = useMemo(() => {
    if (laneCount === 0) return [];
    const usableHeight = TRACK_HEIGHT - LANE_PADDING * 2;
    const laneSpacing = usableHeight / laneCount;
    const startY = -TRACK_HEIGHT / 2 + LANE_PADDING + laneSpacing / 2;
    return Array.from({ length: laneCount }, (_, i) => startY + i * laneSpacing);
  }, [laneCount]);

  // Track start/finish x
  const startX = -TRACK_WIDTH / 2 + 60;
  const finishX = TRACK_WIDTH / 2 - 40;
  const trackLength = finishX - startX;

  // Set race start time when running
  useEffect(() => {
    if (raceStatus === "running" && !raceStartTimeRef.current) {
      raceStartTimeRef.current = performance.now();
    }
    if (raceStatus === "idle") {
      raceStartTimeRef.current = null;
    }
  }, [raceStatus]);

  // Compute per-model progress
  const getProgress = useCallback(
    (modelId) => {
      const state = modelStates[modelId];
      if (!state) return 0;
      if (state.status === "done") return 1.0;
      if (state.status !== "running") return 0;
      if (!raceStartTimeRef.current) return 0;
      const elapsed = performance.now() - raceStartTimeRef.current;
      return Math.min(elapsed / ESTIMATED_CEILING_MS, 0.95);
    },
    [modelStates]
  );

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
    });
    renderer.setSize(TRACK_WIDTH, TRACK_HEIGHT);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x0a0a1a, 1);
    canvasRef.current = renderer.domElement;
    containerRef.current.prepend(renderer.domElement);

    const camera = new THREE.OrthographicCamera(
      -TRACK_WIDTH / 2,
      TRACK_WIDTH / 2,
      TRACK_HEIGHT / 2,
      -TRACK_HEIGHT / 2,
      0.1,
      1000
    );
    camera.position.z = 100;

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;

    return () => {
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Setup cars and lanes when models change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Clear old cars and lights
    for (const car of carsRef.current) scene.remove(car);
    for (const light of lightsRef.current) scene.remove(light);
    for (const c of confettiRef.current) scene.remove(c.points);
    carsRef.current = [];
    lightsRef.current = [];
    confettiRef.current = [];

    // Remove old finish line and lane separators
    const toRemove = scene.children.filter(
      (c) => c.userData.isFinishLine || c.userData.isLaneLine
    );
    toRemove.forEach((c) => scene.remove(c));

    if (laneCount === 0) return;

    // Draw lane separator lines
    const usableHeight = TRACK_HEIGHT - LANE_PADDING * 2;
    const laneSpacing = usableHeight / laneCount;
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x333366,
      transparent: true,
      opacity: 0.4,
    });

    for (let i = 0; i <= laneCount; i++) {
      const y = -TRACK_HEIGHT / 2 + LANE_PADDING + i * laneSpacing;
      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-TRACK_WIDTH / 2 + 20, y, 0),
        new THREE.Vector3(TRACK_WIDTH / 2 - 20, y, 0),
      ]);
      const line = new THREE.Line(lineGeom, lineMat);
      line.userData.isLaneLine = true;
      scene.add(line);
    }

    // Finish line
    const finishTex = createFinishTexture(usableHeight);
    const finishGeom = new THREE.PlaneGeometry(
      FINISH_LINE_WIDTH,
      usableHeight
    );
    const finishMat = new THREE.MeshBasicMaterial({
      map: finishTex,
      transparent: false,
    });
    const finishMesh = new THREE.Mesh(finishGeom, finishMat);
    finishMesh.position.set(finishX, 0, 0);
    finishMesh.userData.isFinishLine = true;
    scene.add(finishMesh);

    // Create cars
    const cars = [];
    const lights = [];
    models.forEach((model, i) => {
      const color = model.color || NEON_COLORS[i % NEON_COLORS.length];
      const carTex = createCarTexture(color);
      const carGeom = new THREE.PlaneGeometry(CAR_WIDTH, CAR_HEIGHT);
      const carMat = new THREE.MeshBasicMaterial({
        map: carTex,
        transparent: true,
      });
      const carMesh = new THREE.Mesh(carGeom, carMat);
      carMesh.position.set(startX, laneYPositions[i], 1);
      carMesh.userData.modelId = model.id;
      carMesh.userData.baseY = laneYPositions[i];
      carMesh.userData.color = color;
      scene.add(carMesh);
      cars.push(carMesh);

      // Underglow point light
      const pointLight = new THREE.PointLight(
        new THREE.Color(color),
        1.5,
        60
      );
      pointLight.position.set(startX, laneYPositions[i] - 12, 5);
      scene.add(pointLight);
      lights.push(pointLight);
    });

    carsRef.current = cars;
    lightsRef.current = lights;
  }, [models, laneCount, laneYPositions, startX, finishX]);

  // Animation loop
  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!renderer || !scene || !camera) return;

    const doneSet = new Set();

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      const now = performance.now();

      // Update car positions
      carsRef.current.forEach((car, i) => {
        const modelId = car.userData.modelId;
        const progress = getProgress(modelId);
        const x = startX + progress * trackLength;
        car.position.x = x;

        // Sin-wave bobbing when moving
        const state = modelStates[modelId];
        if (state && state.status === "running") {
          car.position.y =
            car.userData.baseY + Math.sin(now * 0.005) * 3;
        } else {
          car.position.y = car.userData.baseY;
        }

        // Update underglow light position
        if (lightsRef.current[i]) {
          lightsRef.current[i].position.x = x;
          lightsRef.current[i].position.y = car.position.y - 12;
        }

        // Grey out non-winners when all done
        if (raceStatus === "done" && state) {
          if (state.finish_position === 1) {
            car.material.opacity = 1.0;
          } else {
            car.material.opacity = 0.4;
          }

          // Confetti for done models (trigger once)
          if (state.status === "done" && !doneSet.has(modelId)) {
            doneSet.add(modelId);
            const confetti = createConfetti(
              scene,
              finishX,
              car.userData.baseY
            );
            confettiRef.current.push(confetti);
          }
        }
      });

      // Update confetti
      confettiRef.current.forEach((c) => {
        c.age += 0.016;
        const posAttr = c.points.geometry.getAttribute("position");
        for (let j = 0; j < posAttr.count; j++) {
          posAttr.array[j * 3] += c.velocities[j].vx;
          posAttr.array[j * 3 + 1] += c.velocities[j].vy;
        }
        posAttr.needsUpdate = true;
        c.points.material.opacity = Math.max(0, 1 - c.age * 1.5);
      });

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [
    getProgress,
    modelStates,
    raceStatus,
    startX,
    finishX,
    trackLength,
  ]);

  // Live timers using requestAnimationFrame
  useEffect(() => {
    if (raceStatus !== "running" && raceStatus !== "done") return;

    let rafId;
    function tick() {
      const now = performance.now();
      models.forEach((m) => {
        const el = timerEls.current[m.id];
        if (!el) return;
        const state = modelStates[m.id];
        if (!state) return;

        if (state.status === "done" && state.elapsed_ms != null) {
          const s = Math.floor(state.elapsed_ms / 1000);
          const ms = Math.floor((state.elapsed_ms % 1000) / 10);
          el.textContent = `${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
        } else if (
          state.status === "running" &&
          raceStartTimeRef.current
        ) {
          const elapsed = now - raceStartTimeRef.current;
          const s = Math.floor(elapsed / 1000);
          const ms = Math.floor((elapsed % 1000) / 10);
          el.textContent = `${String(s).padStart(2, "0")}.${String(ms).padStart(2, "0")}`;
        }
      });
      rafId = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(rafId);
  }, [raceStatus, models, modelStates]);

  return (
    <div className="relative w-full" style={{ maxWidth: TRACK_WIDTH }}>
      {/* Three.js canvas container with scanline overlay */}
      <div
        ref={containerRef}
        className="scanline-overlay relative"
        style={{
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          maxWidth: "100%",
          overflow: "hidden",
        }}
      >
        {/* HUD model labels and timers */}
        {models.map((m, i) => {
          const laneY = laneYPositions[i];
          // Convert Three.js coords to CSS (origin is center)
          const cssTop = TRACK_HEIGHT / 2 - laneY - 28;
          const color = m.color || NEON_COLORS[i % NEON_COLORS.length];
          const position = positionOverlays[m.id];

          return (
            <div
              key={m.id}
              className="absolute left-2 flex items-center gap-2"
              style={{
                top: cssTop,
                zIndex: 20,
              }}
            >
              <span
                className="text-[8px] uppercase neon-flicker"
                style={{
                  color,
                  textShadow: `0 0 6px ${color}`,
                }}
              >
                {m.label}
              </span>
              <span
                ref={(el) => {
                  timerEls.current[m.id] = el;
                }}
                className="text-[8px] text-white"
                style={{ fontFamily: '"Press Start 2P", monospace' }}
              >
                00.00
              </span>
              {position != null && (
                <span
                  className="text-[10px] neon-yellow blink font-bold"
                  style={{
                    textShadow: "0 0 8px #ffee00",
                  }}
                >
                  {POSITION_LABELS[position - 1] || `${position}TH`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
