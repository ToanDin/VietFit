// Entry point cho Vercel - mỗi request được rewrite vào function này
// (Express app bản chất là một hàm (req, res) nên export trực tiếp được)
import app from "../src/app.js";

export default app;
