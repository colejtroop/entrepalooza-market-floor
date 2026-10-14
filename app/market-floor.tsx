"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type AnyMap = Record<string, any>;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

async function request(body?: AnyMap, adminCode?: string, query = ""): Promise<AnyMap> {
  const response = await fetch(`/api/game${query}`, body ? { method: "POST", headers: { "content-type": "application/json", ...(adminCode ? { "x-admin-code": adminCode } : {}) }, body: JSON.stringify(body) } : { headers: adminCode ? { "x-admin-code": adminCode } : {} });
  const result: AnyMap = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}

export default function MarketFloor() {
  const [state,setState]=useState<AnyMap|null>(null),[teamKey,setTeamKey]=useState<AnyMap|null>(null),[adminCode,setAdminCode]=useState(""),[mode,setMode]=useState<"board"|"player"|"admin">("board"),[error,setError]=useState("");
  useEffect(()=>{ const saved=localStorage.getItem("market-floor-team"); if(saved) setTeamKey(JSON.parse(saved)); },[]);
  const load=useCallback(async()=>{ try { const q=teamKey?`?teamId=${teamKey.id}&code=${teamKey.code}`:""; setState(await request(undefined,undefined,q)); setError(""); } catch(e){setError((e as Error).message)} },[teamKey]);
  useEffect(()=>{load(); const id=setInterval(load,3000); return()=>clearInterval(id)},[load]);
  const saveTeam=(key:AnyMap)=>{localStorage.setItem("market-floor-team",JSON.stringify(key));setTeamKey(key);setMode("player")};
  return <main>
    <Header state={state} mode={mode} setMode={setMode}/>
    {state?.announcement?.text&&<div className="announcement"><b>MARKET NOTICE</b><span>{state.announcement.text}</span></div>}
    {error&&<div className="error">{error}</div>}
    {mode==="board"&&<Board state={state}/>} 
    {mode==="player"&&(!teamKey?<Access state={state} saveTeam={saveTeam}/>:<Player state={state} teamKey={teamKey} refresh={load}/>)}
    {mode==="admin"&&<Admin state={state} code={adminCode} setCode={setAdminCode} refresh={load}/>} 
  </main>;
}

function Header({state,mode,setMode}:AnyMap){
  const game=state?.game||{}; return <>
    <header className="topbar"><div><p className="eyebrow">LEHIGH ENTREPRENEURSHIP CLUB</p><h1>MARKET FLOOR</h1></div><div className="round"><span>Q{game.quarter||0}</span><b>{String(game.status||"loading").toUpperCase()}</b></div></header>
    <nav>{[["board","Market board"],["player","Company desk"],["admin","Facilitator"]].map(([key,label])=><button key={key} className={mode===key?"active":""} onClick={()=>setMode(key as any)}>{label}</button>)}</nav>
  </>;
}

function Board({state}:AnyMap){
  if(!state)return <Loading/>; const event=state.events.find((e:AnyMap)=>e.key===state.game.event_key);
  return <section className="page board-page">
    <div className="market-strip"><div><small>CURRENT EVENT</small><strong>{event?.name||"Waiting for market open"}</strong><p>{event?.brief}</p></div><div><small>DIRECT EFFECT</small><p>{event?.effect||"The facilitator will open Q1 shortly."}</p></div></div>
    <div className="table-wrap"><table><thead><tr><th>Rank</th><th>Company</th><th>Value</th><th>Move</th><th>Customers</th><th>Share</th><th>Status</th></tr></thead><tbody>
      {state.teams.length?state.teams.map((team:AnyMap)=><tr key={team.id}><td className="rank">{String(team.rank).padStart(2,"0")}</td><td><b>{team.name}</b><small>{team.specialization} / {team.segment}</small></td><td>{money.format(team.valuation)}</td><td className={team.last_change>=0?"up":"down"}>{team.last_change>=0?"+":""}{pct.format(team.last_change||0)}</td><td>{team.customers}</td><td>{pct.format(team.marketShare)}</td><td><Status value={team.status}/></td></tr>):<tr><td colSpan={7} className="empty">Companies appear here as teams register.</td></tr>}
    </tbody></table></div>
    {state.game.status==="finished"&&<Awards awards={state.awards}/>} 
  </section>;
}

function Awards({awards}:AnyMap){ const rows=[["Highest Company Value",awards?.value],["Most Cash",awards?.cash],["Greatest Social Impact",awards?.impact],["Boldest Risk-Taker",awards?.risk]]; return <div className="awards"><h2>FINAL AWARDS</h2>{rows.map(([label,winner])=><div key={label}><small>{label}</small><b>{winner||"—"}</b></div>)}</div> }

