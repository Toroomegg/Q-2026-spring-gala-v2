
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

// Custom Confirmation Modal
const ConfirmModal: React.FC<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDangerous?: boolean;
    showCancel?: boolean;
}> = ({ isOpen, title, message, onConfirm, onCancel, isDangerous, showCancel = true }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 border border-slate-600 p-6 rounded-2xl max-w-sm w-full shadow-2xl animate-scale-up">
                <h3 className={`text-xl font-bold mb-2 ${isDangerous ? 'text-red-500' : 'text-white'}`}>{title}</h3>
                <p className="text-slate-300 mb-6 whitespace-pre-wrap">{message}</p>
                <div className="flex gap-3 justify-end">
                    {showCancel && (
                        <button 
                            onClick={onCancel}
                            className="px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                        >
                            取消
                        </button>
                    )}
                    <button 
                        onClick={onConfirm}
                        className={`px-4 py-2 rounded-lg font-bold text-white transition-colors ${isDangerous ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                    >
                        確定
                    </button>
                </div>
            </div>
        </div>
    );
};

const Header: React.FC<{ title?: string; subtitle?: string; size?: 'small' | 'large' }> = ({ title, subtitle, size = 'large' }) => (
  <header className="text-center relative z-10 py-4 md:py-8 select-none animate-fade-in-down w-full">
    {/* Event Logo / Image Area */}
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
      <h1 className={`font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-300 to-yellow-600 drop-shadow-[0_2px_10px_rgba(234,179,8,0.5)] ${size === 'large' ? 'text-3xl md:text-5xl' : 'text-2xl md:text-4xl'} tracking-wider leading-tight`}>
        2026 廣達BU1,BU11,BU15<br className="md:hidden"/>春酒晚宴
      </h1>
    </div>
    {subtitle && (
      <p className="text-yellow-100/90 mt-2 font-bold tracking-[0.2em] uppercase text-xs md:text-lg drop-shadow-md">
        &mdash; {subtitle} &mdash;
      </p>
    )}
  </header>
);

// --- Pages ---

// 投票頁面：長滾動式，三種獎項
const VotePage: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  // Store selected candidate ID for each category
  const [selections, setSelections] = useState<{[key in VoteCategory]: string | null}>({
      [VoteCategory.SINGING]: null,
      [VoteCategory.POPULARITY]: null,
      [VoteCategory.COSTUME]: null
  });
  
  const [hasVoted, setHasVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGlobalTestMode, setIsGlobalTestMode] = useState(false);
  const [isVotingOpen, setIsVotingOpen] = useState(true);

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
      
      setSelections(prev => ({
          ...prev,
          [category]: candidateId
      }));
  };

  const isAllSelected = selections.SINGING && selections.POPULARITY && selections.COSTUME;

  const handleSubmitAll = async () => {
      if (!isAllSelected) return;
      if (!isVotingOpen && !isGlobalTestMode) {
           alert("投票通道未開啟");
           return;
      }

      setIsSubmitting(true);
      // UX Delay
      await new Promise(r => setTimeout(r, 800));

      const result = await voteService.submitVoteBatch(selections as any);
      
      if (result.success) {
          setHasVoted(true);
          // Scroll to top
          window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
          alert(result.message);
      }
      setIsSubmitting(false);
  };

  // Locked Screen
  if (!isVotingOpen && !isGlobalTestMode) {
      return (
        <div className="min-h-screen pb-24 px-4 relative z-10 overflow-hidden flex flex-col items-center justify-center">
             <div className="absolute inset-0 z-0">
                 <Fireworks />
             </div>
             <div className="z-10 text-center animate-fade-in p-8 glass-panel rounded-3xl border border-yellow-500/50 shadow-[0_0_50px_rgba(234,179,8,0.2)] max-w-md mx-auto">
                 <div className="text-6xl mb-4 animate-bounce">⏳</div>
                 <h1 className="text-3xl md:text-4xl font-black text-white mb-4">投票通道尚未開啟</h1>
                 <p className="text-slate-300 text-lg mb-6">
                     請耐心等候主持人指示<br/>
                     精彩表演即將開始！
                 </p>
                 <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                     <div className="h-full bg-yellow-500 animate-pulse w-2/3 mx-auto rounded-full"></div>
                 </div>
             </div>
        </div>
      );
  }

  // Already Voted Screen
  if (hasVoted && !isGlobalTestMode) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center px-4 relative z-10">
              <Fireworks />
              <div className="glass-panel p-8 rounded-3xl text-center max-w-md border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)] animate-scale-up">
                  <div className="text-6xl mb-4">✅</div>
                  <h1 className="text-3xl font-black text-white mb-2">投票成功！</h1>
                  <p className="text-slate-300">感謝您的參與，請靜候佳音。</p>
                  <p className="text-sm text-slate-500 mt-4">祝您中大獎！</p>
              </div>
          </div>
      );
  }

  // 取得不同分類的動態 ICON
  const getDynamicIcons = (cat: VoteCategory) => {
      switch (cat) {
          case VoteCategory.SINGING:
              return { name: "🎤", song: "🎵" };
          case VoteCategory.POPULARITY:
              return { name: "🌟", song: "🔥" };
          case VoteCategory.COSTUME:
              return { name: "💃", song: "✨" };
          default:
              return { name: "👤", song: "🎶" };
      }
  };

  // Helper to render a category section
  const renderSection = (category: VoteCategory, title: string, subtitle: string, colorClass: string, icon: string) => {
      const { name: nameIcon, song: songIcon } = getDynamicIcons(category);
      
      return (
        <div className={`mb-12 p-4 md:p-6 rounded-3xl border-2 ${colorClass} bg-slate-900/50 backdrop-blur-sm`}>
            <div className="flex items-center gap-4 mb-6 sticky top-0 bg-slate-900/95 p-4 rounded-xl z-20 shadow-lg border-b border-white/10">
                <span className="text-4xl animate-bounce">{icon}</span>
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-white">{title}</h2>
                    <p className="text-slate-400 text-sm">{subtitle}</p>
                </div>
                <div className="ml-auto">
                    {selections[category] ? (
                        <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse">已選擇</span>
                    ) : (
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">請選擇一位</span>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {candidates.map((c, index) => {
                    const isSelected = selections[category] === c.id;
                    return (
                        <div 
                            key={c.id}
                            onClick={() => handleSelect(category, c.id)}
                            className={`
                                relative rounded-2xl cursor-pointer transition-all duration-200 overflow-hidden
                                ${isSelected 
                                    ? 'ring-4 ring-green-500 scale-[1.02] shadow-[0_0_20px_rgba(34,197,94,0.5)]' 
                                    : 'border border-slate-700 hover:border-white/50 opacity-80 hover:opacity-100 grayscale-[0.5] hover:grayscale-0'
                                }
                                bg-slate-800 group
                            `}
                        >
                            <div className="h-40 w-full bg-slate-700 relative overflow-hidden">
                                {c.image ? (
                                    <img 
                                        src={c.image} 
                                        className={`w-full h-full object-cover transition-transform duration-700 ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`} 
                                    />
                                ) : null}
                                {isSelected && (
                                    <div className="absolute inset-0 bg-green-500/30 flex items-center justify-center animate-fade-in">
                                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg animate-bounce">✓</div>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 relative">
                                {/* Dynamic Background Glow */}
                                {isSelected && <div className="absolute inset-0 bg-green-500/10 blur-xl"></div>}
                                
                                <h3 className="font-bold text-white text-lg line-clamp-1 flex items-center gap-2 relative z-10">
                                    <span className="inline-block animate-bounce delay-100 filter drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                                        {nameIcon}
                                    </span>
                                    {c.name}
                                </h3>
                                <p className="text-slate-400 text-sm flex items-center gap-2 mt-1 relative z-10">
                                    <span className="inline-block animate-pulse text-yellow-400">
                                        {songIcon}
                                    </span>
                                    {c.song}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      );
  };

  return (
    <div className="min-h-screen pb-32 px-2 md:px-4 relative z-10 pt-4">
      <Header subtitle="歌唱大賽評分系統" size="small" />
      
      {isGlobalTestMode && (
          <div className="bg-green-600 text-white text-center py-2 mb-4 font-bold rounded-lg animate-pulse">
              🔧 測試模式中：送出後可再次投票
          </div>
      )}

      <div className="max-w-5xl mx-auto">
          <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-xl mb-8 flex gap-3 text-blue-200 text-sm">
              <span className="text-xl">ℹ️</span>
              <p>請為下列三個獎項各投下一票，三個獎項都選擇完畢後，下方的送出按鈕才會啟用。</p>
          </div>

          {renderSection(VoteCategory.SINGING, "Group A: 金嗓歌王獎", "請選出唱功最厲害的參賽者", "border-yellow-500/30", "🎤")}
          {renderSection(VoteCategory.POPULARITY, "Group B: 最佳人氣獎", "請選出全場氣氛最嗨的表演", "border-pink-500/30", "💖")}
          {renderSection(VoteCategory.COSTUME, "Group C: 最佳造型獎", "請選出服裝造型最用心的參賽者", "border-purple-500/30", "🎭")}
      </div>

      {/* Sticky Bottom Submit Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-md border-t border-slate-700 p-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
          <div className="max-w-xl mx-auto flex items-center gap-4">
              <div className="flex-1 text-sm text-slate-400 hidden md:block">
                  {isAllSelected ? "準備就緒！" : "還沒選完喔..."}
              </div>
              <button
                  onClick={handleSubmitAll}
                  disabled={!isAllSelected || isSubmitting}
                  className={`
                      w-full md:w-auto flex-1 py-4 rounded-xl font-black text-xl tracking-wider transition-all
                      ${isAllSelected 
                          ? 'bg-gradient-to-r from-yellow-500 to-red-600 text-white shadow-[0_0_20px_rgba(234,179,8,0.4)] hover:brightness-110 active:scale-95' 
                          : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      }
                  `}
              >
                  {isSubmitting ? '處理中...' : (isAllSelected ? '確認送出三票' : '請完成所有選擇')}
              </button>
          </div>
      </div>
    </div>
  );
};

// --- PODIUM COMPONENT (For Singing Category Only) ---
const PodiumItem: React.FC<{ 
    candidate?: Candidate; 
    rank: 1 | 2 | 3; 
    score: number;
    delay?: string 
}> = ({ candidate, rank, score, delay }) => {
    // Styling configurations based on rank
    const isWinner = rank === 1;
    
    // Height & Border Color
    let heightClass = "h-48 md:h-64"; // 2nd & 3rd
    let borderColor = "border-slate-400"; // Silver
    let shadowColor = "shadow-slate-500/20";
    let badgeIcon = "🥈";
    let badgeColor = "bg-slate-300 text-slate-900 border-white";
    let orderClass = "order-1 md:order-1"; // Desktop: Left

    if (rank === 1) {
        heightClass = "h-60 md:h-80"; // Winner is taller
        borderColor = "border-yellow-400"; // Gold
        shadowColor = "shadow-yellow-500/50";
        badgeIcon = "👑";
        badgeColor = "bg-yellow-400 text-yellow-900 border-yellow-100";
        orderClass = "order-first md:order-2"; // Desktop: Center (but mobile flex-col puts it first via order-first)
    } else if (rank === 3) {
        borderColor = "border-orange-500"; // Bronze
        shadowColor = "shadow-orange-600/20";
        badgeIcon = "🥉";
        badgeColor = "bg-orange-400 text-orange-900 border-orange-100";
        orderClass = "order-2 md:order-3"; // Desktop: Right
    }

    if (!candidate) {
        // Placeholder for empty slots
        return (
            <div className={`flex flex-col items-center justify-end w-1/3 ${orderClass} opacity-50`}>
                <div className={`w-full ${heightClass} bg-slate-800/50 rounded-t-2xl border-t-4 border-slate-700 flex items-end justify-center pb-4`}>
                    <span className="text-4xl opacity-20">?</span>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center justify-end w-full md:w-1/3 relative group ${orderClass} ${delay} animate-fade-in-up`}>
            {/* Floating Avatar */}
            <div className={`relative z-20 mb-[-30px] transition-transform duration-500 group-hover:-translate-y-2`}>
                <div className={`
                    rounded-full overflow-hidden border-4 ${borderColor} bg-slate-900 
                    ${isWinner ? 'w-24 h-24 md:w-36 md:h-36 shadow-[0_0_30px_rgba(234,179,8,0.6)]' : 'w-20 h-20 md:w-24 md:h-24 shadow-lg'}
                `}>
                     {candidate.image ? (
                        <img src={candidate.image} className="w-full h-full object-cover" onError={handleImageError} />
                     ) : (
                        <div className="w-full h-full bg-slate-700 flex items-center justify-center text-2xl">?</div>
                     )}
                </div>
                
                {/* Rank Badge */}
                <div className={`
                    absolute -bottom-2 -right-2 w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center 
                    text-base md:text-xl font-bold border-2 shadow-lg z-30 ${badgeColor}
                `}>
                    {isWinner ? '1' : rank}
                </div>
                
                {/* Crown for Winner */}
                {isWinner && (
                    <div className="absolute -top-8 md:-top-12 left-1/2 -translate-x-1/2 text-4xl md:text-6xl animate-bounce drop-shadow-[0_0_10px_rgba(234,179,8,0.8)]">
                        👑
                    </div>
                )}
            </div>

            {/* The Podium Block */}
            <div className={`
                w-full ${heightClass} rounded-t-3xl border-t-2 ${borderColor} bg-slate-800/90 backdrop-blur-md 
                flex flex-col items-center pt-10 md:pt-14 pb-4 px-2 text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]
                relative overflow-hidden
            `}>
                {/* Light Shine Effect */}
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

                <div className="relative z-10 w-full">
                    <h3 className={`font-bold text-white truncate px-2 mb-1 ${isWinner ? 'text-xl md:text-2xl' : 'text-lg md:text-xl'}`}>
                        {candidate.name}
                    </h3>
                    <p className="text-slate-400 text-xs md:text-sm mb-3 truncate px-2">
                        {candidate.song}
                    </p>
                    
                    <div className="mt-auto">
                        <div className={`font-black font-mono tracking-tighter leading-none ${isWinner ? 'text-yellow-400 text-4xl md:text-5xl' : 'text-white text-3xl md:text-4xl'}`}>
                            {score}
                        </div>
                        <div className="text-[10px] md:text-xs text-slate-500 uppercase font-bold tracking-widest mt-1">
                            {isWinner ? 'CHAMPION' : 'POINTS'}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// 結果頁面：Podium (For Singing) + List (For Others)
const ResultsPage: React.FC = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [commentary, setCommentary] = useState<string>("AI 正在分析戰況...");
  const [activeTab, setActiveTab] = useState<VoteCategory>(VoteCategory.SINGING);
  const [confirmTab, setConfirmTab] = useState<{isOpen: boolean, target: VoteCategory | null}>({isOpen: false, target: null});
  
  useEffect(() => {
    voteService.startPolling();

    const updateData = () => {
      setCandidates(voteService.getCandidates());
    };

    updateData();
    const unsub = voteService.subscribe(updateData);
    
    const commentInterval = setInterval(async () => {
        const currentCandidates = voteService.getCandidates();
        if (currentCandidates.length > 0) {
            const text = await generateLiveCommentary(currentCandidates);
            setCommentary(text);
        }
    }, 20000);

    return () => {
        voteService.stopPolling();
        unsub();
        clearInterval(commentInterval);
    };
  }, []);

  const handleTabClick = (category: VoteCategory) => {
      if (category === activeTab) return;
      setConfirmTab({ isOpen: true, target: category });
  };

  const confirmTabSwitch = () => {
      if (confirmTab.target) {
          setActiveTab(confirmTab.target);
      }
      setConfirmTab({ isOpen: false, target: null });
  };

  // Sort Logic based on Active Tab
  const getSortedCandidates = () => {
      const list = [...candidates];
      switch (activeTab) {
          case VoteCategory.SINGING:
              return list.sort((a, b) => b.scoreSinging - a.scoreSinging);
          case VoteCategory.POPULARITY:
              return list.sort((a, b) => b.scorePopularity - a.scorePopularity);
          case VoteCategory.COSTUME:
              return list.sort((a, b) => b.scoreCostume - a.scoreCostume);
          default:
              return list;
      }
  };

  const sortedCandidates = getSortedCandidates();
  
  // Helpers to get specific score
  const getScore = (c: Candidate) => {
    if (activeTab === VoteCategory.SINGING) return c.scoreSinging;
    if (activeTab === VoteCategory.POPULARITY) return c.scorePopularity;
    if (activeTab === VoteCategory.COSTUME) return c.scoreCostume;
    return 0;
  };
  
  const getTabInfo = (cat: VoteCategory) => {
      switch(cat) {
          case VoteCategory.SINGING: return { name: '金嗓歌王', icon: '🎤', color: 'text-yellow-400', border: 'border-yellow-500' };
          case VoteCategory.POPULARITY: return { name: '最佳人氣', icon: '💖', color: 'text-pink-400', border: 'border-pink-500' };
          case VoteCategory.COSTUME: return { name: '最佳造型', icon: '🎭', color: 'text-purple-400', border: 'border-purple-500' };
      }
  };
  const currentTabInfo = getTabInfo(activeTab);

  // --- RENDERERS ---

  // 1. 金嗓歌王專用：頒獎台模式
  const renderPodiumView = () => {
      const top3 = sortedCandidates.slice(0, 3);
      const others = sortedCandidates.slice(3, 5); // 4th and 5th

      return (
          <>
             {/* PODIUM (Top 3) */}
            <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 mb-12 min-h-[400px]">
                <PodiumItem candidate={top3[1]} rank={2} score={top3[1] ? getScore(top3[1]) : 0} delay="delay-200" />
                <PodiumItem candidate={top3[0]} rank={1} score={top3[0] ? getScore(top3[0]) : 0} />
                <PodiumItem candidate={top3[2]} rank={3} score={top3[2] ? getScore(top3[2]) : 0} delay="delay-300" />
            </div>

            {/* THE REST (Rank 4 & 5) */}
            <div className="max-w-4xl mx-auto space-y-4">
                {others.map((c, idx) => {
                    const realRank = idx + 4;
                    const score = getScore(c);
                    return (
                        <div key={c.id} className="bg-slate-800/60 backdrop-blur border border-slate-700 rounded-xl p-4 flex items-center animate-fade-in-up delay-500 hover:bg-slate-800 transition-colors">
                            <div className="w-12 text-2xl font-black text-slate-500">#{realRank}</div>
                            <div className="w-14 h-14 rounded-full overflow-hidden border border-slate-600 bg-slate-900 mx-4">
                                {c.image && <img src={c.image} className="w-full h-full object-cover" onError={handleImageError} />}
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-white text-lg">{c.name}</h4>
                                <div className="text-slate-400 text-sm">🎵 {c.song}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-2xl font-bold text-white font-mono">{score}</div>
                                <div className="text-[10px] text-slate-500 uppercase">pts</div>
                            </div>
                        </div>
                    );
                })}
            </div>
          </>
      );
  };

  // 2. 其他獎項專用：標準條列模式 (Original Mode)
  const renderStandardListView = () => {
      return (
          <div className="max-w-4xl mx-auto space-y-4 mt-8">
              {sortedCandidates.map((c, index) => {
                  const rank = index + 1;
                  const score = getScore(c);
                  
                  // Highlight colors for Top 3
                  let rankColor = "text-slate-400";
                  let borderColor = "border-slate-700";
                  let bgColor = "bg-slate-800/50";
                  let icon = `#${rank}`;

                  if (rank === 1) {
                      rankColor = "text-yellow-400";
                      borderColor = "border-yellow-500";
                      bgColor = "bg-yellow-900/20";
                      icon = "👑";
                  } else if (rank === 2) {
                      rankColor = "text-slate-300";
                      borderColor = "border-slate-400";
                      bgColor = "bg-slate-800/80";
                      icon = "🥈";
                  } else if (rank === 3) {
                      rankColor = "text-orange-400";
                      borderColor = "border-orange-500";
                      bgColor = "bg-orange-900/20";
                      icon = "🥉";
                  }

                  return (
                      <div 
                        key={c.id} 
                        className={`
                            relative flex items-center p-4 rounded-xl border ${borderColor} ${bgColor} 
                            backdrop-blur-sm transition-all hover:scale-[1.01] animate-fade-in-up
                        `}
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                          {/* Rank Icon */}
                          <div className={`w-16 flex justify-center text-3xl font-black ${rankColor} drop-shadow-md`}>
                              {icon}
                          </div>

                          {/* Avatar */}
                          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600 bg-slate-900 mx-4 shrink-0 shadow-lg">
                              {c.image ? <img src={c.image} className="w-full h-full object-cover" onError={handleImageError} /> : null}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0 pr-4">
                              <h3 className="text-xl font-bold text-white truncate">{c.name}</h3>
                              <p className="text-slate-400 text-sm truncate flex items-center gap-2">
                                  <span>🎵</span> {c.song}
                              </p>
                          </div>

                          {/* Score */}
                          <div className="text-right pl-4 border-l border-white/10">
                              <div className={`text-3xl font-black font-mono ${rank === 1 ? 'text-yellow-400' : 'text-white'}`}>
                                  {score}
                              </div>
                              <div className="text-[10px] text-slate-500 uppercase font-bold">POINTS</div>
                          </div>
                      </div>
                  );
              })}
              
              {candidates.length === 0 && (
                <div className="text-center py-10 text-slate-500">目前沒有資料</div>
              )}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white overflow-hidden relative pb-40">
      <Fireworks />
      <ConfirmModal 
        isOpen={confirmTab.isOpen} 
        title="⚠️ 準備揭曉獎項" 
        message={`確定要切換到「${confirmTab.target ? getTabInfo(confirmTab.target).name : ''}」嗎？\n這將會顯示目前的即時排名。`}
        onConfirm={confirmTabSwitch}
        onCancel={() => setConfirmTab({isOpen: false, target: null})}
      />

      <div className="relative z-10 px-4 md:px-8 py-6 max-w-7xl mx-auto h-full flex flex-col">
        <Header size="small" subtitle="即時戰況" />

        {/* Tabs */}
        <div className="flex justify-center gap-2 md:gap-4 mb-4">
            {[VoteCategory.SINGING, VoteCategory.POPULARITY, VoteCategory.COSTUME].map(cat => {
                const info = getTabInfo(cat);
                const isActive = activeTab === cat;
                return (
                    <button
                        key={cat}
                        onClick={() => handleTabClick(cat)}
                        className={`
                            px-4 md:px-8 py-3 rounded-t-xl font-bold text-lg md:text-xl transition-all border-b-4 flex items-center gap-2
                            ${isActive 
                                ? `bg-slate-800 ${info.color} ${info.border} shadow-[0_-5px_20px_rgba(0,0,0,0.5)] transform -translate-y-1` 
                                : 'bg-slate-900/50 text-slate-500 border-transparent hover:bg-slate-800 hover:text-slate-300'
                            }
                        `}
                    >
                        <span className={isActive ? 'animate-bounce' : ''}>{info.icon}</span>
                        {info.name}
                    </button>
                );
            })}
        </div>

        {/* --- MAIN DISPLAY AREA --- */}
        <div className="w-full max-w-6xl mx-auto min-h-[500px]">
            {activeTab === VoteCategory.SINGING 
                ? renderPodiumView() 
                : renderStandardListView()
            }
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-md border-t-2 border-yellow-500 z-50 py-3 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-4">
            <span className="text-3xl animate-bounce">🤖</span>
            <div className="flex-1 overflow-hidden">
                <p className="text-xl md:text-2xl font-bold text-yellow-100 whitespace-nowrap overflow-hidden text-ellipsis">
                    {commentary}
                </p>
            </div>
        </div>
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
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Dialog States
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, isDangerous?: boolean, showCancel?: boolean}>({
      isOpen: false, title: '', message: '', onConfirm: () => {}, showCancel: true
  });

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
    return () => {
        voteService.stopPolling();
        unsub();
    };
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin888') {
      setIsAuthenticated(true);
    } else {
      alert('密碼錯誤');
    }
  };

  const handleGlobalTestModeToggle = async () => {
      const newState = !globalTestMode;
      setIsSaving(true);
      await voteService.setGlobalTestMode(newState);
      setIsSaving(false);
  };

  const handleVotingStatusToggle = async () => {
      const newState = !isVotingOpen;
      setIsSaving(true);
      await voteService.setVotingStatus(newState);
      setIsSaving(false);
  };

  const handleAddCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `c${Date.now()}`;
    
    setConfirmModal({
        isOpen: true,
        title: '新增參賽者',
        message: `確定要新增 "${newCandidate.name}" 嗎？\n這將會寫入 Google Sheet。`,
        showCancel: true,
        onConfirm: async () => {
            setConfirmModal(prev => ({...prev, isOpen: false}));
            setIsSaving(true);
            await voteService.addCandidate({ id, ...newCandidate });
            setNewCandidate({ name: '', song: '', image: '', videoLink: '' });
            setIsSaving(false);
        }
    });
  };

  const handleDelete = (id: string, name: string) => {
    setConfirmModal({
        isOpen: true,
        title: '刪除參賽者',
        message: `⚠️ 警告：確定要刪除 "${name}" 嗎？\n此操作無法復原，且會同步刪除 Excel 中的資料。`,
        isDangerous: true,
        showCancel: true,
        onConfirm: async () => {
            setConfirmModal(prev => ({...prev, isOpen: false}));
            setIsSaving(true);
            await voteService.deleteCandidate(id);
            setIsSaving(false);
        }
    });
  };

  const handleStressTest = () => {
    setConfirmModal({
        isOpen: true,
        title: '🔥 開始 900 人壓力測試',
        message: '這將模擬 900 位使用者，每人投 3 票 (總共 2700 個請求)。\n系統將使用排隊機制依序寫入。\n確定要開始嗎？',
        isDangerous: true,
        showCancel: true,
        onConfirm: () => {
            setConfirmModal(prev => ({...prev, isOpen: false}));
            setStressLogs([]);
            voteService.runStressTest(900, (count, log) => {
                setStressCount(count);
                setStressLogs(prev => [log, ...prev].slice(0, 100)); // Keep last 100 logs
            });
        }
    });
  };

  const handleResetScores = () => {
    setConfirmModal({
        isOpen: true,
        title: '⚠️ 清空雲端所有票數',
        message: '警告：這將會清空 Google Sheet 中的所有分數紀錄！\n此操作無法復原。',
        isDangerous: true,
        showCancel: true,
        onConfirm: async () => {
            setConfirmModal(prev => ({...prev, isOpen: false}));
            setIsSaving(true);
            await voteService.resetAllRemoteVotes();
            setIsSaving(false);
        }
    });
  };

  const handleTestConnection = async () => {
      const res = await voteService.testConnection();
      setConfirmModal({
          isOpen: true,
          title: res.ok ? '連線成功' : '連線失敗',
          message: res.message,
          showCancel: false,
          onConfirm: () => setConfirmModal(prev => ({...prev, isOpen: false}))
      });
  };
  
  const openFormDiagnostic = () => {
      window.open(voteService.getFormUrl(), '_blank');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <form onSubmit={handleLogin} className="glass-panel p-8 rounded-2xl w-full max-w-md">
          <h2 className="text-2xl font-bold text-center mb-6">後台管理登入</h2>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 mb-4 text-white" placeholder="請輸入密碼" />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg">登入</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 pb-24">
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({...prev, isOpen: false}))}
        isDangerous={confirmModal.isDangerous}
        showCancel={confirmModal.showCancel}
      />

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">⚙️ 控制台</h1>
            <div className="flex gap-2">
                <button onClick={() => voteService.clearMyHistory()} className="bg-slate-700 px-4 py-2 rounded-lg text-sm">清除本機紀錄</button>
                <button onClick={() => setIsAuthenticated(false)} className="bg-red-600 px-4 py-2 rounded-lg text-sm">登出</button>
            </div>
        </div>

        {isSaving && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
                <div className="bg-slate-800 p-6 rounded-xl flex items-center gap-4 border border-slate-600 shadow-2xl">
                    <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-white font-bold">處理中...</span>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: System & Tests */}
            <div className="space-y-8">
              {/* Global Mode Switch */}
              <div className="glass-panel p-6 rounded-2xl border-l-4 border-purple-500">
                  <h2 className="text-xl font-bold mb-4">🎮 活動模式設定</h2>
                  
                  <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl mb-4">
                      <div>
                          <p className={`font-bold ${isVotingOpen ? 'text-yellow-400' : 'text-slate-400'}`}>
                              {isVotingOpen ? '🟢 通道已開啟' : '🔴 通道已關閉'}
                          </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={isVotingOpen} onChange={handleVotingStatusToggle} disabled={isSaving} />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                      </label>
                  </div>

                  <div className="flex items-center justify-between bg-slate-800 p-4 rounded-xl">
                      <div>
                          <p className={`font-bold ${globalTestMode ? 'text-green-400' : 'text-blue-400'}`}>
                              {globalTestMode ? '🛠 測試模式' : '🏆 正式模式'}
                          </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" className="sr-only peer" checked={globalTestMode} onChange={handleGlobalTestModeToggle} disabled={isSaving} />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                      </label>
                  </div>
              </div>

              {/* Stress Test */}
              <div className="glass-panel p-6 rounded-2xl border-l-4 border-red-500">
                <h2 className="text-xl font-bold mb-4">🚀 壓力測試 (Queue)</h2>
                {isStressTesting ? (
                         <div className="text-center py-4">
                             <div className="text-2xl font-bold text-yellow-400 animate-pulse mb-2">已完成使用者: {stressCount} / 900</div>
                             <p className="text-xs text-slate-400">Queue Size: {voteService['requestQueue'].size} (Processing...)</p>
                             <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden mt-2">
                                 <div className="h-full bg-yellow-500 animate-pulse w-full"></div>
                             </div>
                             
                             {/* Log Console */}
                             <div className="mt-4 bg-slate-950 rounded border border-slate-700 p-2 h-48 overflow-y-auto font-mono text-xs text-green-500 text-left shadow-inner custom-scrollbar">
                                {stressLogs.map((log, i) => (
                                    <div key={i} className="border-b border-white/5 py-0.5 whitespace-nowrap">{log}</div>
                                ))}
                             </div>

                             <button onClick={() => voteService.stopStressTest()} className="mt-4 bg-red-600 px-6 py-2 rounded-full font-bold">停止測試</button>
                         </div>
                    ) : (
                        <div>
                            <button 
                                onClick={handleStressTest}
                                className="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/50 py-3 rounded-lg font-bold transition-colors"
                            >
                                開始 900 人模擬寫入 (Queue)
                            </button>
                            {/* Static log window if not running but has logs */}
                            {stressLogs.length > 0 && (
                                <div className="mt-4 bg-slate-950 rounded border border-slate-700 p-2 h-48 overflow-y-auto font-mono text-xs text-slate-400 text-left shadow-inner custom-scrollbar opacity-70">
                                    {stressLogs.map((log, i) => (
                                        <div key={i} className="border-b border-white/5 py-0.5 whitespace-nowrap">{log}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
              </div>

               {/* Diagnostics */}
              <div className="glass-panel p-6 rounded-2xl border-l-4 border-blue-500">
                  <h2 className="text-xl font-bold mb-4">🔧 連線診斷</h2>
                  <div className="grid grid-cols-2 gap-4">
                      <button onClick={openFormDiagnostic} className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg text-sm text-left">
                          📝 1. 打開表單 (檢查權限)
                      </button>
                      <button onClick={handleTestConnection} className="bg-slate-700 hover:bg-slate-600 p-3 rounded-lg text-sm text-left">
                          📡 2. 測試 API 讀取
                      </button>
                  </div>
              </div>

              <div className="text-center pt-4">
                 <button onClick={handleResetScores} className="text-red-500 hover:text-red-400 underline text-sm">危險：清空所有分數</button>
              </div>
            </div>

            {/* Right Column: Manage Candidates */}
            <div className="glass-panel p-6 rounded-2xl border-l-4 border-yellow-500 h-fit">
             <h2 className="text-xl font-bold mb-4 flex justify-between items-center">
                 🎤 參賽者管理
             </h2>
             <div className="bg-yellow-500/10 text-yellow-200 p-3 rounded-lg text-sm mb-6 border border-yellow-500/20">
                 💡 新增或刪除後，全場裝置重新整理後會看到變更。
             </div>

             <form onSubmit={handleAddCandidate} className="mb-8 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                 <h3 className="font-bold mb-4 text-slate-300">新增參賽者</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                     <input placeholder="參賽者/隊伍名稱" required className="bg-slate-900 border border-slate-600 rounded p-2" value={newCandidate.name} onChange={e => setNewCandidate({...newCandidate, name: e.target.value})} />
                     <input placeholder="演唱歌曲" required className="bg-slate-900 border border-slate-600 rounded p-2" value={newCandidate.song} onChange={e => setNewCandidate({...newCandidate, song: e.target.value})} />
                     <input placeholder="照片 URL (選填)" className="bg-slate-900 border border-slate-600 rounded p-2" value={newCandidate.image} onChange={e => setNewCandidate({...newCandidate, image: e.target.value})} />
                     <input placeholder="影片 URL (選填)" className="bg-slate-900 border border-slate-600 rounded p-2" value={newCandidate.videoLink} onChange={e => setNewCandidate({...newCandidate, videoLink: e.target.value})} />
                 </div>
                 <button type="submit" disabled={isSaving} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded-lg disabled:opacity-50">
                     {isSaving ? '處理中...' : '+ 新增並同步'}
                 </button>
             </form>

             <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                 {candidates.map(c => (
                     <div key={c.id} className="bg-slate-800 p-4 rounded-xl flex items-center justify-between group hover:bg-slate-750 transition-colors">
                         <div className="flex items-center gap-3">
                             <div className="w-10 h-10 rounded-full bg-slate-600 overflow-hidden">
                                 {c.image && <img src={c.image} className="w-full h-full object-cover" />}
                             </div>
                             <div>
                                 <div className="font-bold">{c.name}</div>
                                 <div className="text-xs text-slate-400">{c.song}</div>
                             </div>
                         </div>
                         <div className="flex items-center gap-4">
                             <button 
                                onClick={() => handleDelete(c.id, c.name)}
                                className="text-slate-500 hover:text-red-500 p-2 transition-colors"
                                title="刪除"
                             >
                                 ✕
                             </button>
                         </div>
                     </div>
                 ))}
                 {candidates.length === 0 && <p className="text-slate-500 text-center py-4">目前沒有參賽者</p>}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const DevNav: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    if (!isOpen) {
        return <button onClick={() => setIsOpen(true)} className="fixed bottom-4 right-4 z-50 w-10 h-10 bg-slate-800/80 backdrop-blur text-white rounded-full flex items-center justify-center border border-slate-600 shadow-lg opacity-50 hover:opacity-100">🛠</button>;
    }
    return (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900/90 backdrop-blur border border-slate-600 p-2 rounded-xl flex flex-col gap-2 shadow-2xl">
            <div className="flex justify-between items-center px-2 mb-1 border-b border-slate-700 pb-1">
                <span className="text-xs font-bold text-slate-400">Nav</span>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <Link to="/" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-center">投票頁</Link>
            <Link to="/results" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-center">開票頁</Link>
            <Link to="/admin" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-center">後台</Link>
        </div>
    );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<VotePage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
      <DevNav />
    </HashRouter>
  );
};

export default App;
