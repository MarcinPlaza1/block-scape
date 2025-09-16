import { m, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

type LoadingOverlayProps = {
  message?: string;
  className?: string;
};

export function LoadingOverlay({ message = 'Loading...', className }: LoadingOverlayProps) {
  const prefersReducedMotion = useReducedMotion();
  const spinner = (
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
  );

  return (
    <m.div
      className={cn(
        'absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-20',
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="flex items-center space-x-3">
        {prefersReducedMotion ? spinner : (
          <m.div
            className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
          />
        )}
        <div className="text-foreground font-medium">{message}</div>
      </div>
    </m.div>
  );
}

export default LoadingOverlay;


