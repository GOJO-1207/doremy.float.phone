"use client";

import { useMemo } from "react";

/**
 * 京东卡（海盐芝士配色）：五条悟可以自己挑「详细卡 / 惊喜卡」。
 * 用法是在聊天正文里写一个围栏块，渲染层会把它变成卡片并从正文里剥掉：
 *
 * ```jd-card
 * { "type": "detail", "shop": "京喜自营官方店", "items": [{"title": "50包萌宠手帕纸", "price": "¥12.90", "qty": 1}],
 *   "orig": "¥17.90", "discount": "¥5.00", "total": "¥12.90", "wallet": "¥100.00",
 *   "address": "重庆 大足区 智凤街道 吾悦公馆1期足双便利店", "order_id": "3695441004610092",
 *   "status": "等待付款", "pay_left": "23:57:08", "note": "顺手给你带的" }
 * ```
 *
 * 惊喜卡同结构，type 换成 "surprise"：不显示商品名，只留价格、备注和他的私心话。
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

/** 海盐芝士：奶油芝士黄 + 海盐蓝灰 + 温白 */
const C = {
  cheese: "#C79A4E",
  cheeseDeep: "#9C6F22",
  cheeseSoft: "#F7E9C9",
  cheeseBar: "#E6C98D",
  salt: "#7FA2BE",
  saltDeep: "#4E7B9C",
  saltSoft: "#E6EFF6",
  cream: "#FBF7EC",
  ink: "#3D3A33",
  inkSoft: "#8A8579",
  line: "#E7DFCC",
  shadow: "rgba(160,150,120,0.16)",
};

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

/** 海盐颗粒：细小的白点与蓝灰点，铺在卡片底色上 */
const SALT_SPECKLE =
  "radial-gradient(circle at 18% 12%, rgba(255,255,255,0.95) 0 1.6px, transparent 2.2px)," +
  "radial-gradient(circle at 72% 8%, rgba(127,162,190,0.35) 0 1.4px, transparent 2px)," +
  "radial-gradient(circle at 88% 40%, rgba(255,255,255,0.9) 0 1.5px, transparent 2.1px)," +
  "radial-gradient(circle at 30% 66%, rgba(127,162,190,0.28) 0 1.3px, transparent 1.9px)," +
  "radial-gradient(circle at 62% 88%, rgba(255,255,255,0.85) 0 1.4px, transparent 2px)";

function NoteBlock({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <div
      style={{
        marginTop: 10,
        background: `linear-gradient(180deg, ${C.cheeseSoft}99, ${C.saltSoft}77)`,
        borderRadius: 10,
        padding: "7px 10px 8px",
        border: `1px solid ${C.line}`,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 1, color: C.cheeseDeep, opacity: 0.85, marginBottom: 2 }}>
        备注
      </div>
      <div style={{ fontSize: 12, lineHeight: 1.65, color: C.ink, fontStyle: "italic", opacity: 0.9 }}>
        {note}
      </div>
    </div>
  );
}

function MenuRow({ label, value, strong }: { label: string; value?: string; strong?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5 }}>
      <span style={{ color: C.inkSoft, fontSize: 11 }}>{label}</span>
      <span style={{ color: strong ? C.cheeseDeep : C.ink, fontSize: 11, fontWeight: strong ? 600 : 500 }}>
        {value}
      </span>
    </div>
  );
}

function ItemLines({ items }: { items?: JdCardItem[] }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 9 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
          <span
            style={{
              color: C.ink,
              fontSize: 12.5,
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {it.title}
            {it.qty && it.qty > 1 ? ` ×${it.qty}` : ""}
          </span>
          {it.price ? <span style={{ color: C.ink, fontSize: 12.5, flexShrink: 0 }}>{it.price}</span> : null}
        </div>
      ))}
    </div>
  );
}

function ActionButtons({ data, compact }: { data: JdCardData; compact?: boolean }) {
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
          padding: compact ? "8px 0" : "9px 0",
          borderRadius: 999,
          background: `linear-gradient(135deg, ${C.cheese}, ${C.salt})`,
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.2,
          textDecoration: "none",
          boxShadow: `0 6px 16px ${C.shadow}`,
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
            padding: compact ? "8px 0" : "9px 0",
            borderRadius: 999,
            background: C.saltSoft,
            color: C.saltDeep,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            border: `1px solid ${C.line}`,
          }}
        >
          查订单/物流
        </a>
      )}
    </div>
  );
}

