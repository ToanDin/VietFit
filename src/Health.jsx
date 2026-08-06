import React, { useState, useEffect } from 'react';
import { getHealthAdvice } from './api';
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { 
  Activity, Utensils, Sparkles, Loader2, 
  CheckCircle2, Heart, RefreshCw, Smile, Frown, Zap, Dumbbell, MessageSquare
} from 'lucide-react';

export default function HealthPage() {
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(null);
  const [error, setError] = useState(null);

  // --- Tình trạng sức khỏe hàng ngày ---
  const [dailyStatus, setDailyStatus] = useState('normal'); 
  const [detailedStatus, setDetailedStatus] = useState(''); // Ô nhập chi tiết mới

  const db = getFirestore();
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setUserProfile(userDoc.data().userInfo);
          } else {
            setError("Vui lòng thiết lập hồ sơ trước khi sử dụng.");
          }
        } catch (err) {
          setError("Lỗi đồng bộ dữ liệu.");
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const getAIAdvice = async () => {
    if (!userProfile) return;
    setIsAnalyzing(true);

    const heightM = userProfile.height / 100;
    const bmi = (userProfile.weight / (heightM * heightM)).toFixed(1);

    try {
      // Server dựng prompt, gọi Gemini (tự đổi model dự phòng khi bận)
      // và validate cấu trúc kết quả trước khi trả về
      const advice = await getHealthAdvice({
        gender: userProfile.gender,
        bmi,
        status: dailyStatus,
        note: detailedStatus
      });
      setDiagnosis(advice);
    } catch (err) {
      alert(err.message || "AI đang bận, bạn hãy thử lại sau nhé!");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20"><Loader2 className="animate-spin text-emerald-500 mb-2" size={32} /></div>
  );

  return (
    <div className="max-w-md mx-auto pb-24 space-y-6 animate-fade-in font-sans">
      <div className="flex items-center gap-3 py-2">
        <div className="bg-emerald-500 p-2 rounded-xl text-white shadow-lg"><Heart size={20} fill="currentColor" /></div>
        <h1 className="text-lg font-black text-gray-800 uppercase tracking-tight">Check-in Sức Khỏe</h1>
      </div>

      {/* Module Chọn nhanh tình trạng */}
      <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 text-center">Cảm nhận cơ thể hôm nay?</p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'tired', icon: <Frown />, label: 'Mệt', color: 'text-orange-500', bg: 'bg-orange-50' },
            { id: 'normal', icon: <Smile />, label: 'Ổn', color: 'text-emerald-500', bg: 'bg-emerald-50' },
            { id: 'energetic', icon: <Zap />, label: 'Khỏe', color: 'text-blue-500', bg: 'bg-blue-50' },
            { id: 'sore', icon: <Activity />, label: 'Đau cơ', color: 'text-purple-500', bg: 'bg-purple-50' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setDailyStatus(item.id)}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all duration-300 ${dailyStatus === item.id ? `${item.bg} ${item.color} ring-2 ring-current scale-105 shadow-inner` : 'bg-gray-50 text-gray-400 opacity-60'}`}
            >
              {item.icon}
              <span className="text-[10px] font-black uppercase">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ô NHẬP CHI TIẾT TÌNH TRẠNG */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <label className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">
          <MessageSquare size={14} className="text-emerald-500" /> Chi tiết tình trạng sức khỏe
        </label>
        <textarea
          value={detailedStatus}
          onChange={(e) => setDetailedStatus(e.target.value)}
          placeholder="Ví dụ: Mình mới đi nhậu về, bị đau bao tử, hoặc muốn tập trung tăng cơ bắp..."
          className="w-full p-4 bg-gray-50 rounded-2xl border border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 transition-all outline-none text-sm font-medium text-gray-700 resize-none h-28"
        />
      </div>

      {!diagnosis && (
        <button 
          onClick={getAIAdvice}
          disabled={isAnalyzing}
          className="w-full bg-gray-900 text-white py-5 rounded-[2rem] font-bold flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50"
        >
          {isAnalyzing ? <RefreshCw className="animate-spin text-emerald-400" /> : <Sparkles size={20} className="text-yellow-400" />}
          <span className="text-sm font-black uppercase tracking-widest">{isAnalyzing ? "AI đang phân tích..." : "Nhận tư vấn cá nhân"}</span>
        </button>
      )}

      {diagnosis && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="bg-emerald-600 text-white p-6 rounded-[2.5rem] shadow-lg relative overflow-hidden">
            <Sparkles className="absolute top-2 right-2 opacity-20" size={40} />
            <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2">Chẩn đoán từ VietFit AI</div>
            <p className="text-sm font-medium leading-relaxed italic">"{diagnosis.diagnosis}"</p>
          </div>

          <div className="space-y-3">
            <h3 className="font-black text-gray-800 text-[10px] uppercase px-2 tracking-widest flex items-center gap-2">
              <Utensils size={14} className="text-orange-500"/> Thực đơn đề xuất cho bạn
            </h3>
            {diagnosis.foods.map((food, i) => (
              <div key={i} className="bg-white p-4 rounded-2xl border border-gray-50 flex justify-between items-center shadow-sm">
                <span className="font-bold text-gray-700 text-sm">{food.name}</span>
                <span className="text-[10px] font-black bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full">~{food.cal} kcal</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="font-black text-gray-800 text-[10px] uppercase px-2 tracking-widest flex items-center gap-2">
              <Dumbbell size={14} className="text-blue-500"/> Hoạt động thích hợp
            </h3>
            <div className="bg-blue-600 p-6 rounded-[2.5rem] space-y-4 shadow-lg text-white">
              {diagnosis.exercises.map((ex, i) => (
                <div key={i} className="flex items-start gap-3 text-sm font-medium opacity-90">
                  <div className="mt-1.5 w-1.5 h-1.5 bg-blue-300 rounded-full flex-shrink-0"></div>
                  <span>{ex}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => { setDiagnosis(null); setDetailedStatus(''); }} className="w-full text-gray-400 text-[10px] font-bold uppercase py-8 tracking-widest">Làm mới trạng thái</button>
        </div>
      )}
    </div>
  );
}