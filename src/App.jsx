import React, { useState, useEffect, useRef } from 'react';
import HealthPage from './Health';
import InfoPage from './Info';
import { BookOpen } from 'lucide-react';
import Login from './Login';
// 1. IMPORT CÁC THƯ VIỆN
import { analyzeImage, analyzeText } from './api';
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signOut,
  onAuthStateChanged
} from "firebase/auth"; 
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDoc,
  setDoc
} from "firebase/firestore";

// --- IMPORT THƯ VIỆN BIỂU ĐỒ (MỚI) ---
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

import {
  Utensils, Trash2, Flame, Scale,
  RotateCcw, Info, ChevronRight, ChevronLeft, Calendar,
  Home, User, Plus, Download, Settings, Edit2, Heart,
  Camera, Loader2, Sun, Moon, Coffee, X, Sparkles, Weight, BarChart2
} from 'lucide-react';

// 2. CẤU HÌNH FIREBASE & API
const firebaseConfig = {
  apiKey: "AIzaSyD-2QpFWAYbZM_MK46ccOVdd-yFZiPf-cE",
  authDomain: "vietfit.firebaseapp.com",
  projectId: "vietfit",
  storageBucket: "vietfit.firebasestorage.app",
  messagingSenderId: "433726638124",
  appId: "1:433726638124:web:7959bd358715b99cd4a989",
  measurementId: "G-DPCBN0B3KN"
};

// LƯU Ý BẢO MẬT: mọi lời gọi Gemini giờ đi qua backend (xem src/api.js
// và thư mục server/) - API key không còn nằm trong bundle của client.

// Khởi tạo Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- HELPER: NGÀY THEO GIỜ ĐỊA PHƯƠNG ---
// Lưu ý: KHÔNG dùng toISOString() vì nó trả về ngày theo UTC.
// Ở Việt Nam (UTC+7), trước 7h sáng toISOString() sẽ ra... ngày hôm trước.
const getLocalDateString = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Chuyển chuỗi "YYYY-MM-DD" thành Date theo giờ địa phương
// (new Date("YYYY-MM-DD") sẽ hiểu là nửa đêm UTC → sai ngày)
const parseLocalDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// (Việc làm sạch/validate kết quả AI giờ do server đảm nhiệm - xem server/src/gemini.js)

// 3. DỮ LIỆU MẪU
const COMMON_FOODS = [
  { name: 'Cơm trắng (1 bát)', weight: 150, calories: 130, carbs: 28, protein: 2.7, fat: 0.3, fiber: 0.4 },
  { name: 'Phở bò', weight: 400, calories: 450, carbs: 70, protein: 25, fat: 12, fiber: 2 },
  { name: 'Bánh mì thịt', weight: 200, calories: 400, carbs: 50, protein: 15, fat: 18, fiber: 3 },
  { name: 'Trứng luộc', weight: 50, calories: 78, carbs: 0.6, protein: 6, fat: 5, fiber: 0 },
  { name: 'Ức gà luộc', weight: 100, calories: 165, carbs: 0, protein: 31, fat: 3.6, fiber: 0 },
  { name: 'Chuối (1 quả)', weight: 100, calories: 90, carbs: 23, protein: 1.1, fat: 0.3, fiber: 2.6 },
  { name: 'Cà phê sữa đá', weight: 250, calories: 300, carbs: 40, protein: 5, fat: 10, fiber: 0 },
];

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Bữa Sáng', icon: <Coffee size={18} className="text-orange-500" /> },
  { id: 'lunch', label: 'Bữa Trưa', icon: <Sun size={18} className="text-yellow-500" /> },
  { id: 'dinner', label: 'Bữa Chiều/Tối', icon: <Moon size={18} className="text-indigo-500" /> },
];

