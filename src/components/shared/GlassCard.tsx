/**
 * GlassCard — Editorial GRC card component.
 * Flat: white bg, canvas-border, 12px radius. No glass, no shadow, no hover-bounce.
 * Border darkens on hover for interactive cards.
 */

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'light' | 'medium' | 'strong';
  onClick?: () => void;
  hover?: boolean;
}

export default function GlassCard({ children, className = '', intensity = 'medium', onClick, hover = true }: GlassCardProps) {
  const base = intensity === 'strong' ? 'glass-card-strong' : 'glass-card';

  return (
    <div
      onClick={onClick}
      className={`${base} rounded-xl ${onClick ? 'cursor-pointer' : ''} ${hover ? '' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
