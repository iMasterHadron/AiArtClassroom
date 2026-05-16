import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../services/api';
import * as XLSX from 'xlsx';

export default function TeacherPage() {
  const [images, setImages] = useState<api.ImageRecord[]>([]);
  const [groups, setGroups] = useState<api.Group[]>([]);
  const [filterGroup, setFilterGroup] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [archiving, setArchiving] = useState(false);
  const [archives, setArchives] = useState<api.Archive[]>([]);
  const [showArchives, setShowArchives] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [imgList, grpList] = await Promise.all([
        api.fetchImages(filterGroup),
        api.fetchGroups(),
      ]);
      setImages(imgList);
      setGroups(grpList);
      setError('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterGroup]);

  useEffect(() => { loadData(); }, [loadData]);

  // 定时刷新（每10秒）
  useEffect(() => {
    const timer = setInterval(loadData, 10000);
    return () => clearInterval(timer);
  }, [loadData]);

  // 上传 Excel
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const result = await api.uploadExcel(file);
      alert(`导入成功！共 ${result.total} 名学生`);
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 下载模板
  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    const names = [
      '张伟', '李娜', '王芳', '刘洋', '陈静',
      '杨明', '赵丽', '黄强', '周涛', '吴敏',
      '徐婷', '孙杰', '马超', '朱琳', '胡鹏',
      '郭倩', '何欢', '林峰', '高建', '罗晨',
      '梁雨', '宋佳', '郑浩', '谢军', '韩冰',
      '唐博', '冯雪', '于涛', '董瑶', '萧强',
      '程亮', '曹娟', '袁媛', '彭飞', '许倩',
      '傅勇', '沈英', '曾伟', '卢洁', '潘晨',
    ];
    const data = names.map((name, i) => ({
      姓名: name,
      组别: `第${Math.floor(i / 5) + 1}组`,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, '学生名单');
    XLSX.writeFile(wb, '学生名单模板.xlsx');
  };

  // 一键归档
  const handleArchive = async () => {
    if (images.length === 0) {
      alert('当前没有作品可归档');
      return;
    }
    if (!confirm(`确定要归档当前 ${images.length} 张作品吗？`)) return;

    setArchiving(true);
    try {
      const result = await api.createArchive();
      alert(`归档成功！${result.name}，共 ${result.count} 张图片`);
      // 刷新归档列表
      const archiveList = await api.fetchArchives();
      setArchives(archiveList);
    } catch (err: any) {
      alert('归档失败: ' + err.message);
    } finally {
      setArchiving(false);
    }
  };

  // 查看归档列表
  const handleShowArchives = async () => {
    setShowArchives(!showArchives);
    if (!showArchives) {
      try {
        const list = await api.fetchArchives();
        setArchives(list);
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  // 按学生分组展示
  const groupedByStudent = images.reduce<Record<string, api.ImageRecord[]>>((acc, img) => {
    const key = `${img.student_name}(${img.group_name})`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(img);
    return acc;
  }, {});

  // 只展示每个学生的最新一张
  const latestImages = Object.values(groupedByStudent).map(imgs => imgs[0]);

  // 如果每组有筛选，只显示该组最新
  const displayImages = filterGroup
    ? latestImages.filter(img => img.group_id === filterGroup)
    : latestImages;

  return (
    <div className="app">
      <div className="teacher-header">
        <h1>👩‍🏫 教师管理端</h1>
        <div className="teacher-actions">
          <a href="#/gallery" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
            📺 画廊展示
          </a>
          <button className="btn btn-outline" onClick={downloadTemplate}>
            📥 下载模板
          </button>
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            {uploading ? '⏳ 导入中...' : '📤 导入名单'}
          </button>
          <button className="btn btn-warning" onClick={handleArchive} disabled={archiving}>
            {archiving ? '⏳ 归档中...' : '📦 一键归档'}
          </button>
          <button className="btn btn-outline" onClick={handleShowArchives}>
            {showArchives ? '🔙 返回作品' : '📂 查看归档'}
          </button>
          <button className="btn btn-outline" onClick={loadData}>
            🔄 刷新
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <a href="#/" className="btn btn-outline" style={{ textDecoration: 'none' }}>
            🏠 学生端
          </a>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: 12, marginBottom: 16, fontSize: 14 }}>
          ❌ {error}
        </div>
      )}

      {/* 归档列表视图 */}
      {showArchives ? (
        <div className="archives-list" style={{ padding: '0 16px' }}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>📂 归档记录</h2>
          {archives.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">📂</div>
              <p>暂无归档记录</p>
            </div>
          ) : (
            <div className="archive-grid" style={{ display: 'grid', gap: 12 }}>
              {archives.map(archive => (
                <div
                  key={archive.id}
                  className="archive-card"
                  style={{
                    background: 'white',
                    borderRadius: 12,
                    padding: 16,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{archive.name}</div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    归档时间: {new Date(archive.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* 筛选 */}
          <div className="filter-bar">
            <button className={`filter-btn ${!filterGroup ? 'active' : ''}`} onClick={() => setFilterGroup(undefined)}>
              全部
            </button>
            {groups.map(g => (
              <button
                key={g.id}
                className={`filter-btn ${filterGroup === g.id ? 'active' : ''}`}
                onClick={() => setFilterGroup(g.id)}
              >
                {g.name}({g.student_count})
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loading"><div className="spinner"></div><p>加载中...</p></div>
          ) : displayImages.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🎨</div>
              <p>还没有学生生成图片</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>导入名单后，学生在学生端生成图片就会显示在这里</p>
            </div>
          ) : (
            <div className="gallery-grid">
              {displayImages.map(img => (
                <div key={img.id} className="image-card">
                  <img src={img.image_url} alt={img.prompt} loading="lazy" />
                  <div className="image-info">
                    <div className="student-name">
                      {img.student_name}
                      <span style={{ fontWeight: 400, color: 'var(--text-light)', marginLeft: 6, fontSize: 12 }}>
                        {img.group_name}
                      </span>
                    </div>
                    <div className="prompt-text">💬 {img.prompt}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
