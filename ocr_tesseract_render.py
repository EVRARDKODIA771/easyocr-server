# ocr_tesseract_render.py
import sys
import os
import pytesseract
from PIL import Image
from pdf2image import convert_from_path
import re
from logs import log  # pour cohérence avec main_parallel.py

# =========================
# Filtrage caractères autorisés
# =========================
def filter_text(text: str) -> str:
    """Garde uniquement lettres (y compris accents), chiffres et espaces"""
    return re.sub(r"[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]", "", text).strip()

def extract_ocr_text(file_path: str) -> str:
    """
    Retourne le texte OCR filtré du fichier PDF ou image
    """
    if not os.path.exists(file_path):
        log(f"⚠️ [OCR] Fichier introuvable: {file_path}")
        return ""

    text_result = ""
    try:
        log(f"📥 [OCR] Traitement du fichier: {file_path}")

        if file_path.lower().endswith(".pdf"):
            pages = convert_from_path(file_path, dpi=200)
            log(f"📄 [OCR] PDF détecté, {len(pages)} page(s) à traiter")
            for i, page in enumerate(pages, start=1):
                page_text = pytesseract.image_to_string(page, lang="fra+eng")
                page_text = filter_text(page_text)
                text_result += page_text + "\n"
                log(f"✅ [OCR] Page {i} traitée, {len(page_text)} caractères filtrés")
        else:
            img = Image.open(file_path)
            page_text = pytesseract.image_to_string(img, lang="fra+eng")
            text_result = filter_text(page_text)
            log(f"✅ [OCR] Image traitée, {len(text_result)} caractères filtrés")

        if not text_result.strip():
            log("⚠️ [OCR] Aucun texte détecté après filtrage")
        else:
            log(f"✅ [OCR] Texte détecté ({len(text_result.strip())} caractères après filtrage)")

    except Exception as e:
        log(f"❌ [OCR] Erreur OCR: {e}")

    return text_result

# === main() pour exécution directe ===
def main():
    if len(sys.argv) < 2:
        log("⚠️ Aucun fichier fourni")
        sys.exit(1)
    file_path = sys.argv[1]
    text = extract_ocr_text(file_path)
    # affichage final pour Node
    print(text)
    log("🎉 [OCR] FINISHED")

if __name__ == "__main__":
    main()
