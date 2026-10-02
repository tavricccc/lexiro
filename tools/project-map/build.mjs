import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import { DatabaseSync } from 'node:sqlite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { X,Menu,Plus,Minus } from 'lucide-react';
import { flows,groups,routeSpecs } from './content.mjs';
import { modelSpecs,makeModelFlows,billingModelSpecs } from './models.mjs';
import { settingSpecs,settingFlow } from './settings.mjs';
import { constant,interfaceFields } from './schema.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../..');
const workerRoot=path.resolve(process.argv[3]||path.join(root,'../lexiro-worker'));
const output=path.resolve(process.argv[2]||path.join(process.env.USERPROFILE,'Desktop/Lexiro-程式流程地圖.html'));
const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8'}).trim();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const paths=git(root,'ls-files','app','components','lib','stores','src','config','scripts','packages/ai-contract','docs','README.md','package.json','next.config.ts','firestore.rules','firestore.indexes.json','.github/workflows')
  .split('\n').filter(p=>/\.(ts|tsx|mjs|json|css|md|yml|rules)$/.test(p));
const sources=Object.fromEntries(paths.map(p=>{const text=read(p);return [p,{text,sha256:createHash('sha256').update(text).digest('hex')}];}));
const ref=(p,anchor)=>{
  if(!sources[p])throw new Error('原碼未追蹤或不存在：'+p);
  const index=anchor?sources[p].text.indexOf(anchor):0;
  if(index<0)throw new Error('原碼錨點不存在：'+p+' / '+anchor);
  return {path:p,line:sources[p].text.slice(0,index).split('\n').length};
};

const prepared=flows.map(f=>({...f,nodes:f.nodes.map((n,i)=>{
  const {paths:nodePaths,handoff,...node}=n;
  return {...node,...(i===0?{pathStart:true,pathTitle:f.title}:{}),refs:nodePaths.map(p=>ref(p))};
})}));
const models=modelSpecs.map(([name,p,key,lifecycle,usage,related])=>({name,path:p,key,lifecycle,usage,related,columns:interfaceFields(sources[p].text,p,name),foreignKeys:[]}));
const settings=settingSpecs.map(([key,title,p,name,store,effect,timing])=>({key,title,path:p,constant:name,store,effect,timing,initial:constant(sources[p].text,p,name),range:'依目前程式契約',section:['dailyWordGoal','dailyQuestionGoal','model','tiers'].includes(key)?'使用者偏好':'程式政策'}));
for(const s of settings)if(s.key==='dailyWordGoal'||s.key==='dailyQuestionGoal'){s.initial=s.initial[0];s.range='1-100整數';}
for(const [key,title,effect] of [
  ['tasks','練習題型','詞義、拼字與已存題型共用佇列。'],['amount','練習題數','依實際可用題數與所選格式限制，草稿保留選擇。'],['difficulty','練習難度','all 或1／2／3，篩選既有題目。'],['oneSensePerWord','每字一義','預設開啟，詞義題每字最多一次。'],['leechOnly','只練難記項目','依 card lapses 判斷難記項目。'],
])settings.push({key:'practice.'+key,title,path:'components/practice/use-practice-setup-choices.ts',constant:key,store:'namespace 練習草稿',effect,timing:'下一次建立練習佇列；已開始 session 保留原設定。',initial:undefined,range:'依設定頁可用選項',section:'練習設定'});
const limits=constant(sources['packages/ai-contract/src/index.ts'].text,'packages/ai-contract/src/index.ts','LIMITS');
for(const [key,value] of Object.entries(limits))settings.push({key:'LIMITS.'+key,title:'AI 上限：'+key,path:'packages/ai-contract/src/index.ts',constant:'LIMITS',store:'公開 AI 契約',effect:'前後端以相同 LIMITS 限定來源、圖片、輸入或輸出。實際欄位用途見原碼。',timing:'新 request 的輸入檢查／生成配置。',initial:value,range:'程式固定',section:'AI 請求上限'});
const environmentNames=[...read('.env.example').matchAll(/^(NEXT_PUBLIC_[A-Z_]+)=/gm)].map(match=>match[1]);
for(const name of environmentNames)settings.push({key:name,title:name,path:'docs/configuration.md',constant:name,store:'build-time 公開環境設定',effect:'設定責任與必要條件見配置文件。公開值不可放 provider key；地圖不讀實際環境檔。',timing:'重啟 dev 或重新 build／發布才進 browser bundle。',initial:undefined,range:'依配置文件',section:'前端環境'});

