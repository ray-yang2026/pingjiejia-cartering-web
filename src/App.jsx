import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, doc, onSnapshot, 
  addDoc, deleteDoc 
} from 'firebase/firestore';
import { 
  PlusCircle, ChevronRight, ChevronLeft, ShoppingCart, Utensils, 
  Truck, ClipboardList, CheckCircle2, Settings, 
  Trash2, DollarSign, Package
} from 'lucide-react';

// --- Firebase 配置 (在本地部署时请替换为您自己的配置) ---
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAvciancSscS_qf-df5cifrqjKWtMOODj0",
  authDomain: "pingjiejia-liudongcan.firebaseapp.com",
  projectId: "pingjiejia-liudongcan",
  storageBucket: "pingjiejia-liudongcan.firebasestorage.app",
  messagingSenderId: "193505058332",
  appId: "1:193505058332:web:cfc5f51fb8370ddeb309d9",
  measurementId: "G-6Z8Y1YYE0D"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "my-catering-app-v1";

// --- 初始默认菜谱 ---
const INITIAL_DISHES = [
  { id: '1', name: "至尊佛跳墙", category: "推荐菜", cost: 120, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200", desc: "名贵食材，宴席之首。", ingredients: [{ item: "海参", amount: 0.1, unit: "kg", vendor: "干货商" }, { item: "鲍鱼", amount: 2, unit: "个", vendor: "水产商" }] },
  { id: '2', name: "秘制红烧肉", category: "肉菜", cost: 40, image: "https://images.unsplash.com/photo-1603073163308-9654c3fb70b5?w=200", desc: "肥而不腻，入口即化。", ingredients: [{ item: "猪五花", amount: 0.5, unit: "kg", vendor: "肉食商" }] },
  { id: '3', name: "清炒时蔬", category: "素菜", cost: 10, image: "https://images.unsplash.com/photo-1546793665-c74683c3f43d?w=200", desc: "时令鲜蔬，清爽可口。", ingredients: [{ item: "青菜", amount: 0.4, unit: "kg", vendor: "蔬菜商" }] },
];

const CATEGORIES = ["推荐菜", "肉菜", "素菜", "凉菜", "汤羹"];

export default function App() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // 状态：客户信息、订单、菜谱库
  const [customerInfo, setCustomerInfo] = useState({
    reason: '婚事', name: '', phone: '', date: '', tables: 10, address: '', remark: '', days: 1
  });
  const [orders, setOrders] = useState({});
  const [dishList, setDishList] = useState(INITIAL_DISHES);
  const [currentSession, setCurrentSession] = useState("Day1_Lunch");

  // --- 1. 初始化与鉴权 ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("鉴权失败", err);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. Firestore 数据同步 ---
  useEffect(() => {
    if (!user) return;
    const dishRef = collection(db, 'artifacts', appId, 'public', 'data', 'dishes');
    const unsubDishes = onSnapshot(dishRef, (snapshot) => {
      const dishes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      if (dishes.length > 0) setDishList(dishes);
    }, (err) => console.error("数据同步错误", err));

    return () => unsubDishes();
  }, [user]);

  // --- 逻辑优化：使用 useCallback 稳定引用，防止输入崩溃 ---
  const handleInputChange = useCallback((field, value) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
  }, []);

  const addToOrder = useCallback((dish) => {
    setOrders(prev => {
      const currentList = prev[currentSession] || [];
      if (currentList.find(d => d.id === dish.id)) return prev;
      return { ...prev, [currentSession]: [...currentList, dish] };
    });
  }, [currentSession]);

  const removeFromOrder = useCallback((session, dishId) => {
    setOrders(prev => ({
      ...prev,
      [session]: (prev[session] || []).filter(d => d.id !== dishId)
    }));
  }, []);

  // 原材料汇总与成本计算
  const summaryData = useMemo(() => {
    const ingredients = {};
    let totalCost = 0;
    const tableCount = parseInt(customerInfo.tables) || 0;

    Object.keys(orders).forEach(session => {
      (orders[session] || []).forEach(dish => {
        totalCost += (dish.cost || 0) * tableCount;
        (dish.ingredients || []).forEach(ing => {
          const key = `${ing.item}_${ing.vendor}`;
          if (!ingredients[key]) ingredients[key] = { ...ing, total: 0 };
          ingredients[key].total += (ing.amount || 0) * tableCount;
        });
      });
    });

    const vendorGroup = Object.values(ingredients).reduce((acc, curr) => {
      if (!acc[curr.vendor]) acc[curr.vendor] = [];
      acc[curr.vendor].push(curr);
      return acc;
    }, {});

    return { ingredients: Object.values(ingredients), vendors: vendorGroup, totalCost };
  }, [orders, customerInfo.tables]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">正在加载系统...</div>;

  // --- 步骤 1: 首页 ---
  const Step1 = () => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="relative">
        <div className="w-24 h-24 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center">
          <Utensils size={48} />
        </div>
        <button onClick={() => setIsAdmin(true)} className="absolute -top-2 -right-2 bg-white p-2 rounded-full shadow-md text-slate-400 hover:text-indigo-500">
          <Settings size={20} />
        </button>
      </div>
      <h1 className="text-4xl font-black text-slate-700">流动餐订菜 Pro</h1>
      <p className="text-slate-500 max-w-sm">数字化宴席管理：智能点菜、自动配料、成本预估</p>
      <button onClick={() => setStep(2)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl transition-all">
        开始创建订单
      </button>
    </div>
  );

  // --- 步骤 2: 客户信息 (优化后，不会崩溃) ---
  const Step2 = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-slate-700 flex items-center gap-2">
        <button onClick={() => setStep(1)}><ChevronLeft /></button> 录入客户信息
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">办酒事由</label>
          <select value={customerInfo.reason} onChange={e => handleInputChange('reason', e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 outline-none">
            <option>婚事</option><option>乔迁</option><option>满岁</option><option>寿宴</option><option>其他</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">客户姓名</label>
          <input value={customerInfo.name} onChange={e => handleInputChange('name', e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 outline-none" placeholder="输入姓名" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">联系电话</label>
          <input value={customerInfo.phone} onChange={e => handleInputChange('phone', e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 outline-none" placeholder="输入电话" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase">预计桌数</label>
          <input type="number" value={customerInfo.tables} onChange={e => handleInputChange('tables', e.target.value)} className="w-full bg-slate-50 border-none rounded-xl p-3 outline-none" />
        </div>
      </div>
      <button 
        disabled={!customerInfo.name || !customerInfo.phone}
        onClick={() => setStep(3)} 
        className="w-full py-5 rounded-2xl font-bold bg-indigo-500 text-white disabled:bg-slate-200"
      >
        去点菜
      </button>
    </div>
  );

  // --- 步骤 3: 点菜界面 ---
  const Step3 = () => {
    const [activeTab, setActiveTab] = useState(CATEGORIES[0]);
    return (
      <div className="flex flex-col lg:flex-row gap-8 pb-20">
        <div className="flex-1 space-y-6">
          <div className="flex gap-4 overflow-x-auto border-b">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setActiveTab(cat)} className={`pb-4 px-2 text-sm font-bold ${activeTab === cat ? 'text-indigo-500 border-b-2 border-indigo-500' : 'text-slate-400'}`}>
                {cat}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {dishList.filter(d => d.category === activeTab).map(dish => (
              <div key={dish.id} className="bg-white p-4 rounded-3xl border flex flex-col justify-between">
                <div>
                  <img src={dish.image} className="w-full h-32 object-cover rounded-xl mb-2" />
                  <h4 className="font-bold">{dish.name}</h4>
                  <p className="text-xs text-slate-400">成本: ¥{dish.cost}/桌</p>
                </div>
                <button onClick={() => addToOrder(dish)} className="mt-4 w-full bg-indigo-50 text-indigo-600 py-2 rounded-xl text-sm font-bold">加入</button>
              </div>
            ))}
          </div>
        </div>
        <div className="w-full lg:w-80 bg-slate-900 text-white p-6 rounded-[2rem] h-fit sticky top-4">
          <h3 className="font-bold mb-4">当前选择</h3>
          <div className="space-y-2 mb-6">
            {(orders[currentSession] || []).map(d => (
              <div key={d.id} className="flex justify-between text-sm">
                <span>{d.name}</span>
                <button onClick={() => removeFromOrder(currentSession, d.id)}><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-700 pt-4">
            <p className="text-xs text-slate-500">预估总成本</p>
            <p className="text-2xl font-black text-indigo-400">¥{summaryData.totalCost}</p>
          </div>
          <button onClick={() => setStep(4)} className="w-full mt-6 bg-indigo-500 py-3 rounded-xl font-bold">生成报表</button>
        </div>
      </div>
    );
  };

  // --- 步骤 4: 报表 ---
  const Step4 = () => (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="bg-white p-8 rounded-[2rem] shadow-sm border">
        <h2 className="text-3xl font-black mb-2">{customerInfo.name} 的宴席清单</h2>
        <p className="text-slate-500">{customerInfo.reason} · {customerInfo.tables}桌 · 地址：{customerInfo.address}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Package /> 食材清单</h3>
          {summaryData.ingredients.map((ing, i) => (
            <div key={i} className="flex justify-between py-2 border-b text-sm">
              <span>{ing.item} ({ing.vendor})</span>
              <span className="font-bold">{ing.total.toFixed(1)} {ing.unit}</span>
            </div>
          ))}
        </div>
        <div className="bg-emerald-900 text-white p-6 rounded-2xl">
          <h3 className="font-bold mb-4 flex items-center gap-2"><DollarSign /> 财务结算</h3>
          <p className="text-sm opacity-70">总成本预估</p>
          <p className="text-4xl font-black">¥{summaryData.totalCost}</p>
          <button onClick={() => window.print()} className="mt-8 w-full bg-white/10 hover:bg-white/20 py-3 rounded-xl transition-all">打印清单</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <nav className="max-w-6xl mx-auto mb-8 flex justify-between items-center">
        <div className="font-black text-xl">CATERING<span className="text-indigo-600">PRO</span></div>
        <div className="text-[10px] bg-white px-2 py-1 rounded border">V2.1.2 STABLE</div>
      </nav>
      <main className="max-w-6xl mx-auto">
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
      </main>
    </div>
  );
}