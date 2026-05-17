/**
 * AiArtClassroom - Electron 预加载脚本
 * 暴露安全的 IPC 接口给渲染进程
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 配置管理
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (data) => ipcRenderer.invoke('config:set', data),
  },
  
  // 后端信息
  getPort: () => ipcRenderer.invoke('config:port'),
  
  // 平台信息
  platform: process.platform,
});