const routes=paths.filter(p=>p.startsWith('app/')&&p.endsWith('/page.tsx')).map(p=>({path:p,route:'/'+p.slice(4,-9).split('/').filter(s=>s&&!s.startsWith('(')&&!s.startsWith('@')).join('/'),sheet:false}));
for(const route of routes)if(!routeSpecs[route.route])throw new Error('尚未解說路由：'+route.route);
for(const name of Object.keys(routeSpecs))if(!routes.some(route=>route.route===name))throw new Error('路由已移除：'+name);
const routeFlows=routes.map(route=>{
  const [title,domain,component]=routeSpecs[route.route];
  const sourceRefs=[ref(route.path),ref(component)];
  const remote=['ai','admin','account','sync'].includes(domain);
  const store=domain==='learning'||domain==='practice'?'stores/learning-store.ts':domain==='preferences'?'stores/ai-preferences-store.ts':'stores/library-store.ts';
  return {id:'route:'+route.route,title:route.route,group:'頁面入口',section:domain,summary:title,notes:['此圖是頁面的責任入口；完整操作請從使用者／AI／管理／同步流程閱讀。'],nodes:[
    {title,text:'Next.js page 組裝此任務，相關畫面與原碼在下面。',layer:'browser',pathStart:true,pathTitle:route.route,refs:sourceRefs},
    {title:remote?'身份與線上服務':'Domain 與目前帳號資料',text:remote?'線上功能要求對應帳號／權限。Worker 與 Firestore 有各自邊界，不由 page 直接授權。':'教材／練習與畫面狀態從目前 namespace 的 store 取得。介紹或錯誤頁主要提供示範／重試入口。',layer:'browser',refs:[ref(remote?'docs/routes-and-permissions.md':store)]},
    {title:'資料交接與返回',text:remote?'請求與回應要驗帳號，失敗保留重試；學習／教材保存仍由本機 domain 處理。':'實際修改排入 store queue，保存後反映資料；列表與編輯返回位置由路由 helper 維持。',layer:remote?'external':'database',refs:[ref(remote?'docs/architecture.md':'lib/browse-routes.ts')]},
  ],edges:[{from:0,to:1,label:'頁面任務與權限'},{from:1,to:2,label:'資料與結果交接'}]};
});

