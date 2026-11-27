"use client";

import { useMemo } from "react";

/**
 * 京东卡：五条悟可以自己挑「详细卡 / 惊喜卡」。
 * 用法是在聊天正文里写一个围栏块，渲染层会把它变成卡片并从正文里剥掉：
 *
 * ```jd-card
 * { "type": "detail", "shop": "京喜自营官方店", "items": [{"title": "50包萌宠手帕纸", "price": "¥12.90", "qty": 1}],
 *   "orig": "¥17.90", "discount": "¥5.00", "total": "¥12.90", "wallet": "¥100.00",
 *   "address": "重庆 大足区 智凤街道 吾悦公馆1期足双便利店", "order_id": "3695441004610092",
 *   "status": "等待付款", "pay_left": "23:57:08" }
 * ```
 *
 * 惊喜卡同结构，type 换成 "surprise"，再加一句 "note"（他的私心话）。
 */

export type JdCardItem = { title: string; price?: string; qty?: number };

export type JdCardData = {
  type: "detail" | "surprise";
  shop?: string;
  items?: JdCardItem[];
  orig?: string;
  discount?: string;
  total?: string;
  wallet?: string;
  address?: string;
  order_id?: string;
  status?: string;
  pay_left?: string;
  note?: string;
  link?: string;
};

const ORDER_URL = "https://order.jd.com/center/list.action";
const ORANGE = "#e1251b"; // 京东红
const CHEESE = "#f5c869";

function normalizeJdCard(raw: unknown): JdCardData | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const type = d.type === "surprise" ? "surprise" : "detail";
  const itemsRaw = Array.isArray(d.items) ? d.items : [];
  const items: JdCardItem[] = [];
  for (const it of itemsRaw) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : "";
    if (!title) continue;
    const price =
      typeof o.price === "string" ? o.price : typeof o.price === "number" ? `¥${o.price}` : undefined;
    const qty = typeof o.qty === "number" ? o.qty : undefined;
    items.push({ title, price, qty });
  }
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : undefined);
  return {
    type,
    shop: str("shop"),
    items,
    orig: str("orig"),
    discount: str("discount"),
    total: str("total"),
    wallet: str("wallet"),
    address: str("address"),
    order_id: str("order_id"),
    status: str("status"),
    pay_left: str("pay_left"),
    note: str("note"),
    link: str("link"),
  };
}

const JD_CARD_RX = /```(?:jd-card|jd_card|京东卡|jingdong-card)\s*\n([\s\S]*?)```/gi;

/** 从消息正文里抽出所有京东卡块，返回卡片数据与去掉块之后的正文。 */
export function extractJdCards(text: string): { cards: JdCardData[]; rest: string } {
  const cards: JdCardData[] = [];
  const rest = text.replace(JD_CARD_RX, (_m, body: string) => {
    try {
      const parsed = normalizeJdCard(JSON.parse(String(body).trim()));
      if (parsed) cards.push(parsed);
    } catch {
      /* JSON 不合法就当没有这张卡，正文里的块被剥掉，不显示乱码 */
    }
    return "";
  });
  return { cards, rest: rest.replace(/\n{3,}/g, "\n\n").trim() };
}

