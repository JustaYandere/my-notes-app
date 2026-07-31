import { useRef, useState } from 'react';
import { ImagePlus, Trash2, X, Download } from 'lucide-react';

function extFromDataUrl(dataUrl) {
  const match = /^data:image\/(\w+);/.exec(dataUrl);
  return match ? match[1].replace('jpeg', 'jpg') : 'png';
}

function downloadImage(dataUrl) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `image-${Date.now()}.${extFromDataUrl(dataUrl)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export default function NoteImages({ images, onAdd, onDelete, text, muted }) {
  const fileInputRef = useRef(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  function filesToImages(files) {
    [...files].forEach((file) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        onAdd({ id: `img${Date.now()}${Math.random().toString(36).slice(2, 6)}`, dataUrl: reader.result });
      };
      reader.readAsDataURL(file);
    });
  }

  return (
    <div style={{ marginTop: 8, flexShrink: 0 }}>
      {images.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {images.map((img) => (
            <div key={img.id} style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
              <img
                src={img.dataUrl}
                alt=""
                onClick={() => setLightboxSrc(img.dataUrl)}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, cursor: 'zoom-in', display: 'block' }}
              />
              <button onClick={() => onDelete(img.id)} aria-label="Delete image" style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: muted, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={(e) => { filesToImages(e.target.files); e.target.value = ''; }} style={{ display: 'none' }} />
      <button onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: `1px solid ${muted}`, color: text, borderRadius: 999, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
        <ImagePlus size={13} /> Add image
      </button>

      {lightboxSrc && (
        <div onClick={() => setLightboxSrc(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 24 }}>
          <div style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
            <button onClick={(e) => { e.stopPropagation(); downloadImage(lightboxSrc); }} aria-label="Download image" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: 6 }}>
              <Download size={22} />
            </button>
            <button onClick={() => setLightboxSrc(null)} aria-label="Close" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', padding: 6 }}>
              <X size={24} />
            </button>
          </div>
          <img src={lightboxSrc} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