function Access({state,saveTeam}:AnyMap){
  const [join,setJoin]=useState(""),[name,setName]=useState(""),[specialization,setSpecialization]=useState("Sales"),[segment,setSegment]=useState("Solo professionals"),[message,setMessage]=useState("");
  const act=async(body:AnyMap)=>{try{const result=await request(body);saveTeam(result)}catch(e){setMessage((e as Error).message)}};
  return <section className="page access-grid"><form onSubmit={e=>{e.preventDefault();act({action:"createTeam",name,specialization,segment})}}><p className="section-no">01</p><h2>OPEN A COMPANY</h2><label>Permanent company name<input value={name} onChange={e=>setName(e.target.value)} maxLength={30} required/></label><label>Starting product<select value={specialization} onChange={e=>setSpecialization(e.target.value)}>{state?.specializations?.map((x:string)=><option key={x}>{x}</option>)}</select></label><label>Starting segment<select value={segment} onChange={e=>setSegment(e.target.value)}>{state?.segments?.map((x:string)=><option key={x}>{x}</option>)}</select></label><button className="primary">Create company</button></form>
    <form onSubmit={e=>{e.preventDefault();act({action:"loginTeam",code:join})}}><p className="section-no">02</p><h2>JOIN CO-OWNERS</h2><p>Enter the six-character code shown on your team leader’s screen.</p><label>Company code<input className="code" value={join} onChange={e=>setJoin(e.target.value.toUpperCase())} maxLength={6}/></label><button className="primary">Join company</button>{message&&<p className="form-error">{message}</p>}</form></section>;
}

function Player({state,teamKey,refresh}:AnyMap){
  const team=state?.team;if(!team)return <Loading/>; const game=state.game||{};
  const initial=state.submission||{price:team.price,marketing:0,product:0,research:0,operations:0,social:0,borrow:0,specialization:team.specialization,segment:team.segment,risk:"none",partnerCode:"",takeoverCode:""};
  return <PlayerForm key={`${game.quarter}-${team.submitted}`} state={state} team={team} teamKey={teamKey} initial={initial} refresh={refresh}/>;
}

function PlayerForm({state,team,teamKey,initial,refresh}:AnyMap){
  const [d,setD]=useState(initial),[message,setMessage]=useState(""); const game=state.game; const set=(key:string,value:any)=>setD({...d,[key]:value});
  const pivots=Number(d.specialization!==team.specialization)+Number(d.segment!==team.segment); const spendKeys=["marketing","product","research","operations","social"]; const slots=spendKeys.filter(k=>Number(d[k])>0).length+pivots*2+Number(d.borrow>0)+Number(d.risk!=="none")+Number(!!d.partnerCode)+Number(!!d.takeoverCode); const spend=spendKeys.reduce((s,k)=>s+Number(d[k]||0),0)+pivots*15000;
  const submit=async(e:FormEvent)=>{e.preventDefault();try{await request({action:"submit",teamId:teamKey.id,code:teamKey.code,decision:d});setMessage("DECISIONS LOCKED");refresh()}catch(err){setMessage((err as Error).message)}};
  return <section className="page player-grid"><aside className="company-rail"><p className="section-no">COMPANY</p><h2>{team.name}</h2><div className="join-code"><small>CO-OWNER CODE</small><b>{team.join_code}</b></div><Stat label="Cash" value={money.format(team.cash)}/><Stat label="Debt" value={money.format(team.debt)}/><Stat label="Revenue / quarter" value={money.format(team.revenue)}/><Stat label="Customers" value={team.customers}/><Metric label="Product" value={team.product}/><Metric label="Marketing" value={team.marketing}/><Metric label="Research" value={team.research}/><Metric label="Operations" value={team.operations}/><Metric label="Reputation" value={team.reputation}/></aside>
    <form className="decision-sheet" onSubmit={submit}><div className="sheet-head"><div><p className="section-no">QUARTER {game.quarter}</p><h2>DECISION SHEET</h2></div><div className="slot-counter"><small>ACTION SLOTS</small><b className={slots>5?"bad":""}>{slots} / 5</b></div></div>
      {game.status!=="active"&&<div className="lock-message">Decisions are {game.status==="lobby"?"not open yet":game.status}. Review your company while the market updates.</div>}
      <div className="fields"><label>Subscription price <span>Direct: higher margin, lower conversion</span><input type="number" min="10" max="500" value={d.price} onChange={e=>set("price",Number(e.target.value))}/></label><Select label="Product specialization" hint="Pivot: $15k + 2 slots; improves fit, hurts product this quarter" value={d.specialization} values={state.specializations} onChange={(v:string)=>set("specialization",v)}/><Select label="Target segment" hint="Pivot: $15k + 2 slots; changes market fit" value={d.segment} values={state.segments} onChange={(v:string)=>set("segment",v)}/>
        <MoneyField label="Marketing" hint="Direct: more leads and awareness" value={d.marketing} max={60000} set={(v:number)=>set("marketing",v)}/><MoneyField label="Product development" hint="Direct: product quality and retention" value={d.product} max={60000} set={(v:number)=>set("product",v)}/><MoneyField label="Customer research" hint="Direct: stronger market fit and forecast quality" value={d.research} max={30000} set={(v:number)=>set("research",v)}/><MoneyField label="Operations" hint="Direct: capacity, reliability, retention" value={d.operations} max={50000} set={(v:number)=>set("operations",v)}/><MoneyField label="Social impact" hint="Direct: impact score and reputation" value={d.social} max={25000} set={(v:number)=>set("social",v)}/><MoneyField label="New debt" hint="Direct: adds cash now; 3% interest each quarter" value={d.borrow} max={50000} set={(v:number)=>set("borrow",v)}/>
        <Select label="Strategic risk" hint="Named chance of a visible gain or loss" value={d.risk} values={state.risks.map((r:AnyMap)=>r.key)} display={(key:string)=>state.risks.find((r:AnyMap)=>r.key===key)?.label} onChange={(v:string)=>set("risk",v)}/><label>Partnership company code <span>Direct: mutual referral benefit when both teams enter each other</span><input value={d.partnerCode} onChange={e=>set("partnerCode",e.target.value.toUpperCase())} maxLength={6}/></label>{game.quarter===4&&<label>Hostile takeover code <span>Requires 2× target value and cash equal to 65% of its value</span><input value={d.takeoverCode} onChange={e=>set("takeoverCode",e.target.value.toUpperCase())} maxLength={6}/></label>}
      </div><footer className="submit-bar"><div><small>PLANNED SPEND</small><b>{money.format(spend)}</b></div><button className="primary" disabled={game.status!=="active"||slots>5}>{team.submitted?"Update locked plan":"Lock decisions"}</button></footer>{message&&<p className={message.includes("LOCKED")?"success":"form-error"}>{message}</p>}</form></section>;
}

