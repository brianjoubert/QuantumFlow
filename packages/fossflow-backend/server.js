import express from 'express';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Configuration from environment variables
const STORAGE_ENABLED = process.env.ENABLE_SERVER_STORAGE === 'true';
const STORAGE_PATH = process.env.STORAGE_PATH || '/data/diagrams';
const ENABLE_GIT_BACKUP = process.env.ENABLE_GIT_BACKUP === 'true';

// Shared custom-icon library. Icons uploaded by any user are persisted here so
// they appear in everyone's palette. Stored alongside the diagrams on the same
// volume, so they survive restarts. Kept as base64 data URLs, which means they
// also stay embedded in each diagram's JSON (portable across servers).
const ICONS_FILE = path.join(STORAGE_PATH, 'icons.json');

// Serialize writes to icons.json so concurrent uploads can't clobber each other.
let iconWriteChain = Promise.resolve();
function withIconLock(task) {
  const run = iconWriteChain.then(task, task);
  // Keep the chain alive even if a task throws.
  iconWriteChain = run.catch(() => {});
  return run;
}

async function readSharedIcons() {
  try {
    const content = await fs.readFile(ICONS_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return []; // No icons saved yet.
    console.error('Error reading shared icons:', error);
    return [];
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check / Storage status endpoint
app.get('/api/storage/status', (req, res) => {
  res.json({
    enabled: STORAGE_ENABLED,
    gitBackup: ENABLE_GIT_BACKUP,
    version: '1.0.0'
  });
});

// Only enable storage endpoints if storage is enabled
if (STORAGE_ENABLED) {
  // Ensure storage directory exists
  async function ensureStorageDir() {
    try {
      await fs.access(STORAGE_PATH);
    } catch {
      await fs.mkdir(STORAGE_PATH, { recursive: true });
      console.log(`Created storage directory: ${STORAGE_PATH}`);
    }
  }

  // Initialize storage
  ensureStorageDir().catch(console.error);

  // List all diagrams
  app.get('/api/diagrams', async (req, res) => {
    try {
      const files = await fs.readdir(STORAGE_PATH);
      const diagrams = [];
      
      for (const file of files) {
        if (file.endsWith('.json') && file !== 'metadata.json' && file !== 'icons.json') {
          const filePath = path.join(STORAGE_PATH, file);
          const stats = await fs.stat(filePath);
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          
          diagrams.push({
            id: file.replace('.json', ''),
            name: data.name || 'Untitled Diagram',
            lastModified: stats.mtime,
            size: stats.size
          });
        }
      }
      
      res.json(diagrams);
    } catch (error) {
      console.error('Error listing diagrams:', error);
      res.status(500).json({ error: 'Failed to list diagrams' });
    }
  });

  // Get specific diagram
  app.get('/api/diagrams/:id', async (req, res) => {
    try {
      const filePath = path.join(STORAGE_PATH, `${req.params.id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      res.json(JSON.parse(content));
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Diagram not found' });
      } else {
        console.error('Error reading diagram:', error);
        res.status(500).json({ error: 'Failed to read diagram' });
      }
    }
  });

  // Save or update diagram
  app.put('/api/diagrams/:id', async (req, res) => {
    try {
      const filePath = path.join(STORAGE_PATH, `${req.params.id}.json`);
      const data = {
        ...req.body,
        id: req.params.id,
        lastModified: new Date().toISOString()
      };
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      
      // Git backup if enabled
      if (ENABLE_GIT_BACKUP) {
        // TODO: Implement git commit
        console.log('Git backup not yet implemented');
      }
      
      res.json({ success: true, id: req.params.id });
    } catch (error) {
      console.error('Error saving diagram:', error);
      res.status(500).json({ error: 'Failed to save diagram' });
    }
  });

  // Delete diagram
  app.delete('/api/diagrams/:id', async (req, res) => {
    try {
      const filePath = path.join(STORAGE_PATH, `${req.params.id}.json`);
      await fs.unlink(filePath);
      
      res.json({ success: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Diagram not found' });
      } else {
        console.error('Error deleting diagram:', error);
        res.status(500).json({ error: 'Failed to delete diagram' });
      }
    }
  });

  // Create a new diagram
  app.post('/api/diagrams', async (req, res) => {
    try {
      const id = req.body.id || `diagram_${Date.now()}`;
      const filePath = path.join(STORAGE_PATH, `${id}.json`);
      
      // Check if already exists
      try {
        await fs.access(filePath);
        return res.status(409).json({ error: 'Diagram already exists' });
      } catch {
        // File doesn't exist, proceed
      }
      
      const data = {
        ...req.body,
        id,
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
      };
      
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      res.status(201).json({ success: true, id });
    } catch (error) {
      console.error('Error creating diagram:', error);
      res.status(500).json({ error: 'Failed to create diagram' });
    }
  });

  // ---- Shared custom-icon library ----

  // List all shared icons (returned to every client on startup)
  app.get('/api/icons', async (req, res) => {
    try {
      const icons = await readSharedIcons();
      res.json(icons);
    } catch (error) {
      console.error('Error listing icons:', error);
      res.status(500).json({ error: 'Failed to list icons' });
    }
  });

  // Add one or more icons to the shared library (deduplicated by id).
  // Accepts either { icons: [...] } or a bare array in the body.
  app.post('/api/icons', async (req, res) => {
    const incoming = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.icons)
        ? req.body.icons
        : null;

    if (!incoming) {
      return res.status(400).json({ error: 'Expected { icons: [...] } or an array of icons' });
    }

    try {
      const saved = await withIconLock(async () => {
        const existing = await readSharedIcons();
        const byId = new Map(existing.map((icon) => [icon.id, icon]));

        for (const icon of incoming) {
          if (!icon || !icon.id || !icon.url) continue; // Skip malformed entries.
          byId.set(icon.id, {
            id: icon.id,
            name: icon.name || icon.id,
            url: icon.url,
            collection: 'imported',
            isIsometric: icon.isIsometric !== false
          });
        }

        const merged = Array.from(byId.values());
        await fs.writeFile(ICONS_FILE, JSON.stringify(merged, null, 2));
        return merged;
      });

      res.json({ success: true, count: saved.length });
    } catch (error) {
      console.error('Error saving icons:', error);
      res.status(500).json({ error: 'Failed to save icons' });
    }
  });

  // Remove a single icon from the shared library by id.
  app.delete('/api/icons/:id', async (req, res) => {
    try {
      const result = await withIconLock(async () => {
        const existing = await readSharedIcons();
        const filtered = existing.filter((icon) => icon.id !== req.params.id);
        await fs.writeFile(ICONS_FILE, JSON.stringify(filtered, null, 2));
        return { removed: existing.length - filtered.length, count: filtered.length };
      });
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error deleting icon:', error);
      res.status(500).json({ error: 'Failed to delete icon' });
    }
  });

} else {
  // Storage disabled - return appropriate responses
  app.get('/api/diagrams', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });
  
  app.get('/api/diagrams/:id', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });
  
  app.put('/api/diagrams/:id', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });
  
  app.delete('/api/diagrams/:id', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });
  
  app.post('/api/diagrams', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });

  // Shared icons unavailable without server storage — return an empty set so
  // the client falls back cleanly to the built-in icon packs.
  app.get('/api/icons', (req, res) => {
    res.json([]);
  });

  app.post('/api/icons', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });

  app.delete('/api/icons/:id', (req, res) => {
    res.status(503).json({ error: 'Server storage is disabled' });
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`FossFLOW Backend Server running on port ${PORT}`);
  console.log(`Server storage: ${STORAGE_ENABLED ? 'ENABLED' : 'DISABLED'}`);
  if (STORAGE_ENABLED) {
    console.log(`Storage path: ${STORAGE_PATH}`);
    console.log(`Git backup: ${ENABLE_GIT_BACKUP ? 'ENABLED' : 'DISABLED'}`);
  }
});