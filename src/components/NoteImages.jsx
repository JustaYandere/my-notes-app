import { useRef } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';

export default function NoteImages({ images, onAdd, onDelete, text, muted }) {
  const fileInputRef = useRef(null);

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
                onClick={() => window.open(img.dataUrl, '_blank')}
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
    </div>
  );
}
