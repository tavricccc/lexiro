export const settingSpecs=[
  ['dailyWordGoal','每日單字目標','src/constants/learning.ts','DAILY_WORD_GOAL_OPTIONS','learning stats','初值取 options 第一個；目前介面與草稿接受1-100整數，只改實際編輯欄位。','立即本機保存，登入後同步。'],
  ['dailyQuestionGoal','每日題目目標','src/constants/learning.ts','DAILY_QUESTION_GOAL_OPTIONS','learning stats','題目每日目標，不重設已完成統計。','立即本機保存，登入後同步。'],
  ['model','AI 模型偏好','packages/ai-contract/src/index.ts','AI_MODELS','preferences/ai v1','AI session 開始時固定模型；已執行工作不變。','下一個新 session。'],
  ['theme','外觀模式','components/me/preferences-section.tsx','THEMES','next-themes 本機偏好','跟隨系統、亮色或暗色，外觀選擇不跟帳號資料同步。','立即套用。'],
  ['defaultModel','預設 AI 模型','packages/ai-contract/src/index.ts','DEFAULT_AI_MODEL','程式初值','沒有偏好時採用程式預設；不是供應商失敗的替代模型。','初始化偏好時。'],
  ['tiers','生成檔位','packages/ai-contract/src/index.ts','TIERS','AI session','Lite／Thinking／Pro；倍率用於估算，實扣依 usage。','開始新生成。'],
  ['tierMultipliers','檔位估算倍率','packages/ai-contract/src/index.ts','MULTIPLIER','公開契約','只影響估算，不把倍率重複套實扣。','新估算與 session。'],
  ['longContext','長上下文門檻','packages/ai-contract/src/index.ts','LONG_CONTEXT_INPUT_THRESHOLD','公開價格契約','每個 response 分別判斷，不能用月總 input 套門檻。','該 response 結算。'],
  ['cloudPage','雲端讀取批次','src/constants/cloud.ts','CLOUD_RECORD_PAGE_SIZE','程式常數','Cursor 使用 writtenAt + documentId，避免同時間跨頁漏資料。','下一次同步讀取。'],
  ['cloudBatch','雲端寫入批次','src/constants/cloud.ts','CLOUD_WRITE_BATCH_SIZE','程式常數','每批送 changed records，完成只清已送 journal version。','下一次 push。'],
  ['cloudSize','學習文件上限','src/constants/cloud.ts','MAX_CLOUD_DOCUMENT_BYTES','程式常數','上傳前檢查 learning／stats blob，不假稱無限容量。','每次上傳前。'],
  ['history','每日歷史保留','src/lib/learning-defaults.ts','DAILY_HISTORY_RETENTION_DAYS','程式常數','裁去圖表不用的舊活動。','讀／寫 stats 時。'],
  ['mastered','掌握的 stability','src/constants/learning.ts','MASTERED_STABILITY_DAYS','程式常數','以 FSRS stability 判掌握，不用點按總數。','進度計算。'],
  ['freezeEarn','取得 streak freeze','src/constants/learning.ts','STREAK_FREEZE_EARNED_EVERY_DAYS','程式常數','連續學習達週期可取得一次。','日期統計滾動。'],
  ['freezeMax','Streak freeze 上限','src/constants/learning.ts','MAX_STREAK_FREEZES','程式常數','限制可保存的缺日保護次數。','日期統計滾動。'],
  ['syncDebounce','同步合併等待','stores/cloud-store.ts','SYNC_DEBOUNCE_MS','分頁 runtime','合併短時間修改，pagehide／visibility 可 flush。','下一次 pending event。'],
  ['syncMaxDelay','同步最長等待','stores/cloud-store.ts','SYNC_MAX_DELAY_MS','分頁 runtime','持續編輯不會讓 pending 無限等待。','下一次 pending event。'],
  ['syncRetries','同步自動重試次數','stores/cloud-store.ts','MAX_RETRY_ATTEMPTS','分頁 runtime','失敗仍保留 journal，手動同步可重試。','同步失敗。'],
  ['syncTimeout','同步單次逾時','src/lib/cloud-sync.ts','CLOUD_REQUEST_TIMEOUT_MS','分頁 runtime','慢請求回明確錯誤，未完成變更保留。','每次 cloud request。'],
];

export function settingFlow(setting,ref) {
  return {id:'setting:'+setting.key,title:setting.title,group:'設定與政策',section:setting.section,setting:setting.key,summary:setting.effect,notes:[setting.timing],nodes:[
    {title:setting.title,text:'來源：'+setting.path+' 的 '+setting.constant+'。'+(setting.initial===undefined?'':'程式初值：'+String(setting.initial)+'。'),layer:'browser',pathStart:true,pathTitle:'來源、資料與生效時機',refs:[ref(setting.path,setting.constant)]},
    {title:'保存／配置範圍',text:setting.store+'。'+setting.effect,layer:'database',refs:[ref(setting.path,setting.constant)]},
    {title:'何時採用新值',text:setting.timing+' 畫面／同步和 session 依各自生命週期採用，不推斷正式部署值。',layer:'browser',refs:[ref(setting.path,setting.constant)]},
  ],edges:[{from:0,to:1,label:'設定與適用範圍'},{from:1,to:2,label:'下次讀取或操作'}]};
}
