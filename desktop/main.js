const { app, BrowserWindow, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");
// Liga o servidor local em segundo plano
require("./server.js");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    icon: path.join(__dirname, "build/icon.png"),
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

  // Aciona a busca por atualizações no GitHub assim que o app abre
  autoUpdater.checkForUpdatesAndNotify();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Encerra o processo quando fechar a janela (padrão de apps)
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

// ==========================================
// AUTO-UPDATE: Alerta de nova versão
// ==========================================
autoUpdater.on("update-downloaded", () => {
  dialog
    .showMessageBox({
      type: "info",
      title: "Atualização Pronta",
      message:
        "Uma nova versão do Drop foi baixada. O aplicativo será reiniciado para instalar a atualização automaticamente.",
      buttons: ["Reiniciar e Atualizar"],
    })
    .then(() => {
      setImmediate(() => autoUpdater.quitAndInstall());
    });
});
