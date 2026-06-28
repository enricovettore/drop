"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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
  const [isDesktopApp, setIsDesktopApp] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    // Lê o "RG" do navegador para saber se é o motor do Electron
    if (typeof window !== "undefined") {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes("electron")) {
        setIsDesktopApp(true);
      }
    }
  }, []);

  const handleAnalyze = async () => {
    if (!url) return;
    setIsAnalyzing(true);
    setVideoData(null);
    setLogs(["> Analisando estrutura do link..."]);

    try {
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
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
    } catch {
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

    const eventSource = new EventSource(
      `${API_BASE_URL}/api/download?url=${encodeURIComponent(url)}&format=${encodeURIComponent(selectedFormat)}&ext=${encodeURIComponent(targetExt)}`,
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
        link.href = `${API_BASE_URL}/api/file/${encodeURIComponent(filename)}`;
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
    <main className="min-h-screen bg-[#f5f5f7] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full max-w-2xl p-6 sm:p-10">
        {/* Cabeçalho com Logo Ajustada */}
        <div className="flex flex-col items-center text-center mb-7 sm:mb-8">
          <div className="flex items-center justify-center gap-2 mb-3 select-none">
            <Image
              src="/logo.png"
              alt="Drop Logo"
              width={38}
              height={38}
              className="rounded-[10px] shadow-sm"
            />
            <span className="font-extrabold text-2xl tracking-tight text-gray-900">
              Drop
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 mb-1.5">
            Baixe seus vídeos
          </h2>
          <p className="text-gray-500 text-sm">
            Cole o link para extrair e baixar o conteúdo.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <input
            type="url"
            placeholder="https://www.drop-seu-link..."
            className="flex-1 w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={isAnalyzing || isDownloading}
          />
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || isDownloading || !url}
            className="flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white font-medium text-sm w-full sm:w-auto px-6 py-3 rounded-xl transition-colors sm:min-w-[120px]"
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
          <div className="bg-gray-50 rounded-2xl p-5 sm:p-6 mb-8 border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row gap-4 mb-5">
              <Image
                src={videoData.thumbnail}
                alt="Capa"
                width={128}
                height={72}
                className="w-full sm:w-32 h-auto rounded-lg object-cover"
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
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  className="flex-1 w-full bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none disabled:opacity-50"
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
                  className="w-full sm:w-28 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none disabled:opacity-50"
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

      {/* Nova Seção: Download do App Desktop - Só aparece na Web */}
      {!isDesktopApp && (
        <div className="mt-6 text-center w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-5">
            Baixe o Drop para o seu computador
          </h2>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            {/* Botão Mac */}
            <a
              href="https://github.com/enricovettore/drop/releases/download/v1.0.0/Drop-1.0.0-arm64.dmg"
              className="flex items-center justify-center gap-3 bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md text-gray-800 font-medium text-sm w-full sm:w-[220px] py-3.5 rounded-xl transition-all cursor-pointer"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 384 512"
                fill="currentColor"
              >
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
              </svg>
              Baixar para Mac
            </a>

            {/* Botão Windows */}
            <a
              href="https://github.com/enricovettore/drop/releases/download/v1.0.0/Drop.Setup.1.0.0.exe"
              className="flex items-center justify-center gap-3 bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md text-gray-800 font-medium text-sm w-full sm:w-[220px] py-3.5 rounded-xl transition-all cursor-pointer"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 448 512"
                fill="currentColor"
              >
                <path d="M0 93.7l183.6-25.3v177.4H0V93.7zm0 324.6l183.6 25.3V268.4H0v149.9zm203.8 28L448 480V268.4H203.8v177.9zm0-380.6v180.1H448V32L203.8 65.7z" />
              </svg>
              Baixar para Windows
            </a>
          </div>
          <p className="mt-5 text-xs text-gray-400 px-4">
            A versão desktop utiliza o hardware da sua máquina, garantindo
            downloads mais rápidos e sem limites de servidores.
          </p>
        </div>
      )}
    </main>
  );
}
