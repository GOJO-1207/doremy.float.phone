"use client";

import { useMemo } from "react";

/**
 * 京东卡（海盐芝士配色 · 蓝色主淡黄辅）：五条悟可以自己挑「详细卡 / 惊喜卡」。
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

/** 海盐芝士色卡：海盐蓝为主，芝士奶黄为辅 */
const C = {
  sea0: "#E7F1F7",
  sea1: "#BFD8E6",
  sea2: "#9EB7C6",
  seaDeep: "#5E8398",
  seaInk: "#46697D",
  cream: "#FFF2D9",
  creamSoft: "#FFF8EA",
  creamLine: "#EFE2C9",
  ink: "#35505E",
  inkSoft: "#7C95A4",
  line: "#E4EFF5",
  shadow: "rgba(158,183,198,0.34)",
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
  "radial-gradient(circle at 16% 14%, rgba(255,255,255,0.9) 0 1.6px, transparent 2.2px)," +
  "radial-gradient(circle at 74% 9%, rgba(158,183,198,0.35) 0 1.4px, transparent 2px)," +
  "radial-gradient(circle at 90% 44%, rgba(255,255,255,0.85) 0 1.5px, transparent 2.1px)," +
  "radial-gradient(circle at 32% 72%, rgba(158,183,198,0.25) 0 1.3px, transparent 1.9px)," +
  "radial-gradient(circle at 60% 90%, rgba(255,255,255,0.8) 0 1.4px, transparent 2px)";

/** 色卡上那颗四角星，白芯带一点海盐蓝的光 */
function Sparkle({ size = 14, opacity = 0.9 }: { size?: number; opacity?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        opacity,
        background: "#fff",
        clipPath: "polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%)",
        filter: "drop-shadow(0 0 5px rgba(191,216,230,0.95))",
      }}
    />
  );
}

function NoteBlock({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <div
      style={{
        marginTop: 10,
        background: C.creamSoft,
        borderRadius: 11,
        padding: "7px 10px 8px",
        border: `1px solid ${C.creamLine}`,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 1.2, color: "#A08A5F", marginBottom: 2 }}>备注</div>
      <div style={{ fontSize: 12, lineHeight: 1.65, color: C.seaInk, fontStyle: "italic" }}>{note}</div>
    </div>
  );
}

function MenuRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5 }}>
      <span style={{ color: C.inkSoft, fontSize: 11 }}>{label}</span>
      <span style={{ color: C.ink, fontSize: 11, fontWeight: 500 }}>{value}</span>
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
  const shipped = Boolean(data.status && /收货|运输|派送|配送|已发货|已完成|已签收/.test(data.status));
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
          background: `linear-gradient(135deg, ${C.sea2}, ${C.seaDeep})`,
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.3,
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
            background: C.creamSoft,
            color: C.seaDeep,
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            border: `1px solid ${C.creamLine}`,
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
  const statusColor = isCanceled ? C.inkSoft : isPending ? C.seaInk : C.seaDeep;
  const statusBg = isCanceled ? "#F3F7F9" : isPending ? C.cream : C.sea0;
  const statusText = data.pay_left ? `${data.status} ${data.pay_left}` : data.status;
  /** 物流那种长文案（「运输中 重庆分拣中心 → 大足营业部」）单独占一行，别把店铺名挤掉 */
  const longStatus = Boolean(data.status && data.status.length > 9 && !data.pay_left);
  const amountLabel = /收货|运输|派送|配送|已发货|已完成|已签收/.test(data.status || "") ? "金额" : "应付";
  return (
    <div
      style={{
        margin: "10px 0",
        borderRadius: 20,
        padding: 1,
        background: `linear-gradient(150deg, ${C.sea1}, ${C.cream} 52%, ${C.sea1})`,
        boxShadow: `0 12px 30px ${C.shadow}`,
      }}
    >
      <div
        style={{
          borderRadius: 19,
          padding: "13px 14px 14px",
          background:
            "radial-gradient(120% 78% at 0% 0%, rgba(255,242,217,0.6) 0%, rgba(255,242,217,0) 54%)," +
            "linear-gradient(165deg, #FFFFFF 0%, #F5FBFD 56%, #E8F3F9 100%)," +
            SALT_SPECKLE,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "#8C7749",
                background: C.cream,
                border: `1px solid ${C.creamLine}`,
                borderRadius: 6,
                padding: "1px 6px",
                letterSpacing: 0.6,
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
              <span style={{ fontSize: 11, color: C.inkSoft, textDecoration: "line-through", opacity: 0.85 }}>
                {data.orig}
              </span>
            ) : null}
            <span style={{ fontSize: 21, fontWeight: 700, color: C.seaInk, letterSpacing: -0.4 }}>
              {data.total || "—"}
            </span>
          </div>
        </div>

        <MenuRow label="已优惠" value={data.discount ? `-${data.discount}` : undefined} />
        <MenuRow label="钱包余额" value={data.wallet} />

        {data.address ? (
          <div style={{ marginTop: 9, fontSize: 11.5, color: C.inkSoft, lineHeight: 1.55 }}>
            <span style={{ marginRight: 5, color: C.seaDeep, opacity: 0.75 }}>◦</span>
            {data.address}
          </div>
        ) : null}
        {data.order_id ? (
          <div style={{ marginTop: 4, fontSize: 10.5, color: C.inkSoft, opacity: 0.8 }}>
            订单号 {data.order_id}
          </div>
        ) : null}

        <NoteBlock note={data.note} />
        <ActionButtons data={data} />
        {/收货|运输|派送|配送|已发货|已完成|已签收/.test(data.status || "") ? null : (
          <div style={{ marginTop: 7, fontSize: 10.5, color: C.inkSoft, textAlign: "center" }}>
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
        background: `linear-gradient(140deg, ${C.sea1}, ${C.cream} 48%, ${C.sea2})`,
        boxShadow: `0 14px 32px ${C.shadow}`,
      }}
    >
      <div
        style={{
          borderRadius: 21,
          padding: "15px 16px 15px",
          background:
            "radial-gradient(95% 68% at 2% 0%, rgba(255,246,228,0.55) 0%, rgba(255,246,228,0) 52%)," +
            "linear-gradient(168deg, #FBFEFF 0%, #E7F2F8 55%, #DBE9F2 100%)," +
            SALT_SPECKLE,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* 右上角一颗大白星，跟色卡上那颗一样 */}
        <div style={{ position: "absolute", top: 12, right: 14, opacity: 0.95 }}>
          <Sparkle size={22} />
        </div>
        <div style={{ position: "absolute", top: 44, right: 36, opacity: 0.7 }}>
          <Sparkle size={9} />
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.seaDeep }}>
            <Sparkle size={10} opacity={0.85} />
            <span style={{ letterSpacing: 1 }}>悄悄给你放好了</span>
          </div>

          <div style={{ marginTop: 10, display: "flex", alignItems: "flex-end", gap: 8 }}>
            <span
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: C.seaInk,
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
            <div style={{ marginTop: 9, fontSize: 11, color: C.inkSoft, lineHeight: 1.55 }}>
              <span style={{ marginRight: 5, color: C.seaDeep, opacity: 0.75 }}>◦</span>
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
