import { useRef, useEffect, useCallback } from 'react';

interface FloatingLinesProps {
  enabledWaves?: ('top' | 'middle' | 'bottom')[];
  lineCount?: number | number[];
  lineDistance?: number | number[];
  bendRadius?: number;
  bendStrength?: number;
  interactive?: boolean;
  parallax?: boolean;
  className?: string;
  color?: string;
  opacity?: number;
}

interface Line {
  wave: string;
  index: number;
  baseY: number;
  offset: number;
  speed: number;
  amplitude: number;
  frequency: number;
  phase: number;
}

export default function FloatingLines({
  enabledWaves = ['top', 'middle', 'bottom'],
  lineCount = 5,
  lineDistance = 5,
  bendRadius = 5,
  bendStrength = -0.5,
  interactive = true,
  parallax = true,
  className = '',
  color = '#6a12cd',
  opacity = 0.08,
}: FloatingLinesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const timeRef = useRef(0);
  const linesRef = useRef<Line[]>([]);

  const getCount = useCallback((waveIdx: number) => {
    if (Array.isArray(lineCount)) return lineCount[waveIdx] ?? 5;
    return lineCount;
  }, [lineCount]);

  const getDist = useCallback((waveIdx: number) => {
    if (Array.isArray(lineDistance)) return lineDistance[waveIdx] ?? 5;
    return lineDistance;
  }, [lineDistance]);

  const initLines = useCallback((h: number) => {
    const lines: Line[] = [];
    const wavePositions: Record<string, number> = {
      top: h * 0.2,
      middle: h * 0.5,
      bottom: h * 0.8,
    };

    enabledWaves.forEach((wave, waveIdx) => {
      const count = getCount(waveIdx);
      const dist = getDist(waveIdx);
      const baseY = wavePositions[wave] ?? h * 0.5;

      for (let i = 0; i < count; i++) {
        lines.push({
          wave,
          index: i,
          baseY: baseY + (i - count / 2) * dist,
          offset: i * 0.3,
          speed: 0.3 + Math.random() * 0.4,
          amplitude: 15 + Math.random() * 25,
          frequency: 0.8 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
        });
      }
    });

    linesRef.current = lines;
  }, [enabledWaves, getCount, getDist]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    timeRef.current += 0.008;
    const t = timeRef.current;

    ctx.clearRect(0, 0, w, h);

    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;

    linesRef.current.forEach((line) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.globalAlpha = opacity * (0.4 + line.index * 0.12);
      ctx.lineWidth = 1.2;

      const steps = Math.ceil(w / 4);
      for (let s = 0; s <= steps; s++) {
        const x = (s / steps) * w;
        const nx = x / w;

        // Base wave
        let y = line.baseY;
        y += Math.sin(nx * line.frequency * Math.PI * 2 + t * line.speed + line.phase) * line.amplitude;
        y += Math.sin(nx * line.frequency * 1.5 * Math.PI + t * line.speed * 0.7 + line.offset) * line.amplitude * 0.4;

        // Parallax
        if (parallax) {
          const parallaxScale = 0.3 + line.index * 0.08;
          y += (my - 0.5) * 30 * parallaxScale;
        }

        // Interactive bend near mouse
        if (interactive) {
          const dx = nx - mx;
          const dy = (y / h) - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const bendRadiusNorm = bendRadius * 0.1;

          if (dist < bendRadiusNorm) {
            const influence = (1 - dist / bendRadiusNorm);
            const push = influence * influence * bendStrength * 60;
            y += push;
          }
        }

        if (s === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();
    });

    ctx.globalAlpha = 1;
    animRef.current = requestAnimationFrame(draw);
  }, [color, opacity, bendRadius, bendStrength, interactive, parallax]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(dpr, dpr);
      initLines(rect.height);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      };
    };

    const parent = canvas.parentElement;
    parent?.addEventListener('mousemove', handleMouse);

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      parent?.removeEventListener('mousemove', handleMouse);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw, initLines]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
    />
  );
}
