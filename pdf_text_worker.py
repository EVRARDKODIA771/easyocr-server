# pdf_text_worker.py
import os
import pdfplumber
import re
from logs import log  # cohérence avec main_parallel.py

# =========================
# Filtrage caractères autorisés
# =========================
def filter_text(text: str) -> str:
    """
    Garde uniquement les lettres (a-zA-Z + accents), chiffres et espaces
    """
    return re.sub(r"[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]", "", text).strip()

# =========================
# Extraction texte PDF
# =========================
def extract_pdf_text(pdf_path: str) -> str:
    """
    Retourne le texte natif filtré d'un PDF
    """
    if not os.path.exists(pdf_path):
        log(f"⚠️ [PDF-TEXT] Fichier introuvable: {pdf_path}")
        return ""

    text_result = ""
    try:
        log(f"📥 [PDF-TEXT] Extraction texte natif pour: {pdf_path}")

        with pdfplumber.open(pdf_path) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text() or ""
                filtered_text = filter_text(page_text)
                text_result += filtered_text + "\n"
                log(f"📄 [PDF-TEXT] Page {i} traitée, {len(filtered_text)} caractères filtrés")

        if not text_result.strip():
            log("⚠️ [PDF-TEXT] Aucun texte détecté")
        else:
            log(f"✅ [PDF-TEXT] Texte extrait et filtré ({len(text_result.strip())} caractères)")

    except Exception as e:
        log(f"❌ [PDF-TEXT] ERREUR : {e}")

    return text_result

# === main() pour test direct ===
if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        log("⚠️ Aucun fichier PDF fourni")
        sys.exit(1)
    file_path = sys.argv[1]
    extract_pdf_text(file_path)
    log("🎉 PDF-TEXT FINISHED")
