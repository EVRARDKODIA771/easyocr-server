import express from "express";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const app = express();
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/tmp/uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function log(msg) {
  const ts = new Date().toISOString().replace("T", " ").replace("Z", "");
  console.log(`[${ts}] ${msg}`);
}

// === GET test
app.get("/", (req, res) => {
  log(`🌐 GET /`);
  res.send("OCR Server running");
});

// === POST OCR
app.post("/ocr", async (req, res) => {
  log("➡️ POST /ocr reçu");

  const { fileUrl, callbackUrl } = req.body;
  if (!fileUrl) return res.status(400).json({ error: "fileUrl manquante" });

  try {
    // Téléchargement du fichier depuis Wix
    log(`📥 Téléchargement fichier : ${fileUrl}`);
    const response = await axios.get(fileUrl, { responseType: "stream" });

    const filePath = path.join(UPLOAD_DIR, `ocr_${Date.now()}.pdf`);
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });
    log(`✅ Fichier téléchargé : ${filePath}`);

    // Lancer OCR Python
    const py = spawn("python3", [path.join(__dirname, "ocr.py"), filePath]);

    let ocrOutput = "";
    let ocrError = "";

    py.stdout.on("data", (data) => {
      const text = data.toString();
      ocrOutput += text;
      // Affiche les logs Python en direct
      log(`🐍 PYTHON STDOUT: ${text.trim()}`);
    });

    py.stderr.on("data", (data) => {
      const text = data.toString();
      ocrError += text;
      log(`🐍 PYTHON STDERR: ${text.trim()}`);
    });

    py.on("close", async (code) => {
      log(`🔚 Process Python terminé avec code ${code}`);

      if (ocrError) log(`❌ OCR STDERR ➜ ${ocrError.trim()}`);

      // Récupérer le JSON final de ocr.py (dernière ligne JSON)
      let finalText = "";
      try {
        const lines = ocrOutput.split("\n").reverse();
        const jsonLine = lines.find(line => line.trim().startsWith("{") && line.includes('"status"'));
        if (jsonLine) {
          const jsonOutput = JSON.parse(jsonLine);
          finalText = jsonOutput.text || "";
        } else {
          finalText = "texte illisible";
        }
      } catch (err) {
        log(`❌ Erreur parsing JSON OCR: ${err.message}`);
        finalText = "texte illisible";
      }

      log(`🧠 TEXTE FINAL OCR (${finalText.length} chars) : ${finalText.slice(0, 200)}...`);

      // Callback vers Wix
      if (callbackUrl) {
        try {
          await axios.post(callbackUrl, { text: finalText });
          log(`📡 Callback envoyé vers Wix`);
        } catch (err) {
          log(`⚠️ Callback échoué : ${err.message}`);
        }
      }

      res.json({ success: true, text: finalText });
    });

  } catch (err) {
    log(`❌ Erreur OCR : ${err.message}`);
    res.status(500).json({ error: "OCR impossible", details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => log(`🚀 Server running on port ${PORT}`));
