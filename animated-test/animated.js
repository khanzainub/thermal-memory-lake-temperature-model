
/* Visual-only telemetry for Animated Test. Does not modify model algorithms/data. */
(function(){
"use strict";
document.body.classList.add("animated-theme");
const isChild=window.parent!==window;
document.body.classList.add(isChild?"animated-inner":"animated-parent");
const scope=location.pathname.includes("/in-situ/")?"In-Situ":location.pathname.includes("/baseline/")?"Baseline":location.pathname.includes("/with-memory/")?"With Memory":"Control Center";
const labelMap={data:"Data Pipeline",engine:"Model Engine",mode:"Active Module"};
const state={data:{status:"ready",message:"Awaiting data"},engine:{status:"ready",message:"Standby"},mode:{status:"ready",message:scope}};
function send(kind,status,message){
 state[kind]={status:status,message:message};
 if(isChild){
   const bar=document.querySelector(".anim-indicator");
   if(bar && (kind==="engine"||kind==="data"))bar.textContent=labelMap[kind].toUpperCase()+" · "+message;
   document.body.classList.toggle("is-busy",state.data.status==="busy"||state.engine.status==="busy");
   if(window.parent!==window)window.parent.postMessage({source:"restlake-animated-v1",type:"activity",kind:kind,status:status,message:message,scope:scope},window.location.origin);
 }else{draw(kind)}
}
function draw(kind){
 const item=document.getElementById("anim-"+kind);
 if(!item)return;
 item.className="anim-chip is-"+state[kind].status;
 const content=item.querySelector("b");if(content)content.textContent=state[kind].message;
}
if(!isChild){
 const main=document.querySelector("main.container");
 if(main){
   const consoleBox=document.createElement("div");consoleBox.className="anim-console";consoleBox.setAttribute("role","status");consoleBox.setAttribute("aria-live","polite");
   consoleBox.innerHTML='<div class="anim-console-intro"><span class="anim-console-kicker">ReST–Lake / research interface</span><span class="anim-console-title">THERMAL RESPONSE CONTROL</span><span class="anim-console-sub">Experimental animated UI · Original model logic preserved</span></div>'+
   '<div class="anim-chip is-ready" id="anim-data"><span class="anim-led"></span><span class="anim-led-text"><small>DATA PIPELINE</small><b>Awaiting data</b></span></div>'+
   '<div class="anim-chip is-ready" id="anim-engine"><span class="anim-led"></span><span class="anim-led-text"><small>MODEL ENGINE</small><b>Standby</b></span></div>'+
   '<div class="anim-chip is-ready" id="anim-mode"><span class="anim-led"></span><span class="anim-led-text"><small>ACTIVE MODE</small><b>With Memory</b></span></div>';
   main.insertBefore(consoleBox,main.firstChild);
 }
 function readTab(){
   const active=document.querySelector('.cmp-tabs button[aria-selected="true"]');
   if(active)send("mode","ready",active.textContent.trim().replace(/\s*·\s*/g," / "));
 }
 document.querySelectorAll(".cmp-tabs button").forEach(btn=>btn.addEventListener("click",function(){window.requestAnimationFrame(readTab)}));
 readTab();
 window.addEventListener("message",function(e){
   if(e.origin!==location.origin||!e.data||e.data.source!=="restlake-animated-v1")return;
   if(e.data.type==="activity"){
     const frame=e.source && Array.from(document.querySelectorAll("iframe")).find(f=>f.contentWindow===e.source);
     if(!frame || frame.closest("[hidden]"))return;
     send(e.data.kind,e.data.status,e.data.message);
   }
   if(e.data.type==="height"){
     const frame=Array.from(document.querySelectorAll("iframe")).find(f=>f.contentWindow===e.source);
     if(frame && Number.isFinite(e.data.height)){
        const pixels=Math.max(670,Math.min(32000,Math.ceil(e.data.height)+16));
        if(Math.abs((parseFloat(frame.style.height)||0)-pixels)>20)frame.style.height=pixels+"px";
     }
   }
 });
}else{
 const main=document.querySelector("main");
 if(main){
  const bar=document.createElement("div");bar.className="anim-innerbar";
  bar.innerHTML='<span class="anim-indicator">SYSTEM READY · '+scope.toUpperCase()+'</span><button type="button" class="anim-motion" aria-pressed="false">Pause animation</button>';
  main.insertBefore(bar,main.firstChild);
  const b=bar.querySelector(".anim-motion");
  b.addEventListener("click",()=>{
    const paused=document.body.classList.toggle("motion-paused");
    b.textContent=paused?"Resume animation":"Pause animation";
    b.setAttribute("aria-pressed",String(paused));
  });
 }
 let resizeQueued=false;
 function postHeight(){
   if(resizeQueued)return;
   resizeQueued=true;
   requestAnimationFrame(function(){
     resizeQueued=false;
     const height=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
     window.parent.postMessage({source:"restlake-animated-v1",type:"height",height:height},window.location.origin);
   });
 }
 if("ResizeObserver" in window){const ro=new ResizeObserver(postHeight);ro.observe(document.body)}
 window.addEventListener("load",postHeight);window.addEventListener("resize",postHeight);
 postHeight();
}
const operations={
 runBtn:"Calibrating · with memory",runValidationBtn:"Running held-out validation",
 buildFinalBtn:"Building final model",runApplicationBtn:"Running application",
 matchDates:"Matching observation dates",applyBias:"Calculating bias correction"
};
document.addEventListener("click",function(e){
 const btn=e.target.closest("button");if(!btn||btn.disabled)return;
 if(operations[btn.id]){
   send("engine","busy",operations[btn.id]);
 }else if(btn.id==="prepareLakeNotebook"){
   send("data","busy","Preparing Colab notebook");
 }
},true);
document.addEventListener("change",function(e){
 if(e.target && e.target.matches('input[type="file"]')&&e.target.files&&e.target.files.length){
   send("data","busy","Reading "+e.target.files.length+" file"+(e.target.files.length===1?"":"s"));
 }
},true);
const statuses=[
 ["lakeDataStatus","data"],["statusBox","data"],["applicationStatusBox","data"],
 ["obsStatus","data"],["matchStatus","engine"],["calStatus","engine"],
 ["runMessage","engine"],["validationRunMessage","engine"],["finalRunMessage","engine"],
 ["applicationRunMessage","engine"],["futureStatus","data"]
];
function assess(el,kind){
 const s=(el.textContent||"").replace(/\s+/g," ").trim();
 if(!s)return;
 const error=/\b(failed|error|invalid|unable|could not|missing required|not enough)\b/i.test(s);
 const finished=/\b(complete|completed|success|loaded|imported|saved|matched|calibrat(?:ed|ion results)|validated|prepared|ready|generated|accepted|computed|downloaded|uploaded)\b/i.test(s);
 if(error)send(kind,"error",kind==="data"?"Data needs attention":"Process needs attention");
 else if(finished)send(kind,"ready",kind==="data"?"Data status updated":"Results updated");
}
statuses.forEach(function(pair){
 const el=document.getElementById(pair[0]);if(!el)return;
 const mo=new MutationObserver(function(){assess(el,pair[1])});
 mo.observe(el,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class","hidden"]});
});
const completedSections=["resultsSection","validationResults","finalModelSection","applicationResults"];
completedSections.forEach(id=>{
 const el=document.getElementById(id);if(!el)return;
 new MutationObserver(function(){
   if(!el.hidden && !el.classList.contains("hidden") && state.engine.status==="busy")send("engine","ready","Results available");
 }).observe(el,{attributes:true,attributeFilter:["class","hidden"]});
});
})();
