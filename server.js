import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

    res.json({
      success: true,
      message: "Image téléchargée avec succès",
      fileName,
      filePath,
      size: stats.size,
      contentType
    });

  } catch (err) {
    log(`❌ Erreur téléchargement : ${err.message}`);
    res.status(500).json({
      error: "Téléchargement impossible",
      details: err.message
    });
  }
});

// ====== SERVER ======
const PORT = process.env.PORT || 3000; // Render fournit process.env.PORT
app.listen(PORT, () => {
  log(`🚀 Server running on port ${PORT}`);
});
