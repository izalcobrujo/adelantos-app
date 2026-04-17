// VENTAS v4
const { useState, useEffect, useCallback, useMemo, useRef } = React;

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyNgCSqgADH_l6TqMqz2hoAf1QDae8ork4vdWmoOj6nx1j93_H3hUMQJp9_UsMT14gl/exec";

const T = {
  bg:"#F4F2EF", card:"#FFFFFF",
  primary:"#1A3353", primaryMid:"#1E4080",
  accent:"#2563EB", accentLight:"#DBEAFE",
  expense:"#991B1B", expenseLight:"#FEE2E2",
  warning:"#D97706", warningLight:"#FEF3C7",
  success:"#16A34A", successLight:"#DCFCE7",
  text:"#1C1917", textMid:"#57534E", textLight:"#A8A29E",
  border:"#E5E3DF", white:"#FFFFFF",
  pieColors:["#2563EB","#7C3AED","#DB2777","#D97706","#059669","#0891B2","#DC2626","#65A30D","#EA580C","#0D9488"],
};

const SUCURSALES_DEFAULT = ["GARAN 1","GARAN 2","GARAN 7"];
const CV_DEFAULT = ["DESAYUNO","ALMUERZO","REFRIGERIO MAÑANA","REFRIGERIO TARDE","CENA","EVENTOS"];
const CG_DEFAULT = ["TORTILLAS","PAGOS","OTROS"];

const fmt = (n) => `$${Number(n||0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const today = () => new Date().toISOString().split("T")[0];
const getWeekNum = (ds) => { const d=new Date(ds),j=new Date(d.getFullYear(),0,1); return Math.ceil(((d-j)/86400000+j.getDay()+1)/7); };
const getMonth = (ds) => ds.slice(0,7);
const getQuincena = (ds) => { const d=new Date(ds); return `${ds.slice(0,7)}-${d.getDate()<=15?"Q1":"Q2"}`; };
const DAYS_ES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const LS = {
  get:(k,def)=>{try{const v=localStorage.getItem(k);return v!==null?JSON.parse(v):def;}catch{return def;}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
};

const genSeedData = () => {
  const records=[]; const now=new Date();
  for(let i=28;i>=1;i--){
    const d=new Date(now); d.setDate(d.getDate()-i);
    const ds=d.toISOString().split("T")[0];
    SUCURSALES_DEFAULT.forEach(suc=>{
      CV_DEFAULT.forEach(c=>{ if(Math.random()>0.35) records.push({id:`v-${ds}-${suc}-${c}`,fecha:ds,sucursal:suc,tipo:"venta",concepto:c,monto:Math.round(80+Math.random()*600)}); });
      CG_DEFAULT.forEach(c=>{ if(Math.random()>0.55) records.push({id:`g-${ds}-${suc}-${c}`,fecha:ds,sucursal:suc,tipo:"gasto",concepto:c,monto:Math.round(20+Math.random()*180)}); });
      const tv=records.filter(r=>r.fecha===ds&&r.sucursal===suc&&r.tipo==="venta").reduce((a,b)=>a+b.monto,0);
      const tg=records.filter(r=>r.fecha===ds&&r.sucursal===suc&&r.tipo==="gasto").reduce((a,b)=>a+b.monto,0);
      const caja=(tv-tg)+(Math.random()>0.8?Math.round((Math.random()-0.5)*80):0);
      records.push({id:`c-${ds}-${suc}`,fecha:ds,sucursal:suc,tipo:"caja",concepto:"CAJA",monto:Math.max(0,Math.round(caja*100)/100)});
    });
  }
  return records;
};

const sumBy = (records, tipo) => records.filter(r=>r.tipo===tipo).reduce((a,b)=>a+Number(b.monto),0);

const groupByDaySuc = (records) => {
  const map={};
  records.forEach(r=>{
    const key=`${r.fecha}__${r.sucursal}`;
    if(!map[key]) map[key]={fecha:r.fecha,sucursal:r.sucursal,ventas:[],gastos:[],caja:null,nota:null};
    if(r.tipo==="venta") map[key].ventas.push(r);
    else if(r.tipo==="gasto") map[key].gastos.push(r);
    else if(r.tipo==="caja") map[key].caja=r.monto;
    else if(r.tipo==="nota") map[key].nota=r.texto||"";
  });
  return Object.values(map).sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.sucursal.localeCompare(b.sucursal));
};

const filterByPeriodMode = (records, mode, value) => {
  if(mode==="semana"){
    const now=new Date(), cw=getWeekNum(today()), cy=String(now.getFullYear());
    return records.filter(r=>getWeekNum(r.fecha)===cw&&r.fecha.slice(0,4)===cy);
  }
  if(mode==="quincena") return records.filter(r=>getQuincena(r.fecha)===getQuincena(today()));
  if(mode==="mes") return records.filter(r=>getMonth(r.fecha)===getMonth(today()));
  if(mode==="dia"&&value) return records.filter(r=>r.fecha===value);
  return records;
};

const exportExcel = (records) => {
  const BOM="\uFEFF";
  const rows=[["Fecha","Sucursal","Tipo","Concepto","Monto"]];
  [...records].filter(r=>r.tipo!=="nota").sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.sucursal.localeCompare(b.sucursal))
    .forEach(r=>rows.push([r.fecha,r.sucursal,r.tipo.toUpperCase(),r.concepto,r.monto]));
  rows.push([],["=== RESUMEN POR DÍA Y SUCURSAL ==="],["Fecha","Sucursal","Total Ventas","Total Gastos","Neto","Caja","Diferencia","Nota"]);
  groupByDaySuc(records).forEach(g=>{
    const tv=g.ventas.reduce((a,b)=>a+b.monto,0),tg=g.gastos.reduce((a,b)=>a+b.monto,0),neto=tv-tg;
    const diff=g.caja!=null?g.caja-neto:null;
    rows.push([g.fecha,g.sucursal,tv,tg,neto,g.caja??"",(diff!==null?diff:""),g.nota||""]);
  });
  const csv=BOM+rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"}));a.download=`ventas_${today()}.csv`;a.click();
};

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = ({name,size=22,color="currentColor"}) => {
  const s={width:size,height:size,display:"inline-block",flexShrink:0,verticalAlign:"middle"};
  const m={
    dashboard:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    store:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l1-5h16l1 5"/><path d="M3 9v10a1 1 0 001 1h16a1 1 0 001-1V9"/><path d="M9 9v11M15 9v11M3 9h18"/></svg>,
    plus:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    wallet:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><circle cx="16" cy="13" r="1" fill={color}/><path d="M20 7V5a2 2 0 00-2-2H6a2 2 0 00-2 2v2"/></svg>,
    cloud:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg>,
    cloudUp:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
    cloudDown:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 16 12 20 16 16"/><line x1="12" y1="20" x2="12" y2="11"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></svg>,
    trendUp:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    trendDown:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
    warning:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    check:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    trash:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
    edit:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    menu:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>,
    close:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    chevDown:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
    chevRight:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
    dollar:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
    bar:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
    excel:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>,
    note:<svg viewBox="0 0 24 24" style={s} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  };
  return m[name]||null;
};

const Card = ({children,style={}}) => <div style={{background:T.card,borderRadius:16,padding:20,border:`1px solid ${T.border}`,...style}}>{children}</div>;
const Badge = ({children,color=T.accent,bg=T.accentLight}) => <span style={{fontSize:11,fontWeight:700,color,background:bg,borderRadius:99,padding:"2px 9px",display:"inline-block"}}>{children}</span>;
const Toast = ({msg,onClose}) => { useEffect(()=>{if(msg){const t=setTimeout(onClose,3000);return()=>clearTimeout(t);}},[msg]); if(!msg)return null; return <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:T.text,color:T.white,borderRadius:12,padding:"12px 22px",fontSize:13,fontWeight:600,zIndex:9999,whiteSpace:"nowrap",boxShadow:"0 8px 24px rgba(0,0,0,.18)"}}>{msg}</div>; };

const StatCard = ({label,value,icon,accent=T.accent,accentBg=T.accentLight,sub}) => (
  <Card style={{display:"flex",flexDirection:"column",gap:6}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <span style={{fontSize:10,fontWeight:700,color:T.textLight,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</span>
      <div style={{width:32,height:32,borderRadius:9,background:accentBg,display:"flex",alignItems:"center",justifyContent:"center",color:accent}}>{icon}</div>
    </div>
    <div style={{fontSize:22,fontWeight:800,color:T.text,letterSpacing:"-0.5px"}}>{value}</div>
    {sub&&<div style={{fontSize:11,color:T.textMid}}>{sub}</div>}
  </Card>
);

const PeriodSelector = ({mode,onChange,showDia=false}) => (
  <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:2}}>
    {(showDia?["dia","semana","quincena","mes"]:["semana","quincena","mes"]).map(p=>(
      <button key={p} onClick={()=>onChange(p)} style={{padding:"8px 14px",borderRadius:10,border:`1px solid ${mode===p?T.accent:T.border}`,background:mode===p?T.accent:T.card,color:mode===p?T.white:T.textMid,fontFamily:"inherit",fontWeight:700,fontSize:12,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
        {p==="semana"?"Semana":p==="quincena"?"Quincena":p==="mes"?"Mes":"Día específico"}
      </button>
    ))}
  </div>
);

const SucursalPicker = ({value,onChange,sucursales,showAll=false}) => (
  <div style={{marginBottom:16}}>
    <label style={{fontSize:11,fontWeight:700,color:T.textLight,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:6}}>Sucursal</label>
    <select value={value} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${T.border}`,background:T.card,fontFamily:"inherit",fontSize:14,fontWeight:600,color:T.text,WebkitAppearance:"none",outline:"none",cursor:"pointer"}}>
      {showAll&&<option value="__all">Todas las sucursales</option>}
      {sucursales.map(s=><option key={s} value={s}>{s}</option>)}
    </select>
  </div>
);

