// Định nghĩa các API endpoint - tất cả đều yêu cầu đăng nhập
import { Router } from "express";
import { requireAuth, consumeQuota, readQuota } from "./middleware.js";
import { analyzeImage, analyzeText, healthAdvice } from "./gemini.js";
import { db } from "./firebase.js";

export const api = Router();
api.use(requireAuth);

// Chuẩn hóa tên món để làm khóa cache: "  Phở  Bò " -> "phở bò"
const normalizeName = (s) => s.trim().toLowerCase().normalize("NFC").replace(/\s+/g, " ");

/**
 * POST /api/analyze-image  { image: "<base64 jpeg>" }
 * Nhận diện món ăn từ ảnh. Mỗi ảnh là duy nhất nên không cache.
 */
api.post("/analyze-image", async (req, res, next) => {
  try {
    const { image } = req.body || {};
    if (typeof image !== "string" || image.length < 100) {
      return res.status(400).json({ error: "Thiếu dữ liệu ảnh." });
    }
    if (image.length > 8_000_000) {
      return res.status(413).json({ error: "Ảnh quá lớn." });
    }

    const quota = await consumeQuota(req.user.uid);
    if (!quota.allowed) {
      return res.status(429).json({ error: `Bạn đã dùng hết ${quota.limit} lượt AI hôm nay. Hãy quay lại vào ngày mai nhé!` });
    }

    const nutrition = await analyzeImage(image);
    return res.json({ ...nutrition, quota: { used: quota.used, limit: quota.limit } });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/analyze-text  { foodName: "phở bò" }
 * Ước lượng dinh dưỡng theo tên món. Tra cache dùng chung trước -
 * cache hit thì trả ngay, không tốn lượt quota, không tốn phí Gemini.
 */
api.post("/analyze-text", async (req, res, next) => {
  try {
    const { foodName } = req.body || {};
    if (typeof foodName !== "string" || !foodName.trim()) {
      return res.status(400).json({ error: "Thiếu tên món ăn." });
    }

    // 1. Tra cache (khóa an toàn cho doc id: encode + giới hạn độ dài)
    const cacheKey = encodeURIComponent(normalizeName(foodName)).slice(0, 900);
    const cacheRef = db.collection("food_cache").doc(cacheKey);
    const cached = await cacheRef.get();
    if (cached.exists) {
      return res.json({ ...cached.data().nutrition, cached: true });
    }

    // 2. Chưa có cache -> trừ quota rồi gọi AI
    const quota = await consumeQuota(req.user.uid);
    if (!quota.allowed) {
      return res.status(429).json({ error: `Bạn đã dùng hết ${quota.limit} lượt AI hôm nay. Hãy quay lại vào ngày mai nhé!` });
    }

    const nutrition = await analyzeText(foodName.trim());

    // 3. Lưu cache cho những người hỏi sau (best-effort, lỗi cũng không sao)
    cacheRef.set({
      query: normalizeName(foodName),
      nutrition,
      createdAt: new Date().toISOString(),
      createdBy: req.user.uid,
    }).catch((e) => console.error("Lỗi ghi cache:", e?.message));

    return res.json({ ...nutrition, cached: false, quota: { used: quota.used, limit: quota.limit } });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/health-advice  { gender, bmi, status, note }
 * Tư vấn sức khỏe cá nhân hóa.
 */
api.post("/health-advice", async (req, res, next) => {
  try {
    const { gender, bmi, status, note } = req.body || {};
    const bmiNum = Number(bmi);
    if (!Number.isFinite(bmiNum) || bmiNum < 8 || bmiNum > 80) {
      return res.status(400).json({ error: "Chỉ số BMI không hợp lệ." });
    }

    const quota = await consumeQuota(req.user.uid);
    if (!quota.allowed) {
      return res.status(429).json({ error: `Bạn đã dùng hết ${quota.limit} lượt AI hôm nay. Hãy quay lại vào ngày mai nhé!` });
    }

    const advice = await healthAdvice({
      gender: gender === "female" ? "female" : "male",
      bmi: bmiNum.toFixed(1),
      status: String(status || "normal").slice(0, 20),
      note: String(note || "").slice(0, 500),
    });
    return res.json(advice);
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/quota
 * Xem số lượt AI đã dùng hôm nay (không trừ lượt).
 */
api.get("/quota", async (req, res, next) => {
  try {
    return res.json(await readQuota(req.user.uid));
  } catch (err) {
    return next(err);
  }
});
