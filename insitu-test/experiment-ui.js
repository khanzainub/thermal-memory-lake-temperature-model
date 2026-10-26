/* Lake-local experimental workspace. No writes to the original application's state. */
(() => {
'use strict';
const E=ReSTExperiment, $=id=>document.getElementById(id), esc=escapeHtml;
const KEY='rest-lake:insitu-test:v1';
const names=['Ashtamudi','Bhimtal','Bhojtal (Upper)','Bilaspur','Chilika','Dal','Hussain Sagar','Indira Sagar','Khurpatal','Kolleru','Lake Pichola','Loktak','Lonar','Naini','Naukuchiatal','Pangong Tso','Pulicat','Sambhar Salt','Sattal','Tso Moriri','Vembanad','Wular'];
let db={lakes:{}}, lake='', data=null, result=null, preview=null, history=[], editDate=null, busy=false;
try {const stored=JSON.parse(localStorage.getItem(KEY));if(stored?.lakes)db=stored;}catch(e){console.warn('Experimental saved data could not be read',e);}
const section=document.createElement('section');section.className='panel experiment';section.id='experiment';
section.innerHTML=`<div class="exp-heading"><div><span class="step">EXPERIMENTAL</span><h2>In-situ bias correction & model comparison</h2></div><a href="../base/">Open unchanged baseline ↗</a></div>
<p class="helper">Select Lake → In-Situ Input → Match/Edit Pairs → Bias Correction → Four-Model Comparison → Export</p>
<p class="helper">Daily data only in this experimental module. The original workflow below remains available for daily, monthly and yearly runs. <a href="METHODOLOGY.md" target="_blank">Methodology & usage</a></p>
<div class="exp-row"><label>1 · Select lake<select id="expLake"><option value="">Choose a lake…</option></select></label><label>Or add a lake<input id="expNewLake" maxlength="80" placeholder="Exact lake name"></label><button id="expAddLake" class="button button--secondary">Add lake</button></div>
<fieldset id="expWorkspace" disabled><legend>Lake-specific experimental workspace</legend>
<details open><summary>Satellite observations & daily atmospheric predictors</summary><div class="exp-row"><label>Upload original model-input CSV<input id="expSatellite" type="file" accept=".csv,text/csv"></label><button id="expUseCurrent" class="button button--secondary">Copy currently loaded daily data</button></div><p class="helper">Explicitly assign the selected lake's file. Original schema: date, air_temp_c, shortwave_w_m2, wind_speed_m_s, observed_lst_c. A lake_name column, if supplied, must match. Complete daily forcing is required; satellite dates may be sparse.</p><p id="expSource"></p></details>
<details open><summary>2 · In-situ input — temperatures in °C</summary><div class="exp-row"><label>Date<input id="expDate" type="date"></label><label>Temperature (°C)<input id="expTemp" type="number" step="any" min="-5" max="60"></label><button id="expAdd" class="button button--secondary">Add / update observation</button></div><div class="exp-row"><label>Upload in-situ CSV<input id="expCSV" type="file" accept=".csv,text/csv"></label><button id="expTemplate" class="button button--ghost">Download CSV template</button><button id="expUndoInput" class="button button--ghost">Undo edit / remove</button><button id="expRestoreSaved" class="button button--ghost">Restore last saved</button><button id="expSave" class="button">Save observations</button><span id="expSaved"></span></div><p class="helper">CSV adds records to this lake only. Duplicate dates are rejected; use Edit to resolve replicates. Saving is local to this browser; export observations for backup.</p><div class="exp-table"><table><thead><tr><th>Date</th><th>In-situ (°C)</th><th>Actions</th></tr></thead><tbody id="expObs"></tbody></table></div></details>
<details open><summary>3 · Match / edit pairs</summary><div class="exp-row"><label>Maximum separation (days)<input id="expTolerance" type="number" min="0" max="365" step="1" value="3"></label><button id="expUndoSelection" class="button button--ghost">Undo exclusion</button><button id="expRestoreAll" class="button button--ghost">Restore All</button><button id="expResetSelection" class="button button--ghost">Reset Selection</button></div><p class="helper">Click a calibration observation or connecting line to toggle exclusion. Source values are never deleted. Equal-distance ties choose the earlier satellite date; satellite reuse keeps the closest pair (then earlier in-situ date). Exclusion does not silently reassign duplicates. Later in-situ measurements are reserved for independent validation.</p><div id="expMatchStats" role="status"></div><div id="expMatching" class="exp-plot"></div><details><summary>Matching audit table</summary><div id="expPairs" class="exp-table"></div></details></details>
<details open><summary>4 · Bias correction</summary><label class="exp-check"><input id="expEnable" type="checkbox"> ✔ Use saved in-situ observations to bias-correct satellite LST</label><div class="exp-row"><label>Correction method<select id="expMethod"><option value="matched">Matched calibration observations only (default)</option><option value="mean">Mean calibration-pair bias over explicit period</option></select></label><label>Application start<input id="expStart" type="date"></label><label>Application end<input id="expEnd" type="date"></label></div><p id="expAssumptions" class="helper"></p><div id="expBias" class="exp-plot"></div><div id="expSeparation" class="exp-plot"></div><div id="expCorrected" class="exp-plot"></div></details>
<div class="exp-row"><button id="expRun" class="button">5 · Run four-model comparison</button><button id="expExport" class="button button--secondary">6 · Export results & parameters CSV</button><button id="expExportPairs" class="button button--ghost">Export matched & corrected datasets</button><button id="expExportObs" class="button button--ghost">Export saved in-situ CSV</button></div>
<p class="helper">Fixed nominal 70:30 chronological split, with the original minimum of 10 calibration / 2 validation observations. A and B use original targets; C and D use corrected targets. Direct comparisons always use original satellite references on identical dates. A lower error against a changed target does not demonstrate improved independent accuracy.</p>
<div id="expResults"></div></fieldset><p id="expStatus" class="status-box" role="status" aria-live="polite">Select a lake to begin.</p>`;
document.querySelector('main').prepend(section);
function populate(){const all=[...new Set([...names,...Object.keys(db.lakes)])].sort();$('expLake').innerHTML='<option value="">Choose a lake…</option>'+all.map(n=>`<option>${esc(n)}</option>`).join('');$('expLake').value=lake;}
function show(s,error=false){$('expStatus').textContent=s;$('expStatus').className='status-box '+(error?'status-box--danger':'status-box--neutral');}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(db));}catch(e){throw Error('Browser storage could not save this dataset. Export a backup; free browser storage before retrying.');}}
function newLake(){return {rows:[],obs:[],saved:[],excluded:[],selectionHistory:[],source:'',savedAt:null,enabled:false,maxDays:3,method:'matched',start:'',end:''};}
function rows(){return data.rows.map(r=>({...r,date:new Date(r.date)}));}
function dirty(){return JSON.stringify(data.obs)!==JSON.stringify(data.saved);}
function opts(){return {maxDays:Number($('expTolerance').value),excluded:data.excluded,enabled:$('expEnable').checked&&!dirty()&&!!data.savedAt,method:$('expMethod').value,start:$('expStart').value,end:$('expEnd').value};}
function invalidate(){result=null;$('expResults').replaceChildren();$('expExport').disabled=true;}
function snapshot(){history.push(JSON.stringify(data.obs));if(history.length>100)history.shift();}
function changed(){data.enabled=false;$('expEnable').checked=false;invalidate();persist();renderInput();refresh();}
function renderInput(){
 $('expObs').innerHTML=data.obs.map(o=>`<tr><td>${esc(o.date)}</td><td>${o.insitu_temp_c}</td><td><button type="button" data-edit="${o.date}">Edit</button> <button type="button" data-remove="${o.date}">Remove</button></td></tr>`).join('');
 $('expSaved').textContent=dirty()?'Unsaved changes':data.savedAt?'✔ Saved '+new Date(data.savedAt).toLocaleString():'Not saved';
 $('expEnable').disabled=dirty()||!data.savedAt;
 $('expSource').textContent=data.rows.length?`${lake} · ${data.source} · ${data.rows.length} daily rows · ${data.rows.filter(r=>r.observed_lst_c!==null).length} satellite observations`:'No satellite dataset assigned to this lake.';
}
function select(){lake=$('expLake').value;data=lake?(db.lakes[lake]??=newLake()):null;history=[];editDate=null;preview=null;invalidate();$('expWorkspace').disabled=!lake;if(!lake)return;for(const [id,key]of [['expTolerance','maxDays'],['expMethod','method'],['expStart','start'],['expEnd','end']])$(id).value=data[key];$('expEnable').checked=data.enabled&&!dirty();renderInput();refresh();show(`Selected ${lake}.`);}
function safe(fn){return async event=>{try{if(busy)throw Error('Wait for the current comparison to finish.');await fn(event);}catch(e){show(e.message||String(e),true);}};}
$('expLake').onchange=safe(select);
$('expAddLake').onclick=safe(()=>{let name=$('expNewLake').value.trim();if(!name||name.length>80||['__proto__','constructor','prototype'].includes(name))throw Error('Enter a lake name (1–80 characters).');const existing=[...names,...Object.keys(db.lakes)].find(n=>n.toLowerCase()===name.toLowerCase());lake=existing||name;db.lakes[lake]??=newLake();persist();populate();select();$('expNewLake').value='';});
function assign(raw,name){
 if(raw.some(r=>r.lake_name&&r.lake_name.trim().toLowerCase()!==lake.toLowerCase()))throw Error('Satellite lake_name does not match the selected lake.');
 for(const r of raw){E.date(r.date);for(const k of ['air_temp_c','shortwave_w_m2','wind_speed_m_s']){if(String(r[k]??'').trim()===''||!Number.isFinite(Number(r[k])))throw Error('Missing or invalid forcing value: '+k);}if(String(r.observed_lst_c??'').trim()!==''&&!Number.isFinite(Number(r.observed_lst_c)))throw Error('Invalid satellite temperature.');}
 const prepared=prepareData(raw,'Daily');validationSplit(prepared,70);
 data.rows=prepared.map(r=>({...r,date:E.iso(r.date)}));data.source=name;data.excluded=[];data.selectionHistory=[];data.start=E.iso(prepared[0].date);data.end=E.iso(prepared.at(-1).date);$('expStart').value=data.start;$('expEnd').value=data.end;invalidate();persist();renderInput();refresh();show(`Assigned ${name} to ${lake}.`);
}
$('expSatellite').onchange=safe(async e=>{const f=e.target.files[0];if(!f)return;if(f.size>15000000)throw Error('Maximum CSV size is 15 MB.');const raw=E.csv(await f.text());if(REQUIRED_COLUMNS.some(k=>!(k in raw[0])))throw Error('Missing required satellite/predictor columns.');assign(raw,f.name);e.target.value='';});
$('expUseCurrent').onclick=safe(()=>{if(!state.rows||state.frequency!=='Daily')throw Error('Load a daily dataset in the original workflow below first.');assign(state.rows.map(r=>({...r,date:E.iso(r.date),observed_lst_c:r.observed_lst_c??''})),state.sourceName||'Current daily dataset');});
$('expAdd').onclick=safe(()=>{const item={lake_name:lake,date:$('expDate').value,insitu_temp_c:$('expTemp').value};const draft=data.obs.filter(o=>o.date!==editDate);const valid=E.validate([...draft,item],lake);snapshot();data.obs=valid;editDate=null;$('expDate').value='';$('expTemp').value='';changed();});
$('expObs').onclick=safe(e=>{const edit=e.target.dataset.edit,remove=e.target.dataset.remove;if(edit){const o=data.obs.find(o=>o.date===edit);editDate=edit;$('expDate').value=o.date;$('expTemp').value=o.insitu_temp_c;show('Editing '+edit+'; click Add / update to apply.');}if(remove){snapshot();data.obs=data.obs.filter(o=>o.date!==remove);changed();}});
$('expCSV').onchange=safe(async e=>{const f=e.target.files[0];if(!f)return;if(f.size>5000000)throw Error('Maximum in-situ file size is 5 MB.');const incoming=E.csv(await f.text());const valid=E.validate([...data.obs,...incoming],lake);snapshot();data.obs=valid;changed();e.target.value='';show(`Added ${incoming.length} observations. Save to enable correction.`);});
$('expUndoInput').onclick=safe(()=>{if(history.length){data.obs=JSON.parse(history.pop());changed();}});
$('expRestoreSaved').onclick=safe(()=>{snapshot();data.obs=structuredClone(data.saved);changed();});
$('expSave').onclick=safe(()=>{data.obs=E.validate(data.obs,lake);data.saved=structuredClone(data.obs);data.savedAt=new Date().toISOString();persist();renderInput();refresh();show('✔ Observations saved. Tick the checkbox to use them for bias correction.');});
function download(content,name,type='text/csv;charset=utf-8'){downloadText(content,name,type);}
function toCSV(records){if(!records.length)return '';const keys=[...new Set(records.flatMap(Object.keys))];return keys.map(csvEscape).join(',')+'\n'+records.map(r=>keys.map(k=>csvEscape(r[k]??'')).join(',')).join('\n');}
const stem=()=>lake.replace(/[^a-z0-9_-]/gi,'_');
$('expTemplate').onclick=safe(()=>download('lake_name,date,insitu_temp_c\n',`${stem()}_insitu_template.csv`));
$('expExportObs').onclick=safe(()=>{if(!data.saved.length)throw Error('Save at least one observation first.');download(toCSV(data.saved),`${stem()}_insitu_saved.csv`);});
function selectionSave(){data.selectionHistory.push([...data.excluded]);if(data.selectionHistory.length>100)data.selectionHistory.shift();}
function toggle(id){if(busy)return;selectionSave();data.excluded=data.excluded.includes(id)?data.excluded.filter(x=>x!==id):[...data.excluded,id];invalidate();persist();refresh();}
$('expUndoSelection').onclick=safe(()=>{if(data.selectionHistory.length){data.excluded=data.selectionHistory.pop();invalidate();persist();refresh();}});
$('expRestoreAll').onclick=safe(()=>{selectionSave();data.excluded=[];invalidate();persist();refresh();});
$('expResetSelection').onclick=safe(()=>{data.excluded=[];data.selectionHistory=[];invalidate();persist();refresh();});
for(const [id,key]of [['expTolerance','maxDays'],['expMethod','method'],['expStart','start'],['expEnd','end'],['expEnable','enabled']])$(id).onchange=safe(()=>{data[key]=id==='expEnable'?$(id).checked:$(id).value;invalidate();persist();refresh();});
const colors=['#1467ad','#cb6330','#158575','#8853b6'];
// Dependency-free SVG charts: hover details, clickable points/pairs, series toggles and vector/4x PNG export.
function chart(id,title,series,{xLabel='Date',yLabel='Temperature (°C)',time=true,segments=[],cutoff=null,reference=false}={}) {
 const host=$(id);host.replaceChildren();
 const titleEl=document.createElement('h4');titleEl.textContent=title;host.append(titleEl);
 const valid=series.flatMap(s=>s.points).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(!valid.length){host.append('No available observations.');return;}
 let xmin=Math.min(...valid.map(p=>p.x)),xmax=Math.max(...valid.map(p=>p.x)),ymin=Math.min(...valid.map(p=>p.y)),ymax=Math.max(...valid.map(p=>p.y));
 if(reference){xmin=ymin=Math.min(xmin,ymin);xmax=ymax=Math.max(xmax,ymax);}
 if(xmin===xmax){xmin-=time?86400000:1;xmax+=time?86400000:1;}const yr=ymax-ymin||1;ymin-=yr*.08;ymax+=yr*.08;
 const X=x=>75+(x-xmin)/(xmax-xmin)*840,Y=y=>340-(y-ymin)/(ymax-ymin)*280;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1000 410');svg.setAttribute('role','img');svg.setAttribute('aria-label',title);svg.style.cssText='width:100%;background:#fff;color:#172b43;font:12px Arial';
 const node=(tag,attrs,text)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
 svg.append(node('rect',{width:1000,height:410,fill:'white'}),node('text',{x:75,y:24,'font-size':16,fill:'#172b43'},title));
 for(let i=0;i<=4;i++){const x=xmin+(xmax-xmin)*i/4,y=ymin+(ymax-ymin)*i/4;svg.append(node('line',{x1:75,x2:915,y1:Y(y),y2:Y(y),stroke:'#dce5ed'}),node('text',{x:65,y:Y(y)+4,'text-anchor':'end',fill:'#334155'},y.toFixed(1)),node('text',{x:X(x),y:362,'text-anchor':'middle',fill:'#334155'},time?E.iso(x):x.toFixed(1)));}
 svg.append(node('text',{x:495,y:394,'text-anchor':'middle',fill:'#334155'},xLabel),node('text',{transform:'translate(19 205) rotate(-90)','text-anchor':'middle',fill:'#334155'},yLabel));
 if(cutoff&&cutoff>=xmin&&cutoff<=xmax){svg.append(node('line',{x1:X(cutoff),x2:X(cutoff),y1:45,y2:340,stroke:'#64748b','stroke-dasharray':'5 4'}),node('text',{x:X(cutoff)+4,y:48,fill:'#475569'},'Held-out →'));}
 if(reference)svg.append(node('line',{x1:X(xmin),x2:X(xmax),y1:Y(xmin),y2:Y(xmax),stroke:'#94a3b8','stroke-dasharray':'5 4'}));
 function interactive(n,p){n.append(node('title',{},p.tip||`${p.x}, ${p.y}`));if(p.id){n.style.cursor='pointer';n.setAttribute('tabindex','0');n.setAttribute('role','button');n.setAttribute('aria-label',p.tip+'; toggle exclusion');n.onclick=()=>{try{toggle(p.id);}catch(e){show(e.message,true);}};n.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();n.onclick();}};}}
 for(const s of segments){const n=node('line',{x1:X(s.x1),y1:Y(s.y1),x2:X(s.x2),y2:Y(s.y2),stroke:s.color||'#769bb1','stroke-width':4,opacity:.65});interactive(n,s);svg.append(n);}
 const legend=document.createElement('div');legend.className='exp-legend';
 series.forEach((s,i)=>{const g=node('g',{}),color=s.color||colors[i%4];
 if(s.line){const pts=s.points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));g.append(node('polyline',{points:pts.map(p=>`${X(p.x)},${Y(p.y)}`).join(' '),fill:'none',stroke:color,'stroke-width':1.6,'stroke-dasharray':s.dash||''}));}
 for(const p of s.points){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const n=node('circle',{cx:X(p.x),cy:Y(p.y),r:p.id?5:3.4,fill:s.hollow?'white':color,stroke:color,'stroke-width':1.5});interactive(n,p);g.append(n);}
 svg.append(g);const btn=document.createElement('button');btn.textContent='● '+s.name;btn.style.color=color;btn.setAttribute('aria-pressed','true');btn.onclick=()=>{const visible=g.style.display==='none';g.style.display=visible?'':'none';btn.setAttribute('aria-pressed',String(visible));};legend.append(btn);
 svg.append(node('text',{x:75+(i%3)*285,y:405+Math.floor(i/3)*18,fill:color,'font-size':10},s.name));
 });
 const height=430+Math.floor((series.length-1)/3)*18;svg.setAttribute('viewBox',`0 0 1000 ${height}`);svg.firstChild.setAttribute('height',height);
 const actions=document.createElement('div');actions.className='exp-row';
 const svgBtn=document.createElement('button');svgBtn.textContent='Download SVG';const pngBtn=document.createElement('button');pngBtn.textContent='Download 4× PNG';actions.append(svgBtn,pngBtn);
 function serialized(){const copy=svg.cloneNode(true);copy.setAttribute('xmlns',svg.namespaceURI);copy.setAttribute('width','1000');copy.setAttribute('height',height);return new XMLSerializer().serializeToString(copy);}
 svgBtn.onclick=()=>download(serialized(),`${stem()}_${id}.svg`,'image/svg+xml');
 pngBtn.onclick=()=>{const url=URL.createObjectURL(new Blob([serialized()],{type:'image/svg+xml'})),img=new Image();img.onload=()=>{const c=document.createElement('canvas');c.width=4000;c.height=height*4;c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);c.toBlob(blob=>{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=`${stem()}_${id}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);});};img.onerror=()=>{URL.revokeObjectURL(url);show('PNG export failed; use SVG export.',true);};img.src=url;};
 host.append(legend,svg,actions);
}
function table(records){if(!records.length)return '<p>No records.</p>';const keys=Object.keys(records[0]);return '<table><thead><tr>'+keys.map(k=>`<th>${esc(k)}</th>`).join('')+'</tr></thead><tbody>'+records.map(r=>'<tr>'+keys.map(k=>`<td>${esc(r[k]??'—')}</td>`).join('')+'</tr>').join('')+'</tbody></table>';}
function refresh(){
 preview=null;if(!data)return;
 const o=opts();$('expStart').disabled=$('expEnd').disabled=o.method!=='mean';
 $('expAssumptions').textContent=o.method==='matched'?'Bias = in-situ − original satellite LST. Each accepted calibration pair corrects only its matched satellite observation. No interpolation, extrapolation or held-out correction.':'The arithmetic mean of accepted calibration-pair biases is added to existing satellite observations within the selected inclusive period. Assumes a constant lake-specific offset across this period; seasonal changes, skin/bulk and sampling-time differences may violate this assumption. Applying beyond calibration is an explicit extrapolation of the bias assumption, not a new observation.';
 if(!data.rows.length){$('expMatchStats').textContent='Load satellite data to match observations.';for(const id of ['expMatching','expPairs','expBias','expSeparation','expCorrected'])$(id).replaceChildren();return;}
 try{
 const rr=rows(),split=validationSplit(rr,70),cutoff=E.iso(rr[split.trainIdx.at(-1)].date),pairs=E.match(rr,data.obs,o.maxDays,cutoff,o.excluded),corrected=E.correct(rr,pairs,o);preview={rr,split,cutoff,pairs,corrected};
 const accepted=pairs.filter(p=>p.status==='accepted');
 $('expMatchStats').textContent=`Calibration through ${cutoff} · ${split.trainIdx.length} calibration / ${split.testIdx.length} held-out satellite observations · ${accepted.length} accepted pairs · ${pairs.filter(p=>p.status==='unmatched').length} unmatched · ${pairs.filter(p=>p.status==='excluded').length} excluded · ${pairs.filter(p=>p.status==='duplicate satellite match').length} duplicate matches · ${pairs.filter(p=>p.status==='withheld validation').length} withheld in-situ. ${accepted.length<3?'Insufficient pairs for reliable bias inference (<3); exploratory only.':''}`;
 const point=(d,y,tip,id)=>({x:+new Date(d),y,tip,id});
 const pairTip=p=>`${p.date}: in-situ ${p.insitu_temp_c} °C ↔ ${p.satellite_date}: satellite ${p.satellite_lst_c} °C; Δt ${p.delta_days} days; bias ${p.bias_c.toFixed(3)} °C; ${p.status}${p.tie?'; tie: earlier satellite chosen':''}`;
 const interactive=pairs.filter(p=>['accepted','excluded'].includes(p.status));
 chart('expMatching',`${lake} · satellite–in-situ matching`,[
 {name:'Satellite · calibration',color:colors[0],points:rr.filter(r=>E.iso(r.date)<=cutoff&&r.observed_lst_c!==null).map(r=>{const p=interactive.find(p=>p.satellite_date===E.iso(r.date));return point(r.date,r.observed_lst_c,p?pairTip(p):E.iso(r.date)+' satellite',p?.id);})},
 {name:'Satellite · held-out',color:'#819db5',hollow:true,points:rr.filter(r=>E.iso(r.date)>cutoff&&r.observed_lst_c!==null).map(r=>point(r.date,r.observed_lst_c,E.iso(r.date)+' held-out satellite'))},
 {name:'In-situ · calibration',color:colors[1],points:pairs.filter(p=>p.date<=cutoff&&p.status!=='excluded').map(p=>point(p.date,p.insitu_temp_c,p.satellite_date?pairTip(p):p.date+' '+p.status,p.status==='accepted'?p.id:null))},
 {name:'Excluded · click to restore',color:'#aaa',hollow:true,points:pairs.filter(p=>p.status==='excluded').map(p=>point(p.date,p.insitu_temp_c,pairTip(p),p.id))},
 {name:'In-situ · withheld',color:colors[3],hollow:true,points:pairs.filter(p=>p.date>cutoff).map(p=>point(p.date,p.insitu_temp_c,p.date+' reserved for independent validation'))}
 ],{cutoff:+new Date(cutoff),segments:interactive.map(p=>({id:p.id,tip:pairTip(p),x1:+new Date(p.date),y1:p.insitu_temp_c,x2:+new Date(p.satellite_date),y2:p.satellite_lst_c,color:p.status==='excluded'?'#aaa':'#759bad'}))});
 $('expPairs').innerHTML=table(pairs.map(p=>({in_situ_date:p.date,satellite_date:p.satellite_date,days:p.delta_days,bias_C:p.bias_c===null?'':p.bias_c.toFixed(4),tie:p.tie,status:p.status})));
 chart('expBias',`${lake} · calibration-pair bias by date`,[{name:'Accepted calibration pairs',color:colors[1],points:accepted.map(p=>point(p.date,p.bias_c,pairTip(p),p.id))}],{yLabel:'In-situ − satellite (°C)'});
 chart('expSeparation',`${lake} · bias and temporal separation`,[{name:'Accepted calibration pairs',color:colors[1],points:accepted.map(p=>({x:p.delta_days,y:p.bias_c,tip:pairTip(p),id:p.id}))}],{time:false,xLabel:'Absolute temporal separation (days)',yLabel:'In-situ − satellite (°C)'});
 chart('expCorrected',`${lake} · original and corrected satellite LST`,[
 {name:'Original satellite',color:colors[0],points:rr.filter(r=>r.observed_lst_c!==null).map(r=>point(r.date,r.observed_lst_c,E.iso(r.date)+' original'))},
 {name:o.enabled?'Corrected satellite':'Correction disabled',color:colors[2],hollow:true,points:corrected.filter(r=>r.corrected_lst_c!==null).map(r=>point(r.date,r.corrected_lst_c,`${E.iso(r.date)} · ${r.correction_status} · applied bias ${r.applied_bias_c.toFixed(3)} °C`))}
 ],{cutoff:+new Date(cutoff)});
 }catch(e){show(e.message,true);}
}
function metricRows(r){return r.output.filter(m=>!m.skipped).flatMap(m=>[['Calibration subset · common original satellite',m.calibration],['Chronological held-out · common original satellite',m.validation],['Calibration subset · own fitted target (not comparable accuracy)',m.fitted_target_calibration],['Independent withheld in-situ · exact daily dates',m.independent_insitu]].map(([evaluation,s])=>({lake_name:lake,experiment:m.id,evaluation,n:s.n,rmse_c:s.rmse,mae_c:s.mae,pearson_r:s.r,r_squared:s.r2,calibration_count:m.calibration_count,validation_count:m.validation_count,beta0:m.fit.beta0,betaT:m.fit.betaT,betaS:m.fit.betaS,betaU:m.fit.betaU,tau_days:m.fit.tau,M:m.fit.M,accepted_pairs:r.pairs.filter(p=>p.status==='accepted').length,mean_pair_delta_days:r.pairs.filter(p=>p.status==='accepted').reduce((v,p)=>v+p.delta_days,0)/(r.pairs.filter(p=>p.status==='accepted').length||1),calibration_end:r.cutoff,bias_method:r.options.method,bias_enabled:r.options.enabled,bias_period_start:r.options.start,bias_period_end:r.options.end,matching_max_days:r.options.maxDays})));}
function renderResults(r){
 const host=$('expResults');host.innerHTML='<h3>Four-model results</h3><p>A · Original memory | B · Original M=0 | C · Corrected memory | D · Corrected M=0</p>';
 const note=document.createElement('p');note.className='helper';note.textContent=`Parameters fitted only to the earlier ${r.split.trainIdx.length} observations; the first anchor is excluded from calibration residuals for every experiment. No all-observation fit is reported here. ${r.independent.length} withheld in-situ dates have daily predictors; ${r.unavailable_insitu} fall outside the forcing grid and are not interpolated. ${r.independent.length<3?'Independent in-situ validation is insufficient (<3); no robust improvement conclusion.':''}`;host.append(note);
 r.output.filter(m=>m.skipped).forEach(m=>{const p=document.createElement('p');p.textContent=`${m.id} skipped: ${m.skipped}`;host.append(p);});
 const t=document.createElement('div');t.className='exp-table';t.innerHTML=table(metricRows(r).map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='number'?Number(v.toFixed(5)):v]))));host.append(t);
 const models=r.output.filter(m=>!m.skipped),rr=rows(), predRows=[];
 for(const m of models){const id='expModel'+m.id,div=document.createElement('div');div.id=id;div.className='exp-plot';host.append(div);
 chart(id,`${lake} · ${m.id} observed versus predicted`,[
 {name:'Calibration subset · original satellite',color:colors[0],points:r.split.trainIdx.slice(1).map(i=>({x:rr[i].observed_lst_c,y:m.fit.freeRun[i],tip:E.iso(rr[i].date)+' calibration'}))},
 {name:'Chronological held-out · original satellite',color:colors[1],hollow:true,points:r.split.testIdx.map(i=>({x:rr[i].observed_lst_c,y:m.fit.freeRun[i],tip:E.iso(rr[i].date)+' held-out'}))},
 {name:'Independent withheld in-situ',color:colors[3],hollow:true,points:r.independent.map(o=>({x:o.insitu_temp_c,y:m.fit.freeRun[o.index],tip:o.date+' independent in-situ'}))}
 ],{time:false,xLabel:'Reference temperature (°C)',yLabel:'Predicted temperature (°C)',reference:true});}
 for(const phase of ['calibration','validation']){const id='expResidual'+phase,div=document.createElement('div');div.id=id;div.className='exp-plot';host.append(div);const indices=phase==='calibration'?r.split.trainIdx.slice(1):r.split.testIdx;
 chart(id,`${lake} · ${phase==='calibration'?'calibration subset':'chronological held-out'} residual distribution`,models.map((m,j)=>{const residuals=indices.map(i=>m.fit.freeRun[i]-rr[i].observed_lst_c).sort((a,b)=>a-b);return {name:m.id+' · '+phase,color:colors[j],line:true,points:residuals.map((v,i)=>({x:v,y:(i+1)/residuals.length,tip:`${m.id}: residual ${v.toFixed(3)} °C; ECDF ${((i+1)/residuals.length).toFixed(3)}`}))};}),{time:false,xLabel:'Prediction − original satellite (°C)',yLabel:'Empirical cumulative probability'});}
 for(const metric of ['rmse','mae']){const id='expMetric'+metric,div=document.createElement('div');div.id=id;div.className='exp-plot';host.append(div);
 chart(id,`${lake} · ${metric.toUpperCase()} comparison (1=A, 2=B, 3=C, 4=D)`,['calibration','validation'].map((phase,j)=>({name:phase==='calibration'?'Calibration subset':'Chronological held-out',color:colors[j],line:true,points:models.map(m=>({x:m.id.charCodeAt(0)-64,y:m[phase][metric],tip:`${m.id} ${phase}: ${m[phase][metric].toFixed(4)} °C`}))})),{time:false,xLabel:'Experiment',yLabel:metric.toUpperCase()+' (°C)'});}
 const improvements=[];for(const [from,to,label]of [['B','A','Memory contribution · original'],['D','C','Memory contribution · corrected'],['A','C','Bias adjustment · memory'],['B','D','Bias adjustment · no memory']]){const a=models.find(m=>m.id===from),b=models.find(m=>m.id===to);if(a&&b)for(const phase of ['calibration','validation','independent_insitu']){const x=a[phase],y=b[phase];improvements.push({comparison:label,reference:phase,rmse_reduction_C:x.n&&y.n?x.rmse-y.rmse:null,mae_reduction_C:x.n&&y.n?x.mae-y.mae:null});}}
 const imp=document.createElement('div');imp.className='exp-table';imp.innerHTML='<h4>Lake-specific error reductions</h4><p>Positive values mean lower error for the second model; satellite-reference improvements are not proof of improved in-situ accuracy.</p>'+table(improvements.map(r=>({...r,rmse_reduction_C:r.rmse_reduction_C?.toFixed(4),mae_reduction_C:r.mae_reduction_C?.toFixed(4)})));host.append(imp);
 const improvementPlot=document.createElement('div');improvementPlot.id='expImprovement';improvementPlot.className='exp-plot';host.append(improvementPlot);
 chart('expImprovement',`${lake} · held-out error reduction`,['rmse_reduction_C','mae_reduction_C'].map((metric,j)=>({name:j?'MAE reduction':'RMSE reduction',color:colors[j],points:improvements.filter(v=>v.reference==='validation').map((v,i)=>({x:i+1,y:v[metric],tip:v.comparison+': '+v[metric]?.toFixed(4)+' °C'}))})),{time:false,xLabel:'1: B−A · 2: D−C · 3: A−C · 4: B−D',yLabel:'Error reduction (°C)'});
 $('expExport').disabled=false;
}
$('expRun').onclick=safe(async()=>{
 if(!data.rows.length)throw Error('Load satellite and predictor data first.');if(dirty())throw Error('Save observations before running comparisons.');
 const options=opts();if(!preview)throw Error('Resolve input or matching errors first.');
 busy=true;$('expWorkspace').disabled=true;$('expLake').disabled=true;$('expAddLake').disabled=true;invalidate();
 try{result=await E.run(rows(),structuredClone(data.saved),options,msg=>show(msg));renderResults(result);show('Comparison complete. All four experiments use the same calibration and held-out dates; corrected models are skipped if correction is disabled.');}
 finally{busy=false;$('expWorkspace').disabled=false;$('expLake').disabled=false;$('expAddLake').disabled=false;renderInput();}
});
$('expExport').onclick=safe(()=>{if(!result)throw Error('Run the comparison first.');download(toCSV(metricRows(result)),`${stem()}_experiment_metrics_parameters.csv`);const rr=rows();download(toCSV(result.output.filter(m=>!m.skipped).flatMap(m=>rr.map((r,i)=>({lake_name:lake,experiment:m.id,date:E.iso(r.date),original_lst_c:r.observed_lst_c,corrected_lst_c:result.corrected[i].corrected_lst_c,predicted_lst_c:m.fit.freeRun[i],partition:result.split.trainIdx.includes(i)?(i===result.split.trainIdx[0]?'calibration anchor (excluded from metrics)':'calibration'):result.split.testIdx.includes(i)?'chronological held-out':'no satellite observation',insitu_independent_c:result.independent.find(o=>o.index===i)?.insitu_temp_c??''})))),`${stem()}_experiment_predictions.csv`);download(JSON.stringify({lake_name:lake,cutoff:result.cutoff,options:result.options,source:data.source,saved_at:data.savedAt,metrics:metricRows(result)},null,2),`${stem()}_experiment_provenance.json`,'application/json');});
$('expExportPairs').onclick=safe(()=>{if(!preview)throw Error('Load data and resolve matching settings first.');download(toCSV(preview.pairs),`${stem()}_matching_audit.csv`);download(toCSV(preview.corrected.map(r=>({...r,lake_name:lake,date:E.iso(r.date)}))),`${stem()}_original_corrected.csv`);});
populate();
window.__restExperimentUI={selectLake(name){lake=name;db.lakes[name]??=newLake();populate();select();},getData:()=>data,getResult:()=>result,getPreview:()=>preview,refresh};
})();
