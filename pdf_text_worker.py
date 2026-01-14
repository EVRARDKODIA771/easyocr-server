import pdfplumber
from logs import log

def extract_pdf_text(pdf_path):
    log("📄 [PDF-TEXT] Démarrage extraction texte native")

    full_text = ""

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages):
                log(f"📄 [PDF-TEXT] Page {i+1}")
                text = page.extract_text()
                if text:
                    full_text += text + "\n"
    except Exception as e:
        log(f"❌ [PDF-TEXT] ERREUR : {e}")

    log("✅ [PDF-TEXT] Extraction terminée")
    return full_text
