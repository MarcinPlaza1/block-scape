import React from 'react';

type ThemeBackgroundProps = {
  className?: string;
};

const ThemeBackground: React.FC<ThemeBackgroundProps> = ({ className }) => {
  // Time-of-day tint variables
  const hour = new Date().getHours();
  const tint = hour < 6 || hour >= 20
    ? { t1: 'var(--brand-news)', t2: 'var(--brand-build)', t3: 'var(--brand-play)' } // night
    : hour < 12
    ? { t1: '40 96% 60%', t2: '217 92% 64%', t3: '158 66% 54%' } // morning warm
    : hour < 18
    ? { t1: '217 92% 64%', t2: '158 66% 54%', t3: '265 86% 72%' } // day vivid
    : { t1: '265 86% 72%', t2: '217 92% 64%', t3: '35 96% 60%' }; // evening

  const styleVars: React.CSSProperties = {
    ['--themescape-t1' as any]: tint.t1,
    ['--themescape-t2' as any]: tint.t2,
    ['--themescape-t3' as any]: tint.t3,
  };

  // Generate a few randomized shooting stars; respect reduced motion
  const reduceMotion = typeof window !== 'undefined' && (window as any)?.__reduceMotion;
  const stars = reduceMotion ? [] : new Array(3).fill(0).map((_, i) => {
    const top = 10 + Math.random() * 50; // 10% - 60%
    const left = -10 - Math.random() * 20; // start offscreen left
    const delay = Math.random() * 8; // 0-8s
    const duration = 4 + Math.random() * 3; // 4-7s
    const style: React.CSSProperties = {
      ['--y' as any]: `${top}%`,
      ['--x' as any]: `${left}%`,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    };
    return <div key={i} className="themescape-shootingstar" style={style} />;
  });

  return (
    <div className={`bg-themescape ${className || ''}`} aria-hidden="true" style={styleVars}>
      <div className="themescape-layer themescape-nebula" />
      <div className="themescape-layer themescape-stars" />
      <div className="themescape-layer themescape-aurora" />
      <div className="themescape-layer themescape-voxelgrid" />
      <div className="themescape-layer themescape-mountains" />
      <div className="themescape-groundgrid" />
      {stars}
    </div>
  );
};

export default ThemeBackground;


