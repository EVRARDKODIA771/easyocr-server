# ocr_test_post_render.py
import sys
import easyocr
import os
import requests
import json

# URL du serveur Render qui recevra les résultats
SERVER_URL = "https://ia-ocr.onrender.com/ocrResult"

def log(msg):
    print(msg, flush=True)

def send_result_to_server(file_name, text_results):
    """Envoie le résultat OCR au serveur Render"""
    try:
        payload = {
            "file": file_name,
            "results": text_results
        }
        response = requests.post(SERVER_URL, json=payload)
        if response.ok:
            log(f"📤 Résultat envoyé au serveur, status: {response.status_code}")
        else:
            log(f"⚠️ Échec de l'envoi, status: {response.status_code}, message: {response.text}")
    except Exception as e:
        log(f"❌ Erreur en envoyant les résultats: {e}")

def main():
    log("🔔 OCR PROCESS STARTED")

    file_path = sys.argv[1] if len(sys.argv) > 1 else "test/A.png"
    
    if not os.path.exists(file_path):
        log(f"⚠️ Fichier introuvable: {file_path}")
        sys.exit(1)

    try:
        log(f"📥 Traitement du fichier: {file_path}")

        # Initialisation du lecteur OCR pour français et anglais
        reader = easyocr.Reader(['fr','en'], gpu=False)

        # Lecture OCR
        result = reader.readtext(file_path)

        # Préparer les résultats pour l'envoi
        text_results = [{"text": text, "confidence": prob} for _, text, prob in result]

        if not text_results:
            log("⚠️ Aucun texte détecté")
        else:
            log("✅ Texte détecté:")
            for item in text_results:
                log(f"- {item['text']} (confiance: {item['confidence']:.2f})")

        # Envoi des résultats au serveur Render
        send_result_to_server(os.path.basename(file_path), text_results)

        log("🎉 OCR FINISHED")

    except Exception as e:
        log(f"❌ Erreur OCR: {e}")

if __name__ == "__main__":
    main()
