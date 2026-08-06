// Lớp gọi API backend VietFit
// Mọi request đều gửi kèm Firebase ID token để server xác minh danh tính.
// API key Gemini KHÔNG còn tồn tại ở client - server giữ và gọi hộ.
import { getAuth } from "firebase/auth";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

async function apiFetch(path, body) {
  const user = getAuth().currentUser;
  if (!user) throw new Error("Bạn chưa đăng nhập.");

  const token = await user.getIdToken();

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Không kết nối được máy chủ. Kiểm tra server đã chạy chưa?");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Lỗi máy chủ (${res.status}).`);
  }
  return data;
}

/** Nhận diện món ăn từ ảnh (base64 JPEG đã nén) */
export const analyzeImage = (base64) => apiFetch("/api/analyze-image", { image: base64 });

/** Ước lượng dinh dưỡng theo tên món (server tự tra cache trước) */
export const analyzeText = (foodName) => apiFetch("/api/analyze-text", { foodName });

/** Tư vấn sức khỏe cá nhân hóa */
export const getHealthAdvice = (payload) => apiFetch("/api/health-advice", payload);

/** Số lượt AI đã dùng hôm nay */
export const getQuota = () => apiFetch("/api/quota");
