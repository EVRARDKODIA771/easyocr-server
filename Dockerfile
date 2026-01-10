# === Étape 1 : Base Node.js ===
FROM node:22

# === Étape 2 : Installer Python 3 et Poppler ===
RUN apt-get update && \
    apt-get install -y python3 python3-pip poppler-utils && \
    rm -rf /var/lib/apt/lists/*

# === Étape 3 : Définir le répertoire de travail ===
WORKDIR /usr/src/app

# === Étape 4 : Copier les fichiers de dépendances ===
COPY package*.json ./
COPY requirements.txt ./

# === Étape 5 : Installer les dépendances ===
RUN npm install
RUN pip3 install -r requirements.txt

# === Étape 6 : Copier le reste du projet ===
COPY . .

# === Étape 7 : Créer le dossier temporaire pour OCR ===
RUN mkdir -p /tmp/uploads

# === Étape 8 : Exposer le port pour Render ===
EXPOSE 3000

# === Étape 9 : Start command ===
CMD ["node", "server.js"]
