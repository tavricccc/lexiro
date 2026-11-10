import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { capture } from './preview/shot.mjs';
const base=process.env.APP_URL??'http://127.0.0.1:5173';
const frame=process.env.PREVIEW_URL??'http://localhost:4174/design/preview/frame.html';
const word='word-'+createHash('sha256').update(JSON.stringify({setId:'gsat',word:'resilient'})).digest('hex').slice(0,32);
const cases=[];
const add=(name,route,actions=[])=>cases.push({name,route,actions});
add('home','/app'); add('library','/app/library'); add('set','/app/sets/gsat'); add('set-questions','/app/sets/gsat?tab=questions'); add('set-tools','/app/sets/gsat?tab=tools');
add('word',`/app/sets/gsat/words/${word}`); add('word-edit',`/app/sets/gsat/words/${word}/edit`);
add('new-set','/app/sets/new'); add('set-settings','/app/sets/gsat/settings'); add('set-add','/app/sets/gsat/add');
add('shared','/app/shared/demo-share'); add('question-edit','/app/questions/vocab-1/edit'); add('reading-edit','/app/questions/reading/reading-1/edit');
for(const kind of ['meaning','vocabulary','cloze','wordBank','discourse','reading','reverse']){
 for(const answer of ['before','right','wrong']) add(`practice-${kind}-${answer}`,`/app/practice?run=1&tasks=${kind}&set=gsat&amount=10${answer==='before'?'':`&answer=${answer}`}`);
}
add('question-try','/app/sets/gsat/questions/vocab-1'); add('reading-try','/app/sets/gsat/questions/reading-1');
add('practice-setup','/app?sheet=setup'); add('practice-setup-route','/app/practice');
add('result','/app/practice?run=1&tasks=meaning&amount=10&result=1'); add('progress','/app/progress'); add('rooms','/app/rooms'); add('room-setup','/app/rooms/new');
add('room-lobby','/app/rooms/K7M2QX'); add('room-game','/app/rooms/K7M2QX?state=game');
add('room-right','/app/rooms/K7M2QX?state=game',[{css:'.opt',index:1},{name:'確認答案'}]);
add('room-wrong','/app/rooms/K7M2QX?state=game',[{css:'.opt',index:0},{name:'確認答案'}]);
add('room-finished','/app/rooms/K7M2QX?state=finished');
for(const group of ['account','study','look','agent','data','about','admin']) add(`settings-${group}`,`/app/me?nav=${group}`,[{css:".group[data-on]",scroll:true}]);
add('sync','/app/sync'); add('me-preferences','/app/me/preferences'); add('me-data','/app/me/data'); add('agents','/app/me/agents'); add('admin','/app/me/admin');
add('agent-authorize','/agent/authorize?request=demo'); add('app-auth',`/app-auth?challenge=${'a'.repeat(43)}&redirect=lexiroapp%3A%2F%2Fauth`);
add('offline','/~offline'); add('not-found','/does-not-exist'); add('app-not-found','/app/does-not-exist');
add('empty-home','/app?empty=1'); add('empty-library','/app/library?empty=1'); add('empty-progress','/app/progress?empty=1'); add('search-empty','/app/library?q=does-not-exist');
add('menu-add','/app/library',[{name:'新增'}]);
add('menu-set','/app/sets/gsat',[{name:'更多動作'}]);
add('menu-set-context','/app/library',[{css:'.set-card-host .tile',button:'right'}]);
add('folder-create','/app/library',[{name:'新增'},{role:'menuitem',name:'新增資料夾'}]);
add('folder-menu','/app/library?folderId=gsat-folder',[{name:'更多動作'}]);
add('set-move','/app/sets/gsat',[{name:'更多動作'},{role:'menuitem',name:'移動單字集'}]);
add('set-share','/app/sets/gsat',[{name:'更多動作'},{role:'menuitem',name:'分享連結'}]);
add('confirm-delete-set','/app/sets/gsat',[{name:'更多動作'},{role:'menuitem',name:'刪除'}]);
add('confirm-delete-account','/app/me',[{name:'刪除帳號'}]);
add('confirm-end-room','/app/rooms/K7M2QX',[{name:'結束對戰'}]);
add('set-picker-colour','/app/sets/gsat/settings',[{name:'violet'},{name:'airplane-tilt'},{css:'.palette',index:0,scroll:true}]);
add('resume-practice','/app/practice?run=1&tasks=meaning&set=gsat',[{css:'.opt',index:0},{name:'確認答案'},{goto:base+'/app/practice?demo=1'}]);
add('home-continue','/app/practice?run=1&tasks=meaning&set=gsat',[{css:'.opt',index:0},{name:'確認答案'},{goto:base+'/app?demo=1'}]);
add('reading-article','/app/practice?run=1&tasks=cloze&set=gsat',[{role:'tab',name:'文章',phoneOnly:true}]);
add('reading-questions-editor','/app/questions/reading/reading-1/edit',[{role:'tab',name:'題目與答案',phoneOnly:true}]);
add('confirm-clear-questions','/app/sets/gsat?tab=questions',[{name:'清空本集全部題目'}]);
add('confirm-delete-folder','/app/library?folderId=gsat-folder',[{name:'更多動作'},{role:'menuitem',name:'刪除資料夾'}]);
add('folder-rename','/app/library?folderId=gsat-folder',[{name:'更多動作'},{role:'menuitem',name:'重新命名資料夾'}]);
add('folder-move','/app/library?folderId=gsat-folder',[{name:'更多動作'},{role:'menuitem',name:'移動資料夾'}]);
add('set-folder-picker','/app/sets/gsat/settings',[{role:'combobox',name:'資料夾'}]);
add('practice-scope-picker','/app/practice',[{role:'button',name:'學測核心 7000'}]);
add('empty-set','/app/sets/gsat?emptySet=1');
add('empty-practice','/app/practice?empty=1');
add('question-preview','/app/questions/vocab-1/edit',[{role:'tab',name:'預覽',phoneOnly:true}]);
add('reading-preview','/app/questions/reading/reading-1/edit',[{role:'tab',name:'文章預覽'}]);
add('confirm-admin-disable','/app/me/admin',[{name:'停用',index:0}]);
add('backup-import-confirm','/app/me/data',[{name:'匯出完整備份',download:'design/shots/app/backup.zip'},{css:'input[type=file]',file:'design/shots/app/backup.zip'}]);
add('install-guide','/app?install=ios-install');
add('install-dismissed','/app?install=ios-install',[{name:'稍後再說'}]);
add('confirm-sign-in','/app/me',[{name:'登出'},{name:'登入'}]);
add('new-set-bottom','/app/sets/new',[{css:'.savebar',scroll:true}]);
add('question-edit-bottom','/app/questions/vocab-1/edit',[{css:'.savebar',scroll:true}]);
add('reading-edit-bottom','/app/questions/reading/reading-1/edit',[{css:'.savebar',scroll:true}]);
add('word-edit-bottom',`/app/sets/gsat/words/${word}/edit`,[{css:'.savebar',scroll:true}]);
add('progress-reverse','/app/practice?run=1&tasks=reverse&answer=right',[{goto:base+'/app/progress?demo=1'}]);
add('progress-bottom','/app/progress',[{css:'.sheet-list',scroll:true}]);
add('settings-admin-bottom','/app/me/admin',[{css:'.group[data-on] .rule-card',index:-1,scroll:true}]);
for(const kind of ['cloze','wordBank','discourse']) add(`${kind}-edit`,`/app/questions/reading/${kind}-1/edit`);
for(const kind of ['wordBank','discourse']) add(`${kind}-options`,`/app/questions/reading/${kind}-1/edit`,[{role:'tab',name:'題目與答案',phoneOnly:true},{role:'tab',name:'共用選項'}]);
add('reading-metadata','/app/questions/reading/reading-1/edit');
add('unreadable-draft-fresh','/app/practice?brokenDraft=1');
add('dark-result','/app/practice?run=1&tasks=meaning&result=1&scheme=dark');
add('dark-room','/app/rooms/K7M2QX?scheme=dark');
add('dark-settings','/app/me?nav=look&scheme=dark');
for(const route of ['/app','/app/library','/app/sets/gsat',`/app/sets/gsat/words/${word}`,'/app/progress','/app/rooms','/app/practice?run=1&tasks=meaning&answer=wrong']) add('dark-'+(route==='/app'?'home':route.includes('/words/')?'word':route.includes('/sets/')?'set':route.split('/').at(-1).split('?')[0]),route+(route.includes('?')?'&':'?')+'scheme=dark');
const wanted=process.argv.slice(2); const selected=wanted.length?cases.filter(c=>wanted.includes(c.name)):cases;
mkdirSync('design/shots/app',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=wanted.length && existsSync("design/shots/app/audit.json") ? JSON.parse(readFileSync("design/shots/app/audit.json","utf8")).filter(r=>!wanted.includes(r.name)) : [];
try{
 const runItem=async(item)=>{
  for(const [tag,width,height] of [['d',1440,1000],['m',500,844]]){
   const route=new URL(item.route,base);route.searchParams.set('demo','1');
   const target=tag==='m'?`${frame}?w=390&h=844&src=${encodeURIComponent(route.href)}`:route.href;
   const out=`design/shots/app/${item.name}-${tag}.png`;
   try {const result=await capture({url:target,out,width,height,actions:item.actions.map(a=>({...a,...(a.download?{download:a.download.replace("backup.zip",`backup-${tag}.zip`)}:{}),...(a.file?{file:a.file.replace("backup.zip",`backup-${tag}.zip`)}:{})})),browser});results.push({...item,tag,file:out,status:'captured',...result});console.log('OK',out);}
   catch(error){results.push({...item,tag,file:out,status:'failed',error:String(error)});console.error('FAIL',item.name,tag,String(error).slice(0,250));}
  }
  writeFileSync('design/shots/app/audit.json',JSON.stringify(results,null,2));
 };
 for(let i=0;i<selected.length;i+=3) await Promise.all(selected.slice(i,i+3).map(runItem));
}finally{await browser.close();}
writeFileSync('design/shots/app/manifest.json',JSON.stringify(cases.map(c=>({name:c.name,route:c.route,actions:c.actions,files:[`${c.name}-d.png`,`${c.name}-m.png`]})),null,2));
console.log(`${results.filter(r=>r.status==='captured').length}/${results.length} captures`);
if(results.some(r=>r.status==='failed'))process.exitCode=1;
