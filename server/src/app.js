// Dựng app Express - KHÔNG listen ở đây.
// - Chạy local: src/index.js import app rồi app.listen(...)
// - Chạy Vercel: api/index.js export app làm serverless handler
import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { api } from "./routes.js";

const app = express();

// Chỉ cho phép frontend của mình gọi API
// (trên Vercel: đặt ALLOWED_ORIGIN = https://ten-app.vercel.app,http://localhost:5173)
const allowedOrigins = (process.env.ALLOWED_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());
app.use(cors({ origin: allowedOrigins }));

// Ảnh base64 sau khi nén ~100-300KB, để trần 10mb là rất dư
app.use(express.json({ limit: "10mb" }));

// Chống spam theo IP - lớp ngoài (trên serverless chỉ có tác dụng per-instance,
// quota thật theo user nằm ở Firestore nên vẫn chắc chắn)
app.use(rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Health check công khai
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

export default app;
