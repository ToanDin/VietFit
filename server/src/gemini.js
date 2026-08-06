// Toàn bộ lời gọi Gemini nằm ở đây - API key chỉ tồn tại phía server
import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PRIMARY_MODEL = "gemini-2.5-flash";
// Danh sách model dự phòng cho tính năng tư vấn sức khỏe
const HEALTH_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
];

// --- LÀM SẠCH KẾT QUẢ AI (chuyển từ client sang server để client không sửa được) ---
const toSafeNumber = (v, max = 10000) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n * 10) / 10, max);
};

export const sanitizeNutrition = (r) => ({
  name: (typeof r?.name === "string" && r.name.trim()) ? r.name.trim().slice(0, 100) : "Món ăn",
  weight: toSafeNumber(r?.weight, 5000) || 100,
  calories: toSafeNumber(r?.calories, 10000),
  carbs: toSafeNumber(r?.carbs, 1000),
  protein: toSafeNumber(r?.protein, 1000),
  fat: toSafeNumber(r?.fat, 1000),
  fiber: toSafeNumber(r?.fiber, 1000),
});

// Cắt đúng phần JSON trong text model trả về (phòng model kèm chữ thừa/```json)
const extractJson = (text) => {
  if (!text) throw new Error("AI không trả về kết quả.");
  const clean = text.replace(/```json|```/g, "").trim();
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  if (first === -1 || last === -1) throw new Error("AI trả về dữ liệu không hợp lệ.");
  return JSON.parse(clean.substring(first, last + 1));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Nhận diện món ăn từ ảnh (base64 JPEG), retry tối đa 2 lần khi API bận */
export async function analyzeImage(base64Data, retryCount = 0) {
  try {
    const response = await genAI.models.generateContent({
      model: PRIMARY_MODEL,
      contents: [{
        role: "user",
        parts: [
          { text: "Bạn là chuyên gia dinh dưỡng. Nhìn ảnh này. Trả về kết quả CHỈ LÀ MỘT JSON duy nhất: { \"name\": \"Tên món tiếng Việt ngắn gọn\", \"weight\": số_gam_ước_lượng, \"calories\": số_calo_nguyên, \"carbs\": số_gam_carb, \"protein\": số_gam_đạm, \"fat\": số_gam_béo, \"fiber\": số_gam_xơ }. Không thêm dấu ```json." },
          { inlineData: { mimeType: "image/jpeg", data: base64Data } },
        ],
      }],
    });
    return sanitizeNutrition(extractJson(response.text));
  } catch (error) {
    if (retryCount < 2) {
      await sleep(1500 * (retryCount + 1));
      return analyzeImage(base64Data, retryCount + 1);
    }
    console.error("Lỗi Gemini Vision:", error?.message || error);
    throw new Error("Hệ thống AI đang bận hoặc quá tải, vui lòng thử lại sau vài giây.");
  }
}

/** Ước lượng dinh dưỡng từ tên món ăn */
export async function analyzeText(foodName) {
  const response = await genAI.models.generateContent({
    model: PRIMARY_MODEL,
    contents: `Ước lượng dinh dưỡng món: "${foodName}". Trả về JSON: {"name": "Tên", "weight": 100, "calories": 100, "carbs": 10, "protein": 5, "fat": 2, "fiber": 1}. Không giải thích.`,
    config: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });
  return sanitizeNutrition(extractJson(response.text));
}

/** Tư vấn sức khỏe - thử lần lượt các model khi model trước lỗi/quá tải */
export async function healthAdvice({ gender, bmi, status, note }) {
  const statusMap = {
    tired: "mệt mỏi, thiếu năng lượng",
    normal: "bình thường",
    energetic: "sung sức, muốn tập luyện mạnh",
    sore: "đang bị đau nhức cơ bắp",
  };

  const prompt = `Bạn là chuyên gia dinh dưỡng VietFit.
    Bệnh nhân: ${gender === "male" ? "Nam" : "Nữ"}, BMI ${bmi}.
    Trạng thái hôm nay: Người dùng cảm thấy ${statusMap[status] || "bình thường"}.
    Ghi chú chi tiết từ người dùng: "${note || "Không có ghi chú thêm"}"
    Dựa vào thông tin trên, hãy đưa ra:
    1. Lời khuyên chẩn đoán ngắn gọn, bám sát ghi chú chi tiết nếu có.
    2. Đề xuất 3 món ăn Việt phù hợp nhất hôm nay (kèm calo).
    3. Đề xuất 3 bài tập phù hợp.
    TRẢ VỀ JSON DUY NHẤT: {"diagnosis": "...", "foods": [{"name": "...", "cal": 0}], "exercises": ["..."]}`;

  let lastError = null;
  for (const model of HEALTH_MODELS) {
    try {
      const response = await genAI.models.generateContent({ model, contents: prompt });
      const data = extractJson(response.text);

      // Đảm bảo đúng cấu trúc trước khi trả cho client
      return {
        diagnosis: typeof data.diagnosis === "string" ? data.diagnosis.slice(0, 1000) : "Hãy duy trì chế độ ăn cân bằng và vận động đều đặn.",
        foods: Array.isArray(data.foods)
          ? data.foods.slice(0, 3).map((f) => ({
              name: String(f?.name || "Món ăn").slice(0, 100),
              cal: toSafeNumber(f?.cal, 5000),
            }))
          : [],
        exercises: Array.isArray(data.exercises)
          ? data.exercises.slice(0, 3).map((e) => String(e).slice(0, 200))
          : [],
      };
    } catch (error) {
      lastError = error;
      // Thử model tiếp theo
    }
  }
  console.error("Lỗi Gemini Health (tất cả model):", lastError?.message || lastError);
  throw new Error("Hệ thống AI đang bận, vui lòng thử lại sau.");
}
