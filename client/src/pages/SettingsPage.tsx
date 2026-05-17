import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [sessionId, setSessionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // 检测是否为 Electron 环境
    setIsElectron(!!(window as any).electronAPI);
    // 加载当前 sessionid 状态
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/sk/api/config');
      const data = await res.json();
      if (data.code === 0) {
        if (data.data.jimeng_sessionid_configured) {
          setMessage('✅ 已配置 sessionid');
          setMessageType('success');
        } else {
          setMessage('❌ 未配置 sessionid');
          setMessageType('error');
        }
      }
    } catch (e) {
      // 忽略
    }
  };

  const handleSave = async () => {
    if (!sessionId.trim()) {
      setMessage('请输入 sessionid');
      setMessageType('error');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/sk/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jimeng_sessionid: sessionId.trim() }),
      });
      const data = await res.json();

      if (data.code === 0) {
        setMessage('✅ sessionid 已保存！');
        setMessageType('success');
        setSessionId('');
      } else {
        setMessage('❌ ' + data.message);
        setMessageType('error');
      }
    } catch (err: any) {
      setMessage('❌ 保存失败: ' + err.message);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="app">
      <div className="teacher-header">
        <h1>⚙️ 设置</h1>
        <div className="teacher-actions">
          <a href="#/" className="btn btn-outline" style={{ textDecoration: 'none' }}>
            🏠 返回首页
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: 24 }}>
        {/* 即梦配置 */}
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          marginBottom: 16,
        }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>🎨 即梦 AI 配置</h2>
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
            本工具使用即梦 AI 生成图片，需要在浏览器中登录即梦后，从开发者工具中获取 sessionid。
          </p>

          {/* 获取方式 */}
          <div style={{
            background: '#f0f9ff',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            border: '1px solid #bae6fd',
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>📖 获取步骤</div>
            <ol style={{ fontSize: 13, color: '#334155', lineHeight: 2, paddingLeft: 20, margin: 0 }}>
              <li>在浏览器中打开并登录 <strong>即梦 AI</strong> 网站</li>
              <li>按 <kbd style={{ background: '#e2e8f0', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>F12</kbd> 打开开发者工具</li>
              <li>切换到 <strong>Network（网络）</strong> 标签页</li>
              <li>刷新页面，找到一个请求到即梦 API 的请求</li>
              <li>在请求头中找到 <code>Authorization</code> 字段</li>
              <li>复制 <code>Bearer xxxxxx</code> 中的 <code>xxxxxx</code> 部分</li>
              <li>粘贴到下面的输入框中并保存</li>
            </ol>
          </div>

          {/* 状态提示 */}
          {message && (
            <div style={{
              background: messageType === 'success' ? '#f0fdf4' : '#fef2f2',
              color: messageType === 'success' ? '#16a34a' : '#dc2626',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
              marginBottom: 12,
            }}>
              {message}
            </div>
          )}

          {/* 输入框 */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 14, fontWeight: 500, display: 'block', marginBottom: 6 }}>
              Jimeng SessionID
            </label>
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              placeholder="粘贴从 F12 获取的 sessionid..."
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 14,
                fontFamily: 'monospace',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? '⏳ 保存中...' : '💾 保存'}
          </button>
        </div>

        {/* 关于 */}
        <div style={{
          background: 'white',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>ℹ️ 关于</h2>
          <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.8 }}>
            <p>AI 绘画小课堂 v1.0.0</p>
            <p>技术栈: React + Express + SQLite + 即梦 AI</p>
            {isElectron && <p>运行模式: 桌面应用</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