function Admin({state,code,setCode,refresh}:AnyMap){
  const [eventKey,setEventKey]=useState("steady"),[announcement,setAnnouncement]=useState(""),[message,setMessage]=useState(""),[verified,setVerified]=useState(false);
  const call=async(body:AnyMap)=>{try{await request(body,code);setVerified(true);setMessage("DONE");refresh()}catch(e){setMessage((e as Error).message)}};
  if(!verified)return <section className="page admin-login"><p className="section-no">FACILITATOR</p><h2>CONTROL ROOM</h2><label>Admin code<input type="password" value={code} onChange={e=>setCode(e.target.value)}/></label><button className="primary" onClick={()=>call({action:"announce",text:""})}>Enter control room</button>{message&&<p className="form-error">{message}</p>}</section>;
  const submitted=state.teams.filter((t:AnyMap)=>t.submitted).length,active=state.teams.filter((t:AnyMap)=>t.status==="active").length;
  return <section className="page admin-grid"><div className="control-panel"><p className="section-no">LIVE CONTROL</p><h2>QUARTER {state.game.quarter}</h2><div className="admin-stats"><Stat label="Companies" value={state.teams.length}/><Stat label="Submitted" value={`${submitted} / ${active}`}/><Stat label="Market state" value={state.game.status}/></div><label>Next market event<select value={eventKey} onChange={e=>setEventKey(e.target.value)}>{state.events.map((e:AnyMap)=><option value={e.key} key={e.key}>{e.name}</option>)}</select></label><div className="button-row"><button className="primary" onClick={()=>call({action:"openQuarter",quarter:Math.min(4,(state.game.quarter||0)+1),eventKey})}>Open next quarter</button><button onClick={()=>call({action:"lock"})}>Lock submissions</button><button className="danger" onClick={()=>call({action:"resolve"})}>Resolve market</button></div><label>Market announcement<textarea value={announcement} onChange={e=>setAnnouncement(e.target.value)} maxLength={180}/></label><button onClick={()=>call({action:"announce",text:announcement})}>Publish announcement</button>{message&&<p className="success">{message}</p>}</div><div><h2>COMPANY STATUS</h2><div className="admin-team-list">{state.teams.map((t:AnyMap)=><div key={t.id}><b>{t.name}</b><span>{t.submitted?"SUBMITTED":"WAITING"}</span><small>{money.format(t.valuation)} · {t.status}</small></div>)}</div></div></section>;
}

function Metric({label,value}:AnyMap){const v=Math.round(Number(value||0));return <div className="metric"><span>{label}<b>{v}</b></span><div><i style={{width:`${Math.min(100,v)}%`}}/></div></div>}
function Stat({label,value}:AnyMap){return <div className="stat"><small>{label}</small><b>{value}</b></div>}
function Status({value}:AnyMap){return <span className={`status ${value}`}>{String(value).toUpperCase()}</span>}
function Select({label,hint,value,values,onChange,display}:AnyMap){return <label>{label}<span>{hint}</span><select value={value} onChange={e=>onChange(e.target.value)}>{values.map((x:string)=><option key={x} value={x}>{display?display(x):x}</option>)}</select></label>}
function MoneyField({label,hint,value,max,set}:AnyMap){return <label>{label}<span>{hint}</span><div className="money-input"><input type="range" min="0" max={max} step="1000" value={value} onChange={e=>set(Number(e.target.value))}/><input type="number" min="0" max={max} step="1000" value={value} onChange={e=>set(Number(e.target.value))}/></div></label>}
function Loading(){return <div className="loading">CONNECTING TO MARKET…</div>}
