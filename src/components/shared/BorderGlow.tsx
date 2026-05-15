import { useRef, useState, useCallback, type ReactNode, type MouseEvent, type CSSProperties } from 'react';

interface BorderGlowProps {
  children: ReactNode;
  className?: string;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  colors?: string[];
}

export default function BorderGlow({
  children,
  className = '',
  edgeSensitivity = 30,
  backgroundColor = '#ffffff',
  borderRadius = 16,
  glowRadius = 40,
  glowIntensity = 1,
  coneSpread = 25,
  colors = ['#6a12cd', '#9b59d6', '#c084fc'],
}: BorderGlowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [glowStyle, setGlowStyle] = useState<CSSProperties>({});
  const [isNearEdge, setIsNearEdge] = useState(false);

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;

    // Distance to nearest edge
    const distTop = y;
    const distBottom = h - y;
    const distLeft = x;
    const distRight = w - x;
    const minDist = Math.min(distTop, distBottom, distLeft, distRight);

    const near = minDist < edgeSensitivity;
    setIsNearEdge(near);

    if (!near) {
      setGlowStyle({});
      return;
    }

    // Calculate angle from center for cone direction
    const cx = w / 2;
    const cy = h / 2;
    const angle = Math.atan2(y - cy, x - cx) * (180 / Math.PI);

    // Build multi-color conic gradient at mouse position
    const colorStops = colors.map((color, i) => {
      const offset = (i / (colors.length - 1)) * coneSpread * 2 - coneSpread;
      return `${color} ${angle + offset}deg`;
    }).join(', ');

    const intensity = ((edgeSensitivity - minDist) / edgeSensitivity) * glowIntensity;

    setGlowStyle({
      background: `conic-gradient(from ${angle - coneSpread}deg at ${x}px ${y}px, transparent, ${colorStops}, transparent)`,
      opacity: intensity,
    });
  }, [edgeSensitivity, glowIntensity, coneSpread, colors]);

  const handleMouseLeave = useCallback(() => {
    setIsNearEdge(false);
    setGlowStyle({});
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ borderRadius }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Outer glow layer */}
      <div
        className="absolute -inset-[1.5px] transition-opacity duration-300 pointer-events-none"
        style={{
          borderRadius: borderRadius + 1.5,
          filter: `blur(${glowRadius * 0.3}px)`,
          opacity: 0,
          ...glowStyle,
        }}
      />

      {/* Border glow layer */}
      <div
        className="absolute -inset-[1.5px] transition-opacity duration-200 pointer-events-none"
        style={{
          borderRadius: borderRadius + 1.5,
          opacity: 0,
          ...glowStyle,
        }}
      />

      {/* Inner background (masks the glow to border-only) */}
      <div
        className="absolute inset-[1.5px] pointer-events-none"
        style={{
          borderRadius: borderRadius - 1.5,
          background: backgroundColor,
          zIndex: 1,
        }}
      />

      {/* Subtle ambient glow when near edge */}
      <div
        className="absolute -inset-1 transition-opacity duration-300 pointer-events-none"
        style={{
          borderRadius: borderRadius + 4,
          boxShadow: isNearEdge
            ? `0 0 ${glowRadius}px ${glowRadius * 0.4}px ${colors[0]}20, 0 0 ${glowRadius * 2}px ${glowRadius}px ${colors[1]}10`
            : 'none',
          opacity: isNearEdge ? 1 : 0,
        }}
      />

      {/* Content */}
      <div className="relative z-10" style={{ borderRadius }}>
        {children}
      </div>
    </div>
  );
}
