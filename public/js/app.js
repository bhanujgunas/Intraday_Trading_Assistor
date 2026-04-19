// app.js — IntraRadar v3

const WATCHLISTS = {
  default: ["RELIANCE","TCS","HDFCBANK","INFY","ICICIBANK","WIPRO","TATAMOTORS","BAJFINANCE","SBIN","ADANIPORTS"],
  banking: ["HDFCBANK","ICICIBANK","SBIN","AXISBANK","KOTAKBANK","INDUSINDBK","BANKBARODA","CANBK","PNB","FEDERALBNK"],
  it:      ["TCS","INFY","WIPRO","HCLTECH","TECHM","MPHASIS","LTIMINDTREE","PERSISTENT","COFORGE","OFSS"],
  auto:    ["TATAMOTORS","MARUTI","BAJAJ-AUTO","EICHERMOT","HEROMOTOCO","ASHOKLEY","TVSMOTOR","MRF","M&M","BOSCHLTD"],
  pharma:  ["SUNPHARMA","CIPLA","DRREDDY","DIVISLAB","BIOCON","AUROPHARMA","LUPIN","TORNTPHARM","ALKEM","ABBOTINDIA"],
  energy:  ["RELIANCE","ONGC","NTPC","POWERGRID","COALINDIA","GAIL","BPCL","IOC","HINDPETRO","TATAPOWER"],
};
const NSE_META = {
  RELIANCE:{n:"Reliance Industries",s:"Energy"},TCS:{n:"TCS",s:"IT"},HDFCBANK:{n:"HDFC Bank",s:"Banking"},
  INFY:{n:"Infosys",s:"IT"},ICICIBANK:{n:"ICICI Bank",s:"Banking"},WIPRO:{n:"Wipro",s:"IT"},
  TATAMOTORS:{n:"Tata Motors",s:"Auto"},BAJFINANCE:{n:"Bajaj Finance",s:"NBFC"},SBIN:{n:"SBI",s:"Banking"},
  ADANIPORTS:{n:"Adani Ports",s:"Infra"},AXISBANK:{n:"Axis Bank",s:"Banking"},KOTAKBANK:{n:"Kotak Bank",s:"Banking"},
  INDUSINDBK:{n:"IndusInd Bank",s:"Banking"},HCLTECH:{n:"HCL Tech",s:"IT"},TECHM:{n:"Tech Mahindra",s:"IT"},
  MARUTI:{n:"Maruti Suzuki",s:"Auto"},"BAJAJ-AUTO":{n:"Bajaj Auto",s:"Auto"},EICHERMOT:{n:"Eicher Motors",s:"Auto"},
  SUNPHARMA:{n:"Sun Pharma",s:"Pharma"},CIPLA:{n:"Cipla",s:"Pharma"},DRREDDY:{n:"Dr Reddy's",s:"Pharma"},
  ONGC:{n:"ONGC",s:"Energy"},NTPC:{n:"NTPC",s:"Energy"},POWERGRID:{n:"Power Grid",s:"Energy"},
};

function growwCharges(buy,sell,qty,type="intraday"){
  const bv=buy*qty,sv=sell*qty,tv=bv+sv;
  const brok=Math.min(bv*.0005,20)+Math.min(sv*.0005,20);
  const stt=type==="intraday"?sv*.00025:tv*.001;
  const exc=tv*.0000335,sebi=tv*.000001,stamp=bv*.00003,gst=(brok+exc+sebi)*.18;
  return{brok,stt,exc,sebi,stamp,gst,total:brok+stt+exc+sebi+stamp+gst};
}
function tradeTyp(t){return(t.type||"").toLowerCase().includes("intra")||(t.type||"").toLowerCase().includes("short")?"intraday":"delivery";}
function recalc(t){
  const c=growwCharges(t.buy_price,t.sell_price||t.buy_price,t.qty,tradeTyp(t));
  t.charges=+c.total.toFixed(2);
  if(t.sell_price!=null){t.gross_pnl=+((t.sell_price-t.buy_price)*t.qty).toFixed(2);t.net_pnl=+(t.gross_pnl-t.charges).toFixed(2);t.status="CLOSED";}
  else{t.gross_pnl=null;t.net_pnl=null;t.status="OPEN";}
  return t;
}

