// Điểm khởi động server VietFit
// LƯU Ý: dòng import dotenv phải đứng ĐẦU TIÊN để nạp .env
// trước khi các module khác đọc process.env
import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { api } from "./routes.js";

const app = express();

// Chỉ cho phép frontend của mình gọi API
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());
app.use(cors({ origin: allowedOrigins }));

// Ảnh base64 sau khi nén ~100-300KB, để trần 10mb là rất dư
app.use(express.json({ limit: "10mb" }));

// Chống spam theo IP (lớp ngoài; quota theo user là lớp trong)
app.use(rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Health check công khai (cho Render/Railway ping)
app.get("/healthz", (req, res) => res.json({ ok: true }));

app.use("/api", api);

// Bắt lỗi tập trung - không lộ chi tiết nội bộ ra ngoài
app.use((err, req, res, next) => {
  console.error("[ERROR]", err?.message || err);
  const message = err?.message?.startsWith("Hệ thống AI")
    ? err.message
    : "Lỗi máy chủ, vui lòng thử lại sau.";
  res.status(500).json({ error: message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ VietFit server đang chạy tại http://localhost:${port}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  Chưa có GEMINI_API_KEY trong server/.env - các endpoint AI sẽ lỗi!");
  }
});
