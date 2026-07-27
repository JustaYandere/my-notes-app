import { useEffect, useRef } from 'react';
import { supabase, supabaseEnabled } from '../lib/supabaseClient';

const SYNCED_KEYS = [
  'customColors', 'customThemes', 'activeThemeId', 'modalTint',
  'separatorColorId', 'mainBgEffect', 'mainBgImage', 'fontChoice',
];

// Syncs appearance settings (colors, themes, backgrounds, font) across devices while signed in.
// Uses a value-snapshot comparison (not a timing flag) to avoid push/pull feedback loops.
export function useSettingsSync({ values, setters, syncUser, enabled }) {
  const lastSnapshotRef = useRef(null);
  const pushTimerRef = useRef(null);
  const syncUserRef = useRef(syncUser);
  useEffect(() => { syncUserRef.current = enabled ? syncUser : null; }, [syncUser, enabled]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser || !enabled) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', syncUser.id).maybeSingle();
      if (cancelled || error || !data?.settings) return;
      SYNCED_KEYS.forEach((key) => {
        if (key in data.settings && setters[key]) setters[key](data.settings[key]);
      });
      lastSnapshotRef.current = JSON.stringify(data.settings);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUser, enabled]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser || !enabled) return;
    const payload = {};
    SYNCED_KEYS.forEach((key) => { payload[key] = values[key]; });
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSnapshotRef.current) return;
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      if (!syncUserRef.current) return;
      const { error } = await supabase.from('user_settings').upsert({ user_id: syncUser.id, settings: payload });
      if (!error) lastSnapshotRef.current = snapshot;
    }, 800);
    return () => clearTimeout(pushTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...SYNCED_KEYS.map((k) => values[k]), syncUser, enabled]);

  useEffect(() => {
    if (!supabaseEnabled || !syncUser || !enabled) return;
    const channel = supabase
      .channel(`settings-${syncUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_settings', filter: `user_id=eq.${syncUser.id}` }, (payload) => {
        const row = payload.new;
        if (!row?.settings) return;
        const snapshot = JSON.stringify(row.settings);
        if (snapshot === lastSnapshotRef.current) return;
        SYNCED_KEYS.forEach((key) => {
          if (key in row.settings && setters[key]) setters[key](row.settings[key]);
        });
        lastSnapshotRef.current = snapshot;
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUser]);
}
