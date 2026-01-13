import sys
import easyocr
from pdf2image import convert_from_path
import os
import traceback

# =========================
# LOGGING (stderr UNIQUEMENT)
# =========================
def log(message):
    print(message, file=sys.stderr, flush=True)

def main():
    log("🔔 OCR PROCESS STARTED")

    if len(sys.argv) < 2:
        log("⚠️ Aucun fichier fourni en argument")
        sys.exit(1)

    file_path = sys.argv[1]
    log(f"📥 Fichier OCR à traiter : {file_path}")

    UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "/tmp/uploads")
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # =========================
    # INIT EASYOCR
    # =========================
    try:
        reader = easyocr.Reader(["fr", "en"], gpu=False)
        log("🧠 EasyOCR Reader chargé")
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
            log("📄 Conversion PDF -> images")
            images = convert_from_path(file_path, dpi=300)
            log(f"✅ PDF converti : {len(images)} page(s)")
        else:
            log("🖼️ Fichier image détecté")
            images = [file_path]
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
                img_path = img
            else:
                temp_img_path = os.path.join(
                    UPLOAD_DIR, f"temp_ocr_page_{i}.png"
                )
                img.save(temp_img_path, format="PNG")
                img_path = temp_img_path

            results = reader.readtext(
                img_path,
                detail=0,
                paragraph=True
            )

            if results:
                all_text.append("\n".join(results))
                log(f"✅ Texte détecté ({len(results)} segments)")
            else:
                log("⚠️ Aucun texte détecté")

        except Exception:
            log("❌ Erreur OCR page")
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

    # 🚨 TRÈS IMPORTANT
    # stdout = TEXTE OCR UNIQUEMENT
    print(final_text, flush=True)

    sys.exit(0)

if __name__ == "__main__":
    main()
