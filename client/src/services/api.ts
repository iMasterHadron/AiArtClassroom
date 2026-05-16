const API_BASE = '/sk/api';

export interface Student {
  id: number;
  name: string;
  group_id: number;
  group_name: string;
}

export interface Group {
  id: number;
  name: string;
  student_count: number;
}

export interface ImageRecord {
  id: number;
  student_id: number;
  student_name: string;
  group_id: number;
  group_name: string;
  prompt: string;
  prompt_id: string;
  image_url: string;
  created_at: string;
}

export interface Archive {
  id: number;
  name: string;
  archive_date: string;
  created_at: string;
}

export interface QueueStatus {
  pending: number;
  active: number;
  max_concurrent: number;
  queue_list?: Array<{
    position: number;
    student_name: string;
    submitted_at: string;
  }>;
}

async function request<T>(url: string, options?: RequestInit, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (data.code !== 0) {
      throw new Error(data.message || '请求失败');
    }
    return data.data as T;
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw err;
  }
}

export async function fetchStudents(): Promise<Student[]> {
  return request<Student[]>('/students');
}

export async function fetchGroups(): Promise<Group[]> {
  return request<Group[]>('/groups');
}

export async function fetchImages(groupId?: number): Promise<ImageRecord[]> {
  const params = new URLSearchParams();
  if (groupId) params.append('group_id', String(groupId));
  const query = params.toString();
  return request<ImageRecord[]>(`/images${query ? '?' + query : ''}`);
}

export async function fetchStudentImages(studentId: number): Promise<ImageRecord[]> {
  return request<ImageRecord[]>(`/images/${studentId}`);
}

export async function fetchLatestStudentImage(studentId: number): Promise<ImageRecord | null> {
  const images = await request<ImageRecord[]>(`/images?student_id=${studentId}&limit=1`);
  return images[0] || null;
}

export async function deleteImage(imageId: number, studentId?: number): Promise<void> {
  const params = studentId ? `?student_id=${studentId}` : '';
  await request<void>(`/images/${imageId}${params}`, {
    method: 'DELETE',
  });
}

export async function fetchQueueStatus(): Promise<QueueStatus> {
  return request<QueueStatus>('/images/queue');
}

export async function fetchGroupStudents(groupId: number): Promise<Student[]> {
  return request<Student[]>(`/students/group/${groupId}`);
}

export async function uploadExcel(file: File): Promise<{ total: number; groups: Group[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (data.code !== 0) {
    throw new Error(data.message || '上传失败');
  }
  return data.data;
}

export async function generateImage(studentId: number, prompt: string): Promise<void> {
  await request<void>('/images/generate', {
    method: 'POST',
    body: JSON.stringify({ student_id: studentId, prompt }),
  });
}

// === 归档 API ===

export async function createArchive(name?: string): Promise<{ archive_id: number; name: string; count: number }> {
  return request<{ archive_id: number; name: string; count: number }>('/archives', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function fetchArchives(date?: string): Promise<Archive[]> {
  const params = new URLSearchParams();
  if (date) params.append('date', date);
  const query = params.toString();
  return request<Archive[]>(`/archives${query ? '?' + query : ''}`);
}

export async function fetchArchiveDetail(archiveId: number): Promise<{ archive: Archive; images: ImageRecord[] }> {
  return request<{ archive: Archive; images: ImageRecord[] }>(`/archives/${archiveId}`);
}
