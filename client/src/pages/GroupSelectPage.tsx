import { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

// 8种清雅配色
const GROUP_COLORS = [
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', shadow: 'rgba(102, 126, 234, 0.4)' },
  { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', shadow: 'rgba(245, 87, 108, 0.4)' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', shadow: 'rgba(79, 172, 254, 0.4)' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', shadow: 'rgba(67, 233, 123, 0.4)' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', shadow: 'rgba(250, 112, 154, 0.4)' },
  { bg: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', shadow: 'rgba(168, 237, 234, 0.4)' },
  { bg: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', shadow: 'rgba(255, 154, 158, 0.4)' },
  { bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', shadow: 'rgba(252, 182, 159, 0.4)' },
];

export default function GroupSelectPage() {
  const [groups, setGroups] = useState<api.Group[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    try {
      const grps = await api.fetchGroups();
      setGroups(grps.filter(g => g.student_count > 0));
    } catch (err) {
      console.error('加载分组失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  if (loading) {
    return (
      <div className="app">
        <div className="loading">
          <div className="spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app group-select-page">
      <div className="header">
        <h1>🎨 AI 绘画小课堂</h1>
        <p>请选择你的小组开始创作</p>
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">📋</div>
          <p>还没有导入学生名单</p>
          <p style={{ fontSize: 13, marginTop: 8 }}>请老师导入学生名单后再来</p>
        </div>
      ) : (
        <div className="group-grid">
          {groups.map((group) => {
            const color = GROUP_COLORS[(group.id - 1) % GROUP_COLORS.length];
            return (
              <button
                key={group.id}
                className="group-btn"
                style={{
                  background: color.bg,
                  boxShadow: `0 8px 32px ${color.shadow}`,
                }}
                onClick={() => window.location.hash = `#/group/${group.id}`}
              >
                <span className="group-btn-title">{group.name}</span>
                <span className="group-btn-count">{group.student_count} 人</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="footer-links">
        <a href="#/ls" className="footer-link">👩‍🏫 教师端</a>
        <a href="#/gallery" className="footer-link">🖼️ 画廊</a>
        <a href="#/settings" className="footer-link">⚙️ 设置</a>
      </div>
    </div>
  );
}
