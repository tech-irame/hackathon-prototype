import { motion } from 'motion/react';
import { type CSSProperties, type ElementType, type JSX, memo, useMemo } from 'react';

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = 'p',
  className = '',
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const MotionComponent = motion.create(Component as keyof JSX.IntrinsicElements);

  const dynamicSpread = useMemo(() => (children?.length ?? 0) * spread, [children, spread]);

  return (
    <MotionComponent
      animate={{ backgroundPosition: '0% center' }}
      className={`relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent [background-repeat:no-repeat,padding-box] ${className}`}
      initial={{ backgroundPosition: '100% center' }}
      style={
        {
          '--spread': `${dynamicSpread}px`,
          backgroundImage:
            `linear-gradient(90deg, #0000 calc(50% - ${dynamicSpread}px), #fff, #0000 calc(50% + ${dynamicSpread}px)), linear-gradient(#6a12cd, #9b59d6)`,
        } as CSSProperties
      }
      transition={{
        repeat: Infinity,
        duration,
        ease: 'linear',
      }}
    >
      {children}
    </MotionComponent>
  );
};

export const TextShimmer = memo(ShimmerComponent);
