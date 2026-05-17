/**
 * AiArtClassroom - Electron 主进程
 * 启动 Express 后端服务，然后打开前端窗口
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadConfig, saveConfig } = require('./store');

const APP_VERSION = require('../package.json').version;

// 错误日志写入文件
const LOG_PATH = path.join(app.getPath('home'), '.ai-art-classroom', 'app.log');
function log(msg) {
  try {
    const dir = path.dirname(LOG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] [v${APP_VERSION}] ${msg}\n`);
  } catch(e) {}
}
log('=== App started ===');
log('version: ' + APP_VERSION);
log('__dirname: ' + __dirname);
log('cwd: ' + process.cwd());

let mainWindow = null;
let server = null;

// 后端端口
const PORT = 3002;

async function startServer() {
  log('Starting server...');
  // 1. 先初始化数据库（sql.js 异步加载）
  try {
    log('Loading db module...');
    const { initDBAsync } = require(path.join(__dirname, '../server/dist/db.js'));
    log('Calling initDBAsync...');
    await initDBAsync();
    log('DB initialized OK');
  } catch (dbErr) {
    log('DB init failed: ' + (dbErr.stack || dbErr.message));
    throw dbErr;
  }

  // 2. 启动 Express
  log('Loading server module...');
  let serverModule, serverApp;
  try {
    serverModule = require(path.join(__dirname, '../server/dist/index.js'));
    log('Server module loaded, keys: ' + Object.keys(serverModule).join(', '));
    serverApp = serverModule.app;
    log('Express app obtained');
  } catch (srvErr) {
    log('Server module load failed: ' + (srvErr.stack || srvErr.message));
    throw srvErr;
  }

  return new Promise((resolve, reject) => {
    try {
      server = serverApp.listen(PORT, '127.0.0.1', () => {
        log(`✅ Server started on port ${PORT}`);
        console.log(`✅ 后端服务已启动: http://127.0.0.1:${PORT}`);
        resolve();
      });

      server.on('error', (err) => {
        log('Server listen error: ' + err.message);
        console.error('❌ 后端服务启动失败:', err.message);
        reject(err);
      });
    } catch (err) {
      log('Server start catch: ' + (err.stack || err.message));
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
    title: `AI 绘画小课堂 v${APP_VERSION}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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
