import sys
import easyocr
from pdf2image import convert_from_path
import os
import traceback

def main():
    print("🔔 OCR PROCESS STARTED")

    # Vérification argument
    if len(sys.argv) < 2:
        print("")  # retourne vide si pas de fichier
        sys.exit(0)

    file_path = sys.argv[1]
    print(f"📥 Fichier OCR à traiter : {file_path}")

    # Répertoire de travail
    UPLOAD_DIR = os.environ.get('UPLOAD_DIR', '/tmp/uploads')
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    print(f"📁 Répertoire de travail : {UPLOAD_DIR}")

    # Initialisation EasyOCR
    try:
        reader = easyocr.Reader(['fr', 'en'], gpu=False)
        print("🧠 EasyOCR Reader chargé avec succès")
    except Exception as e:
        print("❌ Erreur initialisation EasyOCR :", e)
        traceback.print_exc()
        print("")
        sys.exit(0)

    # Conversion PDF en images si nécessaire
    images = []
    if file_path.lower().endswith(".pdf"):
        try:
            print("📄 Conversion PDF -> images ...")
            images = convert_from_path(file_path, dpi=200)  # dpi réduit pour serveur
            print(f"✅ {len(images)} pages converties")
        except Exception as e:
            print("⚠️ Impossible de convertir le PDF :", e)
            traceback.print_exc()
            print("")
            sys.exit(0)
    else:
        print("🖼️ Fichier image détecté")
        images = [file_path]

    all_text = []

    # OCR sur chaque page / image
    for i, img in enumerate(images):
        print(f"🔎 Traitement page/image {i+1} sur {len(images)}")
        temp_img_path = None
        try:
            if not isinstance(img, str):
                temp_img_path = os.path.join(UPLOAD_DIR, f"temp_ocr_{i}.png")
                img.save(temp_img_path, format="PNG")
                img_to_process = temp_img_path
            else:
                img_to_process = img

            results = reader.readtext(img_to_process, detail=0)
            if results:
                all_text.extend(results)
                print(f"✅ Texte page {i+1} :", results)
            else:
                print(f"⚠️ Aucun texte détecté page {i+1}")

        except Exception as e:
            print(f"❌ Erreur OCR page {i+1} :", e)
            traceback.print_exc()

        finally:
            if temp_img_path and os.path.exists(temp_img_path):
                try:
                    os.remove(temp_img_path)
                except OSError as err:
                    print("⚠️ Erreur suppression image temporaire :", err)

    # Résultat final
    if all_text:
        final_text = " ".join(all_text)
        print(final_text)  # output principal pour server.js
    else:
        print("")  # retourne vide si aucun texte

if __name__ == "__main__":
    main()
