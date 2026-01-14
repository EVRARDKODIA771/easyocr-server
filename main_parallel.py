import sys
import concurrent.futures
from logs import log
from pdf_text_worker import extract_pdf_text
from ocr_worker import extract_ocr_text

def main():
    if len(sys.argv) < 2:
        log("⚠️ Aucun fichier PDF fourni")
        sys.exit(1)

    pdf_path = sys.argv[1]
    log(f"🚀 Lancement traitement parallèle pour : {pdf_path}")

    results = {
        "pdf_text": None,
        "ocr_text": None
    }

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = {
            executor.submit(extract_pdf_text, pdf_path): "pdf_text",
            executor.submit(extract_ocr_text, pdf_path): "ocr_text"
        }

        for future in concurrent.futures.as_completed(futures):
            key = futures[future]
            try:
                results[key] = future.result()
                log(f"📥 Résultat reçu : {key} ({len(results[key])} caractères)")
            except Exception as e:
                log(f"❌ Erreur dans {key} : {e}")

    log("🎯 Traitement terminé")
    log("===================================")
    log("📄 TEXTE PDF NATIF :")
    log(results["pdf_text"][:500] if results["pdf_text"] else "VIDE")
    log("-----------------------------------")
    log("🧠 TEXTE OCR :")
    log(results["ocr_text"][:500] if results["ocr_text"] else "VIDE")

if __name__ == "__main__":
    main()
