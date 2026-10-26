const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
const context={document:{getElementById:()=>null},setTimeout,console};vm.createContext(context);
vm.runInContext(app.slice(0,app.indexOf('function reconstruct('))+app.slice(app.indexOf('function validationSplit('),app.indexOf('function renderValidation(')),context);
vm.runInContext(fs.readFileSync(path.join(dir,'experiment-core.js'),'utf8')+';globalThis.E=ReSTExperiment;',context);
const E=context.E;
const t=(date,temp)=>({lake_name:'Test Lake',date,insitu_temp_c:temp});
assert.throws(()=>E.date('2025-02-30'));
assert.throws(()=>E.validate([t('2025-01-01','')],'Test Lake'));
assert.throws(()=>E.validate([t('2025-01-01',280)],'Test Lake'));
assert.throws(()=>E.validate([t('2025-01-01',12)],'Other'));
assert.throws(()=>E.validate([t('2025-01-01',12),t('2025-01-01',13)],'Test Lake'));
assert.throws(()=>E.csv('lake_name,date,insitu_temp_c\n"Bad,2025-01-01,2'));
assert.equal(E.csv('lake_name,date,insitu_temp_c\r\n"Test, Lake",2025-01-01,12')[0].lake_name,'Test, Lake');
const small=['2025-01-01','2025-01-05','2025-01-08'].map(date=>({date:E.date(date),observed_lst_c:10}));
const pairs=E.match(small,[t('2025-01-03',12),t('2025-01-01',11),t('2025-01-05',14),t('2025-01-20',15)],3,'2025-01-06');
assert.equal(pairs[0].tie,true);assert.equal(pairs[0].status,'duplicate satellite match');assert.equal(pairs[1].status,'accepted');assert.equal(pairs[3].status,'withheld validation');
assert.equal(E.match(small,[t('2025-01-07',20)],3,'2025-01-07')[0].status,'cross-boundary match (not used)');
assert.equal(E.match(small,[t('2025-01-03',12)],0,'2025-01-06')[0].status,'unmatched');
assert.equal(E.match(small,[t('2025-01-01',12)],0,'2025-01-06',['2025-01-01'])[0].status,'excluded');
const corrected=E.correct(small,pairs,{enabled:true,method:'matched'});assert.equal(corrected[0].corrected_lst_c,11);assert.equal(corrected[1].corrected_lst_c,14);assert.equal(corrected[2].corrected_lst_c,10);assert.equal(small[0].observed_lst_c,10);
const mean=E.correct(small,pairs,{enabled:true,method:'mean',start:'2025-01-01',end:'2025-01-08'});assert.equal(mean[2].corrected_lst_c,12.5);
assert.equal(E.stats([1,2,3],[1,2,3]).r2,1);assert.equal(E.stats([1,1],[2,2]).r,null);
// Synthetic fixtures ONLY for regression tests, never shipped as lake measurements.
const rows=Array.from({length:60},(_,i)=>{const d=new Date(Date.UTC(2025,0,i+1));const air=15+5*Math.sin(i/7),sw=200+60*Math.cos(i/8),wind=2+Math.sin(i/4);return {date:d,air_temp_c:air,shortwave_w_m2:sw,wind_speed_m_s:wind,observed_lst_c:i%2===0?2+.8*air+.01*sw-.3*wind:null};});
const observations=[t('2025-01-01',18),t('2025-01-11',20),t('2025-01-21',16),t('2025-02-20',18)];
const options={enabled:true,method:'matched',maxDays:2,excluded:[]};
(async()=>{const before=JSON.stringify(rows);const r=await E.run(rows,observations,options);assert.equal(r.output.length,4);assert.equal(r.output[1].fit.M,0);assert.equal(r.output[1].fit.tau,null);assert.equal(r.output[3].fit.M,0);assert.equal(r.output[0].validation.n,9);assert.equal(r.output[0].calibration.n,20);assert.equal(JSON.stringify(rows),before);
 const altered=observations.map(o=>o.date>r.cutoff?{...o,insitu_temp_c:50}:o);const r2=await E.run(rows,altered,options);for(let i=0;i<4;i++){assert.deepEqual(r.output[i].fit,r2.output[i].fit);}
 const alteredSat=rows.map((o,i)=>r.split.testIdx.includes(i)?{...o,observed_lst_c:55}:o);const r3=await E.run(alteredSat,observations,options);for(let i=0;i<4;i++){assert.deepEqual(r.output[i].fit,r3.output[i].fit);}
 const b=r.output[1].fit;assert.equal(b.freeRun[5],b.beta0+b.betaT*rows[5].air_temp_c+b.betaS*rows[5].shortwave_w_m2+b.betaU*rows[5].wind_speed_m_s);
 const disabled=await E.run(rows,[],{...options,enabled:false});assert.ok(disabled.output[2].skipped);assert.ok(disabled.output[3].skipped);
 console.log('PASS: CSV validation, dates, units, lake isolation, ties, duplicates, cutoff boundary, exclusion, correction, metrics, four models, M=0 equation, immutable source data, held-out in-situ/satellite leakage invariance, missing-pair skips.');
})().catch(e=>{console.error(e);process.exitCode=1});
