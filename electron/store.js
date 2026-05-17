/**
 * 配置管理 - 存储 Jimeng sessionid 等用户配置
 * 配置文件存储在用户目录下 ~/.ai-art-classroom/config.json
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_DIR = path.join(app ? app.getPath('home') : (process.env.HOME || '/tmp'), '.ai-art-classroom');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('读取配置文件失败:', e.message);
  }
  return {};
}

function saveConfig(data) {
  ensureConfigDir();
  const current = loadConfig();
  Object.assign(current, data);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(current, null, 2), 'utf-8');
  return current;
}

module.exports = { loadConfig, saveConfig };
