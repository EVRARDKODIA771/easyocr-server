import sys
import easyocr
from pdf2image import convert_from_path
import os
import traceback

def main():
    print("🔔 OCR PROCESS STARTED")

    # Si aucun fichier n'est passé en argument
    if len(sys.argv) < 2:
        print("⚠️ Aucun fichier fourni en argument")
        print("")  # return empty
        sys.exit(0)

    file_path = sys.argv[1]
    print(f"📥 Fichier OCR à traiter : {file_path}")

    UPLOAD_DIR = os.environ.get('UPLOAD_DIR', '/tmp/uploads')
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    print(f"📁 Répertoire de travail : {UPLOAD_DIR}")

    # Initialise le lecteur EasyOCR
    try:
        reader = easyocr.Reader(['fr', 'en'], gpu=False)
        print("🧠 EasyOCR Reader chargé avec succès")
    except Exception as e:
        print("❌ Erreur lors de l'initialisation du Reader EasyOCR :", e)
        traceback.print_exc()
        print("") 
        sys.exit(0)

    images = []

    # Traitement PDF
    if file_path.lower().endswith(".pdf"):
        try:
            print("📄 Début conversion PDF -> images ...")
            images = convert_from_path(file_path, dpi=300)
            print(f"✅ Conversion PDF en images réussie : {len(images)} pages trouvées")
        except Exception as e:
            print("⚠️ Impossible de convertir le PDF :", e)
            traceback.print_exc()
            print("")
            sys.exit(0)
    else:
        print("🖼️ Fichier image détecté")
        images = [file_path]

    all_text = []

    # Parcours des images
    for i, img in enumerate(images):
        print(f"🔎 Traitement page/image {i+1} sur {len(images)}")

        try:
            if not isinstance(img, str):
                temp_img_path = os.path.join(UPLOAD_DIR, f"temp_ocr_image_{i}.png")
                img.save(temp_img_path, format="PNG")
                print(f"📌 Image temporaire créée : {temp_img_path}")
                img_to_process = temp_img_path
            else:
                print(f"📌 Utilisation directe du fichier image : {img}")
                img_to_process = img

            print("📍 Lancement OCR EasyOCR ...")
            results = reader.readtext(img_to_process, detail=0)
            print(f"📊 Résultats OCR brut (page {i+1}) :", results)

            if results:
                all_text.extend(results)
                print(f"✅ Texte détecté page {i+1} : {results}")
            else:
                print(f"⚠️ Aucun texte détecté sur page {i+1}")

        except Exception as e:
            print(f"❌ Erreur OCR sur page {i+1} :", e)
            traceback.print_exc()

        finally:
            if not isinstance(img, str):
                try:
                    os.remove(temp_img_path)
                    print(f"🗑️ Image temporaire supprimée : {temp_img_path}")
                except OSError as err:
                    print("⚠️ Erreur suppression image temporaire :", err)

    # Résultat final
    if not all_text:
        print("⚠️ Aucun texte détecté dans tout le document")
        print("")  # Retourne vide
    else:
        final_text = " ".join(all_text)
        print("🟢 TEXTE FINAL OCR :", final_text)

if __name__ == "__main__":
    main()