const CACHE_KEY="ir_trades_v3";
let tradesCache=[];
try{tradesCache=JSON.parse(localStorage.getItem(CACHE_KEY)||"[]");}catch{}
function saveLocal(){try{localStorage.setItem(CACHE_KEY,JSON.stringify(tradesCache));}catch{}}

function syncSt(state,msg){
  const el=document.getElementById("sync-status");if(!el)return;
  const m={ok:["sync-ok","✓ Synced"],err:["sync-err","✗ "+(msg||"Offline")],ing:["sync-ing","⟳ "+(msg||"Syncing")]};
  const[cls,txt]=m[state]||m.ok;el.className=cls;el.textContent=txt;
}

function tick(){
  const n=new Date();
  const el=document.getElementById("clock");if(el)el.textContent=n.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  const h=n.getHours(),m=n.getMinutes(),open=(h>9||(h===9&&m>=15))&&(h<15||(h===15&&m<=30));
  const lbl=document.getElementById("mkt-label"),dot=document.getElementById("mkt-dot");
  if(lbl)lbl.textContent=open?"NSE Open":"NSE Closed";
  if(dot)dot.style.background=open?"#3fb950":"#f85149";
}
setInterval(tick,1000);tick();

document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(t=>t.classList.remove("active"));
    document.querySelectorAll(".pane").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("pane-"+btn.dataset.tab)?.classList.add("active");
    if(btn.dataset.tab==="pnl")Dashboard.render();
    if(btn.dataset.tab==="history")ScanHistory.render();
    if(btn.dataset.tab==="settings")Settings.renderForm();
  });
});

// ── SETTINGS ────────────────────────────────────────────────────
const Settings=(()=>{
  let cur={capital:50000,risk_pct:1.5,watchlist:"default",theme:"dark",extras:{}};
  async function load(){
    try{const r=await Auth.authFetch("/api/settings");const d=await r.json();if(d.settings){cur={...cur,...d.settings};apply();}}catch{}
  }
  async function save(){
    cur={user_id:Auth.getUserId(),capital:parseFloat(document.getElementById("s-capital")?.value)||50000,
      risk_pct:parseFloat(document.getElementById("s-risk")?.value)||1.5,
      watchlist:document.getElementById("s-watchlist")?.value||"default",
      theme:document.getElementById("s-theme")?.value||"dark",extras:cur.extras||{}};
    apply();
    try{await Auth.authFetch("/api/settings",{method:"POST",body:JSON.stringify(cur)});
      const el=document.getElementById("s-saved");if(el){el.style.display="inline";setTimeout(()=>el.style.display="none",2000);}
    }catch{}
  }
  function apply(){
    const set=(id,v)=>{const el=document.getElementById(id);if(el&&el!==document.activeElement)el.value=v;};
    set("cap",cur.capital);set("risk-pct",cur.risk_pct);set("watchlist-sel",cur.watchlist||"default");
    set("s-capital",cur.capital);set("s-risk",cur.risk_pct);set("s-watchlist",cur.watchlist);set("s-theme",cur.theme);
  }
  return{load,save,renderForm:apply,get:(k)=>cur[k]};
})();

