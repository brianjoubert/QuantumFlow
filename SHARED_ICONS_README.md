# FossFLOW — Shared Server-Side Icon Library

This fork adds a **shared custom-icon library**. When any user imports an icon,
it is saved on the server and appears in **everyone's** palette (in new diagrams
too), while still being embedded in each diagram's JSON so diagrams stay
portable to other servers.

## What changed

| File | Change |
|------|--------|
| `packages/fossflow-backend/server.js` | New `GET/POST/DELETE /api/icons` endpoints; icons persisted to `icons.json` on the storage volume (with a write lock); `icons.json` excluded from the diagram list. |
| `packages/fossflow-app/src/sharedIcons.ts` | **New file.** Client helper: load / save / dedupe shared icons via `/api/icons`. |
| `packages/fossflow-app/src/index.tsx` | Loads the shared icon library before the first render. |
| `packages/fossflow-app/src/App.tsx` | Merges shared icons into the palette everywhere; POSTs newly-imported icons to the server. |
| `compose.yaml` | **New file.** Builds the image from source (needed for these changes) — ready for Dockge. |

No changes to `packages/fossflow-lib` — the library is untouched.

## How it works

1. On startup the app fetches `GET /api/icons` and merges the result into the
   built-in icon packs, so shared icons show up in every diagram's palette.
2. When a user imports an icon (the existing "Import Icons" button), the app
   detects the new icon in the model and `POST`s it to `/api/icons`. The backend
   stores it in `icons.json` on the mounted volume, de-duplicated by id.
3. Icons are stored as **base64 data URLs**, so they're also embedded in each
   saved/exported diagram. Open a diagram on a different server and its icons
   still render.

Because the shared library is just the union of every custom icon the workspace
has seen, **loading a diagram that contains custom icons also adds those icons to
the shared library.** That's usually what you want ("any icon in the set is saved
for everyone"); if you don't, delete unwanted icons via
`DELETE /api/icons/<id>` (see below).

## Run it with Dockge

1. Copy this whole repository into your Dockge stacks directory, e.g.
   `/opt/stacks/fossflow/` (the `compose.yaml` is at the repo root already).
2. In Dockge, open the **fossflow** stack → **Deploy**. Dockge runs
   `docker compose up -d --build`; the first build takes a few minutes because
   it compiles the app from source.
3. Open `http://<your-server>:8080` (change the host port in `compose.yaml` if
   8080 is in use).

Your diagrams and the shared icon library live in `./diagrams/` next to the
compose file (icons in `./diagrams/icons.json`). Back up that folder to keep
everything.

### Plain Docker Compose (without Dockge)

```bash
docker compose up -d --build
```

## Managing the shared library manually

```bash
# List shared icons
curl http://localhost:8080/api/icons

# Remove one icon from the shared set (find its id in the JSON above)
curl -X DELETE http://localhost:8080/api/icons/<icon-id>
```

You can also edit `./diagrams/icons.json` directly and restart the container.

## Notes / limits

- This adds a **shared palette**, not real-time collaboration. FossFLOW still has
  no accounts or locking, so two people editing the *same diagram* can overwrite
  each other. Sharing the icon palette is additive and safe.
- Uploaded icons are scaled to 128px PNG (or kept as SVG) and stored base64, so
  each adds a few KB to `icons.json` and to any diagram that uses it.
- If `ENABLE_SERVER_STORAGE=false`, shared icons are disabled and the app falls
  back to the built-in packs only.
