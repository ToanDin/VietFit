// Điểm khởi động khi chạy LOCAL (npm run dev / npm start)
// Trên Vercel không dùng file này - xem api/index.js
import app from "./app.js";

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ VietFit server đang chạy tại http://localhost:${port}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn("⚠️  Chưa có GEMINI_API_KEY trong server/.env - các endpoint AI sẽ lỗi!");
  }
});
