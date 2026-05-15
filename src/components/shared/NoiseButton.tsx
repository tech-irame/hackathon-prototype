import { type ReactNode, useMemo } from 'react';

interface NoiseButtonProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  gradientColors?: string[];
  onClick?: () => void;
}

export function NoiseButton({
  children,
  className = '',
  containerClassName = '',
  gradientColors = ['rgb(106, 18, 205)', 'rgb(155, 89, 214)', 'rgb(192, 132, 252)'],
  onClick,
}: NoiseButtonProps) {
  const gradientStyle = useMemo(() => {
    const stops = gradientColors.map((c, i) => {
      const pct = (i / (gradientColors.length - 1)) * 100;
      return `${c} ${pct}%`;
    }).join(', ');
    return `linear-gradient(135deg, ${stops})`;
  }, [gradientColors]);

  return (
    <div className={`relative group ${containerClassName}`}>
      {/* Gradient background with noise */}
      <div
        className="absolute inset-0 rounded-xl opacity-100"
        style={{ background: gradientStyle }}
      />
      {/* Noise overlay */}
      <div
        className="absolute inset-0 rounded-xl opacity-[0.15] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: '128px 128px',
        }}
      />
      {/* Shine effect on hover */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
        }}
      />
      <button
        onClick={onClick}
        className={`relative z-10 cursor-pointer ${className}`}
      >
        {children}
      </button>
    </div>
  );
}
