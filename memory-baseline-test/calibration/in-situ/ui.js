"use strict";
(()=>{
const C=ReSTInSituCore, $=id=>document.getElementById(id);
const STORE="restlake:insitu-calibration:2026-10-26:v1";
const names=["Ashtamudi","Bhimtal","Bhojtal (Upper)","Bilaspur","Chilika","Dal","Hussain Sagar","Indira Sagar","Khurpatal","Kolleru","Lake Pichola","Loktak","Lonar","Naini","Naukuchiatal","Pangong Tso","Pulicat","Sambhar Salt","Sattal","Tso Moriri","Vembanad","Wular"];
let db={lakes:{}},lake="",editing=null, pairs=[],run=null;
try {const found=JSON.parse(localStorage.getItem(STORE)||"{}");if(found&&found.lakes&&typeof found.lakes==="object")db=found;}catch(e){}
const defaultRecord=()=>({coords:null,draft:[],saved:[],satellite:[],satelliteSource:"",results:null,calibration:null,futureSatellite:[],futureSource:""});
const data=()=>db.lakes[lake];
const show=(id,msg,level="neutral")=>{const el=$(id);el.textContent=msg;el.className="status-box status-box--"+level;};
function persist(){try{localStorage.setItem(STORE,JSON.stringify(db));return true}catch(e){show("obsStatus","Browser storage could not retain all records. Download CSV backups before leaving this page.","warning");return false}}
function csvDownload(content,name,type="text/csv;charset=utf-8"){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000)}
function safeName(){return lake.replace(/[^a-z0-9_-]/gi,"_").replace(/_+/g,"_")}
function maxAvailable(){const d=new Date();d.setDate(d.getDate()-10);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-")}
function fillSelect(){const select=$("lakeSelect"),keep=select.value;select.replaceChildren(new Option("Select a lake…",""));
for(const n of [...new Set([...names,...Object.keys(db.lakes)])].sort((a,b)=>a.localeCompare(b)))select.add(new Option(n,n));
select.add(new Option("Other lake…","__other__"));select.value=keep;}
fillSelect();
$("lakeSelect").addEventListener("change",()=>{
const other=$("lakeSelect").value==="__other__";$("otherWrap").hidden=!other;
const coords=db.lakes[$("lakeSelect").value]?.coords;$("lat").value=coords?.lat??"";$("lon").value=coords?.lon??"";
});
function validateCoords(requireCoords=false){
 const latText=$("lat").value.trim(),lonText=$("lon").value.trim();
 if(!latText&&!lonText&&!requireCoords)return null;
 if(!latText||!lonText||!Number.isFinite(Number(latText))||!Number.isFinite(Number(lonText))||
 Number(latText)<-90||Number(latText)>90||Number(lonText)<-180||Number(lonText)>180)
 throw Error("Enter valid lake latitude and longitude for satellite download.");
 return {lat:Number(latText),lon:Number(lonText)};
}
function syncDownloadLake(){
 const area=$("lakeDataRows");if(!area)return;
 while(area.children.length>1){const last=area.lastElementChild,del=last.querySelector("button");if(del)del.click();else last.remove()}
 const row=area.firstElementChild;if(!row)return;
 row.querySelector('[name="name"]').value=lake;
 const coord=validateCoords(false);
 row.querySelector('[name="lat"]').value=coord?.lat??"";
 row.querySelector('[name="lon"]').value=coord?.lon??"";
}
function syncDateRange(){
 if(!lake)return;
 const span=C.span(data().saved.length?data().saved:data().draft);
 if(!span){show("rangeInfo","Save in-situ observations to determine the satellite date range.","neutral");return}
 const cap=maxAvailable();
 $("lakeDataStart").value=span.start;$("lakeDataEnd").value=span.end>cap?cap:span.end;
 if(span.start>cap){
   show("rangeInfo","All requested observations occur after the original downloader's latest allowed date ("+cap+"). Download is not available for this range.","warning");
 }else if(span.end>cap){
   show("rangeInfo","Synced "+span.start+" to "+span.end+" (±1 calendar month). Download end is limited to "+cap+" by the original 10-day data lag.","warning");
 }else show("rangeInfo","Automatically synced search dates: "+span.start+" → "+span.end+" (±1 calendar month).","success");
}
function invalidate(){pairs=[];run=null;$("matches").replaceChildren();$("metrics").replaceChildren();$("graph").replaceChildren();show("matchStatus","Data changed. Match dates again to update the audit.","neutral");show("calStatus","Apply correction after matching dates.","neutral");}
function selectLake(){
 let candidate=$("lakeSelect").value;if(candidate==="__other__")candidate=$("otherName").value.trim();
 if(!candidate||candidate.length>80)throw Error("Select or enter one lake name.");
 const coords=validateCoords(false);
 lake=candidate;db.lakes[lake]={...defaultRecord(),...(db.lakes[lake]||{})};
 if(coords)db.lakes[lake].coords=coords;
 fillSelect();$("lakeSelect").value=lake;$("otherWrap").hidden=true;
 const prev=db.lakes[lake].coords;$("lat").value=prev?.lat??"";$("lon").value=prev?.lon??"";
 $("workspace").hidden=false;$("selectedLakeLabel").textContent="Selected: "+lake;
 editing=null;syncDownloadLake();renderObs();renderSatellite();syncDateRange();invalidate();
 if(data().calibration && Number.isFinite(data().calibration.bias_c) && data().results?.computed){
   run=data().results.computed;pairs=data().results.pairs||[];
   $("maxDays").value=data().calibration.matching_tolerance_days??3;
   renderPairs();renderMetrics();
 }
 refreshSavedValue();refreshFuture();renderPlot();persist();
}
$("chooseLake").onclick=()=>{try{selectLake()}catch(e){show("obsStatus",e.message,"danger");alert(e.message)}};
for(const id of ["lat","lon"])$(id).addEventListener("change",()=>{
 if(!lake)return;try{data().coords=validateCoords(false);syncDownloadLake();persist()}catch(e){alert(e.message)}
});
function renderObs(){
 const d=data(),host=$("observations");host.replaceChildren();
 for(const item of d.draft){
  const tr=document.createElement("tr");const date=document.createElement("td");date.textContent=item.date;
  const t=document.createElement("td");t.textContent=item.insitu_temp_c.toFixed(3);
  const actions=document.createElement("td");
  for(const label of ["Edit","Delete"]){
   const b=document.createElement("button");b.type="button";b.className="button button--ghost";b.textContent=label;
   b.onclick=()=>{if(label==="Edit"){$("insituDate").value=item.date;$("insituTemp").value=item.insitu_temp_c;editing=item.date;$("upsert").textContent="Update observation";$("cancelEdit").hidden=false}
   else{if(!confirm("Delete observation dated "+item.date+" from the draft?"))return;
     d.draft=d.draft.filter(x=>x.date!==item.date);editing=null;renderObs();invalidate()}}
   actions.append(b);
  }
  tr.append(date,t,actions);host.append(tr);
 }
 $("obsSummary").textContent=d.draft.length+" draft observations · "+d.saved.length+" saved observations.";
}
$("upsert").onclick=()=>{try{
 const item=C.validateInSitu([{date:$("insituDate").value,insitu_temp_c:$("insituTemp").value}])[0];
 const draft=data().draft.filter(x=>x.date!==editing);
 if(draft.some(x=>x.date===item.date))throw Error("The new date is already present. Edit that row instead.");
 data().draft=C.validateInSitu([...draft,item]);editing=null;$("insituDate").value="";$("insituTemp").value="";
 $("upsert").textContent="Add observation";$("cancelEdit").hidden=true;renderObs();invalidate();
 show("obsStatus","Draft updated. Click Save observations to commit these dates.","neutral");
 }catch(e){show("obsStatus",e.message,"danger")}};
$("cancelEdit").onclick=()=>{editing=null;$("insituDate").value="";$("insituTemp").value="";$("upsert").textContent="Add observation";$("cancelEdit").hidden=true};
$("insituUpload").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;
 try{if(f.size>5000000)throw Error("Maximum in-situ CSV file is 5 MB.");data().draft=C.inSituCSV(await f.text());editing=null;renderObs();invalidate();show("obsStatus","Uploaded "+data().draft.length+" observations into the draft. Save to retain them.","success")}
 catch(err){show("obsStatus",err.message,"danger")}finally{e.target.value=""}};
$("saveObs").onclick=()=>{
 try{if(!data().draft.length)throw Error("Add at least one valid observation.");data().saved=C.validateInSitu(data().draft);data().results=null;data().calibration=null;
 const stored=persist();syncDateRange();renderObs();invalidate();refreshSavedValue();refreshFuture();renderPlot();show("obsStatus",stored?"Saved "+data().saved.length+" in-situ observations for "+lake+".":"Saved in this session, but browser storage is full; download a backup.",stored?"success":"warning")}
 catch(e){show("obsStatus",e.message,"danger")}};
$("template").onclick=()=>csvDownload("date,insitu_temp_c\n", "insitu_template.csv");
$("downloadInsitu").onclick=()=>{if(!data().saved.length){show("obsStatus","Save observations first.","warning");return}
 csvDownload(C.makeCSV(data().saved,["date","insitu_temp_c"]),safeName()+"_insitu_observations.csv")};
function renderSatellite(){
 const sat=data().satellite,n=sat.filter(x=>Number.isFinite(x.observed_lst_c)).length;
 $("satCount").textContent=sat.length?data().satelliteSource+" · "+sat.length+" daily rows · "+n+" available Landsat LST dates":"No satellite observations loaded";
}
function applySatelliteCSV(csv,source){
 const satellite=C.satelliteCSV(csv);if(satellite.length>10000)throw Error("Satellite file exceeds 10,000 daily records.");
 if(!satellite.some(r=>r.observed_lst_c!==null))throw Error("No valid observed satellite LST values in this CSV.");
 data().satellite=satellite;data().satelliteSource=source;data().results=null;data().calibration=null;
 persist();renderSatellite();invalidate();refreshSavedValue();refreshFuture();renderPlot();show("matchStatus","Loaded "+satellite.filter(r=>r.observed_lst_c!==null).length+" available satellite observations. Now match dates.","success");
}
$("satUpload").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;
 try{if(f.size>15000000)throw Error("Satellite CSV exceeds 15 MB.");applySatelliteCSV(await f.text(),f.name)}
 catch(err){show("matchStatus",err.message,"danger")}finally{e.target.value=""}};