// ── SCANNER ──────────────────────────────────────────────────────
const Scanner=(()=>{
  const sc=s=>s>=75?"#3fb950":s>=58?"#58a6ff":s>=42?"#d29922":"#f85149";
  const badge=s=>s>=75?`<span class="bdg bdg-strong">STRONG BUY</span>`:s>=60?`<span class="bdg bdg-buy">BUY</span>`:s>=45?`<span class="bdg bdg-hold">WATCH</span>`:`<span class="bdg bdg-sell">SKIP</span>`;

  async function run(){
    const capital=parseFloat(document.getElementById("cap").value)||50000;
    const riskPct=parseFloat(document.getElementById("risk-pct").value)||1.5;
    const wl=document.getElementById("watchlist-sel").value;
    const symbols=WATCHLISTS[wl]||WATCHLISTS.default;
    ["scan-spin","scan-notice","scan-results","det"].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display=id==="scan-spin"?"flex":"none";});
    document.getElementById("scan-empty").style.display="none";
    document.getElementById("slist").innerHTML="";

    let prices={},liveCount=0;
    try{const r=await fetch(`/api/prices?symbols=${symbols.join(",")}`);if(r.ok){const d=await r.json();prices=d.prices||{};liveCount=d.liveCount||0;}}catch{}
    symbols.forEach(sym=>{if(!prices[sym]?.live){const b=1000+Math.random()*3000;prices[sym]={symbol:sym,ltp:+b.toFixed(2),prev:+(b*.99).toFixed(2),chgPct:+(Math.random()*4-1.5).toFixed(2),dayHi:+(b*1.012).toFixed(2),dayLo:+(b*.988).toFixed(2),volume:5e6,avgVolume:4e6,volRatio:1.2,live:false};}});

    const notice=document.getElementById("scan-notice");
    if(liveCount===0){notice.style.display="block";notice.textContent="⚠ Live prices unavailable — showing estimates.";}
    else if(liveCount<symbols.length){notice.style.display="block";notice.textContent=`⚠ ${liveCount}/${symbols.length} live. Others estimated.`;}

    let aiRes=[];
    try{
      const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"scanner",payload:{symbols,prices,capital,riskPct}})});
      if(r.ok){const d=await r.json();aiRes=JSON.parse((d.text||"[]").replace(/```json|```/g,"").trim());}
    }catch{}

    if(!aiRes.length){aiRes=symbols.map(sym=>{const p=prices[sym];const s=Math.min(Math.max(Math.round(50+p.chgPct*4+(p.volRatio-1)*10+Math.random()*10-5),28),92);const r=p.dayHi-p.dayLo;return{sym,score:s,entry:+p.ltp.toFixed(2),target:+(p.ltp+r*.55).toFixed(2),sl:+(p.ltp-r*.32).toFixed(2),rr:"1:1.7",trend:p.chgPct>.5?"BULLISH":p.chgPct<-.5?"BEARISH":"NEUTRAL",rsi_estimate:Math.round(45+s*.28),reason:"Volume-adjusted momentum. Verify manually.",news_sentiment:s>65?"POSITIVE":"NEUTRAL",vol_signal:p.volRatio>1.3?"HIGH":p.volRatio<.7?"LOW":"MODERATE"};});}

    aiRes.sort((a,b)=>b.score-a.score);
    ScanHistory.saveScan({watchlist:wl,capital,results:aiRes});

    const riskAmt=capital*riskPct/100;
    let html="";
    aiRes.forEach((s,i)=>{
      const p=prices[s.sym]||{},ltp=p.ltp||s.entry,chg=p.chgPct||0;
      const slDist=Math.abs(ltp-(s.sl||ltp*.994));
      const qty=slDist>0?Math.max(1,Math.floor(riskAmt/slDist)):Math.max(1,Math.floor(capital*.1/ltp));
      const c=sc(s.score),meta=NSE_META[s.sym]||{};
      const payload=JSON.stringify({...s,ltp,chg,qty,capital}).replace(/"/g,"&quot;");
      html+=`<div class="srow" onclick='Scanner.showDet(JSON.parse(this.dataset.s))' data-s="${payload}">
        <div><div style="font-weight:500${i<3?";color:#58a6ff":""}">${["⭐ ","★ ","✦ "][i]||""}${s.sym}<span style="font-size:9px;color:${p.live?"#3fb950":"#6e7681"};margin-left:3px">${p.live?"●":"~"}</span></div>
        <div style="font-size:10px;color:#8b949e">${meta.s||""} · ${s.trend} · RSI≈${s.rsi_estimate}</div></div>
        <div class="mono" style="font-weight:500">₹${ltp.toFixed(2)}</div>
        <div class="mono" style="color:${chg>=0?"#3fb950":"#f85149"};font-weight:500">${chg>=0?"+":""}${chg.toFixed(2)}%</div>
        <div><div class="mono" style="font-weight:600;color:${c}">${s.score}%</div><div class="sbar"><div class="sfill" style="width:${s.score}%;background:${c}"></div></div></div>
        <div>${badge(s.score)}</div><div class="mono" style="font-weight:600;color:#d29922">${qty}</div>
      </div>`;
    });
    document.getElementById("slist").innerHTML=html;
    document.getElementById("scan-spin").style.display="none";
    document.getElementById("scan-results").style.display="block";
  }

  function showDet(s){
    const ch=growwCharges(s.entry,s.target,s.qty,"intraday"),potG=(s.target-s.entry)*s.qty,potN=potG-ch.total,losG=(s.entry-s.sl)*s.qty;
    const meta=NSE_META[s.sym]||{};
    const items=[["Entry",`₹${s.entry.toFixed(2)}`,""],["Target",`₹${s.target.toFixed(2)}`,"green"],["Stop Loss",`₹${s.sl.toFixed(2)}`,"red"],
      ["Quantity",`${s.qty} shares`,""],["Investment",`₹${(s.entry*s.qty).toFixed(0)}`,"amber"],["Pot. Profit",`₹${potN.toFixed(2)}`,"green"],
      ["Pot. Loss",`₹${losG.toFixed(2)}`,"red"],["Charges",`₹${ch.total.toFixed(2)}`,"amber"],
      ["R:R",s.rr,""],["Volume",s.vol_signal||"—",""],["Sentiment",s.news_sentiment||"—",""],["Score",`${s.score}%`,s.score>=60?"green":"amber"]];
    document.getElementById("det-hd").innerHTML=`<div style="font-weight:600;font-size:15px;color:#58a6ff">${s.sym} <span style="font-size:11px;color:#8b949e;font-weight:400">— ${meta.n||""}</span></div><div style="font-size:11px;color:#8b949e;margin-top:3px">${s.reason}</div>`;
    document.getElementById("det-body").innerHTML=`<div class="det-grid">${items.map(([l,v,c])=>`<div class="card" style="padding:10px"><div class="mlbl">${l}</div><div class="mono" style="font-size:13px;font-weight:500${c?`;color:var(--${c})`:""}">${v}</div></div>`).join("")}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-success btn-sm" onclick="TradeLog.prefill('${s.sym}',${s.entry},${s.qty})">Log This Trade</button><button class="btn btn-outline btn-sm" onclick="AIAnalyst.fromScanner('${s.sym}')">Deep AI Analysis</button></div>`;
    document.getElementById("det").style.display="block";
    document.getElementById("det").scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  return{run,showDet};
})();

