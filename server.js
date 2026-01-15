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
// jobId: { status, logs, error, startedAt, ... }

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
  spawn("python3", ["--version"]).stdout.on("data", (data) =>
    log(`🐍 ${data.toString().trim()}`)
  );
  spawn("tesseract", ["--version"]).stdout.on("data", (data) =>
    log(`🎯 ${data.toString().split("\n")[0]}`)
  );
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
   RUN PYTHON (STREAMING + SMART TEXT)
========================= */
function runPythonParallel(filePath, jobId) {
  log(`🚀 Lancement main_parallel.py -> ${filePath}`, jobId);

  const py = spawn("python3", [
    path.join(__dirname, "main_parallel.py"),
    filePath,
  ]);

  jobs[jobId] = {
    status: "processing",
    logs: "",
    error: null,
    startedAt: Date.now(),

    pdfLines: [],
    ocrLines: [],

    mergedPdfText: "",
    mergedPdfTextSmart: "", // ✅ TEXTE SMART À EXPOSER
    mergedOcrText: "",

    pdfDone: false,
    ocrDone: false,
  };

  const handleLine = (line, source) => {
    log(`${source}: ${line}`, jobId);
    jobs[jobId].logs += line + "\n";

    /* =======================
       PDF TEXT BRUT
    ======================= */
    if (line.startsWith("[PDF-TEXT]")) {
      jobs[jobId].pdfLines.push(line.replace("[PDF-TEXT]", "").trim());
      return;
    }

    if (line === "[PDF-TEXT-END]") {
      jobs[jobId].mergedPdfText = jobs[jobId].pdfLines.join("\n");
      jobs[jobId].pdfDone = true;

      log("📄📄📄 PDF TEXT MERGED (FULL CONTENT) 📄📄📄", jobId);
      log(jobs[jobId].mergedPdfText, jobId);
      log("📄📄📄 END PDF TEXT MERGED 📄📄📄", jobId);
      return;
    }

    /* =======================
       PDF TEXT SMART (CELUI QUE TU VEUX)
    ======================= */
    if (line === "📄📄📄 PDF TEXT MERGED CLEANED & SMART (FULL CONTENT) 📄📄📄") {
      jobs[jobId]._collectSmart = true;
      jobs[jobId]._smartBuffer = [];
      return;
    }

    if (jobs[jobId]._collectSmart) {
      if (line === "📄📄📄 END PDF TEXT MERGED CLEANED & SMART 📄📄📄") {
        jobs[jobId].mergedPdfTextSmart = jobs[jobId]._smartBuffer.join("\n").trim();
        jobs[jobId]._collectSmart = false;

        log("✅ TEXTE SMART STOCKÉ POUR WIX", jobId);
        log(jobs[jobId].mergedPdfTextSmart, jobId);
        return;
      }

      jobs[jobId]._smartBuffer.push(line);
      return;
    }

    /* =======================
       OCR
    ======================= */
    if (line.startsWith("[OCR]")) {
      jobs[jobId].ocrLines.push(line.replace("[OCR]", "").trim());
      return;
    }

    if (line === "[OCR-END]") {
      jobs[jobId].mergedOcrText = jobs[jobId].ocrLines.join("\n");
      jobs[jobId].ocrDone = true;

      log(
        `🧠 OCR MERGED READY (${jobs[jobId].mergedOcrText.length} caractères)`,
        jobId
      );
      return;
    }
  };

  py.stdout.on("data", (data) => {
    data
      .toString()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => handleLine(line, "STDOUT"));
  });

  py.stderr.on("data", (data) => {
    data
      .toString()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => handleLine(line, "STDERR"));
  });

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

app.get("/ping", (req, res) => {
  console.log("🟢 Ping reçu – service réveillé");
  res.status(200).send("awake");
});

app.get("/", (_, res) => res.send("OCR Server ready"));

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
        res.json({ jobId });
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   RESULT ROUTE (SMART TEXT)
========================= */
app.get("/ocr/result/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job = jobs[jobId];
  if (!job) return res.status(404).json({ error: "Job inconnu" });

  if (job.mergedPdfTextSmart) {
    return res.json({
      status: "done",
      text: job.mergedPdfTextSmart,
    });
  }

  return res.status(202).json({ status: "processing" });
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
