import { useRef, useEffect, useState } from 'react';
import { Volume2 } from 'lucide-react';

export default function AmbientAudio({ enabled, dataUrl, volume }) {
  const audioRef = useRef(null);
  const [needsGesture, setNeedsGesture] = useState(false);

  useEffect(() => {
    if (!enabled || !dataUrl || !audioRef.current) return;
    audioRef.current.volume = volume;
    const playPromise = audioRef.current.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
    }
  }, [enabled, dataUrl, volume]);

  useEffect(() => {
    if (!enabled && audioRef.current) audioRef.current.pause();
  }, [enabled]);

  if (!enabled || !dataUrl) return null;

  return (
    <>
      <audio ref={audioRef} src={dataUrl} loop />
      {needsGesture && (
        <button
          onClick={() => { audioRef.current?.play(); setNeedsGesture(false); }}
          aria-label="Start ambient sound"
          title="Start ambient sound"
          style={{
            position: 'fixed', bottom: 28, left: 28, zIndex: 10, display: 'flex', alignItems: 'center', gap: 6,
            background: '#0A0A0A', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 14px', fontSize: 13,
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
          }}
        >
          <Volume2 size={14} /> Tap to play ambient sound
        </button>
      )}
    </>
  );
}