// ── AI ANALYST ───────────────────────────────────────────────────
const AIAnalyst=(()=>{
  async function run(){
    const sym=(document.getElementById("ai-sym").value||"RELIANCE").toUpperCase().trim();
    const cap=document.getElementById("ai-cap").value||50000;
    const q=document.getElementById("ai-q").value||"Full intraday analysis with entry, target, SL, quantity and Groww charges.";
    document.getElementById("ai-spin").style.display="flex";
    document.getElementById("ai-out").style.display="none";
    let price=null;
    try{const r=await fetch(`/api/prices?symbols=${sym}`);if(r.ok){const d=await r.json();price=d.prices?.[sym];}}catch{}
    try{
      const r=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"analyst",payload:{symbol:sym,price,capital:cap,question:q}})});
      const d=await r.json();
      document.getElementById("ai-out").innerHTML=`<div class="ai-out">${d.text||d.error||"No response."}</div>`;
      document.getElementById("ai-out").style.display="block";
    }catch(e){document.getElementById("ai-out").innerHTML=`<div class="ai-out" style="color:var(--red)">Error: ${e.message}</div>`;document.getElementById("ai-out").style.display="block";}
    document.getElementById("ai-spin").style.display="none";
  }
  function quick(q){document.getElementById("ai-sym").value="NSE";document.getElementById("ai-q").value=q;run();}
  function fromScanner(sym){document.querySelector('[data-tab="ai"]').click();document.getElementById("ai-sym").value=sym;document.getElementById("ai-q").value="Detailed intraday: entry zone, T1, T2, SL, quantity, charges, confidence.";run();}
  return{run,quick,fromScanner};
})();

