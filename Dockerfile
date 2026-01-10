# === Étape 1 : Base Node.js ===
FROM node:22

# === Étape 2 : Installer Python 3, dépendances système & Poppler ===
RUN apt-get update && \
    apt-get install -y \
        python3 python3-dev \
        build-essential \
        libsm6 libxext6 libxrender-dev libglib2.0-0 libjpeg-dev \
        poppler-utils \
        ca-certificates curl && \
    rm -rf /var/lib/apt/lists/*

# === Étape 3 : Définir le répertoire de travail ===
WORKDIR /usr/src/app

# === Étape 4 : Copier les fichiers de dépendances ===
COPY package*.json ./
COPY requirements.txt ./

# === Étape 5 : Installer les dépendances Node ===
RUN npm install

# === Étape 6 : Installer les dépendances Python avec override ===
RUN python3 -m pip install --no-cache-dir --break-system-packages -r requirements.txt

# === Étape 7 : Copier le reste du projet ===
COPY . .

# === Étape 8 : Créer le dossier temporaire pour OCR ===
RUN mkdir -p /tmp/uploads

# === Étape 9 : Exposer le port pour Render ===
EXPOSE 3000

# === Étape 10 : Start command ===
CMD ["node", "server.js"]
