const express = require("express");
const cors = require("cors");
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
app.use(cors());
app.use(express.json());

// Descobre automaticamente a pasta raiz de Downloads do seu computador
const downloadsFolder = path.join(os.homedir(), "Downloads");

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

  res.setHeader("Content-Type", "text-event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.write(`data: > Iniciando processamento local...\n\n`);

  // Define o caminho final do arquivo direto na pasta Downloads do sistema
  const outputPath = path.join(downloadsFolder, "%(title)s.%(ext)s");

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

  ytDlpProcess.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (let line of lines) {
      const message = line.trim();
      if (message) {
        res.write(`data: ${message}\n\n`);
      }
    }
  });

  ytDlpProcess.stderr.on("data", (data) => {
    const errorMsg = data.toString().trim();
    if (errorMsg) res.write(`data: [AVISO/ERRO]: ${errorMsg}\n\n`);
  });

  ytDlpProcess.on("close", (code) => {
    if (code === 0) {
      res.write(
        `data: > ✨ Vídeo salvo com sucesso na sua pasta Downloads!\n\n`,
      );
      res.write(`data: Processo finalizado\n\n`);
    } else {
      res.write(`data: > [ERRO] Falha no processamento (Código ${code}).\n\n`);
      res.write(`data: Processo finalizado\n\n`);
    }
    res.end();
  });
});

app.listen(3001, () => console.log(`Servidor local rodando na porta 3001 🚀`));
