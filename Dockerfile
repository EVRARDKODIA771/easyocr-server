# === Étape 1 : Base Node.js ===
FROM node:22

# === Étape 2 : Installer Python 3, dépendances système et Poppler ===
RUN apt-get update && \
    apt-get install -y \
        python3 python3-dev \
        python3-venv \
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

# === Étape 5 : Installer les dépendances ===
RUN npm install

# Installer pip et packages Python sans utiliser directement "pip3 install --upgrade pip"
RUN python3 -m ensurepip --upgrade
RUN python3 -m pip install --no-cache-dir --upgrade setuptools wheel
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# === Étape 6 : Copier le reste du projet ===
COPY . .

# === Étape 7 : Créer le dossier temporaire pour OCR ===
RUN mkdir -p /tmp/uploads

# === Étape 8 : Exposer le port pour Render ===
EXPOSE 3000

# === Étape 9 : Start command ===
CMD ["node", "server.js"]
