import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2 } from 'lucide-react';

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceNotes({ clips, onAdd, onDelete, accent, text, muted }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const [error, setError] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(0);
  const audioRef = useRef(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          onAdd({ id: `v${Date.now()}`, dataUrl: reader.result, duration: Math.round((Date.now() - startTimeRef.current) / 1000), createdAt: Date.now() });
        };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      startTimeRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000)), 500);
      setRecording(true);
    } catch {
      setError('Microphone access was denied or unavailable.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    clearInterval(timerRef.current);
    setRecording(false);
  }

  function togglePlay(clip) {
    if (playingId === clip.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(clip.dataUrl);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(clip.id);
  }

  return (
    <div style={{ marginTop: 8, flexShrink: 0 }}>
      {clips.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {clips.map((clip) => (
            <div key={clip.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${text}12`, borderRadius: 10, padding: '6px 10px' }}>
              <button onClick={() => togglePlay(clip)} aria-label={playingId === clip.id ? 'Pause' : 'Play'} style={{ background: accent, border: 'none', color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                {playingId === clip.id ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <span style={{ fontSize: 12, color: text, flex: 1 }}>Voice note · {formatDuration(clip.duration)}</span>
              <button onClick={() => onDelete(clip.id)} aria-label="Delete voice note" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', padding: 0 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {recording ? (
          <button onClick={stopRecording} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8735F', border: 'none', color: '#fff', borderRadius: 999, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            <Square size={12} /> Stop · {formatDuration(elapsed)}
          </button>
        ) : (
          <button onClick={startRecording} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${muted}`, color: text, borderRadius: 999, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
            <Mic size={13} /> Record voice note
          </button>
        )}
      </div>
      {error && <p style={{ fontSize: 11, color: '#E8735F', margin: '6px 0 0' }}>{error}</p>}
    </div>
  );
}