function MenuRow({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
      <span style={{ color: "var(--c-text)", fontSize: 11.5 }}>{label}</span>
      <span
        style={{
          color: strong ? ORANGE : "var(--c-text-title)",
          fontSize: 11.5,
          fontWeight: strong ? 600 : 500,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function ItemLines({ items }: { items?: JdCardItem[] }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <span
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
          </span>
          {it.price ? (
            <span style={{ color: "var(--c-text-title)", fontSize: 12.5, flexShrink: 0 }}>{it.price}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** 备注：普通文字，不加框；字号颜色对齐同卡里的地址行 */
function NoteLine({ note, variant }: { note?: string; variant: "detail" | "surprise" }) {
  if (!note) return null;
  const style =
    variant === "surprise"
      ? { fontSize: 11, color: "#9b8a80", lineHeight: 1.5 }
      : { fontSize: 11.5, color: "var(--c-text)", lineHeight: 1.5 };
  const bar =
    variant === "surprise"
      ? { borderLeft: `3px solid ${CHEESE}`, paddingLeft: 9 }
      : {};
  return (
    <div style={{ marginTop: 8, ...style, ...bar }}>
      <div>备注</div>
      <div>{note}</div>
    </div>
  );
}

function ActionButtons({ data }: { data: JdCardData }) {
  const href = data.link || ORDER_URL;
  const shipped = Boolean(data.status && /收货|运输|派送|配送|已发货/.test(data.status));
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
          background: "linear-gradient(135deg,#e1251b,#f4523c)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          textDecoration: "none",
          boxShadow: "0 6px 14px rgba(225,37,27,0.24)",
        }}
      >
        {shipped ? "去京东看物流" : "去京东付款"}
      </a>
      {shipped ? null : (
        <a
          href={ORDER_URL}
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
          查订单/物流
        </a>
      )}
    </div>
  );
}

function DetailCard({ data }: { data: JdCardData }) {
  const statusColor = data.pay_left ? ORANGE : /已取消/.test(data.status || "") ? "var(--c-text)" : "var(--c-success)";
  const statusText = data.pay_left ? `${data.status} ${data.pay_left}` : data.status;
  /** 物流那种长文案（「运输中 重庆分拣中心 → 大足营业部」）单独占一行，别把店铺名挤掉 */
  const longStatus = Boolean(data.status && data.status.length > 9 && !data.pay_left);
  return (
    <div
      style={{
        margin: "10px 0",
        padding: "13px 14px 14px",
        borderRadius: 16,
        background: "var(--c-panel, var(--c-card))",
        border: "1px solid var(--c-card-border)",
        boxShadow: "0 8px 22px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: "#fff",
              background: ORANGE,
              borderRadius: 6,
              padding: "2px 6px",
              letterSpacing: 0.5,
            }}
          >
            京东
          </span>
          {data.shop ? (
            <span style={{ fontSize: 11.5, color: "var(--c-text)" }}>{data.shop}</span>
          ) : null}
        </div>
        {data.status && !longStatus ? (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: statusColor }}>{statusText}</span>
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
          {data.orig ? (
            <span style={{ fontSize: 11.5, color: "var(--c-text)", textDecoration: "line-through" }}>{data.orig}</span>
          ) : null}
          <span style={{ fontSize: 20, fontWeight: 700, color: ORANGE, letterSpacing: -0.3 }}>{data.total || "—"}</span>
        </div>
      </div>

      <MenuRow label="已优惠" value={data.discount ? `-${data.discount}` : undefined} />
      <MenuRow label="钱包余额" value={data.wallet} />
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

      <NoteLine note={data.note} variant="detail" />
      <ActionButtons data={data} />
    </div>
  );
}

function SurpriseCard({ data }: { data: JdCardData }) {
  return (
    <div
      style={{
        margin: "10px 0",
        borderRadius: 20,
        padding: 2,
        background: `linear-gradient(150deg, ${CHEESE}55, #ffd6e7 48%, #cfe3ff 100%)`,
        boxShadow: "0 10px 26px rgba(255,150,180,0.22)",
      }}
    >
      <div
        style={{
          borderRadius: 18,
          padding: "14px 15px 14px",
          background: "linear-gradient(165deg,#fffaf2,#fff6fa 60%,#f6f9ff)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#b4622d", fontWeight: 600 }}>
          <span>✨</span>
          <span>{data.note ? "偷偷给你挑好了" : "给你挑好了"}</span>
        </div>

        <div style={{ marginTop: 9, display: "flex", alignItems: "flex-end", gap: 8 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: ORANGE, letterSpacing: -1, lineHeight: 1 }}>
            {data.total || "—"}
          </span>
          {data.orig ? (
            <span style={{ fontSize: 12, color: "#b9a79a", textDecoration: "line-through", paddingBottom: 3 }}>
              {data.orig}
            </span>
          ) : null}
        </div>

        <NoteLine note={data.note} variant="surprise" />

        {data.address ? (
          <div style={{ marginTop: 9, fontSize: 11, color: "#9b8a80", lineHeight: 1.5 }}>
            <span style={{ marginRight: 4 }}>📍</span>
            {data.address}
          </div>
        ) : null}

        <ActionButtons data={data} />
      </div>
    </div>
  );
}

export function JdCard({ data }: { data: JdCardData }) {
  const normalized = useMemo(() => normalizeJdCard(data) ?? data, [data]);
  return normalized.type === "surprise" ? <SurpriseCard data={normalized} /> : <DetailCard data={normalized} />;
}
