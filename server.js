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

// ====== UPLOADS DIR (compatible Docker/Render) ======
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

app.post("/ocr", async (req, res) => {
  log("➡️ POST /ocr reçu");

  const { fileUrl } = req.body;

  if (!fileUrl) {
    log("⚠️ fileUrl manquante");
    return res.status(400).json({ error: "fileUrl manquante" });
  }

  try {
    log(`📥 Début téléchargement : ${fileUrl}`);

    const response = await axios.get(fileUrl, {
      responseType: "stream",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*"
      },
      timeout: 15000
    });

    const contentType = response.headers["content-type"];
    log(`📄 Content-Type détecté : ${contentType}`);

    const ext =
      contentType?.includes("png") ? "png" :
      contentType?.includes("jpeg") ? "jpg" :
      contentType?.includes("jpg") ? "jpg" :
      "img";

    const fileName = `image_${Date.now()}.${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    const stats = fs.statSync(filePath);

    log(`✅ Téléchargement terminé`);
    log(`📂 Fichier : ${filePath}`);
    log(`📦 Taille : ${stats.size} octets`);

    // === 📌 ON APPELLE LE SCRIPT PYTHON OCR ===
    log("🚀 Appel OCR Python pour :", filePath);

    const pythonProcess = spawn("python3", [
      path.join(__dirname, "ocr.py"),
      filePath
    ]);

    let ocrOutput = "";
    let ocrError = "";

    pythonProcess.stdout.on("data", (data) => {
      ocrOutput += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      ocrError += data.toString();
    });

    pythonProcess.on("close", (code) => {
      log(`🧠 Python OCR process finished with code: ${code}`);

      if (ocrError) {
        log("❌ Error from Python OCR:", ocrError);
      }

      const text = ocrOutput.trim();
      log("📨 Text extracted from OCR:", text);

      return res.json({
        success: true,
        ocrText: text
      });
    });

  } catch (err) {
    log(`❌ Erreur téléchargement ou OCR : ${err.message}`);
    return res.status(500).json({
      error: "Téléchargement ou OCR impossible",
      details: err.message
    });
  }
});

// ====== SERVER ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log(`🚀 Server running on port ${PORT}`);
});
