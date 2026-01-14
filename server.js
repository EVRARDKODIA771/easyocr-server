import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import multer from "multer";

const app = express();
app.use(express.json());

/* =========================
   PATHS
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/usr/src/app/uploads";
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
   MULTER UPLOAD
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
function runPythonParallel(filePath, jobId, callback) {
  log(`🚀 Lancement main_parallel.py -> ${filePath}`, jobId);

  const py = spawn("python3", [path.join(__dirname, "main_parallel.py"), filePath]);

  jobs[jobId].logs = "";
  let fullText = "";

  py.stdout.on("data", (data) => {
    const msg = data.toString();
    jobs[jobId].logs += msg;
    fullText += msg;
    log(`🐍 STDOUT: ${msg.trim()}`, jobId);
  });

  py.stderr.on("data", (data) => {
    const msg = data.toString();
    jobs[jobId].logs += msg;
    log(`🐍 STDERR: ${msg.trim()}`, jobId);
  });

  py.on("close", (code) => {
    log(`🏁 Python terminé (code=${code})`, jobId);
    jobs[jobId].status = code === 0 ? "done" : "error";

    // Filtrage caractères autorisés (lettres accentuées + chiffres + espace)
    const filtered = fullText
      .normalize("NFD")
      .replace(/[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]/g, "")
      .trim();

    jobs[jobId].text = filtered;

    if (callback) callback(filtered);
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

// POST /ocr/upload -> Wix envoie le fichier
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

// GET /ocr/status/:jobId
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
