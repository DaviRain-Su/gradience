'use client';
import { useEffect, useRef } from 'react';

/*
 * Agent World — the landscape of the Agent economy.
 *
 * Not a diagram. Not a flowchart. A living world where:
 *   - Agents (circles) exist at different "altitudes" (reputation)
 *   - Tasks appear as brief flashes, get claimed, resolved
 *   - Value flows as light between agents
 *   - The whole thing breathes slowly
 */

interface Entity {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    hue: number; // color identity
    reputation: number; // 0-1, affects glow intensity
    breathPhase: number;
}

interface ValueStream {
    from: number;
    to: number;
    progress: number;
    speed: number;
    hue: number;
}

export function AgentWorld() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const entities = useRef<Entity[]>([]);
    const streams = useRef<ValueStream[]>([]);
    const mouse = useRef({ x: -1, y: -1 });
    const frameRef = useRef(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d')!;
        let W = 0,
            H = 0;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const rect = canvas.getBoundingClientRect();
            W = rect.width;
            H = rect.height;
            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.scale(dpr, dpr);
        };

        const init = () => {
            resize();
            entities.current = [];
            const count = Math.min(Math.floor((W * H) / 12000), 60);
            for (let i = 0; i < count; i++) {
                entities.current.push({
                    x: Math.random() * W,
                    y: Math.random() * H,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    radius: 2 + Math.random() * 3,
                    hue: [220, 260, 40, 160][Math.floor(Math.random() * 4)], // blue, violet, amber, emerald
                    reputation: 0.2 + Math.random() * 0.8,
                    breathPhase: Math.random() * Math.PI * 2,
                });
            }
        };

        const spawnStream = () => {
            const ents = entities.current;
            if (ents.length < 2) return;
            const from = Math.floor(Math.random() * ents.length);
            // Find nearest neighbor
            let nearest = -1,
                nearDist = Infinity;
            for (let i = 0; i < ents.length; i++) {
                if (i === from) continue;
                const dx = ents[i].x - ents[from].x;
                const dy = ents[i].y - ents[from].y;
                const d = dx * dx + dy * dy;
                if (d < nearDist && d < 200 * 200) {
                    nearDist = d;
                    nearest = i;
                }
            }
            if (nearest < 0) return;
            streams.current.push({
                from,
                to: nearest,
                progress: 0,
                speed: 0.008 + Math.random() * 0.012,
                hue: ents[from].hue,
            });
        };

        const draw = () => {
            frameRef.current++;
            const t = frameRef.current * 0.01;
            ctx.clearRect(0, 0, W, H);

            // Background gradient — horizon line at ~70%
            const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
            bgGrad.addColorStop(0, 'rgba(9,9,11,1)');
            bgGrad.addColorStop(0.5, 'rgba(12,12,18,1)');
            bgGrad.addColorStop(0.7, 'rgba(15,15,25,1)');
            bgGrad.addColorStop(1, 'rgba(9,9,11,1)');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // Horizon glow
            const horizonY = H * 0.7;
            const horizonGrad = ctx.createRadialGradient(W / 2, horizonY, 0, W / 2, horizonY, W * 0.6);
            horizonGrad.addColorStop(0, 'rgba(139,92,246,0.06)');
            horizonGrad.addColorStop(0.5, 'rgba(59,130,246,0.02)');
            horizonGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = horizonGrad;
            ctx.fillRect(0, 0, W, H);

            const ents = entities.current;

            // Draw connections (faint lines between nearby agents)
            for (let i = 0; i < ents.length; i++) {
                for (let j = i + 1; j < ents.length; j++) {
                    const dx = ents[j].x - ents[i].x;
                    const dy = ents[j].y - ents[i].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        const alpha = (1 - dist / 150) * 0.06;
                        ctx.beginPath();
                        ctx.moveTo(ents[i].x, ents[i].y);
                        ctx.lineTo(ents[j].x, ents[j].y);
                        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }

            // Draw value streams
            streams.current = streams.current.filter((s) => {
                s.progress += s.speed;
                if (s.progress >= 1) return false;
                const a = ents[s.from],
                    b = ents[s.to];
                if (!a || !b) return false;
                const x = a.x + (b.x - a.x) * s.progress;
                const y = a.y + (b.y - a.y) * s.progress;
                const alpha = s.progress < 0.15 ? s.progress / 0.15 : s.progress > 0.85 ? (1 - s.progress) / 0.15 : 1;

                // Trail
                const tx = a.x + (b.x - a.x) * Math.max(0, s.progress - 0.1);
                const ty = a.y + (b.y - a.y) * Math.max(0, s.progress - 0.1);
                const trailGrad = ctx.createLinearGradient(tx, ty, x, y);
                trailGrad.addColorStop(0, `hsla(${s.hue},70%,60%,0)`);
                trailGrad.addColorStop(1, `hsla(${s.hue},70%,60%,${alpha * 0.4})`);
                ctx.beginPath();
                ctx.moveTo(tx, ty);
                ctx.lineTo(x, y);
                ctx.strokeStyle = trailGrad;
                ctx.lineWidth = 2;
                ctx.stroke();

                // Particle head
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${s.hue},70%,70%,${alpha})`;
                ctx.fill();

                return true;
            });

            // Update & draw entities
            for (const e of ents) {
                // Mouse interaction
                if (mouse.current.x > 0) {
                    const dx = e.x - mouse.current.x;
                    const dy = e.y - mouse.current.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 200 && dist > 0) {
                        const force = ((200 - dist) / 200) * 0.02;
                        e.vx += (dx / dist) * force;
                        e.vy += (dy / dist) * force;
                    }
                }

                // Drift
                e.x += e.vx;
                e.y += e.vy;
                e.vx *= 0.99;
                e.vy *= 0.99;

                // Bounds
                if (e.x < 0) {
                    e.x = 0;
                    e.vx *= -1;
                }
                if (e.x > W) {
                    e.x = W;
                    e.vx *= -1;
                }
                if (e.y < 0) {
                    e.y = 0;
                    e.vy *= -1;
                }
                if (e.y > H) {
                    e.y = H;
                    e.vy *= -1;
                }

                // Breathing
                const breath = 1 + Math.sin(t * 1.5 + e.breathPhase) * 0.15;
                const r = e.radius * breath;

                // Glow
                const glowR = r * (4 + e.reputation * 8);
                const glow = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, glowR);
                glow.addColorStop(0, `hsla(${e.hue},60%,60%,${e.reputation * 0.12})`);
                glow.addColorStop(1, 'transparent');
                ctx.fillStyle = glow;
                ctx.beginPath();
                ctx.arc(e.x, e.y, glowR, 0, Math.PI * 2);
                ctx.fill();

                // Core
                ctx.beginPath();
                ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${e.hue},60%,65%,${0.5 + e.reputation * 0.5})`;
                ctx.fill();
            }

            requestAnimationFrame(draw);
        };

        init();
        const streamInterval = setInterval(spawnStream, 500);
        const raf = requestAnimationFrame(draw);

        const onResize = () => {
            resize();
        };
        const onMouse = (ev: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouse.current = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
        };
        const onLeave = () => {
            mouse.current = { x: -1, y: -1 };
        };

        window.addEventListener('resize', onResize);
        canvas.addEventListener('mousemove', onMouse);
        canvas.addEventListener('mouseleave', onLeave);

        return () => {
            clearInterval(streamInterval);
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', onResize);
            canvas.removeEventListener('mousemove', onMouse);
            canvas.removeEventListener('mouseleave', onLeave);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
