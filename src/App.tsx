

import {useEffect,useMemo,useState} from 'react';
import {
  Activity,BrainCircuit,CalendarDays,ChartNoAxesCombined,
  ChevronRight,Clock3,Menu,Search,ShieldCheck,Sparkles,
  Target,Trophy,Wifi,X,RefreshCw
} from 'lucide-react';

type Match={
  id:string;
  homeTeamId?:string;
  awayTeamId?:string;
  competition:string;
  kickoff:string;
  home:string;
  away:string;
  status:string;
  score:string|null;
  dataLabel:string;
};

type Pred={
  matchId?:string;
  model:string;
  status:string;
  expectedGoals:{home:number;away:number};
  probabilities:Record<string,number>;
  topScores:{score:string;probability:number}[];
  strongestOutcome:string;
  disclaimer:string;
  dataLimitations:string[];
};

type RecentMatch={
  fixtureId:string;
  opponent:string;
  date:string;
  result:string;
  goalsFor:number;
  goalsAgainst:number;
};

type TeamSummary={
  matchesPlayed:number;
  form:string[];
  wins:number;
  draws:number;
  losses:number;
  goalsScored:number;
  goalsConceded:number;
  averageGoalsScored:number;
  averageGoalsConceded:number;
  recentMatches:RecentMatch[];
};

type RealAnalysis={
  source:string;
  sampleSize:{home:number;away:number};
  home:TeamSummary;
  away:TeamSummary;
  prediction:Pred;
  disclaimer:string;
};

type BestPick={
  matchId:string;
  competition:string;
  kickoff:string;
  home:string;
  away:string;
  market:string;
  estimatedProbability:number;
  expectedGoals:{home:number;away:number};
  sampleSize:{home:number;away:number};
  recentForm:{home:string[];away:string[]};
  reasons:string[];
  riskFlags:string[];
  model:string;
  modelStatus:string;
};

type BestPicksResponse={
  source:string;
  engine:string;
  modelStatus:string;
  generatedAt:string;
  fixturesFound:number;
  fixturesAnalysed:number;
  picksReturned:number;
  minimumEstimatedProbability:number;
  picks:BestPick[];
  notice:string;
  cached?:boolean;
  error?:string;
};
type PerformanceRecord={
  match_id:string;
  home_team:string;
  away_team:string;
  market:string;
  status:string;
};

