
import {useEffect,useMemo,useState} from 'react';
import {
  Activity,BrainCircuit,CalendarDays,ChartNoAxesCombined,
  ChevronRight,Clock3,Menu,Search,ShieldCheck,Sparkles,
  Target,Trophy,Wifi,X
} from 'lucide-react';

type Match={
  id:string;
  competition:string;
  kickoff:string;
  home:string;
  away:string;
  status:string;
  score:string|null;
  dataLabel:string;
};

type Pred={
  matchId:string;
  model:string;
  status:string;
  expectedGoals:{home:number;away:number};
  probabilities:Record<string,number>;
  topScores:{score:string;probability:number}[];
  strongestOutcome:string;
  disclaimer:string;
  dataLimitations:string[];
};

const nav=[
  {name:'Overview',icon:Activity},
  {name:'Fixtures',icon:CalendarDays},
  {name:'AI Best Picks',icon:Sparkles},
  {name:'Performance',icon:ChartNoAxesCombined}
];

const pct=(n?:number)=>`${(n??0).toFixed(1)}%`;

const statusLabel=(status:string)=>{
  if(status==='NS') return 'Scheduled';
  if(status==='FT') return 'Full time';
  if(status==='HT') return 'Half time';
  if(status==='LIVE') return 'Live';
  return status||'Unknown';
};

