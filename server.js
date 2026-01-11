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

  const { fileUrl, callbackUrl } = req.body;

  if (!fileUrl || !callbackUrl) {
    log("⚠️ fileUrl ou callbackUrl manquant");
    return res.status(400).json({ error: "fileUrl ou callbackUrl manquant" });
  }

  // ✅ Réponse immédiate
  res.json({
    success: true,
    message: "OCR lancé en arrière-plan"
  });

  // 🔁 OCR BACKGROUND
  (async () => {
    try {
      log(`📥 Téléchargement : ${fileUrl}`);

      const response = await axios.get(fileUrl, {
        responseType: "stream",
        timeout: 15000
      });

      const filePath = path.join(
        UPLOAD_DIR,
        `ocr_${Date.now()}.pdf`
      );

      const writer = fs.createWriteStream(filePath);
      response.data.pipe(writer);
      await new Promise(r => writer.on("finish", r));

      log(`✅ Fichier prêt : ${filePath}`);

      const python = spawn("python3", [
        path.join(__dirname, "ocr.py"),
        filePath
      ]);

      let ocrText = "";

      python.stdout.on("data", (data) => {
        ocrText += data.toString();
      });

      python.stderr.on("data", (data) => {
        log(`❌ OCR ERROR ➜ ${data.toString()}`);
      });

      python.on("close", async () => {
        log("🧠 OCR TERMINÉ");
        log("🧠 TEXTE OCR :", ocrText);

        // 🔁 ENVOI VERS WIX
        await axios.post(callbackUrl, {
          text: ocrText.trim()
        });

        log("📨 TEXTE OCR envoyé vers Wix");
      });

    } catch (err) {
      log(`❌ Erreur OCR : ${err.message}`);
    }
  })();
});


// ====== SERVER ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`🚀 Server running on port ${PORT}`);
});