// ── SCAN HISTORY ─────────────────────────────────────────────────
const ScanHistory=(()=>{
  let history=[];
  async function saveScan(data){
    try{await Auth.authFetch("/api/settings?type=scan",{method:"POST",body:JSON.stringify({user_id:Auth.getUserId(),...data})});}catch{}
  }
  async function load(){
    try{const r=await Auth.authFetch("/api/settings?type=scan");const d=await r.json();history=d.history||[];}catch{}
  }
  function render(){
    const el=document.getElementById("history-list");if(!el)return;
    if(!history.length){el.innerHTML=`<div class="empty-state">No scan history yet. Run a scan first.</div>`;return;}
    el.innerHTML=history.map(h=>{
      const top3=(h.results||[]).slice(0,3).map(r=>`<span class="bdg bdg-${r.score>=60?"buy":"hold"}" style="margin-right:4px">${r.sym} ${r.score}%</span>`).join("");
      const dt=new Date(h.scanned_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
      return`<div class="card" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div style="font-size:11px;color:#8b949e">${dt} · ${h.watchlist} · ₹${Number(h.capital).toLocaleString()}</div><span class="bdg bdg-hold">${(h.results||[]).length} stocks</span></div><div>${top3}</div></div>`;
    }).join("");
  }
  return{saveScan,load,render};
})();

// ── TRADE LOG ────────────────────────────────────────────────────
const TradeLog=(()=>{
  async function loadFromDB(){
    syncSt("ing","Loading...");
    try{
      const r=await Auth.authFetch("/api/trades");const d=await r.json();
      tradesCache=(d.trades||[]).map(t=>({id:t.id,date:t.date,symbol:t.symbol,type:t.type,qty:Number(t.qty),buy_price:Number(t.buy_price),sell_price:t.sell_price!=null?Number(t.sell_price):null,notes:t.notes||"",gross_pnl:t.gross_pnl!=null?Number(t.gross_pnl):null,charges:Number(t.charges),net_pnl:t.net_pnl!=null?Number(t.net_pnl):null,status:t.status}));
      saveLocal();syncSt("ok");
    }catch{syncSt("err","Offline");}
    render();
  }
  function showForm(){const f=document.getElementById("log-form");f.style.display=f.style.display==="none"?"block":"none";if(f.style.display==="block")document.getElementById("f-date").value=new Date().toISOString().split("T")[0];}
  function prefill(sym,price,qty){document.querySelector('[data-tab="log"]').click();setTimeout(()=>{document.getElementById("log-form").style.display="block";document.getElementById("f-sym").value=sym;document.getElementById("f-buy").value=price;document.getElementById("f-qty").value=qty;document.getElementById("f-date").value=new Date().toISOString().split("T")[0];},100);}
  async function save(){
    const sym=document.getElementById("f-sym").value.toUpperCase().trim();
    const buy=parseFloat(document.getElementById("f-buy").value);
    const qty=parseFloat(document.getElementById("f-qty").value);
    const sell=parseFloat(document.getElementById("f-sell").value)||null;
    const date=document.getElementById("f-date").value;
    const type=document.getElementById("f-type").value;
    const notes=document.getElementById("f-notes").value;
    if(!sym||!buy||!qty||!date){alert("Symbol, Buy Price, Qty and Date required.");return;}
    const trade=recalc({symbol:sym,buy_price:buy,qty,sell_price:sell,date,type,notes});
    syncSt("ing","Saving...");
    try{
      const r=await Auth.authFetch("/api/trades",{method:"POST",body:JSON.stringify({...trade,user_id:Auth.getUserId()})});
      const d=await r.json();
      if(d.trade){tradesCache.unshift(d.trade);saveLocal();syncSt("ok");}else throw new Error(JSON.stringify(d.error));
    }catch(e){const local={...trade,id:Date.now(),_local:true};tradesCache.unshift(local);saveLocal();syncSt("err","Saved locally");}
    document.getElementById("log-form").style.display="none";
    ["f-sym","f-buy","f-qty","f-sell","f-notes"].forEach(id=>document.getElementById(id).value="");
    render();Dashboard.render();
  }
  async function update(id,patch){
    const idx=tradesCache.findIndex(t=>t.id==id);
    if(idx!==-1){Object.assign(tradesCache[idx],patch);recalc(tradesCache[idx]);saveLocal();}
    syncSt("ing","Saving...");
    try{
      const t=tradesCache[idx],dbP={...patch};
      if(t)Object.assign(dbP,{gross_pnl:t.gross_pnl,charges:t.charges,net_pnl:t.net_pnl,status:t.status});
      await Auth.authFetch(`/api/trades?id=${id}`,{method:"PUT",body:JSON.stringify(dbP)});
      syncSt("ok");
    }catch{syncSt("err","Sync failed");}
    render();Dashboard.render();
  }
  async function del(id){
    if(!confirm("Delete this trade?"))return;
    tradesCache=tradesCache.filter(t=>t.id!=id);saveLocal();render();Dashboard.render();
    syncSt("ing","Deleting...");
    try{await Auth.authFetch(`/api/trades?id=${id}`,{method:"DELETE"});syncSt("ok");}catch{syncSt("err","Delete sync failed");}
  }
  function editField(id,field,raw){
    const val=raw.replace(/₹|,/g,"").trim();if(!val)return;
    const patch={};
    if(["qty","buy_price","sell_price"].includes(field)){if(field==="sell_price"&&(val==="—"||val===""))patch.sell_price=null;else{const n=parseFloat(val);if(!isNaN(n))patch[field]=n;}}
    else patch[field]=val;
    if(Object.keys(patch).length)update(id,patch);
  }
  function render(){
    const tbody=document.getElementById("log-body"),empty=document.getElementById("log-empty");
    if(!tradesCache.length){if(empty)empty.style.display="block";if(tbody)tbody.innerHTML="";return;}
    if(empty)empty.style.display="none";
    let html="";
    tradesCache.forEach(t=>{
      const gStr=t.gross_pnl!=null?`<span class="mono" style="color:${t.gross_pnl>=0?"var(--green)":"var(--red)"}">₹${t.gross_pnl.toFixed(2)}</span>`:"—";
      const nStr=t.net_pnl!=null?`<span class="mono" style="font-weight:600;color:${t.net_pnl>=0?"var(--green)":"var(--red)"}">₹${t.net_pnl.toFixed(2)}</span>`:"—";
      const st=t.status==="OPEN"?`<span class="bdg bdg-open">OPEN</span>`:`<span class="bdg bdg-hold">CLOSED</span>`;
      const lc=t._local?`<span title="Pending sync" style="color:var(--amber);font-size:9px">⚠</span>`:"";
      html+=`<tr><td class="edit-cell mono" contenteditable="true" onblur="TradeLog.editField(${t.id},'date',this.textContent)">${t.date}</td>
        <td class="edit-cell mono" style="font-weight:500;color:#58a6ff" contenteditable="true" onblur="TradeLog.editField(${t.id},'symbol',this.textContent.toUpperCase())">${t.symbol}${lc}</td>
        <td style="color:#8b949e;font-size:11px">${t.type}</td>
        <td class="edit-cell mono" contenteditable="true" onblur="TradeLog.editField(${t.id},'qty',this.textContent)">${t.qty}</td>
        <td class="edit-cell mono" contenteditable="true" onblur="TradeLog.editField(${t.id},'buy_price',this.textContent)">₹${t.buy_price.toFixed(2)}</td>
        <td class="edit-cell mono" contenteditable="true" onblur="TradeLog.editField(${t.id},'sell_price',this.textContent)">${t.sell_price!=null?"₹"+t.sell_price.toFixed(2):"—"}</td>
        <td class="edit-cell" style="color:#8b949e;font-size:11px;max-width:140px" contenteditable="true" onblur="TradeLog.editField(${t.id},'notes',this.textContent)">${t.notes||""}</td>
        <td>${gStr}</td><td class="mono amber">₹${t.charges.toFixed(2)}</td><td>${nStr}</td><td>${st}</td>
        <td><button class="del-btn" onclick="TradeLog.del(${t.id})">✕</button></td></tr>`;
    });
    if(tbody)tbody.innerHTML=html;
  }
  return{loadFromDB,showForm,prefill,save,update,editField,del,render};
})();

// ── DASHBOARD ────────────────────────────────────────────────────
let _pnlC=null;
const Dashboard={render(){
  const closed=tradesCache.filter(t=>t.net_pnl!=null),wins=closed.filter(t=>t.net_pnl>0);
  const tot=closed.reduce((a,t)=>a+t.net_pnl,0),ch=tradesCache.reduce((a,t)=>a+t.charges,0);
  const avg=closed.length?tot/closed.length:0,wr=closed.length?wins.length/closed.length*100:0;
  const best=closed.length?Math.max(...closed.map(t=>t.net_pnl)):0;
  const worst=closed.length?Math.min(...closed.map(t=>t.net_pnl)):0;
  const s=(id,v,c)=>{const el=document.getElementById(id);if(!el)return;el.textContent=v;if(c)el.className="mval "+c;};
  s("d-total",`₹${tot.toFixed(2)}`,tot>=0?"green":"red");s("d-wr",closed.length?`${wr.toFixed(1)}%`:"—","cyan");
  s("d-avg",`₹${avg.toFixed(2)}`,avg>=0?"green":"red");s("d-ch",`₹${ch.toFixed(2)}`,"amber");
  s("d-n",closed.length);s("d-w",wins.length,"green");s("d-best",`₹${best.toFixed(2)}`,"green");s("d-worst",`₹${worst.toFixed(2)}`,"red");
  const bar=document.getElementById("d-wrb");if(bar)bar.style.width=`${wr}%`;
  const months={};closed.forEach(t=>{const m=(t.date||"").slice(0,7);if(m)months[m]=(months[m]||0)+t.net_pnl;});
  const labels=Object.keys(months).sort(),vals=labels.map(m=>months[m]),colors=vals.map(v=>v>=0?"rgba(63,185,80,.7)":"rgba(248,81,73,.7)");
  if(_pnlC)_pnlC.destroy();
  const canvas=document.getElementById("pnl-chart");
  if(canvas&&labels.length)_pnlC=new Chart(canvas,{type:"bar",data:{labels,datasets:[{label:"Net P&L",data:vals,backgroundColor:colors,borderRadius:3,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`₹${c.raw.toFixed(2)}`}}},scales:{x:{ticks:{color:"#8b949e",font:{size:10}},grid:{color:"rgba(255,255,255,0.05)"}},y:{ticks:{color:"#8b949e",font:{size:10},callback:v=>"₹"+v.toFixed(0)},grid:{color:"rgba(255,255,255,0.05)"}}}}});
}};

