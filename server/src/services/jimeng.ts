import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const JIMENG_URL = process.env.JIMENG_URL || 'http://localhost:8001/v1/chat/completions';

// 从环境变量或配置文件读取 sessionid
function getSessionId(): string {
  // 优先从环境变量读取
  const envSessionId = process.env.JIMENG_SESSIONID;
  if (envSessionId) return envSessionId;

  // 从配置文件读取
  const configPaths = [
    '/root/.sk_config/jimeng_sessionid',
    '/home/ubuntu/.sk_config/jimeng_sessionid',
    path.join(process.env.HOME || '', '.sk_config/jimeng_sessionid'),
    // Electron 桌面版配置（从浏览器 F12 获取后保存）
    path.join(process.env.HOME || '', '.ai-art-classroom/config.json'),
  ];

  for (const p of configPaths) {
    try {
      if (fs.existsSync(p)) {
        // .json 文件是结构化配置
        if (p.endsWith('.json')) {
          const config = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (config.jimeng_sessionid) return config.jimeng_sessionid;
        } else {
          return fs.readFileSync(p, 'utf-8').trim();
        }
      }
    } catch {}
  }

  throw new Error('无法读取即梦 sessionid，请在设置页面配置或设置 JIMENG_SESSIONID 环境变量');
}

/**
 * 调用即梦 API 生成图片
 * @param prompt 中文提示词
 * @returns 图片 URL 数组
 */
export async function generateImage(prompt: string): Promise<string[]> {
  const sessionId = getSessionId();

  // 在服务器本地调用即梦 API
  const cmd = `curl -s -X POST '${JIMENG_URL}' \
    -H 'Authorization: Bearer ${sessionId}' \
    -H 'Content-Type: application/json' \
    -d '${escapeJson(prompt)}' 2>&1`;

  try {
    const output = execSync(cmd, { timeout: 120000, encoding: 'utf-8' });

    // 解析 JSON 返回
    const result = JSON.parse(output);

    if (result.error) {
      throw new Error(`即梦 API 错误: ${JSON.stringify(result.error)}`);
    }

    const content = result.choices?.[0]?.message?.content || '';

    // 提取所有图片 URL
    const urls = extractImageUrls(content);
    return urls;
  } catch (err: any) {
    throw new Error(`即梦 API 调用失败: ${err.message}`);
  }
}

function escapeJson(prompt: string): string {
  const escaped = JSON.stringify({
    model: "jimeng-4.0",
    messages: [{ role: "user", content: prompt.substring(0, 500) }]
  });
  return escaped;
}

function extractImageUrls(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s)"']+\.(?:png|jpg|jpeg|gif|webp)[^\s)"']*/gi;
  const matches = content.match(urlRegex);
  return matches || [];
}

export async function downloadImage(url: string, savePath: string): Promise<string> {
  const cmd = `curl -sS -L -o "${savePath}" "${url}"`;
  execSync(cmd, { timeout: 30000 });
  return savePath;
}
