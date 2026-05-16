# AiArtClassroom (AI 绘画小课堂)

一个用于学校课堂的 AI 绘画工具。教师导入学生名单，学生在平板上提交绘画请求，AI 自动生成图片并展示。

## 技术栈

- **前端**: React + Vite + MUI + Tailwind CSS
- **后端**: Express + TypeScript + better-sqlite3
- **AI 绘图**: DeepSeek + 即梦 AI (Jimeng)
- **部署**: Nginx + PM2

## 功能

- 👩‍🏫 **教师端**: 导入学生名单、查看学生作品、一键归档
- 🎒 **学生端**: 选择组别和姓名、输入提示词生成图片、管理自己的作品
- 🖼️ **画廊**: 展示所有已生成的作品

## 快速开始

### 环境要求

- Node.js 18+
- npm

### 1. 克隆项目

```bash
git clone https://github.com/your-username/AiArtClassroom.git
cd AiArtClassroom
```

### 2. 配置即梦 AI

本项目使用即梦 AI 生成图片，需要配置 sessionid：

```bash
# 方式一：环境变量（推荐）
export JIMENG_SESSIONID=your_jimeng_session_id
export JIMENG_URL=http://localhost:8001/v1/chat/completions

# 方式二：配置文件（可选）
mkdir -p ~/.sk_config
echo "your_jimeng_session_id" > ~/.sk_config/jimeng_sessionid
```

> **如何获取即梦 sessionid？**
> 1. 部署即梦 MCP 服务（参考即梦官方文档）
> 2. 或使用其他兼容的 AI 图片生成 API
> 3. sessionid 从即梦 API 的 Authorization header 获取

### 3. 本地开发

```bash
# 安装依赖
cd client && npm install
cd ../server && npm install

# 启动后端（终端1）
cd server
npm run dev

# 启动前端（终端2）
cd client
npm run dev
```

前端默认运行在 `http://localhost:5173`，后端默认运行在 `http://localhost:3001`。

### 4. 配置部署路径（可选）

默认路径前缀为 `/sk`，如需修改：

- **前端**: 修改 `client/vite.config.ts` 中的 `base` 字段
- **前端 API**: 修改 `client/src/services/api.ts` 中的 `API_BASE` 常量
- **后端**: 修改 `server/src/index.ts` 中的 `BASE` 常量（或通过环境变量）

## 部署到服务器

### 方式一：一键部署脚本

```bash
export SERVER_IP=your.server.ip
export SSH_USER=root
export SSH_PASS=your_password
export REMOTE_DIR=/var/www/ai-art-classroom
export DOMAIN=your-domain.com
bash deploy.sh
```

### 方式二：手动部署

#### 1. 构建

```bash
# 前端
cd client
npm install
npx vite build

# 后端
cd ../server
npm install
npx tsc
```

#### 2. 上传到服务器

将 `client/dist/` 和 `server/`（排除 `node_modules/`、`src/`、`data/`）上传到服务器。

#### 3. 启动后端

```bash
cd /path/to/server
npm install --production
mkdir -p data uploads
export JIMENG_SESSIONID=your_jimeng_session_id
npx pm2 start dist/index.js --name ai-art-classroom
```

#### 4. Nginx 配置

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    location / {
        root /var/www/ai-art-classroom/client;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理
    location /api {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `JIMENG_SESSIONID` | 即梦 AI sessionid（必填） | - |
| `JIMENG_URL` | 即梦 API 地址 | `http://localhost:8001/v1/chat/completions` |
| `PORT` | 后端服务端口 | `3001` |

## 项目结构

```
AiArtClassroom/
├── client/                # 前端 React 应用
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── services/      # API 调用层
│   │   └── App.tsx        # 路由配置
│   └── vite.config.ts
├── server/                # 后端 Express 服务
│   ├── src/
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 即梦等外部服务调用
│   │   ├── db.ts          # 数据库初始化
│   │   └── index.ts       # 入口
│   └── package.json
├── deploy.sh              # 部署脚本
├── PRD.md                 # 产品需求文档
└── README.md
```

## 截图

![Teacher View](/screenshots/teacher.png)
![Student View](/screenshots/student.png)
![Gallery View](/screenshots/gallery.png)

## License

MIT
