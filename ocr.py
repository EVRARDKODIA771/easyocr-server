import sys
import easyocr
from pdf2image import convert_from_path
import os

def main():
    if len(sys.argv) < 2:
        print("")  # pas de fichier fourni
        sys.exit(0)

    file_path = sys.argv[1]

    # Crée le lecteur OCR (anglais et français)
    reader = easyocr.Reader(['en', 'fr'])

    images = []

    # Vérifie si c'est un PDF
    if file_path.lower().endswith(".pdf"):
        # Convertit le PDF en images (une image par page)
        poppler_path = r"C:\Poppler\poppler-24.07.0\Library\bin"  # chemin correct vers Poppler
        try:
            images = convert_from_path(file_path, dpi=300, poppler_path=poppler_path)
        except Exception as e:
            print("⚠️ Impossible de convertir le PDF :", e)
            sys.exit(0)
    else:
        # Si c'est une image (jpg/png), on la met directement dans la liste
        images = [file_path]

    all_text = []

    for i, img in enumerate(images):
        # Si img est un objet PIL (PDF converti), sauvegarde temporairement
        if not isinstance(img, str):
            temp_img_path = "temp_ocr_image.png"
            img.save(temp_img_path)
            results = reader.readtext(temp_img_path)
            os.remove(temp_img_path)
        else:
            results = reader.readtext(img)

        if results:
            all_text.extend([res[1] for res in results])
        else:
            # Page ou image illisible
            print(f"⚠️ Page/Image {i+1} illisible")

    if not all_text:
        # Aucun texte détecté
        print("⚠️ Aucun texte détecté")
        print("")  # retourne chaîne vide si illisible
    else:
        # Concatène tout le texte détecté
        print(" ".join(all_text))

if __name__ == "__main__":
    main()
