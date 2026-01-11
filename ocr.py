import sys
import easyocr
from pdf2image import convert_from_path
import os
import traceback
import json

def main():
    print("🔔 OCR PROCESS STARTED")

    if len(sys.argv) < 2:
        print("⚠️ Aucun fichier fourni en argument")
        print(json.dumps({"status": "error", "text": ""}))
        sys.exit(0)

    file_path = sys.argv[1]
    print(f"📥 Fichier OCR à traiter : {file_path}")

    UPLOAD_DIR = os.environ.get('UPLOAD_DIR', '/tmp/uploads')
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    print(f"📁 Répertoire de travail : {UPLOAD_DIR}")

    try:
        reader = easyocr.Reader(['fr', 'en'], gpu=False)
        print("🧠 EasyOCR Reader chargé avec succès")
    except Exception as e:
        print("❌ Erreur init EasyOCR :", e)
        traceback.print_exc()
        print(json.dumps({"status": "error", "text": ""}))
        sys.exit(0)

    images = []

    if file_path.lower().endswith(".pdf"):
        try:
            print("📄 Conversion PDF -> images ...")
            images = convert_from_path(file_path, dpi=300)
            print(f"✅ PDF converti en {len(images)} image(s)")
        except Exception as e:
            print("❌ Erreur conversion PDF :", e)
            traceback.print_exc()
            print(json.dumps({"status": "error", "text": ""}))
            sys.exit(0)
    else:
        print("🖼️ Fichier image détecté")
        images = [file_path]

    all_text = []

    for i, img in enumerate(images):
        print(f"🔎 Traitement page/image {i+1} sur {len(images)}")
        try:
            if not isinstance(img, str):
                temp_img_path = os.path.join(UPLOAD_DIR, f"temp_ocr_image_{i}.png")
                img.save(temp_img_path, format="PNG")
                img_to_process = temp_img_path
                print(f"📌 Image temporaire créée : {temp_img_path}")
            else:
                img_to_process = img
                print(f"📌 Utilisation directe du fichier image : {img_to_process}")

            results = reader.readtext(img_to_process, detail=0)
            print(f"📊 OCR page {i+1} : {results}")

            if results:
                all_text.extend(results)
                print(f"✅ Texte détecté page {i+1} ({len(results)} segments)")
            else:
                print(f"⚠️ Aucun texte détecté page {i+1}")

        except Exception as e:
            print(f"❌ Erreur OCR page {i+1} :", e)
            traceback.print_exc()

        finally:
            if not isinstance(img, str):
                try:
                    os.remove(temp_img_path)
                    print(f"🗑️ Image temporaire supprimée : {temp_img_path}")
                except OSError as err:
                    print("⚠️ Erreur suppression image temporaire :", err)

    final_text = " ".join(all_text) if all_text else ""
    print(f"🟢 TEXTE FINAL OCR ({len(final_text)} chars) : {final_text[:200]}...")  # log 200 premiers caractères

    # ⚡ On renvoie le résultat JSON pour server.js
    print(json.dumps({"status": "ok", "text": final_text}))

if __name__ == "__main__":
    main()
