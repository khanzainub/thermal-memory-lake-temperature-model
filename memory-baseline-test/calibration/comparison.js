"use strict";
/* Parent is only an orchestration layer. Original model files, equations,
 * optimizer, validation and original CSV input controls remain untouched. */
window.RestCompare=(()=>{
const $=id=>document.getElementById(id);
const frames=[$("frameMemory"),$("frameBaseline")],ready=new Map();
const STORE="restlake:insitu-calibration:2026-10-26:v1";
const ACTIVE="restlake:insitu-active-lake:v1";
const normalize=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
const alreadyCorrected=name=>/(?:^|[_ .-])(?:bias[_ -]?)?(?:corrected|calibrated)(?:[_ .-]|$)/i.test(name);
function savedBiases(){
 try {
  const raw=JSON.parse(localStorage.getItem(STORE)||"{}");
  return Object.entries(raw.lakes||{}).filter(([lake,d])=>lake.trim()&&
    d&&d.calibration?.version===2&&Number.isFinite(d.calibration.bias_c))
    .map(([lake,d])=>({lake,bias:d.calibration.bias_c}));
 }catch(e){return []}
}
function chooseBias(filename) {
 if(alreadyCorrected(filename))return null; // Never apply a stored offset twice.
 const available=savedBiases();
 if(!available.length)return null;
 const stem=normalize(String(filename).replace(/\.csv$/i,""));
 const named=available.filter(c=>stem===normalize(c.lake)||stem.startsWith(normalize(c.lake)+"_"));
 named.sort((a,b)=>normalize(b.lake).length-normalize(a.lake).length);
 if(named.length)return named[0]; // Explicit lake name in source filename.
 const selected=localStorage.getItem(ACTIVE);
 const candidate=available.find(c=>c.lake===selected) || (available.length===1?available[0]:null);
 if(candidate && confirm('Apply saved in-situ bias '+candidate.bias.toFixed(3)+' °C for '+candidate.lake+' to this original satellite CSV ("'+filename+'")?'))return candidate;
 return null; // No guessed lake assignment.
}
function corrected(text,name,choice){
 if(!choice)return {csv:text,name,applied:null};
 const originals=ReSTInSituCore.satelliteCSV(text);
 if(!originals.length)throw Error("The satellite input CSV is empty.");
 const converted=ReSTInSituCore.applySavedBias(originals,choice.bias);
 return {csv:ReSTInSituCore.modelInputCSV(converted),
   name:String(name).replace(/\.csv$/i,"")+"_bias_corrected.csv",applied:choice};
}
function note(frame,msg,application=false,level="success"){
 const d=frame.contentDocument,id=application?"applicationStatusBox":"statusBox";
 const status=d?.getElementById(id);
 if(status){status.className="status-box status-box--"+level;status.textContent=msg;}
}
function resize(frame){try{const d=frame.contentDocument;if(d)frame.style.height=Math.max(500,d.documentElement.scrollHeight,d.body.scrollHeight)+"px"}catch(e){}}
async function handleFile(frame,file,choice,application=false){
 try{
  if(file.size>15000000)throw Error("Input file exceeds 15 MB.");
  const converted=corrected(await file.text(),file.name,choice);
  const api=frame.contentWindow.__thermalMemoryApp;
  if(!api)throw Error("The original model has not initialized.");
  if(application)await api.loadApplicationDataset(converted.csv,converted.name);
  else await api.loadTextDataset(converted.csv,converted.name);
  const result=api.getState();
  if((application&&!result.applicationRows)||(!application&&!result.rows))
    throw Error("Original model rejected the corrected CSV; see its input requirements.");
  note(frame,"Saved "+choice.lake+" in-situ bias "+choice.bias.toFixed(3)+" °C was applied to satellite LST. Original observations remain unchanged; the model will use corrected values.",application);
  resize(frame);
 }catch(e){note(frame,"Bias correction failed: "+(e.message||e),application,"danger");}
}
function interceptUploads(frame){
 const d=frame.contentDocument;if(!d||!frame.contentWindow.__thermalMemoryApp)return;
 const decide=(file,application,event)=>{
   if(!file)return false;
   const choice=chooseBias(file.name);
   if(!choice)return false; // No bias: original uploader operates as before.
   event.preventDefault();event.stopImmediatePropagation();
   void handleFile(frame,file,choice,application);
   return true;
 };
 d.addEventListener("change",e=>{
   const id=e.target?.id;
   if(id==="csvFile"||id==="applicationCsvFile")
    decide(e.target.files?.[0],id==="applicationCsvFile",e);
 },true);
 d.addEventListener("drop",e=>{
   const host=e.target?.closest?.("#dropZone,#applicationDropZone");
   if(host)decide(e.dataTransfer?.files?.[0],host.id==="applicationDropZone",e);
 },true);
}
frames.forEach(frame=>{
 ready.set(frame,new Promise(resolve=>{
  frame.addEventListener("load",()=>{
   try{
    const d=frame.contentDocument;
    if(d){
     const style=d.createElement("style");
     style.textContent=".hero,.lake-data-panel,footer{display:none!important}.container{max-width:100%!important;padding-top:0!important}.page-shell{min-height:0!important}html,body{overflow-x:hidden!important}";
     d.head.append(style);
     const observer=new frame.contentWindow.ResizeObserver(()=>resize(frame));observer.observe(d.body);
     interceptUploads(frame);
    }
   }catch(e){}
   resize(frame);resolve();
  },{once:true});
 }));
});
async function loadBoth(csv,name,frequency="Daily"){
 if(typeof csv!=="string"||csv.length>15000000)throw Error("CSV must be at most 15 MB");
 if(!["Daily","Monthly","Yearly"].includes(frequency))throw Error("Unsupported temporal resolution");
 await Promise.all([...ready.values()]);
 if(frames.some(f=>f.contentWindow.__thermalMemoryApp?.getState().fit)&&
   !confirm("Replace an existing fitted dataset in both models?"))return false;
 const chosen=chooseBias(name),input=corrected(csv,name,chosen);
 for(const frame of frames){
  const win=frame.contentWindow,radio=win.document.querySelector('input[name="frequency"][value="'+frequency+'"]');
  if(!radio)throw Error("Missing "+frequency+" mode in the original model.");
  radio.checked=true;radio.dispatchEvent(new win.Event("change",{bubbles:true}));
  await win.__thermalMemoryApp.loadTextDataset(input.csv,input.name);
  if(!win.__thermalMemoryApp.getState().rows)throw Error("Original model rejected "+input.name);
  if(chosen)note(frame, "Saved "+chosen.lake+" bias ("+chosen.bias.toFixed(3)+" °C) applied to existing satellite LST observations.");
  resize(frame);
 }
 if(chosen)$("modeNote").textContent="Saved "+chosen.lake+" in-situ correction of "+chosen.bias.toFixed(3)+" °C was applied to model input. Both model equations are unchanged.";
 return true;
}
function activate(mode){
 const memory=mode==="memory";
 $("memoryPane").hidden=!memory;$("baselinePane").hidden=memory;
 $("tabMemory").classList.toggle("cmp-active",memory);$("tabBaseline").classList.toggle("cmp-active",!memory);
 $("tabMemory").setAttribute("aria-selected",String(memory));$("tabBaseline").setAttribute("aria-selected",String(!memory));
 $("modeNote").textContent=memory?"Unchanged With-Memory ReST-Lake model. Its existing CSV upload is below.":"Unchanged Zero-Memory Baseline (M = 0). Its existing CSV upload is below.";
 resize(memory?frames[0]:frames[1]);
}
$("tabMemory").onclick=()=>activate("memory");
$("tabBaseline").onclick=()=>activate("baseline");
return {loadBoth,activate,scrollToTabs:()=>$("compareModels").scrollIntoView({behavior:"smooth"})};
})();
