import { useRef, useEffect, useCallback } from 'react';

interface SoftAuroraProps {
  speed?: number;
  brightness?: number;
  color1?: string;
  color2?: string;
  className?: string;
}

export default function SoftAurora({
  speed = 0.4,
  brightness = 0.6,
  color1 = '#f0e6fb',
  color2 = '#6a12cd',
  className = '',
}: SoftAuroraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5 });
  const timeRef = useRef(0);

  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    timeRef.current += speed * 0.008;
    const t = timeRef.current;

    ctx.clearRect(0, 0, w, h);

    const c1 = hexToRgb(color1);
    const c2 = hexToRgb(color2);

    // Multiple soft aurora bands
    for (let band = 0; band < 3; band++) {
      const offset = band * 0.7;
      const gradient = ctx.createLinearGradient(0, 0, w, h);

      const mix1 = Math.sin(t * 0.5 + offset) * 0.5 + 0.5;
      const mix2 = Math.cos(t * 0.3 + offset * 2) * 0.5 + 0.5;

      const r1 = Math.round(c1.r * (1 - mix1) + c2.r * mix1);
      const g1 = Math.round(c1.g * (1 - mix1) + c2.g * mix1);
      const b1 = Math.round(c1.b * (1 - mix1) + c2.b * mix1);

      const opacity = brightness * (0.03 + band * 0.015);

      gradient.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, 0)`);
      gradient.addColorStop(0.3 + mix2 * 0.2, `rgba(${r1}, ${g1}, ${b1}, ${opacity})`);
      gradient.addColorStop(0.6 + mix1 * 0.1, `rgba(${c2.r}, ${c2.g}, ${c2.b}, ${opacity * 0.7})`);
      gradient.addColorStop(1, `rgba(${r1}, ${g1}, ${b1}, 0)`);

      ctx.save();

      // Wave path
      ctx.beginPath();
      const yBase = h * (0.2 + band * 0.25) + Math.sin(t + offset) * h * 0.08;
      const mouseInfluence = (mouseRef.current.y - 0.5) * h * 0.05;

      ctx.moveTo(-10, yBase + mouseInfluence);

      for (let x = 0; x <= w + 10; x += 8) {
        const nx = x / w;
        const wave1 = Math.sin(nx * 3 + t + offset) * h * 0.06;
        const wave2 = Math.sin(nx * 5 - t * 0.7 + offset * 1.5) * h * 0.03;
        const mouseWave = Math.sin(nx * 2) * (mouseRef.current.x - 0.5) * h * 0.02;
        const y = yBase + wave1 + wave2 + mouseWave + mouseInfluence;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w + 10, h + 10);
      ctx.lineTo(-10, h + 10);
      ctx.closePath();

      ctx.fillStyle = gradient;
      ctx.filter = 'blur(40px)';
      ctx.fill();
      ctx.filter = 'none';
      ctx.restore();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [speed, brightness, color1, color2]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width * dpr * 0.5; // Lower res for perf
      canvas.height = rect.height * dpr * 0.5;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
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

    canvas.parentElement?.addEventListener('mousemove', handleMouse);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.parentElement?.removeEventListener('mousemove', handleMouse);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none ${className}`}
    />
  );
}
