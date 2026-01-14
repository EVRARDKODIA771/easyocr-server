# ocr_test.py
import sys
import easyocr
import os

def log(msg):
    """Log vers la console, utilisable dans Render ou terminal."""
    print(msg, flush=True)

def main():
    log("🔔 OCR TEST STARTED")

    # Chemin du fichier à tester
    file_path = sys.argv[1] if len(sys.argv) > 1 else "test/A.png"
    
    if not os.path.exists(file_path):
        log(f"⚠️ Fichier introuvable: {file_path}")
        sys.exit(1)

    try:
        log(f"📥 Traitement du fichier: {file_path}")

        # Initialisation de EasyOCR pour le français et anglais
        reader = easyocr.Reader(['fr','en'], gpu=False)

        # Lecture OCR
        result = reader.readtext(file_path)

        if not result:
            log("⚠️ Aucun texte détecté")
        else:
            log("✅ Texte détecté:")
            for bbox, text, prob in result:
                log(f"- {text} (confiance: {prob:.2f})")

    except Exception as e:
        log(f"❌ Erreur OCR: {str(e)}")

if __name__ == "__main__":
    main()
