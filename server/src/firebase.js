// Khởi tạo Firebase Admin SDK - chạy ở server với quyền admin,
// dùng để (1) xác minh ID token của user và (2) đọc/ghi Firestore
// (Admin SDK bỏ qua Security Rules nên collection ai_usage / food_cache
//  không cần mở quyền cho client)
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { readFileSync, existsSync } from "node:fs";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

let credential;
if (credPath && existsSync(credPath)) {
  const serviceAccount = JSON.parse(readFileSync(credPath, "utf8"));
  console.log(`🔑 Đã nạp service account: ${credPath} (project: ${serviceAccount.project_id})`);
  if (serviceAccount.project_id !== "vietfit") {
    console.warn(`⚠️  Service account thuộc project "${serviceAccount.project_id}" nhưng app Firebase của client là "vietfit" - verify token SẼ THẤT BẠI (401). Hãy tải key từ đúng project vietfit.`);
  }
  credential = cert(serviceAccount);
} else {
  console.warn(`⚠️  KHÔNG tìm thấy file service account tại "${credPath}" (thư mục đang chạy: ${process.cwd()}).`);
  console.warn("   → Tải từ Firebase Console (Project settings → Service accounts → Generate new private key)");
  console.warn("   → Lưu thành server/serviceAccountKey.json rồi chạy lại. Mọi request sẽ bị 401 cho tới khi có file này.");
  // Fallback: dùng Application Default Credentials (khi deploy lên Cloud Run...)
  credential = applicationDefault();
}

const app = initializeApp({ credential });

export const adminAuth = getAuth(app);
export const db = getFirestore(app);
