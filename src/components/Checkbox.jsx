import { Check } from 'lucide-react';

export default function Checkbox({ checked, onToggle, accent, mutedColor }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-label={checked ? 'Mark as not done' : 'Mark as done'}
      style={{ width: 17, height: 17, borderRadius: 5, border: `1.5px solid ${checked ? accent : mutedColor}`, background: checked ? accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0, marginTop: 1 }}
    >
      {checked && <Check size={12} color="#fff" strokeWidth={3} />}
    </button>
  );
}

