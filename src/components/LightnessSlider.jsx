import { useRef } from 'react';
import { hslToRgb, rgbToHex } from '../utils/colorMath';

export default function LightnessSlider({ hue, sat, value, onChange, height = 26 }) {
  const trackRef = useRef(null);
  const fullColor = rgbToHex(...hslToRgb(hue, sat, 0.5));
  const thumbColor = rgbToHex(...hslToRgb(hue, sat, value));
  function pick(e) {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    onChange(rect.width === 0 ? 0 : x / rect.width);
  }
  return (
    <div
      ref={trackRef}
      style={{ position: 'relative', width: '100%', height, borderRadius: height / 2, background: `linear-gradient(to right, #000, ${fullColor}, #fff)`, cursor: 'pointer', touchAction: 'none' }}
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
      <div style={{ position: 'absolute', left: `calc(${value * 100}% - ${height / 2}px)`, top: '50%', transform: 'translateY(-50%)', width: height, height, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.45)', background: thumbColor, pointerEvents: 'none' }} />
    </div>
  );
}

