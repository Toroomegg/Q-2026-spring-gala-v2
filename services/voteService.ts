
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
    private maxConcurrent = 10; // 壓力測試時更高的併發
    private activeRequests = 0;

    add(task: () => Promise<void>) {
        this.queue.push(task);
        this.process();
    }

    private async process() {
        if (this.queue.length === 0 || this.activeRequests >= this.maxConcurrent) return;

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
}

const STORAGE_KEY_HAS_VOTED = 'spring_gala_has_voted_v2';
const SETTING_ROW_ID = 'SETTING_MODE'; 
const STATUS_ROW_ID = 'VOTING_STATUS';

class VoteService {
  private listeners: Array<() => void> = [];
  private candidates: Candidate[] = [];
  private pollingIntervalId: any = null;
  private pollingSubscriberCount = 0; 
  private consecutiveErrors = 0; 
  private requestQueue = new RequestQueue();
  
  public isGlobalTestMode = false;
  public isVotingOpen = true; 
  public isRunningStressTest = false;
  
  private hasSettingRow = false; 
  private hasStatusRow = false;

  constructor() {}

  getCandidates(): Candidate[] { return this.candidates; }
  hasVoted(): boolean { return !!localStorage.getItem(STORAGE_KEY_HAS_VOTED); }

  private async sendConfigToSheet(action: 'ADD' | 'UPDATE' | 'DELETE' | 'RESET_SCORES', payload: any) {
    try {
        await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ action: action, payload: payload })
        });
        setTimeout(() => this.fetchLatestData(), 1200);
    } catch (e) {
        console.error("Config Sync Failed:", e);
    }
  }

  async addCandidate(c: any) { await this.sendConfigToSheet('ADD', c); }
  async deleteCandidate(id: string) { await this.sendConfigToSheet('DELETE', { id }); }
  async resetAllRemoteVotes() { await this.sendConfigToSheet('RESET_SCORES', {}); }

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

  getFormUrl(): string { return CONFIG.GOOGLE_FORM_ACTION_URL.replace('formResponse', 'viewform'); }

  async submitVoteBatch(votes: { [key in VoteCategory]: string }, isStressTest = false): Promise<{ success: boolean; message?: string }> {
    // 修正：當通道關閉時，嚴格禁止投票，不論是否為測試模式
    if (!isStressTest && !this.isVotingOpen) {
         return { success: false, message: "投票通道已關閉，請等候大螢幕指令。" };
    }

    // 檢查是否已投票 (測試模式除外)
    if (!isStressTest && !this.isGlobalTestMode && this.hasVoted()) {
      return { success: false, message: "您已經參與過投票囉！" };
    }

    const categories = [VoteCategory.SINGING, VoteCategory.POPULARITY, VoteCategory.COSTUME];
    const promises = categories.map(cat => {
        const candidateId = votes[cat];
        return new Promise<void>((resolve) => {
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
                } catch (e) {}
                resolve();
            });
        });
    });

    await Promise.all(promises);
    
    // 儲存投票紀錄 (測試模式除外)
    if (!this.isGlobalTestMode && !isStressTest) {
        localStorage.setItem(STORAGE_KEY_HAS_VOTED, 'true');
        this.notifyListeners();
    }
    return { success: true };
  }

  async runStressTest(totalUsers: number, onProgress: (count: number, log: string) => void) {
      if (this.isRunningStressTest) return;
      this.isRunningStressTest = true;
      this.notifyListeners(); // 立即通知 UI 彈出進度視窗

      let usersProcessed = 0;
      for (let i = 0; i < totalUsers; i++) {
          if (!this.isRunningStressTest) break;
          
          const cA = this.candidates[Math.floor(Math.random() * this.candidates.length)];
          const cB = this.candidates[Math.floor(Math.random() * this.candidates.length)];
          const cC = this.candidates[Math.floor(Math.random() * this.candidates.length)];
          
          if (!cA) {
              this.isRunningStressTest = false;
              this.notifyListeners();
              break;
          }

          const votes = { [VoteCategory.SINGING]: cA.id, [VoteCategory.POPULARITY]: cB.id, [VoteCategory.COSTUME]: cC.id };
          
          // 提交背景任務
          this.submitVoteBatch(votes, true).finally(() => {
              usersProcessed++;
              onProgress(usersProcessed, `模擬用戶 #${usersProcessed} 投票任務已發送`);
              
              // 當最後一個任務完成，才真正關閉測試狀態
              if (usersProcessed >= totalUsers) {
                  this.isRunningStressTest = false;
                  this.notifyListeners();
              }
          });

          // 稍微錯開背景任務的初始化時間，避免瞬間卡死瀏覽器執行緒
          if (i % 20 === 0) await new Promise(r => setTimeout(r, 20));
      }
      
      // 這裡不能設為 false，必須等 finally 裡面的進度追蹤
  }

  stopStressTest() { 
      this.isRunningStressTest = false; 
      this.notifyListeners();
  }

  startPolling() {
    this.pollingSubscriberCount++;
    if (this.pollingIntervalId) return; 
    this.fetchLatestData(); 
    this.pollingIntervalId = setInterval(() => this.fetchLatestData(), CONFIG.POLLING_INTERVAL);
  }

  stopPolling() {
    this.pollingSubscriberCount--;
    if (this.pollingSubscriberCount <= 0) {
      this.pollingSubscriberCount = 0; 
      if (this.pollingIntervalId) { clearInterval(this.pollingIntervalId); this.pollingIntervalId = null; }
    }
  }

  async testConnection(): Promise<{ok: boolean, message: string}> {
      try {
          const res = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?t=${Date.now()}`);
          return res.ok ? { ok: true, message: `連線正常！後台 API 響應 OK。` } : { ok: false, message: `伺服器代碼: ${res.status}` };
      } catch (e: any) { return { ok: false, message: `連線失敗: ${e.message}` }; }
  }

  public async fetchLatestData() {
    try {
      const res = await fetch(`${CONFIG.GOOGLE_SCRIPT_URL}?t=${Date.now()}`);
      if (!res.ok) return;
      const data = await res.json();
      const remoteScores = data.s || {};
      const remoteConfig = data.c || [];

      let settingRowFound = false;
      let statusRowFound = false;
      let newGlobalTestMode = this.isGlobalTestMode; 
      let newVotingOpen = this.isVotingOpen;

      const validRemoteCandidates: any[] = [];
      if (Array.isArray(remoteConfig)) {
          remoteConfig.forEach((rc: any) => {
              const id = String(rc.id || '').trim();
              if (!id) return;
              const name = String(rc.name || '').trim(); // 確保 Trim

              if (id === SETTING_ROW_ID) {
                  settingRowFound = true;
                  newGlobalTestMode = (name === 'TEST');
              } else if (id === STATUS_ROW_ID) {
                  statusRowFound = true;
                  newVotingOpen = (name !== 'CLOSED'); 
              } else {
                  validRemoteCandidates.push({ ...rc, id }); 
              }
          });
      }

      this.hasSettingRow = settingRowFound;
      this.hasStatusRow = statusRowFound;
      
      let changed = false;
      if (this.isGlobalTestMode !== newGlobalTestMode) { this.isGlobalTestMode = newGlobalTestMode; changed = true; }
      if (this.isVotingOpen !== newVotingOpen) { this.isVotingOpen = newVotingOpen; changed = true; }

      const newList = validRemoteCandidates.map((src: any, index: number) => {
          const stats = remoteScores[src.id] || {};
          const existing = this.candidates.find(c => c.id === src.id);
          const rawTotal = stats.total !== undefined ? stats.total : (stats.t || 0);
          const s = stats.s !== undefined ? stats.s : rawTotal;
          const p = stats.p !== undefined ? stats.p : 0;
          const c = stats.c !== undefined ? stats.c : 0;
          
          if (existing && (existing.scoreSinging !== s || existing.scorePopularity !== p || existing.scoreCostume !== c)) {
              changed = true;
          }
          
          return {
              id: src.id,
              name: src.name || 'Unknown',
              song: src.song || '',
              image: src.image || '',
              videoLink: src.videoLink || '',
              totalScore: rawTotal,
              scoreSinging: s,
              scorePopularity: p,
              scoreCostume: c,
              voteCount: stats.count || 0,
              color: existing?.color || COLORS[index % COLORS.length]
          };
      });

      if (changed || newList.length !== this.candidates.length) {
        this.candidates = newList;
        this.notifyListeners();
      }
    } catch (e) {}
  }

  subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    callback();
    return () => { this.listeners = this.listeners.filter(l => l !== callback); };
  }

  private notifyListeners() { this.listeners.forEach(l => l()); }
  clearMyHistory() { localStorage.removeItem(STORAGE_KEY_HAS_VOTED); this.notifyListeners(); }
}

export const voteService = new VoteService();
