import sys
import concurrent.futures
import re
from logs import log
from pdf_text_worker import extract_pdf_text
from ocr_tesseract_render import extract_ocr_text  # OCR déjà prêt

# =========================
# Filtrage caractères autorisés
# =========================
def filter_text(text):
    # Garder lettres (y compris accents), chiffres et espaces
    return re.sub(r"[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]", "", text).strip()

# =========================
# Wrapper pour PDF-TEXT avec affichage immédiat
# =========================
def run_pdf_text(pdf_path):
    full_text = ""
    if not pdf_path:
        return full_text
    try:
        pages_text = extract_pdf_text(pdf_path, stream=True)  # stream=True → print page par page
        for page_num, page_content in enumerate(pages_text, start=1):
            filtered = filter_text(page_content)
            full_text += filtered + "\n"
            print(f"[PDF-TEXT] Page {page_num}: {filtered}", flush=True)  # affichage immédiat
    except Exception as e:
        log(f"❌ PDF-TEXT ERROR: {e}")
    return full_text

# =========================
# Wrapper pour OCR
# =========================
def run_ocr(pdf_path):
    full_text = ""
    try:
        ocr_text = extract_ocr_text(pdf_path)
        filtered = filter_text(ocr_text)
        full_text += filtered
        print(f"[OCR] Texte OCR trouvé: {filtered}", flush=True)
    except Exception as e:
        log(f"❌ OCR ERROR: {e}")
    return full_text

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
        future_pdf = executor.submit(run_pdf_text, pdf_path)
        future_ocr = executor.submit(run_ocr, pdf_path)

        # On récupère les résultats mais PDF-TEXT a déjà printé page par page
        results["pdf_text"] = future_pdf.result()
        results["ocr_text"] = future_ocr.result()

    # Affichage final résumé
    log("🎯 Traitement terminé")
    print("===================================", flush=True)
    print("📄 [PDF-TEXT] TEXTE PDF NATIF:", flush=True)
    print(results["pdf_text"], flush=True)
    print("-----------------------------------", flush=True)
    print("🧠 [OCR] TEXTE OCR:", flush=True)
    print(results["ocr_text"], flush=True)

    # Renvoi combiné filtré à Node via stdout
    combined_text = f"PDF-TEXT:\n{results['pdf_text']}\n\nOCR:\n{results['ocr_text']}"
    print(combined_text, flush=True)

if __name__ == "__main__":
    main()
