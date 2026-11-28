"use client";

import { useMemo } from "react";

/**
 * 瑞幸卡：沿用京东「普通卡（detail）」的版式，主色换成瑞幸蓝。
 * 用法是在聊天正文里写一个围栏块，渲染层把它变成卡片并从正文里剥掉：
 *
 * ```luckin-card
 * { "shop": "大足吾悦广场金街店",
 *   "items": [{"title": "生椰拿铁（原创）", "spec": "大杯/热/不另外加糖", "price": "¥20.00", "qty": 1}],
 *   "orig": "¥20.00", "discount": "¥0.00", "total": "¥20.00",
 *   "pickup_time": "14:11", "pickup_code": "0731",
 *   "address": "大足区龙景路133号吾悦广场一层1019-1021号商铺",
 *   "order_id": "3602408501622100566", "status": "待支付", "pay_left": "14:59",
 *   "note": "热的，路上别凉", "link": "https://..." }
 * ```
 */

/** 瑞幸蓝主色（徽标深蓝 / 强调蓝 / 浅蓝底） */
const LUCKIN_DEEP = "#0c2e86";
const LUCKIN_BLUE = "#2b63e0";
const LUCKIN_TINT = "#e8effc";

export type LuckinCardItem = { title: string; spec?: string; price?: string; qty?: number };

export type LuckinCardData = {
  shop?: string;
  items?: LuckinCardItem[];
  orig?: string;
  discount?: string;
  total?: string;
  pickup_time?: string;
  pickup_code?: string;
  address?: string;
  order_id?: string;
  status?: string;
  pay_left?: string;
  note?: string;
  link?: string;
};

function normalizeLuckinCard(raw: unknown): LuckinCardData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(d.items) ? d.items : [];
  const items: LuckinCardItem[] = [];
  for (const it of itemsRaw) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : "";
    if (!title) continue;
    const price =
      typeof o.price === "string" ? o.price : typeof o.price === "number" ? `¥${o.price}` : undefined;
    items.push({
      title,
      spec: typeof o.spec === "string" ? o.spec : undefined,
      price,
      qty: typeof o.qty === "number" ? o.qty : undefined,
    });
  }
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
  return {
    shop: str("shop"),
    items,
    orig: str("orig"),
    discount: str("discount"),
    total: str("total"),
    pickup_time: str("pickup_time"),
    pickup_code: str("pickup_code"),
    address: str("address"),
    order_id: str("order_id"),
    status: str("status"),
    pay_left: str("pay_left"),
    note: str("note"),
    link: str("link"),
  };
}

const LUCKIN_CARD_RX = /```(?:luckin-card|luckin_card|瑞幸卡|luckin)\s*\n([\s\S]*?)```/gi;
/** 语言名没写对（写成 json / 什么都不写）但内容是瑞幸卡的围栏 */
const ANY_JSON_FENCE_RX = /```(?:json)?\s*\n([\s\S]*?)```/gi;

/**
 * 这段 JSON 像不像一张瑞幸卡（兜底判据，宁可漏、不误伤）：
 * 必须是对象、**没有 type 字段**（type 是京东卡的地盘）、有 total 或 order_id。
 * 京东卡一律带 type，所以这条不会把京东卡抢走。
 */
function looksLikeLuckinCardRaw(raw: unknown): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if ("type" in o) return false;
  const hasTotal = typeof o.total === "string";
  const hasOrder = typeof o.order_id === "string";
  return hasTotal || hasOrder;
}

function parseCardBody(body: string): LuckinCardData | null {
  try {
    const raw = JSON.parse(String(body).trim());
    if (!looksLikeLuckinCardRaw(raw)) return null;
    return normalizeLuckinCard(raw);
  } catch {
    return null;
  }
}

/**
 * 从消息正文里抽出所有瑞幸卡块，返回卡片数据与去掉块之后的正文。
 * 三层认卡：① 正牌围栏 ```luckin-card / ```瑞幸卡 …；② 错语言名围栏；③ 整条裸 JSON。
 */
export function extractLuckinCards(text: string): { cards: LuckinCardData[]; rest: string } {
  const cards: LuckinCardData[] = [];
  let rest = text.replace(LUCKIN_CARD_RX, (_m, body: string) => {
    try {
      const parsed = normalizeLuckinCard(JSON.parse(String(body).trim()));
      if (parsed) cards.push(parsed);
    } catch {
      /* JSON 不合法就当没有这张卡，块被剥掉，不显示乱码 */
    }
    return "";
  });

  if (!cards.length) {
    rest = rest.replace(ANY_JSON_FENCE_RX, (m: string, body: string) => {
      const parsed = parseCardBody(body);
      if (!parsed) return m;
      cards.push(parsed);
      return "";
    });
  }

  if (!cards.length) {
    const trimmed = rest.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = parseCardBody(trimmed);
      if (parsed) {
        cards.push(parsed);
        rest = "";
      }
    }
  }

  return { cards, rest: rest.replace(/\n{3,}/g, "\n\n").trim() };
}

