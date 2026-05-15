import { createContext, useState, useContext, useRef, useCallback, type ReactNode, type MouseEvent } from 'react';

interface CardContextType {
  rotateX: number;
  rotateY: number;
  isHovered: boolean;
}

const CardContext = createContext<CardContextType>({ rotateX: 0, rotateY: 0, isHovered: false });

export function CardContainer({
  children,
  className = '',
  containerClassName = '',
}: {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<CardContextType>({ rotateX: 0, rotateY: 0, isHovered: false });

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    setState({ rotateX: y * -8, rotateY: x * 8, isHovered: true });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setState({ rotateX: 0, rotateY: 0, isHovered: false });
  }, []);

  return (
    <CardContext.Provider value={state}>
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={containerClassName}
        style={{ perspective: '1000px' }}
      >
        <div
          className={className}
          style={{
            transform: `rotateX(${state.rotateX}deg) rotateY(${state.rotateY}deg)`,
            transition: state.isHovered ? 'transform 0.1s ease' : 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
            transformStyle: 'preserve-3d',
          }}
        >
          {children}
        </div>
      </div>
    </CardContext.Provider>
  );
}

export function CardBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {children}
    </div>
  );
}

export function CardItem({
  children,
  className = '',
  translateZ = 0,
  as: Component = 'div',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  translateZ?: number;
  as?: React.ElementType;
  [key: string]: unknown;
}) {
  const { isHovered } = useContext(CardContext);

  return (
    <Component
      className={className}
      style={{
        transform: isHovered ? `translateZ(${translateZ}px)` : 'translateZ(0px)',
        transition: 'transform 0.2s ease',
        transformStyle: 'preserve-3d',
      }}
      {...rest}
    >
      {children}
    </Component>
  );
}
