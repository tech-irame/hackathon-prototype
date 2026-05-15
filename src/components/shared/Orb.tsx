import { useRef, useEffect, useCallback } from 'react';

interface OrbProps {
  hoverIntensity?: number;
  rotateOnHover?: boolean;
  hue?: number;
  className?: string;
  opacity?: number;
}

export default function Orb({
  hoverIntensity = 0.09,
  rotateOnHover = true,
  hue = 275,
  className = '',
  opacity = 0.12,
}: OrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0.5, y: 0.5, active: false });
  const timeRef = useRef(0);
  const rotationRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    timeRef.current += 0.006;
    const t = timeRef.current;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    const isActive = mouseRef.current.active;

    // Rotation on hover
    if (rotateOnHover && isActive) {
      rotationRef.current += (mx - 0.5) * 0.02;
    }
    const rot = rotationRef.current;

    // Orb center follows mouse gently
    const cx = w * 0.5 + (mx - 0.5) * w * hoverIntensity * 2;
    const cy = h * 0.5 + (my - 0.5) * h * hoverIntensity * 2;
    const baseRadius = Math.min(w, h) * 0.28;

    // Draw multiple layered orbs
    const layers = [
      { scale: 1.3, hueShift: 0, alpha: 0.3, blur: 60 },
      { scale: 1.0, hueShift: 15, alpha: 0.5, blur: 30 },
      { scale: 0.7, hueShift: -10, alpha: 0.7, blur: 15 },
      { scale: 0.4, hueShift: 25, alpha: 0.9, blur: 5 },
    ];

    layers.forEach((layer) => {
      const r = baseRadius * layer.scale;
      const wobble1 = Math.sin(t * 1.2 + layer.hueShift * 0.1) * r * 0.08;
      const wobble2 = Math.cos(t * 0.9 + layer.hueShift * 0.15) * r * 0.06;

      const lx = cx + wobble1 + Math.cos(rot + layer.hueShift) * r * 0.05;
      const ly = cy + wobble2 + Math.sin(rot + layer.hueShift) * r * 0.05;

      const hoverBoost = isActive ? 1.3 : 1;
      const layerHue = hue + layer.hueShift + Math.sin(t * 0.5) * 10;

      const gradient = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      gradient.addColorStop(0, `hsla(${layerHue}, 70%, 60%, ${opacity * layer.alpha * hoverBoost})`);
      gradient.addColorStop(0.5, `hsla(${layerHue + 20}, 60%, 50%, ${opacity * layer.alpha * 0.5 * hoverBoost})`);
      gradient.addColorStop(1, `hsla(${layerHue}, 50%, 40%, 0)`);

      ctx.filter = `blur(${layer.blur}px)`;
      ctx.beginPath();
      ctx.arc(lx, ly, r, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    });

    // Specular highlight
    const specX = cx - baseRadius * 0.15;
    const specY = cy - baseRadius * 0.2;
    const specGrad = ctx.createRadialGradient(specX, specY, 0, specX, specY, baseRadius * 0.3);
    specGrad.addColorStop(0, `rgba(255, 255, 255, ${opacity * 0.15})`);
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.filter = 'blur(10px)';
    ctx.beginPath();
    ctx.arc(specX, specY, baseRadius * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = specGrad;
    ctx.fill();

    ctx.filter = 'none';
    ctx.restore();

    animRef.current = requestAnimationFrame(draw);
  }, [hue, hoverIntensity, rotateOnHover, opacity]);

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
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
        active: true,
      };
    };

    const handleLeave = () => {
      mouseRef.current.active = false;
    };

    const parent = canvas.parentElement;
    parent?.addEventListener('mousemove', handleMouse);
    parent?.addEventListener('mouseleave', handleLeave);

    animRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      parent?.removeEventListener('mousemove', handleMouse);
      parent?.removeEventListener('mouseleave', handleLeave);
      cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
    />
  );
}