function MenuRow({ label, value, tone }: { label: string; value?: string; tone?: "blue" }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
      <span style={{ color: "var(--c-text)", fontSize: 11.5 }}>{label}</span>
      <span
        style={{
          color: tone === "blue" ? LUCKIN_BLUE : "var(--c-text-title)",
          fontSize: 11.5,
          fontWeight: tone === "blue" ? 600 : 500,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ItemLines({ items }: { items?: LuckinCardItem[] }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: "var(--c-text-title)",
                fontSize: 12.5,
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {it.title}
              {it.qty && it.qty > 1 ? ` ×${it.qty}` : ""}
            </div>
            {it.spec ? (
              <div style={{ marginTop: 2, fontSize: 10.5, color: "var(--c-text)", opacity: 0.8, lineHeight: 1.4 }}>
                {it.spec}
              </div>
            ) : null}
          </div>
          {it.price ? (
            <span style={{ color: "var(--c-text-title)", fontSize: 12.5, flexShrink: 0 }}>{it.price}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ActionButtons({ data }: { data: LuckinCardData }) {
  const href = data.link || "https://lkcoffee.com";
  const done = Boolean(data.status && /完成|已取|已取餐|已完成/.test(data.status));
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        style={{
          flex: 1,
          textAlign: "center",
          padding: "9px 0",
          borderRadius: 999,
          background: `linear-gradient(135deg,#1d4ed8,${LUCKIN_BLUE})`,
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
          boxShadow: "0 6px 14px rgba(43,99,224,0.26)",
        }}
      >
        {done ? "看看这杯" : data.pickup_code ? "看取餐码" : "去支付"}
      </a>
      <a
        href="https://lkcoffee.com"
        target="_blank"
        rel="noreferrer"
        style={{
          flex: 1,
          textAlign: "center",
          padding: "9px 0",
          borderRadius: 999,
          background: "var(--c-input)",
          color: "var(--c-text-title)",
          fontSize: 13,
          fontWeight: 500,
          textDecoration: "none",
        }}
      >
        查订单
      </a>
    </div>
  );
}

function LuckinDetailCard({ data }: { data: LuckinCardData }) {
  const pending = Boolean(data.pay_left);
  const statusColor = pending ? LUCKIN_BLUE : /已取消/.test(data.status || "") ? "var(--c-text)" : "var(--c-success)";
  const statusText = pending ? `${data.status || "待支付"} ${data.pay_left}` : data.status;
  const longStatus = Boolean(data.status && data.status.length > 9 && !data.pay_left);
  const num = (v?: string) => (v ? Number(String(v).replace(/[^0-9.]/g, "")) : NaN);
  // 没打折就不演「原价被划掉」，折扣为 0 也不写「-¥0.00」
  const showOrig = Boolean(data.orig) && !(Number.isFinite(num(data.orig)) && num(data.orig) === num(data.total));
  const discountText = data.discount && num(data.discount) > 0 ? data.discount : undefined;

  return (
    <div
      style={{
        margin: "10px 0",
        padding: "13px 14px 14px",
        borderRadius: 16,
        background: "var(--c-panel, var(--c-card))",
        border: "1px solid var(--c-card-border)",
        boxShadow: "0 8px 22px rgba(12,46,134,0.08)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#fff",
              background: LUCKIN_DEEP,
              borderRadius: 6,
              padding: "2px 6px",
              letterSpacing: 0.5,
              flexShrink: 0,
            }}
          >
            瑞幸
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 600,
              color: LUCKIN_BLUE,
              background: LUCKIN_TINT,
              borderRadius: 5,
              padding: "1px 5px",
              flexShrink: 0,
            }}
          >
            自提
          </span>
          {data.shop ? (
            <span
              style={{
                fontSize: 11.5,
                color: "var(--c-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {data.shop}
            </span>
          ) : null}
        </div>
        {data.status && !longStatus ? (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: statusColor, flexShrink: 0 }}>{statusText}</span>
        ) : null}
      </div>
      {longStatus ? (
        <div
          style={{
            marginTop: 6,
            fontSize: 11.5,
            fontWeight: 600,
            color: statusColor,
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          {statusText}
        </div>
      ) : null}

      <ItemLines items={data.items} />

      <div style={{ height: 1, background: "var(--c-card-border)", margin: "11px 0 8px", opacity: 0.7 }} />

      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11.5, color: "var(--c-text)" }}>应付</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          {showOrig ? (
            <span style={{ fontSize: 11.5, color: "var(--c-text)", textDecoration: "line-through" }}>{data.orig}</span>
          ) : null}
          <span style={{ fontSize: 20, fontWeight: 700, color: LUCKIN_BLUE, letterSpacing: -0.3 }}>
            {data.total || "—"}
          </span>
        </div>
      </div>

      <MenuRow label="已优惠" value={discountText ? `-${discountText}` : undefined} />
      <MenuRow label="预计取餐" value={data.pickup_time} />
      <MenuRow label="取餐码" value={data.pickup_code} tone="blue" />
      {data.address ? (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--c-text)", lineHeight: 1.5 }}>
          <span style={{ marginRight: 4 }}>📍</span>
          {data.address}
        </div>
      ) : null}
      {data.order_id ? (
        <div style={{ marginTop: 4, fontSize: 10.5, color: "var(--c-text)", opacity: 0.75 }}>
          订单号 {data.order_id}
        </div>
      ) : null}

      {data.note ? (
        <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--c-text)", lineHeight: 1.5 }}>
          <div style={{ fontSize: 10.5, opacity: 0.6, marginBottom: 2 }}>备注</div>
          <div>{data.note}</div>
        </div>
      ) : null}

      <ActionButtons data={data} />
    </div>
  );
}

export function LuckinCard({ data }: { data: LuckinCardData }) {
  const normalized = useMemo(() => normalizeLuckinCard(data) ?? data, [data]);
  return <LuckinDetailCard data={normalized} />;
}
