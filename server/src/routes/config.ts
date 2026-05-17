/**
 * 配置 API - 管理 Jimeng sessionid 等运行配置
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

const CONFIG_DIR = path.join(process.env.HOME || '/tmp', '.ai-art-classroom');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadConfig(): Record<string, any> {
  try {
    ensureConfigDir();
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('读取配置失败:', (e as Error).message);
  }
  return {};
}

// GET /config - 读取配置
router.get('/config', (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    res.json({
      code: 0,
      data: {
        // 返回配置，但屏蔽敏感信息的部分内容
        jimeng_sessionid_configured: !!config.jimeng_sessionid,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// POST /config - 保存配置
router.post('/config', (req: Request, res: Response) => {
  try {
    const { jimeng_sessionid } = req.body;
    if (!jimeng_sessionid) {
      res.status(400).json({ code: 1, message: '请提供 jimeng_sessionid' });
      return;
    }

    ensureConfigDir();
    const config = loadConfig();
    config.jimeng_sessionid = jimeng_sessionid;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');

    // 更新环境变量，让后续请求使用新的 sessionid
    process.env.JIMENG_SESSIONID = jimeng_sessionid;

    res.json({ code: 0, message: '配置已保存' });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

export { router as configRouter };
