import sys
import concurrent.futures
import re
from logs import log
from pdf_text_worker import extract_pdf_text
from ocr_tesseract_render import extract_ocr_text  # ✅ avant c'était ocr_worker

# =========================
# Filtrage caractères autorisés
# =========================
def filter_text(text):
    # Garder lettres (y compris accents), chiffres et espaces
    return re.sub(r"[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]", "", text).strip()

def main():
    if len(sys.argv) < 2:
        log("⚠️ Aucun fichier PDF fourni")
        sys.exit(1)

    pdf_path = sys.argv[1]
    log(f"🚀 Lancement traitement parallèle pour : {pdf_path}")

    results = {
        "pdf_text": "",
        "ocr_text": ""
    }

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = {
            executor.submit(extract_pdf_text, pdf_path): "pdf_text",
            executor.submit(extract_ocr_text, pdf_path): "ocr_text"
        }

        for future in concurrent.futures.as_completed(futures):
            key = futures[future]
            try:
                raw_text = future.result() or ""
                filtered = filter_text(raw_text)
                results[key] = filtered
                log(f"📥 Résultat reçu : [{key}] ({len(filtered)} caractères après filtrage)")
            except Exception as e:
                log(f"❌ Erreur dans [{key}] : {e}")

    # Affichage final
    log("🎯 Traitement terminé")
    log("===================================")
    log("📄 [PDF-TEXT] TEXTE PDF NATIF :")
    log(results["pdf_text"][:500] if results["pdf_text"] else "VIDE")
    log("-----------------------------------")
    log("🧠 [OCR] TEXTE OCR :")
    log(results["ocr_text"][:500] if results["ocr_text"] else "VIDE")

    # Renvoi combiné filtré à Node via stdout
    combined_text = f"PDF-TEXT:\n{results['pdf_text']}\n\nOCR:\n{results['ocr_text']}"
    print(combined_text)

if __name__ == "__main__":
    main()
