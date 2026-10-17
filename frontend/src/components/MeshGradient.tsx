import { useEffect, useState, useCallback } from 'react';

interface MeshGradientProps {
  className?: string;
  blobs?: number;
}

export function MeshGradient({ className = '', blobs = 4 }: MeshGradientProps) {
  const [positions, setPositions] = useState<{ x: number; y: number }[]>([]);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const initial = Array.from({ length: blobs }, (_, i) => ({
      x: 10 + (i * 80) % 90,
      y: 10 + (i * 130) % 90,
    }));
    setPositions(initial);
  }, [blobs]);

  const handleMove = useCallback((e: MouseEvent) => {
    setMouse({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  return (
    <div
      className={`fixed inset-0 -z-10 overflow-hidden pointer-events-none ${className}`}
      style={{ backgroundColor: '#08070d' }}
    >
      {/* Base haze: large soft purple / indigo / emerald washes */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(1200px 680px at 12% -8%, rgba(139,92,246,0.34), transparent 62%),' +
            'radial-gradient(1000px 640px at 88% 2%, rgba(109,88,246,0.28), transparent 60%),' +
            'radial-gradient(1300px 800px at 82% 108%, rgba(16,185,129,0.20), transparent 62%),' +
            'radial-gradient(950px 660px at 8% 96%, rgba(168,85,247,0.20), transparent 60%),' +
            'radial-gradient(1450px 950px at 50% 55%, rgba(76,42,171,0.18), transparent 65%)',
        }}
      />

      {/* Cursor-following blurry blobs — kept small & dim for readability */}
      {positions.map((pos, i) => {
        const dx = mouse.x / window.innerWidth - pos.x / 100;
        const dy = mouse.y / window.innerHeight - pos.y / 100;
        const shiftX = dx * 8;
        const shiftY = dy * 8;
        const colors = [
          'hsla(258, 80%, 62%, 0.18)',
          'hsla(271, 76%, 60%, 0.14)',
          'hsla(160, 60%, 45%, 0.12)',
          'hsla(243, 68%, 64%, 0.14)',
        ];
        return (
          <div
            key={i}
            className="absolute rounded-full blur-[120px] transition-all duration-500 ease-out pointer-events-none"
            style={{
              left: `${pos.x + shiftX}%`,
              top: `${pos.y + shiftY}%`,
              width: '28%',
              height: '28%',
              backgroundColor: colors[i % colors.length],
              filter: 'blur(90px)',
              opacity: 0.5,
            }}
          />
        );
      })}

      {/* Restrained luminous particles */}
      <div className="absolute inset-0" style={{ opacity: 0.5 }}>
        {Array.from({ length: 28 }, (_, i) => {
          const left = (i * 37 + 13) % 100;
          const top = (i * 53 + 29) % 100;
          const sz = (i % 3) + 1;
          const o = 0.15 + ((i * 7) % 10) / 40;
          return (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={{ left: `${left}%`, top: `${top}%`, width: sz, height: sz, opacity: o, boxShadow: '0 0 6px rgba(165,180,252,0.8)' }}
            />
          );
        })}
      </div>
    </div>
  );
}