
import { Candidate, COLORS, VoteCategory } from '../types';

// --- CONFIGURATION ---
const CONFIG = {
  // 1. Google Form "Action" URL
  GOOGLE_FORM_ACTION_URL: "https://docs.google.com/forms/d/e/1FAIpQLSfHnTR9oG-i7kIaRnMZRQns2N3GQ8nmQVykRTiGNfew5s1Zjg/formResponse", 

  // 2. Google Apps Script Web App URL
  GOOGLE_SCRIPT_URL: "https://script.google.com/macros/s/AKfycby4NIn26J9aRFbw_TMG_mLcI8udXCLFGt1IyLbo016qlWO580S-xXPzV2avDRqLCkEEzA/exec",

  // 3. Entry IDs
  FORM_FIELDS: {
    CANDIDATE_ID: "entry.1684744453", 
    CATEGORY: "entry.2147058269",     
    SCORE: "entry.269498474",         
  },

  POLLING_INTERVAL: 3000
};

// --- QUEUE SYSTEM ---
class RequestQueue {
    private queue: Array<() => Promise<void>> = [];
    private maxConcurrent = 6; // 提升併發數以加快壓力測試消化速度
    private activeRequests = 0;

    add(task: () => Promise<void>) {
        this.queue.push(task);
        this.process();
    }

    private async process() {
        if (this.queue.length === 0) return;
        if (this.activeRequests >= this.maxConcurrent) return;

        const task = this.queue.shift();
        if (task) {
            this.activeRequests++;
            try {
                await task();
            } catch (e) {
                console.error("Queue task failed", e);
            } finally {
                this.activeRequests--;
                this.process(); 
            }
        }
    }
    
    get size() { return this.queue.length; }
}

const STORAGE_KEY_HAS_VOTED = 'spring_gala_has_voted_v2';
const SETTING_ROW_ID = 'SETTING_MODE'; 
const STATUS_ROW_ID = 'VOTING_STATUS';

class VoteService {
  private listeners: Array<() => void> = [];
  private candidates: Candidate[] = []; // 預設為空，等待讀取
  private pollingIntervalId: any = null;
  private pollingSubscriberCount = 0; 
  private consecutiveErrors = 0; 
  private requestQueue = new RequestQueue();
  
  public isDemoMode = false;
  public isGlobalTestMode = false;
  public isVotingOpen = true; 
  
  private hasSettingRow = false; 
  private hasStatusRow = false;

  public isRunningStressTest = false;

  constructor() {}

  // --- PUBLIC API ---

  getCandidates(): Candidate[] {
    return this.candidates;
  }

  hasVoted(): boolean {
      return !!localStorage.getItem(STORAGE_KEY_HAS_VOTED);
  }

  // --- CONFIG SYNC ---

  private async sendConfigToSheet(action: 'ADD' | 'UPDATE' | 'DELETE' | 'RESET_SCORES', payload: any) {
    if (this.isDemoMode) {
        this.applyLocalDemoChange(action, payload);
        return;
    }

    try {
        console.log(`[VoteService] Sending ${action} to Google Sheet...`);
        // 使用 no-cors 模式，我們無法讀取回應內容，但這能避開 CORS 錯誤
        await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' }, // Apps Script 比較喜歡 text/plain
            body: JSON.stringify({ action: action, payload: payload })
        });
        
