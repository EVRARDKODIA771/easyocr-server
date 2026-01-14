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
   RUN PYTHON (STREAMING)
========================= */
function runPythonParallel(filePath, jobId) {
  log(`🚀 Lancement main_parallel.py -> ${filePath}`, jobId);

  const py = spawn("python3", [
    path.join(__dirname, "main_parallel.py"),
    filePath
  ]);

  jobs[jobId] = {
    status: "processing",
    logs: "",
    error: null,
    startedAt: Date.now(),

    pdfLines: [],
    ocrLines: [],

    mergedPdfText: "",
    mergedOcrText: "",

    pdfDone: false,
    ocrDone: false
  };

  const handleLine = (line, source) => {
    log(`${source}: ${line}`, jobId);
    jobs[jobId].logs += line + "\n";

    /* =======================
       PDF TEXT
    ======================= */

    if (line.startsWith("[PDF-TEXT]")) {
      jobs[jobId].pdfLines.push(
        line.replace("[PDF-TEXT]", "").trim()
      );
      return;
    }

    if (line === "[PDF-TEXT-END]") {
      jobs[jobId].mergedPdfText = jobs[jobId].pdfLines.join("\n");
      jobs[jobId].pdfDone = true;

      // 🔥 AFFICHAGE COMPLET IMMÉDIAT
      log("[PDF-TEXT-END]", jobId);
      log("📄📄📄 PDF TEXT MERGED (FULL CONTENT) 📄📄📄", jobId);
      log(jobs[jobId].mergedPdfText, jobId);
      log("📄📄📄 END PDF TEXT MERGED 📄📄📄", jobId);

      return;
    }

    /* =======================
       OCR
    ======================= */

    if (line.startsWith("[OCR]")) {
      jobs[jobId].ocrLines.push(
        line.replace("[OCR]", "").trim()
      );
      return;
    }

    if (line === "[OCR-END]") {
      jobs[jobId].mergedOcrText = jobs[jobId].ocrLines.join("\n");
      jobs[jobId].ocrDone = true;

      log(
        `🧠 OCR MERGED READY (${jobs[jobId].mergedOcrText.length} caractères):\n${jobs[jobId].mergedOcrText}`,
        jobId
      );
      return;
    }
  };

  py.stdout.on("data", data => {
    data
      .toString()
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => handleLine(line, "STDOUT"));
  });

  py.stderr.on("data", data => {
    data
      .toString()
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .forEach(line => handleLine(line, "STDERR"));
  });

  py.on("close", code => {
    log(`🏁 Python terminé (code=${code})`, jobId);
    jobs[jobId].status = code === 0 ? "done" : "error";
  });

  py.on("error", err => {
    log(`❌ ERREUR PYTHON: ${err.message}`, jobId);
    jobs[jobId].status = "error";
    jobs[jobId].error = err.message;
  });
}


/* =========================
   ROUTES
========================= */
app.get("/", (_, res) => res.send("OCR Server ready"));

app.post("/ocr/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });

  const jobId = crypto.randomUUID();
  runPythonParallel(req.file.path, jobId);

  // Réponse immédiate avec jobId
  res.json({ jobId });
});

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
        runPythonParallel(filePath, jobId);
        res.json({
          status: "processing",
          jobId,
          message: "Le traitement a commencé, récupérez le texte via /ocr/stream/:jobId",
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

// SSE pour récupérer le texte en direct
app.get("/ocr/stream/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];
  if (!job) return res.status(404).send("Job inconnu");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ text: job.text, status: job.status })}\n\n`);
    if (job.status !== "processing") {
      clearInterval(interval);
      res.write(`event: done\ndata: ${JSON.stringify({ text: job.text, status: job.status })}\n\n`);
      res.end();
    }
  }, 200); // update toutes les 200ms
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
