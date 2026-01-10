# === Étape 1 : Base Node.js ===
FROM node:22

# === Étape 2 : Installer Python 3, dépendances système et Poppler ===
RUN apt-get update && \
    apt-get install -y \
        python3 python3-pip python3-dev \
        build-essential \
        libsm6 libxext6 libxrender-dev libglib2.0-0 libjpeg-dev \
        poppler-utils && \
    rm -rf /var/lib/apt/lists/*

# === Étape 3 : Définir le répertoire de travail ===
WORKDIR /usr/src/app

# === Étape 4 : Copier les fichiers de dépendances ===
COPY package*.json ./
COPY requirements.txt ./

# === Étape 5 : Installer les dépendances ===
RUN npm install

# Upgrade pip et installer les paquets Python séparément pour faciliter le debug
RUN pip3 install --upgrade pip setuptools wheel
RUN pip3 install --no-cache-dir -r requirements.txt

# === Étape 6 : Copier le reste du projet ===
COPY . .

# === Étape 7 : Créer le dossier temporaire pour OCR ===
RUN mkdir -p /tmp/uploads

# === Étape 8 : Exposer le port pour Render ===
EXPOSE 3000

# === Étape 9 : Start command ===
CMD ["node", "server.js"]
