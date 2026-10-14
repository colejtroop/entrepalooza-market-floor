import { env } from "cloudflare:workers";
import { NextRequest, NextResponse } from "next/server";

const EVENTS = [
  { key: "steady", name: "Steady market", brief: "Demand follows normal buying patterns.", effect: "No market-wide modifier." },
  { key: "boom", name: "Software boom", brief: "Buyers are replacing manual workflows.", effect: "Demand rises and marketing converts better." },
  { key: "privacy", name: "Privacy backlash", brief: "Customers scrutinize how software handles data.", effect: "Social investment and reputation matter more." },
  { key: "recession", name: "Budget freeze", brief: "Customers cut discretionary software spending.", effect: "High prices face resistance; cash discipline matters." },
  { key: "outage", name: "Infrastructure disruption", brief: "Reliability becomes the market's primary concern.", effect: "Operations investment protects retention." },
  { key: "hype", name: "AI attention spike", brief: "New buyers flood the category with new competitors.", effect: "Demand rises, but weak products churn faster." },
];
const SPECIALIZATIONS = ["Sales", "Marketing", "Customer Support", "Operations"];
const SEGMENTS = ["Solo professionals", "Local businesses", "Small online businesses", "Growing companies"];
const RISKS: Record<string, { label: string; chance: number; up: number; down: number }> = {
  none: { label: "No major risk", chance: 1, up: 0, down: 0 },
  expansion: { label: "Aggressive expansion", chance: .55, up: 26, down: -18 },
  launch: { label: "Experimental launch", chance: .48, up: 32, down: -15 },
  campaign: { label: "Major ad campaign", chance: .62, up: 22, down: -20 },
};

function db() { if (!env.DB) throw new Error("Database is not configured"); return env.DB; }
function code() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
function n(value: unknown, fallback = 0) { const result = Number(value); return Number.isFinite(result) ? result : fallback; }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function adminOk(req: NextRequest) {
  const secret = (env as unknown as { ADMIN_CODE?: string }).ADMIN_CODE || process.env.ADMIN_CODE;
  return !!secret && req.headers.get("x-admin-code") === secret;
}
async function ensureGame() { await db().prepare("INSERT OR IGNORE INTO game (id,quarter,status,event_key,deadline_at,updated_at) VALUES (1,0,'lobby','steady',0,?)").bind(Date.now()).run(); }

async function publicState() {
  await ensureGame();
  const game = await db().prepare("SELECT * FROM game WHERE id=1").first<Record<string, unknown>>();
  const teams = await db().prepare("SELECT id,name,specialization,segment,customers,valuation,last_change,status,submitted,social_impact,risk_score FROM teams ORDER BY valuation DESC").all();
  const announcement = await db().prepare("SELECT text,created_at FROM announcements ORDER BY id DESC LIMIT 1").first();
  const snapshotRows = (await db().prepare("SELECT quarter,payload FROM snapshots ORDER BY quarter").all()).results as any[];
  const historyByTeam = new Map<string,{ id:string; name:string; points:{ quarter:number; value:number }[] }>();
  for (const row of snapshotRows) {
    for (const team of JSON.parse(String(row.payload)) as any[]) {
      const series=historyByTeam.get(team.id)||{id:String(team.id),name:String(team.name),points:[] as { quarter:number; value:number }[]};
      series.points.push({quarter:Math.max(0,Number(row.quarter)-1),value:Number(team.valuation)});
      historyByTeam.set(team.id,series);
    }
  }
  for (const team of teams.results as any[]) {
    const series=historyByTeam.get(team.id)||{id:String(team.id),name:String(team.name),points:[] as { quarter:number; value:number }[]};
    if (Number((game as any)?.quarter)>0 && !series.points.some(point=>point.quarter===Number((game as any).quarter))) series.points.push({quarter:Number((game as any).quarter),value:Number(team.valuation)});
    historyByTeam.set(team.id,series);
  }
  const total = (teams.results as any[]).reduce((sum, team) => sum + Number(team.customers || 0), 0) || 1;
  let awards = null;
  if ((game as any)?.status === "finished") {
    const awardRows = (await db().prepare("SELECT name,cash,valuation,social_impact,risk_score FROM teams").all()).results as any[];
    const winner = (field: string) => [...awardRows].sort((a,b)=>Number(b[field])-Number(a[field]))[0]?.name || "—";
    awards = { value: winner("valuation"), cash: winner("cash"), impact: winner("social_impact"), risk: winner("risk_score") };
  }
  return { game, teams: (teams.results as any[]).map((team, i) => ({ ...team, rank: i + 1, marketShare: team.customers / total })), history:[...historyByTeam.values()], awards, announcement, events: EVENTS, specializations: SPECIALIZATIONS, segments: SEGMENTS, risks: Object.entries(RISKS).map(([key, value]) => ({ key, ...value })) };
}

