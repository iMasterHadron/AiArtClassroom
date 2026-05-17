/**
 * AiArtClassroom - Electron 主进程
 * 启动 Express 后端服务，然后打开前端窗口
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { loadConfig, saveConfig } = require('./store');

let mainWindow = null;
let server = null;

// 后端端口
const PORT = 3002;

function startServer() {
  return new Promise((resolve, reject) => {
    try {
      // 导入 Express 服务
      const serverApp = require(path.join(__dirname, '../server/dist/index.js')).default;
      
      server = serverApp.listen(PORT, '127.0.0.1', () => {
        console.log(`✅ 后端服务已启动: http://127.0.0.1:${PORT}`);
        resolve();
      });
      
      server.on('error', (err) => {
        console.error('❌ 后端服务启动失败:', err.message);
        reject(err);
      });
    } catch (err) {
      console.error('❌ 导入后端模块失败:', err);
      reject(err);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AI 绘画小课堂',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
  });
  });

  // 加载前端页面
  mainWindow.loadURL(`http://127.0.0.1:${PORT}/sk/`);

  // 开发模式下打开 DevTools
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC 处理：获取配置
ipcMain.handle('config:get', () => {
  return loadConfig();
});

// IPC 处理：保存配置
ipcMain.handle('config:set', (_event, data) => {
  return saveConfig(data);
});

// IPC 处理：获取后端端口
ipcMain.handle('config:port', () => {
  return PORT;
});

// IPC 处理：重启后端（sessionid 更新后需要）
ipcMain.handle('server:restart', () => {
  return { success: true };
});

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
    
    // macOS 点击 Dock 图标重新打开窗口
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (err) {
    console.error('启动失败:', err);
    app.quit();
  }
});

// 所有窗口关闭时退出（除了 macOS）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});