        console.log(`[VoteService] Sent. Waiting for refresh...`);
        // 稍微等待 Apps Script 處理完寫入 Cache
        setTimeout(() => this.fetchLatestData(), 1500);
    } catch (e) {
        console.error("Config Sync Failed:", e);
        alert("連線失敗，請檢查網路或 Apps Script URL。");
    }
  }

  async addCandidate(c: Omit<Candidate, 'totalScore' | 'voteCount' | 'color' | 'scoreSinging' | 'scorePopularity' | 'scoreCostume'>) {
      await this.sendConfigToSheet('ADD', c);
  }

  async updateCandidate(id: string, updates: Partial<Candidate>) {
      await this.sendConfigToSheet('UPDATE', { id, ...updates });
  }

  async deleteCandidate(id: string) {
      await this.sendConfigToSheet('DELETE', { id });
  }

  async resetAllRemoteVotes() {
      await this.sendConfigToSheet('RESET_SCORES', {});
      this.candidates = this.candidates.map(c => ({
          ...c, totalScore: 0, voteCount: 0, scoreSinging: 0, scorePopularity: 0, scoreCostume: 0
      }));
      this.notifyListeners();
  }

  async setGlobalTestMode(enabled: boolean) {
      const payload = { id: SETTING_ROW_ID, name: enabled ? 'TEST' : 'OFFICIAL', song: 'SYSTEM_CONFIG' };
      if (this.hasSettingRow) await this.sendConfigToSheet('UPDATE', payload);
      else await this.sendConfigToSheet('ADD', payload);
      this.isGlobalTestMode = enabled;
      this.notifyListeners();
  }

  async setVotingStatus(isOpen: boolean) {
      const payload = { id: STATUS_ROW_ID, name: isOpen ? 'OPEN' : 'CLOSED', song: 'SYSTEM_STATUS' };
      if (this.hasStatusRow) await this.sendConfigToSheet('UPDATE', payload);
      else await this.sendConfigToSheet('ADD', payload);
      this.isVotingOpen = isOpen;
      this.notifyListeners();
  }

  private applyLocalDemoChange(action: string, payload: any) {
      if (action === 'ADD') {
           const newC = { ...payload, totalScore: 0, voteCount: 0, scoreSinging: 0, scorePopularity: 0, scoreCostume: 0, color: '#999' };
           this.candidates = [...this.candidates, newC];
      } else if (action === 'UPDATE') {
           this.candidates = this.candidates.map(c => c.id === payload.id ? { ...c, ...payload } : c);
      } else if (action === 'DELETE') {
           this.candidates = this.candidates.filter(c => c.id !== payload.id);
      }
      this.notifyListeners();
  }

  // --- VOTING ---

  getFormUrl(): string {
      return CONFIG.GOOGLE_FORM_ACTION_URL.replace('formResponse', 'viewform');
  }

  // 批次提交三張票
  async submitVoteBatch(votes: { [key in VoteCategory]: string }, isStressTest = false): Promise<{ success: boolean; message?: string }> {
    // 如果不是壓力測試，才檢查通道狀態
    if (!isStressTest && !this.isVotingOpen && !this.isGlobalTestMode) {
         return { success: false, message: "目前投票通道尚未開啟！" };
    }

    // 如果不是壓力測試，才檢查是否已投票
    if (!isStressTest && !this.isGlobalTestMode && this.hasVoted()) {
      return { success: false, message: "您已經投過票了！" };
    }

    if (this.isDemoMode) {
        this.saveVoteLocally(votes);
        return { success: true };
    }

    const categories = [VoteCategory.SINGING, VoteCategory.POPULARITY, VoteCategory.COSTUME];
    
    const promises = categories.map(cat => {
        const candidateId = votes[cat];
        return new Promise<void>((resolve, reject) => {
            this.requestQueue.add(async () => {
                const params = new URLSearchParams();
                params.append(CONFIG.FORM_FIELDS.CANDIDATE_ID, candidateId);
                params.append(CONFIG.FORM_FIELDS.CATEGORY, cat);
                params.append(CONFIG.FORM_FIELDS.SCORE, "1");
                
                try {
                    await fetch(CONFIG.GOOGLE_FORM_ACTION_URL, {
                        method: 'POST',
                        mode: 'no-cors',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params.toString()
                    });
                    resolve();
                } catch (e) {
                    console.error("Single vote failed", e);
                    resolve(); 
                }
            });
        });
    });

    try {
        await Promise.all(promises);
        if (!this.isGlobalTestMode && !isStressTest) {
            localStorage.setItem(STORAGE_KEY_HAS_VOTED, 'true');
            this.notifyListeners();
        }
        return { success: true };
    } catch (error) {
        return { success: false, message: "傳送過程發生錯誤，請稍後再試。" };
    }
  }

  private saveVoteLocally(votes: { [key in VoteCategory]: string }) {
      if (!this.isGlobalTestMode) {
          localStorage.setItem(STORAGE_KEY_HAS_VOTED, 'true');
      }
      this.notifyListeners();
  }

  // --- STRESS TEST (900 Users) ---
  async runStressTest(totalUsers: number, onProgress: (count: number, log: string) => void) {
      if (this.isRunningStressTest) return;
      this.isRunningStressTest = true;
      
      console.log(`🔥 Starting Stress Test: ${totalUsers} users...`);
      let usersProcessed = 0;

      // 使用迴圈快速產生請求並塞入 Queue，但不等待請求完成 (No Await)
      for (let i = 0; i < totalUsers; i++) {
          if (!this.isRunningStressTest) break;
          if (this.candidates.length === 0) {
              onProgress(0, "❌ No candidates found! Add candidates first.");
              this.isRunningStressTest = false;
              return;
          }

          const cA = this.candidates[Math.floor(Math.random() * this.candidates.length)];
          const cB = this.candidates[Math.floor(Math.random() * this.candidates.length)];
          const cC = this.candidates[Math.floor(Math.random() * this.candidates.length)];

          const votes = {
              [VoteCategory.SINGING]: cA.id,
              [VoteCategory.POPULARITY]: cB.id,
              [VoteCategory.COSTUME]: cC.id
          };
          
          const userNum = i + 1;
          const logMsg = `User #${userNum} ➔ 🎤${cA.name} / 💖${cB.name} / 🎭${cC.name}`;

          // 關鍵修改：使用 .then() 處理完成後的計數，而不要在主迴圈 await
          // 傳入 true 作為第二個參數 (isStressTest)，強制繞過 hasVoted 檢查
          this.submitVoteBatch(votes, true).then(() => {
              usersProcessed++;
              onProgress(usersProcessed, `✅ ${logMsg} (Done)`);
          });

          // 僅稍微延遲以避免瀏覽器 UI 凍結，但遠快於等待網路回應
          // 這樣可以讓 Queue 迅速堆積到幾千筆，然後由 Queue 機制慢慢消化
          await new Promise(r => setTimeout(r, 10));
          
          // 顯示「已排程」的 Log
          onProgress(usersProcessed, `⏳ Queueing User #${userNum}...`);
      }
      
      // 注意：迴圈結束時，請求可能還在 Queue 裡面跑，這是正常的
      // isRunningStressTest 設為 false 會停止產生新請求，但已排程的會繼續執行
      console.log("🔥 All stress test tasks queued.");
      // 我們不立即把 isRunningStressTest 設為 false，因為背景還在跑
      // 簡單起見，我們讓使用者手動停止或等待 Queue 消化完
  }

  stopStressTest() {
      this.isRunningStressTest = false;
  }

  // --- POLLING ---

  startPolling() {
    this.pollingSubscriberCount++;
    if (this.pollingIntervalId) return; 
    
    this.fetchLatestData(); 
    this.pollingIntervalId = setInterval(() => {
      this.fetchLatestData();
    }, CONFIG.POLLING_INTERVAL);
  }

  stopPolling() {
    this.pollingSubscriberCount--;
    if (this.pollingSubscriberCount <= 0) {
      this.pollingSubscriberCount = 0; 
      if (this.pollingIntervalId) {
        clearInterval(this.pollingIntervalId);
        this.pollingIntervalId = null;
      }
    }
  }

  async testConnection(): Promise<{ok: boolean, message: string}> {
      try {
          const res = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?t=${Date.now()}`);
          if (res.ok) {
              await res.text();
              return { ok: true, message: `連接成功！Apps Script 回應正常。` };
          } else {
              return { ok: false, message: `HTTP 錯誤: ${res.status}` };
          }
      } catch (e: any) {
          return { ok: false, message: `連接失敗: ${e.message}` };
      }
  }

  public async fetchLatestData() {
    if (this.consecutiveErrors > 5 && Math.random() > 0.2) return;

    try {
      const url = `${CONFIG.GOOGLE_SCRIPT_URL}?t=${Date.now()}`;
      const res = await fetch(url);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      this.consecutiveErrors = 0; 
      const text = await res.text();
      let data;
      try { 
          data = JSON.parse(text); 
      } catch (e) { 
          console.warn("[VoteService] Invalid JSON:", text);
          return; 
      }

      // 如果回傳錯誤
      if (data.error) {
          console.error("[VoteService] Script Error:", data.error);
          return;
      }

      const remoteScores = data.s || {};
      const remoteConfig = data.c || [];

      let hasChanges = false;
      let settingRowFound = false;
      let statusRowFound = false;
      let newGlobalTestMode = this.isGlobalTestMode; 
      let newVotingOpen = this.isVotingOpen;

      const validRemoteCandidates: any[] = [];

      if (Array.isArray(remoteConfig)) {
          remoteConfig.forEach((rc: any) => {
              // 確保 ID 是字串
              const id = String(rc.id || '').trim();
              if (!id) return;

              if (id === SETTING_ROW_ID) {
                  settingRowFound = true;
                  if (rc.name === 'TEST') newGlobalTestMode = true;
                  else newGlobalTestMode = false;
              } else if (id === STATUS_ROW_ID) {
                  statusRowFound = true;
                  if (rc.name === 'CLOSED') newVotingOpen = false;
                  else newVotingOpen = true; 
              } else {
                  validRemoteCandidates.push({ ...rc, id }); 
              }
          });
      }

      this.hasSettingRow = settingRowFound;
      this.hasStatusRow = statusRowFound;

      if (this.isGlobalTestMode !== newGlobalTestMode) {
          this.isGlobalTestMode = newGlobalTestMode;
          hasChanges = true;
      }
      
      if (this.isVotingOpen !== newVotingOpen) {
          this.isVotingOpen = newVotingOpen;
          hasChanges = true;
      }

      // ⚠️ 關鍵修改：不論有沒有抓到資料，都直接使用遠端資料。
      // 如果遠端是空的，this.candidates 就會變空（這是正確的，代表 Excel 沒資料）
      // 這樣才能反映「手動刪除」或「手動新增」的結果
      const sourceList = validRemoteCandidates;

      let newCandidateList = sourceList.map((src: any, index: number) => {
          const existing = this.candidates.find(c => c.id === src.id);
          // 確保所有欄位都有預設值，避免 undefined 錯誤
          return {
              id: src.id,
              name: src.name || 'Unknown',
              song: src.song || '',
              image: src.image || '',
              videoLink: src.videoLink || '',
              totalScore: existing?.totalScore || 0,
              scoreSinging: existing?.scoreSinging || 0,
              scorePopularity: existing?.scorePopularity || 0,
              scoreCostume: existing?.scoreCostume || 0,
              voteCount: existing?.voteCount || 0,
              color: existing?.color || COLORS[index % COLORS.length]
          };
      });

      // Update Scores
      newCandidateList = newCandidateList.map(c => {
        const stats = remoteScores[c.id];
        if (stats) {
            const rawTotal = stats.total !== undefined ? stats.total : (stats.t || 0);
            const finalSinging = stats.s !== undefined ? stats.s : rawTotal; 
            const finalPop = stats.p !== undefined ? stats.p : 0;
            const finalCostume = stats.c !== undefined ? stats.c : 0;

            if (c.totalScore !== rawTotal || c.scoreSinging !== finalSinging) {
                hasChanges = true;
                return { 
                    ...c, 
                    totalScore: rawTotal,
                    scoreSinging: finalSinging,
                    scorePopularity: finalPop,
                    scoreCostume: finalCostume,
                    voteCount: stats.count || 0
                };
            }
        }
        return c;
      });

      // 如果列表長度改變 (新增/刪除)，或者內容改變
      if (hasChanges || newCandidateList.length !== this.candidates.length) {
        console.log(`[VoteService] Data updated. Candidates: ${newCandidateList.length}`);
        this.candidates = newCandidateList;
        this.notifyListeners();
      } else if (this.candidates.length === 0 && newCandidateList.length === 0) {
         // 如果本來就是空的，遠端也是空的，不需要 notify，但可能需要告知已連線
         console.log(`[VoteService] Remote is empty.`);
      }

    } catch (error) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors <= 3) console.warn("[VoteService] Polling error:", error);
    }
  }

  // --- STATE MANAGEMENT ---

  subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    callback();
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach(l => l());
  }

  clearMyHistory() {
    localStorage.removeItem(STORAGE_KEY_HAS_VOTED);
    this.notifyListeners();
  }
}

export const voteService = new VoteService();
