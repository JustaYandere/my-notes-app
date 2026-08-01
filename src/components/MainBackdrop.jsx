import { useMemo, useState, useEffect } from 'react';

function useRandom(count, factory) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => Array.from({ length: count }, factory), [count]);
}

function useViewportWidth() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  useEffect(() => {
    function onResize() { setWidth(window.innerWidth); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return width;
}

// Particle counts below are tuned for one screenful. Without this, a long
// note list stretches the same fixed number of drops/stars over a much
// taller page, so the bottom of the list ends up looking empty.
function usePageHeightRatio() {
  const [ratio, setRatio] = useState(1);
  useEffect(() => {
    function measure() {
      const docHeight = document.documentElement.scrollHeight;
      // Capped — an unbounded particle count on a very long note list makes
      // scrolling janky (too many simultaneously-animated elements).
      setRatio(Math.min(2.5, Math.max(1, docHeight / window.innerHeight)));
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener('resize', measure);
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return ratio;
}

export default function MainBackdrop({ effect, image, particleColor = '#FAFAFA' }) {
  const width = useViewportWidth();
  const heightRatio = usePageHeightRatio();
  const densityScale = (width < 480 ? 0.3 : width < 900 ? 0.55 : 1) * heightRatio;
  const particleRgb = [
    parseInt(particleColor.slice(1, 3), 16),
    parseInt(particleColor.slice(3, 5), 16),
    parseInt(particleColor.slice(5, 7), 16),
  ].join(',');
  const stars = useRandom(effect === 'stars' ? Math.round(450 * densityScale) : 0, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    r: Math.random() * 1.2 + 0.4,
    delay: Math.random() * 6,
    duration: 2.5 + Math.random() * 4,
  }));
  const drops = useRandom(effect === 'rain' ? Math.round(220 * densityScale) : 0, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 3,
    duration: 0.6 + Math.random() * 0.7,
    length: 40 + Math.random() * 50,
    opacity: 0.2 + Math.random() * 0.4,
  }));

  if (!effect || effect === 'color') return null;

  if (effect === 'image') {
    if (!image) return null;
    return <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${image})`, backgroundSize: 'cover', backgroundPosition: 'center', pointerEvents: 'none' }} />;
  }

  if (effect === 'stars') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', contain: 'strict' }}>
        <style>{`@keyframes bg-twinkle { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }`}</style>
        {stars.map((s, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, width: s.r * 2, height: s.r * 2,
              borderRadius: '50%', background: particleColor, animation: `bg-twinkle ${s.duration}s ease-in-out -${s.delay}s infinite`,
              willChange: 'opacity',
            }}
          />
        ))}
      </div>
    );
  }

  if (effect === 'rain') {
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', contain: 'strict' }}>
        <style>{`@keyframes bg-rain { 0% { transform: translateY(-10vh) rotate(12deg); } 100% { transform: translateY(110vh) rotate(12deg); } }`}</style>
        {drops.map((d, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: `${d.left}%`, top: `${d.top}%`, width: 1, height: d.length,
              background: `linear-gradient(to bottom, transparent, rgba(${particleRgb},${d.opacity}))`,
              animation: `bg-rain ${d.duration}s linear -${d.delay}s infinite`,
              willChange: 'transform',
            }}
          />
        ))}
      </div>
    );
  }

  return null;
}