export default function App(){
  const[page,setPage]=useState('Overview');
  const[matches,setMatches]=useState<Match[]>([]);
  const[preds,setPreds]=useState<Pred[]>([]);
  const[loading,setLoading]=useState(true);
  const[query,setQuery]=useState('');
  const[selected,setSelected]=useState<string|null>(null);
  const[menu,setMenu]=useState(false);
  const[source,setSource]=useState('Connecting');

  useEffect(()=>{
    Promise.all([
      fetch('/api/matches').then(r=>{
        if(!r.ok) throw new Error('Matches request failed');
        return r.json();
      }),
      fetch('/api/predictions').then(r=>{
        if(!r.ok) throw new Error('Predictions request failed');
        return r.json();
      })
    ])
    .then(([m,p])=>{
      setMatches(m.matches||[]);
      setPreds(p.predictions||[]);
      setSource(m.source||'Unknown');
    })
    .catch(()=>{
      setSource('API unavailable');
    })
    .finally(()=>{
      setLoading(false);
    });
  },[]);

  const filtered=useMemo(
    ()=>matches.filter(m=>
      `${m.home} ${m.away} ${m.competition}`
        .toLowerCase()
        .includes(query.toLowerCase())
    ),
    [matches,query]
  );

  const chosen=matches.find(m=>m.id===selected);

  // Demo predictions must never be attached to real Sportmonks fixtures.
  const pred=source==='DEMO_DATA'
    ?preds.find(p=>p.matchId===selected)
    :undefined;

  const isReal=source==='SPORTMONKS';
  const isDemo=source==='DEMO_DATA';

  return (
    <div className="shell">
      <aside className={`sidebar ${menu?'open':''}`}>
        <div className="brand">
          <div className="mark"><Trophy/></div>
          <div>
            <b>ELITE MATCH</b>
            <small>AI FOOTBALL INTELLIGENCE</small>
          </div>
          <button className="close" onClick={()=>setMenu(false)}>
            <X/>
          </button>
        </div>

        <label>WORKSPACE</label>

        {nav.map(n=>(
          <button
            key={n.name}
            className={`nav ${page===n.name?'active':''}`}
            onClick={()=>{
              setPage(n.name);
              setSelected(null);
              setMenu(false);
            }}
          >
            <n.icon size={18}/>
            {n.name}
            {n.name==='AI Best Picks'&&<i>AI</i>}
          </button>
        ))}

        <div className="side-note">
          <ShieldCheck/>
          <div>
            <b>Transparent by design</b>
            <small>No guaranteed wins. Real performance tracking.</small>
          </div>
        </div>
      </aside>

      {menu&&<div className="scrim" onClick={()=>setMenu(false)}/>}

      <main>
        <header>
          <button className="hamb" onClick={()=>setMenu(true)}>
            <Menu/>
          </button>
          <span>ELITE MATCH AI　›　{page}</span>
          <div className="right">
            <small>
              <i className={isDemo?'amber':''}/>
              {source}
            </small>
            <b>EM</b>
          </div>
        </header>

        <section className="content">
          {chosen?(
            <>
              <button className="back" onClick={()=>setSelected(null)}>
                ← Back to matches
              </button>

              <div className="heading">
                <label>MATCH CENTRE · {chosen.competition}</label>
                <h1>
                  {chosen.home} <em>vs</em> {chosen.away}
                </h1>
                <p>
                  Kick-off {new Date(chosen.kickoff).toLocaleString(
                    'en-GB',
                    {timeZone:'Africa/Lagos'}
                  )} WAT
                  · {statusLabel(chosen.status)}
                </p>
              </div>

              {pred?(
                <>
                  <div className="details">
                    <article>
                      <h3><BrainCircuit/> Model probability</h3>

                      {[
                        ['Home win',pred.probabilities.homeWin],
                        ['Draw',pred.probabilities.draw],
                        ['Away win',pred.probabilities.awayWin]
                      ].map(([l,v])=>(
                        <div className="prob" key={String(l)}>
                          <span>{l}</span>
                          <b>{pct(Number(v))}</b>
                          <div className="bar">
                            <i style={{width:pct(Number(v))}}/>
                          </div>
                        </div>
                      ))}

                      <hr/>

                      <div className="prob">
                        <span>Over 2.5 goals</span>
                        <b>{pct(pred.probabilities.over25)}</b>
                      </div>

                      <div className="prob">
                        <span>Both teams score</span>
                        <b>{pct(pred.probabilities.bttsYes)}</b>
                      </div>

                      <p className="muted">{pred.disclaimer}</p>
                    </article>

                    <article>
                      <h3><Target/> Expected goals</h3>

                      <div className="xg">
                        <b>
                          {pred.expectedGoals.home.toFixed(2)}
                          <small>{chosen.home}</small>
                        </b>
                        VS
                        <b>
                          {pred.expectedGoals.away.toFixed(2)}
                          <small>{chosen.away}</small>
                        </b>
                      </div>

                      <hr/>
                      <h3>Top scoreline estimates</h3>

                      {pred.topScores.map(s=>(
                        <div className="score" key={s.score}>
                          <b>{s.score}</b>
                          <span>{pct(s.probability)}</span>
                        </div>
                      ))}

                      <p className="muted">
                        {pred.model} · {pred.status}
                      </p>
                    </article>
                  </div>

                  <div className="notice">
                    <ShieldCheck/>
                    <div>
                      <b>Demo model limitations</b>
                      <p>
                        These estimates use sample data, not verified
                        statistics for this real fixture. They are not
                        validated betting advice.
                      </p>
                    </div>
                  </div>
                </>
              ):(
                <div className="notice">
                  <BrainCircuit/>
                  <div>
                    <b>AI analysis not available yet</b>
                    <p>
                      This fixture is received from {source}.
                      Verified team statistics, form and match-specific
                      prediction data have not been connected yet.
                      We will not display a fabricated prediction.
                    </p>
                  </div>
                </div>
              )}
            </>
          ):(
            <>
              <div className="welcome">
                <div>
                  <label>● FOOTBALL INTELLIGENCE PLATFORM</label>
                  <h1>
                    {page==='Overview'
                      ?'Your football command centre'
                      :page}
                  </h1>
                  <p>
                    {page==='Overview'
                      ?'A clearer view of the game, powered by data.'
                      :page==='AI Best Picks'
                      ?'Only properly supported analysis belongs here. No forced selections.'
                      :page==='Performance'
                      ?'Honest tracking starts with recording every prediction.'
                      :'Explore fixtures and match information.'}
                  </p>
                </div>

                <div className="date">
                  <CalendarDays/>
                  {new Date().toLocaleDateString('en-GB',{
                    weekday:'short',
                    day:'2-digit',
                    month:'short'
                  })}
                </div>
              </div>

              {page==='Overview'&&(
                <div className="hero">
                  <div>
                    <label>
                      <BrainCircuit/> DATA-LED MATCH INTELLIGENCE
                    </label>
                    <h2>
                      Better insight.<br/>
                      <em>Smarter decisions.</em>
                    </h2>
                    <p>
                      Explore match patterns, compare teams and understand
                      probability estimates — without promises of guaranteed
                      results.
                    </p>
                    <button onClick={()=>setPage('Fixtures')}>
                      Explore fixtures <ChevronRight/>
                    </button>
                  </div>
                  <div className="ball">⚽</div>
                </div>
              )}

              <div className="stats">
                {[
                  [
                    CalendarDays,
                    'Fixtures loaded',
                    String(matches.length).padStart(2,'0'),
                    isReal?'Sportmonks fixtures':'Current app dataset'
                  ],
                  [
                    BrainCircuit,
                    'AI analyses',
                    isReal?'00':String(preds.length).padStart(2,'0'),
                    isReal?'Real-fixture analysis not connected':'Demo baseline only'
                  ],
                  [
                    Target,
                    'Verified accuracy',
                    '—',
                    'Awaiting tracked results'
                  ],
                  [
                    Wifi,
                    'Data connection',
                    isReal?'Connected':isDemo?'Demo':'Check',
                    isReal?'Sportmonks feed connected':'Real provider not confirmed'
                  ]
                ].map(([Icon,title,value,note]:any)=>(
                  <article key={title}>
                    <div><Icon/>{title}</div>
                    <strong>{value}</strong>
                    <small>{note}</small>
                  </article>
                ))}
              </div>

              <div className="section-title">
                <div>
                  <label>MATCH CENTRE</label>
                  <h2>
                    {page==='AI Best Picks'
                      ?'Fixtures awaiting analysis'
                      :'Upcoming fixtures'}
                  </h2>
                </div>
                <button onClick={()=>setPage('Fixtures')}>
                  All fixtures　›
                </button>
              </div>

              {page==='AI Best Picks'&&isReal&&(
                <div className="notice">
                  <BrainCircuit/>
                  <div>
                    <b>No verified AI picks yet</b>
                    <p>
                      Real fixtures are connected, but match-specific
                      statistics and validated predictions are not ready.
                      We will not rank fixtures using unrelated demo data.
                    </p>
                  </div>
                </div>
              )}

              <div className="toolbar">
                <div className="search">
                  <Search/>
                  <input
                    value={query}
                    onChange={e=>setQuery(e.target.value)}
                    placeholder="Search team or competition..."
                  />
                </div>
                <small>
                  {isReal
                    ?'Real fixtures · Sportmonks'
                    :isDemo
                    ?'Demo fixtures'
                    :'Waiting for fixture data'}
                </small>
              </div>

              {loading?(
                <div className="empty">Loading match centre…</div>
              ):filtered.length===0?(
                <div className="empty">No matching fixtures found.</div>
              ):(
                <div className="matches">
                  {filtered.map(m=>(
                    <button
                      className="match"
                      key={m.id}
                      onClick={()=>setSelected(m.id)}
                    >
                      <div className="meta">
                        <span>{m.competition}</span>
                        <i>{statusLabel(m.status)}</i>
                      </div>

                      <div className="teams">
                        <b>
                          <span>{m.home[0]}</span>
                          {m.home}
                        </b>

                        <div>
                          {m.score||'VS'}
                          <small>
                            {new Date(m.kickoff).toLocaleTimeString(
                              'en-GB',
                              {
                                hour:'2-digit',
                                minute:'2-digit',
                                timeZone:'Africa/Lagos'
                              }
                            )} WAT
                          </small>
                        </div>

                        <b className="away">
                          {m.away}
                          <span>{m.away[0]}</span>
                        </b>
                      </div>

                      <div className="match-foot">
                        <span>
                          <Clock3/>
                          {new Date(m.kickoff).toLocaleDateString(
                            'en-GB',
                            {day:'2-digit',month:'short'}
                          )}
                        </span>

                        <strong>
                          <BrainCircuit/>
                          {isReal
                            ?'Analysis unavailable'
                            :'Demo model'}
                        </strong>
                        ›
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="notice">
                <ShieldCheck/>
                <div>
                  <b>Data transparency</b>
                  <p>
                    {isReal
                      ?'Fixture information is supplied by Sportmonks. Verified team statistics, match-specific AI predictions and performance tracking are still being developed.'
                      :isDemo
                      ?'The current fixtures and model estimates are sample data for testing. They are not verified betting predictions.'
                      :'The football data connection is currently unavailable. Please try again later.'}
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        <footer>
          © 2026 ELITE MATCH AI
          <span>BUILT FOR CLARITY · NOT GUARANTEED OUTCOMES</span>
        </footer>
      </main>
    </div>
  );
                                     }
              
