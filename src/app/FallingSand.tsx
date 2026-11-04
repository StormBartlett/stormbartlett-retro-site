"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import ArcadeMenu from "./apps/ArcadeMenu";
import arcade from "./apps/Arcade.module.css";

type ParticleType = "empty" | "sand" | "water" | "dirt" | "stone" | "lava";

interface Particle {
  type: ParticleType;
  velocity: number;
  updated: boolean;
}

const PARTICLE_COLORS: Record<ParticleType, string> = {
  empty: "#000000",
  sand: "#f4d03f",
  water: "#3498db",
  dirt: "#8b4513",
  stone: "#808080",
  lava: "#ff4500",
};

const BASE_PARTICLE_SIZE = 4; // Base pixels per particle (at 1x scale)

export default function FallingSand() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef=useRef<HTMLDivElement>(null);
  const [paused,setPaused]=useState(false);
  const pausedRef=useRef(false);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<ParticleType>("sand");
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(3);
  const [canvasScale, setCanvasScale] = useState(1); // Scale from 1x to 100x
  const [targetFPS, setTargetFPS] = useState(60); // Target FPS from 0 to 200
  const [actualFPS, setActualFPS] = useState(0); // Actual measured FPS
  const particlesRef = useRef<Particle[][]>([]);
  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const colsRef = useRef(0);
  const rowsRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const lastRenderTimeRef=useRef(0);
  const fpsHistoryRef = useRef<number[]>([]);
  const lastFPSUpdateRef = useRef(0);
  
  // Initialize particle grid
  const initGrid = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    widthRef.current = rect.width;
    heightRef.current = rect.height;
    // Calculate particle size based on scale (smaller particles = higher resolution)
    const particleSize = Math.max(1, Math.floor(BASE_PARTICLE_SIZE / canvasScale));
    colsRef.current = Math.floor(widthRef.current / particleSize);
    rowsRef.current = Math.floor(heightRef.current / particleSize);

    particlesRef.current = Array(rowsRef.current)
      .fill(null)
      .map((_, rowIndex) =>
        Array(colsRef.current)
          .fill(null)
          .map(() => {
            // Add stone floor at the bottom
            if (rowIndex === rowsRef.current - 1) {
              return {
                type: "stone" as ParticleType,
                velocity: 0,
                updated: false,
              };
            }
            return {
              type: "empty" as ParticleType,
              velocity: 0,
              updated: false,
            };
          })
      );
  }, [canvasScale]);

  // Place particles at position (with proper coordinate transformation)
  const placeParticles = useCallback(
    (x: number, y: number, type: ParticleType) => {
      if (!canvasRef.current) return;
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      
      // Get the actual canvas size (may differ from CSS size due to device pixel ratio)
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      const cssWidth = rect.width;
      const cssHeight = rect.height;
      
      // Calculate scale factors
      const scaleX = canvasWidth / cssWidth;
      const scaleY = canvasHeight / cssHeight;
      
      // Convert mouse coordinates to canvas coordinates
      const canvasX = (x - rect.left) * scaleX;
      const canvasY = (y - rect.top) * scaleY;

      // Calculate particle size based on scale
      const particleSize = Math.max(1, Math.floor(BASE_PARTICLE_SIZE / canvasScale));
      const col = Math.floor(canvasX / particleSize);
      const row = Math.floor(canvasY / particleSize);

      // Increase brush density - place particles more densely
      const radius = brushSize;
      const density = Math.max(1, Math.ceil(particleSize / 2)); // More dense when zoomed out
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const distSq = dx * dx + dy * dy;
          if (distSq <= radius * radius) {
            // Place multiple particles for denser placement
            for (let subY = 0; subY < density; subY++) {
              for (let subX = 0; subX < density; subX++) {
                const offsetX = subX / density - 0.5;
                const offsetY = subY / density - 0.5;
                const c = col + dx + Math.round(offsetX);
                const r = row + dy + Math.round(offsetY);
                
                // Only place if still within brush radius
                const finalDx = c - col;
                const finalDy = r - row;
                if (finalDx * finalDx + finalDy * finalDy <= radius * radius) {
                  if (
                    r >= 0 &&
                    r < rowsRef.current &&
                    c >= 0 &&
                    c < colsRef.current
                  ) {
                    particlesRef.current[r][c] = {
                      type,
                      velocity: 0,
                      updated: false,
                    };
                  }
                }
              }
            }
          }
        }
      }
    },
    [brushSize, canvasScale]
  );

  // Update physics
  const updatePhysics = useCallback(() => {
    const particles = particlesRef.current;
    const cols = colsRef.current;
    const rows = rowsRef.current;

    // Reset updated flags
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        particles[r][c].updated = false;
      }
    }

    // Check for lava-water interactions (creates stone)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const particle = particles[r][c];
        if (particle.type === "lava") {
          // Check adjacent cells for water
          const neighbors = [
            r > 0 ? particles[r - 1][c] : null, // above
            r < rows - 1 ? particles[r + 1][c] : null, // below
            c > 0 ? particles[r][c - 1] : null, // left
            c < cols - 1 ? particles[r][c + 1] : null, // right
          ];
          for (const neighbor of neighbors) {
            if (neighbor && neighbor.type === "water") {
              neighbor.type = "stone";
              neighbor.updated = false;
            }
          }
        }
      }
    }

    // Update from bottom to top (prevents double updates)
    for (let r = rows - 2; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        if (particles[r][c].updated) continue;
        const particle = particles[r][c];
        if (particle.type === "empty" || particle.type === "stone") continue; // Stone doesn't move

        const below = r + 1 < rows ? particles[r + 1][c] : null;
        const belowLeft =
          r + 1 < rows && c - 1 >= 0 ? particles[r + 1][c - 1] : null;
        const belowRight =
          r + 1 < rows && c + 1 < cols ? particles[r + 1][c + 1] : null;

        if (particle.type === "sand" || particle.type === "dirt") {
          // Sand and dirt can fall through water - swap instead of overwrite
          if (below && below.type === "water") {
            // Swap: move sand/dirt down, move water up
            particles[r + 1][c] = { ...particle, updated: true };
            particles[r][c] = { ...below, updated: true };
            continue;
          }
          if (below && below.type === "empty") {
            particles[r + 1][c] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
          // Fall diagonally (through water or empty)
          const dir = Math.random() > 0.5 ? 1 : -1;
          const diagonal =
            dir === 1
              ? belowRight
              : belowLeft;
          if (diagonal && diagonal.type === "water") {
            // Swap with water
            const newCol = c + dir;
            particles[r + 1][newCol] = { ...particle, updated: true };
            particles[r][c] = { ...diagonal, updated: true };
            continue;
          }
          if (diagonal && diagonal.type === "empty") {
            const newCol = c + dir;
            particles[r + 1][newCol] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
          // Try other diagonal
          const otherDiagonal =
            dir === 1
              ? belowLeft
              : belowRight;
          if (otherDiagonal && otherDiagonal.type === "water") {
            // Swap with water
            const newCol = c - dir;
            particles[r + 1][newCol] = { ...particle, updated: true };
            particles[r][c] = { ...otherDiagonal, updated: true };
            continue;
          }
          if (otherDiagonal && otherDiagonal.type === "empty") {
            const newCol = c - dir;
            particles[r + 1][newCol] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
        } else if (particle.type === "water") {
          // Water prioritizes falling down - only flows sideways when blocked
          if (below && (below.type === "empty" || below.type === "lava")) {
            particles[r + 1][c] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
          // Try diagonally down first (more natural water flow)
          const dir = Math.random() > 0.5 ? 1 : -1;
          const diagonalDown = r + 1 < rows && c + dir >= 0 && c + dir < cols ? particles[r + 1][c + dir] : null;
          if (diagonalDown && (diagonalDown.type === "empty" || diagonalDown.type === "lava")) {
            particles[r + 1][c + dir] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
          // Try other diagonal down
          const otherDiagonalDown = r + 1 < rows && c - dir >= 0 && c - dir < cols ? particles[r + 1][c - dir] : null;
          if (otherDiagonalDown && (otherDiagonalDown.type === "empty" || otherDiagonalDown.type === "lava")) {
            particles[r + 1][c - dir] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
          // Only flow sideways if completely blocked below (water pools)
          const side = c + dir >= 0 && c + dir < cols ? particles[r][c + dir] : null;
          if (side && side.type === "empty" && !side.updated) {
            particles[r][c + dir] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
          // Try other side
          const otherSide = c - dir >= 0 && c - dir < cols ? particles[r][c - dir] : null;
          if (otherSide && otherSide.type === "empty" && !otherSide.updated) {
            particles[r][c - dir] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
        } else if (particle.type === "lava") {
          // Lava flows like water - prioritizes falling down
          if (below && (below.type === "empty" || below.type === "water")) {
            particles[r + 1][c] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
          // Try diagonally down first
          const dir = Math.random() > 0.5 ? 1 : -1;
          const diagonalDown = r + 1 < rows && c + dir >= 0 && c + dir < cols ? particles[r + 1][c + dir] : null;
          if (diagonalDown && (diagonalDown.type === "empty" || diagonalDown.type === "water")) {
            particles[r + 1][c + dir] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
          // Try other diagonal down
          const otherDiagonalDown = r + 1 < rows && c - dir >= 0 && c - dir < cols ? particles[r + 1][c - dir] : null;
          if (otherDiagonalDown && (otherDiagonalDown.type === "empty" || otherDiagonalDown.type === "water")) {
            particles[r + 1][c - dir] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
          // Only flow sideways if completely blocked below
          const side = c + dir >= 0 && c + dir < cols ? particles[r][c + dir] : null;
          if (side && side.type === "empty" && !side.updated) {
            particles[r][c + dir] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
          // Try other side
          const otherSide = c - dir >= 0 && c - dir < cols ? particles[r][c - dir] : null;
          if (otherSide && otherSide.type === "empty" && !otherSide.updated) {
            particles[r][c - dir] = { ...particle, updated: true };
            particles[r][c] = { type: "empty", velocity: 0, updated: true };
            continue;
          }
        }
      }
    }
  }, []);

  // Render particles
  const render = useCallback(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const particles = particlesRef.current;
    const cols = colsRef.current;
    const rows = rowsRef.current;
    
    // Calculate particle size based on scale
    const particleSize = Math.max(1, Math.floor(BASE_PARTICLE_SIZE / canvasScale));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const particle = particles[r][c];
        if (particle.type !== "empty") {
          ctx.fillStyle = PARTICLE_COLORS[particle.type];
          ctx.fillRect(
            c * particleSize,
            r * particleSize,
            particleSize,
            particleSize
          );
          
          // Add glow effect for lava
          if (particle.type === "lava") {
            ctx.shadowBlur = 3;
            ctx.shadowColor = "#ff6600";
            ctx.fillStyle = PARTICLE_COLORS.lava;
            ctx.fillRect(
              c * particleSize,
              r * particleSize,
              particleSize,
              particleSize
            );
            ctx.shadowBlur = 0;
          }
        }
      }
    }
  }, [canvasScale]);

  // Physics and drawing share the selected rate; paused scenes do no frame work.
  const gameLoop = useCallback((currentTime:number)=>{
    if(pausedRef.current||document.hidden||targetFPS===0)return;
    const elapsed=currentTime-lastFrameTimeRef.current;
    const interval=1000/targetFPS;
    if(elapsed+.25>=interval){
      const renderedElapsed=currentTime-lastRenderTimeRef.current;
      if(renderedElapsed>0){
        fpsHistoryRef.current.push(1000/renderedElapsed);
        if(fpsHistoryRef.current.length>60)fpsHistoryRef.current.shift();
        if(currentTime-lastFPSUpdateRef.current>500){
          setActualFPS(Math.round(fpsHistoryRef.current.reduce((a,b)=>a+b,0)/fpsHistoryRef.current.length));
          lastFPSUpdateRef.current=currentTime;
        }
      }
      updatePhysics();render();lastRenderTimeRef.current=currentTime;
      lastFrameTimeRef.current=elapsed>=interval*2?currentTime:lastFrameTimeRef.current+interval;
    }
    animationFrameRef.current=requestAnimationFrame(gameLoop);
  },[targetFPS,updatePhysics,render]);

  // Reinitialize grid when scale changes
  useEffect(() => {
    if (canvasRef.current) {
      initGrid();
      // Render will be called by game loop
    }
  }, [canvasScale, initGrid]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current) return;
      const container = canvasRef.current.parentElement;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);

      canvasRef.current.width = width;
      canvasRef.current.height = height;

      initGrid();render();
    };

    // Use ResizeObserver for more accurate sizing
    const container = canvasRef.current?.parentElement;
    if (container) {
      const resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(container);
      handleResize(); // Initial resize
      return () => resizeObserver.disconnect();
    }
    
    // Fallback to window resize
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initGrid,render]);

  const pause=useCallback(()=>{pausedRef.current=true;setPaused(true);setIsDrawing(false);},[]);
  const resume=()=>{pausedRef.current=false;setPaused(false);surfaceRef.current?.focus({preventScroll:true});};
  useEffect(()=>{
    const hide=()=>{if(document.hidden)pause();};
    const focus=(event:Event)=>{if((event as CustomEvent<{id:string|null}>).detail?.id!=="falling-sand")pause();};
    window.addEventListener("blur",pause);document.addEventListener("visibilitychange",hide);window.addEventListener("storm-app-focus",focus);
    if(document.hidden)pause();else surfaceRef.current?.focus({preventScroll:true});
    return()=>{window.removeEventListener("blur",pause);document.removeEventListener("visibilitychange",hide);window.removeEventListener("storm-app-focus",focus);};
  },[pause]);

  // Start game loop after initialization
  useEffect(() => {
    if(paused||targetFPS===0){setActualFPS(0);render();return;}
    let mounted = true;
    let retry:ReturnType<typeof setTimeout>|undefined;
    lastFrameTimeRef.current = lastRenderTimeRef.current = performance.now();
    fpsHistoryRef.current=[];lastFPSUpdateRef.current=performance.now();
    const startLoop = () => {
      if (mounted && canvasRef.current && colsRef.current > 0 && rowsRef.current > 0) {
        gameLoop(performance.now());
      } else if (mounted) {
        // Retry after a short delay if not ready
        retry=setTimeout(startLoop, 100);
      }
    };
    
    startLoop();
    
    return () => {
      mounted = false;
      clearTimeout(retry);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameLoop, paused, targetFPS, render]);

  // Mouse/touch handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDrawing(true);
      placeParticles(e.clientX, e.clientY, selectedType);
      if(targetFPS===0)render();
    },
    [selectedType, placeParticles, targetFPS, render]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDrawing) {
        placeParticles(e.clientX, e.clientY, selectedType);
      if(targetFPS===0)render();
      }
    },
    [isDrawing, selectedType, placeParticles, targetFPS, render]
  );

  const handlePointerUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  return (
    <div ref={surfaceRef} tabIndex={0} className={`falling-sand-container ${arcade.shell}`} aria-label="Falling Sand" onKeyDown={event=>{if(event.key==="Escape"&&!event.repeat){event.preventDefault();event.stopPropagation();if(paused)resume();else pause();}}}>
      <div className="falling-sand-game">
        <canvas
          ref={canvasRef}
          className="falling-sand-canvas"
          aria-label="Particle drawing canvas"
          onPointerCancel={handlePointerUp}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
        <div className="falling-sand-shader" aria-hidden="true" style={{background:"repeating-linear-gradient(transparent 0 2px,#0002 2px 3px)",position:"absolute",inset:0,pointerEvents:"none"}}/>
        <div className={arcade.help}><button onClick={pause} aria-label="Help and pause">?</button></div>
        {paused&&<ArcadeMenu title="PAUSED" controls={["Click / drag: place material","Choose a material and brush size","FPS 0: stop physics · Esc: pause"]} action={resume}/>}
        {/* FPS Counter overlay */}
        <div style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          color: "#ffffff",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: "14px",
          fontWeight: "700",
          textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
          pointerEvents: "none",
          zIndex: 10
        }}>
          {actualFPS} FPS
        </div>
      </div>
      <div className="falling-sand-hud">
        <div className="hud-section">
          <div className="hud-label">Material:</div>
          <div className="material-buttons">
            <button
              className={`material-btn ${selectedType === "sand" ? "active" : ""}`}
              onClick={() => setSelectedType("sand")}
              style={{ backgroundColor: PARTICLE_COLORS.sand }}
            >
              Sand
            </button>
            <button
              className={`material-btn ${selectedType === "water" ? "active" : ""}`}
              onClick={() => setSelectedType("water")}
              style={{ backgroundColor: PARTICLE_COLORS.water }}
            >
              Water
            </button>
            <button
              className={`material-btn ${selectedType === "dirt" ? "active" : ""}`}
              onClick={() => setSelectedType("dirt")}
              style={{ backgroundColor: PARTICLE_COLORS.dirt }}
            >
              Dirt
            </button>
            <button
              className={`material-btn ${selectedType === "stone" ? "active" : ""}`}
              onClick={() => setSelectedType("stone")}
              style={{ backgroundColor: PARTICLE_COLORS.stone }}
            >
              Stone
            </button>
            <button
              className={`material-btn ${selectedType === "lava" ? "active" : ""}`}
              onClick={() => setSelectedType("lava")}
              style={{ backgroundColor: PARTICLE_COLORS.lava }}
            >
              Lava
            </button>
            <button
              className={`material-btn ${selectedType === "empty" ? "active" : ""}`}
              onClick={() => setSelectedType("empty")}
              style={{ backgroundColor: PARTICLE_COLORS.empty, border: "2px dashed var(--border)" }}
            >
              Erase
            </button>
          </div>
        </div>
        <div className="hud-section">
          <div className="hud-label">Brush Size:</div>
          <input
            type="range"
            aria-label="Brush size"
            min="1"
            max="10"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="brush-slider"
          />
          <div className="brush-size-display">{brushSize}</div>
        </div>
        <div className="hud-section">
          <div className="hud-label">World Size:</div>
          <input
            type="range"
            aria-label="World scale"
            min="1"
            max="100"
            value={canvasScale}
            onChange={(e) => setCanvasScale(Number(e.target.value))}
            className="brush-slider"
          />
          <div className="brush-size-display">{canvasScale}x</div>
        </div>
        <div className="hud-section">
          <div className="hud-label">Game Speed:</div>
          <input
            type="range"
            aria-label="Simulation frame rate"
            min="0"
            max="200"
            value={targetFPS}
            onChange={(e) => setTargetFPS(Number(e.target.value))}
            className="brush-slider"
          />
          <div className="brush-size-display">{targetFPS === 0 ? "Paused" : `${targetFPS} FPS`}</div>
        </div>
        <div className="hud-section">
          <button
            className="clear-btn"
            onClick={() => {
              initGrid();
              render();
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

