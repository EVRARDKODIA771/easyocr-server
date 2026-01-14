# === Base image Node ===
FROM node:22

# === Installer dépendances système pour Python & OCR ===
RUN apt-get update && apt-get install -y \
    python3 python3-venv python3-dev \
    build-essential \
    libsm6 libxext6 libxrender-dev libglib2.0-0 libjpeg-dev \
    poppler-utils \
    tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng \
    ca-certificates curl wget && \
    rm -rf /var/lib/apt/lists/*

# === Répertoire de travail ===
WORKDIR /usr/src/app

# === Copier les fichiers de dépendances ===
COPY package*.json ./
COPY requirements.txt ./

# === Installer dépendances Node ===
RUN npm install

# === Créer & activer un virtualenv Python ===
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# === Installer seulement les dépendances Python nécessaires (pytesseract, Pillow, requests) ===
RUN pip install --no-cache-dir -r requirements.txt

# === Copier le code du projet ===
COPY . .

# === Créer le dossier temporaire OCR ===
RUN mkdir -p /tmp/uploads

# === Exposer le port Node ===
EXPOSE 3000

# === Démarrer le serveur Node.js ===
CMD ["node", "server.js"]
