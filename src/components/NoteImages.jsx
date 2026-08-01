import { useRef, useState } from 'react';
import { ImagePlus, Trash2, X, Download } from 'lucide-react';

function extFromDataUrl(dataUrl) {
  const match = /^data:image\/(\w+);/.exec(dataUrl);
  return match ? match[1].replace('jpeg', 'jpg') : 'png';
}

function downloadImage(dataUrl, name) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `${name || 'image'}.${extFromDataUrl(dataUrl)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function NoteImages({ images, onAdd, onDelete, onRename, text, muted, compact }) {
  const fileInputRef = useRef(null);
  const [lightboxId, setLightboxId] = useState(null);
  const thumbSize = compact ? 36 : 72;

  function filesToImages(files) {
    [...files].forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        onAdd({ id: `img${Date.now()}${Math.random().toString(36).slice(2, 6)}`, dataUrl: reader.result, name: file.name.replace(/\.[^/.]+$/, '') });
      };
      reader.readAsDataURL(file);
    });
  }

  const lightboxImg = images.find((img) => img.id === lightboxId);

  return (
    <div style={{ marginTop: compact ? 4 : 8, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {images.map((img) => (
        <div key={img.id} style={{ position: 'relative', width: thumbSize, height: thumbSize, flexShrink: 0 }}>
          <img
            src={img.dataUrl}
            alt=""
            onClick={() => setLightboxId(img.id)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: compact ? 6 : 10, cursor: 'zoom-in', display: 'block' }}
          />
          <button onClick={() => onDelete(img.id)} aria-label="Delete image" style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: '50%', background: muted, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <Trash2 size={9} />
          </button>
        </div>
      ))}
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => { filesToImages(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
      <button onClick={() => fileInputRef.current?.click()} aria-label="Add image" title="Add image" style={compact
        ? { width: thumbSize, height: thumbSize, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: `1px dashed ${muted}`, color: muted, borderRadius: 6, cursor: 'pointer', padding: 0 }
        : { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${muted}`, color: text, borderRadius: 999, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
        <ImagePlus size={compact ? 15 : 13} /> {!compact && 'Add image'}
      </button>

      {lightboxImg && (
        <div onClick={() => setLightboxId(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, width: '100%', maxWidth: 400 }}>
            <input
              value={lightboxImg.name || ''}
              onChange={(e) => onRename(lightboxImg.id, e.target.value)}
              placeholder="Image name"
              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, padding: '7px 10px', fontSize: 13, color: '#fff', outline: 'none' }}
            />
            <button onClick={() => downloadImage(lightboxImg.dataUrl, lightboxImg.name)} aria-label="Download image" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: 6 }}>
              <Download size={22} />
            </button>
            <button onClick={() => setLightboxId(null)} aria-label="Close" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: 6 }}>
              <X size={24} />
            </button>
          </div>
          <img src={lightboxImg.dataUrl} alt="" style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
