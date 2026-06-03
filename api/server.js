const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir);
}

// ==========================================
// ROTA 1: ANÁLISE
// ==========================================
app.post("/api/analyze", (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "A URL é obrigatória." });

  exec(
    `yt-dlp --extractor-args "youtube:client=android" -J "${url}"`,
    { maxBuffer: 1024 * 1024 * 10 },
    (error, stdout, stderr) => {
      if (error) return res.status(500).json({ error: "Falha ao analisar." });

      try {
        const data = JSON.parse(stdout);

        // Filtro mais permissivo: rejeita apenas o que é explicitamente "sem vídeo" ou "audio only"
        const videoFormats = data.formats.filter(
          (f) => f.vcodec !== "none" && f.resolution !== "audio only",
        );

        const uniqueResolutions = [];
        const cleanFormats = [];

        for (let i = videoFormats.length - 1; i >= 0; i--) {
          const f = videoFormats[i];

          // Se o site não informar a altura, usamos a própria resolução ou um padrão
          const resIdentifier = f.height || f.resolution || "padrao";

          if (!uniqueResolutions.includes(resIdentifier)) {
            uniqueResolutions.push(resIdentifier);

            // Monta o rótulo de forma inteligente
            const labelName = f.height
              ? `${f.height}p`
              : f.resolution !== "audio only"
                ? f.resolution
                : "Vídeo";
            const fpsName = f.fps ? ` (${f.fps}fps)` : "";

            cleanFormats.push({
              format_id: `${f.format_id}+bestaudio`,
              label: `${labelName}${fpsName}`,
            });
          }
        }

        cleanFormats.push({ format_id: "bestaudio", label: "Apenas Áudio" });

        res.json({
          title: data.title,
          thumbnail: data.thumbnail,
          duration: data.duration_string,
          formats: cleanFormats,
        });
      } catch (parseError) {
        res.status(500).json({ error: "Erro ao processar dados." });
      }
    },
  );
});

// ==========================================
// ROTA 2: DOWNLOAD VIA TERMINAL (SSE)
// ==========================================
app.get("/api/download", (req, res) => {
  const { url: videoUrl, format = "best", ext = "mp4" } = req.query;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write(`data: > Iniciando processo na nuvem...\n\n`);

  const outputPath = path.join(downloadsDir, "%(title)s.%(ext)s");

  // Lógica inteligente de argumentos para o yt-dlp COM disfarce de Android e Fallback
  let ytDlpArgs = ["--extractor-args", "youtube:client=android"];

  // 1. Limpamos o formato (se vier 'null', 'undefined' ou vazio, tratamos como falso)
  const cleanFormat =
    format && format !== "null" && format !== "undefined" ? format : null;

  // 2. Criamos a regra de Fallback (O plano A falhou? Vai pro plano B ou C)
  let formatQuery;
  if (ext === "mp3") {
    formatQuery = cleanFormat
      ? `${cleanFormat}/bestaudio/best`
      : "bestaudio/best";
  } else {
    formatQuery = cleanFormat
      ? `${cleanFormat}/bestvideo+bestaudio/best`
      : "bestvideo+bestaudio/best";
  }

  // 3. Injetamos os argumentos finais
  if (ext === "mp3") {
    ytDlpArgs.push(
      "-f",
      formatQuery,
      "--extract-audio",
      "--audio-format",
      "mp3",
      "-o",
      outputPath,
      videoUrl,
    );
  } else {
    ytDlpArgs.push(
      "-f",
      formatQuery,
      "--merge-output-format",
      ext,
      "--remux-video",
      ext,
      "-o",
      outputPath,
      videoUrl,
    );
  }

  const ytDlpProcess = spawn("yt-dlp", ytDlpArgs);
  let finalFilename = "";

  ytDlpProcess.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (let line of lines) {
      const message = line.trim();
      if (message) {
        res.write(`data: ${message}\n\n`);

        // Captura blindada do nome do arquivo final
        if (message.includes("Destination:")) {
          finalFilename = message.split("Destination:")[1].trim();
        } else if (message.includes("Merging formats into")) {
          const match = message.match(/"([^"]+)"/);
          if (match) finalFilename = match[1];
        } else if (message.includes("has already been downloaded")) {
          finalFilename = message
            .replace(/\[download\]/g, "")
            .replace("has already been downloaded", "")
            .trim();
        }
      }
    }
  });

  ytDlpProcess.stderr.on("data", (data) => {
    const errorMsg = data.toString().trim();
    if (errorMsg) res.write(`data: [AVISO/ERRO]: ${errorMsg}\n\n`);
  });

  ytDlpProcess.on("close", (code) => {
    if (finalFilename) {
      const baseName = path.basename(finalFilename);
      res.write(`data: [ARQUIVO_PRONTO] ${baseName}\n\n`);
    }
    res.write(`data: > Processo finalizado no servidor.\n\n`);
    res.end();
  });
});

// ==========================================
// ROTA 3: TRANSFERÊNCIA
// ==========================================
app.get("/api/file/:filename", (req, res) => {
  const filepath = path.join(downloadsDir, req.params.filename);

  if (fs.existsSync(filepath)) {
    res.download(filepath, (err) => {
      if (err) {
        console.error("Erro ao enviar o arquivo:", err);
      }
      // Independente de dar erro ou sucesso no envio, apaga o arquivo do servidor
      fs.unlink(filepath, (unlinkErr) => {
        if (unlinkErr)
          console.error("Erro ao apagar arquivo temporário:", unlinkErr);
        else console.log(`Arquivo limpo do servidor: ${req.params.filename}`);
      });
    });
  } else {
    res.status(404).send("Arquivo não encontrado.");
  }
});

app.listen(3001, () => console.log(`Servidor rodando na porta 3001 🚀`));