$("downloadSatellite").onclick=()=>{if(!data().satellite.length){show("matchStatus","No imported satellite dataset.","warning");return}
 csvDownload(C.makeCSV(data().satellite,C.HEADER.split(",")),safeName()+"_original_satellite.csv")};
function renderPairs(){
 $("matches").replaceChildren();
 for(const p of pairs){
  const tr=document.createElement("tr");
  for(const v of [p.insitu_date,p.insitu_temp_c,p.satellite_date||"—",p.satellite_lst_c===null?"—":p.satellite_lst_c,
    p.delta_days===null?"—":(p.signed_delta_days>0?"+":"")+p.signed_delta_days+" d",
    p.bias_c===null?"—":p.bias_c.toFixed(3),p.status]){
     const td=document.createElement("td");td.textContent=v;tr.append(td)
  }$("matches").append(tr)
 }
 const good=pairs.filter(x=>x.status!=="Unmatched").length;
 show("matchStatus","Matched "+good+" of "+pairs.length+" in-situ dates; "+(pairs.length-good)+" unmatched. Each satellite observation is used at most once.","success");
 renderPlot();
}
function matchDates(){
 if(!data().saved.length)throw Error("Save in-situ observations first.");
 if(!data().satellite.length)throw Error("Import the original satellite CSV first.");
 const max=Number($("maxDays").value);if(!Number.isInteger(max))throw Error("Enter a whole number of matching days.");
 pairs=C.match(data().saved,data().satellite,max);run=null;renderPairs();$("metrics").replaceChildren();
 show("calStatus","Matches previewed. Click Apply Bias Correction / Calibrate to calculate statistics.","neutral");
}
$("matchDates").onclick=()=>{try{matchDates()}catch(e){show("matchStatus",e.message,"danger")}};
$("maxDays").addEventListener("change",()=>{if(lake){data().results=null;data().calibration=null;persist();invalidate();refreshSavedValue();refreshFuture();renderPlot()}});
function metric(label,value){const div=document.createElement("div");div.className="metric";const t=document.createElement("span");t.className="metric__label";t.textContent=label;const v=document.createElement("strong");v.className="metric__value";v.textContent=value;div.append(t,v);return div}
const fmt=v=>Number.isFinite(v)?v.toFixed(3):"—";
function renderMetrics(){
 const host=$("metrics");host.replaceChildren();
 if(!run)return;
 const cells=[
 ["Matched historical pairs",String(run.all.length)],
 ["Reusable calibration bias",fmt(run.bias)+" °C"],
 ["RMSE before → after",fmt(run.before.rmse)+" → "+fmt(run.after.rmse)+" °C"],
 ["MAE before → after",fmt(run.before.mae)+" → "+fmt(run.after.mae)+" °C"],
 ["In-situ calibration period",run.date_start+" to "+run.date_end]];
 for(const [label,value] of cells)host.append(metric(label,value));
 show("calStatus","Calculated from "+run.all.length+" matched historical pairs. This is a calibration-fit error, not independent validation. Click Save calibration value to reuse the offset for any later satellite period.","success");
}
function refreshSavedValue(){
 if(!lake)return;
 const cal=data().calibration;
 if(!cal||!Number.isFinite(cal.bias_c)){
   show("savedValue","No saved lake calibration value. Match historical temperatures, calculate the mean bias and save it.","neutral");return;
 }
 show("savedValue","SAVED — "+lake+" · Bias: "+fmt(cal.bias_c)+" °C · Calibration dates: "+cal.date_start+" to "+cal.date_end+" · "+cal.pairs_used+" historical pairs. New satellite LST will use this same value.","success");
}
function currentFuture(){
 const d=data(),c=d.calibration;
 if(!c||!Number.isFinite(c.bias_c))throw Error("First save a calibration value for this lake.");
 if(!d.futureSatellite?.length)throw Error("Upload a new/or later original satellite CSV.");
 return C.applySavedBias(d.futureSatellite,c.bias_c);
}
function refreshFuture(){
 if(!lake)return;
 const future=data().futureSatellite||[],cal=data().calibration;
 const host=$("futureMetrics");host.replaceChildren();
 if(!future.length){
   show("futureStatus",cal?"Saved bias "+fmt(cal.bias_c)+" °C is ready. Upload an original satellite CSV from any later period.":"Save a historical lake calibration before correcting future satellite observations.","neutral");return;
 }
 if(!cal||!Number.isFinite(cal.bias_c)){
   show("futureStatus","A later satellite CSV is present, but the previous calibration has changed. Save a new bias value before correcting it.","warning");return;
 }
 const n=future.filter(row=>row.observed_lst_c!==null).length,corrected=currentFuture();
 for(const [a,b] of [["Input satellite rows",String(future.length)],["LST observations corrected",String(n)],["Saved bias applied",fmt(cal.bias_c)+" °C"],["Data period",future[0].date+" to "+future[future.length-1].date]]){
   host.append(metric(a,b));
 }
 show("futureStatus","AUTO-CORRECTED "+n+" existing satellite LST values using saved "+lake+" bias "+fmt(cal.bias_c)+" °C. Missing LST remains empty. Download this corrected CSV or use it directly in both models.","success");
}

