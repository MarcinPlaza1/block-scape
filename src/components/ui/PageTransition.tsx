import { ReactNode } from 'react';
import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

type PageTransitionProps = {
  children: ReactNode;
  className?: string;
  /**
   * Animation duration in seconds
   */
  duration?: number;
  /**
   * Vertical slide distance in pixels (ignored for reduced motion)
   */
  y?: number;
  /**
   * If true, disable the initial mount animation
   */
  disableInitial?: boolean;
};

export function PageTransition({ children, className, duration = 0.22, y = 8, disableInitial = false }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  const offsetY = prefersReducedMotion ? 0 : y;

  return (
    <m.div
      className={cn('will-change-transform', className)}
      initial={disableInitial ? false : { opacity: 0, y: offsetY }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -offsetY }}
      transition={{ duration, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </m.div>
  );
}

export default PageTransition;


