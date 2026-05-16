import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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

interface Student {
  id: number;
  name: string;
  group_id: number;
  group_name: string;
}

// 学生生成状态
interface StudentStatus {
  generating: boolean;  // 是否正在生成中
  completedCount: number; // 已完成次数
}

export default function StudentPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [inQueue, setInQueue] = useState(false);
  const [images, setImages] = useState<api.ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueStatus, setQueueStatus] = useState<{ pending: number; active: number } | null>(null);
  const [queuedStudents, setQueuedStudents] = useState<Set<number>>(new Set());
  const [studentStatuses, setStudentStatuses] = useState<Record<number, StudentStatus>>({});
  const recognitionRef = useRef<any>(null);

  const gid = groupId ? parseInt(groupId) : 1;
  const color = GROUP_COLORS[(gid - 1) % GROUP_COLORS.length];

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const stuList = await api.fetchGroupStudents(gid);
      setStudents(stuList);

      // 并行获取所有学生的完成次数
      const countPromises = stuList.map(s =>
        api.fetchStudentImages(s.id)
          .then(imgs => ({ id: s.id, count: imgs.length }))
          .catch(() => ({ id: s.id, count: 0 }))
      );
      const counts = await Promise.all(countPromises);
      const countMap: Record<number, number> = {};
      for (const c of counts) countMap[c.id] = c.count;

      // 获取队列状态
      try {
        const status = await api.fetchQueueStatus();
        setQueueStatus(status);
        const newStatuses: Record<number, StudentStatus> = {};
        for (const s of stuList) {
          const inQ = status.queue_list?.some(q => q.student_name === s.name) || false;
          newStatuses[s.id] = { generating: inQ, completedCount: countMap[s.id] || 0 };
        }
        setStudentStatuses(newStatuses);
      } catch {
        const newStatuses: Record<number, StudentStatus> = {};
        for (const s of stuList) {
          newStatuses[s.id] = { generating: false, completedCount: countMap[s.id] || 0 };
        }
        setStudentStatuses(newStatuses);
      }

      if (selectedStudent) {
        const imgs = await api.fetchStudentImages(selectedStudent.id);
        setImages(imgs);
        setStudentStatuses(prev => ({
          ...prev,
          [selectedStudent.id]: {
            generating: prev[selectedStudent.id]?.generating || false,
            completedCount: imgs.length,
          },
        }));
      }
    } catch (err: any) {
      console.error('加载失败:', err);
    } finally {
      setLoading(false);
    }
  }, [gid, selectedStudent]);

  useEffect(() => { loadData(); }, []);

  // 定时刷新（每5秒）
  useEffect(() => {
    const timer = setInterval(loadData, 5000);
    return () => clearInterval(timer);
  }, [loadData]);

  // 切换学生
  const handleSelectStudent = async (s: Student) => {
    setSelectedStudent(s);
    setPrompt('');
    try {
      const imgs = await api.fetchStudentImages(s.id);
      setImages(imgs);
      setStudentStatuses(prev => ({
        ...prev,
        [s.id]: {
          generating: prev[s.id]?.generating || false,
          completedCount: imgs.length,
        },
      }));
    } catch { setImages([]); }
  };

  // 语音识别
  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('当前浏览器不支持语音识别，请使用 Chrome 浏览器');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      setPrompt(text);
      setIsRecording(false);
    };

    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // 提交创作（加入队列）
  const handleGenerate = async () => {
    if (!selectedStudent || !prompt.trim()) return;

    setInQueue(true);
    setQueuedStudents(prev => new Set(prev).add(selectedStudent.id));
    setStudentStatuses(prev => ({
      ...prev,
      [selectedStudent.id]: {
        generating: true,
        completedCount: prev[selectedStudent.id]?.completedCount || 0,
      },
    }));

    try {
      await api.generateImage(selectedStudent.id, prompt.trim());
      setPrompt('');
    } catch (err: any) {
      alert('提交失败: ' + err.message);
    } finally {
      setInQueue(false);
    }
  };

  // 删除图片
  const handleDeleteImage = async (imageId: number) => {
    if (!selectedStudent) return;
    if (!confirm('确定要删除这张图片吗？')) return;
    try {
      await api.deleteImage(imageId, selectedStudent.id);
      // 刷新图片列表
      const imgs = await api.fetchStudentImages(selectedStudent.id);
      setImages(imgs);
      setStudentStatuses(prev => ({
        ...prev,
        [selectedStudent.id]: {
          generating: prev[selectedStudent.id]?.generating || false,
          completedCount: imgs.length,
        },
      }));
    } catch (err: any) {
      alert('删除失败: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading"><div className="spinner"></div><p>加载中...</p></div>
      </div>
    );
  }

  const groupName = students[0]?.group_name || `第${gid}组`;

  // 只展示最新一张图
  const latestImage = images[0];

  return (
    <div className="app student-page" style={{ background: `linear-gradient(180deg, ${color.bg.replace('linear-gradient', '')} 0%, #f8fafc 100%)` } as any}>
      {/* 顶部导航 */}
      <div className="student-nav">
        <a href="#/" className="back-btn">← 返回</a>
        <h1>{groupName}</h1>
        {queueStatus && (queueStatus.pending > 0 || queueStatus.active > 0) && (
          <div className="queue-status">
            <span className="status-dot"></span>
            队列: {queueStatus.active} 进行中 / {queueStatus.pending} 等待
          </div>
        )}
      </div>

      {students.length === 0 ? (
        <div className="empty-state">
          <div className="emoji">👥</div>
          <p>本组暂无学生</p>
          <p style={{ fontSize: 13 }}>请联系老师导入名单</p>
        </div>
      ) : !selectedStudent ? (
        /* 学生选择模式 - 大色块按钮网格 */
        <div className="student-grid-container">
          <p className="grid-hint">点击你的名字</p>
          <div className="student-name-grid">
            {students.map((s) => {
              const status = studentStatuses[s.id];
              const isGenerating = status?.generating;
              const completedCount = status?.completedCount || 0;
              return (
                <button
                  key={s.id}
                  className={`name-btn ${isGenerating ? 'generating' : ''}`}
                  style={{
                    background: color.bg,
                    boxShadow: `0 6px 24px ${color.shadow}`,
                  }}
                  onClick={() => handleSelectStudent(s)}
                >
                  <span className="name-text">{s.name}</span>
                  {isGenerating && (
                    <span className="generating-badge">
                      <span className="generating-spinner"></span>
                    </span>
                  )}
                  {completedCount > 0 && !isGenerating && (
                    <span className="completed-count">{completedCount}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* 创作模式 */
        <div className="create-mode">
          <div className="selected-name-banner" style={{ background: color.bg }}>
            <span className="selected-name">{selectedStudent.name}</span>
            <button className="change-btn" onClick={() => setSelectedStudent(null)}>
              换人
            </button>
          </div>

          {queuedStudents.has(selectedStudent.id) && (
            <div className="queued-notice">
              <span>🎨</span> {selectedStudent.name} 的创作正在队列中，完成后会显示在作品区
            </div>
          )}

          <div className="prompt-card">
            <div className="prompt-label">你想画什么？</div>
            <div className="voice-row">
              <button
                className={`voice-btn ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? stopRecording : startRecording}
                style={{ background: color.bg }}
              >
                {isRecording ? '⏹' : '🎤'}
              </button>
              <input
                className="prompt-input"
                type="text"
                placeholder="输入或语音说出你的创意..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
              />
            </div>
            <button
              className={`submit-btn ${inQueue ? 'queued' : ''}`}
              onClick={handleGenerate}
              disabled={!prompt.trim() || inQueue}
              style={{ background: color.bg }}
            >
              {inQueue ? '📝 已入队，可换人继续' : '✨ 提交创作'}
            </button>
          </div>

          {/* 个人作品 - 只展示最新一张 */}
          {latestImage && (
            <div className="my-works">
              <div className="works-label">我的作品</div>
              <div className="works-grid single-work">
                <div key={latestImage.id} className="work-card">
                  <div className="work-image-wrapper">
                    <img src={latestImage.image_url} alt={latestImage.prompt} loading="lazy" style={{ objectFit: 'contain' }} />
                    <button className="delete-btn" onClick={() => handleDeleteImage(latestImage.id)} title="删除">
                      🗑️
                    </button>
                  </div>
                  <div className="work-prompt">{latestImage.prompt}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
