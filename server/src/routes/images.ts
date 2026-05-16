import { Router, Request, Response } from 'express';
import { getDB } from '../db';
import { fork } from 'child_process';
import path from 'path';

const router = Router();

// 队列系统 - 8路并发
interface QueueItem {
  student_id: number;
  student_name: string;
  prompt: string;
  group_id: number;
  submitted_at: number;
}

const MAX_CONCURRENT = 8;
const queue: QueueItem[] = [];
let activeCount = 0;

function isProcessing(studentId: number): boolean {
  return queue.some(q => q.student_id === studentId);
}

// 处理队列
function processQueue() {
  while (queue.length > 0 && activeCount < MAX_CONCURRENT) {
    const item = queue.shift();
    if (!item) break;

    activeCount++;

    const child = fork(path.join(__dirname, 'imageWorker.js'));

    child.on('message', (msg: any) => {
      if (msg.type === 'done') {
        console.log(`✅ 完成: ${item.student_name}`);
      } else if (msg.type === 'error') {
        console.error(`❌ 失败: ${item.student_name} -`, msg.error);
      }
    });

    child.on('exit', () => {
      activeCount--;
      processQueue();
    });

    child.send({ ...item });
  }
}

// POST /images/generate — 提交生成请求
router.post('/images/generate', async (req: Request, res: Response) => {
  try {
    const { student_id, prompt } = req.body;
    if (!student_id || !prompt) {
      res.status(400).json({ code: 1, message: '缺少 student_id 或 prompt' });
      return;
    }

    const db = getDB();
    const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id) as any;
    if (!student) {
      res.status(404).json({ code: 1, message: '学生不存在' });
      return;
    }

    // 检查该学生是否已在队列中
    if (isProcessing(student_id)) {
      const queuePos = queue.findIndex(q => q.student_id === student_id);
      res.json({
        code: 0,
        message: '你的创作已在队列中，请等待完成',
        data: {
          status: 'queued',
          queue_position: queuePos >= 0 ? queuePos + 1 : null,
        },
      });
      return;
    }

    // 加入队列
    const queueItem: QueueItem = {
      student_id: student.id,
      student_name: student.name,
      prompt: prompt,
      group_id: student.group_id,
      submitted_at: Date.now(),
    };
    queue.push(queueItem);

    res.json({
      code: 0,
      message: '已加入创作队列',
      data: {
        status: 'queued',
        queue_position: queue.length,
        total_pending: queue.length,
        active_count: activeCount,
      },
    });

    processQueue();
  } catch (err: any) {
    console.error('生成请求处理失败:', err);
    res.status(500).json({ code: 1, message: err.message });
  }
});

// GET /images/queue — 获取队列状态
router.get('/images/queue', (_req: Request, res: Response) => {
  res.json({
    code: 0,
    data: {
      pending: queue.length,
      active: activeCount,
      max_concurrent: MAX_CONCURRENT,
      queue_list: queue.map((q, idx) => ({
        position: idx + 1,
        student_name: q.student_name,
        submitted_at: new Date(q.submitted_at).toLocaleTimeString(),
      })),
    },
  });
});

// GET /images — 获取所有图片（老师端/画廊）
router.get('/images', (req: Request, res: Response) => {
  try {
    const db = getDB();
    const { group_id, limit, student_id } = req.query;

    let sql = `
      SELECT i.id, i.student_id, i.student_name, i.group_id, g.name as group_name,
             i.prompt, i.prompt_id, i.image_url, i.created_at
      FROM images i
      JOIN groups g ON i.group_id = g.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (group_id) {
      conditions.push('i.group_id = ?');
      params.push(Number(group_id));
    }
    if (student_id) {
      conditions.push('i.student_id = ?');
      params.push(Number(student_id));
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY i.created_at DESC';

    if (limit) {
      sql += ' LIMIT ?';
      params.push(Number(limit));
    }

    const images = db.prepare(sql).all(...params);
    res.json({ code: 0, data: images });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// GET /images/:student_id — 获取某个学生的所有图片
router.get('/images/:student_id', (req: Request, res: Response) => {
  try {
    const db = getDB();
    const images = db.prepare(
      `SELECT i.*, g.name as group_name FROM images i
       JOIN groups g ON i.group_id = g.id
       WHERE i.student_id = ? ORDER BY i.created_at DESC`
    ).all(req.params.student_id);

    res.json({ code: 0, data: images });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// DELETE /images/:image_id — 删除单张图片（学生端）
router.delete('/images/:image_id', (req: Request, res: Response) => {
  try {
    const db = getDB();
    const imageId = parseInt(req.params.image_id);
    const { student_id } = req.query;

    // 验证图片存在且属于该学生
    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(imageId) as any;
    if (!image) {
      res.status(404).json({ code: 1, message: '图片不存在' });
      return;
    }

    if (student_id && image.student_id !== Number(student_id)) {
      res.status(403).json({ code: 1, message: '无权删除此图片' });
      return;
    }

    db.prepare('DELETE FROM images WHERE id = ?').run(imageId);
    res.json({ code: 0, message: '删除成功' });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// === 归档功能 ===

// POST /archives — 一键归档所有当前作品
router.post('/archives', (req: Request, res: Response) => {
  try {
    const db = getDB();
    const { name } = req.body;

    // 自动生成归档名称：日期+时间
    let archiveName = name;
    if (!archiveName) {
      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      archiveName = `归档_${dateStr}_${timeStr}`;
    }

    // 创建归档记录
    const nowStr = new Date().toISOString();
    const archiveResult = db.prepare(
      'INSERT INTO archives (name, archive_date) VALUES (?, ?)'
    ).run(archiveName, nowStr);
    const archiveId = archiveResult.lastInsertRowid;

    // 复制所有当前图片到归档
    const images = db.prepare(
      `SELECT i.*, g.name as group_name FROM images i
       JOIN groups g ON i.group_id = g.id
       ORDER BY i.created_at DESC`
    ).all();

    const insertArchived = db.prepare(
      'INSERT INTO archived_images (archive_id, student_id, student_name, group_id, group_name, prompt, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    for (const img of images as any[]) {
      insertArchived.run(archiveId, img.student_id, img.student_name, img.group_id, img.group_name, img.prompt, img.image_url, img.created_at);
    }

    res.json({
      code: 0,
      message: `归档成功：${archiveName}，共归档 ${images.length} 张图片`,
      data: { archive_id: archiveId, name: archiveName, count: images.length },
    });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// GET /archives — 获取归档列表
router.get('/archives', (req: Request, res: Response) => {
  try {
    const db = getDB();
    const { date } = req.query;

    let sql = 'SELECT * FROM archives WHERE 1=1';
    const params: any[] = [];

    if (date) {
      sql += ' AND date(archive_date) = date(?)';
      params.push(date as string);
    }

    sql += ' ORDER BY created_at DESC';

    const archives = db.prepare(sql).all(...params);
    res.json({ code: 0, data: archives });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// GET /archives/:archiveId — 获取某归档的详情
router.get('/archives/:archiveId', (req: Request, res: Response) => {
  try {
    const db = getDB();
    const archiveId = parseInt(req.params.archiveId);

    const archive = db.prepare('SELECT * FROM archives WHERE id = ?').get(archiveId);
    if (!archive) {
      res.status(404).json({ code: 1, message: '归档不存在' });
      return;
    }

    const images = db.prepare(
      'SELECT * FROM archived_images WHERE archive_id = ? ORDER BY created_at DESC'
    ).all(archiveId);

    res.json({ code: 0, data: { archive, images } });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

export { router as imagesRouter };
