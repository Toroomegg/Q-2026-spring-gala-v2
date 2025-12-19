
import { GoogleGenAI } from "@google/genai";
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import { Candidate, COLORS, VoteCategory } from './types';
import { voteService } from './services/voteService';
import { generateLiveCommentary } from './services/geminiService';
import Fireworks from './components/Fireworks';

// --- Shared Components ---

const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
  e.currentTarget.src = "https://images.unsplash.com/photo-1516280440614-6697288d5d38?auto=format&fit=crop&w=800&q=80";
};

// 萬用確認/提示視窗
const ConfirmModal: React.FC<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    isDangerous?: boolean;
    showCancel?: boolean;
}> = ({ isOpen, title, message, onConfirm, onCancel, isDangerous, showCancel = true }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#1e293b] border border-slate-600 p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-scale-up text-white">
                <h3 className={`text-xl font-bold mb-2 ${isDangerous ? 'text-red-500' : 'text-white'}`}>{title}</h3>
                <p className="text-slate-300 mb-6 whitespace-pre-wrap text-sm leading-relaxed">{message}</p>
                <div className="flex gap-3 justify-end">
                    {showCancel && (
                        <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors">取消</button>
                    )}
                    <button onClick={onConfirm} className={`px-4 py-2 rounded-lg font-bold transition-all active:scale-95 ${isDangerous ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>確定</button>
                </div>
            </div>
        </div>
    );
};

const Header: React.FC<{ subtitle?: string; size?: 'small' | 'large' }> = ({ subtitle, size = 'large' }) => (
  <header className="text-center relative z-10 py-4 md:py-8 select-none animate-fade-in-down w-full">
    <div className="flex justify-center mb-8 relative group">
        <div className="absolute inset-0 bg-yellow-500 blur-3xl opacity-20 rounded-full group-hover:opacity-30 transition-opacity"></div>
        <img 
            src="https://storage.googleapis.com/example-eggy-addressable/DownloadFile/Slogan.png" 
            alt="Spring Gala Logo" 
            onError={handleImageError}
            className="h-40 md:h-56 object-contain drop-shadow-[0_0_25px_rgba(234,179,8,0.5)] relative z-10"
        />
    </div>
    <div className="inline-block relative px-4">
      <div className="absolute inset-0 bg-red-600 blur-2xl opacity-30 rounded-full animate-pulse"></div>
      <h1 className={`font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-300 to-yellow-600 ${size === 'large' ? 'text-3xl md:text-5xl' : 'text-2xl md:text-4xl'} tracking-wider leading-tight`}>
        2026 廣達BU1,BU11,BU15<br className="md:hidden"/>春酒晚宴
      </h1>
    </div>
    {subtitle && <p className="text-yellow-100/90 mt-2 font-bold tracking-[0.2em] uppercase text-xs md:text-lg drop-shadow-md">&mdash; {subtitle} &mdash;</p>}
  </header>
);

// --- Pages ---

const VotePage: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selections, setSelections] = useState<{[key in VoteCategory]: string | null}>({
      [VoteCategory.SINGING]: null,
      [VoteCategory.POPULARITY]: null,
      [VoteCategory.COSTUME]: null
  });
  const [hasVoted, setHasVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGlobalTestMode, setIsGlobalTestMode] = useState(false);
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [isConfirmingSubmit, setIsConfirmingSubmit] = useState(false);

  useEffect(() => {
    voteService.fetchLatestData();
    const sync = () => {
      setCandidates(voteService.getCandidates());
      setHasVoted(voteService.hasVoted());
      setIsGlobalTestMode(voteService.isGlobalTestMode);
      setIsVotingOpen(voteService.isVotingOpen);
    };
    sync();
    return voteService.subscribe(sync);
  }, []);

  const handleSelect = (category: VoteCategory, candidateId: string) => {
      if (!isVotingOpen && !isGlobalTestMode) return;
      if (hasVoted && !isGlobalTestMode) return;
      setSelections(prev => ({ ...prev, [category]: candidateId }));
  };

  const isAllSelected = selections.SINGING && selections.POPULARITY && selections.COSTUME;

  const getCandidateName = (id: string | null) => {
    if (!id) return "未選擇";
    return candidates.find(c => c.id === id)?.name || "未知";
  };

  const handleSubmitAll = () => {
      if (!isAllSelected) return;
      setIsConfirmingSubmit(true);
  };

  const executeSubmit = async () => {
      setIsConfirmingSubmit(false);
      setIsSubmitting(true);
      const result = await voteService.submitVoteBatch(selections as any);
      if (result.success) {
          setHasVoted(true);
          window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
          alert(result.message);
      }
      setIsSubmitting(false);
  };

  if (!isVotingOpen && !isGlobalTestMode) {
      return (
        <div className="min-h-screen pb-24 px-4 relative z-10 overflow-hidden flex flex-col items-center justify-center">
             <div className="absolute inset-0 z-0"><Fireworks /></div>
             <div className="z-10 text-center animate-fade-in p-8 glass-panel rounded-3xl border border-yellow-500/50 shadow-2xl max-w-md mx-auto">
                 <div className="text-6xl mb-4 animate-bounce">⏳</div>
                 <h1 className="text-3xl font-black text-white mb-4">投票通道尚未開啟</h1>
                 <p className="text-slate-300">精彩表演即將開始，請耐心等候。</p>
             </div>
        </div>
      );
  }

  if (hasVoted && !isGlobalTestMode) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10">
              <Fireworks />
              <div className="glass-panel p-8 rounded-3xl text-center max-w-md border border-green-500/50 shadow-2xl animate-scale-up">
                  <div className="text-6xl mb-4">✅</div>
                  <h1 className="text-3xl font-black text-white mb-2">投票成功！</h1>
                  <p className="text-slate-300">感謝您的參與，一起為我們喝采！</p>
              </div>
          </div>
      );
  }

  const confirmationMessage = `確認提交以下選擇嗎？\n\n🎤 金嗓歌王：${getCandidateName(selections.SINGING)}\n💖 最佳人氣：${getCandidateName(selections.POPULARITY)}\n🎭 最佳造型：${getCandidateName(selections.COSTUME)}\n\n送出後將無法更改！`;

  return (
    <div className="min-h-screen pb-48 px-2 md:px-4 relative z-10 pt-4">
      <Header subtitle="歌唱大賽評分系統" size="small" />
      <ConfirmModal 
          isOpen={isConfirmingSubmit} 
          title="最後確認" 
          message={confirmationMessage} 
          onConfirm={executeSubmit} 
          onCancel={() => setIsConfirmingSubmit(false)} 
      />
      <div className="max-w-5xl mx-auto">
          {[
              { cat: VoteCategory.SINGING, title: "Group A: 金嗓歌王獎", sub: "唱功最厲害的參賽者", color: "border-yellow-500/30", icon: "🎤" },
              { cat: VoteCategory.POPULARITY, title: "Group B: 最佳人氣獎", sub: "氣氛最嗨的表演", color: "border-pink-500/30", icon: "💖" },
              { cat: VoteCategory.COSTUME, title: "Group C: 最佳造型獎", sub: "服裝造型最用心的參賽者", color: "border-purple-500/30", icon: "🎭" }
          ].map(section => (
            <div key={section.cat} className={`mb-12 p-3 md:p-6 rounded-3xl border-2 ${section.color} bg-slate-900/50 backdrop-blur-sm`}>
                <div className="flex items-center justify-between gap-2 mb-6 sticky top-0 bg-slate-900/95 p-3 md:p-4 rounded-xl z-20 shadow-lg border-b border-white/10">
                    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
                        <span className="text-2xl md:text-4xl shrink-0">{section.icon}</span>
                        <div className="min-w-0">
                            <h2 className="text-lg md:text-2xl font-black text-white truncate">{section.title}</h2>
                            <p className="text-slate-400 text-[10px] md:text-sm truncate">{section.sub}</p>
                        </div>
                    </div>
                    <div className="shrink-0 flex items-center ml-2">
                        {selections[section.cat] ? (
                            <span className="bg-green-600 text-white px-3 py-1 rounded-full text-[10px] md:text-xs font-bold animate-pulse whitespace-nowrap">已選擇</span>
                        ) : (
                            <span className="bg-red-600 text-white px-2 py-1 rounded-full text-[10px] md:text-xs font-bold whitespace-nowrap">請選擇一位</span>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {candidates.map((c) => {
                        const isSelected = selections[section.cat] === c.id;
                        return (
                            <div key={c.id} onClick={() => handleSelect(section.cat, c.id)} className={`relative rounded-2xl cursor-pointer transition-all duration-200 overflow-hidden ${isSelected ? 'ring-4 ring-green-500 scale-[1.02] shadow-2xl' : 'border border-slate-700 bg-slate-800'}`}>
                                <div className="h-40 w-full bg-slate-700 relative overflow-hidden">
                                    {c.image && <img src={c.image} className="w-full h-full object-cover" />}
                                    {isSelected && (
                                        <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center animate-fade-in">
                                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl animate-bounce">✓</div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex-1 min-w-0 pr-2">
                                        <h3 className="font-bold text-white text-lg truncate">{c.name}</h3>
                                        <p className="text-slate-400 text-sm truncate mt-1">🎵 {c.song}</p>
                                    </div>
                                    <div className="shrink-0 w-12 h-12 rounded-full border-2 border-yellow-500/40 p-0.5 bg-slate-900 overflow-hidden relative shadow-lg">
                                        {c.image ? <img src={c.image} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800" />}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          ))}
      </div>
      
      {/* 底部固定欄位：顯示選擇摘要與送出按鈕 */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-md border-t border-slate-700 p-4 z-50 shadow-2xl">
          <div className="max-w-xl mx-auto mb-3">
              <div className="grid grid-cols-3 gap-2">
                  <div className={`p-2 rounded-lg text-center border ${selections.SINGING ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                      <div className="text-[10px] text-slate-500 font-bold mb-0.5 uppercase">金嗓歌王</div>
                      <div className="text-xs font-black text-white truncate">{getCandidateName(selections.SINGING)}</div>
                  </div>
                  <div className={`p-2 rounded-lg text-center border ${selections.POPULARITY ? 'border-pink-500/50 bg-pink-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                      <div className="text-[10px] text-slate-500 font-bold mb-0.5 uppercase">最佳人氣</div>
                      <div className="text-xs font-black text-white truncate">{getCandidateName(selections.POPULARITY)}</div>
                  </div>
                  <div className={`p-2 rounded-lg text-center border ${selections.COSTUME ? 'border-purple-500/50 bg-purple-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                      <div className="text-[10px] text-slate-500 font-bold mb-0.5 uppercase">最佳造型</div>
                      <div className="text-xs font-black text-white truncate">{getCandidateName(selections.COSTUME)}</div>
                  </div>
              </div>
          </div>
          <button onClick={handleSubmitAll} disabled={!isAllSelected || isSubmitting} className={`w-full max-w-xl mx-auto block py-4 rounded-xl font-black text-xl transition-all ${isAllSelected ? 'bg-gradient-to-r from-yellow-500 to-red-600 text-white shadow-lg active:scale-95' : 'bg-slate-700 text-slate-500'}`}>
              {isSubmitting ? '處理中...' : (isAllSelected ? '確認送出三票' : '請完成所有選擇')}
          </button>
      </div>
    </div>
  );
};

const PodiumItem: React.FC<{ candidate?: Candidate; rank: 1 | 2 | 3; score: number; delay?: string }> = ({ candidate, rank, score, delay }) => {
    const isWinner = rank === 1;
    let heightClass = "h-48 md:h-64", borderColor = "border-slate-400", badgeColor = "bg-slate-300 text-slate-900 border-white", orderClass = "order-1 md:order-1";
    if (rank === 1) { heightClass = "h-60 md:h-80"; borderColor = "border-yellow-400"; badgeColor = "bg-yellow-400 text-yellow-900 border-yellow-100"; orderClass = "order-first md:order-2"; }
    else if (rank === 3) { borderColor = "border-orange-500"; badgeColor = "bg-orange-400 text-orange-900 border-orange-100"; orderClass = "order-2 md:order-3"; }
    if (!candidate) return <div className={`flex flex-col items-center justify-end w-full md:w-1/3 ${orderClass} opacity-50`}><div className={`w-full ${heightClass} bg-slate-800/50 rounded-t-2xl border-t-4 border-slate-700 flex items-center justify-center`}><span className="text-4xl opacity-20">?</span></div></div>;
    return (
        <div className={`flex flex-col items-center justify-end w-full md:w-1/3 relative group ${orderClass} ${delay} animate-fade-in-up`}>
            <div className={`relative z-20 mb-[-25px] transition-transform duration-500 group-hover:-translate-y-2`}>
                <div className={`rounded-full overflow-hidden border-4 ${borderColor} bg-slate-900 ${isWinner ? 'w-24 h-24 md:w-36 md:h-36 shadow-xl' : 'w-20 h-20 md:w-24 md:h-24 shadow-lg'}`}>
                     {candidate.image ? <img src={candidate.image} className="w-full h-full object-cover" onError={handleImageError} /> : <div className="w-full h-full bg-slate-700 flex items-center justify-center text-2xl">?</div>}
                </div>
                <div className={`absolute -bottom-2 -right-2 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-base md:text-xl font-bold border-2 shadow-lg z-30 ${badgeColor}`}>{rank}</div>
                {isWinner && <div className="absolute -top-14 md:-top-20 left-1/2 -translate-x-1/2 text-5xl md:text-7xl animate-bounce drop-shadow-[0_0_20px_rgba(234,179,8,1)]">👑</div>}
            </div>
            <div className={`w-full ${heightClass} rounded-t-3xl border-t-2 ${borderColor} bg-slate-800/90 backdrop-blur-md flex flex-col items-center pt-8 md:pt-12 pb-4 px-2 text-center shadow-2xl`}>
                <h3 className={`font-bold text-white truncate px-2 mb-1 ${isWinner ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'}`}>{candidate.name}</h3>
                <p className="text-slate-400 text-xs md:text-sm mb-3 truncate px-2">{candidate.song}</p>
                <div className="mt-auto">
                    <div className={`font-black font-mono tracking-tighter leading-none ${isWinner ? 'text-yellow-400 text-4xl md:text-5xl' : 'text-white text-3xl md:text-4xl'}`}>{score}</div>
                    <div className="text-[10px] md:text-xs text-slate-500 uppercase font-bold mt-1 tracking-widest">{isWinner ? 'CHAMPION' : 'POINTS'}</div>
                </div>
            </div>
        </div>
    );
};

const ResultsPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [commentary, setCommentary] = useState<string>("AI 正在分析戰況...");
  const [activeTab, setActiveTab] = useState<VoteCategory>(VoteCategory.SINGING);
  const [confirmTab, setConfirmTab] = useState<{isOpen: boolean, target: VoteCategory | null}>({isOpen: false, target: null});
  const [errorModal, setErrorModal] = useState({ isOpen: false, msg: '' });
  
  useEffect(() => {
    if (!isAuthenticated) return;
    voteService.startPolling();
    const updateData = () => setCandidates(voteService.getCandidates());
    updateData();
    const unsub = voteService.subscribe(updateData);
    const commentInterval = setInterval(async () => {
        const currentCandidates = voteService.getCandidates();
        if (currentCandidates.length > 0) setCommentary(await generateLiveCommentary(currentCandidates));
    }, 20000);
    return () => { voteService.stopPolling(); unsub(); clearInterval(commentInterval); };
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin888') {
      setIsAuthenticated(true);
    } else {
      setErrorModal({ isOpen: true, msg: '登入失敗：密碼錯誤，請重新確認！' });
    }
  };

  const sortedCandidates = [...candidates].sort((a, b) => {
      if (activeTab === VoteCategory.SINGING) return b.scoreSinging - a.scoreSinging;
      if (activeTab === VoteCategory.POPULARITY) return b.scorePopularity - a.scorePopularity;
      return b.scoreCostume - a.scoreCostume;
  });
  
  const getScore = (c: Candidate) => {
    if (activeTab === VoteCategory.SINGING) return c.scoreSinging;
    if (activeTab === VoteCategory.POPULARITY) return c.scorePopularity;
    return c.scoreCostume;
  };
  
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <ConfirmModal isOpen={errorModal.isOpen} title="登入錯誤" message={errorModal.msg} onConfirm={() => setErrorModal({isOpen:false, msg:''})} showCancel={false} isDangerous />
        <form onSubmit={handleLogin} className="glass-panel p-8 rounded-2xl w-full max-w-md border border-slate-700">
          <h2 className="text-2xl font-bold text-center mb-6 text-white">開票控制台登入</h2>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 mb-6 text-white focus:border-yellow-500 outline-none" placeholder="請輸入管理密碼" />
          <button type="submit" className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 rounded-lg transition-colors shadow-lg active:scale-95">揭曉排名</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-hidden relative pb-40">
      <Fireworks />
      <ConfirmModal isOpen={confirmTab.isOpen} title="切換獎項" message={`確定切換到「${confirmTab.target === VoteCategory.SINGING ? '金嗓歌王' : confirmTab.target === VoteCategory.POPULARITY ? '最佳人氣' : '最佳造型'}」嗎？`} onConfirm={() => { if (confirmTab.target) setActiveTab(confirmTab.target); setConfirmTab({isOpen: false, target: null}); }} onCancel={() => setConfirmTab({isOpen: false, target: null})} />
      <div className="relative z-10 px-4 py-6 max-w-7xl mx-auto flex flex-col h-full">
        <Header size="small" subtitle="即時戰況" />
        {/* TAB 與排名之間的間隔優化：將 mb-12 改為 mb-4 */}
        <div className="flex justify-center gap-2 mb-4 sticky top-4 z-[100] mt-2">
            {[VoteCategory.SINGING, VoteCategory.POPULARITY, VoteCategory.COSTUME].map(cat => (
                <button key={cat} onClick={() => { if (cat !== activeTab) setConfirmTab({ isOpen: true, target: cat }); }} className={`px-4 py-3 rounded-xl font-bold text-sm md:text-xl transition-all border-2 ${activeTab === cat ? 'bg-slate-800 text-white border-yellow-500 shadow-xl transform -translate-y-1' : 'bg-slate-900/80 backdrop-blur text-slate-500 border-slate-700'}`}>
                    {cat === VoteCategory.SINGING ? '金嗓歌王' : cat === VoteCategory.POPULARITY ? '最佳人氣' : '最佳造型'}
                </button>
            ))}
        </div>
        {/* 排名區域佈局優化：大幅縮減 pt 從 44/60 改為 16/24 */}
        <div className="w-full max-w-6xl mx-auto pt-16 md:pt-24"> 
            {activeTab === VoteCategory.SINGING ? (
                <div className="space-y-12">
                    <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 min-h-[350px]">
                        <PodiumItem candidate={sortedCandidates[1]} rank={2} score={sortedCandidates[1] ? getScore(sortedCandidates[1]) : 0} delay="delay-200" />
                        <PodiumItem candidate={sortedCandidates[0]} rank={1} score={sortedCandidates[0] ? getScore(sortedCandidates[0]) : 0} />
                        <PodiumItem candidate={sortedCandidates[2]} rank={3} score={sortedCandidates[2] ? getScore(sortedCandidates[2]) : 0} delay="delay-300" />
                    </div>
                    {/* 金嗓歌王：專屬顯示 4、5 名區塊 */}
                    {sortedCandidates.length > 3 && (
                        <div className="max-w-4xl mx-auto space-y-4 pt-4">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="h-px bg-slate-700 flex-1"></div>
                              <h4 className="text-yellow-500 font-black tracking-[0.4em] uppercase text-sm md:text-base drop-shadow-sm">優選榮譽榜 (第 4, 5 名)</h4>
                              <div className="h-px bg-slate-700 flex-1"></div>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {sortedCandidates.slice(3, 5).map((c, idx) => (
                                    <div key={c.id} className="bg-slate-800/60 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 flex items-center animate-fade-in-up shadow-xl transform transition-transform hover:scale-[1.01]">
                                        <div className="w-12 text-3xl font-black text-slate-500 flex justify-center items-center">#{idx + 4}</div>
                                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600 bg-slate-900 mx-4 shadow-inner">{c.image && <img src={c.image} className="w-full h-full object-cover" />}</div>
                                        <div className="flex-1 min-w-0 pr-2">
                                            <h4 className="font-bold text-white text-xl truncate">{c.name}</h4>
                                            <div className="text-slate-400 text-sm truncate font-medium mt-0.5">🎵 {c.song}</div>
                                        </div>
                                        <div className="text-right pl-6 border-l border-white/10">
                                            <div className="text-3xl font-black text-white font-mono leading-tight">{getScore(c)}</div>
                                            <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest">points</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="max-w-4xl mx-auto space-y-4">
                    {sortedCandidates.map((c, idx) => (
                        <div key={c.id} className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-xl p-4 flex items-center animate-fade-in-up">
                            <div className="w-12 text-2xl font-black text-slate-500">#{idx + 1}</div>
                            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-slate-600 bg-slate-900 mx-4">{c.image && <img src={c.image} className="w-full h-full object-cover" />}</div>
                            <div className="flex-1 min-w-0 pr-2">
                                <h4 className="font-bold text-white text-lg truncate">{c.name}</h4>
                                <div className="text-slate-400 text-sm truncate">🎵 {c.song}</div>
                            </div>
                            <div className="text-right pl-4 border-l border-white/10"><div className="text-2xl font-bold text-white font-mono">{getScore(c)}</div><div className="text-[10px] text-slate-500 uppercase font-bold">pts</div></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>
      <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-md border-t-2 border-yellow-500 z-50 py-3 shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4"><span className="text-3xl animate-bounce">🤖</span><p className="text-xl md:text-2xl font-bold text-yellow-100 truncate">{commentary}</p></div>
      </div>
    </div>
  );
};

const AdminPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [newCandidate, setNewCandidate] = useState({ name: '', song: '', image: '', videoLink: '' });
  const [stressCount, setStressCount] = useState(0);
  const [stressLogs, setStressLogs] = useState<string[]>([]);
  const [isStressTesting, setIsStressTesting] = useState(false);
  const [globalTestMode, setGlobalTestMode] = useState(false);
  const [isVotingOpen, setIsVotingOpen] = useState(true);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiModal, setApiModal] = useState({ isOpen: false, msg: '' });
  const [loginErrorModal, setLoginErrorModal] = useState({ isOpen: false, msg: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {}, isDangerous: false });

  useEffect(() => {
    if (!isAuthenticated) return;
    voteService.startPolling();
    const update = () => {
        setCandidates(voteService.getCandidates());
        setIsStressTesting(voteService.isRunningStressTest);
        setGlobalTestMode(voteService.isGlobalTestMode);
        setIsVotingOpen(voteService.isVotingOpen);
    };
    update();
    const unsub = voteService.subscribe(update);
    return () => { voteService.stopPolling(); unsub(); };
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin888') {
      setIsAuthenticated(true);
    } else {
      setLoginErrorModal({ isOpen: true, msg: '登入密碼錯誤，請確認您的權限！' });
    }
  };

  const handleTestApi = async () => {
      if (isTestingApi) return;
      setIsTestingApi(true);
      try {
          const res = await voteService.testConnection(); 
          setApiModal({ isOpen: true, msg: res.message }); 
      } finally {
          setIsTestingApi(false);
      }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <ConfirmModal isOpen={loginErrorModal.isOpen} title="登入錯誤" message={loginErrorModal.msg} onConfirm={() => setLoginErrorModal({isOpen:false, msg:''})} showCancel={false} isDangerous />
        <form onSubmit={handleLogin} className="glass-panel p-8 rounded-2xl w-full max-w-md border border-slate-700">
          <h2 className="text-2xl font-bold text-center mb-6 text-white">系統管理後台</h2>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 mb-6 text-white focus:border-blue-500 outline-none" placeholder="請輸入管理密碼" />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-lg shadow-lg active:scale-95 transition-all">進入控制台</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] p-4 md:p-10 text-white font-sans overflow-x-hidden">
      <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} onConfirm={confirmModal.onConfirm} onCancel={() => setConfirmModal(prev => ({...prev, isOpen: false}))} isDangerous={confirmModal.isDangerous} />
      {/* API 測試反饋視窗 */}
      <ConfirmModal isOpen={apiModal.isOpen} title="連線診斷結果" message={apiModal.msg} onConfirm={() => setApiModal({isOpen:false, msg:''})} showCancel={false} />
      
      {/* 壓力測試 Log 彈窗視窗 */}
      {isStressTesting && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <div className="bg-[#1e293b] border border-slate-600 p-6 rounded-2xl max-w-2xl w-full shadow-2xl flex flex-col h-[80vh]">
                  <h3 className="text-2xl font-black mb-4 text-yellow-400 flex justify-between items-center">
                      <span>🚀 壓力測試 (Queueing)</span>
                      <span className="text-white text-lg font-mono">{stressCount} / 900</span>
                  </h3>
                  <div className="flex-1 bg-black/50 p-4 font-mono text-[10px] md:text-xs text-green-400 overflow-y-auto rounded-lg border border-slate-700 custom-scrollbar">
                      {stressLogs.map((log, i) => <div key={i} className="mb-1 border-b border-white/5 pb-1">{log}</div>)}
                      {stressLogs.length === 0 && <div className="text-slate-500 italic">正在初始化任務...</div>}
                  </div>
                  <button onClick={() => voteService.stopStressTest()} className="mt-6 w-full py-4 bg-red-600 hover:bg-red-500 rounded-xl font-bold transition-all active:scale-95 shadow-lg">立即停止測試</button>
              </div>
          </div>
      )}

      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10">
            <h1 className="text-3xl md:text-4xl font-black flex items-center gap-3">
                <span className="text-slate-400">⚙️</span> 控制台
            </h1>
            <div className="flex gap-3">
                <button onClick={() => voteService.clearMyHistory()} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg text-sm border border-slate-600 transition-colors">清除本機紀錄</button>
                <button onClick={() => setIsAuthenticated(false)} className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-colors">登出</button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* 左側設定欄 */}
            <div className="lg:col-span-5 space-y-8">
                {/* 1. 活動模式設定 */}
                <div className="bg-[#1e293b]/60 backdrop-blur-xl border border-slate-700 p-6 rounded-3xl shadow-xl border-l-4 border-purple-500">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">🎮 活動模式設定</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isVotingOpen ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></div>
                                <span className={`font-bold ${isVotingOpen ? 'text-yellow-400' : 'text-slate-400'}`}>{isVotingOpen ? '通道已開啟' : '通道已關閉'}</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={isVotingOpen} onChange={() => voteService.setVotingStatus(!isVotingOpen)} />
                                <div className="w-14 h-7 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-yellow-500"></div>
                            </label>
                        </div>
                        <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <span className="text-lg">🏆</span>
                                <span className={`font-bold ${!globalTestMode ? 'text-blue-400' : 'text-slate-400'}`}>{!globalTestMode ? '正式模式' : '測試模式'}</span>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={globalTestMode} onChange={() => setGlobalTestMode(!globalTestMode)} />
                                <div className="w-14 h-7 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                {/* 2. 壓力測試 */}
                <div className="bg-[#1e293b]/60 backdrop-blur-xl border border-slate-700 p-6 rounded-3xl shadow-xl border-l-4 border-red-500">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">🚀 壓力測試 (Queue)</h2>
                    <button onClick={() => setConfirmModal({isOpen: true, title: '壓力測試', message: '模擬 900 人同時投票，透過背景隊列消化。確定開始？', isDangerous: true, onConfirm: () => { setConfirmModal(p => ({...p, isOpen: false})); setStressLogs([]); voteService.runStressTest(900, (c, l) => { setStressCount(c); setStressLogs(prev => [l, ...prev].slice(0, 50)); }); }})} className="w-full bg-red-900/30 hover:bg-red-800/50 border border-red-500 text-red-200 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 shadow-md">
                        開始 900 人模擬寫入 (Queue)
                    </button>
                </div>

                {/* 3. 連線診斷 */}
                <div className="bg-[#1e293b]/60 backdrop-blur-xl border border-slate-700 p-6 rounded-3xl shadow-xl border-l-4 border-blue-500">
                    <h2 className="text-xl font-bold mb-6 flex items-center gap-2">🖌 連線診斷</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <a href={voteService.getFormUrl()} target="_blank" rel="noreferrer" className="bg-slate-800 hover:bg-slate-700 p-4 rounded-xl text-center text-[10px] md:text-sm font-bold border border-slate-600 transition-colors flex items-center justify-center gap-2 shadow-sm">📝 1. 打開表單</a>
                        <button onClick={handleTestApi} disabled={isTestingApi} className="bg-slate-800 hover:bg-slate-700 p-4 rounded-xl text-center text-[10px] md:text-sm font-bold border border-slate-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50">
                            {isTestingApi ? '📡 測試中...' : '📡 2. 測試 API 讀取'}
                        </button>
                    </div>
                </div>

                <div className="text-center">
                    <button onClick={() => setConfirmModal({isOpen: true, title: '危險操作', message: '清空雲端所有參賽者的得票紀錄，歸零後無法還原！', isDangerous: true, onConfirm: async () => { setConfirmModal(p => ({...p, isOpen: false})); await voteService.resetAllRemoteVotes(); }})} className="text-red-500 hover:text-red-400 font-bold underline text-sm transition-colors uppercase tracking-widest">危險：清空所有分數</button>
                </div>
            </div>

            {/* 右側：參賽者管理欄 */}
            <div className="lg:col-span-7 bg-[#1e293b]/60 backdrop-blur-xl border border-slate-700 p-6 md:p-8 rounded-3xl shadow-xl border-l-4 border-yellow-500 h-fit">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">🎤 參賽者管理</h2>
                
                <div className="bg-yellow-900/20 border border-yellow-500/20 p-4 rounded-xl text-yellow-200 text-sm mb-8 flex items-start gap-3">
                    <span className="text-xl">💡</span>
                    <p>新增或刪除後，全場裝置重新整理後會看到變更。</p>
                </div>

                <div className="mb-10">
                    <h3 className="font-bold text-slate-400 mb-4">新增參賽者</h3>
                    <form onSubmit={async (e) => { e.preventDefault(); await voteService.addCandidate({ id: `c${Date.now()}`, ...newCandidate }); setNewCandidate({ name: '', song: '', image: '', videoLink: '' }); }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input placeholder="參賽者/隊伍名稱" required className="bg-slate-900/80 border border-slate-600 rounded-xl p-4 focus:border-yellow-500 outline-none" value={newCandidate.name} onChange={e => setNewCandidate({...newCandidate, name: e.target.value})} />
                        <input placeholder="演唱歌曲" required className="bg-slate-900/80 border border-slate-600 rounded-xl p-4 focus:border-yellow-500 outline-none" value={newCandidate.song} onChange={e => setNewCandidate({...newCandidate, song: e.target.value})} />
                        <input placeholder="照片 URL (選填)" className="bg-slate-900/80 border border-slate-600 rounded-xl p-4 focus:border-yellow-500 outline-none" value={newCandidate.image} onChange={e => setNewCandidate({...newCandidate, image: e.target.value})} />
                        <input placeholder="影片 URL (選填)" className="bg-slate-900/80 border border-slate-600 rounded-xl p-4 focus:border-yellow-500 outline-none" value={newCandidate.videoLink} onChange={e => setNewCandidate({...newCandidate, videoLink: e.target.value})} />
                        <button type="submit" className="md:col-span-2 bg-green-600 hover:bg-green-500 text-white py-4 rounded-xl font-black text-lg shadow-lg active:scale-[0.98] transition-all">+ 新增並同步</button>
                    </form>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {candidates.length === 0 ? (
                        <div className="text-center py-10 text-slate-500 italic">目前沒有參賽者</div>
                    ) : (
                        candidates.map(c => (
                            <div key={c.id} className="bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 p-4 rounded-2xl flex items-center justify-between transition-all group shadow-sm">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="w-14 h-14 rounded-full bg-slate-700 overflow-hidden shrink-0 border-2 border-slate-600 group-hover:border-yellow-500 transition-colors">
                                        {c.image ? <img src={c.image} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xl">👤</div>}
                                    </div>
                                    <div className="truncate">
                                        <div className="font-bold text-lg truncate group-hover:text-yellow-400 transition-colors">{c.name}</div>
                                        <div className="text-xs text-slate-400 uppercase tracking-widest truncate">{c.song}</div>
                                    </div>
                                </div>
                                <button onClick={() => setConfirmModal({isOpen: true, title: '刪除參賽者', message: `確定從雲端永久刪除 "${c.name}"？`, isDangerous: true, onConfirm: async () => { setConfirmModal(p => ({...p, isOpen: false})); await voteService.deleteCandidate(c.id); }})} className="text-slate-500 hover:text-red-500 p-3 bg-slate-900/50 rounded-full transition-all">
                                    ✕
                                </button>
                            </div>
                        )
                    ))}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

const DevNav: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    if (!isOpen) return <button onClick={() => setIsOpen(true)} className="fixed bottom-4 right-4 z-[120] w-12 h-12 bg-slate-800/80 backdrop-blur text-white rounded-full border border-slate-600 shadow-2xl opacity-60 hover:opacity-100 flex items-center justify-center text-xl transition-all">⚙️</button>;
    return (
        <div className="fixed bottom-4 right-4 z-[120] bg-[#1e293b]/95 backdrop-blur-xl border border-slate-600 p-3 rounded-2xl flex flex-col gap-3 shadow-2xl animate-scale-up min-w-[140px]">
            <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">導覽</span>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <Link to="/" onClick={() => setIsOpen(false)} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold text-white text-center transition-colors">投票頁面</Link>
            <Link to="/results" onClick={() => setIsOpen(false)} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold text-white text-center transition-colors">開票頁面</Link>
            <Link to="/admin" onClick={() => setIsOpen(false)} className="px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold text-white text-center shadow-lg transition-all">後台管理</Link>
        </div>
    );
};

const App: React.FC = () => (
    <HashRouter>
      <Routes>
        <Route path="/" element={<VotePage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
      <DevNav />
    </HashRouter>
);

export default App;
