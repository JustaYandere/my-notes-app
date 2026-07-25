import { useRef, useEffect } from 'react';
import { hslToRgb } from '../utils/colorMath';

export default function ColorWheel({ size = 160, hue, sat, onChange }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const r = size / 2;
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - r + 0.5, dy = y - r + 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const idx = (y * size + x) * 4;
        if (dist <= r) {
          let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
          if (angle < 0) angle += 360;
          const saturation = Math.min(dist / r, 1);
          const [rr, gg, bb] = hslToRgb(angle, saturation, 0.5);
          img.data[idx] = rr; img.data[idx + 1] = gg; img.data[idx + 2] = bb; img.data[idx + 3] = 255;
        } else { img.data[idx + 3] = 0; }
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [size]);

  function pick(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left, y = clientY - rect.top;
    const r = size / 2;
    const dx = x - r, dy = y - r;
    const dist = Math.min(Math.sqrt(dx * dx + dy * dy), r);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    onChange(angle, dist / r);
  }

  const rad = (hue * Math.PI) / 180;
  const handleR = sat * (size / 2);
  const hx = size / 2 + handleR * Math.cos(rad);
  const hy = size / 2 + handleR * Math.sin(rad);

  return (
    <div
      style={{ position: 'relative', width: size, height: size, touchAction: 'none', cursor: 'crosshair' }}
      onMouseDown={(e) => {
        pick(e);
        const move = (ev) => pick(ev);
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      }}
      onTouchStart={pick}
      onTouchMove={pick}
    >
      <canvas ref={canvasRef} width={size} height={size} style={{ borderRadius: '50%', display: 'block' }} />
      <div style={{ position: 'absolute', left: hx - 7, top: hy - 7, width: 14, height: 14, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.45)', pointerEvents: 'none' }} />
    </div>
  );
}

