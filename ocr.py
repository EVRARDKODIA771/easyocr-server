import sys
import easyocr
from pdf2image import convert_from_path
import os
import traceback

# =========================
# LOGGING (stderr uniquement)
# =========================
def log(msg):
    print(msg, file=sys.stderr, flush=True)

def main():
    log("🔔 OCR PROCESS STARTED")

    # =========================
    # Fichier à traiter
    # =========================
    file_path = sys.argv[1] if len(sys.argv) > 1 else None
    if not file_path:
        log("⚠️ Aucun fichier fourni !")
        sys.exit(1)

    log(f"📥 Fichier OCR à traiter : {file_path}")

    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/uploads")
    MODEL_DIR = "/tmp/easyocr"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(MODEL_DIR, exist_ok=True)

    # =========================
    # INIT EASYOCR
    # =========================
    try:
        reader = easyocr.Reader(["fr", "en"], gpu=False,
                                model_storage_directory=MODEL_DIR,
                                user_network_directory=MODEL_DIR)
        log("🧠 EasyOCR Reader chargé (cache OK)")
    except Exception:
        log("❌ Erreur init EasyOCR")
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

    # =========================
    # CHARGEMENT DES IMAGES
    # =========================
    images = []
    try:
        if file_path.lower().endswith(".pdf"):
            log("📄 Conversion PDF -> images (dpi=150)")
            images = convert_from_path(file_path, dpi=150)
            log(f"✅ PDF converti : {len(images)} page(s)")
        elif any(file_path.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".bmp"]):
            log("🖼️ Image détectée")
            images = [file_path]
        else:
            log("❌ Format de fichier non supporté")
            sys.exit(1)
    except Exception:
        log("❌ Erreur conversion PDF/image")
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

    # =========================
    # OCR
    # =========================
    all_text = []
    for i, img in enumerate(images):
        log(f"🔎 OCR page/image {i + 1}/{len(images)}")
        temp_img_path = None
        try:
            if isinstance(img, str):
                img_path = img  # chemin direct pour image seule
            else:
                temp_img_path = os.path.join(UPLOAD_DIR, f"temp_ocr_page_{i}.png")
                img.save(temp_img_path, format="PNG")
                img_path = temp_img_path

            results = reader.readtext(img_path, detail=0, paragraph=True)
            text = "\n".join(results).strip()
            if text:
                log(f"✅ Texte détecté page {i+1} ({len(results)} segments)")
                log(f"--- CONTENU PAGE {i+1} ---\n{text}\n--- FIN PAGE {i+1} ---")
                all_text.append(text)
                # Affichage immédiat pour le serveur ou stdout
                print(text, flush=True)
            else:
                log(f"⚠️ Aucun texte détecté page {i+1}")

        except Exception:
            log(f"❌ Erreur OCR page {i+1}")
            traceback.print_exc(file=sys.stderr)
        finally:
            if temp_img_path and os.path.exists(temp_img_path):
                try:
                    os.remove(temp_img_path)
                except OSError:
                    pass

    # =========================
    # SORTIE FINALE
    # =========================
    final_text = "\n\n".join(all_text).strip()
    log(f"🟢 OCR TERMINÉ ({len(final_text)} caractères)")

    log("========== OCR RESULT START ==========")
    log(final_text if final_text else "[AUCUN TEXTE OCR]")
    log("========== OCR RESULT END ==========")

    sys.exit(0)


if __name__ == "__main__":
    main()
