import { saveLocal, loadLocal } from './noteHelpers.jsx';
import { putAttachments, deleteAttachments, getAllAttachments, pruneOrphanAttachments } from './attachmentDb';
import { NOTES_KEY, SETTINGS_KEY } from '../constants';

const BG_IMAGE_KEY = 'setting:mainBgImage';
const AMBIENT_SOUND_KEY = 'setting:ambientSoundData';

function splitNoteAttachments(notes) {
  const attachments = [];
  const validKeys = new Set();
  const light = notes.map((n) => {
    if ((!n.images || n.images.length === 0) && (!n.voiceNotes || n.voiceNotes.length === 0)) return n;
    const images = (n.images || []).map((im) => {
      const key = `img:${im.id}`;
      validKeys.add(key);
      // eslint-disable-next-line no-unused-vars
      if (im.dataUrl) { attachments.push([key, im.dataUrl]); const { dataUrl, ...rest } = im; return rest; }
      return im;
    });
    const voiceNotes = (n.voiceNotes || []).map((v) => {
      const key = `voice:${v.id}`;
      validKeys.add(key);
      // eslint-disable-next-line no-unused-vars
      if (v.dataUrl) { attachments.push([key, v.dataUrl]); const { dataUrl, ...rest } = v; return rest; }
      return v;
    });
    return { ...n, images, voiceNotes };
  });
  return { light, attachments, validKeys };
}

// Writes the "light" (metadata-only) notes array to localStorage synchronously,
// and fires off the actual image/voice-note bytes to IndexedDB in the
// background. The localStorage write is what App.jsx's save-failure banner
// reflects; since it no longer carries any attachment data, it should stay
// well under quota regardless of how many photos/recordings exist.
export function saveNotesLocal(notes) {
  const { light, attachments, validKeys } = splitNoteAttachments(notes);
  const ok = saveLocal(NOTES_KEY, light);
  if (attachments.length) putAttachments(attachments);
  pruneOrphanAttachments(validKeys);
  return ok;
}

function mergeNoteAttachments(notes, attachmentMap) {
  if (attachmentMap.size === 0) return notes;
  return notes.map((n) => {
    const hasImages = (n.images || []).length > 0;
    const hasVoice = (n.voiceNotes || []).length > 0;
    if (!hasImages && !hasVoice) return n;
    return {
      ...n,
      images: (n.images || []).map((im) => (im.dataUrl ? im : { ...im, dataUrl: attachmentMap.get(`img:${im.id}`) })),
      voiceNotes: (n.voiceNotes || []).map((v) => (v.dataUrl ? v : { ...v, dataUrl: attachmentMap.get(`voice:${v.id}`) })),
    };
  });
}

export function loadNotesLocal() {
  return loadLocal(NOTES_KEY);
}

// Reads every stored attachment (notes' images/voice notes, plus the
// background image / ambient sound) in one pass and merges them back in.
// Called once after the initial synchronous (metadata-only) hydration.
export async function hydrateAttachments(notes) {
  const map = await getAllAttachments();
  return {
    notes: mergeNoteAttachments(notes, map),
    mainBgImage: map.get(BG_IMAGE_KEY),
    ambientSoundData: map.get(AMBIENT_SOUND_KEY),
  };
}

export function saveSettingsLocal(settings) {
  const { mainBgImage, ambientSoundData, ...rest } = settings;
  const ok = saveLocal(SETTINGS_KEY, rest);
  const attachments = [];
  const toDelete = [];
  if (mainBgImage) attachments.push([BG_IMAGE_KEY, mainBgImage]); else toDelete.push(BG_IMAGE_KEY);
  if (ambientSoundData) attachments.push([AMBIENT_SOUND_KEY, ambientSoundData]); else toDelete.push(AMBIENT_SOUND_KEY);
  if (attachments.length) putAttachments(attachments);
  if (toDelete.length) deleteAttachments(toDelete);
  return ok;
}
