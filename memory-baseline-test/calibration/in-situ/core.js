/* ReST-Lake standalone in-situ bias correction. No model code imported. */
"use strict";
const ReSTInSituCore=(()=>{
const DAY=86400000;
function toDate(s){if(typeof s!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(s))throw Error("Date must be YYYY-MM-DD.");
 const d=new Date(s+"T00:00:00Z");if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==s)throw Error("Invalid date: "+s);return d;}
const iso=d=>d.toISOString().slice(0,10);
function addMonths(s,n){const d=toDate(s),a=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1));
 const max=new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth()+1,0)).getUTCDate();
 return iso(new Date(Date.UTC(a.getUTCFullYear(),a.getUTCMonth(),Math.min(d.getUTCDate(),max))));}
function parseCSV(text){
 if(typeof text!=="string")throw Error("Invalid CSV.");text=text.replace(/^\uFEFF/,"");
 let records=[],r=[],field="",quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const ch=text[i];
 if(quoted){if(ch==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else field+=ch}
 else if(ch===','||ch==='\r'||ch==='\n'){r.push(field);field="";closed=false;
   if(ch!==','){if(ch==='\r'&&text[i+1]==='\n')i++;if(r.some(x=>x.trim()))records.push(r);r=[]}}
 else if(ch==='"'&&!field&&!closed)quoted=true;
 else {if(closed||ch==='"')throw Error("Malformed CSV quotation.");field+=ch}
 }
 if(quoted)throw Error("Unclosed CSV quotation.");
 r.push(field);if(r.some(x=>x.trim()))records.push(r);
 if(records.length<2)throw Error("CSV requires a header and observations.");
 const headers=records.shift().map(x=>x.trim());if(new Set(headers).size!==headers.length)throw Error("Duplicate column name.");
 return {headers,rows:records.map((arr,i)=>{if(arr.length!==headers.length)throw Error("CSV row "+(i+2)+": column count mismatch.");
  return Object.fromEntries(headers.map((key,j)=>[key,arr[j].trim()]))})};
}
function number(v,label){const s=String(v);if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))throw Error("Invalid "+label+" value: "+s);
const n=Number(s);if(!Number.isFinite(n))throw Error("Invalid "+label);return n}
function validateInSitu(obs){
 const used=new Set();return obs.map(row=>{toDate(row.date);const t=number(row.insitu_temp_c,"in-situ °C");
 if(t< -5||t>60)throw Error("Temperature outside −5 to 60 °C; verify units.");
 if(used.has(row.date))throw Error("Duplicate in-situ date: "+row.date);
 used.add(row.date);return {date:row.date,insitu_temp_c:t}
 }).sort((a,b)=>a.date.localeCompare(b.date));
}
function inSituCSV(text){const parsed=parseCSV(text);
 if(parsed.headers.join(",")!=="date,insitu_temp_c")throw Error('In-situ CSV must have columns "date,insitu_temp_c".');
 return validateInSitu(parsed.rows)}
const HEADER="date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c";
function satelliteCSV(text){const {headers,rows}=parseCSV(text);if(headers.join(",")!==HEADER)throw Error("Use the original five-column satellite model-input CSV format.");
 const used=new Set();return rows.map(r=>{toDate(r.date);if(used.has(r.date))throw Error("Duplicate satellite date: "+r.date);used.add(r.date);
 return {...r,observed_lst_c:r.observed_lst_c===""?null:number(r.observed_lst_c,"satellite LST")};
 }).sort((a,b)=>a.date.localeCompare(b.date))}
function span(observations){if(!observations.length)return null;const sorted=[...observations].sort((a,b)=>a.date.localeCompare(b.date));
 return {start:addMonths(sorted[0].date,-1),end:addMonths(sorted[sorted.length-1].date,1)}}
