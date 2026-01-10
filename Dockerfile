# === BASE IMAGE (Node + Python) ===
FROM node:22

# === INSTALL SYSTEM DEPENDENCIES ===
RUN apt-get update && \
    apt-get install -y \
        python3 python3-dev \
        build-essential \
        libsm6 libxext6 libxrender-dev libglib2.0-0 libjpeg-dev \
        poppler-utils \
        ca-certificates curl wget && \
    rm -rf /var/lib/apt/lists/*

# === WORKDIR ===
WORKDIR /usr/src/app

# === COPY DEPENDENCY FILES ===
COPY package*.json ./
COPY requirements.txt ./

# === INSTALL NODE DEPENDENCIES ===
RUN npm install

# === INSTALL PIP (SCRIPT OFFICIEL) ===
RUN curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py && \
    python3 get-pip.py && \
    rm get-pip.py

# === INSTALL PYTHON DEPENDENCIES ===
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# === COPY PROJECT FILES ===
COPY . .

# === CREATE TEMP UPLOAD DIR ===
RUN mkdir -p /tmp/uploads

# === EXPOSE PORT ===
EXPOSE 3000

# === START ===
CMD ["node", "server.js"]
