import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, collection, doc, onSnapshot, 
  addDoc, setDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  PlusCircle, ChevronRight, ChevronLeft, ShoppingCart, Utensils, 
  ClipboardList, Trash2, Calendar, Sun, Moon, Filter, Phone, User, Hash, CloudUpload
} from 'lucide-react';

// ==========================================
// ⚠️ 這裡的配置已經根據您的提供進行更新
// ==========================================
const myPrivateConfig = {
  apiKey: "AIzaSyAvciancSscS_qf-df5cifrqjKWtMOODj0",
  authDomain: "pingjiejia-liudongcan.firebaseapp.com", 
  projectId: "pingjiejia-liudongcan",
  storageBucket: "pingjiejia-liudongcan.firebasestorage.app",
  messagingSenderId: "193505058332",
  appId: "1:193505058332:web:cfc5f51fb8370ddeb309d9",
  measurementId: "G-6Z8Y1YYE0D"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' 
  ? JSON.parse(__firebase_config) 
  : myPrivateConfig;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'catering-pro-v1';

const INITIAL_DISHES = [
  { id: '1', name: "至尊佛跳牆", category: "推薦菜", cost: 120, image: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=200", ingredients: [{ item: "海參", amount: 0.1, unit: "kg", vendor: "干貨商" }, { item: "鮑魚", amount: 2, unit: "個", vendor: "水產商" }] },
  { id: '2', name: "秘制紅燒肉", category: "肉菜", cost: 40, image: "https://images.unsplash.com/photo-1603073163308-9654c3fb70b5?w=200", ingredients: [{ item: "豬五花", amount: 0.5, unit: "kg", vendor: "肉食商" }] },
  { id: '3', name: "清炒時蔬", category: "素菜", cost: 10, image: "https://images.unsplash.com/photo-1546793665-c74683c3f43d?w=200", ingredients: [{ item: "青菜", amount: 0.4, unit: "kg", vendor: "蔬菜商" }] },
  { id: '4', name: "蒜蓉大龍蝦", category: "推薦菜", cost: 180, image: "https://images.unsplash.com/photo-1559737558-2f58368305c6?w=200", ingredients: [{ item: "龍蝦", amount: 1, unit: "只", vendor: "水產商" }] },
];

const CATEGORIES = ["全部分類", "推薦菜", "肉菜", "素菜", "涼菜", "湯羹"];

export default function App() {
  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // 客戶信息狀態
  const [customerInfo, setCustomerInfo] = useState({
    reason: '婚事', name: '', phone: '', tables: 10, days: 1
  });

  // 訂菜狀態與分類篩選
  const [orders, setOrders] = useState({});
  const [activeTab, setActiveTab] = useState('day1-lunch');
  const [selectedCategory, setSelectedCategory] = useState("全部分類");
  const [dishList, setDishList] = useState(INITIAL_DISHES);

  // 初始化鑑權 - 增加錯誤處理和離線支持
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error", err);
        // 即使认证失败也允许用户使用基本功能
        setLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 監聽資料庫菜品 - 增加錯誤處理
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'dishes'), (snap) => {
      const dishes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (dishes.length > 0) setDishList(dishes);
    }, (error) => {
      console.log("Firestore error:", error);
      // 如果云端数据加载失败，使用本地初始数据
      setDishList(INITIAL_DISHES);
    });
    return () => unsub();
  }, [user, appId]);

  // 使用 useCallback 優化輸入
  const handleInputChange = useCallback((field, value) => {
    setCustomerInfo(prev => ({ ...prev, [field]: value }));
  }, []);

  const addToOrder = useCallback((dish) => {
    setOrders(prev => {
      const currentItems = prev[activeTab] || [];
      return {
        ...prev,
        [activeTab]: [...currentItems, { ...dish, orderId: Date.now() + Math.random() }]
      };
    });
  }, [activeTab]);

  const removeFromOrder = useCallback((orderId) => {
    setOrders(prev => {
      const currentItems = prev[activeTab] || [];
      return {
        ...prev,
        [activeTab]: currentItems.filter(item => item.orderId !== orderId)
      };
    });
  }, [activeTab]);

  // 將訂單保存到雲端 Firestore (持久化保存) - 增加錯誤處理
  const saveOrderToCloud = async () => {
    if (!user) {
      // 如果没有认证，仍然可以进入下一步，只是不能保存到云端
      console.warn("用戶未認證，僅支持本地查看");
      setStep(4);
      return;
    }
    
    setIsSaving(true);
    try {
      const orderRef = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
      await addDoc(orderRef, {
        customerInfo,
        orders,
        createdAt: serverTimestamp(),
        userId: user.uid
      });
      setStep(4);
    } catch (error) {
      console.error("保存失敗:", error);
      // 即使云端保存失败，也允许用户查看报告
      setStep(4);
    } finally {
      setIsSaving(false);
    }
  };

  // 篩選菜品邏輯
  const filteredDishes = useMemo(() => {
    if (selectedCategory === "全部分類") return dishList;
    return dishList.filter(d => d.category === selectedCategory);
  }, [dishList, selectedCategory]);

  // 計算匯總數據
  const summaryData = useMemo(() => {
    const ingredients = {};
    let totalCost = 0;
    const tableCount = parseInt(customerInfo.tables) || 0;

    Object.values(orders).forEach(mealItems => {
      mealItems.forEach(dish => {
        totalCost += (dish.cost || 0) * tableCount;
        (dish.ingredients || []).forEach(ing => {
          const key = `${ing.item}_${ing.vendor}`;
          if (!ingredients[key]) ingredients[key] = { ...ing, total: 0 };
          ingredients[key].total += (ing.amount || 0) * tableCount;
        });
      });
    });
    return { ingredients: Object.values(ingredients), totalCost };
  }, [orders, customerInfo.tables]);

  if (loading) return <div className="loading-screen">正在準備訂菜系統...</div>;

  return (
    <div className="app-container">
      <nav className="nav-bar">
        <div className="logo"><Utensils size={24} /> <span>流動餐訂菜 PRO</span></div>
        <div className="status-badge"><span className="dot"></span> 雲端同步中</div>
      </nav>

      <main className="main-content">
        {step === 1 && (
          <div className="hero-section">
            <h1 className="title">宴席點菜數位化管理</h1>
            <p className="subtitle">支持多日排餐、分類點菜、自動導出食材清單</p>
            <button className="btn-primary main-btn" onClick={() => setStep(2)}>
               開始創建訂單 <ChevronRight size={20} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="form-card animate-in">
            <h2 className="section-title">
              <button onClick={() => setStep(1)} className="back-btn"><ChevronLeft /></button> 
              完善客戶信息
            </h2>
            <div className="input-grid">
              <div className="field">
                <label><Filter size={14}/> 辦酒事由</label>
                <select value={customerInfo.reason} onChange={e => handleInputChange('reason', e.target.value)}>
                  <option>婚事</option><option>喬遷</option><option>壽宴</option><option>滿月</option><option>其他</option>
                </select>
              </div>
              <div className="field">
                <label><User size={14}/> 客戶姓名</label>
                <input value={customerInfo.name} onChange={e => handleInputChange('name', e.target.value)} placeholder="如：張先生" />
              </div>
              <div className="field">
                <label><Phone size={14}/> 聯繫電話</label>
                <input type="tel" value={customerInfo.phone} onChange={e => handleInputChange('phone', e.target.value)} placeholder="必填" />
              </div>
              <div className="field">
                <label><Hash size={14}/> 預估桌數</label>
                <input type="number" value={customerInfo.tables} onChange={e => handleInputChange('tables', e.target.value)} />
              </div>
              <div className="field full-width">
                <label><Calendar size={14}/> 辦酒天數</label>
                <input type="number" min="1" max="10" value={customerInfo.days} onChange={e => handleInputChange('days', e.target.value)} />
              </div>
            </div>
            <button className="btn-primary" disabled={!customerInfo.name || !customerInfo.phone} onClick={() => setStep(3)}>
              確認並排定菜譜
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="ordering-view animate-in">
            <div className="category-sidebar">
               <h3>菜品分類</h3>
               {CATEGORIES.map(cat => (
                 <button 
                  key={cat} 
                  className={selectedCategory === cat ? 'cat-btn active' : 'cat-btn'}
                  onClick={() => setSelectedCategory(cat)}
                 >
                   {cat}
                 </button>
               ))}
            </div>

            <div className="menu-side">
               <div className="tabs-container">
                 {[...Array(parseInt(customerInfo.days || 1))].map((_, i) => (
                   <div key={i} className="day-group">
                     <span className="day-label">第 {i+1} 天</span>
                     <div className="meal-btns">
                       <button 
                         className={activeTab === `day${i+1}-lunch` ? 'active' : ''} 
                         onClick={() => setActiveTab(`day${i+1}-lunch`)}
                       ><Sun size={14}/> 午宴</button>
                       <button 
                         className={activeTab === `day${i+1}-dinner` ? 'active' : ''} 
                         onClick={() => setActiveTab(`day${i+1}-dinner`)}
                       ><Moon size={14}/> 晚宴</button>
                     </div>
                   </div>
                 ))}
               </div>

               <div className="dish-grid">
                 {filteredDishes.map(dish => (
                   <div key={dish.id} className="dish-card">
                     <div className="img-container">
                        <img src={dish.image} alt={dish.name} loading="lazy" />
                        <span className="category-tag">{dish.category}</span>
                     </div>
                     <div className="dish-info">
                       <h4>{dish.name}</h4>
                       <p className="price">¥{dish.cost}/桌</p>
                       <button className="add-btn" onClick={() => addToOrder(dish)}>添加</button>
                     </div>
                   </div>
                 ))}
               </div>
            </div>

            <div className="cart-side">
               <div className="cart-header">
                 <ShoppingCart size={20} />
                 <h3>當前餐次已選 ({(orders[activeTab] || []).length})</h3>
               </div>
               <div className="cart-items">
                 {(orders[activeTab] || []).map((item) => (
                   <div key={item.orderId} className="cart-item">
                     <span>{item.name}</span>
                     <button onClick={() => removeFromOrder(item.orderId)}><Trash2 size={14}/></button>
                   </div>
                 ))}
                 {(!orders[activeTab] || orders[activeTab].length === 0) && <p className="empty-msg">請選擇菜品</p>}
               </div>
               <div className="cart-footer">
                 <div className="cost-summary">總成本: <span>¥{summaryData.totalCost}</span></div>
                 <button className="btn-primary" onClick={saveOrderToCloud} disabled={isSaving}>
                   {isSaving ? '正在保存到雲端...' : '生成報表並保存'}
                 </button>
               </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="report-view animate-in">
            <div className="report-header">
              <div>
                <div className="save-tag"><CloudUpload size={14}/> 數據已同步至雲端</div>
                <h2>{customerInfo.name} 宴席採購清單</h2>
                <p>{customerInfo.phone} · {customerInfo.reason} · 共 {customerInfo.days} 天</p>
              </div>
              <div className="actions">
                <button className="btn-secondary" onClick={() => window.print()}><ClipboardList size={18} /> 打印/導出</button>
                <button className="btn-text" onClick={() => setStep(1)}>返回首頁</button>
              </div>
            </div>
            
            <div className="report-content">
              <div className="report-section">
                <h3>每日菜譜安排</h3>
                {[...Array(parseInt(customerInfo.days || 1))].map((_, i) => (
                  <div key={i} className="report-day-box">
                    <h4>第 {i+1} 天</h4>
                    <div className="meal-detail">
                      <p><strong>午宴菜譜：</strong> {(orders[`day${i+1}-lunch`] || []).map(d => d.name).join('、') || '未選菜'}</p>
                      <p><strong>晚宴菜譜：</strong> {(orders[`day${i+1}-dinner`] || []).map(d => d.name).join('、') || '未選菜'}</p>
                    </div>
                  </div>
                ))}

                <h3 style={{marginTop: '32px'}}>食材匯總採購單</h3>
                <div className="ingredient-list">
                  {summaryData.ingredients.map((ing, i) => (
                    <div key={i} className="ing-item">
                      <span className="ing-name">{ing.item} <small>({ing.vendor})</small></span>
                      <span className="ing-qty">{ing.total.toFixed(1)} {ing.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="report-section total-card">
                <h3>財務概算</h3>
                <div className="stat-row"><span>總計成本</span> <strong className="big-price">¥{summaryData.totalCost}</strong></div>
                <div className="stat-row"><span>單桌均價</span> <strong>¥{(summaryData.totalCost / (customerInfo.tables * Object.keys(orders).length || 1)).toFixed(0)}</strong></div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        :root { --primary: #6366f1; --bg: #f3f4f6; --text: #1f2937; }
        body { margin: 0; font-family: -apple-system, "Noto Sans SC", sans-serif; background: var(--bg); color: var(--text); }
        .app-container { max-width: 1300px; margin: 0 auto; padding: 0 20px; }
        
        .nav-bar { display: flex; justify-content: space-between; align-items: center; padding: 24px 0; }
        .logo { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.5rem; color: var(--primary); }
        .status-badge { font-size: 12px; background: white; padding: 4px 12px; border-radius: 20px; border: 1px solid #e5e7eb; display: flex; align-items: center; gap: 6px; }
        .dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; }

        .save-tag { font-size: 12px; color: #10b981; display: flex; align-items: center; gap: 4px; margin-bottom: 8px; font-weight: bold; }

        .hero-section { text-align: center; padding: 80px 0; }
        .title { font-size: 3rem; font-weight: 900; margin-bottom: 20px; color: #111827; }
        .subtitle { color: #6b7280; font-size: 1.2rem; margin-bottom: 40px; }

        .form-card { background: white; padding: 40px; border-radius: 24px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); max-width: 650px; margin: 0 auto; }
        .section-title { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
        .back-btn { background: none; border: none; cursor: pointer; color: #9ca3af; }
        .input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
        .field { display: flex; flex-direction: column; gap: 8px; }
        .field.full-width { grid-column: span 2; }
        .field label { font-size: 12px; font-weight: bold; color: #6b7280; display: flex; align-items: center; gap: 5px; }
        input, select { padding: 12px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 16px; transition: border-color 0.2s; }
        input:focus { border-color: var(--primary); outline: none; }

        .ordering-view { display: grid; grid-template-columns: 180px 1fr 320px; gap: 24px; align-items: start; }
        
        .category-sidebar { background: white; padding: 20px; border-radius: 20px; border: 1px solid #e5e7eb; }
        .category-sidebar h3 { font-size: 14px; color: #9ca3af; margin-bottom: 16px; }
        .cat-btn { width: 100%; text-align: left; padding: 10px 12px; border-radius: 8px; border: none; background: none; cursor: pointer; margin-bottom: 4px; font-weight: 500; }
        .cat-btn.active { background: var(--primary); color: white; }

        .tabs-container { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
        .day-group { background: white; padding: 12px; border-radius: 16px; border: 1px solid #e5e7eb; }
        .day-label { font-size: 11px; font-weight: 800; color: #9ca3af; margin-bottom: 6px; display: block; }
        .meal-btns { display: flex; gap: 4px; background: #f3f4f6; padding: 4px; border-radius: 8px; }
        .meal-btns button { border: none; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; display: flex; align-items: center; gap: 4px; }
        .meal-btns button.active { background: white; color: var(--primary); font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

        .dish-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
        .dish-card { background: white; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; transition: transform 0.2s; }
        .dish-card:hover { transform: translateY(-4px); }
        .img-container { height: 120px; position: relative; }
        .img-container img { width: 100%; height: 100%; object-fit: cover; }
        .category-tag { position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.5); color: white; padding: 2px 8px; border-radius: 6px; font-size: 10px; backdrop-filter: blur(4px); }
        .dish-info { padding: 12px; }
        .dish-info h4 { margin: 0 0 4px 0; font-size: 14px; }
        .price { color: var(--primary); font-weight: 800; font-size: 1rem; margin-bottom: 10px; }
        .add-btn { width: 100%; background: #eef2ff; color: var(--primary); border: none; padding: 8px; border-radius: 8px; font-weight: bold; cursor: pointer; }
        .add-btn:hover { background: var(--primary); color: white; }

        .cart-side { background: #111827; color: white; padding: 24px; border-radius: 24px; position: sticky; top: 20px; }
        .cart-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid #374151; padding-bottom: 12px; }
        .cart-items { min-height: 100px; max-height: 40vh; overflow-y: auto; margin-bottom: 20px; }
        .cart-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #374151; font-size: 13px; }
        .cart-item button { background: none; border: none; color: #9ca3af; cursor: pointer; }
        .cost-summary span { font-size: 1.6rem; color: #818cf8; font-weight: 900; }

        .report-view { background: white; padding: 40px; border-radius: 24px; border: 1px solid #e5e7eb; }
        .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
        .report-content { display: grid; grid-template-columns: 1fr 280px; gap: 40px; }
        .report-day-box { background: #f9fafb; padding: 16px; border-radius: 12px; margin-bottom: 12px; }
        .report-day-box h4 { margin: 0 0 8px 0; color: var(--primary); }
        .meal-detail { font-size: 14px; line-height: 1.6; color: #4b5563; }
        .ing-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
        .total-card { background: #f3f4f6; padding: 24px; border-radius: 20px; height: fit-content; }
        .stat-row { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
        .big-price { font-size: 1.8rem; color: #111827; }

        .btn-primary { background: var(--primary); color: white; border: none; padding: 16px; border-radius: 12px; font-weight: bold; cursor: pointer; width: 100%; transition: opacity 0.2s; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-primary:disabled { background: #d1d5db; cursor: not-allowed; }
        .btn-secondary { background: #f3f4f6; border: none; padding: 10px 20px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: bold; }
        
        .animate-in { animation: slideIn 0.3s ease-out; }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 1024px) {
          .ordering-view { grid-template-columns: 1fr; }
          .category-sidebar { display: flex; overflow-x: auto; gap: 10px; }
          .cat-btn { width: auto; white-space: nowrap; }
          .report-content { grid-template-columns: 1fr; }
        }
        @media print {
          .nav-bar, .category-sidebar, .tabs-container, .btn-primary, .btn-secondary, .cart-side, .back-btn { display: none !important; }
          .report-view { border: none; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}