function match(insitu,satellite,maxDays){
 if(!Number.isInteger(maxDays)||maxDays<0||maxDays>365)throw Error("Matching tolerance must be 0–365 whole days.");
 const sat=satellite.filter(x=>Number.isFinite(x.observed_lst_c));
 let candidates=[];
 for(let i=0;i<insitu.length;i++)for(let j=0;j<sat.length;j++){
  const signed=Math.round((toDate(sat[j].date)-toDate(insitu[i].date))/DAY),days=Math.abs(signed);
  if(days<=maxDays)candidates.push({i,j,signed,days})
 }
 // Exact dates first; nearest unassigned satellite, with earlier-date tie break. No reuse.
 candidates.sort((a,b)=>a.days-b.days||sat[a.j].date.localeCompare(sat[b.j].date)||insitu[a.i].date.localeCompare(insitu[b.i].date));
 const usedObs=new Set(),usedSat=new Set(),chosen=new Map();
 for(const p of candidates){
  if(usedObs.has(p.i)||usedSat.has(p.j))continue;
  usedObs.add(p.i);usedSat.add(p.j);
  const a=insitu[p.i],s=sat[p.j];
  chosen.set(p.i,{insitu_date:a.date,insitu_temp_c:a.insitu_temp_c,satellite_date:s.date,satellite_lst_c:s.observed_lst_c,
   signed_delta_days:p.signed,delta_days:p.days,bias_c:a.insitu_temp_c-s.observed_lst_c,status:p.days===0?"Exact":"Nearest"});
 }
 return insitu.map((a,i)=>chosen.get(i)||{insitu_date:a.date,insitu_temp_c:a.insitu_temp_c,satellite_date:"",satellite_lst_c:null,signed_delta_days:null,delta_days:null,bias_c:null,status:"Unmatched"});
}
function stats(pairs,bias=0){const n=pairs.length;if(!n)return {n:0,rmse:null,mae:null,mean_bias:null};
 const err=pairs.map(p=>p.satellite_lst_c+bias-p.insitu_temp_c);
 return {n,rmse:Math.sqrt(err.reduce((s,e)=>s+e*e,0)/n),mae:err.reduce((s,e)=>s+Math.abs(e),0)/n,mean_bias:err.reduce((s,e)=>s+e,0)/n};}
// Single reusable per-lake additive correction. Fit to every accepted historical pair.
function applySavedBias(satellite,bias){
 if(!Number.isFinite(bias))throw Error("Save a valid calibration offset first.");
 return satellite.map(row=>({...row,original_lst_c:row.observed_lst_c,
   corrected_lst_c:row.observed_lst_c===null?null:row.observed_lst_c+bias,
   applied_bias_c:row.observed_lst_c===null?0:bias}));
}
function calculate(pairs,satellite){
 const all=pairs.filter(p=>p.status!=="Unmatched").sort((a,b)=>a.insitu_date.localeCompare(b.insitu_date));
 if(!all.length)throw Error("No satellite observations matched an in-situ measurement.");
 const bias=all.reduce((s,p)=>s+p.bias_c,0)/all.length;
 const corrected=applySavedBias(satellite,bias);
 return {all,bias,corrected,before:stats(all,0),after:stats(all,bias),
   date_start:all[0].insitu_date,date_end:all[all.length-1].insitu_date};
}

function csvValue(v){if(v===null||v===undefined)return "";
 const s=String(v);return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;}
function makeCSV(rows,keys){return [keys.join(","),...rows.map(r=>keys.map(k=>csvValue(r[k])).join(","))].join("\n")+"\n";}
function modelInputCSV(corrected){return makeCSV(corrected.map(r=>({...r,observed_lst_c:r.corrected_lst_c})),HEADER.split(","));}
function auditCSV(result,pairs){const byDate=new Map(pairs.filter(p=>p.status!=="Unmatched").map(p=>[p.satellite_date,p]));
 return makeCSV(result.corrected.map(r=>({...r,matched_insitu_date:byDate.get(r.date)?.insitu_date||"",
 signed_delta_days:byDate.get(r.date)?.signed_delta_days??"",matching_status:byDate.get(r.date)?.status||"Not paired"})),
 ["date","air_temp_c","shortwave_w_m2","wind_speed_m_s","original_lst_c","corrected_lst_c","applied_bias_c","matched_insitu_date","signed_delta_days","matching_status"]);}
return {toDate,iso,addMonths,parseCSV,number,validateInSitu,inSituCSV,satelliteCSV,span,match,stats,calculate,applySavedBias,makeCSV,modelInputCSV,auditCSV,HEADER};
})();
if(typeof module!=="undefined")module.exports=ReSTInSituCore;