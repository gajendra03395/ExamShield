import api from "./api";

const QUEUE_KEY = "examshield_pending_answers";
type PendingAnswer = { studentTestId: string; answer: Record<string, unknown>; queuedAt: number };
function storageKey() {
  try {
    const user = JSON.parse(localStorage.getItem("examshield_user") || "null");
    return user?.id ? `${QUEUE_KEY}:${user.id}` : `${QUEUE_KEY}:anonymous`;
  } catch { return `${QUEUE_KEY}:anonymous`; }
}
function readQueue(): PendingAnswer[] { try { return JSON.parse(localStorage.getItem(storageKey()) || "[]"); } catch { return []; } }
function writeQueue(queue: PendingAnswer[]) { localStorage.setItem(storageKey(), JSON.stringify(queue)); }

export async function saveAnswerOfflineSafe(studentTestId: string, answer: Record<string, unknown>) {
  try { await api.post(`/exam/session/${studentTestId}/answer`, answer); return { queued: false }; }
  catch (error: any) {
    if (error.response?.status >= 400 && error.response.status < 500) throw error;
    const queue = readQueue();
    const index = queue.findIndex((item) => item.studentTestId === studentTestId && item.answer.questionId === answer.questionId);
    const item = { studentTestId, answer, queuedAt: Date.now() };
    if (index >= 0) queue[index] = item; else queue.push(item);
    writeQueue(queue);
    return { queued: true };
  }
}

export async function flushPendingAnswers() {
  if (!navigator.onLine) return;
  const snapshot = readQueue();
  const delivered = new Set<string>();
  for (const item of snapshot) {
    try {
      await api.post(`/exam/session/${item.studentTestId}/answer`, item.answer);
      delivered.add(`${item.studentTestId}:${String(item.answer.questionId)}:${item.queuedAt}`);
    } catch { /* Keep failed items queued for the next health check. */ }
  }
  const current = readQueue();
  writeQueue(current.filter((item) => !delivered.has(`${item.studentTestId}:${String(item.answer.questionId)}:${item.queuedAt}`)));
}
export function pendingAnswerCount() { return readQueue().length; }
