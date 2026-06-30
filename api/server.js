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

// Para o Render, usar o caminho absoluto do yt-dlp evita falhas de "command not found"
const YTDLP_BIN = "/usr/local/bin/yt-dlp";

// ==========================================
// ROTA 1: ANÁLISE
// ==========================================
app.post("/api/analyze", (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "A URL é obrigatória." });

  exec(
    `${YTDLP_BIN} --extractor-args "youtube:client=android" -J "${url}"`,
    { maxBuffer: 1024 * 1024 * 10 },
    (error, stdout, stderr) => {
      // 🔥 1. CAPTURA DO ERRO DE SISTEMA (O ASSASSINO SILENCIOSO)
      if (error) {
        console.error("🔥 ERRO FATAL DO SISTEMA AO RODAR YT-DLP:");
        console.error("Mensagem:", error.message);
        console.error("Stderr:", stderr);

        return res.status(500).json({
          error: "Falha na execução do sistema.",
          details: error.message,
          stderr: stderr,
        });
      }

      try {
        const data = JSON.parse(stdout);

        const videoFormats = data.formats.filter(
          (f) => f.vcodec !== "none" && f.resolution !== "audio only",
        );

        const uniqueResolutions = [];
        const cleanFormats = [];

        for (let i = videoFormats.length - 1; i >= 0; i--) {
          const f = videoFormats[i];
          const resIdentifier = f.height || f.resolution || "padrao";

          if (!uniqueResolutions.includes(resIdentifier)) {
            uniqueResolutions.push(resIdentifier);

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
        // 🔥 2. CAPTURA DO ERRO DE LEITURA (JSON INVÁLIDO)
        console.error("🔥 ERRO AO LER DADOS DO VÍDEO:", parseError.message);
        res.status(500).json({
          error: "Falha ao interpretar dados.",
          details: parseError.message,
        });
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

  let ytDlpArgs = ["--extractor-args", "youtube:client=android"];
  const cleanFormat =
    format && format !== "null" && format !== "undefined" ? format : null;

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

  // Usando a constante com o caminho absoluto aqui também
  const ytDlpProcess = spawn(YTDLP_BIN, ytDlpArgs);
  let finalFilename = "";

  ytDlpProcess.stdout.on("data", (data) => {
    const lines = data.toString().split("\n");
    for (let line of lines) {
      const message = line.trim();
      if (message) {
        res.write(`data: ${message}\n\n`);

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

  // Se o spawn falhar antes de iniciar (ex: não achar o executável)
  ytDlpProcess.on("error", (error) => {
    console.error("🔥 ERRO FATAL NO DOWNLOAD:", error.message);
    res.write(
      `data: [ERRO CRÍTICO]: Falha ao iniciar download no servidor.\n\n`,
    );
    res.end();
  });

  ytDlpProcess.on("close", (code) => {
    if (finalFilename) {
      const baseName = path.basename(finalFilename);
      res.write(`data: [ARQUIVO_PRONTO] ${baseName}\n\n`);
    } else if (code !== 0) {
      res.write(`data: > Processo finalizou com erros (Código: ${code}).\n\n`);
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