const BarChart = ({data,onBarClick,activeBar}) => {
  const max=Math.max(...data.map(d=>d.value),1);
  return(
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height:72}}>
      {data.map((d,i)=>{
        const active=activeBar===d.label;
        return(
          <div key={i} onClick={()=>onBarClick(active?null:d)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,cursor:"pointer"}}>
            <div style={{width:"100%",borderRadius:"4px 4px 0 0",height:Math.max(4,(d.value/max)*60),background:active?T.primaryMid:d.value>0?T.accent:`${T.accent}33`,transition:"all .2s",border:active?`2px solid ${T.primary}`:"2px solid transparent",boxSizing:"border-box"}}/>
            <span style={{fontSize:9,color:active?T.primary:T.textLight,fontWeight:active?800:600}}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

const PieChart = ({data,size=110}) => {
  const total=data.reduce((a,b)=>a+b.value,0); if(!total||!data.length) return null;
  const cx=size/2,cy=size/2,r=size*0.38; let start=-Math.PI/2;
  const slices=data.map((d,i)=>{ const a=(d.value/total)*2*Math.PI,x1=cx+r*Math.cos(start),y1=cy+r*Math.sin(start),x2=cx+r*Math.cos(start+a),y2=cy+r*Math.sin(start+a),lg=a>Math.PI?1:0,path=`M${cx} ${cy}L${x1} ${y1}A${r} ${r} 0 ${lg} 1 ${x2} ${y2}Z`; start+=a; return{...d,path,color:T.pieColors[i%T.pieColors.length]}; });
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>{slices.map((s,i)=><path key={i} d={s.path} fill={s.color} stroke={T.white} strokeWidth="1.5"/>)}<circle cx={cx} cy={cy} r={r*0.48} fill={T.white}/></svg>;
};

const PieSection = ({title,data:pd}) => !pd.length?null:(
  <Card style={{marginBottom:16}}>
    <div style={{fontWeight:700,fontSize:14,color:T.text,marginBottom:14}}>{title}</div>
    <div style={{display:"flex",alignItems:"center",gap:16}}>
      <PieChart data={pd} size={110}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:6}}>
        {pd.slice(0,7).map((d,i)=>(
          <div key={d.name} style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:10,height:10,borderRadius:3,background:T.pieColors[i%T.pieColors.length],flexShrink:0}}/>
            <span style={{fontSize:11,color:T.textMid,flex:1}}>{d.name}</span>
            <span style={{fontSize:11,fontWeight:700}}>{fmt(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  </Card>
);

const EditModal = ({record,conceptos,onSave,onDelete,onClose}) => {
  const [monto,setMonto]=useState(String(record.monto));
  const [concepto,setConcepto]=useState(record.concepto);
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:500,display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.card,borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:480}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <span style={{fontWeight:800,fontSize:16}}>Editar registro</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:T.textLight}}><Icon name="close" size={20}/></button>
        </div>
        <div style={{marginBottom:12}}>
          <label style={{fontSize:11,fontWeight:700,color:T.textLight,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:6}}>Concepto</label>
          <select value={concepto} onChange={e=>setConcepto(e.target.value)} style={{width:"100%",padding:"12px",borderRadius:10,border:`1.5px solid ${T.border}`,fontFamily:"inherit",fontSize:14,color:T.text,WebkitAppearance:"none",outline:"none",background:T.card}}>
            {conceptos.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{fontSize:11,fontWeight:700,color:T.textLight,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:6}}>Monto ($)</label>
          <input type="number" inputMode="decimal" value={monto} onChange={e=>setMonto(e.target.value)} style={{width:"100%",padding:"12px",borderRadius:10,border:`1.5px solid ${T.border}`,fontFamily:"inherit",fontSize:15,color:T.text,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button onClick={()=>onSave({...record,concepto,monto:parseFloat(monto)})} style={{padding:"13px 0",borderRadius:12,border:"none",background:T.accent,color:T.white,fontFamily:"inherit",fontWeight:700,fontSize:14,cursor:"pointer"}}>Guardar</button>
          <button onClick={()=>onDelete(record.id)} style={{padding:"13px 0",borderRadius:12,border:`1.5px solid ${T.expense}`,background:T.expenseLight,color:T.expense,fontFamily:"inherit",fontWeight:700,fontSize:14,cursor:"pointer"}}>Eliminar</button>
        </div>
      </div>
    </div>
  );
};

const DayGroupCard = ({group,onEditRecord,onDeleteRecord}) => {
  const [open,setOpen]=useState(false);
  const tv=group.ventas.reduce((a,b)=>a+b.monto,0),tg=group.gastos.reduce((a,b)=>a+b.monto,0);
  const neto=tv-tg,diff=group.caja!=null?group.caja-neto:null,hasDiff=diff!=null&&Math.abs(diff)>0.01;
  const canEdit=onEditRecord!=null;
  return(
    <div style={{marginBottom:10,border:`1px solid ${hasDiff?T.warning:T.border}`,borderRadius:12,overflow:"hidden",background:hasDiff?"#FFFBF0":T.bg}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"none",border:"none",cursor:"pointer",textAlign:"left"}}>
        <div>
          <div style={{fontWeight:700,fontSize:13,color:T.text}}>{group.fecha} <span style={{color:T.textLight,fontWeight:500,fontSize:12}}>— {group.sucursal}</span></div>
          <div style={{fontSize:11,marginTop:2}}>
            <span style={{color:T.accent,fontWeight:600}}>+{fmt(tv)}</span>{"  "}
            <span style={{color:T.expense,fontWeight:600}}>−{fmt(tg)}</span>
            {group.nota&&<span style={{color:T.textLight,marginLeft:6}}>📝</span>}
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {hasDiff&&<Badge color={T.warning} bg={T.warningLight}>{diff>0?"+":""}{fmt(diff)}</Badge>}
          {group.caja==null&&<Badge color={T.textLight} bg={T.border}>Sin caja</Badge>}
          <Icon name={open?"chevDown":"chevRight"} size={16} color={T.textLight}/>
        </div>
      </button>
      {open&&(
        <div style={{padding:"0 14px 14px",borderTop:`1px solid ${T.border}`}}>
          {group.nota&&<div style={{marginTop:10,padding:"8px 12px",background:"#FEFCE8",borderRadius:8,fontSize:12,color:T.textMid,border:`1px solid #FEF08A`}}>📝 {group.nota}</div>}
          {group.ventas.length>0&&(
            <div style={{marginTop:10}}>
              <div style={{fontSize:11,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>Ventas</div>
              {group.ventas.map((v,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",fontSize:13,padding:"5px 0",borderBottom:`1px solid ${T.border}`,gap:6}}>
                  {canEdit&&<button onClick={()=>onEditRecord(v)} style={{background:T.accentLight,border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:6,color:T.accent,flexShrink:0,display:"flex",alignItems:"center"}}><Icon name="edit" size={13}/></button>}
                  <span style={{color:T.textMid,flex:1}}>{v.concepto}</span>
                  <span style={{fontWeight:600}}>{fmt(v.monto)}</span>
                  {canEdit&&<button onClick={()=>onDeleteRecord(v.id)} style={{background:T.expenseLight,border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:6,color:T.expense,flexShrink:0,display:"flex",alignItems:"center"}}><Icon name="trash" size={13}/></button>}
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",fontWeight:700,color:T.accent}}><span>Total ventas</span><span>{fmt(tv)}</span></div>
            </div>
          )}
          {group.gastos.length>0&&(
            <div style={{marginTop:6}}>
              <div style={{fontSize:11,fontWeight:700,color:T.expense,textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>Gastos</div>
              {group.gastos.map((g,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",fontSize:13,padding:"5px 0",borderBottom:`1px solid ${T.border}`,gap:6}}>
                  {canEdit&&<button onClick={()=>onEditRecord(g)} style={{background:T.accentLight,border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:6,color:T.accent,flexShrink:0,display:"flex",alignItems:"center"}}><Icon name="edit" size={13}/></button>}
                  <span style={{color:T.textMid,flex:1}}>{g.concepto}</span>
                  <span style={{fontWeight:600,color:T.expense}}>{fmt(g.monto)}</span>
                  {canEdit&&<button onClick={()=>onDeleteRecord(g.id)} style={{background:T.expenseLight,border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:6,color:T.expense,flexShrink:0,display:"flex",alignItems:"center"}}><Icon name="trash" size={13}/></button>}
                </div>
              ))}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,padding:"6px 0",fontWeight:700,color:T.expense}}><span>Total gastos</span><span>{fmt(tg)}</span></div>
            </div>
          )}
          <div style={{marginTop:8,padding:"10px 12px",background:hasDiff?T.warningLight:T.accentLight,borderRadius:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13}}><span style={{color:T.textMid,fontWeight:600}}>Esperado</span><span style={{fontWeight:700}}>{fmt(neto)}</span></div>
            {group.caja!=null&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginTop:3}}><span style={{color:T.textMid,fontWeight:600}}>Caja reportada</span><span style={{fontWeight:700}}>{fmt(group.caja)}</span></div>}
            {hasDiff&&<div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginTop:3}}><span style={{fontWeight:700,color:T.warning}}>Diferencia</span><span style={{fontWeight:800,color:T.warning}}>{diff>0?"+":""}{fmt(diff)}</span></div>}
          </div>
        </div>
      )}
    </div>
  );
};

const useBackup = (data,setData,toast) => {
  const [status,setStatus]=useState("idle");
  const [lastSync,setLastSync]=useState(LS.get("ventas_lastSync",null));
  const urlOk=APPS_SCRIPT_URL&&!APPS_SCRIPT_URL.includes("TU_URL");
  const saveToCloud=useCallback(async()=>{
    if(!urlOk){toast("URL no configurada");return;}setStatus("syncing");
    try{const res=await fetch(APPS_SCRIPT_URL,{method:"POST",body:JSON.stringify({records:data.records,sucursales:data.sucursales,conceptosVenta:data.conceptosVenta,conceptosGasto:data.conceptosGasto,_savedAt:new Date().toISOString()})});const j=await res.json();if(j.ok){const now=new Date().toISOString();setLastSync(now);LS.set("ventas_lastSync",now);setStatus("ok");toast(j.saved===false?`☁ ${j.reason||"sin cambios"}`:"✓ Respaldo guardado");}else throw new Error(j.error);}
    catch(e){setStatus("error");toast("Error: "+e.message);}
  },[data,urlOk]);
  const restoreFromCloud=useCallback(async()=>{
    if(!urlOk){toast("URL no configurada");return;}setStatus("syncing");
    try{const res=await fetch(APPS_SCRIPT_URL);const j=await res.json();if(j.empty){toast("Sin respaldo");setStatus("idle");return;}const recs=j.records||j.entries||[];setData(d=>({...d,records:recs,sucursales:j.sucursales||d.sucursales,conceptosVenta:j.conceptosVenta||d.conceptosVenta,conceptosGasto:j.conceptosGasto||d.conceptosGasto}));LS.set("ventas_records",recs);LS.set("ventas_sucursales",j.sucursales);LS.set("ventas_conceptosVenta",j.conceptosVenta);LS.set("ventas_conceptosGasto",j.conceptosGasto);const now=new Date().toISOString();setLastSync(now);LS.set("ventas_lastSync",now);setStatus("ok");toast("✓ Datos restaurados");}
    catch(e){setStatus("error");toast("Error: "+e.message);}
  },[urlOk]);
  useEffect(()=>{if(!urlOk)return;const id=setInterval(()=>saveToCloud(),30*60*1000);return()=>clearInterval(id);},[urlOk,saveToCloud]);
  return{status,lastSync,urlOk,saveToCloud,restoreFromCloud};
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
const Dashboard = ({data}) => {
  const [mode,setMode]=useState("semana");
  const [diaVal,setDiaVal]=useState(today());
  const [sucFilter,setSucFilter]=useState("__all");
  const [activeBar,setActiveBar]=useState(null);
  const now=new Date();

  const base=useMemo(()=>{let r=filterByPeriodMode(data.records,mode,diaVal);if(sucFilter!=="__all")r=r.filter(x=>x.sucursal===sucFilter);return r;},[data.records,mode,diaVal,sucFilter]);
  const displayed=useMemo(()=>activeBar?base.filter(r=>r.fecha===activeBar.fecha):base,[base,activeBar]);
  const tv=sumBy(displayed,"venta"),tg=sumBy(displayed,"gasto"),neto=tv-tg;

  const chartData=useMemo(()=>{
    if(mode==="semana"){return Array.from({length:7},(_,i)=>{const d=new Date(now);d.setDate(d.getDate()-(6-i));const ds=d.toISOString().split("T")[0];let r=data.records.filter(x=>x.fecha===ds&&x.tipo==="venta");if(sucFilter!=="__all")r=r.filter(x=>x.sucursal===sucFilter);return{label:DAYS_ES[d.getDay()],value:r.reduce((a,b)=>a+b.monto,0),fecha:ds};});}
    const dm={};base.filter(r=>r.tipo==="venta").forEach(r=>{dm[r.fecha]=(dm[r.fecha]||0)+r.monto;});
    return Object.entries(dm).sort().slice(-14).map(([ds,v])=>({label:new Date(ds+"T12:00:00").getDate()+"",value:v,fecha:ds}));
  },[base,mode,sucFilter,data.records]);

  const byConcepto=useMemo(()=>{const m={};displayed.filter(r=>r.tipo==="venta").forEach(r=>{m[r.concepto]=(m[r.concepto]||0)+r.monto;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));},[displayed]);
  const byBranch=useMemo(()=>{const m={};displayed.filter(r=>r.tipo==="venta").forEach(r=>{m[r.sucursal]=(m[r.sucursal]||0)+r.monto;});return Object.entries(m).sort((a,b)=>b[1]-a[1]);},[displayed]);
  const groups=useMemo(()=>activeBar?groupByDaySuc(displayed):[],[displayed,activeBar]);

  return(
    <div style={{paddingBottom:12}}>
      <PeriodSelector mode={mode} onChange={m=>{setMode(m);setActiveBar(null);}} showDia/>
      {mode==="dia"&&<div style={{marginBottom:16}}><input type="date" value={diaVal} onChange={e=>setDiaVal(e.target.value)} style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${T.border}`,fontFamily:"inherit",fontSize:14,color:T.text,outline:"none",background:T.card}}/></div>}
      <SucursalPicker value={sucFilter} onChange={v=>{setSucFilter(v);setActiveBar(null);}} sucursales={data.sucursales} showAll/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <StatCard label="Ventas" value={fmt(tv)} icon={<Icon name="trendUp" size={16}/>} accent={T.accent} accentBg={T.accentLight}/>
        <StatCard label="Gastos" value={fmt(tg)} icon={<Icon name="trendDown" size={16}/>} accent={T.expense} accentBg={T.expenseLight}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
        <StatCard label="Neto" value={fmt(neto)} icon={<Icon name="dollar" size={16}/>} accent={neto>=0?T.accent:T.expense} accentBg={neto>=0?T.accentLight:T.expenseLight}/>
        <StatCard label="Prom/día" value={fmt(tv/Math.max(chartData.filter(d=>d.value>0).length,1))} icon={<Icon name="bar" size={16}/>} accent={T.primaryMid} accentBg="#EEF2FF"/>
      </div>
      {chartData.length>0&&(
        <Card style={{marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontWeight:700,fontSize:14}}>Tendencia de ventas</span>
            {activeBar&&<button onClick={()=>setActiveBar(null)} style={{fontSize:11,color:T.accent,background:T.accentLight,border:"none",borderRadius:8,padding:"4px 10px",fontWeight:700,cursor:"pointer"}}>✕ Quitar filtro</button>}
          </div>
          {activeBar&&<div style={{fontSize:12,color:T.primaryMid,marginBottom:8,fontWeight:600}}>📅 {activeBar.fecha}</div>}
          <BarChart data={chartData} onBarClick={setActiveBar} activeBar={activeBar?.label}/>
          <div style={{fontSize:11,color:T.textLight,marginTop:6,textAlign:"center"}}>Toca una barra para ver el detalle</div>
        </Card>
      )}
      <PieSection title="Ventas por concepto" data={byConcepto}/>
      <Card style={{marginBottom:activeBar?16:0}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:14}}>Ranking por sucursal</div>
        {byBranch.length===0&&<div style={{color:T.textLight,fontSize:13,textAlign:"center",padding:"8px 0"}}>Sin datos</div>}
        {byBranch.map(([suc,val],i)=>{const pct=tv>0?(val/tv)*100:0;return(
          <div key={suc} style={{marginBottom:i<byBranch.length-1?14:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:26,height:26,borderRadius:7,background:i===0?T.accent:T.border,color:i===0?T.white:T.textMid,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:11}}>{i+1}</div><span style={{fontWeight:600,fontSize:13}}>{suc}</span></div>
              <div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:13}}>{fmt(val)}</div><div style={{fontSize:10,color:T.textLight}}>{pct.toFixed(1)}%</div></div>
            </div>
            <div style={{height:4,background:T.border,borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:i===0?T.accent:`${T.accent}66`,borderRadius:2}}/></div>
          </div>
        );})}
      </Card>
      {activeBar&&groups.length>0&&(
        <Card style={{marginTop:16}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Detalle del día</div>
          {groups.map((g,i)=><DayGroupCard key={i} group={g}/>)}
        </Card>
      )}
    </div>
  );
};

// ─── SUCURSAL DETAIL ──────────────────────────────────────────────────────────
const SucursalDetail = ({data}) => {
  const [selected,setSelected]=useState(data.sucursales[0]||"");
  const [mode,setMode]=useState("mes");
  const [diaVal,setDiaVal]=useState(today());
  useEffect(()=>{if(!selected&&data.sucursales.length)setSelected(data.sucursales[0]);},[data.sucursales]);
  const base=useMemo(()=>filterByPeriodMode(data.records,mode,diaVal).filter(r=>r.sucursal===selected),[data.records,selected,mode,diaVal]);
  const tv=sumBy(base,"venta"),tg=sumBy(base,"gasto"),neto=tv-tg,ratio=tv>0?(tg/tv)*100:0;
  const chartData=useMemo(()=>{const m={};base.filter(r=>r.tipo==="venta").forEach(r=>{m[r.fecha]=(m[r.fecha]||0)+r.monto;});return Object.entries(m).sort().slice(-14).map(([ds,v])=>({label:new Date(ds+"T12:00:00").getDate()+"",value:v,fecha:ds}));},[base]);
  const byConcepto=useMemo(()=>{const m={};base.filter(r=>r.tipo==="venta").forEach(r=>{m[r.concepto]=(m[r.concepto]||0)+r.monto;});return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value}));},[base]);
  const groups=useMemo(()=>groupByDaySuc(base),[base]);
  const diasConDiff=groups.filter(g=>{const tv=g.ventas.reduce((a,b)=>a+b.monto,0),tg=g.gastos.reduce((a,b)=>a+b.monto,0);return g.caja!=null&&Math.abs(g.caja-(tv-tg))>0.01;}).length;
  const diasGastoMayor=groups.filter(g=>g.gastos.reduce((a,b)=>a+b.monto,0)>g.ventas.reduce((a,b)=>a+b.monto,0)).length;
  const mejorDia=groups.reduce((best,g)=>{const v=g.ventas.reduce((a,b)=>a+b.monto,0);return v>best.v?{g,v}:best;},{g:null,v:0});
  return(
    <div style={{paddingBottom:12}}>
      <SucursalPicker value={selected} onChange={setSelected} sucursales={data.sucursales}/>
      <PeriodSelector mode={mode} onChange={m=>setMode(m)} showDia/>
      {mode==="dia"&&<div style={{marginBottom:16}}><input type="date" value={diaVal} onChange={e=>setDiaVal(e.target.value)} style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${T.border}`,fontFamily:"inherit",fontSize:14,color:T.text,outline:"none",background:T.card}}/></div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
        <StatCard label="Ventas" value={fmt(tv)} icon={<Icon name="trendUp" size={16}/>} accent={T.accent} accentBg={T.accentLight}/>
        <StatCard label="Gastos" value={fmt(tg)} icon={<Icon name="trendDown" size={16}/>} accent={T.expense} accentBg={T.expenseLight}/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        <StatCard label="Neto" value={fmt(neto)} icon={<Icon name="dollar" size={16}/>} accent={neto>=0?T.accent:T.expense} accentBg={neto>=0?T.accentLight:T.expenseLight}/>
        <StatCard label="Ratio gastos" value={`${ratio.toFixed(1)}%`} icon={<Icon name="bar" size={16}/>} accent={ratio>50?T.expense:T.accent} accentBg={ratio>50?T.expenseLight:T.accentLight}/>
      </div>
      <Card style={{marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Análisis del período</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div style={{padding:"10px 12px",background:diasConDiff>0?T.warningLight:T.successLight,borderRadius:10,textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:diasConDiff>0?T.warning:T.success}}>{diasConDiff}</div><div style={{fontSize:11,color:T.textMid,fontWeight:600}}>Días con diferencia en caja</div></div>
          <div style={{padding:"10px 12px",background:diasGastoMayor>0?T.expenseLight:T.successLight,borderRadius:10,textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:diasGastoMayor>0?T.expense:T.success}}>{diasGastoMayor}</div><div style={{fontSize:11,color:T.textMid,fontWeight:600}}>Días gastos {">"} ventas</div></div>
          <div style={{padding:"10px 12px",background:T.accentLight,borderRadius:10,textAlign:"center"}}><div style={{fontSize:22,fontWeight:800,color:T.accent}}>{groups.length}</div><div style={{fontSize:11,color:T.textMid,fontWeight:600}}>Días con registros</div></div>
          <div style={{padding:"10px 12px",background:"#F0FDF4",borderRadius:10,textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:T.success}}>{mejorDia.g?mejorDia.g.fecha.slice(5):"—"}</div><div style={{fontSize:11,color:T.textMid,fontWeight:600}}>Mejor día {mejorDia.v>0&&fmt(mejorDia.v)}</div></div>
        </div>
      </Card>
      {chartData.length>0&&<Card style={{marginBottom:16}}><div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Tendencia de ventas</div><BarChart data={chartData} onBarClick={()=>{}} activeBar={null}/></Card>}
      <PieSection title="Ventas por concepto" data={byConcepto}/>
      <Card><div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Historial completo</div>{groups.length===0&&<div style={{color:T.textLight,fontSize:13,textAlign:"center",padding:"12px 0"}}>Sin registros</div>}{groups.map((g,i)=><DayGroupCard key={i} group={g}/>)}</Card>
    </div>
  );
};

// ─── REGISTRO ─────────────────────────────────────────────────────────────────
const Registro = ({data,setData,toast}) => {
  const iS={width:"100%",padding:"13px 16px",borderRadius:12,border:`1.5px solid ${T.border}`,background:T.card,fontFamily:"inherit",fontSize:15,color:T.text,outline:"none",boxSizing:"border-box"};
  const lS={fontSize:11,fontWeight:700,color:T.textLight,textTransform:"uppercase",letterSpacing:".08em",display:"block",marginBottom:6};
  const [fecha,setFecha]=useState(today());
  const [sucursal,setSucursal]=useState(data.sucursales[0]||"");
  const [otraSuc,setOtraSuc]=useState("");
  const [vConcepto,setVConcepto]=useState(data.conceptosVenta[0]||"");
  const [vMonto,setVMonto]=useState("");
  const [gConcepto,setGConcepto]=useState(data.conceptosGasto[0]||"");
  const [gMonto,setGMonto]=useState("");
  const [cajaVal,setCajaVal]=useState("");
  const [nota,setNota]=useState("");
  const [showAddCV,setShowAddCV]=useState(false);
  const [showAddCG,setShowAddCG]=useState(false);
  const [newCV,setNewCV]=useState("");
  const [newCG,setNewCG]=useState("");
  const [editRec,setEditRec]=useState(null);

  const getSuc=()=>sucursal==="__otra"?otraSuc.trim():sucursal;
  const ensureSuc=(suc)=>{if(sucursal==="__otra"&&suc&&!data.sucursales.includes(suc)){const ns=[...data.sucursales,suc];setData(d=>({...d,sucursales:ns}));LS.set("ventas_sucursales",ns);}};
  const addCV=()=>{if(!newCV.trim())return;const a=[...data.conceptosVenta,newCV.trim().toUpperCase()];setData(d=>({...d,conceptosVenta:a}));LS.set("ventas_conceptosVenta",a);setVConcepto(newCV.trim().toUpperCase());setNewCV("");setShowAddCV(false);toast("Concepto añadido");};
  const addCG=()=>{if(!newCG.trim())return;const a=[...data.conceptosGasto,newCG.trim().toUpperCase()];setData(d=>({...d,conceptosGasto:a}));LS.set("ventas_conceptosGasto",a);setGConcepto(newCG.trim().toUpperCase());setNewCG("");setShowAddCG(false);toast("Concepto añadido");};

  const saveVenta=()=>{const suc=getSuc();if(!suc){toast("Selecciona sucursal");return;}if(!vMonto||isNaN(parseFloat(vMonto))){toast("Monto inválido");return;}ensureSuc(suc);const r={id:`v-${Date.now()}-${Math.random().toString(36).slice(2)}`,fecha,sucursal:suc,tipo:"venta",concepto:vConcepto,monto:parseFloat(vMonto)};const nr=[...data.records,r];setData(d=>({...d,records:nr}));LS.set("ventas_records",nr);setVMonto("");toast("✓ Venta guardada");};
  const saveGasto=()=>{const suc=getSuc();if(!suc){toast("Selecciona sucursal");return;}if(!gMonto||isNaN(parseFloat(gMonto))){toast("Monto inválido");return;}ensureSuc(suc);const r={id:`g-${Date.now()}-${Math.random().toString(36).slice(2)}`,fecha,sucursal:suc,tipo:"gasto",concepto:gConcepto,monto:parseFloat(gMonto)};const nr=[...data.records,r];setData(d=>({...d,records:nr}));LS.set("ventas_records",nr);setGMonto("");toast("✓ Gasto guardado");};
  const saveCaja=()=>{const suc=getSuc();if(!suc){toast("Selecciona sucursal");return;}if(!cajaVal||isNaN(parseFloat(cajaVal))){toast("Monto inválido");return;}ensureSuc(suc);const filtered=data.records.filter(r=>!(r.fecha===fecha&&r.sucursal===suc&&r.tipo==="caja"));const r={id:`c-${Date.now()}`,fecha,sucursal:suc,tipo:"caja",concepto:"CAJA",monto:parseFloat(cajaVal)};const nr=[...filtered,r];setData(d=>({...d,records:nr}));LS.set("ventas_records",nr);setCajaVal("");toast("✓ Caja guardada");};
  const saveNota=()=>{const suc=getSuc();if(!suc){toast("Selecciona sucursal");return;}if(!nota.trim()){toast("Escribe una nota");return;}ensureSuc(suc);const filtered=data.records.filter(r=>!(r.fecha===fecha&&r.sucursal===suc&&r.tipo==="nota"));const r={id:`n-${Date.now()}`,fecha,sucursal:suc,tipo:"nota",concepto:"NOTA",monto:0,texto:nota.trim()};const nr=[...filtered,r];setData(d=>({...d,records:nr}));LS.set("ventas_records",nr);toast("✓ Nota guardada");};

  const handleEditSave=(updated)=>{const nr=data.records.map(r=>r.id===updated.id?updated:r);setData(d=>({...d,records:nr}));LS.set("ventas_records",nr);setEditRec(null);toast("✓ Actualizado");};
  const handleDelete=(id)=>{if(!window.confirm("¿Eliminar este registro?"))return;const nr=data.records.filter(r=>r.id!==id);setData(d=>({...d,records:nr}));LS.set("ventas_records",nr);setEditRec(null);toast("Eliminado");};

  const suc=getSuc();
  const dayRecs=data.records.filter(r=>r.fecha===fecha&&r.sucursal===suc);
  const dayVentas=dayRecs.filter(r=>r.tipo==="venta");
  const dayGastos=dayRecs.filter(r=>r.tipo==="gasto");
  const dayTV=dayVentas.reduce((a,b)=>a+b.monto,0);
  const dayTG=dayGastos.reduce((a,b)=>a+b.monto,0);
  const dayCaja=dayRecs.find(r=>r.tipo==="caja")?.monto??null;

  useEffect(()=>{const n=dayRecs.find(r=>r.tipo==="nota")?.texto||"";setNota(n);},[fecha,suc]);

  const allGroups=useMemo(()=>groupByDaySuc(data.records),[data.records]);

  return(
    <div style={{paddingBottom:12}}>
      {/* Contexto */}
      <Card style={{marginBottom:12}}>
        <div style={{fontWeight:800,fontSize:15,color:T.primary,marginBottom:16}}>Contexto del registro</div>
        <div style={{marginBottom:12}}><label style={lS}>Fecha</label><input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={iS}/></div>
        <div>
          <label style={lS}>Sucursal</label>
          <select value={sucursal} onChange={e=>setSucursal(e.target.value)} style={iS}>{data.sucursales.map(s=><option key={s} value={s}>{s}</option>)}<option value="__otra">OTRA...</option></select>
          {sucursal==="__otra"&&<input value={otraSuc} onChange={e=>setOtraSuc(e.target.value)} placeholder="Nombre de la sucursal" style={{...iS,marginTop:8}}/>}
        </div>
      </Card>

      {/* VENTA */}
      <Card style={{marginBottom:6,border:`1px solid ${T.accentLight}`}}>
        <div style={{fontWeight:800,fontSize:13,color:T.accent,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Registrar Venta</div>
        <div style={{marginBottom:10}}><label style={lS}>Concepto</label>
          <select value={vConcepto} onChange={e=>{if(e.target.value==="__nuevo")setShowAddCV(true);else setVConcepto(e.target.value);}} style={iS}>{data.conceptosVenta.map(c=><option key={c} value={c}>{c}</option>)}<option value="__nuevo">＋ Nuevo concepto...</option></select>
          {showAddCV&&<div style={{display:"flex",gap:8,marginTop:8}}><input value={newCV} onChange={e=>setNewCV(e.target.value)} placeholder="Nuevo concepto" style={{...iS,flex:1}} onKeyDown={e=>e.key==="Enter"&&addCV()}/><button onClick={addCV} style={{padding:"0 14px",height:50,borderRadius:10,border:"none",background:T.accent,color:T.white,fontWeight:700,cursor:"pointer"}}>OK</button><button onClick={()=>setShowAddCV(false)} style={{padding:"0 10px",height:50,borderRadius:10,border:`1px solid ${T.border}`,background:T.card,color:T.textMid,cursor:"pointer"}}>✕</button></div>}
        </div>
        <div style={{marginBottom:12}}><label style={lS}>Monto ($)</label><input type="number" inputMode="decimal" min="0" step="0.01" value={vMonto} onChange={e=>setVMonto(e.target.value)} placeholder="0.00" style={iS}/></div>
        <button onClick={saveVenta} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"none",background:T.accent,color:T.white,fontFamily:"inherit",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="plus" size={16} color={T.white}/> Agregar Venta</button>
      </Card>

      {/* Ventas del día */}
      {dayVentas.length>0&&(
        <div style={{background:`${T.accentLight}99`,borderRadius:12,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:T.accent,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>Ventas de hoy — {suc}</div>
          {dayVentas.map((v,i)=>(
            <div key={v.id} style={{display:"flex",alignItems:"center",fontSize:13,padding:"5px 0",borderBottom:i<dayVentas.length-1?`1px solid ${T.border}`:undefined,gap:6}}>
              <button onClick={()=>setEditRec(v)} style={{background:T.accentLight,border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:6,color:T.accent,flexShrink:0,display:"flex",alignItems:"center"}}><Icon name="edit" size={13}/></button>
              <span style={{color:T.primaryMid,flex:1}}>{v.concepto}</span>
              <span style={{fontWeight:700}}>{fmt(v.monto)}</span>
              <button onClick={()=>handleDelete(v.id)} style={{background:T.expenseLight,border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:6,color:T.expense,flexShrink:0,display:"flex",alignItems:"center"}}><Icon name="trash" size={13}/></button>
            </div>
          ))}
          <div style={{fontSize:13,fontWeight:700,color:T.accent,textAlign:"right",marginTop:8}}>Total: {fmt(dayTV)}</div>
        </div>
      )}

      {/* GASTO */}
      <Card style={{marginBottom:6,border:`1px solid ${T.expenseLight}`}}>
        <div style={{fontWeight:800,fontSize:13,color:T.expense,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Registrar Gasto</div>
        <div style={{marginBottom:10}}><label style={lS}>Concepto</label>
          <select value={gConcepto} onChange={e=>{if(e.target.value==="__nuevo")setShowAddCG(true);else setGConcepto(e.target.value);}} style={iS}>{data.conceptosGasto.map(c=><option key={c} value={c}>{c}</option>)}<option value="__nuevo">＋ Nuevo concepto...</option></select>
          {showAddCG&&<div style={{display:"flex",gap:8,marginTop:8}}><input value={newCG} onChange={e=>setNewCG(e.target.value)} placeholder="Nuevo concepto" style={{...iS,flex:1}} onKeyDown={e=>e.key==="Enter"&&addCG()}/><button onClick={addCG} style={{padding:"0 14px",height:50,borderRadius:10,border:"none",background:T.expense,color:T.white,fontWeight:700,cursor:"pointer"}}>OK</button><button onClick={()=>setShowAddCG(false)} style={{padding:"0 10px",height:50,borderRadius:10,border:`1px solid ${T.border}`,background:T.card,color:T.textMid,cursor:"pointer"}}>✕</button></div>}
        </div>
        <div style={{marginBottom:12}}><label style={lS}>Monto ($)</label><input type="number" inputMode="decimal" min="0" step="0.01" value={gMonto} onChange={e=>setGMonto(e.target.value)} placeholder="0.00" style={iS}/></div>
        <button onClick={saveGasto} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"none",background:T.expense,color:T.white,fontFamily:"inherit",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="plus" size={16} color={T.white}/> Agregar Gasto</button>
      </Card>

      {/* Gastos del día */}
      {dayGastos.length>0&&(
        <div style={{background:`${T.expenseLight}99`,borderRadius:12,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:T.expense,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>Gastos de hoy — {suc}</div>
          {dayGastos.map((g,i)=>(
            <div key={g.id} style={{display:"flex",alignItems:"center",fontSize:13,padding:"5px 0",borderBottom:i<dayGastos.length-1?`1px solid ${T.border}`:undefined,gap:6}}>
              <button onClick={()=>setEditRec(g)} style={{background:T.accentLight,border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:6,color:T.accent,flexShrink:0,display:"flex",alignItems:"center"}}><Icon name="edit" size={13}/></button>
              <span style={{color:"#7f1d1d",flex:1}}>{g.concepto}</span>
              <span style={{fontWeight:700,color:T.expense}}>{fmt(g.monto)}</span>
              <button onClick={()=>handleDelete(g.id)} style={{background:T.expenseLight,border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:6,color:T.expense,flexShrink:0,display:"flex",alignItems:"center"}}><Icon name="trash" size={13}/></button>
            </div>
          ))}
          <div style={{fontSize:13,fontWeight:700,color:T.expense,textAlign:"right",marginTop:8}}>Total: {fmt(dayTG)}</div>
        </div>
      )}

      {/* CAJA */}
      <Card style={{marginBottom:6,border:`1px solid ${T.warningLight}`}}>
        <div style={{fontWeight:800,fontSize:13,color:T.warning,textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>Monto en Caja</div>
        {dayTV>0&&<div style={{marginBottom:10,padding:"8px 12px",background:T.accentLight,borderRadius:8,fontSize:12,color:T.primaryMid}}>Ventas: <strong>{fmt(dayTV)}</strong> · Gastos: <strong>{fmt(dayTG)}</strong> · Esperado: <strong>{fmt(dayTV-dayTG)}</strong>{dayCaja!=null&&<span> · Actual: <strong>{fmt(dayCaja)}</strong></span>}</div>}
        <div style={{marginBottom:12}}><label style={lS}>Efectivo al cierre ($)</label><input type="number" inputMode="decimal" min="0" step="0.01" value={cajaVal} onChange={e=>setCajaVal(e.target.value)} placeholder={dayCaja!=null?String(dayCaja):"0.00"} style={iS}/></div>
        <button onClick={saveCaja} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"none",background:T.warning,color:T.white,fontFamily:"inherit",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="check" size={16} color={T.white}/> Guardar Caja</button>
      </Card>

      {/* NOTA */}
      <Card style={{marginBottom:12,border:`1px solid #FEF08A`}}>
        <div style={{fontWeight:800,fontSize:13,color:"#854D0E",textTransform:"uppercase",letterSpacing:".06em",marginBottom:12}}>📝 Nota del día</div>
        <div style={{marginBottom:12}}><textarea value={nota} onChange={e=>setNota(e.target.value)} placeholder="Observaciones, eventos especiales, comentarios del día..." rows={3} style={{width:"100%",padding:"12px 14px",borderRadius:12,border:`1.5px solid ${T.border}`,fontFamily:"inherit",fontSize:14,color:T.text,resize:"vertical",outline:"none",boxSizing:"border-box",lineHeight:1.5}}/></div>
        <button onClick={saveNota} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"none",background:"#854D0E",color:T.white,fontFamily:"inherit",fontWeight:800,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="note" size={16} color={T.white}/> Guardar Nota</button>
      </Card>

      {/* Historial completo con edición */}
      <Card>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Historial de registros</div>
        {allGroups.length===0&&<div style={{color:T.textLight,fontSize:13,textAlign:"center",padding:"10px 0"}}>Sin registros</div>}
        {allGroups.map((g,i)=><DayGroupCard key={i} group={g} onEditRecord={setEditRec} onDeleteRecord={handleDelete}/>)}
      </Card>

      {editRec&&<EditModal record={editRec} conceptos={editRec.tipo==="venta"?data.conceptosVenta:data.conceptosGasto} onSave={handleEditSave} onDelete={handleDelete} onClose={()=>setEditRec(null)}/>}
    </div>
  );
};

// ─── BALANCE ──────────────────────────────────────────────────────────────────
const Balance = ({data}) => {
  const [mode,setMode]=useState("mes");
  const [diaVal,setDiaVal]=useState(today());
  const [sucFilter,setSucFilter]=useState("__all");
  const base=useMemo(()=>{let r=filterByPeriodMode(data.records,mode,diaVal);if(sucFilter!=="__all")r=r.filter(x=>x.sucursal===sucFilter);return r;},[data.records,mode,diaVal,sucFilter]);
  const groups=useMemo(()=>groupByDaySuc(base),[base]);
  const faltantes=groups.filter(g=>{const tv=g.ventas.reduce((a,b)=>a+b.monto,0),tg=g.gastos.reduce((a,b)=>a+b.monto,0);return g.caja!=null&&Math.abs(g.caja-(tv-tg))>0.01;});
  const totalFaltante=faltantes.reduce((a,g)=>{const tv=g.ventas.reduce((x,b)=>x+b.monto,0),tg=g.gastos.reduce((x,b)=>x+b.monto,0);return a+Math.abs(g.caja-(tv-tg));},0);
  return(
    <div style={{paddingBottom:12}}>
      <PeriodSelector mode={mode} onChange={m=>setMode(m)} showDia/>
      {mode==="dia"&&<div style={{marginBottom:16}}><input type="date" value={diaVal} onChange={e=>setDiaVal(e.target.value)} style={{width:"100%",padding:"12px 16px",borderRadius:12,border:`1px solid ${T.border}`,fontFamily:"inherit",fontSize:14,color:T.text,outline:"none",background:T.card}}/></div>}
      <SucursalPicker value={sucFilter} onChange={setSucFilter} sucursales={data.sucursales} showAll/>
      <Card style={{marginBottom:16,background:faltantes.length>0?"#FFFBF0":"#F0FDF4",borderColor:faltantes.length>0?T.warning:"#BBF7D0"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,background:faltantes.length>0?T.warningLight:T.accentLight,display:"flex",alignItems:"center",justifyContent:"center",color:faltantes.length>0?T.warning:T.accent}}><Icon name={faltantes.length>0?"warning":"check"} size={22}/></div>
          <div><div style={{fontSize:12,fontWeight:600,color:T.textMid}}>{faltantes.length>0?`${faltantes.length} diferencia(s) en caja`:"Sin diferencias en caja"}</div>{faltantes.length>0&&<div style={{fontSize:22,fontWeight:800,color:T.warning}}>−{fmt(totalFaltante)}</div>}</div>
        </div>
      </Card>
      <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Detalle por día y sucursal</div>
      {groups.length===0&&<div style={{color:T.textLight,fontSize:13,textAlign:"center",padding:"24px 0"}}>Sin datos</div>}
      {groups.map((g,i)=><DayGroupCard key={i} group={g}/>)}
    </div>
  );
};

// ─── BACKUPS ──────────────────────────────────────────────────────────────────
const Backups = ({backup,data,setData,toast}) => {
  const {status,lastSync,urlOk,saveToCloud,restoreFromCloud}=backup;
  const handleExportJSON=()=>{const b=new Blob([JSON.stringify({records:data.records,sucursales:data.sucursales,conceptosVenta:data.conceptosVenta,conceptosGasto:data.conceptosGasto,exportedAt:new Date().toISOString()},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`ventas_backup_${today()}.json`;a.click();toast("✓ JSON descargado");};
  const handleExportExcel=()=>{exportExcel(data.records);toast("✓ Excel descargado");};
  const handleImport=(e)=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=(ev)=>{try{const p=JSON.parse(ev.target.result);const recs=p.records||p.entries||[];setData(d=>({...d,records:recs,sucursales:p.sucursales||d.sucursales,conceptosVenta:p.conceptosVenta||d.conceptosVenta,conceptosGasto:p.conceptosGasto||d.conceptosGasto}));LS.set("ventas_records",recs);LS.set("ventas_sucursales",p.sucursales);LS.set("ventas_conceptosVenta",p.conceptosVenta);LS.set("ventas_conceptosGasto",p.conceptosGasto);toast("✓ Datos importados");}catch{toast("Error al leer");}};r.readAsText(f);};
  const handleClear=()=>{if(window.confirm("¿Eliminar TODOS los registros?")){{setData(d=>({...d,records:[]}));LS.set("ventas_records",[]);toast("Datos eliminados");}};};
  const sC={idle:T.textLight,syncing:T.warning,ok:T.success,error:T.expense};
  const sL={idle:"Sin sincronizar",syncing:"Guardando...",ok:"Sincronizado",error:"Error"};
  return(
    <div style={{paddingBottom:12}}>
      <Card style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:40,height:40,borderRadius:12,background:T.accentLight,display:"flex",alignItems:"center",justifyContent:"center",color:T.accent}}><Icon name="cloud" size={20}/></div><div><div style={{fontWeight:700,fontSize:14}}>Respaldo en la nube</div><div style={{fontSize:11,color:sC[status],fontWeight:600}}>{sL[status]}</div></div></div>
          <div style={{width:10,height:10,borderRadius:99,background:sC[status]}}/>
        </div>
        {lastSync&&<div style={{fontSize:11,color:T.textLight,marginBottom:12}}>Último: {new Date(lastSync).toLocaleString("es-SV")}</div>}
        {!urlOk?<div style={{padding:"12px 14px",borderRadius:10,background:T.warningLight,fontSize:12,color:T.warning,fontWeight:600}}>⚠ URL del script no configurada</div>
        :<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button onClick={saveToCloud} style={{padding:"12px 0",borderRadius:12,border:"none",background:T.accent,color:T.white,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="cloudUp" size={16} color={T.white}/> Guardar</button>
          <button onClick={restoreFromCloud} style={{padding:"12px 0",borderRadius:12,border:`1.5px solid ${T.border}`,background:T.card,color:T.primaryMid,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Icon name="cloudDown" size={16}/> Restaurar</button>
        </div>}
      </Card>
      <Card style={{marginBottom:14,background:"#EFF6FF",borderColor:T.accentLight}}><div style={{fontSize:12,color:T.primaryMid,lineHeight:1.7}}><strong>Respaldo automático</strong> cada 30 min con conexión.<br/>Para dudas contacta al administrador.</div></Card>
      <Card style={{marginBottom:14}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:12}}>Descargar datos</div>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <button onClick={handleExportExcel} style={{padding:"12px 16px",borderRadius:12,border:`1.5px solid ${T.border}`,background:"#F0FDF4",color:T.success,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}><Icon name="excel" size={18} color={T.success}/><div><div style={{fontWeight:700}}>Descargar Excel / CSV</div><div style={{fontSize:11,color:T.textLight}}>{data.records.filter(r=>r.tipo!=="caja"&&r.tipo!=="nota").length} movimientos</div></div></button>
          <button onClick={handleExportJSON} style={{padding:"12px 16px",borderRadius:12,border:`1.5px solid ${T.border}`,background:T.card,color:T.text,fontFamily:"inherit",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:10}}><Icon name="cloudDown" size={18} color={T.primaryMid}/><div><div style={{fontWeight:700}}>Descargar respaldo JSON</div><div style={{fontSize:11,color:T.textLight}}>{data.records.length} registros</div></div></button>
          <label style={{padding:"12px 16px",borderRadius:12,border:`1.5px solid ${T.border}`,background:T.card,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}><Icon name="cloudUp" size={18} color={T.primaryMid}/><div><div style={{fontWeight:700,fontSize:13}}>Importar respaldo JSON</div><div style={{fontSize:11,color:T.textLight}}>Seleccionar archivo</div></div><input type="file" accept=".json" onChange={handleImport} style={{display:"none"}}/></label>
        </div>
      </Card>
      <Card style={{borderColor:T.expenseLight}}><div style={{fontWeight:700,fontSize:14,color:T.expense,marginBottom:12}}>Zona peligrosa</div><button onClick={handleClear} style={{padding:"12px 16px",borderRadius:12,border:`1.5px solid ${T.expense}`,background:T.expenseLight,color:T.expense,fontFamily:"inherit",fontWeight:700,fontSize:13,cursor:"pointer",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><Icon name="trash" size={16} color={T.expense}/> Eliminar todos los datos</button></Card>
    </div>
  );
};

// ─── APP ──────────────────────────────────────────────────────────────────────
const TABS=[
  {id:"dashboard",label:"Inicio",icon:"dashboard",title:"Panel general"},
  {id:"sucursal",label:"Sucursal",icon:"store",title:"Por sucursal"},
  {id:"registro",label:"Registrar",icon:"plus",title:"Nueva entrada"},
  {id:"balance",label:"Balance",icon:"wallet",title:"Balances y faltantes"},
];
const ALL_SECTIONS=[...TABS,{id:"respaldo",label:"Respaldo",icon:"cloud",title:"Respaldo"}];

function App() {
  const [tab,setTab]=useState("dashboard");
  const [sidebar,setSidebar]=useState(false);
  const [toast,setToast]=useState("");
  const showToast=(m)=>setToast(m);
  const [data,setData]=useState(()=>({
    records:   LS.get("ventas_records",null)??genSeedData(),
    sucursales: LS.get("ventas_sucursales",null)??SUCURSALES_DEFAULT,
    conceptosVenta: LS.get("ventas_conceptosVenta",null)??CV_DEFAULT,
    conceptosGasto: LS.get("ventas_conceptosGasto",null)??CG_DEFAULT,
  }));
  useEffect(()=>{LS.set("ventas_records",data.records);},[data.records]);
  const backup=useBackup(data,setData,showToast);
  const title=ALL_SECTIONS.find(t=>t.id===tab)?.title||"";
  const views={dashboard:<Dashboard data={data}/>,sucursal:<SucursalDetail data={data}/>,registro:<Registro data={data} setData={setData} toast={showToast}/>,balance:<Balance data={data}/>,respaldo:<Backups backup={backup} data={data} setData={setData} toast={showToast}/>};
  return(
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:T.bg,minHeight:"100dvh",maxWidth:480,margin:"0 auto",position:"relative"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');*{box-sizing:border-box}input:focus,select:focus,textarea:focus{border-color:${T.accent}!important;outline:none}input[type=date]::-webkit-calendar-picker-indicator{opacity:.5}select{-webkit-appearance:none}`}</style>
      <header style={{position:"sticky",top:0,zIndex:100,background:`${T.bg}EE`,backdropFilter:"blur(12px)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`}}>
        <button onClick={()=>setSidebar(true)} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:T.text}}><Icon name="menu" size={22}/></button>
        <div style={{fontWeight:900,fontSize:20,color:T.primary,letterSpacing:"-0.5px"}}>Ventas</div>
        <div style={{width:34,height:34,borderRadius:10,background:T.primary,display:"flex",alignItems:"center",justifyContent:"center",color:T.white,fontSize:13,fontWeight:800}}>{backup.status==="syncing"?"↻":backup.status==="ok"?"✓":<Icon name="cloud" size={16} color={T.white}/>}</div>
      </header>
      <div style={{padding:"14px 20px 4px"}}><div style={{fontSize:22,fontWeight:900,color:T.text,letterSpacing:"-0.5px"}}>{title}</div></div>
      <main style={{padding:"10px 20px 100px"}}>{views[tab]}</main>
      <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:`${T.card}F8`,backdropFilter:"blur(16px)",borderTop:`1px solid ${T.border}`,display:"flex",padding:"10px 8px 20px",gap:4,zIndex:50}}>
        {TABS.map(t=>{const active=tab===t.id;return(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:active?T.primary:"none",border:"none",cursor:"pointer",padding:"8px 4px",borderRadius:12}}>
            <div style={{color:active?T.white:T.textLight}}>{t.id==="registro"?<div style={{width:30,height:30,borderRadius:9,background:active?T.accent:T.accentLight,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="plus" size={18} color={active?T.white:T.accent}/></div>:<Icon name={t.icon} size={20} color={active?T.white:T.textLight}/>}</div>
            <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em",color:active?T.white:T.textLight}}>{t.label}</span>
          </button>
        );})}
      </nav>
      {sidebar&&(<>
        <div onClick={()=>setSidebar(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",zIndex:200}}/>
        <aside style={{position:"fixed",top:0,left:0,bottom:0,width:280,zIndex:201,background:T.primary,display:"flex",flexDirection:"column"}}>
          <div style={{padding:"52px 24px 20px",borderBottom:"1px solid rgba(255,255,255,.1)",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:26,fontWeight:900,color:T.white,letterSpacing:"-0.5px"}}>Ventas</div><button onClick={()=>setSidebar(false)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,.6)",padding:4}}><Icon name="close" size={22}/></button></div>
            <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:4}}>{data.records.filter(r=>r.tipo!=="nota").length} registros · {data.sucursales.length} sucursales</div>
          </div>
          {ALL_SECTIONS.map(t=>{const active=tab===t.id;return(
            <button key={t.id} onClick={()=>{setTab(t.id);setSidebar(false);}} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 24px",background:active?"rgba(255,255,255,.12)":"none",border:"none",cursor:"pointer",borderLeft:`3px solid ${active?T.accent:"transparent"}`,color:active?T.white:"rgba(255,255,255,.6)"}}>
              <Icon name={t.icon} size={20} color={active?T.white:"rgba(255,255,255,.6)"}/><span style={{fontWeight:700,fontSize:14}}>{t.title}</span>
            </button>
          );})}
          <div style={{marginTop:"auto",padding:"16px 24px",borderTop:"1px solid rgba(255,255,255,.1)"}}><div style={{fontSize:11,color:"rgba(255,255,255,.35)",fontWeight:600}}>{backup.urlOk?(backup.status==="ok"?"☁ Nube activa":"☁ Nube configurada"):"⚪ Nube no configurada"}<br/>{backup.lastSync?`Último: ${new Date(backup.lastSync).toLocaleDateString("es-SV")}`:"Sin respaldo aún"}</div></div>
        </aside>
      </>)}
      <Toast msg={toast} onClose={()=>setToast("")}/>
    </div>
  );
}

window.App = App;
