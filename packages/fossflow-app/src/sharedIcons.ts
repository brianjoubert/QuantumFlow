// Shared, server-persisted custom icon library.
//
// Any icon a user imports is POSTed to the backend (`/api/icons`) and loaded
// back here at startup, so it shows up in *everyone's* palette on this server
// — not just inside the diagram it was first added to.
//
// Icons are stored as base64 data URLs, so they also remain embedded in each
// diagram's JSON. That keeps diagrams portable: open one on another server and
// its custom icons still render, even if that server's shared library differs.
//
// If the backend is unreachable or server storage is disabled, every function
// here fails soft and the app simply falls back to the built-in icon packs.

// Match the API base-URL convention used by storageService.ts:
// relative paths in production (served through the nginx proxy), and the
// backend's dev port when running the CRA/RSBuild dev server on :3000.
const isDevelopment =
  window.location.hostname === 'localhost' && window.location.port === '3000';
const API_BASE = isDevelopment ? 'http://localhost:3001' : '';

export interface SharedIcon {
  id: string;
  name: string;
  url: string;
  collection: string;
  isIsometric?: boolean;
}

// In-memory cache, populated by loadSharedIcons() before the app first renders.
let sharedIcons: SharedIcon[] = [];

/** Deduplicate an icon list by id, keeping the last occurrence for each id. */
export function dedupeIconsById<T extends { id?: string }>(list: T[]): T[] {
  const byId = new Map<string, T>();
  for (const icon of list) {
    if (icon && icon.id != null) byId.set(icon.id, icon);
  }
  return Array.from(byId.values());
}

/** Synchronously read the icons already loaded from the server this session. */
export function getSharedIcons(): SharedIcon[] {
  return sharedIcons;
}

/** Fetch the shared icon library from the backend. Safe to call once at boot. */
export async function loadSharedIcons(): Promise<SharedIcon[]> {
  try {
    // Guard against a hung request so the app never blocks on a dead backend.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_BASE}/api/icons`, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) return sharedIcons;
    const data = await res.json();
    if (Array.isArray(data)) {
      // Treat every shared icon as an "imported" icon so the rest of the app's
      // existing logic embeds it per-diagram on save (portability preserved).
      sharedIcons = data.map((icon: SharedIcon) => ({ ...icon, collection: 'imported' }));
    }
    return sharedIcons;
  } catch (error) {
    console.log('Shared icons not available:', error);
    return sharedIcons;
  }
}

/**
 * Persist newly-imported icons to the shared library so other users get them.
 * Fire-and-forget: failures are logged, never thrown, so importing an icon
 * still works locally even if the server is down.
 */
export async function saveSharedIcons(icons: SharedIcon[]): Promise<void> {
  if (!icons || icons.length === 0) return;
  try {
    await fetch(`${API_BASE}/api/icons`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icons })
    });
    // Update the local cache so they're treated as already-shared this session.
    const byId = new Map(sharedIcons.map((i) => [i.id, i]));
    icons.forEach((i) => byId.set(i.id, { ...i, collection: 'imported' }));
    sharedIcons = Array.from(byId.values());
  } catch (error) {
    console.log('Failed to save shared icons:', error);
  }
}
