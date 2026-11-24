// 「角色电脑」同源中转：手机只跟本站通信，服务器替它去请求原版站点的 agent-proxy。
// 存在的原因：原版那条中转只认 gojosatoru1207.netlify.app 这个域名，且不返回跨域头，
// 从二改域名直接 fetch 必被浏览器拦成 "Failed to fetch"。
// 这里只透传：请求体原样、Authorization 头原样、响应体原样，密钥始终在用户手里，本站不存。
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UPSTREAM = "https://gojosatoru1207.netlify.app/.netlify/functions/agent-proxy";

export async function POST(req: Request) {
    let body = "";
    try {
        body = await req.text();
    } catch {
        return NextResponse.json({ ok: false, error: "请求体读取失败" }, { status: 400 });
    }
    const authorization = req.headers.get("authorization") || "";
    if (!authorization) {
        return NextResponse.json({ ok: false, error: "缺少连接密钥" }, { status: 401 });
    }
    try {
        const upstream = await fetch(UPSTREAM, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authorization },
            body,
        });
        const text = await upstream.text();
        return new NextResponse(text, {
            status: upstream.status,
            headers: { "Content-Type": "application/json; charset=utf-8" },
        });
    } catch (err) {
        return NextResponse.json(
            { ok: false, error: `中转失败：${err instanceof Error ? err.message : String(err)}` },
            { status: 502 },
        );
    }
}

export async function GET() {
    return NextResponse.json({ ok: true, hint: "此接口只接受 POST，用于转发「角色电脑」请求" });
}
