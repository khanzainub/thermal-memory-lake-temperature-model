const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const server=require('node:child_process').spawn('python',['-m','http.server','8765','--bind','127.0.0.1'],{cwd:require('node:path').resolve(__dirname,'../..'),stdio:'ignore'});process.on('exit',()=>server.kill());await new Promise(r=>setTimeout(r,500));
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true});const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message);});page.setDefaultTimeout(10000);
 await page.goto('http://127.0.0.1:8765/insitu-test/');
 await page.selectOption('#expLake','Naini');
 // Explicitly synthetic fixture, used only during test execution.
 const csv=['date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c'];
 for(let i=0;i<60;i++){const date=new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),air=15+5*Math.sin(i/7),sw=200+60*Math.cos(i/8),wind=2+Math.sin(i/4);csv.push([date,air,sw,wind,i%2===0?2+.8*air+.01*sw-.3*wind:''].join(','));}
 await page.setInputFiles('#expSatellite',{name:'synthetic-test-only.csv',mimeType:'text/csv',buffer:Buffer.from(csv.join('\n'))});
 console.log('Upload:',await page.locator('#expStatus').innerText());await page.waitForFunction(()=>window.__restExperimentUI.getPreview()!==null);
 await page.fill('#expDate','2025-01-01');await page.fill('#expTemp','18');await page.click('#expAdd');
 assert.equal(await page.locator('#expObs tr').count(),1);assert.ok(await page.locator('#expEnable').isDisabled());
 await page.locator('[data-edit="2025-01-01"]').click();await page.fill('#expTemp','19');await page.click('#expAdd');assert.match(await page.locator('#expObs').innerText(),/19/);
 await page.locator('[data-remove="2025-01-01"]').click();assert.equal(await page.locator('#expObs tr').count(),0);await page.click('#expUndoInput');assert.equal(await page.locator('#expObs tr').count(),1);
 await page.setInputFiles('#expCSV',{name:'in-situ-test.csv',mimeType:'text/csv',buffer:Buffer.from('lake_name,date,insitu_temp_c\nNaini,2025-01-11,20\nNaini,2025-01-21,16\nNaini,2025-02-20,18\n')});
 assert.equal(await page.locator('#expObs tr').count(),4);await page.click('#expSave');await page.check('#expEnable');
 let preview=await page.evaluate(()=>window.__restExperimentUI.getPreview());assert.equal(preview.pairs.filter(p=>p.status==='accepted').length,3);
 await page.locator('#expMatching svg circle[role=button]').first().click();assert.equal((await page.evaluate(()=>window.__restExperimentUI.getPreview())).pairs.filter(p=>p.status==='accepted').length,2);
 await page.click('#expUndoSelection');assert.equal((await page.evaluate(()=>window.__restExperimentUI.getPreview())).pairs.filter(p=>p.status==='accepted').length,3);
 const line=page.locator('#expMatching svg line[role=button]').first();await line.scrollIntoViewIfNeeded();const box=await line.boundingBox();await page.mouse.click(box.x,box.y+box.height/2);await page.click('#expRestoreAll');await page.click('#expResetSelection');
 await page.click('#expRun');await page.waitForFunction(()=>window.__restExperimentUI.getResult()?.output.length===4);assert.equal(await page.locator('#expResults svg').count(),9);
 const metrics=await page.evaluate(()=>window.__restExperimentUI.getResult().output.map(m=>({id:m.id,n:m.validation.n,M:m.fit.M})));assert.equal(metrics[1].M,0);
 const downloads=[];page.on('download',d=>downloads.push(d.suggestedFilename()));await page.click('#expExport');await page.waitForTimeout(100);assert.equal(downloads.length,3);
 await page.locator('#expMatching button').filter({hasText:'Download SVG'}).click();await page.locator('#expMatching button').filter({hasText:'Download 4× PNG'}).click();await page.waitForTimeout(1500);console.log('Downloads',downloads,'Status',await page.locator('#expStatus').innerText());assert.ok(downloads.some(s=>s.endsWith('.png')));
 await page.screenshot({path:'/tmp/rest-desktop.png',fullPage:false});
 await page.reload();await page.selectOption('#expLake','Naini');assert.equal(await page.locator('#expObs tr').count(),4);assert.ok(await page.locator('#expEnable').isChecked());
 await page.selectOption('#expLake','Bhimtal');assert.equal(await page.locator('#expObs tr').count(),0);await page.selectOption('#expLake','Naini');
 await page.setViewportSize({width:390,height:844});await page.locator('#experiment').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/rest-mobile.png'});
 const widths=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));assert.ok(widths.body<=widths.viewport+1,JSON.stringify(widths));
 await page.goto('http://127.0.0.1:8765/base/');await page.click('#loadDemoBtn');await page.waitForFunction(()=>window.__thermalMemoryApp.getState().rows?.length>0);assert.equal(await page.locator('#experiment').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS browser: manual input/edit/remove/undo, CSV import, Save/checkbox, plot point/line exclusion, restore/reset, four-model run, CSV/JSON/SVG/PNG downloads, refresh persistence, lake isolation, mobile overflow, baseline demo.');await browser.close();server.kill();
})().catch(e=>{console.error(e);process.exit(1)});
