import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const app = express();
app.use(express.json());

// ====== UTILS ======
function log(message) {
  const now = new Date();
  const timestamp = now.toISOString().replace("T", " ").replace("Z", "");
  console.log(`[${timestamp}] ${message}`);
}

// ====== __dirname (ESM) ======
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ====== UPLOADS DIR ======
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/uploads";
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  log(`📁 Dossier uploads créé : ${UPLOAD_DIR}`);
}

// ====== ROUTES ======
app.get("/", (req, res) => {
  log(`🌐 GET / depuis ${req.ip}`);
  res.send("EasyOCR proxy is running");
});

/**
 * ============================
 * OCR — RÉPONSE IMMÉDIATE
 * ============================
 */
app.post("/ocr", async (req, res) => {
  log("➡️ POST /ocr reçu");

  const { fileUrl } = req.body;

  if (!fileUrl) {
    log("⚠️ fileUrl manquante");
    return res.status(400).json({ error: "fileUrl manquante" });
  }

  // ✅ 1. RÉPONSE IMMÉDIATE À WIX (ANTI 504)
  res.json({
    success: true,
    message: "OCR lancé en arrière-plan"
  });

  // ✅ 2. TRAITEMENT OCR EN BACKGROUND
  (async () => {
    try {
      log(`📥 Téléchargement fichier : ${fileUrl}`);

      const response = await axios.get(fileUrl, {
        responseType: "stream",
        timeout: 15000,
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "*/*"
        }
      });

      const contentType = response.headers["content-type"] || "";
      log(`📄 Content-Type : ${contentType}`);

      const ext =
        contentType.includes("pdf") ? "pdf" :
        contentType.includes("png") ? "png" :
        contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" :
        "bin";

      const fileName = `ocr_${Date.now()}.${ext}`;
      const filePath = path.join(UPLOAD_DIR, fileName);

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      const stats = fs.statSync(filePath);
      log(`✅ Fichier téléchargé : ${filePath}`);
      log(`📦 Taille : ${stats.size} octets`);

      // === 🚀 LANCEMENT OCR PYTHON (NON BLOQUANT)
      log(`🚀 Lancement OCR Python : ${filePath}`);

      const pythonProcess = spawn("python3", [
        path.join(__dirname, "ocr.py"),
        filePath
      ]);

      pythonProcess.stdout.on("data", (data) => {
        log(`🧠 OCR OUTPUT ➜ ${data.toString().trim()}`);
      });

      pythonProcess.stderr.on("data", (data) => {
        log(`❌ OCR ERROR ➜ ${data.toString().trim()}`);
      });

      pythonProcess.on("close", (code) => {
        log(`🏁 OCR terminé (code ${code})`);
      });

    } catch (err) {
      log(`❌ Erreur OCR background : ${err.message}`);
    }
  })();
});

// ====== SERVER ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`🚀 Server running on port ${PORT}`);
});
