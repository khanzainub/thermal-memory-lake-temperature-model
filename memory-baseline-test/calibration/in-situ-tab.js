"use strict";
(()=> {
const $=id=>document.getElementById(id);
const insitu=$("tabInSitu"),pane=$("inSituPane"),frame=$("frameInSitu");
const originals=[$("tabMemory"),$("tabBaseline")],oldPanes=[$("memoryPane"),$("baselinePane")];
function resize(){try{const d=frame.contentDocument;if(!d)return;
 frame.style.height=Math.max(760,d.documentElement.scrollHeight,d.body.scrollHeight)+"px";}catch(e){}}
function restoreOld(){pane.hidden=true;insitu.classList.remove("cmp-active");insitu.setAttribute("aria-selected","false");}
originals.forEach(button=>button.addEventListener("click",restoreOld));
insitu.addEventListener("click",()=>{
 originals.forEach(b=>{b.classList.remove("cmp-active");b.setAttribute("aria-selected","false")});
 oldPanes.forEach(p=>p.hidden=true);
 pane.hidden=false;insitu.classList.add("cmp-active");insitu.setAttribute("aria-selected","true");
 $("modeNote").textContent="Satellite LST bias calibration: match old in-situ temperatures once, save a correction value, and reuse it for later satellite data. Model equations remain unchanged.";
 resize();
});
frame.addEventListener("load",()=>{
 try{const d=frame.contentDocument;const Obs=frame.contentWindow.ResizeObserver;
 if(d&&Obs){const ro=new Obs(resize);ro.observe(d.body)}}catch(e){}
 resize();
});
})();
