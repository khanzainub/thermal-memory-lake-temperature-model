"use strict";
window.RestCompare=(()=>{
 const $=id=>document.getElementById(id),frames=[$("frameMemory"),$("frameBaseline")],ready=new Map();
 const status=(s,t="neutral")=>{$("sharedStatus").textContent=s;$("sharedStatus").className="status-box status-box--"+t};
 function resize(frame){try{const doc=frame.contentDocument;if(doc){frame.style.height=Math.max(500,doc.body.scrollHeight,doc.documentElement.scrollHeight)+"px"}}catch(e){}}
 frames.forEach(frame=>ready.set(frame,new Promise(resolve=>frame.addEventListener("load",()=>{
   try{const doc=frame.contentDocument,style=doc.createElement("style");style.textContent=".hero,.lake-data-panel,footer{display:none!important}.container{max-width:100%!important;padding-top:0!important}.page-shell{min-height:0!important}html,body{overflow-x:hidden!important}";doc.head.append(style);
   const observer=new frame.contentWindow.ResizeObserver(()=>resize(frame));observer.observe(doc.body);}catch(e){}
   resize(frame);resolve();
 },{once:true}))));
 async function loadBoth(csv,name,frequency="Daily"){
  if(typeof csv!=="string"||csv.length>15000000)throw Error("CSV must be at most 15 MB");
  if(!["Daily","Monthly","Yearly"].includes(frequency))throw Error("Unsupported temporal resolution");
  await Promise.all([...ready.values()]);
  if(frames.some(f=>f.contentWindow.__thermalMemoryApp.getState().fit)&&!confirm("Replace the dataset and clear fitted results in both models?"))return false;
  // A previously saved historical in-situ bias may be applied automatically
  // when the selected lake can be unambiguously identified from an ORIGINAL CSV filename.
  // Corrected files are explicitly excluded to prevent double correction.
  let biasNote="";
  try{
    if(!/corrected|calibrated/i.test(name)){
      const stored=JSON.parse(localStorage.getItem("restlake:insitu-calibration:2026-10-26:v1")||"{}");
      const normalize=x=>String(x).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
      const source=normalize(name);
      const eligible=Object.entries(stored.lakes||{}).filter(([lake,data])=>{
        const slug=normalize(lake);
        return slug && (source===slug||source.startsWith(slug+"_")) &&
          Number.isFinite(data?.calibration?.bias_c) && data.calibration.version===2;
      }).sort((a,b)=>b[0].length-a[0].length);
      if(eligible.length&&frequency==="Daily"){
        const [selected,record]=eligible[0],originalCSV=ReSTInSituCore.satelliteCSV(csv);
        if(!originalCSV.length)throw Error("Cannot apply saved lake calibration to an empty satellite CSV.");
        csv=ReSTInSituCore.modelInputCSV(ReSTInSituCore.applySavedBias(originalCSV,record.calibration.bias_c));
        biasNote=" Saved "+selected+" in-situ bias ("+record.calibration.bias_c.toFixed(3)+" °C) automatically applied to satellite LST before model input.";
        name=name.replace(/\.csv$/i,"")+"_bias_corrected.csv";
      }
    }
  }catch(e){throw Error("Saved in-situ bias could not be applied safely: "+e.message)}
  for(const frame of frames){
   const w=frame.contentWindow,radio=w.document.querySelector('input[name="frequency"][value="'+frequency+'"]');
   if(!radio)throw Error("Missing temporal mode");radio.checked=true;radio.dispatchEvent(new w.Event("change",{bubbles:true}));
   await w.__thermalMemoryApp.loadTextDataset(csv,name);
   if(!w.__thermalMemoryApp.getState().rows)throw Error("Dataset rejected in "+frame.title);
   resize(frame);
  }
  $("sharedFile").textContent=name+" · "+frequency;
  status("Same "+frequency.toLowerCase()+" CSV loaded in both tabs."+biasNote+" Run calibration and independent validation in each tab.","success");
  return true;
 }
 function activate(mode){
  const mem=mode==="memory";$("memoryPane").hidden=!mem;$("baselinePane").hidden=mem;
  $("tabMemory").classList.toggle("cmp-active",mem);$("tabBaseline").classList.toggle("cmp-active",!mem);
  $("tabMemory").setAttribute("aria-selected",String(mem));$("tabBaseline").setAttribute("aria-selected",String(!mem));
  $("modeNote").textContent=mem?"Unchanged original ReST-Lake. Temporal memory is estimated.":"True no-memory baseline: M = 0, τ not estimated, no dependence on previous modeled LST.";
  resize(mem?frames[0]:frames[1]);
 }
 $("tabMemory").onclick=()=>activate("memory");$("tabBaseline").onclick=()=>activate("baseline");
 $("sharedCsv").onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{const csv=await file.text(),header=csv.replace(/^\uFEFF/,"").split(/\r?\n/,1)[0].trim();
   if(header!=="date,air_temp_c,shortwave_w_m2,wind_speed_m_s,observed_lst_c")throw Error("Upload the original ReST-Lake 5-column CSV");
   await loadBoth(csv,file.name,"Daily");
  }catch(err){status(err.message||String(err),"danger")}finally{e.target.value=""}
 };
 return {loadBoth,activate,scrollToTabs:()=>$("compareModels").scrollIntoView({behavior:"smooth"})};
})();
