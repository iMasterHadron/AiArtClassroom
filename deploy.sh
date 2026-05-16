#!/bin/bash
# ============================================
#  AiArtClassroom - 部署脚本
#  用法:
#    export SERVER_IP=your.server.ip
#    export SSH_USER=root
#    export SSH_PASS=your_password
#    export REMOTE_DIR=/var/www/ai-art-classroom
#    export DOMAIN=your-domain.com
#    export API_PORT=3002
#    bash deploy.sh
# ============================================

set -e

SERVER_IP="${SERVER_IP:?请设置 SERVER_IP 环境变量}"
SSH_USER="${SSH_USER:-root}"
SSH_PASS="${SSH_PASS:?请设置 SSH_PASS 环境变量}"
REMOTE_DIR="${REMOTE_DIR:-/var/www/ai-art-classroom}"
DOMAIN="${DOMAIN:-your-domain.com}"
API_PORT="${API_PORT:-3002}"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🚀 开始部署 AiArtClassroom..."

# 1. 安装前端依赖并构建
echo "📦 安装前端依赖..."
cd "$LOCAL_DIR/client"
npm install

echo "🔨 构建前端..."
npx vite build

# 2. 安装后端依赖并编译
echo "📦 安装后端依赖..."
cd "$LOCAL_DIR/server"
npm install

echo "🔨 编译后端..."
npx tsc

# 3. 上传到服务器
echo "📤 上传到服务器..."

SSH_CMD="sshpass -p $SSH_PASS ssh -o StrictHostKeyChecking=no $SSH_USER@$SERVER_IP"
RSYNC_CMD="sshpass -p $SSH_PASS rsync -avz --delete -e 'ssh -o StrictHostKeyChecking=no'"

# 创建远程目录
$SSH_CMD "mkdir -p $REMOTE_DIR/client $REMOTE_DIR/server"

# 上传前端构建产物
echo "   → 上传前端..."
$SSH_CMD "mkdir -p $REMOTE_DIR/client"
sshpass -p "$SSH_PASS" rsync -avz --delete \
  -e 'ssh -o StrictHostKeyChecking=no' \
  "$LOCAL_DIR/client/dist/" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/client/"

# 上传后端（排除数据库文件，防止覆盖生产数据）
echo "   → 上传后端..."
sshpass -p "$SSH_PASS" rsync -avz --delete \
  --exclude 'node_modules' --exclude 'src' \
  --exclude 'data/*.db' --exclude 'data/*.db-*' --exclude 'data/*.db-shm' --exclude 'data/*.db-wal' \
  -e 'ssh -o StrictHostKeyChecking=no' \
  "$LOCAL_DIR/server/" "$SSH_USER@$SERVER_IP:$REMOTE_DIR/server/"

# 4. 在服务器上安装后端依赖并启动
echo "⚙️ 配置后端服务..."
$SSH_CMD "
  cd $REMOTE_DIR/server
  npm install --production
  mkdir -p data uploads

  # 如果 PM2 进程存在则重启
  if pm2 list | grep -q ai-art-classroom; then
    pm2 restart ai-art-classroom
  else
    pm2 start dist/index.js --name ai-art-classroom
  fi
  pm2 save
"

# 5. 配置 Nginx（可选，仅第一次需要）
echo "🔧 配置 Nginx...（跳过请设置 SKIP_NGINX=1）"
if [ -z "$SKIP_NGINX" ]; then
  $SSH_CMD "
    sudo tee /etc/nginx/sites-enabled/$DOMAIN.conf > /dev/null << 'NGINX_CONF'
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        root $REMOTE_DIR/client;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
    }
}
NGINX_CONF
    sudo nginx -t && sudo nginx -s reload
  "
fi

echo ""
echo "✅ 部署完成！"
echo "🌐 访问地址: http://$DOMAIN"
echo ""
echo "📖 更多配置请参考 README.md"
