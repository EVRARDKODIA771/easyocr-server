import express from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import multer from "multer";
import https from "https";
import http from "http";

const app = express();
app.use(express.json());

/* =========================
   PATHS
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* =========================
   JOBS STORAGE
========================= */
const jobs = {}; 
// jobId: { status, logs, error, startedAt, text }

/* =========================
   UTILS
========================= */
function log(msg, jobId = "SYSTEM") {
  const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
  console.log(`[${ts}] [${jobId}] ${msg}`);
}

/* =========================
   CHECK PYTHON & TOOLS
========================= */
function checkPythonTools() {
  spawn("python3", ["--version"]).stdout.on("data", (data) => log(`🐍 ${data.toString().trim()}`));
  spawn("tesseract", ["--version"]).stdout.on("data", (data) => log(`🎯 ${data.toString().split("\n")[0]}`));
}

/* =========================
   MULTER UPLOAD (optionnel si Wix envoie directement un fichier)
========================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `upload_${crypto.randomUUID()}${ext}`);
  },
});
const upload = multer({ storage });

/* =========================
   RUN PYTHON (main_parallel.py)
========================= */
/* =========================
   RUN PYTHON (main_parallel.py) - STREAMING
========================= */
function runPythonParallel(filePath, jobId, callback) {
  log(`🚀 Lancement main_parallel.py -> ${filePath}`, jobId);

  const py = spawn("python3", [path.join(__dirname, "main_parallel.py"), filePath]);

  jobs[jobId].logs = "";
  jobs[jobId].text = "";
  jobs[jobId].status = "processing";

  // Fonction pour traiter chaque ligne et l'afficher immédiatement
  const handleData = (data, source) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach(line => {
      if (line.trim()) {
        log(`🐍 ${source}: ${line}`, jobId);
        // On append le texte filtré dès qu'on le voit
        if (source === "STDOUT") {
          jobs[jobId].text += line + "\n";
          // si callback fourni, on peut l'appeler à chaque ligne
          if (callback) callback(jobs[jobId].text);
        }
      }
    });
  };

  py.stdout.on("data", (data) => handleData(data, "STDOUT"));
  py.stderr.on("data", (data) => handleData(data, "STDERR"));

  py.on("close", (code) => {
    log(`🏁 Python terminé (code=${code})`, jobId);
    jobs[jobId].status = code === 0 ? "done" : "error";
  });

  py.on("error", (err) => {
    log(`❌ ERREUR PYTHON: ${err.message}`, jobId);
    jobs[jobId].status = "error";
    jobs[jobId].error = err.message;
  });
}


/* =========================
   ROUTES
========================= */

// GET /
app.get("/", (_, res) => {
  res.send("OCR Server ready for Wix uploads");
});

// POST /ocr/upload -> pour les fichiers envoyés directement
app.post("/ocr/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

  const filePath = req.file.path;
  const jobId = crypto.randomUUID();

  jobs[jobId] = {
    status: "processing",
    logs: "",
    error: null,
    startedAt: Date.now(),
    text: "",
  };

  log(`🆔 Nouveau job ${jobId} pour ${filePath}`, jobId);

  runPythonParallel(filePath, jobId, (filteredText) => {
    log(`✅ Texte filtré prêt à être envoyé à Wix (${filteredText.length} caractères)`, jobId);
  });

  res.json({ jobId, file: req.file.originalname });
});

// POST /ocr/from-url -> Wix envoie une URL publique
// POST /ocr/from-url -> Wix envoie une URL publique
app.post("/ocr/from-url", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL manquante" });

  try {
    const ext = path.extname(url.split("?")[0]) || ".bin";
    const filePath = path.join(UPLOAD_DIR, `url_${crypto.randomUUID()}${ext}`);

    const proto = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(filePath);

    proto.get(url, (response) => {
      response.pipe(file);

      file.on("finish", () => {
        file.close();

        const jobId = crypto.randomUUID();
        jobs[jobId] = {
          status: "processing",
          logs: "",
          error: null,
          startedAt: Date.now(),
          text: "",
        };

        // 🚀 Lancer le traitement Python
        runPythonParallel(filePath, jobId);

        // 🔹 Réponse initiale immédiate avec le jobId
        res.json({
          status: "processing",
          jobId,
          message: "Le traitement a commencé, récupérez le texte via /ocr/status/:jobId",
        });
      });
    }).on("error", (err) => {
      fs.unlink(filePath, () => {});
      res.status(500).json({ error: err.message });
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /ocr/status/:jobId -> check status
app.get("/ocr/status/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) return res.status(404).json({ status: "unknown" });
  res.json(job);
});

/* =========================
   CLEANUP JOBS
========================= */
setInterval(() => {
  const now = Date.now();
  for (const id in jobs) {
    if (now - jobs[id].startedAt > 15 * 60 * 1000) {
      log(`🧹 Suppression job expiré ${id}`);
      delete jobs[id];
    }
  }
}, 5 * 60 * 1000);

/* =========================
   START SERVER
========================= */
checkPythonTools();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log(`🚀 OCR Server running on port ${PORT}`));
