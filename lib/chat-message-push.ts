/**
 * 角色消息落地后的即时通知（只在页面不在前台时发）。
 *
 * 触发点：lib/chat-storage.ts 的 pushChatMessage —— 那是全部消息路径都会经过的落库点，
 * 前台页面、后台任务、宿主兜底、follow-up 全都在这里汇合，所以钩在这里不会漏。
 *
 * 与离线兜底的区别：这里**不生成文本**，只把已经进聊天室的那条消息广播出去，
 * 所以不会出现“通知里有、聊天里没有”的情况。
 */

const NOTIFY_INTERVAL_MS = 800;      // 连续多条（比如分段回复）合并成一点节奏，不做逐条推送
const DEDUPE_MS = 60_000;

let lastNotifyAt = 0;
const notified = new Map<string, number>();

function cleanup(nowMs: number) {
  if (notified.size < 200) return;
  for (const [id, at] of notified) if (nowMs - at > DEDUPE_MS) notified.delete(id);
}

function isPageHidden(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState !== "visible";
}

/** 去掉 [内心] 段、卡片/宏标记，只留给她看的那句话 */
function plainTextOf(raw: string): string {
  return String(raw || "")
    .replace(/\[内心\][\s\S]*?\[\/内心\]/g, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/【[^】]{1,24}】/g, " ")
    .replace(/[*_`#>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function beacon(stage: string, message: { id?: string; sessionId?: string }, extra: Record<string, unknown> = {}) {
  try {
    await fetch("/api/push/notify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage,
        hidden: typeof document !== "undefined" ? document.visibilityState : "unknown",
        sessionId: message.sessionId || "",
        messageId: message.id || "",
        ...extra,
      }),
      keepalive: true,
    });
  } catch { /* 观测失败不影响任何东西 */ }
}

export async function notifyAssistantMessage(message: {
  id?: string;
  sessionId?: string;
  content?: string;
  role?: string;
  status?: string;
  mediaType?: string;
}): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    if (message.role !== "assistant") return false;
    if (message.status === "rejected") { void beacon("skip-rejected", message); return false; }  // 被拉黑拒收的，不弹
    if (!isPageHidden()) { void beacon("skip-visible", message); return false; }                  // 她正看着屏幕，不弹

    const nowMs = Date.now();
    if (nowMs - lastNotifyAt < NOTIFY_INTERVAL_MS) { void beacon("skip-throttle", message); return false; }
    const id = String(message.id || "");
    if (id && notified.has(id)) { void beacon("skip-dedupe", message); return false; }
    if (id) { notified.set(id, nowMs); cleanup(nowMs); }

    const text = plainTextOf(String(message.content || ""))
      || (message.mediaType === "sticker" ? "[表情]"
        : message.mediaType === "image" ? "[图片]"
        : message.mediaType === "voice" || message.mediaType === "audio" ? "[语音]"
        : "");
    if (!text) { void beacon("skip-empty", message); return false; }
    if (!text) return false;

    const session = message.sessionId
      ? (await import("./chat-storage")).loadChatSessions().find(s => s.id === message.sessionId)
      : undefined;
    let title = (session && session.alias) || "";
    if (!title && session?.contactId) {
      try {
        const { loadCharacters } = await import("./character-storage");
        title = loadCharacters().find(c => c.id === session.contactId)?.name || "";
      } catch { /* 名字取不到就用兜底标题 */ }
    }
    if (!title) title = "小手机";

    lastNotifyAt = nowMs;
    const res = await fetch("/api/push/notify", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body: text.slice(0, 80),
        sessionId: message.sessionId || "",
        messageId: id,
      }),
      keepalive: true,
    });
    return res.ok;
  } catch {
    return false;   // 通知失败绝不能影响消息本身
  }
}
