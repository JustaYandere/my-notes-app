import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Square, Play, Pause, Trash2 } from 'lucide-react';

function formatDuration(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const VoiceNotes = forwardRef(function VoiceNotes({ clips, onAdd, onDelete, onRename, accent, text, muted, compact }, ref) {
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

  useImperativeHandle(ref, () => ({
    toggleRecording: () => (recording ? stopRecording() : startRecording()),
    recording,
  }), [recording, startRecording, stopRecording]);

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
    <div style={{ flexShrink: 0 }}>
      {clips.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 6 }}>
          {clips.map((clip) => (
            <div key={clip.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: `${text}12`, borderRadius: 10, padding: compact ? '4px 8px' : '6px 10px' }}>
              <button onClick={() => togglePlay(clip)} aria-label={playingId === clip.id ? 'Pause' : 'Play'} style={{ background: accent, border: 'none', color: '#fff', borderRadius: '50%', width: compact ? 22 : 26, height: compact ? 22 : 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                {playingId === clip.id ? <Pause size={compact ? 11 : 13} /> : <Play size={compact ? 11 : 13} />}
              </button>
              <input
                value={clip.name || ''}
                onChange={(e) => onRename(clip.id, e.target.value)}
                placeholder="Voice note"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: text, padding: 0 }}
              />
              <span style={{ fontSize: 11, color: muted, flexShrink: 0 }}>{formatDuration(clip.duration)}</span>
              <button onClick={() => onDelete(clip.id)} aria-label="Delete voice note" style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', display: 'flex', padding: 0, flexShrink: 0 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      {recording && (
        <button onClick={stopRecording} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#E8735F', border: 'none', color: '#fff', borderRadius: 999, padding: '6px 12px', fontSize: 12, cursor: 'pointer', marginBottom: 6 }}>
          <Square size={12} /> Stop · {formatDuration(elapsed)}
        </button>
      )}
      {error && <p style={{ fontSize: 11, color: '#E8735F', margin: '0 0 6px' }}>{error}</p>}
    </div>
  );
});

export default VoiceNotes;
