import express from 'express';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3001;
const ARCHIFY_BIN = path.resolve('/app/archify/bin/archify.mjs');
const TMP_BASE = '/tmp/archify-render';

// Request-Limits (Archify JSON Specs sind typischerweise 5-500 KB)
app.use(express.json({ limit: '10mb' }));

const ALLOWED_TYPES = new Set(['architecture', 'dataflow', 'sequence']);

// Helper: Führt Child-Process mit Parametern deterministisch aus
function runArchify(args, timeoutMs = 25000) {
  return new Promise((resolve) => {
    const proc = spawn('node', [ARCHIFY_BIN, ...args], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        code: -1,
        stdout,
        stderr: stderr + '\nProcess timed out after ' + timeoutMs + 'ms'
      });
    }, timeoutMs);

    proc.stdout.on('data', (data) => { stdout += data.toString(); });
    proc.stderr.on('data', (data) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: err.message });
    });
  });
}

// Healthcheck
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'archify-sidecar',
    supportedTypes: Array.from(ALLOWED_TYPES),
    timestamp: new Date().toISOString()
  });
});

// Render-Endpunkt
app.post('/api/render', async (req, res) => {
  const { type, spec, quality = 'showcase' } = req.body || {};

  if (!type || !ALLOWED_TYPES.has(type)) {
    return res.status(400).json({
      success: false,
      error: `Ungültiger oder fehlender Diagrammtyp. Erlaubt sind: ${Array.from(ALLOWED_TYPES).join(', ')}`
    });
  }

  if (!spec || typeof spec !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Fehlendes oder ungültiges "spec" JSON-Objekt im Request Body.'
    });
  }

  const reqId = crypto.randomUUID();
  const reqDir = path.join(TMP_BASE, reqId);
  const specPath = path.join(reqDir, `candidate.${type}.json`);
  const outputPath = path.join(reqDir, `output.html`);

  try {
    await fs.mkdir(reqDir, { recursive: true });
    await fs.writeFile(specPath, JSON.stringify(spec, null, 2), 'utf8');

    // 1. Validate Phase
    const validateRes = await runArchify([
      'validate',
      type,
      specPath,
      '--quality',
      quality,
      '--json'
    ]);

    let validateJson = null;
    try {
      validateJson = JSON.parse(validateRes.stdout);
    } catch (_) {
      // Falls JSON-Parse scheitert
    }

    if (!validateJson || !validateJson.ok) {
      const diagnostics = validateJson?.diagnostics || [
        {
          code: 'validate/failed',
          message: validateRes.stderr || validateRes.stdout || 'Archify Validation fehlgeschlagen.'
        }
      ];
      return res.status(422).json({
        success: false,
        stage: 'validate',
        diagnostics,
        rawOutput: validateRes.stdout
      });
    }

    // 2. Deliver Phase (Headless Generierung)
    const deliverRes = await runArchify([
      'deliver',
      type,
      specPath,
      outputPath,
      '--quality',
      quality,
      '--json'
    ]);

    let deliverJson = null;
    try {
      deliverJson = JSON.parse(deliverRes.stdout);
    } catch (_) {}

    if (deliverRes.code !== 0 || !deliverJson || !deliverJson.ok) {
      return res.status(500).json({
        success: false,
        stage: 'deliver',
        error: deliverRes.stderr || 'Archify Deliver fehlgeschlagen.',
        diagnostics: deliverJson?.diagnostics || []
      });
    }

    // 3. HTML auslesen
    const htmlContent = await fs.readFile(outputPath, 'utf8');

    return res.json({
      success: true,
      type,
      quality,
      receiptId: deliverJson.receiptId || null,
      html: htmlContent
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      error: `Interner Verarbeitungsfehler im Sidecar: ${err.message}`
    });
  } finally {
    // Sicheres Aufräumen der temporären Dateien
    try {
      await fs.rm(reqDir, { recursive: true, force: true });
    } catch (_) {}
  }
});

// Initialisiere Temp-Verzeichnis und starte Server
fs.mkdir(TMP_BASE, { recursive: true }).then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[archify-sidecar] HTTP Server lauscht auf Port ${PORT}`);
  });
});
