/**
 * imageWorker.js — 子进程：生成图片并写入数据库
 * 通过 fork() 从主 Express 进程启动，独立运行不受 Express 事件循环影响
 * 这样 SQLite 的写锁不会阻塞 HTTP 请求
 */

interface QueueItem {
  student_id: number;
  student_name: string;
  prompt: string;
  group_id: number;
  submitted_at: number;
}

async function main() {
  const { getDB } = await import('../db');
  const { generateImage } = await import('../services/jimeng');

  function generatePromptId() {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 监听主进程消息
  process.on('message', async (msg: unknown) => {
    const item = msg as QueueItem;
    if (!item || typeof item !== 'object' || !item.student_id) {
      process.exit(1);
      return;
    }

    const db = getDB();

    try {
      console.log(`🚀 [Worker] 开始生成: ${item.student_name} - ${item.prompt}`);
      const urls = await generateImage(item.prompt + '，高清画质，4K细节');

      // ★★★ 只插入第一张图片，大幅减少数据量和传输量
      const promptId = generatePromptId();
      const firstUrl = urls[0];

      if (firstUrl) {
        db.prepare(
          'INSERT INTO images (student_id, student_name, group_id, prompt, prompt_id, image_url) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(item.student_id, item.student_name, item.group_id, item.prompt, promptId, firstUrl);
      }

      console.log(`✅ [Worker] 完成: ${item.student_name}，已保存第1张（共生成${urls.length}张）`);
      process.send!({ type: 'done' });
    } catch (genErr: unknown) {
      const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
      console.error(`❌ [Worker] 失败: ${item.student_name} -`, errMsg);
      process.send!({ type: 'error', error: errMsg });
    } finally {
      process.exit(0);
    }
  });
}

main().catch((err) => {
  console.error('[Worker] 启动失败:', err);
  process.exit(1);
});
