const { chromium } = require('/root/.nvm/versions/node/v22.13.1/lib/node_modules/playwright');
(async () => {
  const base = 'http://localhost:8000/index.html';
  const browser = await chromium.launch({ args:['--no-sandbox'] });
  const page = await browser.newPage();
  const errs=[];
  page.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
  page.on('pageerror',e=>errs.push('PE:'+e.message));
  await page.goto(base);
  await page.goto('about:blank'); await page.goto(base+'#/lang/法文');
  await page.waitForSelector('#drawer.open',{timeout:8000});
  console.log('drawer OK, errs:',errs.length);
  await page.goto('about:blank'); await page.goto(base);
  await page.waitForSelector('#quizFab');await page.click('#quizFab');
  await page.waitForSelector('.quiz-sub');await page.click('[data-act="start"]');
  for(let i=0;i<8;i++){await page.waitForSelector('.quiz-opt');const o=await page.$$('.quiz-opt');o[0].click();await page.waitForTimeout(100);}
  try{await page.waitForSelector('.quiz-result-name',{timeout:5000});}catch(e){}
  console.log('quiz OK, total errs:',errs.length, JSON.stringify(errs.slice(0,5)));
  await browser.close();
})();