// ── CHARGES CALC ─────────────────────────────────────────────────
const Charges={calc(){
  const b=parseFloat(document.getElementById("c-b")?.value)||0;
  const s=parseFloat(document.getElementById("c-s")?.value)||0;
  const q=parseFloat(document.getElementById("c-q")?.value)||0;
  const t=document.getElementById("c-t")?.value||"intraday";
  const c=growwCharges(b,s,q,t),gross=(s-b)*q,net=gross-c.total;
  const rows=[["Brokerage (0.05% each leg, max ₹20/leg)",c.brok],[`STT — ${t==="intraday"?"0.025% sell side (MIS)":"0.1% both sides (CNC)"}`,c.stt],["NSE Exchange (0.00335% turnover)",c.exc],["SEBI Fees (₹10/Cr)",c.sebi],["Stamp Duty (0.003% buy)",c.stamp],["GST (18% on brok+exchange+SEBI)",c.gst]];
  let html=`<div class="crow" style="margin-bottom:6px"><span style="font-weight:500">Gross P&L</span><span class="mono" style="font-weight:600;color:${gross>=0?"var(--green)":"var(--red)"}">₹${gross.toFixed(2)}</span></div>`;
  html+=rows.map(([l,v])=>`<div class="crow"><span style="color:#8b949e;font-size:11px">${l}</span><span class="mono">₹${v.toFixed(2)}</span></div>`).join("");
  html+=`<div class="crow" style="border-top:1px solid #30363d;padding-top:6px;margin-top:4px"><span style="font-weight:500">Total Charges</span><span class="mono amber" style="font-weight:600">₹${c.total.toFixed(2)}</span></div><div class="crow ctot"><span>Net P&L (after charges)</span><span class="mono" style="color:${net>=0?"var(--green)":"var(--red)"}">₹${net.toFixed(2)}</span></div>`;
  const el=document.getElementById("c-out");if(el)el.innerHTML=html;
}};

