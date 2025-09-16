import { memo } from 'react';

type DemoAsideProps = {
  showDemo: boolean;
  loadPreview: boolean;
  onClose: () => void;
  onPlayDemo: () => void;
  MiniPreview: React.LazyExoticComponent<(props: { className?: string; blocks: any[] }) => JSX.Element>;
  demoBlocks: any[];
};

const DemoAside = memo(({ showDemo }: DemoAsideProps) => {
  if (!showDemo) return null;
  return null;
});

export default DemoAside;


