/**
 * GlowCard — Editorial GRC. Now a thin wrapper around GlassCard
 * to avoid two components producing the same visual.
 *
 * Accepts the old tilt/glow props for API compat but ignores them.
 */
import type { ReactNode } from 'react';
import GlassCard from './GlassCard';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
  innerGradient?: string;
  enableTilt?: boolean;
  tiltIntensity?: number;
  onClick?: () => void;
}

export default function GlowCard({
  children,
  className = '',
  onClick,
}: GlowCardProps) {
  return (
    <GlassCard className={className} onClick={onClick}>
      {children}
    </GlassCard>
  );
}