function DetailCard({ data }: { data: JdCardData }) {
  const isPending = Boolean(data.pay_left);
  const isCanceled = /已取消|已关闭/.test(data.status || "");
  const statusColor = isCanceled ? C.inkSoft : isPending ? C.cheeseDeep : C.saltDeep;
  const statusBg = isCanceled ? C.cream : isPending ? C.cheeseSoft : C.saltSoft;
  const statusText = data.pay_left ? `${data.status} ${data.pay_left}` : data.status;
  /** 物流那种长文案（「运输中 重庆分拣中心 → 大足营业部」）单独占一行，别把店铺名挤掉 */
  const longStatus = Boolean(data.status && data.status.length > 9 && !data.pay_left);
  const amountLabel = /收货|运输|派送|配送|已发货|已完成|已签收/.test(data.status || "") ? "金额" : "应付";
  return (
    <div
      style={{
        margin: "10px 0",
        borderRadius: 18,
        padding: 1,
        background: `linear-gradient(150deg, ${C.cheeseBar}66, ${C.salt}44 60%, ${C.cheeseSoft})`,
        boxShadow: `0 10px 26px ${C.shadow}`,
      }}
    >
      <div
        style={{
          borderRadius: 17,
          padding: "13px 14px 14px",
          background: `linear-gradient(165deg, #FFFDF7, ${C.cream} 55%, #F4F8FB), ${SALT_SPECKLE}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: C.cheeseDeep,
                background: C.cheeseSoft,
                border: `1px solid ${C.cheeseBar}`,
                borderRadius: 6,
                padding: "1px 6px",
                letterSpacing: 0.5,
                flexShrink: 0,
              }}
            >
              京东
            </span>
            {data.shop ? (
              <span
                style={{
                  fontSize: 11.5,
                  color: C.inkSoft,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {data.shop}
              </span>
            ) : null}
          </div>
          {data.status && !longStatus ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: statusColor,
                background: statusBg,
                borderRadius: 999,
                padding: "2px 8px",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {statusText}
            </span>
          ) : null}
        </div>

        {longStatus ? (
          <div
            style={{
              marginTop: 8,
              display: "inline-block",
              maxWidth: "100%",
              fontSize: 11,
              fontWeight: 600,
              color: statusColor,
              background: statusBg,
              borderRadius: 8,
              padding: "3px 8px",
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}
          >
            {statusText}
          </div>
        ) : null}

        <ItemLines items={data.items} />

        <div style={{ height: 1, background: C.line, margin: "11px 0 8px" }} />

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontSize: 11, color: C.inkSoft }}>{amountLabel}</span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            {data.orig ? (
              <span style={{ fontSize: 11, color: C.inkSoft, textDecoration: "line-through", opacity: 0.8 }}>
                {data.orig}
              </span>
            ) : null}
            <span style={{ fontSize: 21, fontWeight: 700, color: C.cheeseDeep, letterSpacing: -0.4 }}>
              {data.total || "—"}
            </span>
          </div>
        </div>

        <MenuRow label="已优惠" value={data.discount ? `-${data.discount}` : undefined} />
        <MenuRow label="钱包余额" value={data.wallet} />

        {data.address ? (
          <div style={{ marginTop: 9, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.55 }}>
            <span style={{ marginRight: 4 }}>📍</span>
            {data.address}
          </div>
        ) : null}
        {data.order_id ? (
          <div style={{ marginTop: 4, fontSize: 10.5, color: C.inkSoft, opacity: 0.72 }}>
            订单号 {data.order_id}
          </div>
        ) : null}

        <NoteBlock note={data.note} />
        <ActionButtons data={data} />
        {/收货|运输|派送|配送|已发货|已完成|已签收/.test(data.status || "") ? null : (
          <div style={{ marginTop: 7, fontSize: 10.5, color: C.inkSoft, opacity: 0.75, textAlign: "center" }}>
            付款在你手机上完成，我这边不碰密码
          </div>
        )}
      </div>
    </div>
  );
}

function SurpriseCard({ data }: { data: JdCardData }) {
  return (
    <div
      style={{
        margin: "10px 0",
        borderRadius: 22,
        padding: 1.5,
        background: `linear-gradient(145deg, ${C.cheeseBar}, #DCEAF3 46%, ${C.cheeseSoft})`,
        boxShadow: `0 12px 28px ${C.shadow}`,
      }}
    >
      <div
        style={{
          borderRadius: 21,
          padding: "15px 16px 15px",
          background: `linear-gradient(168deg, #FFFBEF, #F5FAFD 58%, #FAF4E4), ${SALT_SPECKLE}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 海盐颗粒上压一层极淡的斜光 */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(120deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 42%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.cheeseDeep }}>
            <span style={{ fontSize: 13 }}>✦</span>
            <span style={{ letterSpacing: 0.6 }}>悄悄给你放好了</span>
          </div>

          <div style={{ marginTop: 10, display: "flex", alignItems: "flex-end", gap: 8 }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: C.cheeseDeep,
                letterSpacing: -1.2,
                lineHeight: 1,
              }}
            >
              {data.total || "—"}
            </span>
            {data.orig ? (
              <span style={{ fontSize: 12, color: C.inkSoft, textDecoration: "line-through", paddingBottom: 4 }}>
                {data.orig}
              </span>
            ) : null}
          </div>

          <NoteBlock note={data.note} />

          {data.address ? (
            <div style={{ marginTop: 9, fontSize: 11, color: C.inkSoft, lineHeight: 1.55, opacity: 0.9 }}>
              <span style={{ marginRight: 4 }}>📍</span>
              {data.address}
            </div>
          ) : null}

          <ActionButtons data={data} compact />
        </div>
      </div>
    </div>
  );
}

export function JdCard({ data }: { data: JdCardData }) {
  const normalized = useMemo(() => normalizeJdCard(data) ?? data, [data]);
  return normalized.type === "surprise" ? <SurpriseCard data={normalized} /> : <DetailCard data={normalized} />;
}