export async function GET(req: NextRequest) {
  try {
    const state = await publicState();
    const teamId = req.nextUrl.searchParams.get("teamId");
    const teamCode = req.nextUrl.searchParams.get("code");
    let team = null, submission = null;
    if (teamId && teamCode) {
      team = await db().prepare("SELECT * FROM teams WHERE id=? AND join_code=?").bind(teamId, teamCode.toUpperCase()).first();
      if (team) submission = await db().prepare("SELECT payload FROM submissions WHERE team_id=? AND quarter=?").bind(teamId, Number((state.game as any)?.quarter || 0)).first();
    }
    return NextResponse.json({ ...state, team, submission: submission ? JSON.parse(String((submission as any).payload)) : null, admin: req.nextUrl.searchParams.get("admin") === "1" && adminOk(req) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    await ensureGame();
    const body = await req.json() as any;
    if (body.action === "createTeam") {
      const name = String(body.name || "").trim().slice(0, 30);
      if (name.length < 2) return NextResponse.json({ error: "Enter a company name." }, { status: 400 });
      if (!SPECIALIZATIONS.includes(body.specialization) || !SEGMENTS.includes(body.segment)) return NextResponse.json({ error: "Choose a valid company setup." }, { status: 400 });
      const game = await db().prepare("SELECT status FROM game WHERE id=1").first<any>();
      if (game?.status !== "lobby") return NextResponse.json({ error: "Company registration is closed." }, { status: 409 });
      const id = crypto.randomUUID(), joinCode = code();
      await db().prepare("INSERT INTO teams (id,name,join_code,specialization,segment,created_at) VALUES (?,?,?,?,?,?)").bind(id, name, joinCode, body.specialization, body.segment, Date.now()).run();
      return NextResponse.json({ id, code: joinCode });
    }
    if (body.action === "loginTeam") {
      const team = await db().prepare("SELECT id,join_code FROM teams WHERE join_code=?").bind(String(body.code || "").trim().toUpperCase()).first<any>();
      if (!team) return NextResponse.json({ error: "Join code not found." }, { status: 404 });
      return NextResponse.json({ id: team.id, code: team.join_code });
    }
    if (body.action === "submit") return submit(body);
    if (!adminOk(req)) return NextResponse.json({ error: "Facilitator access denied." }, { status: 403 });
    if (body.action === "announce") { await db().prepare("INSERT INTO announcements (text,created_at) VALUES (?,?)").bind(String(body.text || "").slice(0, 180), Date.now()).run(); return NextResponse.json({ ok: true }); }
    if (body.action === "openQuarter") {
      const current = await db().prepare("SELECT quarter FROM game WHERE id=1").first<any>();
      const quarter = Math.min(4, Math.max(1, n(body.quarter, current?.quarter + 1)));
      const eventKey = EVENTS.some((event) => event.key === body.eventKey) ? body.eventKey : "steady";
      const minutes = clamp(n(body.minutes, 12), 5, 20);
      await db().batch([db().prepare("UPDATE game SET quarter=?,status='active',event_key=?,deadline_at=?,updated_at=? WHERE id=1").bind(quarter,eventKey,Date.now()+minutes*60000,Date.now()), db().prepare("UPDATE teams SET submitted=0 WHERE status='active'")]);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "lock") { const current=await db().prepare("SELECT status FROM game WHERE id=1").first<any>(); const next=current?.status==="locked"?"active":"locked"; await db().prepare("UPDATE game SET status=?,updated_at=? WHERE id=1").bind(next,Date.now()).run(); return NextResponse.json({ ok: true,status:next }); }
    if (body.action === "resolve") { await resolveQuarter(); return NextResponse.json({ ok: true }); }
    if (body.action === "reopen") {
      const minutes = clamp(n(body.minutes, 5), 2, 20);
      await db().prepare("UPDATE game SET status='active',deadline_at=?,updated_at=? WHERE id=1").bind(Date.now()+minutes*60000,Date.now()).run();
      return NextResponse.json({ ok: true });
    }
    if (body.action === "restartQuarter") { await restartQuarter(clamp(n(body.minutes,12),5,20)); return NextResponse.json({ ok: true }); }
    if (body.action === "deleteTeam") {
      const teamId=String(body.teamId||"");
      await db().batch([db().prepare("DELETE FROM submissions WHERE team_id=?").bind(teamId),db().prepare("DELETE FROM teams WHERE id=?").bind(teamId)]);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "resetEvent") {
      if (body.confirm !== "RESET") return NextResponse.json({ error: "Type RESET to confirm." }, { status: 400 });
      await db().batch([db().prepare("DELETE FROM submissions"),db().prepare("DELETE FROM snapshots"),db().prepare("DELETE FROM announcements"),db().prepare("DELETE FROM teams"),db().prepare("UPDATE game SET quarter=0,status='lobby',event_key='steady',deadline_at=0,updated_at=? WHERE id=1").bind(Date.now())]);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message.includes("UNIQUE") ? "That company name is already taken." : message }, { status: 500 });
  }
}

async function submit(body: any) {
  const team = await db().prepare("SELECT * FROM teams WHERE id=? AND join_code=?").bind(body.teamId, String(body.code || "").toUpperCase()).first<any>();
  const game = await db().prepare("SELECT * FROM game WHERE id=1").first<any>();
  if (!team) return NextResponse.json({ error: "Company access denied." }, { status: 403 });
  if (game.status !== "active") return NextResponse.json({ error: "Decisions are not open." }, { status: 409 });
  const d = body.decision || {};
  const growth = clamp(n(d.growth), 0, 60000), build = clamp(n(d.build), 0, 60000);
  const payload = {
    price: clamp(n(d.price, team.price), 10, 500), growth, build, marketing: growth*.7, research: growth*.3, product: build*.6, operations: build*.4,
    social: clamp(n(d.social), 0, 25000), borrow: clamp(n(d.borrow), 0, 100000),
    specialization: SPECIALIZATIONS.includes(d.specialization) ? d.specialization : team.specialization,
    segment: SEGMENTS.includes(d.segment) ? d.segment : team.segment,
    risk: RISKS[d.risk] ? d.risk : "none", partnerCode: String(d.partnerCode || "").toUpperCase(), takeoverCode: String(d.takeoverCode || "").toUpperCase(),
  };
  const pivots = Number(payload.specialization !== team.specialization) + Number(payload.segment !== team.segment);
  const cost = payload.growth+payload.build+payload.social+pivots*15000;
  if (cost > team.cash + payload.borrow) return NextResponse.json({ error: "Planned spending exceeds available cash." }, { status: 400 });
  if (payload.takeoverCode && game.quarter !== 4) return NextResponse.json({ error: "Hostile takeovers unlock in Q4." }, { status: 400 });
  await db().prepare("INSERT INTO submissions (team_id,quarter,payload,created_at) VALUES (?,?,?,?) ON CONFLICT(team_id,quarter) DO UPDATE SET payload=excluded.payload,created_at=excluded.created_at").bind(team.id, game.quarter, JSON.stringify(payload), Date.now()).run();
  await db().prepare("UPDATE teams SET submitted=1 WHERE id=?").bind(team.id).run();
  return NextResponse.json({ ok: true });
}

async function restartQuarter(minutes: number) {
  const game = await db().prepare("SELECT quarter FROM game WHERE id=1").first<any>();
  const snapshot = await db().prepare("SELECT payload FROM snapshots WHERE quarter=?").bind(game?.quarter||0).first<any>();
  if (snapshot) {
    const teams = JSON.parse(String(snapshot.payload)) as any[];
    const statements:D1PreparedStatement[]=[db().prepare("DELETE FROM teams")];
    for(const t of teams) statements.push(db().prepare("INSERT INTO teams (id,name,join_code,specialization,segment,price,cash,debt,customers,revenue,valuation,marketing,product,research,operations,reputation,social_impact,risk_score,status,submitted,last_change,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(t.id,t.name,t.join_code,t.specialization,t.segment,t.price,t.cash,t.debt,t.customers,t.revenue,t.valuation,t.marketing,t.product,t.research,t.operations,t.reputation,t.social_impact,t.risk_score,t.status,0,t.last_change,t.created_at));
    statements.push(db().prepare("DELETE FROM submissions WHERE quarter=?").bind(game.quarter));
    await db().batch(statements);
  } else {
    await db().batch([db().prepare("DELETE FROM submissions WHERE quarter=?").bind(game?.quarter||0),db().prepare("UPDATE teams SET submitted=0 WHERE status='active'")]);
  }
  await db().prepare("UPDATE game SET status='active',deadline_at=?,updated_at=? WHERE id=1").bind(Date.now()+minutes*60000,Date.now()).run();
}

async function resolveQuarter() {
  const game = await db().prepare("SELECT * FROM game WHERE id=1").first<any>();
  if (!game || !["active", "locked"].includes(game.status)) throw new Error("No open quarter to resolve.");
  const teams = (await db().prepare("SELECT * FROM teams WHERE status='active'").all()).results as any[];
  const allTeams = (await db().prepare("SELECT * FROM teams").all()).results as any[];
  await db().prepare("INSERT INTO snapshots (quarter,payload,created_at) VALUES (?,?,?) ON CONFLICT(quarter) DO UPDATE SET payload=excluded.payload,created_at=excluded.created_at").bind(game.quarter,JSON.stringify(allTeams),Date.now()).run();
  const rows = (await db().prepare("SELECT team_id,payload FROM submissions WHERE quarter=?").bind(game.quarter).all()).results as any[];
  const decisions = new Map(rows.map((row) => [row.team_id, JSON.parse(String(row.payload))]));
  const updates: D1PreparedStatement[] = [];
  const resolved = new Map<string, any>();
  const segmentPools:Record<string,number>={"Solo professionals":80,"Local businesses":80,"Small online businesses":80,"Growing companies":80};
  const marketPoolMultiplier=["boom","hype"].includes(game.event_key)?1.22:game.event_key==="recession"?.74:1;
  const demandScores=new Map<string,number>();
  for(const team of teams){
    const d=decisions.get(team.id)||{price:team.price,marketing:0,product:0,research:0,operations:0,social:0,borrow:0,specialization:team.specialization,segment:team.segment,risk:"none",partnerCode:""};
    const pivots=Number(d.specialization!==team.specialization)+Number(d.segment!==team.segment);
    const eventDemand=["boom","hype"].includes(game.event_key)?1.22:game.event_key==="recession"?.74:1;
    const priceFit=clamp((d.specialization==="Sales"?1.42:1.35)-d.price/(d.specialization==="Sales"?300:260),.25,1.25);
    const product=clamp(team.product+d.product/2200-pivots*8,5,100),marketing=clamp(team.marketing*.72+d.marketing/1200+(d.specialization==="Marketing"?10:0),5,100),operations=clamp(team.operations*.8+d.operations/1300+(d.specialization==="Operations"?10:0),5,100);
    const bestFit:Record<string,string>={Sales:"Growing companies",Marketing:"Small online businesses","Customer Support":"Local businesses",Operations:"Solo professionals"};
    const partner=teams.find(candidate=>candidate.join_code===d.partnerCode&&candidate.id!==team.id),partnerDecision=partner?decisions.get(partner.id):null;
    const priceShift=Math.abs(d.price-team.price)/Math.max(1,team.price),pricePenalty=priceShift>=1?.12:priceShift>=.45?.06:0;
    const privacy=game.event_key==="privacy"?1+(team.social_impact+d.social/800)/160:1,reliability=game.event_key==="outage"?operations/58:1,variation=((team.id.charCodeAt(0)+team.id.charCodeAt(5)+game.quarter*17)%21-10)/100;
    demandScores.set(team.id,eventDemand*priceFit*(bestFit[d.specialization]===d.segment?1.14:1)*(partnerDecision?.partnerCode===team.join_code?1.12:1)*privacy*reliability*(1+variation)*(.45+marketing/110)*(.7+product/180)*(1-pricePenalty*.5));
  }
  const segmentTotals=new Map<string,number>();
  for(const team of teams){const d=decisions.get(team.id)||team;segmentTotals.set(d.segment,(segmentTotals.get(d.segment)||0)+(demandScores.get(team.id)||0));}
  for (const team of teams) {
    const d = decisions.get(team.id) || { price: team.price, marketing: 0, product: 0, research: 0, operations: 0, social: 0, borrow: 0, specialization: team.specialization, segment: team.segment, risk: "none", takeoverCode: "" };
    const pivots = Number(d.specialization !== team.specialization) + Number(d.segment !== team.segment);
    const product = clamp(team.product + d.product / 2200 - pivots * 8, 5, 100);
    const marketing = clamp(team.marketing * .72 + d.marketing / 1200 + (d.specialization==="Marketing"?10:0), 5, 100);
    const research = clamp(team.research * .78 + d.research / 700, 5, 100);
    const operations = clamp(team.operations * .8 + d.operations / 1300 + (d.specialization==="Operations"?10:0), 5, 100);
    const attraction=demandScores.get(team.id)||0,totalDemand=segmentTotals.get(d.segment)||1;
    const acquired=Math.max(0,Math.round((segmentPools[d.segment]||80)*marketPoolMultiplier*attraction/totalDemand));
    let retention = clamp(.58 + product / 300 + operations / 500 + team.reputation / 700, .55, .96);
    if (d.specialization==="Customer Support") retention=clamp(retention+.06,.55,.98);
    const priceShift=Math.abs(d.price-team.price)/Math.max(1,team.price),pricePenalty=priceShift>=1?.12:priceShift>=.45?.06:0;
    retention=clamp(retention-pricePenalty,.45,.98);
    if (game.event_key === "hype" && product < 50) retention -= .08;
    const customers = Math.max(0, Math.round(team.customers * retention) + acquired);
    const risk = RISKS[d.risk] || RISKS.none;
    const roll = ((team.id.charCodeAt(2) * 13 + game.quarter * 19) % 100) / 100;
    const riskEffect = roll < risk.chance ? risk.up : risk.down;
    const revenue = customers * d.price * 3 * (1 + riskEffect / 100);
    const expense = d.marketing+d.product+d.research+d.operations+d.social+pivots*15000;
    const interestRate=team.valuation>=750000?.02:team.valuation>=500000?.03:team.valuation>=250000?.05:.07;
    let debt = team.debt+d.borrow;
    let cash = team.cash+revenue-expense+d.borrow-team.debt*interestRate;
    const reputation = clamp(team.reputation+d.social/2500+riskEffect/8-pivots*2,0,100);
    const socialImpact = clamp(team.social_impact+d.social/900,0,100);
    if (game.quarter === 1) cash = Math.max(cash,65000);
    if ([2,3].includes(game.quarter) && cash < 0) { debt += Math.abs(cash)+10000; cash=10000; }
    let valuation = Math.max(0,cash-debt+revenue*4*(1.7+retention)+customers*325+product*2200+reputation*1300);
    if (game.quarter===1) valuation=Math.max(valuation,team.valuation*.92);
    const status = game.quarter===4 && cash<0 ? "bankrupt" : "active";
    if (status === "bankrupt") valuation=0;
    const lastChange = team.valuation ? (valuation-team.valuation)/team.valuation : 0;
    const record = { ...team, ...d, cash,debt,customers,revenue,valuation,marketing,product,research,operations,reputation,socialImpact,riskScore: team.risk_score+Math.abs(riskEffect),status,lastChange };
    resolved.set(team.id,record);
    updates.push(db().prepare("UPDATE teams SET specialization=?,segment=?,price=?,cash=?,debt=?,customers=?,revenue=?,valuation=?,marketing=?,product=?,research=?,operations=?,reputation=?,social_impact=?,risk_score=?,status=?,last_change=?,submitted=0 WHERE id=?").bind(d.specialization,d.segment,d.price,cash,debt,customers,revenue,valuation,marketing,product,research,operations,reputation,socialImpact,record.riskScore,status,lastChange,team.id));
  }
  if (game.quarter===4) {
    for (const attacker of resolved.values()) {
      if (!attacker.takeoverCode || attacker.status!=="active") continue;
      const target=[...resolved.values()].find((item)=>item.join_code===attacker.takeoverCode&&item.id!==attacker.id&&item.status==="active");
      if (!target) continue;
      const cost=target.valuation*.65;
      if (attacker.valuation>=target.valuation*2&&attacker.cash>=cost) {
        updates.push(db().prepare("UPDATE teams SET cash=cash-?,customers=customers+?,valuation=valuation+?,last_change=last_change+0.08 WHERE id=?").bind(cost,Math.round(target.customers*.45),target.valuation*.35,attacker.id));
        updates.push(db().prepare("UPDATE teams SET status='acquired',valuation=0,last_change=-1 WHERE id=?").bind(target.id));
      }
    }
  }
  updates.push(db().prepare("UPDATE game SET status=?,updated_at=? WHERE id=1").bind(game.quarter===4?"finished":"results",Date.now()));
  await db().batch(updates);
}
