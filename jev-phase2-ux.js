(function(){
  "use strict";

  function $(id){ return document.getElementById(id); }

  function injectStyle(){
    if($("jev-phase2-ux-style")) return;
    var st=document.createElement("style");
    st.id="jev-phase2-ux-style";
    st.textContent=
      "#p_out.jev-precheck-blocked>.verdict{display:none}"+
      ".jev-financial-reference{font-size:11.5px;color:var(--muted);margin:-2px 0 12px;line-height:1.5}";
    document.head.appendChild(st);
  }

  function sync(){
    var pre=$("jev_precheck"), out=$("p_out");
    if(!pre||!out) return;
    var d=pre.querySelector(".jev-precheck-result .d");
    var decision=d?d.textContent.trim():"";
    var blocked=(decision==="ESPERAR"||decision==="DESCARTAR");
    out.classList.toggle("jev-precheck-blocked",blocked);

    var note=$("jev_financial_reference");
    if(blocked){
      if(!note){
        note=document.createElement("div");
        note.id="jev_financial_reference";
        note.className="jev-financial-reference";
        note.textContent="Métricas financieras visibles solo como referencia. El PRE-CHECK debe superarse antes de interpretar un veredicto económico.";
        out.insertBefore(note,out.firstChild);
      }
    }else if(note){
      note.remove();
    }
  }

  function init(){
    injectStyle();
    sync();
    var pre=$("jev_precheck");
    if(pre&&window.MutationObserver){
      new MutationObserver(sync).observe(pre,{childList:true,subtree:true});
    }
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){setTimeout(init,0);});
  else setTimeout(init,0);
})();
