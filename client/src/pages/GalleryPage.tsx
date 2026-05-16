import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../services/api';
import { ImageRecord } from '../services/api';

// 8种清雅配色
const GROUP_COLORS = [
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#667eea' },
  { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', text: '#f5576c' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', text: '#4facfe' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', text: '#22c55e' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', text: '#f59e0b' },
  { bg: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', text: '#ec4899' },
  { bg: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', text: '#f43f5e' },
  { bg: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)', text: '#f97316' },
];

type ViewMode = 'all' | 'grouped';

// 按 prompt_id 去重，只保留每组的第一张
function getFirstImagesPerPrompt(images: ImageRecord[]): ImageRecord[] {
  const seen = new Set<string>();
  return images.filter(img => {
    if (seen.has(img.prompt_id)) return false;
    seen.add(img.prompt_id);
    return true;
  });
}

export default function GalleryPage() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [groups, setGroups] = useState<api.Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<ImageRecord | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const loadingRef = useRef(false);

  // 加载数据（防堆积 + 请求独立）
  const loadData = useCallback(async () => {
    if (loadingRef.current) return; // 防止请求堆积
    loadingRef.current = true;

    try {
      // 两个请求独立执行，互不阻塞
      const grpPromise = api.fetchGroups().catch(() => [] as api.Group[]);
      const imgPromise = api.fetchImages().catch(() => [] as ImageRecord[]);

      const grpList = await grpPromise;
      const imgList = await imgPromise;

      setGroups(grpList);
      setImages(imgList);
    } catch (err) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 定时刷新（每5秒）
  useEffect(() => {
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  // 全屏功能
  const openFullscreen = () => {
    setIsFullscreen(true);
    setSelectedImage(null);
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
  };

  // 打开图片查看器
  const openImageViewer = (img: ImageRecord) => {
    const idx = images.findIndex(i => i.id === img.id);
    setCurrentImageIndex(idx >= 0 ? idx : 0);
    setSelectedImage(img);
  };

  // 上一张/下一张 - 浏览全局所有作品
  const goPrev = () => {
    if (images.length === 0) return;
    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : images.length - 1;
    setCurrentImageIndex(newIndex);
    setSelectedImage(images[newIndex]);
  };

  const goNext = () => {
    if (images.length === 0) return;
    const newIndex = currentImageIndex < images.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    setSelectedImage(images[newIndex]);
  };

  // ESC 关闭全屏和查看器
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedImage) {
          setSelectedImage(null);
        } else if (isFullscreen) {
          closeFullscreen();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedImage, isFullscreen]);

  // 按组获取去重后的图片（每组只取第一张，最多5个成员）
  const getGroupFirstImages = (groupId: number) => {
    const groupImages = images.filter(img => img.group_id === groupId);
    return getFirstImagesPerPrompt(groupImages).slice(0, 5);
  };

  if (loading) {
    return (
      <div className="app gallery-page">
        <div className="loading"><div className="spinner"></div><p>加载中...</p></div>
      </div>
    );
  }

  return (
    <div className={`app gallery-page ${isFullscreen ? 'fullscreen-mode' : ''}`}>
      {/* 顶部导航 */}
      {!isFullscreen && (
        <div className="gallery-header">
          <div className="header-left">
            <h1>🖼️ 作品画廊</h1>
            <span className="image-count">{images.length} 幅作品</span>
          </div>
          <div className="header-actions">
            <div className="view-mode-toggle">
              <button
                className={`filter-btn ${viewMode === 'all' ? 'active' : ''}`}
                onClick={() => setViewMode('all')}
              >
                📋 全部
              </button>
              <button
                className={`filter-btn ${viewMode === 'grouped' ? 'active' : ''}`}
                onClick={() => setViewMode('grouped')}
              >
                🎯 分组
              </button>
            </div>
            <button className="btn btn-primary fullscreen-btn" onClick={openFullscreen}>
              📺 全屏展示
            </button>
            <a href="#/" className="btn btn-outline">🏠 首页</a>
          </div>
        </div>
      )}

      {/* 全屏模式 */}
      {isFullscreen && (
        <div className="fullscreen-container">
          <button className="close-fullscreen" onClick={closeFullscreen}>✕</button>
          {images.length === 0 ? (
            <div className="empty-state">
              <div className="emoji">🎨</div>
              <p>还没有作品</p>
              <p style={{ fontSize: 14 }}>等待学生创作...</p>
            </div>
          ) : (
            <div className="fullscreen-gallery">
              {images.map(img => (
                <div
                  key={img.id}
                  className="fullscreen-image-card"
                  onClick={() => openImageViewer(img)}
                >
                  <img src={img.image_url} alt={img.prompt} />
                  <div className="fullscreen-overlay">
                    <div className="student-tag">{img.student_name} · {img.group_name}</div>
                    <div className="prompt-preview">{img.prompt}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 单图查看器 - 全局浏览 */}
      {selectedImage && !isFullscreen && (
        <div className="image-viewer" onClick={() => setSelectedImage(null)}>
          <div className="image-viewer-content" onClick={e => e.stopPropagation()}>
            <button className="viewer-close" onClick={() => setSelectedImage(null)}>✕</button>
            <button className="viewer-nav viewer-prev" onClick={goPrev}>‹</button>
            <img src={selectedImage.image_url} alt={selectedImage.prompt} />
            <button className="viewer-nav viewer-next" onClick={goNext}>›</button>
            <div className="viewer-info">
              <div className="viewer-student">
                {selectedImage.student_name} · {selectedImage.group_name}
                <span className="viewer-counter">{currentImageIndex + 1} / {images.length}</span>
              </div>
              <div className="viewer-prompt">💬 {selectedImage.prompt}</div>
            </div>
          </div>
        </div>
      )}

      {/* 分组展示模式 - 左侧竖排标签 + 右侧横向作品 */}
      {!isFullscreen && viewMode === 'grouped' && (
        <div className="grouped-gallery">
          {groups.map((group) => {
            const groupImages = getGroupFirstImages(group.id);
            const color = GROUP_COLORS[(group.id - 1) % GROUP_COLORS.length];

            return (
              <div key={group.id} className="group-panel-v2">
                {/* 左侧竖排标签 */}
                <div
                  className="group-panel-sidebar"
                  style={{ background: color.bg }}
                >
                  <span className="group-panel-label">{group.name}</span>
                </div>
                {/* 右侧作品区 */}
                <div className="group-panel-content">
                  {groupImages.length === 0 ? (
                    <div className="group-panel-empty-v2">
                      <span>🎨</span>
                      <p>还没有作品</p>
                    </div>
                  ) : (
                    <div className="group-panel-works">
                      {groupImages.map(img => (
                        <div
                          key={img.id}
                          className="group-work-item"
                          onClick={() => openImageViewer(img)}
                        >
                          <img src={img.image_url} alt={img.prompt} loading="lazy" />
                          <div className="group-work-name">{img.student_name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 普通画廊模式 */}
      {!isFullscreen && viewMode === 'all' && (
        images.length === 0 ? (
          <div className="empty-state">
            <div className="emoji">🎨</div>
            <p>还没有作品</p>
            <p style={{ fontSize: 13 }}>学生在学生端生成图片后，会显示在这里</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {getFirstImagesPerPrompt(images).map(img => (
              <div
                key={img.id}
                className="image-card gallery-card"
                onClick={() => openImageViewer(img)}
              >
                <div className="image-card-cover">
                  <img src={img.image_url} alt={img.prompt} loading="lazy" />
                </div>
                <div className="image-info">
                  <div className="student-name">
                    {img.student_name}
                    <span className="group-tag">{img.group_name}</span>
                  </div>
                  <div className="prompt-text">💬 {img.prompt}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
