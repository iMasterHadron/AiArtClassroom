import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import path from 'path';
import { getDB, clearAllData } from '../db';

const router = Router();
const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

// POST /upload — 上传 Excel 导入学生名单
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ code: 1, message: '请上传 Excel 文件' });
      return;
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<{ 姓名?: string; 组别?: string }>(sheet);

    if (!data || data.length === 0) {
      res.status(400).json({ code: 1, message: 'Excel 文件为空或格式不正确' });
      return;
    }

    const db = getDB();

    // 组号映射
    const groupMap: Record<string, number> = {};
    for (let i = 1; i <= 8; i++) {
      groupMap[`第${i}组`] = i;
      groupMap[`${i}组`] = i;
      groupMap[`${i}`] = i;
      groupMap[`组${i}`] = i;
    }

    const rowData: { name: string; groupId: number }[] = [];
    let emptyGroupCount = 0;
    const unassignedStudents: string[] = [];

    for (const row of data) {
      const name = (row['姓名'] || '').toString().trim();
      const groupStr = (row['组别'] || '').toString().trim();
      if (!name) continue;

      let groupId = groupMap[groupStr];
      if (groupId === undefined) {
        emptyGroupCount++;
        unassignedStudents.push(name);
        groupId = 1;
      }

      rowData.push({ name, groupId });
    }

    // 清空旧数据（先删图片，再删学生，再重置自增ID）
    const clearTransaction = db.transaction(() => {
      db.prepare('DELETE FROM images').run();
      db.prepare('DELETE FROM students').run();
    });
    clearTransaction();

    // 批量插入新学生
    const insertStudent = db.prepare(
      'INSERT INTO students (name, group_id) VALUES (?, ?)'
    );
    const insertTransaction = db.transaction((items: { name: string; groupId: number }[]) => {
      for (const row of items) {
        insertStudent.run(row.name, row.groupId);
      }
    });
    insertTransaction(rowData);

    let message = `成功导入 ${rowData.length} 名学生`;

    const total = db.prepare('SELECT COUNT(*) as cnt FROM students').get() as any;
    const groups = db.prepare(
      'SELECT g.id, g.name, COUNT(s.id) as student_count FROM groups g LEFT JOIN students s ON g.id = s.group_id GROUP BY g.id ORDER BY g.id'
    ).all();

    res.json({
      code: 0,
      message,
      data: {
        total: total.cnt,
        groups,
        warnings: emptyGroupCount > 0
          ? `其中 ${emptyGroupCount} 名学生组别为空，已默认放入第1组: ${unassignedStudents.join(', ')}`
          : undefined,
      },
    });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message || '导入失败' });
  }
});

// GET /students — 获取所有学生
router.get('/students', (_req: Request, res: Response) => {
  try {
    const db = getDB();
    const students = db.prepare(
      'SELECT s.id, s.name, s.group_id, g.name as group_name FROM students s JOIN groups g ON s.group_id = g.id ORDER BY s.group_id, s.id'
    ).all();
    res.json({ code: 0, data: students });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// GET /groups — 获取分组信息
router.get('/groups', (_req: Request, res: Response) => {
  try {
    const db = getDB();
    const groups = db.prepare(
      'SELECT g.id, g.name, COUNT(s.id) as student_count FROM groups g LEFT JOIN students s ON g.id = s.group_id GROUP BY g.id ORDER BY g.id'
    ).all();
    res.json({ code: 0, data: groups });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

// GET /students/group/:groupId — 获取某组的学生
router.get('/students/group/:groupId', (req: Request, res: Response) => {
  try {
    const db = getDB();
    const groupId = parseInt(req.params.groupId);
    const students = db.prepare(
      'SELECT s.id, s.name, s.group_id, g.name as group_name FROM students s JOIN groups g ON s.group_id = g.id WHERE s.group_id = ? ORDER BY s.id'
    ).all(groupId);
    res.json({ code: 0, data: students });
  } catch (err: any) {
    res.status(500).json({ code: 1, message: err.message });
  }
});

export { router as studentsRouter };
