# Usa uma imagem oficial do Node.js levíssima
FROM node:20-slim

# Instala o FFmpeg, Python (para o yt-dlp) e o curl
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Baixa o yt-dlp e dá permissão de execução
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Define a pasta de trabalho principal
WORKDIR /app

# Copia apenas os arquivos de dependência da pasta api
COPY api/package*.json ./

# Instala as dependências
RUN npm install

# Copia todo o restante do código que está dentro da pasta api
COPY api/ .

# Expõe a porta
EXPOSE 3001

# Comando de inicialização
CMD ["node", "server.js"]