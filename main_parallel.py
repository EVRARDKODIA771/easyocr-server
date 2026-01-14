import sys
import concurrent.futures
import re
from logs import log
from pdf_text_worker import extract_pdf_text
from ocr_tesseract_render import extract_ocr_text

# =========================
# Filtrage caractères autorisés
# =========================
def filter_text(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]", "", text).strip()

# =========================
# PDF TEXT (stream + END)
# =========================
def run_pdf_text(pdf_path: str) -> str:
    full_text = ""

    try:
        pages_text = extract_pdf_text(pdf_path, stream=True)

        for page_num, page_content in enumerate(pages_text, start=1):
            filtered = filter_text(page_content)
            if filtered:
                full_text += filtered + "\n"
                print(f"[PDF-TEXT] {filtered}", flush=True)

        # 🔹 MARQUEUR FIN PDF
        print("[PDF-TEXT-END]", flush=True)

    except Exception as e:
        log(f"❌ PDF-TEXT ERROR: {e}")

    return full_text.strip()

# =========================
# OCR (long + END)
# =========================
def run_ocr(pdf_path: str) -> str:
    full_text = ""

    try:
        ocr_text = extract_ocr_text(pdf_path)
        filtered = filter_text(ocr_text)

        if filtered:
            # On découpe pour garder le streaming côté Node
            for line in filtered.splitlines():
                clean = line.strip()
                if clean:
                    print(f"[OCR] {clean}", flush=True)
                    full_text += clean + " "

        # 🔹 MARQUEUR FIN OCR
        print("[OCR-END]", flush=True)

    except Exception as e:
        log(f"❌ OCR ERROR: {e}")

    return full_text.strip()

# =========================
# MAIN
# =========================
def main():
    if len(sys.argv) < 2:
        log("⚠️ Aucun fichier PDF fourni")
        sys.exit(1)

    pdf_path = sys.argv[1]
    log(f"🚀 Lancement traitement parallèle pour : {pdf_path}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        executor.submit(run_pdf_text, pdf_path)
        executor.submit(run_ocr, pdf_path)

    log("🎯 Traitement terminé")

# =========================
# ENTRY POINT
# =========================
if __name__ == "__main__":
    main()
