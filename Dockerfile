# Usa uma imagem oficial do Node.js levíssima como base
FROM node:20-slim

# Instala o FFmpeg, Python (necessário para o yt-dlp) e o curl
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Baixa a versão oficial e mais recente do yt-dlp e dá permissão de execução
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Define a pasta de trabalho dentro do servidor
WORKDIR /app

# Copia os arquivos de configuração do Node
COPY package*.json ./

# Instala as dependências (express, cors)
RUN npm install

# Copia todo o restante do seu código (server.js, etc)
COPY . .

# Expõe a porta que a nossa API usa
EXPOSE 3001

# Comando que o servidor vai rodar para acordar a API
CMD ["node", "server.js"]