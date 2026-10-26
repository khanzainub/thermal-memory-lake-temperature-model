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
function chooseBias(filename,frameIndex) {
 if(!checkboxes[frameIndex].checked||alreadyCorrected(filename))return null;
 const available=savedBiases();
 if(!available.length)throw Error("No saved in-situ bias yet. Calculate and save it in In-Situ Calibration.");
 const selected=localStorage.getItem(ACTIVE);
 const record=available.find(x=>x.lake===selected);
 const stem=normalize(String(filename).replace(/\.csv$/i,""));
 const named=available.filter(c=>stem===normalize(c.lake)||stem.startsWith(normalize(c.lake)+"_"))
  .sort((a,b)=>normalize(b.lake).length-normalize(a.lake).length);
 const chosen=named[0]||record;
 if(!chosen)throw Error("Select the correct lake in In-Situ Calibration before applying its saved bias.");
 if(named.length && record && named[0].lake!==record.lake)
   throw Error("The uploaded CSV names "+named[0].lake+" but the active calibration belongs to "+record.lake+". Select the right lake.");
 if(!named.length&&!confirm("Apply saved "+chosen.lake+" bias ("+chosen.bias.toFixed(3)+" °C) to original file '"+filename+"'?"))
   throw Error("Bias correction was cancelled; uncheck the box to upload without correction.");
 return chosen;
}
function refreshBiasInfo(){
 const saved=savedBiases(),active=localStorage.getItem(ACTIVE),value=saved.find(x=>x.lake===active);
 for(let i=0;i<2;i++){
  const info=$([ "memoryBiasInfo","baselineBiasInfo"][i]);
  info.textContent=value?
   "Saved "+value.lake+" bias: "+value.bias.toFixed(3)+" °C. Checked = apply to the NEXT original satellite CSV upload; unchecked = leave unchanged.":
   "No active saved lake bias. Save a calibration value in the In-Situ Calibration tab first; unchecked leaves satellite data unchanged.";
 }
}
const checkboxes=[$("applyMemoryBias"),$("applyBaselineBias")];
checkboxes.forEach(c=>c.addEventListener("change",refreshBiasInfo));
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
   if(!checkboxes[frames.indexOf(frame)].checked)return false; // OFF: unchanged native uploader.
   if(alreadyCorrected(file.name))return false; // Pre-corrected CSV: original loader, no double correction.
   event.preventDefault();event.stopImmediatePropagation();
   try{
     const choice=chooseBias(file.name,frames.indexOf(frame));
     if(!choice){note(frame,"The input is already bias-corrected. Do not apply the offset twice.",application,"warning");return true;}
     void handleFile(frame,file,choice,application);
   }catch(e){note(frame,e.message,application,"danger");}
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
 for(const frame of frames){
  const frameIndex=frames.indexOf(frame),chosen=chooseBias(name,frameIndex),input=corrected(csv,name,chosen);
  const win=frame.contentWindow,radio=win.document.querySelector('input[name="frequency"][value="'+frequency+'"]');
  if(!radio)throw Error("Missing "+frequency+" mode in the original model.");
  radio.checked=true;radio.dispatchEvent(new win.Event("change",{bubbles:true}));
  await win.__thermalMemoryApp.loadTextDataset(input.csv,input.name);
  if(!win.__thermalMemoryApp.getState().rows)throw Error("Original model rejected "+input.name);
  if(chosen)note(frame, "Saved "+chosen.lake+" bias ("+chosen.bias.toFixed(3)+" °C) applied to existing satellite LST observations.");
  resize(frame);
 }
 refreshBiasInfo();
 return true;
}
function activate(mode){
 const memory=mode==="memory";
 $("memoryPane").hidden=!memory;$("baselinePane").hidden=memory;
 $("tabMemory").classList.toggle("cmp-active",memory);$("tabBaseline").classList.toggle("cmp-active",!memory);
 $("tabMemory").setAttribute("aria-selected",String(memory));$("tabBaseline").setAttribute("aria-selected",String(!memory));
 refreshBiasInfo();
 $("modeNote").textContent=memory?"Unchanged With-Memory ReST-Lake model. Its existing CSV upload is below.":"Unchanged Zero-Memory Baseline (M = 0). Its existing CSV upload is below.";
 resize(memory?frames[0]:frames[1]);
}
$("tabMemory").onclick=()=>activate("memory");
$("tabBaseline").onclick=()=>activate("baseline");
refreshBiasInfo();
return {loadBoth,activate,refreshBiasInfo,scrollToTabs:()=>$("compareModels").scrollIntoView({behavior:"smooth"})};
})();
