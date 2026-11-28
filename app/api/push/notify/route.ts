import { NextResponse } from "next/server";

import { getCurrentAccount } from "@/lib/server/account-auth";
import { resolvePushSubject, sendPushToUser } from "@/lib/server/push-service";
import { getSupabaseServerConfig } from "@/lib/server/supabase-rest";

/**
 * 「他发消息了就弹一下」——客户端在角色消息落地且页面不在前台时调用。
 *
 * 与「离线兜底」（push_jobs + push-generate）不是一条路：
 * 这条只负责把**已经真实写进聊天室的那条消息**广播成通知，
 * 不生成任何文本，因此不会产生聊天室里看不到的“幽灵通知”。
 */
export async function POST(request: Request) {
  try {
    if (!getSupabaseServerConfig()) {
      return NextResponse.json({ ok: false, error: "站点未配置 Supabase 环境变量。" }, { status: 503 });
    }
    const account = await getCurrentAccount(request);
    if (!account) return NextResponse.json({ ok: false, error: "未登录。" }, { status: 401 });

    const body = await request.json().catch(() => ({})) as {
      title?: unknown; body?: unknown; sessionId?: unknown; messageId?: unknown;
    };
    const title = String(body.title ?? "").trim().slice(0, 40) || "小手机";
    const text = String(body.body ?? "").trim().slice(0, 160);
    if (!text) return NextResponse.json({ ok: false, error: "body 为空" }, { status: 400 });

    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 120) : "";
    const messageId = typeof body.messageId === "string" ? body.messageId.slice(0, 120) : "";
    // tag 用消息 id：同一条消息即使客户端重试也只叠成一条通知，不会刷屏。
    const tag = messageId ? `msg-${messageId}` : `msg-${Date.now()}`;

    const url = new URL("/", request.url).toString();
    const result = await sendPushToUser(account.id, { title, body: text, tag, url }, resolvePushSubject(request.url));
    return NextResponse.json({
      ok: result.sent > 0,
      sent: result.sent,
      total: result.total,
      errors: result.errors.slice(0, 3),
      sessionId,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
