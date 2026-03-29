"use client";
import { useEffect, useRef } from "react";

interface Agent {
  x: number;
  y: number;
  role: "poster" | "agent" | "judge";
  label: string;
  phase: number;
}

interface Particle {
  fromIdx: number;
  toIdx: number;
  progress: number;
  speed: number;
  color: string;
}

const AGENTS: Agent[] = [
  { x: 0.2, y: 0.35, role: "poster", label: "Poster", phase: 0 },
  { x: 0.5, y: 0.2, role: "agent", label: "Agent A", phase: 0.3 },
  { x: 0.75, y: 0.3, role: "agent", label: "Agent B", phase: 0.6 },
  { x: 0.55, y: 0.65, role: "judge", label: "Judge", phase: 0.9 },
  { x: 0.85, y: 0.6, role: "agent", label: "Agent C", phase: 0.15 },
  { x: 0.3, y: 0.7, role: "poster", label: "Poster", phase: 0.45 },
  { x: 0.15, y: 0.55, role: "judge", label: "Judge", phase: 0.75 },
];

const CONNECTIONS = [
  [0, 1], [0, 2], [1, 3], [2, 3], [3, 4],
  [5, 4], [5, 2], [6, 1], [6, 5], [0, 6],
];

const ROLE_COLORS = {
  poster: "#0ea5e9",
  agent: "#8b5cf6",
  judge: "#f59e0b",
};

export function AgentNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const time = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Spawn particles
    const spawnParticle = () => {
      const [from, to] = CONNECTIONS[Math.floor(Math.random() * CONNECTIONS.length)];
      const fromAgent = AGENTS[from];
      const toAgent = AGENTS[to];
      const colors = ["#0ea5e9", "#8b5cf6", "#f59e0b", "#10b981"];
      particles.current.push({
        fromIdx: from,
        toIdx: to,
        progress: 0,
        speed: 0.003 + Math.random() * 0.004,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    };

    const draw = () => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      ctx.clearRect(0, 0, w, h);
      time.current += 0.01;

      // Draw connections
      for (const [i, j] of CONNECTIONS) {
        const a = AGENTS[i];
        const b = AGENTS[j];
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw particles
      particles.current = particles.current.filter((p) => {
        p.progress += p.speed;
        if (p.progress > 1) return false;
        const a = AGENTS[p.fromIdx];
        const b = AGENTS[p.toIdx];
        const x = a.x * w + (b.x * w - a.x * w) * p.progress;
        const y = a.y * h + (b.y * h - a.y * h) * p.progress;
        const alpha = p.progress < 0.1 ? p.progress * 10 : p.progress > 0.9 ? (1 - p.progress) * 10 : 1;

        // Glow
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(")", `,${alpha * 0.2})`).replace("rgb", "rgba");
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(")", `,${alpha})`).replace("rgb", "rgba");
        ctx.fill();
        return true;
      });

      // Draw agent nodes
      for (const agent of AGENTS) {
        const ax = agent.x * w;
        const ay = agent.y * h;
        const float = Math.sin(time.current * 2 + agent.phase * 10) * 3;
        const color = ROLE_COLORS[agent.role];

        // Outer glow
        const gradient = ctx.createRadialGradient(ax, ay + float, 0, ax, ay + float, 28);
        gradient.addColorStop(0, color + "30");
        gradient.addColorStop(1, color + "00");
        ctx.beginPath();
        ctx.arc(ax, ay + float, 28, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Pulse ring
        const pulse = (time.current * 0.5 + agent.phase) % 1;
        ctx.beginPath();
        ctx.arc(ax, ay + float, 12 + pulse * 20, 0, Math.PI * 2);
        ctx.strokeStyle = color + Math.round((1 - pulse) * 30).toString(16).padStart(2, "0");
        ctx.lineWidth = 1;
        ctx.stroke();

        // Core circle
        ctx.beginPath();
        ctx.arc(ax, ay + float, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "10px -apple-system, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(agent.label, ax, ay + float + 22);
      }

      requestAnimationFrame(draw);
    };

    // Spawn particles periodically
    const interval = setInterval(spawnParticle, 400);
    const raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      clearInterval(interval);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.7 }}
    />
  );
}
