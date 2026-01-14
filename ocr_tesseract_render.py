# ocr_tesseract_render.py
import sys
import os
import pytesseract
from PIL import Image
from pdf2image import convert_from_path
import requests
from logs import log  # tu as logs.py, je l'utilise pour cohérence

SERVER_URL = "https://ia-ocr.onrender.com/ocrResult"

def send_result_to_server(file_name, text_result):
    payload = {
        "file": file_name,
        "results": [{"text": text_result, "confidence": 1.0}]
    }
    try:
        import requests
        response = requests.post(SERVER_URL, json=payload)
        if response.ok:
            log(f"📤 Résultat envoyé au serveur, status: {response.status_code}")
        else:
            log(f"⚠️ Échec de l'envoi, status: {response.status_code}, message: {response.text}")
    except Exception as e:
        log(f"❌ Erreur en envoyant les résultats: {e}")

def extract_ocr_text(file_path: str) -> str:
    """
    Fonction réutilisable pour main_parallel.py
    Retourne le texte OCR du fichier
    """
    if not os.path.exists(file_path):
        log(f"⚠️ Fichier introuvable: {file_path}")
        return ""

    text_result = ""
    try:
        log(f"📥 [OCR] Traitement du fichier: {file_path}")

        if file_path.lower().endswith(".pdf"):
            pages = convert_from_path(file_path, dpi=200)
            log(f"📄 PDF détecté, {len(pages)} page(s) à traiter")
            for i, page in enumerate(pages, start=1):
                page_text = pytesseract.image_to_string(page, lang="fra+eng")
                text_result += page_text + "\n"
                log(f"✅ Page {i} traitée, {len(page_text.strip())} caractères détectés")
        else:
            img = Image.open(file_path)
            text_result = pytesseract.image_to_string(img, lang="fra+eng")
            log(f"✅ Image traitée, {len(text_result.strip())} caractères détectés")

        if not text_result.strip():
            log("⚠️ Aucun texte détecté")
        else:
            log(f"✅ Texte OCR détecté ({len(text_result.strip())} caractères)")

        # Optionnel: envoi au serveur
        send_result_to_server(os.path.basename(file_path), text_result)

    except Exception as e:
        log(f"❌ Erreur OCR: {e}")

    return text_result

# === main() pour exécution directe ===
def main():
    if len(sys.argv) < 2:
        log("⚠️ Aucun fichier fourni")
        sys.exit(1)
    file_path = sys.argv[1]
    extract_ocr_text(file_path)
    log("🎉 OCR FINISHED")

if __name__ == "__main__":
    main()
