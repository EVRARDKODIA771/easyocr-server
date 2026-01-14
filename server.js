import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { spawn, exec } from "child_process";

const app = express();
app.use(express.json());

/* =========================
   PATHS
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/uploads";
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/* =========================
   JOBS STORAGE
========================= */
const jobs = {}; 
// jobId: { status, logs, error, startedAt }

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
  exec("python3 --version", (_, out) => log(`🐍 ${out?.trim()}`));
  exec("tesseract --version", (_, out) =>
    log(`🎯 ${out?.split("\n")[0]}`)
  );
  exec("pdftotext -v", () => log("📄 pdftotext OK"));
}

/* =========================
   RUN PYTHON (MAIN_PARALLEL)
========================= */
function runPythonParallel(filePath, jobId) {
  log(`🚀 Lancement main_parallel.py -> ${filePath}`, jobId);

  const py = spawn("python3", [
    path.join(__dirname, "main_parallel.py"),
    filePath,
  ]);

  jobs[jobId].logs = "";

  py.stdout.on("data", (data) => {
    const msg = data.toString();
    jobs[jobId].logs += msg;
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
  });

  py.on("error", (err) => {
    log(`❌ ERREUR PYTHON: ${err.message}`, jobId);
    jobs[jobId].status = "error";
    jobs[jobId].error = err.message;
  });
}

/* =========================
   GET /
========================= */
app.get("/", (_, res) => {
  res.send("OCR Server (main_parallel.py) running");
});

/* =========================
   POST /ocr/start
========================= */
app.post("/ocr/start", async (req, res) => {
  log("➡️ POST /ocr/start reçu");

  const { fileUrl } = req.body;
  if (!fileUrl) {
    return res.status(400).json({ error: "fileUrl manquante" });
  }

  const jobId = crypto.randomUUID();
  jobs[jobId] = {
    status: "processing",
    logs: "",
    error: null,
    startedAt: Date.now(),
  };

  log(`🆔 JOB CRÉÉ`, jobId);

  (async () => {
    try {
      log(`📥 Téléchargement fichier : ${fileUrl}`, jobId);

      const response = await axios.get(fileUrl, { responseType: "stream" });
      const ext = path.extname(fileUrl) || ".pdf";
      const filePath = path.join(UPLOAD_DIR, `${jobId}${ext}`);

      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      log(`✅ Fichier prêt : ${filePath}`, jobId);

      // 🔥 LANCEMENT UNIQUE
      runPythonParallel(filePath, jobId);
    } catch (err) {
      log(`❌ ERREUR JOB : ${err.message}`, jobId);
      jobs[jobId].status = "error";
      jobs[jobId].error = err.message;
    }
  })();

  res.json({ jobId });
});

/* =========================
   GET /ocr/status/:jobId
========================= */
app.get("/ocr/status/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];
  if (!job) {
    return res.status(404).json({ status: "unknown" });
  }
  res.json(job);
});

/* =========================
   GET /ocr/testB
========================= */
app.get("/ocr/testB", (_, res) => {
  const localFile = path.join(__dirname, "test", "B.pdf");

  if (!fs.existsSync(localFile)) {
    return res.status(404).json({ error: "test/B.pdf introuvable" });
  }

  const jobId = crypto.randomUUID();
  jobs[jobId] = {
    status: "processing",
    logs: "",
    error: null,
    startedAt: Date.now(),
  };

  log(`🧪 TEST LOCAL B.pdf`, jobId);
  runPythonParallel(localFile, jobId);

  res.json({ jobId });
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
app.listen(PORT, () =>
  log(`🚀 OCR Polling Server running on port ${PORT}`)
);
