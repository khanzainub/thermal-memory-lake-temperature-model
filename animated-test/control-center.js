/* ReST–Lake / Animated Test v2. Experimental presentation only. */
(function () {
  "use strict";
  const P="restlake-animated-v2";
  const parent=window.parent===window;
  const scope=location.pathname.includes("/in-situ/")?"In-Situ":location.pathname.includes("/baseline/")?"Baseline":location.pathname.includes("/with-memory/")?"With Memory":"Control Center";
  document.body.classList.add("animated-theme",parent?"animated-parent":"animated-inner","command-v2");
  const statuses={data:{kind:"idle",text:"Awaiting dataset"},engine:{kind:"idle",text:"Ready to calibrate"},mode:{kind:"done",text:"With Memory"}};
  const chips={},MAX=150;
  const strip=text=>String(text||"").replace(/\s+/g," ").trim().slice(0,MAX);
  const byId=id=>document.getElementById(id);
  let recent="",logs=null,activePane="memoryPane";
  function announce(channel,kind,description,fromChild=false){
    if(!statuses[channel])return;
    const message=strip(description)||"Standby";
    const prior=statuses[channel],changed=prior.kind!==kind||prior.text!==message;
    if(!changed)return;
    statuses[channel]={kind,text:message};
    if(parent){
      const el=chips[channel];if(el){
        el.className="command-chip state-"+kind;el.querySelector(".command-chip-value").textContent=message;
      }
      document.body.classList.toggle("command-active",statuses.data.kind==="busy"||statuses.engine.kind==="busy");
      if(logs && channel!=="mode" && (kind==="busy"||kind==="error"||kind==="done")){
        const key=channel+"/"+kind+"/"+message;
        if(recent!==key){
          recent=key;
          const li=document.createElement("li"),stamp=document.createElement("time");
          const now=new Date();stamp.textContent=now.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
          const t=document.createElement("span");t.textContent=(channel==="data"?"DATA · ":"MODEL · ")+message;
          li.className="log-"+kind;li.append(stamp,t);logs.prepend(li);
          while(logs.children.length>5)logs.lastElementChild.remove();
        }
      }
    }else{
      const mark=byId("command-inner-indicator");
      if(mark && channel!=="mode"){mark.textContent=message;mark.dataset.state=kind}
      document.body.classList.toggle("command-active",statuses.data.kind==="busy"||statuses.engine.kind==="busy");
      if(!fromChild)window.parent.postMessage({source:P,type:"activity",scope,channel,kind,text:message},location.origin);
    }
  }
  function selectMode(){
    const tab=document.querySelector('.cmp-tabs [aria-selected="true"]');
    if(!tab)return;
    const label=tab.textContent.replace(/\s*·\s*/g," / ").trim();
    announce("mode","done",label);
    activePane=tab.id==="tabInSitu"?"inSituPane":tab.id==="tabBaseline"?"baselinePane":"memoryPane";
    const selected=tab.id;
    document.querySelectorAll("[data-activate]").forEach(b=>{
      const active=b.dataset.activate===selected;
      b.classList.toggle("selected",active);
      b.setAttribute("aria-current",active?"page":"false");
    });
    const docFrame=byId(activePane)?.querySelector("iframe");
    if(docFrame?.contentWindow){
      docFrame.contentWindow.postMessage({source:P,type:"snapshot"},location.origin);
    }
  }
  function navigate(id){
    if(id==="sharedModelDownload"){
      const details=byId("lakeDataDetails");if(details)details.open=true;
      byId("sharedModelDownload")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});
    } else{
      byId(id)?.click();
      byId("compareModels")?.scrollIntoView({behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth",block:"start"});
    }
  }
  if(parent){
    const main=document.querySelector("main.container");
    if(main){
      const nav=document.createElement("aside");nav.className="command-sidebar";nav.setAttribute("aria-label","Research navigation");
      nav.innerHTML='<div class="command-sidebar-title"><span class="command-mark">R</span><span><b>ReST–Lake</b><small>RESEARCH CONSOLE</small></span></div>'+
        '<div class="command-label">WORKSPACE</div>'+
        '<nav class="command-links" aria-label="Research modules">'+
        '<button type="button" data-activate="sharedModelDownload"><span class="command-nav-icon">▦</span>Data acquisition</button>'+
        '<button type="button" data-activate="tabMemory"><span class="command-nav-icon">◉</span>With Memory</button>'+
        '<button type="button" data-activate="tabBaseline"><span class="command-nav-icon">◎</span>Zero-Memory Baseline</button>'+
        '<button type="button" data-activate="tabInSitu"><span class="command-nav-icon">◇</span>In-Situ Calibration</button></nav>'+
        '<div class="command-aside-footer"><span class="command-aside-dot"></span> EXPERIMENTAL DESIGN<br><small>Original scientific calculations retained</small></div>';
      main.insertBefore(nav,main.firstChild);
      nav.querySelectorAll("[data-activate]").forEach(btn=>btn.addEventListener("click",()=>navigate(btn.dataset.activate)));
      const dash=document.createElement("section");dash.className="command-dashboard";dash.setAttribute("aria-label","Processing status");
      dash.innerHTML='<div class="command-heading"><div><div class="command-super">SCIENTIFIC WORKSPACE / EXPERIMENTAL UI</div><h2>Thermal Response <em>Control Center</em></h2><p>Satellite observations · Model calibration · Independent validation</p></div>'+
        '<div class="command-heading-actions"><span class="command-system"><span class="command-system-light"></span> INTERFACE ONLINE</span><button class="command-motion" type="button" aria-pressed="false">Pause motion</button></div></div>'+
        '<div class="command-chip-grid">'+
        '<div class="command-chip state-idle" id="command-data"><span class="command-led"></span><span><small>DATA PIPELINE</small><b class="command-chip-value">Awaiting dataset</b></span></div>'+
        '<div class="command-chip state-idle" id="command-engine"><span class="command-led"></span><span><small>MODEL ENGINE</small><b class="command-chip-value">Ready to calibrate</b></span></div>'+
        '<div class="command-chip state-done" id="command-mode"><span class="command-led"></span><span><small>ACTIVE MODULE</small><b class="command-chip-value">With Memory</b></span></div></div>'+
        '<div class="command-terminal"><span class="command-terminal-label">ACTIVITY SIGNALS</span><ol class="command-events" aria-label="Recent UI events"></ol></div>';
      const first=main.querySelector(":scope > section");
      main.insertBefore(dash,first||null);
      logs=dash.querySelector(".command-events");
      for(const c of ["data","engine","mode"])chips[c]=byId("command-"+c);
      const motion=dash.querySelector(".command-motion");
      motion.addEventListener("click",()=>{
        const paused=document.body.classList.toggle("motion-paused");
        motion.textContent=paused?"Resume motion":"Pause motion";
        motion.setAttribute("aria-pressed",String(paused));
        document.querySelectorAll("iframe").forEach(f=>f.contentWindow?.postMessage({source:P,type:"motion",paused},location.origin));
      });
    }
    document.querySelectorAll(".cmp-tabs button").forEach(b=>b.addEventListener("click",()=>{
      requestAnimationFrame(()=>{
        selectMode();
        announce("data","idle","Awaiting module data");
        announce("engine","idle","Awaiting process");
      });
    }));
    selectMode();
    window.addEventListener("message",e=>{
      if(e.origin!==location.origin||!e.data||e.data.source!==P)return;
      const f=Array.from(document.querySelectorAll("iframe")).find(f=>f.contentWindow===e.source);
      if(!f)return;
      if(e.data.type==="height" && Number.isFinite(e.data.height)){
        const h=Math.min(24000,Math.max(620,Math.ceil(e.data.height)+8));
        if(Math.abs((parseFloat(f.style.height)||0)-h)>18)f.style.height=h+"px";
        return;
      }
      if(e.data.type==="activity" && f.closest("[role=tabpanel]")?.id===activePane){
        announce(e.data.channel,e.data.kind,e.data.text,true);
      }
    });
  }else{
    const main=document.querySelector("main");
    if(main){
      const toolbar=document.createElement("div");toolbar.className="command-module-bar";
      toolbar.innerHTML='<span class="command-module-tag"><span class="command-module-led"></span>'+scope.toUpperCase()+'</span><span class="command-module-status" id="command-inner-indicator" data-state="idle">Ready for input</span>'+
       '<button type="button" class="command-motion" aria-pressed="false">Pause motion</button>';
      main.insertBefore(toolbar,main.firstChild);
      const button=toolbar.querySelector("button");
      button.addEventListener("click",()=>{
        const paused=document.body.classList.toggle("motion-paused");
        button.textContent=paused?"Resume motion":"Pause motion";button.setAttribute("aria-pressed",String(paused));
      });
    }
    // Observe content height only; avoid a circular iframe height/100vh feedback loop.
    let lastHeight=0,queued=false;
    function reportHeight(){
      if(queued)return;queued=true;
      requestAnimationFrame(()=>{
        queued=false;
        const h=Math.max(document.querySelector("main")?.scrollHeight||0,document.querySelector(".page-shell")?.scrollHeight||0);
        if(h>0 && Math.abs(h-lastHeight)>14){lastHeight=h;window.parent.postMessage({source:P,type:"height",height:h},location.origin)}
      });
    }
    if(window.ResizeObserver && main)new ResizeObserver(reportHeight).observe(main);
    window.addEventListener("load",reportHeight);
    window.addEventListener("resize",reportHeight);
    reportHeight();
    window.addEventListener("message",e=>{
      if(e.origin!==location.origin||e.source!==window.parent||e.data?.source!==P)return;
      if(e.data.type==="snapshot"){
        ["data","engine"].forEach(c=>window.parent.postMessage({source:P,type:"activity",scope,channel:c,kind:statuses[c].kind,text:statuses[c].text},location.origin));
        reportHeight();
      }
      if(e.data.type==="motion"){
        document.body.classList.toggle("motion-paused",Boolean(e.data.paused));
        const b=document.querySelector(".command-module-bar .command-motion");
        if(b){b.textContent=e.data.paused?"Resume motion":"Pause motion";b.setAttribute("aria-pressed",String(!!e.data.paused))}
      }
    });
  }

  // Bind to real events and messages emitted by the existing model scripts.
  const ops={
    runBtn:["engine","Calibrating lake model"],runValidationBtn:["engine","Running independent validation"],
    buildFinalBtn:["engine","Building final model"],runApplicationBtn:["engine","Running reconstruction / prediction"],
    matchDates:["engine","Matching in-situ observations"],applyBias:["engine","Computing additive bias"],
    saveResults:["engine","Saving calibrated bias"],
    prepareLakeNotebook:["data","Preparing Colab notebook"]
  };
  document.addEventListener("click",e=>{
    const btn=e.target.closest("button");if(!btn||btn.disabled)return;
    const task=ops[btn.id];if(task)announce(task[0],"busy",task[1]);
  },true);
  document.addEventListener("change",e=>{
    const t=e.target;
    if(t?.matches('input[type="file"]')&&t.files?.length){
      announce("data","busy","Reading selected "+(t.files.length===1?"file":"files"));
    }
  },true);
  const sources=[
    ["lakeDataStatus","data"],["statusBox","data"],["applicationStatusBox","data"],
    ["obsStatus","data"],["futureStatus","data"],["matchStatus","engine"],
    ["calStatus","engine"],["runMessage","engine"],["validationRunMessage","engine"],
    ["finalRunMessage","engine"],["applicationRunMessage","engine"]
  ];
  const fail=/\b(fail(?:ed|ure)?|error|invalid|unable|cannot|could not|rejected|not enough|exception)\b/i;
  const working=/\b(calibrating|processing|preparing|loading|reading|matching|building|running|importing|computing|validating|generating)\b/i;
  const completed=/\b(complete(?:d)?|saved|imported|matched|loaded|ready|calculated|validated|prepared|generated|accepted|computed|success(?:fully)?|updated)\b/i;
  const warning=/\b(warning|first|please|no data|missing|select a lake|save observations first)\b/i;
  const lastValues=new Map();
  function watchStatus(id,channel){
    const el=byId(id);if(!el)return;
    const check=()=>{
      const txt=strip(el.textContent);
      const cls=el.className||"";
      if(!txt||lastValues.get(id)===txt+"|"+cls)return;
      lastValues.set(id,txt+"|"+cls);
      const isErr=/status-box--danger|status-box--error/.test(cls)||fail.test(txt);
      const isWarning=/status-box--warning/.test(cls)||warning.test(txt)&&!working.test(txt)&&!completed.test(txt);
      if(isErr){
        announce(channel,"error",txt);
        if(channel==="data"&&statuses.engine.kind==="busy"&&id==="statusBox")announce("engine","error",txt);
      } else if(isWarning) {
        announce(channel,"warning",txt);
        if(channel==="data"&&statuses.engine.kind==="busy"&&id==="statusBox")announce("engine","warning",txt);
      } else if(working.test(txt) && !completed.test(txt)){
        announce(channel,"busy",txt);
      } else if(completed.test(txt) || /status-box--success/.test(cls)){
        announce(channel,"done",txt);
      }
    };
    new MutationObserver(check).observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class"]});
  }
  sources.forEach(x=>watchStatus(x[0],x[1]));
  const resultSections=["resultsSection","validationResults","finalModelSection","applicationResults"];
  resultSections.forEach(id=>{
    const section=byId(id);if(!section)return;
    new MutationObserver(()=>{
      if(!section.hidden&&!section.classList.contains("hidden")&&statuses.engine.kind==="busy"){
        // Only a genuinely finished calculation may reveal these results.
        announce("engine","done","Scientific results displayed");
      }
    }).observe(section,{attributes:true,attributeFilter:["hidden","class"]});
  });
  // Allow full controls and scientific charts to remain untouched.
})();
