# ===============================
# Base image Node.js sur Debian stable (Bullseye)
# ===============================
FROM node:22-bullseye

# ===============================
# Dépendances système pour Python, OCR et PDF
# ===============================
RUN apt-get update && apt-get install -y \
    python3 \
    python3-venv \
    python3-dev \
    build-essential \
    poppler-utils \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-fra \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libglib2.0-0 \
    libjpeg-dev \
    ca-certificates \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# ===============================
# Dossier de travail
# ===============================
WORKDIR /usr/src/app

# ===============================
# Copier fichiers dépendances
# ===============================
COPY package*.json ./
COPY requirements.txt ./

# ===============================
# Installer dépendances Node
# ===============================
RUN npm install

# ===============================
# Créer virtualenv Python
# ===============================
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# ===============================
# Installer dépendances Python
# ===============================
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ===============================
# Copier le reste du projet
# ===============================
COPY . .

# ===============================
# Dossiers temporaires pour uploads/images
# ===============================
RUN mkdir -p /tmp/uploads /tmp/images

# ===============================
# Variables utiles
# ===============================
ENV PYTHONUNBUFFERED=1
ENV NODE_ENV=production

# ===============================
# Port exposé (Render)
# ===============================
EXPOSE 3000

# ===============================
# Lancement serveur Node
# ===============================
CMD ["node", "server.js"]
