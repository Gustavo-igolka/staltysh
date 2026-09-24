// Ленивая загрузка клиента Supabase: пока ключи не заполнены, сеть не трогаем.
import { CONFIG } from '../config.js';

let client = null;
let loading = null;

export const cloudEnabled = () => !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);

export async function getClient() {
  if (!cloudEnabled()) return null;
  if (client) return client;
  if (!loading) {
    loading = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
      .then((m) => {
        client = m.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
          // свой ключ хранилища, чтобы не пересекаться с другими приложениями на том же домене GitHub Pages
          auth: { persistSession: true, autoRefreshToken: true, storageKey: 'shooter-auth' },
        });
        return client;
      })
      .catch((e) => { console.error('[supabase] не удалось загрузить клиент', e); loading = null; return null; });
  }
  return loading;
}