// ── EXCEL EXPORT ─────────────────────────────────────────────────
function exportExcel(){
  if(!window.XLSX){alert("XLSX not loaded.");return;}
  const rows=tradesCache.map(t=>({Date:t.date,Symbol:t.symbol,Type:t.type,Qty:t.qty,"Buy ₹":t.buy_price,"Sell ₹":t.sell_price??"",Notes:t.notes||"","Gross P&L":t.gross_pnl!=null?+t.gross_pnl.toFixed(2):"","Charges":+t.charges.toFixed(2),"Net P&L":t.net_pnl!=null?+t.net_pnl.toFixed(2):"",Status:t.status}));
  const closed=tradesCache.filter(t=>t.net_pnl!=null),tot=closed.reduce((a,t)=>a+t.net_pnl,0),ch=tradesCache.reduce((a,t)=>a+t.charges,0);
  const summary=[{},{Date:"═══ SUMMARY ═══"},{Date:"Closed Trades",Symbol:closed.length},{Date:"Win Rate %",Symbol:closed.length?+(closed.filter(t=>t.net_pnl>0).length/closed.length*100).toFixed(1):0},{Date:"Total Net P&L ₹",Symbol:+tot.toFixed(2)},{Date:"Total Charges ₹",Symbol:+ch.toFixed(2)},{Date:"Avg Net/Trade ₹",Symbol:closed.length?+(tot/closed.length).toFixed(2):0}];
  const wb=XLSX.utils.book_new(),ws=XLSX.utils.json_to_sheet([...rows,...summary]);
  ws["!cols"]=[{wch:12},{wch:14},{wch:14},{wch:6},{wch:11},{wch:11},{wch:20},{wch:12},{wch:11},{wch:12},{wch:8}];
  XLSX.utils.book_append_sheet(wb,ws,"IntraRadar Trades");
  XLSX.writeFile(wb,`IntraRadar_${new Date().toISOString().split("T")[0]}.xlsx`);
}

// ── AUTH WIRING ───────────────────────────────────────────────────
async function onAuth(user){
  document.getElementById("auth-screen").style.display="none";
  document.getElementById("app-screen").style.display="block";
  const name=user.user_metadata?.full_name||user.email||"User";
  const avatar=user.user_metadata?.avatar_url||"";
  const el=document.getElementById("user-info");
  if(el)el.innerHTML=avatar?`<img src="${avatar}" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:5px">${name.split(" ")[0]}`:`<span style="color:#58a6ff">${name.split(" ")[0]}</span>`;
  await Promise.all([Settings.load(),TradeLog.loadFromDB(),ScanHistory.load()]);
  Charges.calc();
}
function onSignOut(){
  document.getElementById("auth-screen").style.display="flex";
  document.getElementById("app-screen").style.display="none";
  tradesCache=[];
}
(async () => {
  if (window.Auth && typeof window.Auth.initAuth === "function") {
    try {
      await window.Auth.initAuth(onAuth, onSignOut);
    } catch (err) {
      console.error("Failed to initialize Auth:", err);
    }
  } else {
    console.error("Auth is not loaded yet. Make sure public/js/auth.js is included before app.js.");
  }
})();