type PerformanceResponse={
  source:string;
  total:number;
  pending:number;
  won:number;
  lost:number;
  settled:number;
  accuracy:number|null;
  records:PerformanceRecord[];
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

const formatKickoff=(date:string)=>{
  const time=Date.parse(date);
  if(!Number.isFinite(time)) return 'Time unavailable';

  return new Date(time).toLocaleString('en-GB',{
    timeZone:'Africa/Lagos',
    weekday:'short',
    day:'2-digit',
    month:'short',
    hour:'2-digit',
    minute:'2-digit'
  })+' WAT';
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

  const[analysis,setAnalysis]=useState<RealAnalysis|null>(null);
  const[statsLoading,setStatsLoading]=useState(false);
  const[statsError,setStatsError]=useState('');

  const[bestPicks,setBestPicks]=useState<BestPick[]>([]);
  const[bestLoading,setBestLoading]=useState(false);
  const[bestError,setBestError]=useState('');
  const[bestNotice,setBestNotice]=useState('');
  const[bestMeta,setBestMeta]=useState<BestPicksResponse|null>(null);

  const loadFixtures=()=>{
    setLoading(true);

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
  };

  const loadBestPicks=()=>{
    setBestLoading(true);
    setBestError('');

    fetch('/api/best-picks')
      .then(async r=>{
        const data=await r.json();

        if(!r.ok){
          throw new Error(data.error||'Best Picks request failed.');
        }

        return data as BestPicksResponse;
      })
      .then(data=>{
        setBestMeta(data);
        setBestPicks(data.picks||[]);
        setBestNotice(data.notice||'');
        if(data.error) setBestError(data.error);
      })
      .catch(error=>{
        setBestError(
          error.message||'Unable to load AI Best Picks.'
        );
        setBestPicks([]);
      })
      .finally(()=>{
        setBestLoading(false);
      });
  };

  useEffect(()=>{
    loadFixtures();
  },[]);

  useEffect(()=>{
    if(page==='AI Best Picks'){
      loadBestPicks();
    }
  },[page]);

  const filtered=useMemo(
    ()=>matches.filter(m=>
      `${m.home} ${m.away} ${m.competition}`
        .toLowerCase()
        .includes(query.toLowerCase())
    ),
    [matches,query]
  );

  const chosen=matches.find(m=>m.id===selected);
  const isReal=source==='SPORTMONKS';
  const isDemo=source==='DEMO_DATA';

  useEffect(()=>{
    if(!chosen||!isReal||!chosen.homeTeamId||!chosen.awayTeamId){
      setAnalysis(null);
      setStatsError('');
      setStatsLoading(false);
      return;
    }

    let cancelled=false;

    setAnalysis(null);
    setStatsError('');
    setStatsLoading(true);

    fetch(`/api/analyze/${chosen.homeTeamId}/${chosen.awayTeamId}`)
      .then(async r=>{
        const data=await r.json();
        if(!r.ok){
          throw new Error(data.error||'Unable to load match analysis.');
        }
        return data;
      })
      .then(data=>{
        if(!cancelled) setAnalysis(data);
      })
      .catch(error=>{
        if(!cancelled){
          setStatsError(
            error.message||'Unable to retrieve match analysis.'
          );
        }
      })
      .finally(()=>{
        if(!cancelled) setStatsLoading(false);
      });

    return ()=>{cancelled=true;};
  },[chosen?.id,chosen?.homeTeamId,chosen?.awayTeamId,isReal]);

  const pred=isReal
    ?analysis?.prediction
    :isDemo
    ?preds.find(p=>p.matchId===selected)
    :undefined;

  const renderTeamStats=(team:TeamSummary,name:string)=>(
    <article>
      <h3>{name}</h3>

      <div className="prob">
        <span>Recent form</span>
        <b>{team.form.join(' · ')||'Unavailable'}</b>
      </div>

      <div className="prob">
        <span>Matches played</span>
        <b>{team.matchesPlayed}</b>
      </div>

      <div className="prob">
        <span>Wins / Draws / Losses</span>
        <b>{team.wins} / {team.draws} / {team.losses}</b>
      </div>

      <div className="prob">
        <span>Goals scored</span>
        <b>{team.goalsScored}</b>
      </div>

      <div className="prob">
        <span>Goals conceded</span>
        <b>{team.goalsConceded}</b>
      </div>

      <hr/>

      <div className="prob">
        <span>Average goals scored</span>
        <b>{team.averageGoalsScored.toFixed(2)}</b>
      </div>

      <div className="prob">
        <span>Average goals conceded</span>
        <b>{team.averageGoalsConceded.toFixed(2)}</b>
      </div>

      <hr/>

      <h3>Recent matches</h3>

      {team.recentMatches.length===0?(
        <p className="muted">No completed matches available.</p>
      ):team.recentMatches.map(match=>(
        <div className="score" key={match.fixtureId}>
          <span>
            {match.opponent}
            <small style={{display:'block'}}>{match.date}</small>
          </span>
          <b>
            {match.goalsFor} - {match.goalsAgainst} ({match.result})
          </b>
        </div>
      ))}
    </article>
  );

  const renderBestPick=(pick:BestPick,index:number)=>(
    <article className="match" key={pick.matchId}>
      <div className="meta">
        <span>{pick.competition}</span>
        <i>RANK #{index+1}</i>
      </div>

      <div className="teams">
        <b>{pick.home}</b>
        <div>
          VS
          <small>{formatKickoff(pick.kickoff)}</small>
        </div>
        <b className="away">{pick.away}</b>
      </div>

      <hr/>

      <div className="prob">
        <span>Model's leading market</span>
        <b>{pick.market}</b>
      </div>

      <div className="prob">
        <span>Experimental model estimate</span>
        <b>{pct(pick.estimatedProbability)}</b>
        <div className="bar">
          <i style={{width:pct(pick.estimatedProbability)}}/>
        </div>
      </div>

      <div className="prob">
        <span>Expected goals</span>
        <b>{pick.expectedGoals.home.toFixed(2)} - {pick.expectedGoals.away.toFixed(2)}</b>
      </div>

      <div className="prob">
        <span>Recent form</span>
        <b>
          {pick.recentForm.home.join(' ')}
          {' / '}
          {pick.recentForm.away.join(' ')}
        </b>
      </div>

      <div className="prob">
        <span>Recent match sample</span>
        <b>
          {pick.sampleSize.home} home team / {pick.sampleSize.away} away team
        </b>
      </div>

      <hr/>

      <h3>Analysis notes</h3>
      {pick.reasons.map((reason,i)=>(
        <p className="muted" key={i}>• {reason}</p>
      ))}

      <h3>Risk warnings</h3>
      {pick.riskFlags.map((flag,i)=>(
        <p className="muted" key={i}>⚠ {flag}</p>
      ))}
    </article>
  );

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
                  Kick-off {formatKickoff(chosen.kickoff)}
                  · {statusLabel(chosen.status)}
                </p>
              </div>

              {isReal&&(
                <>
                  <div className="section-title">
                    <div>
                      <label>SPORTMONKS DATA</label>
                      <h2>Real team statistics and match analysis</h2>
                    </div>
                  </div>

                  {statsLoading&&(
                    <div className="empty">
                      Loading real team statistics and prediction…
                    </div>
                  )}

                  {statsError&&(
                    <div className="notice">
                      <Activity/>
                      <div>
                        <b>Match analysis temporarily unavailable</b>
                        <p>{statsError}</p>
                      </div>
                    </div>
                  )}

                  {analysis&&(
                    <>
                      <div className="details">
                        {renderTeamStats(analysis.home,chosen.home)}
                        {renderTeamStats(analysis.away,chosen.away)}
                      </div>

                      <div className="notice">
                        <ShieldCheck/>
                        <div>
                          <b>
                            Sportmonks data · Home sample: {analysis.sampleSize.home} matches · Away sample: {analysis.sampleSize.away} matches
                          </b>
                          <p>{analysis.disclaimer}</p>
                        </div>
                      </div>
                    </>
                  )}

                  {!chosen.homeTeamId||!chosen.awayTeamId?(
                    <div className="notice">
                      <BrainCircuit/>
                      <div>
                        <b>Team IDs unavailable</b>
                        <p>
                          This fixture does not currently contain both
                          Sportmonks team IDs.
                        </p>
                      </div>
                    </div>
                  ):null}
                </>
              )}

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
                      <b>{isReal?'Statistical model limitations':'Demo model limitations'}</b>
                      <p>
                        {isReal
                          ?(analysis?.prediction.dataLimitations||[]).join(' · ')
                          :'These estimates use sample data, not verified statistics for this real fixture.'}
                        {' '}These estimates are illustrative, not validated betting advice.
                      </p>
                    </div>
                  </div>
                </>
              ):!isReal?(
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
              ):null}
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
                      ?'Automatically ranked statistical estimates from real fixtures.'
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

              {page==='AI Best Picks'?(
                <>
                  <div className="stats">
                    {[
                      ['Fixtures found',bestMeta?.fixturesFound??'—'],
                      ['Fixtures analysed',bestMeta?.fixturesAnalysed??'—'],
                      ['Picks returned',bestMeta?.picksReturned??'—'],
                      ['Engine','100.0']
                    ].map(([title,value])=>(
                      <article key={String(title)}>
                        <div><BrainCircuit/>{title}</div>
                        <strong>{value}</strong>
                        <small>Experimental engine output</small>
                      </article>
                    ))}
                  </div>

                  <div className="section-title">
                    <div>
                      <label>ELITE MATCH AI 100.0</label>
                      <h2>Automatically ranked Best Picks</h2>
                    </div>
                    <button
                      onClick={loadBestPicks}
                      disabled={bestLoading}
                    >
                      <RefreshCw/>
                      {bestLoading?'Analysing…':'Refresh'}
                    </button>
                  </div>

                  {bestMeta&&(
                    <div className="notice">
                      <BrainCircuit/>
                      <div>
                        <b>
                          {bestMeta.engine} · {bestMeta.modelStatus}
                        </b>
                        <p>
                          Analysed {bestMeta.fixturesAnalysed} upcoming fixtures.
                          Generated: {formatKickoff(bestMeta.generatedAt)}
                          {bestMeta.cached?' · Cached result':''}
                        </p>
                      </div>
                    </div>
                  )}

                  {bestError&&(
                    <div className="notice">
                      <Activity/>
                      <div>
                        <b>Best Picks unavailable</b>
                        <p>{bestError}</p>
                      </div>
                    </div>
                  )}

                  {bestLoading?(
                    <div className="empty">
                      <BrainCircuit/>
                      Analysing upcoming fixtures and ranking markets…
                    </div>
                  ):bestPicks.length===0?(
                    <div className="empty">
                      No qualifying picks are currently available.
                      The engine will not invent selections.
                    </div>
                  ):(
                    <div className="details">
                      {bestPicks.map(renderBestPick)}
                    </div>
                  )}

                  {bestNotice&&(
                    <div className="notice">
                      <ShieldCheck/>
                      <div>
                        <b>Important model warning</b>
                        <p>{bestNotice}</p>
                      </div>
                    </div>
                  )}
                </>
              ):(
                <>
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
                        isReal?'—':String(preds.length).padStart(2,'0'),
                        isReal?'Analysis runs when a fixture is opened':'Demo baseline only'
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
                        {page==='Performance'
                          ?'Prediction performance'
                          :'Upcoming fixtures'}
                      </h2>
                    </div>
                    <button onClick={loadFixtures}>
                      Refresh fixtures
                    </button>
                  </div>

                  {page==='Performance'?(
                    <div className="notice">
                      <ChartNoAxesCombined/>
                      <div>
                        <b>Performance tracker is not active yet</b>
                        <p>
                          We will add permanent prediction records,
                          settled results, accuracy and profit/loss tracking
                          in a later upgrade. No historical performance
                          figures are being invented.
                        </p>
                      </div>
                    </div>
                  ):(
                    <>
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
                                    ?'Match analysis available'
                                    :'Demo model'}
                                </strong>
                                ›
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div className="notice">
                    <ShieldCheck/>
                    <div>
                      <b>Data transparency</b>
                      <p>
                        {isReal
                          ?'Fixture information and team statistics are supplied by Sportmonks. Match-specific estimates are generated when a fixture is opened. Predictions are not validated betting advice.'
                          :isDemo
                          ?'The current fixtures and model estimates are sample data for testing. They are not verified betting predictions.'
                          :'The football data connection is currently unavailable. Please try again later.'}
                      </p>
                    </div>
                  </div>
                </>
              )}
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