const ACTIVITY_LEVELS = [
  { val: '1.2', label: 'Vô cùng không hoạt động', desc: 'Bệnh nhân/Người nằm tại chỗ' },
  { val: '1.5', label: 'Ít vận động', desc: 'Nhân viên văn phòng, ít tập thể dục' },
  { val: '1.75', label: 'Hoạt động vừa phải', desc: 'Công nhân xây dựng, chạy 1h/ngày' },
  { val: '2.2', label: 'Hoạt động mạnh mẽ', desc: 'Nông nghiệp, bơi 2h/ngày' },
  { val: '2.4', label: 'Cực kỳ năng động', desc: 'Vận động viên chuyên nghiệp' },
];
// 4. APP CHÍNH
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // User State
  // Lưu ý: activityLevel phải là một giá trị có trong ACTIVITY_LEVELS
  const [userInfo, setUserInfo] = useState({ gender: 'male', age: 25, height: 170, weight: 70, activityLevel: '1.5' });
  const [step, setStep] = useState(1);
  const [activeTab, setActiveTab] = useState('home');
  const [tdee, setTdee] = useState(0);
  const [targetCalories, setTargetCalories] = useState(0);

  // Data State
  const [meals, setMeals] = useState([]);
  const [currentDate, setCurrentDate] = useState(getLocalDateString());

  // Form State
  const [newMealName, setNewMealName] = useState('');
  const [newMealCalories, setNewMealCalories] = useState('');
  const [newMealWeight, setNewMealWeight] = useState('');
  const [newMealMacros, setNewMealMacros] = useState({ carbs: '', protein: '', fat: '', fiber: '' });

  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [showInfoModal, setShowInfoModal] = useState(false);
  // Scan State
  const [isScanning, setIsScanning] = useState(false);
  const [isTextSearching, setIsTextSearching] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const fileInputRef = useRef(null);
  const [originalNutrients, setOriginalNutrients] = useState(null);
  // --- AUTH & LOAD DATA ---
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);

    // Giữ tham chiếu để hủy listener meals khi đổi user / unmount
    // (trước đây listener không được hủy → leak + chồng listener sau mỗi lần đăng nhập lại)
    let mealsUnsub = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(timer);
      if (mealsUnsub) { mealsUnsub(); mealsUnsub = null; }

      if (user) {
        setCurrentUser(user);
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            setUserInfo(data.userInfo || userInfo);
            setTdee(data.tdee || 0);
            setTargetCalories(data.targetCalories || 0);
            setStep(2);
          } else {
            setStep(1);
          }
        } catch (error) {
          console.error("Lỗi tải profile:", error);
        }

        // Chỉ tải 30 ngày gần nhất thay vì toàn bộ lịch sử
        // (tránh chậm dần và tốn quota đọc Firestore khi dữ liệu lớn lên)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const cutoff = getLocalDateString(cutoffDate);

        const q = query(
          collection(db, "users", user.uid, "meals"),
          where("date", ">=", cutoff),
          orderBy("date", "desc")
        );
        mealsUnsub = onSnapshot(q, (snapshot) => {
          const loadedMeals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          // Sắp xếp món mới thêm lên trước trong cùng một ngày
          loadedMeals.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
          setMeals(loadedMeals);
        }, (error) => {
          console.error("Lỗi tải dữ liệu bữa ăn:", error);
        });
      } else {
        setCurrentUser(null);
        setMeals([]);
        setStep(1);
      }
      setLoading(false);
    });
    return () => {
      unsubscribe();
      if (mealsUnsub) mealsUnsub();
    };
  }, []);

  const changeDate = (days) => {
    const date = parseLocalDate(currentDate);
    date.setDate(date.getDate() + days);
    setCurrentDate(getLocalDateString(date));
  };

  const getDisplayDate = () => {
    const today = getLocalDateString();
    if (currentDate === today) return "Hôm nay";
    const [y, m, d] = currentDate.split('-');
    return `${d}/${m}/${y}`;
  };

  // --- HÀM NÉN ẢNH ---
  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      // Chặn file không phải ảnh (trước đây sẽ treo im lặng, VD ảnh HEIC trên iPhone)
      if (!file.type || !file.type.startsWith('image/')) {
        reject(new Error("File không phải là ảnh. Hãy chọn ảnh JPG hoặc PNG."));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Định dạng ảnh không được hỗ trợ. Hãy thử JPG hoặc PNG."));
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          // Không phóng to ảnh nhỏ hơn 800px (upscale chỉ làm ảnh mờ và nặng thêm)
          const scale = Math.min(1, 800 / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve({
            base64: dataUrl.split(',')[1],
            preview: dataUrl
          });
        };
      };
    });
  };

  // --- XỬ LÝ ẢNH ---
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsScanning(true);
    setScanResult(null);

    try {
      const { base64, preview } = await compressImage(file);
      // Server nhận diện, làm sạch dữ liệu và trả về object hoàn chỉnh
      const resultData = await analyzeImage(base64);

      setOriginalNutrients({ ...resultData }); // Lưu mốc gốc
      setScanResult({ ...resultData, image: preview });
      setNewMealName(resultData.name);
      setNewMealWeight(resultData.weight);
      setNewMealCalories(resultData.calories);
      setNewMealMacros({
        carbs: resultData.carbs,
        protein: resultData.protein,
        fat: resultData.fat,
        fiber: resultData.fiber
      });
    } catch (error) {
      alert(`⚠️ Không thể nhận diện ảnh: ${error.message}`);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const cancelScan = () => {
    setScanResult(null);
    setNewMealName('');
    setNewMealWeight('');
    setNewMealCalories('');
    setNewMealMacros({ carbs: '', protein: '', fat: '', fiber: '' });
  };

  // --- XỬ LÝ TEXT SEARCH ---
  const handleTextAnalysis = async () => {
    if (!newMealName.trim() || isTextSearching) return;

    setIsTextSearching(true);
    try {
      // Server tra cache trước (món phổ biến trả về tức thì, không tốn lượt AI),
      // chưa có cache mới gọi Gemini - kết quả đã được server làm sạch
      const result = await analyzeText(newMealName);

      setOriginalNutrients({ ...result });
      setNewMealName(result.name);
      setNewMealWeight(result.weight);
      setNewMealCalories(result.calories);
      setNewMealMacros({
        carbs: result.carbs,
        protein: result.protein,
        fat: result.fat,
        fiber: result.fiber
      });
    } catch (error) {
      alert(error.message || "AI đang bận hoặc không nhận diện được món này. Bạn hãy tự nhập nhé!");
    } finally {
      setIsTextSearching(false);
    }
  };
  // --- CÁC HÀM FIREBASE lưu dữ liệu ---
  const saveUserProfile = async () => {
    // 0. Kiểm tra dữ liệu nhập (input trả về chuỗi, có thể rỗng/âm/vô lý → BMR ra NaN)
    const age = parseFloat(userInfo.age);
    const height = parseFloat(userInfo.height);
    const weight = parseFloat(userInfo.weight);

    if (!(age >= 10 && age <= 100)) {
      alert("Tuổi không hợp lệ. Hãy nhập từ 10 đến 100.");
      return;
    }
    if (!(height >= 100 && height <= 250)) {
      alert("Chiều cao không hợp lệ. Hãy nhập từ 100 đến 250 cm.");
      return;
    }
    if (!(weight >= 25 && weight <= 300)) {
      alert("Cân nặng không hợp lệ. Hãy nhập từ 25 đến 300 kg.");
      return;
    }

    const validatedInfo = { ...userInfo, age, height, weight };

    // 1. Tính BMR (Cơ sở năng lượng) — công thức Mifflin-St Jeor
    let bmr = validatedInfo.gender === 'male'
      ? (10 * weight) + (6.25 * height) - (5 * age) + 5
      : (10 * weight) + (6.25 * height) - (5 * age) - 161;

    // 2. Tính TDEE sử dụng hệ số PAL từ bảng mức độ vận động
    const pal = parseFloat(validatedInfo.activityLevel) || 1.5; // Mặc định 1.5 nếu chưa chọn
    const tdeeVal = Math.round(bmr * pal);

    // 3. Tính mục tiêu calo (giảm 500 calo để giảm cân an toàn),
    //    không cho thấp hơn ngưỡng tối thiểu an toàn 1000 kcal/ngày
    const targetVal = Math.max(tdeeVal - 500, 1000);

    setUserInfo(validatedInfo);
    setTdee(tdeeVal);
    setTargetCalories(targetVal);

    try {
      await setDoc(doc(db, "users", currentUser.uid), {
        userInfo: validatedInfo, // đã ép kiểu số + gồm activityLevel mới
        tdee: tdeeVal,
        targetCalories: targetVal,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      setStep(2);
      setActiveTab('home');
    } catch (error) {
      alert("Lỗi lưu hồ sơ: " + error.message);
    }
  };

  const addMeal = async (e) => {
    e.preventDefault();
    if (!newMealName || !newMealCalories) return;
    try {
      await addDoc(collection(db, "users", currentUser.uid, "meals"), {
        name: newMealName,
        weight: parseInt(newMealWeight) || 0, // Lưu khối lượng
        calories: parseInt(newMealCalories),
        carbs: parseInt(newMealMacros.carbs) || 0,
        protein: parseInt(newMealMacros.protein) || 0,
        fat: parseInt(newMealMacros.fat) || 0,
        fiber: parseInt(newMealMacros.fiber) || 0,
        type: selectedMealType,
        date: currentDate,
        createdAt: new Date().toISOString()
      });
      // Reset form
      setNewMealName('');
      setNewMealWeight('');
      setNewMealCalories('');
      setNewMealMacros({ carbs: '', protein: '', fat: '', fiber: '' });
      setScanResult(null);
      setActiveTab('home');
    } catch (error) { alert("Lỗi lưu dữ liệu: " + error.message); }
  };

  const addCommonFood = async (food) => {
    try {
      await addDoc(collection(db, "users", currentUser.uid, "meals"), {
        name: food.name,
        weight: food.weight || 0,
        calories: food.calories,
        carbs: food.carbs || 0,
        protein: food.protein || 0,
        fat: food.fat || 0,
        fiber: food.fiber || 0,
        type: selectedMealType,
        date: currentDate,
        createdAt: new Date().toISOString()
      });
      setActiveTab('home');
    } catch (error) { alert("Lỗi lưu dữ liệu."); }
  };

  const removeMeal = async (id) => {
    if (window.confirm("Bạn muốn xóa món này?")) await deleteDoc(doc(db, "users", currentUser.uid, "meals", id));
  };

  const updateMealWeight = async (meal) => {
    const newWeightStr = window.prompt(`Nhập khối lượng mới cho ${meal.name} (g):`, meal.weight || 100);
    if (newWeightStr === null) return;
    const newWeight = parseFloat(newWeightStr);
    if (isNaN(newWeight) || newWeight <= 0) {
      alert("Khối lượng không hợp lệ!");
      return;
    }

    const oldWeight = meal.weight && meal.weight > 0 ? meal.weight : 100;
    const ratio = newWeight / oldWeight;

    const newCalories = Math.round(meal.calories * ratio);
    const newCarbs = Math.round((meal.carbs || 0) * ratio * 10) / 10;
    const newProtein = Math.round((meal.protein || 0) * ratio * 10) / 10;
    const newFat = Math.round((meal.fat || 0) * ratio * 10) / 10;
    const newFiber = Math.round((meal.fiber || 0) * ratio * 10) / 10;

    try {
      await setDoc(doc(db, "users", currentUser.uid, "meals", meal.id), {
        weight: newWeight,
        calories: newCalories,
        carbs: newCarbs,
        protein: newProtein,
        fat: newFat,
        fiber: newFiber
      }, { merge: true });
    } catch (error) {
      alert("Lỗi cập nhật: " + error.message);
    }
  };

  const handleLogout = () => { signOut(auth); setStep(1); setMeals([]); setActiveTab('home'); };
  const handleInputChange = (e) => setUserInfo({ ...userInfo, [e.target.name]: e.target.value });

  const exportData = () => {
    const headers = ['Ngay', 'Loai Bua', 'Ten Mon', 'Khoi Luong (g)', 'Calo (kcal)', 'Carb (g)', 'Dam (g)', 'Beo (g)', 'Chat Xo (g)'];
    
    const rows = meals.map(meal => {
      const type = meal.type === 'breakfast' ? 'Sang' : meal.type === 'lunch' ? 'Trua' : 'Toi';
      const name = `"${(meal.name || '').replace(/"/g, '""')}"`;
      return [
        meal.date,
        type,
        name,
        meal.weight || 0,
        meal.calories || 0,
        meal.carbs || 0,
        meal.protein || 0,
        meal.fat || 0,
        meal.fiber || 0
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // File chứa dữ liệu 30 ngày gần nhất → đặt tên theo ngày xuất, không theo ngày đang xem
    link.download = `vietfit_baocao_30ngay_${getLocalDateString()}.csv`;
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  const editProfile = () => { setStep(1); };

  // --- TÍNH TOÁN CALO ---
  // Number(...) || 0: phòng dữ liệu cũ lưu calo dạng chuỗi (cộng chuỗi sẽ thành nối chuỗi)
  const mealsByDate = meals.filter(meal => meal.date === currentDate);
  const totalCaloriesConsumed = mealsByDate.reduce((acc, meal) => acc + (Number(meal.calories) || 0), 0);
  const remainingCalories = targetCalories - totalCaloriesConsumed;
  // Guard chia cho 0: khi chưa có mục tiêu, progress = 0 thay vì NaN
  const progressPercentage = targetCalories > 0
    ? Math.min((totalCaloriesConsumed / targetCalories) * 100, 100)
    : 0;

  // --- LOGIC XỬ LÝ DỮ LIỆU BIỂU ĐỒ (7 NGÀY) ---
  const getLast7DaysData = () => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = getLocalDateString(d); // Ngày theo giờ địa phương, không dùng UTC
      const displayDay = `${d.getDate()}/${d.getMonth() + 1}`; // VD: 28/1

      // Lọc món ăn trong ngày đó
      const mealsInDay = meals.filter(m => m.date === dateKey);
      const totalCal = mealsInDay.reduce((acc, m) => acc + (Number(m.calories) || 0), 0);

      data.push({
        day: displayDay,
        cal: totalCal
      });
    }
    return data;
  };

  const chartData = getLast7DaysData();

  // --- UI RENDER: TAB HOME ---
  const renderHomeTab = () => (

    <div className="space-y-6 animate-fade-in pb-24">
      {/* Date Navigator */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
        <button onClick={() => changeDate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft size={20} className="text-gray-500" /></button>
        <div className="flex items-center gap-2 font-bold text-gray-700">
          <Calendar size={18} className="text-emerald-600" /> {getDisplayDate()}
        </div>
        <button onClick={() => changeDate(1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronRight size={20} className="text-gray-500" /></button>
      </div>

      {/* Main Stats Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10 text-center">
          <h2 className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-1">Còn lại hôm nay</h2>
          <div className={`text-5xl font-extrabold my-2 transition-colors ${remainingCalories < 0 ? 'text-red-500' : 'text-emerald-600'}`}>{remainingCalories}</div>
          <div className="text-sm text-gray-400 mb-6">Kcal</div>
          <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
            <div className={`h-3 rounded-full transition-all duration-1000 ease-out ${remainingCalories < 0 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${progressPercentage}%` }}></div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 font-medium px-1">
            <span>0</span>
            <span>Mục tiêu: {targetCalories}</span>
          </div>

          {remainingCalories < 0 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl animate-bounce">
              <p className="text-red-600 text-sm font-bold flex items-center justify-center gap-2">
                <Sparkles size={16} />
                Bạn đã vượt mục tiêu hôm nay, thử vận động nhẹ nhé!
              </p>
            </div>
          )}
          {/* --------------------------------------- */}
        </div>
      </div>

      {/* --- BIỂU ĐỒ 7 NGÀY (MỚI THÊM) --- */}
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
          <BarChart2 size={16} className="text-emerald-600" /> Thống kê 7 ngày
        </h3>
        {/* Thay h-48 bằng style={{ height: '200px' }} để đảm bảo Recharts luôn thấy được chiều cao */}
        <div className="w-full text-xs" style={{ height: '200px', minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart data={chartData}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
              <Tooltip
                cursor={{ fill: '#ECFDF5' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="cal" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.cal > targetCalories ? '#EF4444' : '#10B981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2 text-[10px] font-medium text-gray-400">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Đạt mục tiêu</div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Vượt quá</div>
        </div>
      </div>
      {/* ------------------------------- */}

      {/* Meal Lists */}
      <div>
        {MEAL_TYPES.map((type) => {
          const typeMeals = mealsByDate.filter(m => m.type === type.id);
          const typeCalories = typeMeals.reduce((acc, m) => acc + (Number(m.calories) || 0), 0);
          return (
            <div key={type.id} className="mb-6">
              <div className="flex justify-between items-center mb-3 px-2">
                <h4 className="font-bold text-gray-700 flex items-center gap-2">{type.icon} {type.label}</h4>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">{typeCalories} kcal</span>
              </div>
              {typeMeals.length === 0 ? (
                <div className="text-xs text-center text-gray-300 py-3 border-2 border-dashed border-gray-100 rounded-xl bg-gray-50/50">Chưa có món nào</div>
              ) : (
                <div className="space-y-2">
                  {typeMeals.map((meal) => (
                    <div key={meal.id} className="flex flex-col p-4 bg-white rounded-xl shadow-sm border border-gray-50 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-medium text-gray-800 text-lg">
                          {meal.name}
                          {/* Hiển thị Khối lượng ngay cạnh tên */}
                          {meal.weight > 0 && <span className="ml-2 text-xs text-gray-400 font-normal">({meal.weight}g)</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-emerald-600">{meal.calories} kcal</span>
                          <button onClick={() => updateMealWeight(meal)} title="Thay đổi khối lượng" className="p-1 hover:bg-blue-50 hover:text-blue-500 rounded-full transition-colors"><Edit2 size={16} /></button>
                          <button onClick={() => removeMeal(meal.id)} title="Xóa món ăn" className="p-1 hover:bg-red-50 hover:text-red-500 rounded-full transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </div>

                      <div className="flex gap-3 text-xs text-gray-500 font-medium">
                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">C: {meal.carbs || 0}g</span>
                        <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded">P: {meal.protein || 0}g</span>
                        <span className="text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">F: {meal.fat || 0}g</span>
                        {(meal.fiber > 0) && <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded">X: {meal.fiber}g</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
  const handleWeightChange = (value) => {
    const weight = parseFloat(value);
    setNewMealWeight(value);

    // Nếu đã có dữ liệu gốc và cân nặng hợp lệ
    if (originalNutrients && weight > 0) {
      const ratio = weight / (originalNutrients.weight || 100);

      setNewMealCalories(Math.round(originalNutrients.calories * ratio));
      setNewMealMacros({
        carbs: Math.round(originalNutrients.carbs * ratio * 10) / 10,
        protein: Math.round(originalNutrients.protein * ratio * 10) / 10,
        fat: Math.round(originalNutrients.fat * ratio * 10) / 10,
        fiber: Math.round(originalNutrients.fiber * ratio * 10) / 10,
      });
    }
  };
  // --- UI RENDER: TAB ADD ---
  const renderAddTab = () => (
    <div className="space-y-6 animate-fade-in pb-24 h-full flex flex-col">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-emerald-600" />
          Thêm vào: <span className="text-emerald-600">{getDisplayDate()}</span>
        </h2>

        <div className="grid grid-cols-3 gap-2 mb-6">
          {MEAL_TYPES.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedMealType(t.id)}
              className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${selectedMealType === t.id ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-1 ring-emerald-500' : 'bg-white border-gray-100 text-gray-400 hover:bg-gray-50'}`}
            >
              {t.icon}
              <span className="text-[10px] font-bold">{t.label}</span>
            </button>
          ))}
        </div>

        {/* AI Scanner Block */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-5 rounded-2xl shadow-lg shadow-indigo-200 text-white mb-6 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>

          <div className="flex justify-between items-center mb-3 relative z-10">
            <div>
              <div className="font-bold text-lg flex items-center gap-2"><Camera size={20} /> AI Scanner</div>
              <div className="text-xs text-indigo-100 opacity-80">Nhận diện món ăn tự động</div>
            </div>
            {isScanning && <Loader2 size={24} className="animate-spin text-white" />}
          </div>

          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageUpload}
          />

          <button
            onClick={() => fileInputRef.current.click()}
            disabled={isScanning}
            className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white font-bold py-3 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {isScanning ? 'Đang phân tích...' : '📸 Chụp / Tải ảnh lên'}
          </button>
        </div>

        {/* Scan Result Preview */}
        {scanResult && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3 animate-fade-in relative">
            <img src={scanResult.image} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-white shadow-sm" />
            <div className="flex-1">
              <div className="text-xs text-emerald-600 font-bold uppercase mb-0.5">AI Phát hiện</div>
              <div className="font-bold text-gray-800 line-clamp-1">{scanResult.name}</div>
              <div className="flex gap-2 items-center">
                <span className="text-xs font-bold text-gray-600 bg-gray-200 px-1 rounded">{scanResult.weight ? `${scanResult.weight}g` : '???g'}</span>
                <span className="text-xs text-gray-500">~{scanResult.calories} kcal</span>
              </div>
            </div>
            <button onClick={cancelScan} className="absolute top-2 right-2 text-gray-400 hover:text-red-500"><X size={16} /></button>
          </div>
        )}

        <form onSubmit={addMeal} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Tên món</label>
            <div className="relative">
              <input
                type="text"
                value={newMealName}
                onChange={(e) => setNewMealName(e.target.value)}
                placeholder="Nhập tên món (VD: Bún bò)..."
                className="w-full p-4 pr-12 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all font-medium text-gray-800 outline-none"
              />
              <button
                type="button"
                onClick={handleTextAnalysis}
                disabled={isTextSearching || !newMealName}
                className="absolute right-2 top-2 bottom-2 bg-white text-emerald-600 p-2 rounded-lg border border-gray-100 shadow-sm hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
                title="AI Tự động tính Calo"
              >
                {isTextSearching ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Sparkles size={20} className="group-hover:scale-110 transition-transform" />
                )}
              </button>
            </div>
          </div>

          {/* Grid nhập Macro */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'carbs', label: 'Carb', color: 'text-blue-600', bg: 'bg-blue-50' },
              { key: 'protein', label: 'Đạm', color: 'text-red-600', bg: 'bg-red-50' },
              { key: 'fat', label: 'Béo', color: 'text-yellow-600', bg: 'bg-yellow-50' },
              { key: 'fiber', label: 'Xơ', color: 'text-green-600', bg: 'bg-green-50' }
            ].map((item) => (
              <div key={item.key}>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 text-center">{item.label} (g)</label>
                <input
                  type="number"
                  value={newMealMacros[item.key]}
                  onChange={(e) => setNewMealMacros({ ...newMealMacros, [item.key]: e.target.value })}
                  placeholder="0"
                  className={`w-full p-2 text-center font-bold rounded-lg outline-none border border-transparent focus:border-gray-300 transition-all ${item.color} ${item.bg}`}
                />
              </div>
            ))}
          </div>

          {/* CỘT KHỐI LƯỢNG VÀ CALO ĐẶT CẠNH NHAU */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1 text-center">Khối lượng (g)</label>
              <div className="relative">
                {/* Tìm đoạn này trong code của bạn */}
                <input
                  type="number"
                  value={newMealWeight}
                  onChange={(e) => handleWeightChange(e.target.value)} // Thay đổi ở đây
                  placeholder="0"
                  className={`w-full p-4 text-center text-xl font-extrabold bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all text-gray-700 outline-none ${isTextSearching ? 'animate-pulse' : ''}`}
                />
                <div className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-300 pointer-events-none"><Scale size={16} /></div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1 text-center">Calo (kcal)</label>
              <div className="relative">
                <input
                  type="number"
                  value={newMealCalories}
                  onChange={(e) => setNewMealCalories(e.target.value)}
                  placeholder="0"
                  className={`w-full p-4 text-center text-xl font-extrabold bg-emerald-50 rounded-xl border border-transparent focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all text-emerald-600 outline-none ${isTextSearching ? 'animate-pulse' : ''}`}
                />
                <div className="absolute top-1/2 -translate-y-1/2 right-3 text-emerald-300 pointer-events-none"><Flame size={16} /></div>
              </div>
            </div>
          </div>

          <button type="submit" className={`w-full text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform ${scanResult ? 'bg-emerald-600 shadow-emerald-200' : 'bg-gray-800 shadow-gray-300'}`}>
            {scanResult ? '✅ Lưu kết quả AI' : 'Lưu Món Ăn'}
          </button>
        </form>
      </div>

      {/* Quick Suggestions */}
      <div className="flex-1">
        <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 px-2">Gợi ý nhanh</h3>
        <div className="grid grid-cols-2 gap-3">
          {COMMON_FOODS.map((f, i) => (
            <button key={i} onClick={() => addCommonFood(f)} className="bg-white p-3 rounded-xl border border-gray-100 text-left hover:border-emerald-500 hover:bg-emerald-50 transition-all group shadow-sm">
              <div className="font-medium text-gray-800 group-hover:text-emerald-700">{f.name}</div>
              <div className="flex gap-2 text-xs mt-1">
                <span className="text-emerald-600 font-bold">{f.calories} kcal</span>
                <span className="text-gray-400">| {f.weight}g</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // --- UI RENDER: TAB PROFILE ---
  const renderProfileTab = () => (
    <div className="bg-white rounded-3xl p-6 text-center relative shadow-sm border border-gray-100 animate-fade-in">
      <button onClick={handleLogout} className="absolute top-4 right-4 text-xs text-red-500 font-bold border border-red-100 px-3 py-1.5 rounded-full hover:bg-red-50 transition-colors">Đăng xuất</button>

      <div className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-emerald-50 shadow-lg overflow-hidden bg-gray-100">
        {currentUser?.photoURL ? <img src={currentUser.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : <User size={40} className="text-gray-400 m-auto mt-6" />}
      </div>

      <h2 className="text-xl font-bold text-gray-800">{currentUser?.displayName}</h2>
      <div className="text-emerald-600 font-medium text-sm mt-1 mb-6 bg-emerald-50 inline-block px-3 py-1 rounded-full">
        Mục tiêu: {targetCalories} kcal/ngày
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8 bg-gray-50 p-4 rounded-2xl">
        <div className="text-center"><div className="text-xs text-gray-400 uppercase font-bold mb-1">Cân nặng</div><div className="font-extrabold text-gray-800 text-lg">{userInfo.weight} <span className="text-xs font-normal">kg</span></div></div>
        <div className="text-center border-l border-r border-gray-200"><div className="text-xs text-gray-400 uppercase font-bold mb-1">Chiều cao</div><div className="font-extrabold text-gray-800 text-lg">{userInfo.height} <span className="text-xs font-normal">cm</span></div></div>
        <div className="text-center"><div className="text-xs text-gray-400 uppercase font-bold mb-1">TDEE</div><div className="font-extrabold text-gray-800 text-lg">{tdee}</div></div>
      </div>

      <div className="space-y-3">
        <button onClick={editProfile} className="w-full bg-white border border-gray-200 text-gray-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"><Settings size={18} /> Cài đặt lại chỉ số</button>
        <button onClick={exportData} className="w-full bg-blue-50 text-blue-600 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"><Download size={18} /> Xuất dữ liệu báo cáo</button>
      </div>
    </div>
  );

  // --- MAIN RENDER ---
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white font-sans">
        <Loader2 size={48} className="animate-spin text-emerald-600 mb-4" />
        <div className="font-bold text-gray-500 animate-pulse">Đang đồng bộ dữ liệu...</div>
      </div>
    );
  }

  if (!currentUser) return <Login />;

  if (step === 1) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-md p-8 rounded-[2rem] shadow-xl">
        <div className="text-center mb-8">
          <div className="bg-emerald-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
            <Scale className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800">Thiết lập hồ sơ</h1>
          <p className="text-sm text-gray-500 mt-2">Để AI tính toán lộ trình cho bạn</p>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase block mb-2 tracking-wider">Giới tính</label>
            <div className="flex gap-3">
              {['male', 'female'].map(g => (
                <button key={g} onClick={() => setUserInfo({ ...userInfo, gender: g })} className={`flex-1 py-3 rounded-xl font-bold transition-all ${userInfo.gender === g ? 'bg-emerald-600 text-white shadow-md transform scale-105' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                  {g === 'male' ? 'Nam' : 'Nữ'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-emerald-500 transition-colors">
              <label className="text-[10px] font-bold text-gray-400 block uppercase">Tuổi</label>
              <input type="number" name="age" value={userInfo.age} onChange={handleInputChange} className="w-full bg-transparent font-extrabold text-2xl text-gray-800 outline-none" />
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-emerald-500 transition-colors">
              <label className="text-[10px] font-bold text-gray-400 block uppercase">Cao (cm)</label>
              <input type="number" name="height" value={userInfo.height} onChange={handleInputChange} className="w-full bg-transparent font-extrabold text-2xl text-gray-800 outline-none" />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 focus-within:border-emerald-500 transition-colors">
            <label className="text-[10px] font-bold text-gray-400 block uppercase">Cân nặng (kg)</label>
            <input type="number" name="weight" value={userInfo.weight} onChange={handleInputChange} className="w-full bg-transparent font-extrabold text-3xl text-emerald-600 outline-none" />
          </div>

          <div className="mt-4">
            <label className="text-xs font-bold text-gray-400 uppercase block mb-2 tracking-wider">Mức độ vận động</label>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {ACTIVITY_LEVELS.map((level) => (
                <button
                  key={level.val}
                  type="button"
                  onClick={() => setUserInfo({ ...userInfo, activityLevel: level.val })}
                  className={`w-full p-3 rounded-xl text-left border-2 transition-all ${userInfo.activityLevel === level.val
                      ? 'border-emerald-500 bg-emerald-50'
                      : 'border-gray-100 bg-white hover:border-emerald-100'
                    }`}
                >
                  <div className="flex justify-between items-center">
                    <span className={`text-sm font-bold ${userInfo.activityLevel === level.val ? 'text-emerald-700' : 'text-gray-700'}`}>
                      {level.label}
                    </span>
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full text-gray-400">PAL: {level.val}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{level.desc}</p>
                </button>
              ))}
            </div>
          </div>
          {/* ---------------------- */}
          <button onClick={saveUserProfile} className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold shadow-xl shadow-gray-200 mt-4 active:scale-95 transition-transform flex items-center justify-center gap-2">
            Lưu & Bắt đầu ngay <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-0 md:p-4 font-sans">
      <div className="bg-gray-50 w-full max-w-md md:rounded-[2.5rem] md:border-[8px] md:border-white shadow-2xl overflow-hidden h-screen md:h-[850px] flex flex-col relative">

        {/* Header */}
        <div className="bg-white p-4 pt-8 md:pt-6 shadow-sm flex justify-between sticky top-0 z-20 items-center">
          <div className="font-extrabold text-lg flex gap-2 items-center text-gray-800">
            <div className="bg-orange-500 p-1.5 rounded-lg text-white"><Flame size={18} fill="currentColor" /></div>
            Xin Chào {currentUser?.displayName}
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
            {currentUser.photoURL ? <img src={currentUser.photoURL} alt="User" className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-emerald-600">VF</span>}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {activeTab === 'home' && renderHomeTab()}
          {activeTab === 'add' && renderAddTab()}
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'health' && <HealthPage />}
          {activeTab === 'info' && <InfoPage />}
        </div>

        {/* Bottom Nav */}
        <div className="bg-white border-t border-gray-100 p-2 px-6 pb-6 md:pb-2 absolute bottom-0 w-full z-30 flex justify-between items-center shadow-[0_-5px_15px_rgba(0,0,0,0.02)]">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'home' ? 'text-emerald-600' : 'text-gray-300 hover:text-gray-400'}`}>
            <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Trang chủ</span>
          </button>
          <button onClick={() => setActiveTab('info')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'info' ? 'text-emerald-600' : 'text-gray-300'}`}>
            <BookOpen size={24} strokeWidth={activeTab === 'info' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Kiến thức</span>
          </button>
          <div className="-mt-10">
            <button onClick={() => setActiveTab('add')} className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-200 transition-transform active:scale-95 border-4 border-gray-50 ${activeTab === 'add' ? 'bg-emerald-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
              <Plus size={32} />
            </button>
          </div>
          <button onClick={() => setActiveTab('health')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'health' ? 'text-emerald-600' : 'text-gray-300 hover:text-gray-400'}`}>
            <Heart size={24} strokeWidth={activeTab === 'health' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Sức khỏe</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 p-2 transition-colors ${activeTab === 'profile' ? 'text-emerald-600' : 'text-gray-300 hover:text-gray-400'}`}>
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span className="text-[10px] font-bold">Hồ sơ</span>
          </button>


        </div>

      </div>
    </div>
  );
}