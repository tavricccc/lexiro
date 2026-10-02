// 欄位由 build 的 TypeScript AST 提取，此處只維護身份／生命週期解說。
export const modelSpecs=[
  ['VocabFolder','src/types/library.ts','id／parentId','資料夾樹與排序，集合以 folderId 指向它。','stores/library-store.ts',['LibrarySet']],
  ['LibrarySet','src/types/library.ts','id','集合資訊與資料夾位置；不複製共用單字。','stores/library-store.ts',['VocabFolder','SetMembership']],
  ['SetMembership','src/types/library.ts','setId 下的 wordKey／senseIds','收錄哪些詞義，詞義在其他集仍共享。','stores/library-store.ts',['WordEntry','WordSense','LibrarySet']],
  ['WordEntry','src/types/library.ts','WordKey','正規化單字與所有詞義，編輯影響共用收錄。','src/lib/word-edit.ts',['WordSense']],
  ['WordSense','src/types/library.ts','SenseId','詞性／中文／例句及 supplementary 來源，FSRS／題目共享身份。','src/lib/library.ts',['CardProgress','MultipleChoiceQuestion']],
  ['MultipleChoiceQuestion','src/types/library.ts','id／fingerprint','單句四選項與目標詞義；繼承 question base。','src/lib/question-assembly.ts',['WordSense']],
  ['ReadingPack','src/types/library.ts','id／fingerprint','文章與子題、format、共享 option bank。','src/lib/question-assembly.ts',['WordSense']],
  ['LibraryState','src/types/library.ts','namespace','記憶體中組裝好的教材；repository 拆成 records 保存。','stores/library-store.ts',['LibraryManifest','WordEntry','LibrarySet']],
  ['LibraryManifest','src/lib/library-repository.ts','generation／sequence','每代 record 身份對應內容 hash，sequence 決定 commit 順序。','src/lib/library-repository.ts',['LibraryHead']],
  ['LibraryHead','src/lib/library-repository.ts','namespace head','最後發布 head 才讓新代可見；previousGeneration 可恢復。','src/lib/library-repository.ts',['LibraryManifest']],
  ['CardProgress','src/types/learning.ts','SenseId','FSRS due／stability／lapses 等，保存後下次選題採用。','src/lib/fsrs.ts',['WordSense']],
  ['LearningProgress','src/types/learning.ts','namespace + SenseId','每詞義複習卡，由本機保存及雲端按卡合併。','stores/learning-store.ts',['CardProgress']],
  ['DashboardStats','src/types/learning.ts','namespace','每日目標、題型統計、streak；history 保留90天。','src/lib/learning-defaults.ts',['WordSense']],
  ['PracticeSessionSnapshot','src/types/session.ts','namespace localStorage','v4 保存題序、答案與原詞義選項，v3 card 草稿遷移。','components/practice/use-practice-persistence.ts',['WordSense']],
  ['SyncJournal','src/lib/sync-journal.ts','namespace／local version','dirty／tombstone／blobs 與 cursor；只清本次送出版本。','src/lib/cloud-sync.ts',['LibraryState','LearningProgress','AiPreferences']],
  ['AiPreferences','src/lib/ai-preferences.ts','namespace／updatedAt','v1 模型偏好，在 owner-only preferences/ai 同步。','src/lib/cloud-preferences.ts',['SyncJournal']],
  ['AdminAccount','packages/ai-contract/src/index.ts','Firebase UID／version','D1 帳號公開投影；資金與備註改動要 expected 閱讀版本。','components/me/admin-accounts.tsx',[]],
  ['AdminSettingsValue','packages/ai-contract/src/index.ts','version','新帳號預設與試用，三欄一起核對版本／修改。','components/me/admin-settings.tsx',[]],
  ['AdminUsageEntry','packages/ai-contract/src/index.ts','usage id／uid','實扣、應收、nullable 成本與 pending/unavailable，不能把未知當零。','components/me/admin-usage.tsx',['AdminAccount']],
];

export function makeModelFlows(models,ref) {
  return models.map(m=>({id:'model:'+m.name,title:m.name,group:'資料模型',section:m.origin==='d1'?'Worker D1':'Canonical 與持久化',summary:m.lifecycle,notes:[m.origin==='d1'?'欄位來自 private migrations 在記憶體 SQLite 重建後的 schema；不內嵌 SQL 或 Worker 原碼。':'欄位從目前 TypeScript 定義提取；關係為程式身份參照。'],nodes:[
    {title:m.name+' 的欄位',text:m.lifecycle,layer:'database',model:m.name,pathStart:true,pathTitle:m.name+'：身份到使用',refs:[ref(m.path,m.origin==='d1'?undefined:m.name)]},
    {title:'身份鍵與共用資料',text:'身份鍵：'+m.key+'。'+(m.related.length?'程式關聯：'+m.related.join('、')+'。':'此公開形狀的遠端儲存由 private Worker 管理。'),layer:'database',refs:[ref(m.path,m.origin==='d1'?undefined:m.name)]},
    {title:'讀寫與生命週期',text:m.lifecycle+' 完整使用方式可從下列模組追到保存與畫面。',layer:'browser',refs:[ref(m.usage)]},
  ],edges:[{from:0,to:1,label:'穩定身份與欄位參照'},{from:1,to:2,label:'讀寫對應資料'}]}));
}

export const billingModelSpecs={
  accounts:['uid','Firebase 帳號、餘額／月額度、續期、inflight 預留與閱讀 version。',['D1.charges','D1.usage_log']],
  settings:['key','免費試用與新帳號初值，管理 expected version 原子修改。',[]],
  charges:['id／attempt_id','每來源預留／扣款身份，成功重試與新 session 分開。',['D1.accounts']],
  usage_log:['id／uid','每次 provider 成本、實扣、應收與結束狀態；未知 credit 為 null。',['D1.accounts','D1.pending_usage']],
  cursors:['response_id／uid','Provider response cursor 所有權與建立時間，其他帳號不能沿用。',['D1.accounts']],
  attempt_limits:['id／expires_at','來源嘗試限制有30分鐘窗，切換 session 不重設次數。',[]],
  pending_usage:['attempt_id','待核對 response／來源計費 metadata，永不保存 prompt／圖片／生成內容。',['D1.usage_log']],
};
