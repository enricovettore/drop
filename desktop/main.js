const { app, BrowserWindow } = require("electron");
const path = require("path");
// Liga o servidor local em segundo plano
require("./server.js");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    titleBarStyle: "hidden", // Estética limpa, estilo Mac
    trafficLightPosition: { x: 15, y: 15 }, // Posição dos botões de fechar/minimizar
    backgroundColor: "#f5f5f7", // Fundo padrão do seu app
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));
}

// Quando o sistema estiver pronto, abre a janela
app.whenReady().then(() => {
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Encerra o processo quando fechar a janela (padrão de apps)
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
