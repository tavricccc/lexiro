// Headless Edge capture, shared by mock and real-app screenshot suites.
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
export async function capture({url,out,width=1440,height=1000,actions=[],browser:shared}) {
  const browser = shared ?? await chromium.launch({executablePath:edge,headless:true});
  const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page = await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.goto(url,{waitUntil:'networkidle'});
    const framed = new URL(url).pathname.endsWith('/frame.html');
    const root = framed ? page.frames().find(f=>f!==page.mainFrame()) : page;
    if(!root) throw Error('Phone frame did not load');
    await root.waitForFunction(()=>document.body.innerText.trim().length>0,{},{timeout:20000});
    await root.evaluate(()=>document.fonts.ready);
    for(const action of actions) {
      const locator = action.css ? root.locator(action.css) : root.getByRole(action.role ?? 'button',{name:action.name,exact:action.exact ?? true});
      const target = action.index === undefined ? locator.first() : locator.nth(action.index);
      if(action.fill !== undefined) await target.fill(action.fill);
      else if(action.select !== undefined) await target.selectOption(action.select);
      else if(action.scroll) await target.scrollIntoViewIfNeeded();
      else await target.click({button:action.button ?? 'left'});
    }
    // Wait for the route's lazy chunks, IndexedDB and fonts, not a virtual clock.
    await page.waitForLoadState('networkidle');
    await root.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(300);
    if(errors.length) throw Error(errors.join('\n'));
    mkdirSync(dirname(resolve(out)),{recursive:true});
    if(framed) await page.locator('iframe').screenshot({path:resolve(out)});
    else await page.screenshot({path:resolve(out)});
    const audit = await root.evaluate(()=>({text:document.body.innerText,overflow:[...document.querySelectorAll('input,button,h1,h2,.w,.tile')].filter(e=>{const b=e.getBoundingClientRect();return b.width && (b.right>innerWidth+2||b.left < -2) && getComputedStyle(e).position!=='fixed' && !e.closest('.scroller') && !e.closest('[hidden]')}).map(e=>e.textContent?.trim().slice(0,60))}));
    return {url,out,...audit};
  } finally {await context.close();if(!shared) await browser.close();}
}
if(import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [url,out,width='1440',height='1000']=process.argv.slice(2);
 if(!edge||!url||!out) throw Error('usage: shot.mjs <url> <out.png> [width] [height]');
 await capture({url,out,width:Number(width),height:Number(height),actions:JSON.parse(process.env.SHOT_ACTIONS??'[]')});
}