$("applyBias").onclick=()=>{try{if(!pairs.length)matchDates();run=C.calculate(pairs,data().satellite);renderMetrics();renderPlot()}
 catch(e){show("calStatus",e.message,"danger")}};
$("saveResults").onclick=()=>{
 if(!run){show("calStatus","Calculate the lake bias first.","warning");return}
 const d=data();
 d.calibration={method:"constant_additive_bias",version:2,bias_c:run.bias,pairs_used:run.all.length,
  date_start:run.date_start,date_end:run.date_end,
  rmse_before:run.before.rmse,rmse_after:run.after.rmse,
  mae_before:run.before.mae,mae_after:run.after.mae,
  matching_tolerance_days:Number($("maxDays").value),saved_at:new Date().toISOString()};
 d.results={computed:run,pairs};
 const stored=persist();refreshSavedValue();refreshFuture();show("calStatus",
 stored?"Lake calibration saved: "+fmt(run.bias)+" °C. All new satellite CSVs for "+lake+" can reuse this value.":"Browser storage is full: download exports and avoid closing the tab.",stored?"success":"warning");
};
function loadLaterCSV(text,source){
 if(!data().calibration||!Number.isFinite(data().calibration.bias_c))throw Error("Save a historical calibration value first.");
 const rows=C.satelliteCSV(text);
 if(!rows.length)throw Error("Later satellite CSV contains no rows.");
 if(rows.length>20000)throw Error("Later dataset exceeds 20,000 records.");
 if(!rows.some(row=>row.observed_lst_c!==null))throw Error("No observed satellite LST values to correct.");
 if(/bias.?corrected|calibrated/i.test(source))throw Error("Use the original, uncorrected satellite CSV to avoid applying the bias twice.");
 data().futureSatellite=rows;data().futureSource=source;
 const stored=persist();refreshFuture();
 if(!stored)show("futureStatus","Corrected dataset is available in this session, but browser storage is full. Download it now.","warning");
}
$("futureUpload").onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
   if(file.size>15000000)throw Error("Maximum CSV size is 15 MB.");
   loadLaterCSV(await file.text(),file.name);
 }catch(err){show("futureStatus",err.message,"danger")}
 finally{e.target.value=""}
};
$("downloadFuture").onclick=()=>{
 try{
  const corrected=currentFuture(),stem=safeName();
  csvDownload(C.modelInputCSV(corrected),stem+"_bias_corrected_satellite_model_input.csv");
 }catch(e){show("futureStatus",e.message,"danger")}
};
$("sendToModels").onclick=async()=>{
 try{
  const corrected=currentFuture(),modelCSV=C.modelInputCSV(corrected);
  const root=window.parent;
  if(!root||!root.RestCompare||typeof root.RestCompare.loadBoth!=="function")throw Error("Open this tab through the main calibration tool to load data into both models.");
  const did=await root.RestCompare.loadBoth(modelCSV,safeName()+"_bias_corrected_satellite_model_input.csv","Daily");
  if(did){
    show("futureStatus","The SAVED "+lake+" bias was applied and the corrected CSV is now loaded in With Memory and Baseline. Run the models normally.","success");
    root.document.getElementById("tabMemory")?.click();
    root.RestCompare.scrollToTabs();
  }
 }catch(e){show("futureStatus",e.message,"danger")}
};

