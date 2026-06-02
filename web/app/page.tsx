"use client";

import { useState, useRef, useEffect } from "react";

type Format = { format_id: string; label: string };
type VideoData = {
  title: string;
  thumbnail: string;
  duration: string;
  formats: Format[];
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [selectedFormat, setSelectedFormat] = useState("");
  const [targetExt, setTargetExt] = useState("mp4");
  const [logs, setLogs] = useState<string[]>([
    "> Sistema pronto. Insira uma URL.",
  ]);

  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleAnalyze = async () => {
    if (!url) return;
    setIsAnalyzing(true);
    setVideoData(null);
    setLogs(["> Analisando estrutura do link..."]);

    try {
      const response = await fetch("http://localhost:3001/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) throw new Error("Falha.");

      const data = await response.json();
      setVideoData(data);
      if (data.formats.length > 0) {
        setSelectedFormat(data.formats[0].format_id);
        setTargetExt("mp4"); // Reseta para mp4 ao analisar novo vídeo
      }

      setLogs((prev) => [...prev, "> Análise concluída com sucesso."]);
    } catch (error) {
      setLogs((prev) => [
        ...prev,
        "> [ERRO] Falha ao analisar. Verifique a URL.",
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownload = () => {
    if (!url || !selectedFormat) return;
    setIsDownloading(true);
    setLogs(["> Acionando servidores de download..."]);

    // A string de conexão foi atualizada para incluir a extensão (targetExt)
    const eventSource = new EventSource(
      `http://localhost:3001/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(selectedFormat)}&ext=${encodeURIComponent(targetExt)}`,
    );

    eventSource.onmessage = (event) => {
      const msg = event.data;

      if (msg.startsWith("[ARQUIVO_PRONTO]")) {
        const filename = msg.replace("[ARQUIVO_PRONTO]", "").trim();
        setLogs((prev) => [
          ...prev,
          `> Transferindo "${filename}" para o seu computador...`,
        ]);

        const link = document.createElement("a");
        link.href = `http://localhost:3001/api/file/${encodeURIComponent(filename)}`;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }

      setLogs((prev) => [...prev, msg]);

      if (msg.includes("Processo finalizado")) {
        eventSource.close();
        setIsDownloading(false);
      }
    };

    eventSource.onerror = () => {
      setLogs((prev) => [...prev, "> [ERRO] Conexão interrompida."]);
      eventSource.close();
      setIsDownloading(false);
    };
  };

  return (
    <main className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-2xl p-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 mb-2">
            Drop
          </h1>
          <p className="text-gray-500 text-sm">
            Cole o link para extrair e baixar o conteúdo.
          </p>
        </div>

        <div className="flex gap-3 mb-8">
          <input
            type="url"
            placeholder="https://www.youtube.com/..."
            className="flex-1 bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isAnalyzing || isDownloading}
          />
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || isDownloading || !url}
            className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium text-sm px-6 py-3 rounded-xl transition-colors min-w-[120px]"
          >
            {isAnalyzing ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Analisando</span>
              </>
            ) : (
              "Analisar"
            )}
          </button>
        </div>

        {videoData && (
          <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex gap-4 mb-4">
              <img
                src={videoData.thumbnail}
                alt="Capa"
                className="w-32 h-auto rounded-lg object-cover"
              />
              <div className="flex flex-col justify-center overflow-hidden">
                <h3
                  className="font-medium text-gray-900 truncate"
                  title={videoData.title}
                >
                  {videoData.title}
                </h3>
                <p className="text-sm text-gray-500">
                  Duração: {videoData.duration}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <select
                  className="flex-1 bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none disabled:opacity-50"
                  value={selectedFormat}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedFormat(val);
                    if (val === "bestaudio") setTargetExt("mp3");
                    else if (targetExt === "mp3") setTargetExt("mp4");
                  }}
                  disabled={isDownloading}
                >
                  {videoData.formats.map((f) => (
                    <option key={f.format_id} value={f.format_id}>
                      {f.label}
                    </option>
                  ))}
                </select>

                <select
                  className="w-28 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none disabled:opacity-50"
                  value={targetExt}
                  onChange={(e) => setTargetExt(e.target.value)}
                  disabled={isDownloading || selectedFormat === "bestaudio"}
                >
                  {selectedFormat === "bestaudio" ? (
                    <option value="mp3">.MP3</option>
                  ) : (
                    <>
                      <option value="mp4">.MP4</option>
                      <option value="webm">.WEBM</option>
                      <option value="mkv">.MKV</option>
                    </>
                  )}
                </select>
              </div>

              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium text-sm px-5 py-3 rounded-xl transition-colors mt-2"
              >
                {isDownloading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Processando...</span>
                  </>
                ) : (
                  "Iniciar Download"
                )}
              </button>
            </div>
          </div>
        )}

        <div
          ref={terminalRef}
          className="bg-[#1e1e1e] rounded-xl p-4 h-48 overflow-y-auto scroll-smooth"
        >
          <div className="font-mono text-xs text-green-400 space-y-1">
            {logs.map((log, index) => (
              <p key={index}>{log}</p>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
