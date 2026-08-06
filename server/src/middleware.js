// Middleware xác thực + quota theo ngày
import { adminAuth, db } from "./firebase.js";

const DAILY_LIMIT = parseInt(process.env.DAILY_AI_LIMIT || "20", 10);
const TIMEZONE = process.env.TIMEZONE || "Asia/Ho_Chi_Minh";

// Ngày YYYY-MM-DD theo múi giờ Việt Nam (server có thể chạy ở UTC)
export const localDateString = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date());

/**
 * Xác minh Firebase ID token gửi kèm header "Authorization: Bearer <token>".
 * Token này do Firebase Auth cấp cho user sau khi đăng nhập ở client -
 * server xác minh được chữ ký mà KHÔNG cần tin client.
 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "Bạn chưa đăng nhập." });
  }
  try {
    req.user = await adminAuth.verifyIdToken(token);
    return next();
  } catch (err) {
    // In lý do cụ thể ra terminal server để dễ chẩn đoán
    console.error("[AUTH] verifyIdToken thất bại:", err?.code || "", err?.message || err);
    return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
  }
}

/**
 * Trừ 1 lượt quota AI của user trong ngày (transaction để không bị race).
 * Trả về { allowed, used, limit }. Gọi hàm này NGAY TRƯỚC khi gọi Gemini -
 * cache hit thì không gọi, để không tốn lượt của user.
 */
export async function consumeQuota(uid) {
  const today = localDateString();
  const ref = db.collection("ai_usage").doc(`${uid}_${today}`);

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? (snap.data().count || 0) : 0;
    if (count >= DAILY_LIMIT) return { allowed: false, used: count };
    tx.set(ref, { uid, date: today, count: count + 1 }, { merge: true });
    return { allowed: true, used: count + 1 };
  });

  return { ...result, limit: DAILY_LIMIT };
}

/** Đọc quota hiện tại mà không trừ lượt (cho endpoint GET /api/quota) */
export async function readQuota(uid) {
  const today = localDateString();
  const snap = await db.collection("ai_usage").doc(`${uid}_${today}`).get();
  return {
    used: snap.exists ? (snap.data().count || 0) : 0,
    limit: DAILY_LIMIT,
    date: today,
  };
}