function drawPoint(x,y,fill,title,r=4.3){
 return '<circle cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r+'" fill="'+fill+'" stroke="#fff" stroke-width="1.2"><title>'+esc(title)+'</title></circle>';
}
function esc(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;")}
function renderPlot(){
 const sat=data().satellite.filter(r=>r.observed_lst_c!==null),ins=data().saved;
 const samples=[...sat.map(r=>({date:r.date,v:r.observed_lst_c})),...ins.map(r=>({date:r.date,v:r.insitu_temp_c}))];
 if(run)samples.push(...run.corrected.filter(r=>r.corrected_lst_c!==null).map(r=>({date:r.date,v:r.corrected_lst_c})));
 if(!samples.length){$("graph").textContent="Load observations to display the plot.";return}
 const W=1100,H=420,left=64,right=28,top=30,bottom=55;
 let minX=Math.min(...samples.map(p=>C.toDate(p.date).getTime())),maxX=Math.max(...samples.map(p=>C.toDate(p.date).getTime()));
 if(minX===maxX){minX-=86400000;maxX+=86400000}
 const temp=samples.map(p=>p.v),min0=Math.min(...temp),max0=Math.max(...temp),pad=Math.max(.6,(max0-min0)*.12),minY=min0-pad,maxY=max0+pad;
 const x=d=>left+(C.toDate(d).getTime()-minX)/(maxX-minX)*(W-left-right);
 const y=v=>top+(maxY-v)/(maxY-minY)*(H-top-bottom);
 let marks="";
 for(let i=0;i<5;i++){const vv=minY+(maxY-minY)*i/4,yy=y(vv);
  marks+='<line x1="'+left+'" x2="'+(W-right)+'" y1="'+yy+'" y2="'+yy+'" stroke="#dce8ef"/><text x="'+(left-12)+'" y="'+(yy+4)+'" text-anchor="end" font-size="12" fill="#567287">'+vv.toFixed(1)+'</text>'}
 for(let i=0;i<6;i++){const date=new Date(minX+(maxX-minX)*i/5),xx=left+(W-left-right)*i/5;
  marks+='<text x="'+xx+'" y="'+(H-18)+'" font-size="12" text-anchor="middle" fill="#567287">'+date.toISOString().slice(0,7)+'</text>'}
 let connectors="";const assigned=new Set();
 for(const p of pairs){if(p.status==="Unmatched")continue;
  const xx=x(p.insitu_date),sx=x(p.satellite_date),yy=y(p.insitu_temp_c),sy=y(p.satellite_lst_c);
  connectors+='<line x1="'+xx+'" y1="'+yy+'" x2="'+sx+'" y2="'+sy+'" stroke="#8395a5" stroke-dasharray="4 5" stroke-width="1.2" opacity=".75"><title>'+esc(p.insitu_date+" ↔ "+p.satellite_date+" ("+p.signed_delta_days+" days)")+'</title></line>';
  if(assigned.size<20&&p.delta_days){assigned.add(p.insitu_date);connectors+='<text x="'+((xx+sx)/2)+'" y="'+((yy+sy)/2-6)+'" text-anchor="middle" font-size="11" fill="#5b7286">Δ'+p.signed_delta_days+'d</text>'}
 }
 const satelliteDots=sat.map(p=>drawPoint(x(p.date),y(p.observed_lst_c),"#5078ba",p.date+" original satellite "+p.observed_lst_c+"°C")).join("");
 const insituDots=ins.map(p=>drawPoint(x(p.date),y(p.insitu_temp_c),"#df6952",p.date+" in-situ "+p.insitu_temp_c+"°C",5)).join("");
 const correctedDots=run?run.corrected.filter(p=>p.corrected_lst_c!==null).map(p=>drawPoint(x(p.date),y(p.corrected_lst_c),"#049b98",p.date+" corrected "+p.corrected_lst_c.toFixed(3)+"°C")).join(""):"";
 const legend=[["#5078ba","Original satellite LST"],["#df6952","In-situ temperature"],["#049b98","Bias-corrected satellite LST"]].map(([c,t],i)=>'<circle cx="'+(left+i*260)+'" cy="14" r="5" fill="'+c+'"/><text x="'+(left+12+i*260)+'" y="18" font-size="12" fill="#34536a">'+t+'</text>').join("");
 $("graph").innerHTML='<svg id="insituPlot" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Original satellite, measured in-situ and corrected lake temperature observation plots">'+
 '<rect width="'+W+'" height="'+H+'" fill="#f8fbff"/>'+marks+legend+connectors+satelliteDots+correctedDots+insituDots+
 '<text x="19" y="'+(H/2)+'" font-size="14" text-anchor="middle" transform="rotate(-90 19 '+(H/2)+')" fill="#34536a">Temperature (°C)</text></svg>';
}
function requireRun(){if(!run)throw Error("Apply the correction first.")}
function guarded(action){try{action()}catch(e){show("calStatus",e.message,"danger")}}
$("exportCorrected").onclick=()=>guarded(()=>{requireRun();csvDownload(C.modelInputCSV(run.corrected),safeName()+"_in_situ_corrected_model_input.csv")});
$("exportAudit").onclick=()=>guarded(()=>{
 requireRun();
 csvDownload(C.makeCSV(pairs.map(p=>({...p,corrected_satellite_lst_c:p.satellite_lst_c===null?"":p.satellite_lst_c+run.bias})),
 ["insitu_date","insitu_temp_c","satellite_date","satellite_lst_c","signed_delta_days","delta_days","bias_c","status","corrected_satellite_lst_c"]),
 safeName()+"_historical_matching_audit.csv");
});
$("exportMetrics").onclick=()=>guarded(()=>{
 requireRun();
 const summary=[{lake,bias_c:run.bias,matched_pairs:run.all.length,calibration_start:run.date_start,calibration_end:run.date_end,
 rmse_before:run.before.rmse,rmse_after:run.after.rmse,mae_before:run.before.mae,mae_after:run.after.mae}];
 csvDownload(C.makeCSV(summary,["lake","bias_c","matched_pairs","calibration_start","calibration_end","rmse_before","rmse_after","mae_before","mae_after"]),safeName()+"_calibration_value_metrics.csv");
});

$("exportPlot").onclick=()=>guarded(()=>{const svg=$("insituPlot");if(!svg)throw Error("No plot to export.");
 csvDownload(new XMLSerializer().serializeToString(svg),safeName()+"_in_situ_calibration_plot.svg","image/svg+xml")});
$("lakeDataBundle").addEventListener("change",async e=>{
 const file=e.target.files?.[0];if(!file||!lake)return;
 try{const obj=JSON.parse(await file.text());
 if(obj.format!=="lake-thermal-memory-data-v1"||obj.frequency!=="Daily"||!Array.isArray(obj.lakes))throw Error("Import the original Daily Colab result bundle.");
 const selected=obj.lakes.find(r=>r.name?.trim().toLowerCase()===lake.toLowerCase());
 if(!selected)throw Error("The imported bundle does not contain the selected lake: "+lake);
 if(typeof selected.csv!=="string"||selected.csv.length>15000000)throw Error("Selected lake CSV is missing or too large.");
 const name=selected.filename||"Colab: "+lake;
 if(data().calibration){
   loadLaterCSV(selected.csv,name);
   show("futureStatus","Imported the new Colab satellite data and automatically applied saved "+lake+" bias. Download corrected CSV or use it in both models.","success");
 }else{
   applySatelliteCSV(selected.csv,name);
   show("matchStatus","Imported historical satellite observations for "+lake+". Now match the saved in-situ temperatures.","success");
 }
 }catch(e){show("matchStatus",e.message,"danger")}
 },{capture:true});
$("prepareLakeNotebook").addEventListener("click",e=>{
 try{if(!lake)throw Error("Select a lake first.");validateCoords(true);syncDownloadLake();
 if(!data().saved.length)throw Error("Save in-situ observations before preparing satellite dates.");
 const span=C.span(data().saved);if(span.start>maxAvailable())throw Error("Selected dates are later than the satellite provider's available range.");
 }catch(err){e.preventDefault();e.stopImmediatePropagation();show("rangeInfo",err.message,"danger")}
 },{capture:true});
})();
