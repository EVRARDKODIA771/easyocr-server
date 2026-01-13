import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* =========================
   JOBS STORAGE (POLLING)
========================= */
const jobs = {}; // { jobId: { status, text, error, startedAt } }

/* =========================
   UTILS
========================= */
function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
  console.log(`[${ts}] ${msg}`);
}

/* =========================
   GET /
========================= */
app.get("/", (req, res) => {
  log("🌐 GET /");
  res.send("OCR Server (Polling) running");
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
    text: null,
    error: null,
    startedAt: Date.now()
  };

  log(`🆔 JOB CRÉÉ : ${jobId}`);

  (async () => {
    try {
      // 📥 Télécharger le fichier
      log(`📥 Téléchargement fichier : ${fileUrl}`);
      const response = await axios.get(fileUrl, { responseType: "stream" });

      const filePath = path.join(UPLOAD_DIR, `ocr_${jobId}.pdf`);
      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      log(`✅ Fichier téléchargé : ${filePath}`);

      // 🐍 Lancer OCR Python
      const py = spawn("python3", [path.join(__dirname, "ocr.py"), filePath]);

      let ocrOutput = "";
      let ocrError = "";

      py.stdout.on("data", (data) => {
        const text = data.toString();
        ocrOutput += text;
        log(`🐍 PYTHON STDOUT: ${text.trim()}`);
      });

      py.stderr.on("data", (data) => {
        const text = data.toString();
        ocrError += text;
        log(`🐍 PYTHON STDERR: ${text.trim()}`);
      });

      py.on("close", () => {
  const finalText = ocrOutput.trim();

  if (finalText.length > 0) {
    jobs[jobId].status = "done";
    jobs[jobId].text = finalText;
    log(`✅ OCR OK (${finalText.length} chars)`);
  } else {
    jobs[jobId].status = "error";
    jobs[jobId].error = "OCR vide";
    log("❌ OCR vide");
  }

  fs.unlink(filePath, () => {});
});


    } catch (err) {
      jobs[jobId].status = "error";
      jobs[jobId].error = err.message;
      log(`❌ JOB ERROR : ${err.message}`);
    }
  })();

  // ⚡ Réponse immédiate (polling)
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
   CLEANUP JOBS (RAM)
========================= */
setInterval(() => {
  const now = Date.now();
  for (const id in jobs) {
    if (now - jobs[id].startedAt > 10 * 60 * 1000) {
      log(`🧹 Suppression job expiré : ${id}`);
      delete jobs[id];
    }
  }
}, 5 * 60 * 1000);

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log(`🚀 OCR Polling Server running on port ${PORT}`));
