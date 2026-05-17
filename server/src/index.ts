import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initDBAsync } from './db';
import { studentsRouter } from './routes/students';
import { imagesRouter } from './routes/images';
import { configRouter } from './routes/config';

const app = express();
const PORT = Number(process.env.PORT || 3001);
const BASE = '/sk/api';

app.use(cors());
app.use(express.json());

// API 路由（必须放在静态文件之前，否则会被拦截）
app.use(BASE, studentsRouter);
app.use(BASE, imagesRouter);
app.use(BASE, configRouter);

// 健康检查
app.get('/sk/api/health', (_req, res) => {
  res.json({ code: 0, message: 'ok', time: new Date().toISOString() });
});

// 静态文件服务（前端构建产物）- 放最后作为 fallback
// 兼容本地开发(client/dist)和服务器部署(client)两种路径
const clientDistPath = path.join(__dirname, '../../client/dist');
const clientPath = path.join(__dirname, '../../client');
const staticPath = fs.existsSync(clientDistPath) ? clientDistPath : clientPath;

app.use('/sk', express.static(staticPath));
app.get('/sk/*', (_req, res) => {
  const indexFile = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    res.status(404).json({ code: 1, message: 'Frontend not built' });
  }
});

export { app, PORT, BASE };

// 仅在非 Electron 环境下自动启动
if (!process.env.ELECTRON_RUN) {
  (async () => {
    await initDBAsync();
    app.listen(PORT, () => {
      console.log(`✏️ SK Server running at http://localhost:${PORT}`);
      console.log(`📚 API base: http://localhost:${PORT}${BASE}`);
    });
  })();
}
