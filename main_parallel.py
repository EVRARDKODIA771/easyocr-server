import sys
import concurrent.futures
import re
import time
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
def run_pdf_text(pdf_path: str):
    try:
        pages_text = extract_pdf_text(pdf_path, stream=True)

        for page_content in pages_text:
            filtered = filter_text(page_content)
            if filtered:
                print(f"[PDF-TEXT] {filtered}", flush=True)

        # 🔹 FIN PDF (IMMÉDIATE)
        print("[PDF-TEXT-END]", flush=True)

    except Exception as e:
        log(f"❌ PDF-TEXT ERROR: {e}")

# =========================
# OCR (long + END)
# =========================
def run_ocr(pdf_path: str):
    try:
        ocr_text = extract_ocr_text(pdf_path)
        filtered = filter_text(ocr_text)

        if filtered:
            for line in filtered.splitlines():
                clean = line.strip()
                if clean:
                    print(f"[OCR] {clean}", flush=True)

        # 🔹 FIN OCR (PLUS TARD)
        print("[OCR-END]", flush=True)

    except Exception as e:
        log(f"❌ OCR ERROR: {e}")

# =========================
# MAIN (🔥 SANS BLOCAGE)
# =========================
def main():
    if len(sys.argv) < 2:
        log("⚠️ Aucun fichier PDF fourni")
        sys.exit(1)

    pdf_path = sys.argv[1]
    log(f"🚀 Lancement traitement parallèle pour : {pdf_path}")

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

    # 🔥 Lancement indépendant
    executor.submit(run_pdf_text, pdf_path)
    executor.submit(run_ocr, pdf_path)

    # 🔥 MAINTIENT LE PROCESS VIVANT
    try:
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        log("🛑 Interruption manuelle")
        executor.shutdown(wait=False)

# =========================
# ENTRY POINT
# =========================
if __name__ == "__main__":
    main()
