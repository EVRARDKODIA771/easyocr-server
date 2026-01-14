import sys
import concurrent.futures
import re
import time
from logs import log
from pdf_text_worker import extract_pdf_text
from ocr_tesseract_render import extract_ocr_text

# =========================
# Filtrage caractères autorisés
# =========================
def filter_text(text: str) -> str:
    if not text:
        return ""
    return re.sub(r"[^a-zA-Z0-9À-ÖØ-öø-ÿ\s]", "", text).strip()

# =========================
# Nettoyage du texte MERGED
# =========================
def clean_merged_text(raw_text: str) -> str:
    text = raw_text

    # 1️⃣ Supprimer les chiffres isolés ou très courts
    text = re.sub(r'\b\d{1,2}\b', '', text)

    # 2️⃣ Supprimer les lettres isolées répétées (ex: j j j, w w, J J)
    text = re.sub(r'\b([a-zA-Z])\s+(\1\s*){1,}\b', '', text)

    # 3️⃣ Supprimer les espaces multiples
    text = re.sub(r'\s+', ' ', text)

    # 4️⃣ Supprimer les caractères bizarres restants
    text = re.sub(r'[^a-zA-Z0-9À-ÖØ-öø-ÿ.,;:!?\'"()\s-]', '', text)

    # 5️⃣ Nettoyer les espaces avant la ponctuation
    text = re.sub(r'\s+([.,;:!?])', r'\1', text)

    # 6️⃣ Nettoyer les espaces autour des tirets
    text = re.sub(r'\s*-\s*', ' - ', text)

    # 7️⃣ Supprimer espaces début/fin
    text = text.strip()

    return text

# =========================
# Nettoyage avancé pour paroles intelligibles
# =========================
def make_text_smart(raw_text: str) -> str:
    text = raw_text

    # 1️⃣ Fusionner certains mots OCR coupés courants (FR)
    text = re.sub(r'\bvi vez\b', 'vivez', text, flags=re.IGNORECASE)
    text = re.sub(r'\blamour\b', "l'amour", text, flags=re.IGNORECASE)
    text = re.sub(r'\bbienheu reux\b', "bien heureux", text, flags=re.IGNORECASE)
    text = re.sub(r'\bse rez\b', 'serez', text, flags=re.IGNORECASE)
    text = re.sub(r'\bheu reux\b', 'heureux', text, flags=re.IGNORECASE)

    # 2️⃣ Supprimer répétitions consécutives de mots identiques ou quasi-identiques
    text = re.sub(r'\b(\w+)( \1)+\b', r'\1', text, flags=re.IGNORECASE)

    # 3️⃣ Nettoyer les espaces multiples
    text = re.sub(r'\s+', ' ', text)

    # 4️⃣ Supprimer les caractères isolés qui restent
    text = re.sub(r'\b[a-zA-Z]\b', '', text)

    # 5️⃣ Ajuster les espaces autour des apostrophes et tirets
    text = re.sub(r"\s*'\s*", "'", text)
    text = re.sub(r'\s*-\s*', ' - ', text)

    # 6️⃣ Supprimer espaces début/fin
    text = text.strip()

    return text

# =========================
# PDF TEXT (stream + MERGED)
# =========================
def run_pdf_text(pdf_path: str):
    merged_text = ""  # Pour stocker tous les prints [PDF-TEXT]

    try:
        pages_text = extract_pdf_text(pdf_path, stream=True)

        for page_content in pages_text:
            filtered = filter_text(page_content)
            if filtered:
                # print ligne par ligne pour streaming
                for line in filtered.splitlines():
                    clean = line.strip()
                    if clean:
                        print(f"[PDF-TEXT] {clean}", flush=True)
                        merged_text += clean + " "  # <-- concaténation pour MERGED (avec espace)

        # 🔹 FIN PDF (IMMÉDIATE)
        print("[PDF-TEXT-END]", flush=True)

        # 🔹 Nettoyage du texte MERGED avant affichage
        merged_single_line = merged_text.replace("\n", " ").strip()
        cleaned_text = clean_merged_text(merged_single_line)
        smart_text = make_text_smart(cleaned_text)

        # 🔹 PDF TEXT MERGED (FULL CONTENT) CLEANED & SMART
        print(f"📄📄📄 PDF TEXT MERGED CLEANED & SMART (FULL CONTENT) 📄📄📄\n{smart_text}\n📄📄📄 END PDF TEXT MERGED CLEANED & SMART 📄📄📄", flush=True)

    except Exception as e:
        log(f"❌ PDF-TEXT ERROR: {e}")

# =========================
# OCR (long + END)
# =========================
def run_ocr(pdf_path: str):
    try:
        ocr_text = extract_ocr_text(pdf_path)
        filtered = filter_text(ocr_text)

        if filtered:
            for line in filtered.splitlines():
                clean = line.strip()
                if clean:
                    print(f"[OCR] {clean}", flush=True)

        # 🔹 FIN OCR
        print("[OCR-END]", flush=True)

    except Exception as e:
        log(f"❌ OCR ERROR: {e}")

# =========================
# MAIN (🔥 SANS BLOCAGE)
# =========================
def main():
    if len(sys.argv) < 2:
        log("⚠️ Aucun fichier PDF fourni")
        sys.exit(1)

    pdf_path = sys.argv[1]
    log(f"🚀 Lancement traitement parallèle pour : {pdf_path}")

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=2)

    # 🔥 Lancement indépendant
    executor.submit(run_pdf_text, pdf_path)
    executor.submit(run_ocr, pdf_path)

    # 🔥 MAINTIENT LE PROCESS VIVANT
    try:
        while True:
            time.sleep(0.1)
    except KeyboardInterrupt:
        log("🛑 Interruption manuelle")
        executor.shutdown(wait=False)

# =========================
# ENTRY POINT
# =========================
if __name__ == "__main__":
    main()
