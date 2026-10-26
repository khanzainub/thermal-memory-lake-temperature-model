/* Experimental logic; the original app.js supplies the unchanged memory solver. */
'use strict';
const ReSTExperiment = (() => {
  const DAY = 86400000;
  const iso = d => new Date(d).toISOString().slice(0,10);
  function date(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || iso(s)!==s) throw Error('Use a valid YYYY-MM-DD date.');
    return new Date(s+'T00:00:00Z');
  }
  function csv(text) {
    const records=[]; let row=[], field='', quoted=false, closed=false;
    text=text.replace(/^\uFEFF/,'');
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(quoted) {if(c==='"') {if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}
      else if(c===','||c==='\n'||c==='\r') {row.push(field);field='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v.trim()))records.push(row);row=[];}}
      else if(c==='"'&&!field&&!closed)quoted=true;
      else {if(closed||c==='"')throw Error('Invalid CSV quoting.');field+=c;}
    }
    if(quoted)throw Error('Unclosed CSV quote.');row.push(field);if(row.some(v=>v.trim()))records.push(row);
    if(records.length<2)throw Error('CSV needs a header and observations.');
    const h=records.shift().map(v=>v.trim());
    if(new Set(h).size!==h.length)throw Error('Duplicate column headers.');
    return records.map((r,i)=>{if(r.length!==h.length)throw Error(`CSV row ${i+2}: incorrect column count.`);return Object.fromEntries(h.map((k,j)=>[k,r[j].trim()]));});
  }
  function validate(records,lake) {
    const seen=new Set();
    return records.map(r=>{
      if(!lake||r.lake_name?.trim().toLowerCase()!==lake.toLowerCase())throw Error(`Each record must name the selected lake: ${lake}.`);
      date(r.date);
      if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(r.insitu_temp_c)))throw Error('Temperature must be a numeric Celsius value, without a unit suffix.');
      const t=Number(r.insitu_temp_c);
      if(!Number.isFinite(t)||t< -5||t>60)throw Error('Temperature outside −5 to 60 °C. Check Celsius units; Kelvin/Fahrenheit are not converted.');
      if(seen.has(r.date))throw Error(`Duplicate in-situ date ${r.date}; resolve replicates explicitly.`);
      seen.add(r.date);return {lake_name:lake,date:r.date,insitu_temp_c:t};
    }).sort((a,b)=>a.date.localeCompare(b.date));
  }
  function match(rows,observations,maxDays,cutoff,excluded=[]) {
    if(!Number.isFinite(maxDays)||maxDays<0||maxDays>365)throw Error('Matching tolerance must be 0–365 days.');
    const sat=rows.map((r,i)=>({...r,i})).filter(r=>r.observed_lst_c!==null&&Number.isFinite(r.observed_lst_c));
    const pairs=observations.map(o=>{
      const eligible=sat;
      const p={...o,id:o.date,status:'unmatched',satellite_date:'',satellite_index:null,delta_days:null,bias_c:null,tie:false};
      if(o.date>cutoff){p.status='withheld validation';return p;}
      const distances=eligible.map(s=>({s,delta:Math.abs(date(o.date)-s.date)/DAY})).sort((a,b)=>a.delta-b.delta||a.s.date-b.s.date);
      if(!distances.length||distances[0].delta>maxDays)return p;
      const {s,delta}=distances[0];
      Object.assign(p,{satellite_date:iso(s.date),satellite_index:s.i,satellite_lst_c:s.observed_lst_c,delta_days:delta,signed_delta_days:(date(o.date)-s.date)/DAY,bias_c:o.insitu_temp_c-s.observed_lst_c,tie:distances.length>1&&distances[1].delta===delta,status:'accepted'});
      if(p.satellite_date>cutoff)p.status='cross-boundary match (not used)';
      return p;
    });
    const used=new Set();
    // Select one pair per satellite record, closest first, then earlier in-situ date.
    for(const p of [...pairs].filter(p=>p.status==='accepted').sort((a,b)=>a.delta_days-b.delta_days||a.date.localeCompare(b.date))) {
      if(used.has(p.satellite_index))p.status='duplicate satellite match';else used.add(p.satellite_index);
      if(excluded.includes(p.id)&&p.status==='accepted')p.status='excluded';
    }
    return pairs;
  }
  function correct(rows,pairs,options) {
    const accepted=pairs.filter(p=>p.status==='accepted');
    const mean=accepted.length?accepted.reduce((s,p)=>s+p.bias_c,0)/accepted.length:null;
    const direct=new Map(accepted.map(p=>[p.satellite_index,p]));
    if(!['matched','mean'].includes(options.method))throw Error('Unknown bias method.');
    if(options.method==='mean'&&(!options.start||!options.end||date(options.start)>date(options.end)))throw Error('Choose a valid explicit bias application period.');
    return rows.map((r,i)=>{
      const p=direct.get(i), d=iso(r.date);let bias=0,status='unchanged';
      if(options.enabled&&r.observed_lst_c!==null&&accepted.length){
        if(options.method==='matched'&&p){bias=p.bias_c;status='direct matched correction';}
        if(options.method==='mean'&&d>=options.start&&d<=options.end){bias=mean;status='calibration-pair mean bias';}
      }
      return {...r,original_lst_c:r.observed_lst_c,corrected_lst_c:r.observed_lst_c===null?null:r.observed_lst_c+bias,applied_bias_c:bias,matching_insitu_date:p?.date||'',matching_satellite_date:p?.satellite_date||'',delta_days:p?.delta_days??null,correction_status:status};
    });
  }
  function stats(y,p) {
    if(y.length!==p.length||!y.length||y.some(v=>!Number.isFinite(v))||p.some(v=>!Number.isFinite(v)))return {n:0,rmse:null,mae:null,r:null,r2:null};
    const n=y.length,mean=a=>a.reduce((s,v)=>s+v,0)/n,ym=mean(y),pm=mean(p),errors=p.map((v,i)=>v-y[i]);
    const sse=errors.reduce((s,v)=>s+v*v,0),sy=y.reduce((s,v)=>s+(v-ym)**2,0),sp=p.reduce((s,v)=>s+(v-pm)**2,0);
    return {n,rmse:Math.sqrt(sse/n),mae:mean(errors.map(Math.abs)),r:sy&&sp?y.reduce((s,v,i)=>s+(v-ym)*(p[i]-pm),0)/Math.sqrt(sy*sp):null,r2:sy?1-sse/sy:null};
  }
  async function noMemory(rows) {
    const indices=rows.map((r,i)=>r.observed_lst_c!==null?i:-1).filter(i=>i>=0);
    if(indices.length<10)throw Error('At least 10 calibration observations required.');
    const fitIndices=indices.slice(1); // identical residual dates to the memory fit; no anchor in predictions.
    const lower=[-100,-5,-.1,-10],upper=[100,5,.1,10];
    const toX=y=>y.map((v,i)=>lower[i]+v*(upper[i]-lower[i]));
    const toY=x=>x.map((v,i)=>(clamp(v,lower[i]+1e-10,upper[i]-1e-10)-lower[i])/(upper[i]-lower[i]));
    const predict=(r,b)=>b[0]+b[1]*r.air_temp_c+b[2]*r.shortwave_w_m2+b[3]*r.wind_speed_m_s;
    const residual=b=>fitIndices.map(i=>predict(rows[i],b)-rows[i].observed_lst_c);
    const initial=initialBetaGuess(rows), candidates=[];
    for(let k=0;k<9;k++) {
      const start=toY(initial).map((v,i)=>clamp(v+(k===0?0:0.025*Math.sin(k*(i+1))),1e-10,1-1e-10));
      const fit=nelderMead(y=>residual(toX(y)).reduce((s,e)=>s+2*(Math.sqrt(1+e*e)-1),0),start,{maxIter:650,tol:1e-7});
      const b=toX(fit.x);candidates.push({b,sse:residual(b).reduce((s,e)=>s+e*e,0)});
      await new Promise(r=>setTimeout(r,0));
    }
    candidates.sort((a,b)=>a.sse-b.sse);const b=candidates[0].b;
    return {beta0:b[0],betaT:b[1],betaS:b[2],betaU:b[3],tau:null,M:0,nObserved:indices.length,freeRun:rows.map(r=>predict(r,b))};
  }
  async function run(rows,observations,options,progress=()=>{}) {
    const split=validationSplit(rows,70),cutoff=iso(rows[split.trainIdx.at(-1)].date);
    const pairs=match(rows,observations,options.maxDays,cutoff,options.excluded);
    const corrected=correct(rows,pairs,options);
    const train=new Set(split.trainIdx), output=[];
    const independent=observations.filter(o=>o.date>cutoff).map(o=>({...o,index:rows.findIndex(r=>iso(r.date)===o.date)})).filter(o=>o.index>=0);
    for(const [id,memory,bias] of [['A',true,false],['B',false,false],['C',true,true],['D',false,true]]) {
      if(bias&&(!options.enabled||!pairs.some(p=>p.status==='accepted'))){output.push({id,skipped:'Save observations, enable correction and accept at least one calibration pair.'});continue;}
      progress(`Fitting ${id} — ${memory?'thermal memory':'M = 0'}…`);
      const targets=rows.map((r,i)=>({...r,observed_lst_c:bias?corrected[i].corrected_lst_c:r.observed_lst_c}));
      const masked=targets.map((r,i)=>({...r,observed_lst_c:train.has(i)?r.observed_lst_c:null}));
      const fit=memory?await fitModel(masked,'Daily'):await noMemory(masked);
      fit.M=memory?Math.exp(-1/fit.tau):0;
      const evaluate=(idx,ref)=>stats(idx.map(i=>ref[i].observed_lst_c),idx.map(i=>fit.freeRun[i]));
      output.push({id,memory,bias,fit,calibration_count:split.trainIdx.length,validation_count:split.testIdx.length,
        calibration:evaluate(split.trainIdx.slice(1),rows),validation:evaluate(split.testIdx,rows),
        fitted_target_calibration:evaluate(split.trainIdx.slice(1),targets),
        independent_insitu:stats(independent.map(o=>o.insitu_temp_c),independent.map(o=>fit.freeRun[o.index])),
        independent_dates:independent.map(o=>o.date)});
    }
    return {cutoff,split,pairs,corrected,output,options,independent,unavailable_insitu:observations.filter(o=>o.date>cutoff).length-independent.length};
  }
  return {iso,date,csv,validate,match,correct,stats,noMemory,run};
})();
if(typeof module!=='undefined')module.exports=ReSTExperiment;