// Private repo 只取版本、路由字串、migration 檔名、Cron；從不序列化原碼／prompt／secrets。
const workerCode=fs.readFileSync(path.join(workerRoot,'src/index.ts'),'utf8')+'\n'+fs.readFileSync(path.join(workerRoot,'src/admin.ts'),'utf8');
const workerHead=git(workerRoot,'rev-parse','HEAD');
const migrations=git(workerRoot,'ls-files','migrations').split('\n');
const schema=new DatabaseSync(':memory:');
for(const p of migrations)schema.exec(fs.readFileSync(path.join(workerRoot,p),'utf8'));
for(const {name} of schema.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()){
  const spec=billingModelSpecs[name];
  if(!spec)throw new Error('尚未解說 D1 表：'+name);
  const [key,lifecycle,related]=spec;
  models.push({name:'D1.'+name,origin:'d1',key,lifecycle,related,path:'docs/ai-api.md',usage:'docs/ai-api.md',columns:schema.prepare('SELECT name,type FROM pragma_table_info(?)').all(name),foreignKeys:schema.prepare('SELECT "table","from","to",on_delete FROM pragma_foreign_key_list(?)').all(name).map(f=>({label:f.from+' → '+f.table+'.'+f.to,delete:f.on_delete}))});
}
for(const {key,value} of schema.prepare('SELECT key,value FROM settings').all()){
  const titles={free_trial:'免費試用',default_initial:'新帳號初始點數',default_monthly:'新帳號每期額度'};
  if(!titles[key])throw new Error('尚未解說 D1 設定：'+key);
  settings.push({key:'D1.'+key,title:titles[key],path:'docs/ai-api.md',constant:'/admin/settings',store:'D1 settings，管理 expected version',effect:'只影響新帳號，不改已存在帳戶的餘額／月額度。',timing:'儲存成功後新建立帳號採用。',initial:key==='free_trial'?value==='true':Number(value),range:key==='free_trial'?'開／關':'0-1000000',section:'管理方案'});
}
schema.close();
const cron=fs.readFileSync(path.join(workerRoot,'wrangler.toml'),'utf8').match(/crons\s*=\s*\["([^"]+)"\]/)[1];
const endpoints=[
  ['/me','GET','帳號／額度／身份'],['/generate','POST','資料來源生成'],['/organize','POST','文字／WebP 圖片批次'],
  ['/admin/accounts','GET','帳號游標列表'],['/admin/accounts/{uid}','GET/PATCH','閱讀／原子調整'],['/admin/usage','GET','30天用量游標報表'],['/admin/settings','GET/PATCH','新帳號方案'],
];
for(const [route] of endpoints)if(!workerCode.includes('"'+route.replace('{uid}','')+'"'))throw new Error('Worker 端點需更新：'+route);
const observed=[...new Set([...workerCode.matchAll(/path(?:\.startsWith\(|\s*===\s*)"(\/[^" ]+)"/g)].map(match=>match[1]))];
for(const route of observed)if(!endpoints.some(([known])=>known.replace('{uid}','')===route)&&route!=='/admin/')throw new Error('尚未解說 Worker 入口：'+route);
const timers=[];
for(const p of paths.filter(p=>/^(src\/lib\/|stores\/|lib\/|components\/)/.test(p)))sources[p].text.split('\n').forEach((text,i)=>{if(/setTimeout|setInterval|_TIMEOUT_MS|_DEBOUNCE_MS|_DELAY_MS|expiresAt|\.due\b/.test(text))timers.push({path:p,line:i+1,text:text.trim()});});
const allFlows=[...prepared,...makeModelFlows(models,ref),...settings.map(s=>settingFlow(s,ref)),...routeFlows];
const ids=new Set();
for(const f of allFlows){
  if(ids.has(f.id))throw new Error('重複流程：'+f.id);ids.add(f.id);
  for(const edge of f.edges)if(edge.to!==edge.from+1||!f.nodes[edge.to]||!edge.label)throw new Error('連線不完整：'+f.id);
  for(const node of f.nodes)for(const r of node.refs)if(r.line<1||r.line>sources[r.path].text.split('\n').length)throw new Error('來源行數無效：'+f.id);
}
const contractVersion=JSON.parse(read('packages/ai-contract/package.json')).version;
const workerContract=JSON.parse(fs.readFileSync(path.join(workerRoot,'package.json'),'utf8')).dependencies['@lexiro/ai-contract'];
if(!workerContract.includes('-'+contractVersion+'.tgz'))throw new Error('前後端 AI contract 不同版');
const data={
  meta:{product:'lexiro',head:git(root,'rev-parse','HEAD'),dirty:Boolean(git(root,'status','--porcelain')),date:new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'medium'}).format(new Date()),scope:'Frontend 原碼快照；Worker 只含核對後的版本／入口／排程 metadata。未查正式部署與帳號資料。',regenerate:'node tools/project-map/build.mjs',stats:allFlows.length+' 個流程、'+models.length+' 個模型、'+settings.length+' 組設定',actionCount:endpoints.length,modelCount:models.length,triggerCount:0},
  layers:{browser:'瀏覽器',worker:'Private Worker',database:'資料保存',async:'自動／背景',external:'外部服務',build:'建置／部署'},
  icons:Object.fromEntries(Object.entries({close:X,menu:Menu,plus:Plus,minus:Minus}).map(([name,component])=>[name,renderToStaticMarkup(createElement(component,{'aria-hidden':true}))])),
  groups,flows:allFlows,models,settings,sources,routes,endpoints,timers,
  inventory:{intro:allFlows.length+' 個流程、'+models.length+' 個資料模型、'+settings.length+' 組設定、'+routes.length+' 個 page 入口。Lexiro 沒有 Novae 的 action registry／PostgreSQL triggers，操作依 store／domain／Worker endpoint 追蹤。',sections:[
    {title:'Private Worker 核對範圍',paragraphs:['Worker 版本：'+workerHead,'共用 AI contract：'+contractVersion,'Cron：'+cron+'，UTC00:00／臺灣08:00','不內嵌 private prompt、Worker 原碼、憑證、provider input 或帳號資料。'],headers:['Migration'],rows:migrations.map(p=>[p])},
    {title:'保存與同步的責任',paragraphs:['Library repository v2、journal v4、Firestore v8、practice v4、AI preference v1、full backup v4、set share v1。','Library 依 server writtenAt 合併，未送 dirty 保留；learning／preference 另有自己的合併規則。','Browser 日程不是 Worker Cron；FSRS／每日學習資料在 App 讀寫時更新。']},
  ]},
};
let html=fs.readFileSync(path.join(here,'template.html'),'utf8').replace('/*__PROJECT_DATA__*/',()=>JSON.stringify(data).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029')).replace('/*__MAP_CSS__*/',()=>fs.readFileSync(path.join(here,'map.css'),'utf8')).replace('/*__MAP_JS__*/',()=>fs.readFileSync(path.join(here,'map.js'),'utf8'));
new Script(html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>')));
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,html);
console.log(JSON.stringify({output,flows:allFlows.length,models:models.length,settings:settings.length,routes:routes.length,endpoints:endpoints.length,sources:paths.length,bytes:Buffer.byteLength(html),head:data.meta.head,workerHead},null,2));
