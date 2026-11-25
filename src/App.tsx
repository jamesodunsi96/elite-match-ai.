

import {useEffect,useMemo,useState} from 'react';
import {
  Activity,BrainCircuit,CalendarDays,ChartNoAxesCombined,
ChevronRight,Clock3,Menu,Search,ShieldCheck,Sparkles,
Target,Trophy,Wifi,X,RefreshCw,Bell
} from 'lucide-react';

type Match={
  id:string;
  homeTeamId?:string;
  awayTeamId?:string;
  competition:string;
  kickoff:string;
  home:string;
  away:string;
  homeLogo?:string|null;
  awayLogo?:string|null;
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
  homeLogo?:string|null;
  awayLogo?:string|null;
  market:string;
  estimatedProbability:number;
  bookmakerOdds:{
  bookmaker:string;
  decimalOdds:number;
  updatedAt:string|null;
  source:string;
}|null;
  oddsComparison:{
  rawImpliedProbability:number;
  modelMinusImpliedPercentagePoints:number;
  method:string;
}|null;
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
  entries:number;
  pending:number;
  won:number;
  lost:number;
  settled:number;
  accuracy:number|null;
  dailyTotal:number;
  dailyPending:number;
  dailyWon:number;
  dailyLost:number;
  dailySettled:number;
  dailyAccuracy:number|null;
  latestAccuracy:number|null;
  latestRecords:PerformanceRecord[];
  records:PerformanceRecord[];
};
type FixtureDetailsResponse={
  source:string;
  fixture:any;
  notice:string;
};
type PlayerSeasonStatsResponse={
  source:string;
  player:any;
  seasonId:string;
  cached?:boolean;
};
type AppNotification={
  id:string;
  type:string;
  title:string;
  body:string;
  data:Record<string,unknown>;
  created_at:string;
  read_at:string|null;
};
const nav=[
  {name:'Overview',icon:Activity},
  {name:'Fixtures',icon:CalendarDays},
  {name:'Football Live',icon:Wifi},
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
function getTacticalPosition(positionName:string){
  const position=positionName.toLowerCase();

  if(position.includes('goalkeeper')) return 'GK';

  if(
    position.includes('defender')||
    position.includes('back')
  ) return 'DEF';

  if(position.includes('midfield')) return 'MID';

  if(
    position.includes('forward')||
    position.includes('striker')||
    position.includes('attacker')||
    position.includes('winger')
  ) return 'FWD';

  return 'OTHER';
  }
function urlBase64ToUint8Array(base64String:string){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding)
    .replace(/-/g,'+')
    .replace(/_/g,'/');
  const raw=window.atob(base64);
  return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));
}
export default function App(){
  const[page,setPage]=useState('Overview');
  const [notifications,setNotifications]=useState<AppNotification[]>([]);
const [notificationsLoading,setNotificationsLoading]=useState(false);
const [showNotifications,setShowNotifications]=useState(false);
const [deviceId,setDeviceId]=useState('');
  const [pushEnabled,setPushEnabled]=useState(false);
const [pushLoading,setPushLoading]=useState(false);
const [pushMessage,setPushMessage]=useState('');
  const[matches,setMatches]=useState<Match[]>([]);
  const[liveMatches,setLiveMatches]=useState<Match[]>([]);
const[liveLoading,setLiveLoading]=useState(false);
const[liveError,setLiveError]=useState('');
  const[preds,setPreds]=useState<Pred[]>([]);
  const[loading,setLoading]=useState(true);
  const[query,setQuery]=useState('');
  const[selected,setSelected]=useState<string|null>(null);
  const[menu,setMenu]=useState(false);
  const[source,setSource]=useState('Connecting');

  const[analysis,setAnalysis]=useState<RealAnalysis|null>(null);
  const[statsLoading,setStatsLoading]=useState(false);
  const[statsError,setStatsError]=useState('');
const[fixtureDetails,setFixtureDetails]=useState<FixtureDetailsResponse|null>(null);
const[fixtureDetailsLoading,setFixtureDetailsLoading]=useState(false);
const[fixtureDetailsError,setFixtureDetailsError]=useState('');
  const[selectedPlayerId,setSelectedPlayerId]=useState<string|null>(null);
const[playerSeasonStats,setPlayerSeasonStats]=useState<PlayerSeasonStatsResponse|null>(null);
const[playerSeasonLoading,setPlayerSeasonLoading]=useState(false);
const[playerSeasonError,setPlayerSeasonError]=useState('');
  const[verification,setVerification]=useState<any>(null);
const[verificationLoading,setVerificationLoading]=useState(false);
const[verificationError,setVerificationError]=useState('');
  const[bestPicks,setBestPicks]=useState<BestPick[]>([]);
  const[bestLoading,setBestLoading]=useState(false);
  const[bestError,setBestError]=useState('');
  const[bestNotice,setBestNotice]=useState('');
  const[bestMeta,setBestMeta]=useState<BestPicksResponse|null>(null);
const[performance,setPerformance]=useState<PerformanceResponse|null>(null);
const[performanceLoading,setPerformanceLoading]=useState(false);
const[performanceError,setPerformanceError]=useState('');
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

  const loadLiveMatches=()=>{
    setLiveLoading(true);
    setLiveError('');

    fetch('/api/live-matches')
      .then(async r=>{
        const data=await r.json();
        if(!r.ok){
          throw new Error(data.warning||'Live matches request failed.');
        }
        return data;
      })
      .then(data=>{
        setLiveMatches(data.matches||[]);
      })
      .catch(error=>{
        setLiveMatches([]);
        setLiveError(error.message||'Unable to load live matches.');
      })
      .finally(()=>{
        setLiveLoading(false);
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
  if(page!=='Football Live') return;

  loadFixtures();

  const timer=window.setInterval(()=>{
    loadFixtures();
  },60000);

  return ()=>{
    window.clearInterval(timer);
  };
},[page]);
    useEffect(()=>{
    let id=localStorage.getItem('elite-match-device-id');

    if(!id){
      id=crypto.randomUUID();
      localStorage.setItem('elite-match-device-id',id);
    }

    setDeviceId(id);

    fetch('/api/notifications/register-device',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({deviceId:id})
    }).catch(()=>{});
  },[]);
    const loadNotifications=()=>{
    if(!deviceId) return;

    setNotificationsLoading(true);

    fetch(`/api/notifications?deviceId=${encodeURIComponent(deviceId)}`)
      .then(async r=>{
        if(!r.ok) throw new Error('Notifications request failed');
        return r.json();
      })
      .then(data=>{
        setNotifications(data.notifications||[]);
      })
      .catch(()=>{})
      .finally(()=>{
        setNotificationsLoading(false);
      });
  };

  useEffect(()=>{
    if(deviceId) loadNotifications();
  },[deviceId]);
    useEffect(()=>{
    if(!deviceId||!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready
      .then(registration=>registration.pushManager.getSubscription())
      .then(subscription=>{
        setPushEnabled(Boolean(subscription));
      })
      .catch(()=>{});
  },[deviceId]);
  const sendTestPush=async()=>{
  setPushLoading(true);
  setPushMessage('');

  try{
    const response=await fetch('/api/notifications/test-push',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({deviceId})
    });

    const data=await response.json();

    if(!response.ok){
      throw new Error(data.error||'Test notification failed.');
    }

    setPushMessage('Test notification sent. Check your phone.');
  }catch(error:any){
    setPushMessage(error.message||'Unable to send test notification.');
  }finally{
    setPushLoading(false);
  }
};
    const enablePush=async()=>{
    setPushLoading(true);
    setPushMessage('');

    try{
      if(!('serviceWorker' in navigator)||!('PushManager' in window)){
        throw new Error('Push notifications are not supported by this browser.');
      }

      const permission=await Notification.requestPermission();

      if(permission!=='granted'){
        throw new Error('Notification permission was not granted.');
      }

      const keyResponse=await fetch('/api/notifications/public-key');
      const keyData=await keyResponse.json();

      if(!keyResponse.ok||!keyData.configured||!keyData.publicKey){
        throw new Error('Push notifications are not configured on the server.');
      }

      const registration=await navigator.serviceWorker.ready;

      let subscription=await registration.pushManager.getSubscription();

      if(!subscription){
        subscription=await registration.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:urlBase64ToUint8Array(keyData.publicKey)
        });
      }

      const response=await fetch('/api/notifications/subscribe',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          deviceId,
          subscription:subscription.toJSON()
        })
      });

      if(!response.ok){
        throw new Error('Could not save this device subscription.');
      }

      setPushEnabled(true);
      setPushMessage('Phone notifications enabled.');
    }catch(error:any){
      setPushMessage(error.message||'Unable to enable notifications.');
    }finally{
      setPushLoading(false);
    }
  };

  const disablePush=async()=>{
    setPushLoading(true);
    setPushMessage('');

    try{
      const registration=await navigator.serviceWorker.ready;
      const subscription=await registration.pushManager.getSubscription();

      if(subscription){
        await fetch('/api/notifications/unsubscribe',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            deviceId,
            endpoint:subscription.endpoint
          })
        });

        await subscription.unsubscribe();
      }

      setPushEnabled(false);
      setPushMessage('Phone notifications disabled.');
    }catch(error:any){
      setPushMessage(error.message||'Unable to disable notifications.');
    }finally{
      setPushLoading(false);
    }
  };
  const loadPerformance=()=>{
    setPerformanceLoading(true);
    setPerformanceError('');

    fetch('/api/performance')
      .then(async r=>{
        const data=await r.json();

        if(!r.ok){
          throw new Error(data.error||'Performance request failed.');
        }

        return data as PerformanceResponse;
      })
      .then(data=>{
        setPerformance(data);
      })
      .catch(error=>{
        setPerformanceError(
          error.message||'Unable to load performance.'
        );
      })
      .finally(()=>{
        setPerformanceLoading(false);
      });
  };
    useEffect(()=>{
    if(page==='AI Best Picks'||page==='Overview'){
      loadBestPicks();
    }
  },[page]);
  useEffect(()=>{
    if(page==='Performance'){
      loadPerformance();
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
const visibleMatches = page === 'Overview'
  ? filtered.slice(0, 5)
  : filtered;
  const chosen=matches.find(m=>m.id===selected);
  const isReal=source==='SPORTMONKS';
  const isDemo=source==='DEMO_DATA';
useEffect(()=>{
  if(!chosen||!isReal){
    setFixtureDetails(null);
    setFixtureDetailsError('');
    setFixtureDetailsLoading(false);
    return;
  }

  let cancelled=false;

  setFixtureDetails(null);
  setFixtureDetailsError('');
  setFixtureDetailsLoading(true);

  fetch(`/api/fixture-details/${chosen.id}`)
    .then(async r=>{
      const data=await r.json();

      if(!r.ok){
        throw new Error(data.error||'Unable to load fixture details.');
      }

      return data as FixtureDetailsResponse;
    })
    .then(data=>{
      if(!cancelled) setFixtureDetails(data);
    })
    .catch(error=>{
      if(!cancelled){
        setFixtureDetailsError(
          error.message||'Unable to load fixture details.'
        );
      }
    })
    .finally(()=>{
      if(!cancelled) setFixtureDetailsLoading(false);
    });

  return ()=>{cancelled=true;};
},[chosen?.id,isReal]);
  useEffect(()=>{
  const seasonId=fixtureDetails?.fixture?.season_id;

  if(!selectedPlayerId||!seasonId){
    setPlayerSeasonStats(null);
    setPlayerSeasonError('');
    setPlayerSeasonLoading(false);
    return;
  }

  let cancelled=false;

  setPlayerSeasonStats(null);
  setPlayerSeasonError('');
  setPlayerSeasonLoading(true);

  fetch(`/api/player-season-stats/${selectedPlayerId}/${seasonId}`)
    .then(async r=>{
      const data=await r.json();

      if(!r.ok){
        throw new Error(data.error||'Unable to load player season statistics.');
      }

      return data as PlayerSeasonStatsResponse;
    })
    .then(data=>{
      if(!cancelled) setPlayerSeasonStats(data);
    })
    .catch(error=>{
      if(!cancelled){
        setPlayerSeasonError(
          error.message||'Unable to load player season statistics.'
        );
      }
    })
    .finally(()=>{
      if(!cancelled) setPlayerSeasonLoading(false);
    });

  return ()=>{cancelled=true;};
},[selectedPlayerId,fixtureDetails?.fixture?.season_id]);
  useEffect(()=>{
  const fixtureId=fixtureDetails?.fixture?.id;

  if(!fixtureId){
    setVerification(null);
    setVerificationError('');
    setVerificationLoading(false);
    return;
  }

  let cancelled=false;

  setVerification(null);
  setVerificationError('');
  setVerificationLoading(true);

  fetch(`/api/verify-fixture-players/${fixtureId}`)
    .then(async r=>{
      const data=await r.json();
      if(!r.ok){
        throw new Error(data.error||'Unable to verify players.');
      }
      return data;
    })
    .then(data=>{
      if(!cancelled) setVerification(data);
    })
    .catch(error=>{
      if(!cancelled){
        setVerificationError(error.message||'Unable to verify players.');
      }
    })
    .finally(()=>{
      if(!cancelled) setVerificationLoading(false);
    });

  return ()=>{cancelled=true;};
},[fixtureDetails?.fixture?.id]);
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
  <b className="team-with-logo">
    {pick.homeLogo ? (
      <img src={pick.homeLogo} alt={`${pick.home} logo`} />
    ) : (
      <span>{pick.home[0]}</span>
    )}
    {pick.home}
  </b>

  <div>
    VS
    <small>{formatKickoff(pick.kickoff)}</small>
  </div>

  <b className="away team-with-logo">
    {pick.away}
    {pick.awayLogo ? (
      <img src={pick.awayLogo} alt={`${pick.away} logo`} />
    ) : (
      <span>{pick.away[0]}</span>
    )}
  </b>
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
            <hr/>

      <h3>Live bookmaker odds</h3>

      {pick.bookmakerOdds?(
        <>
          <div className="prob">
            <span>Bookmaker</span>
            <b>{pick.bookmakerOdds.bookmaker}</b>
          </div>

          <div className="prob">
            <span>Decimal odds</span>
            <b>{pick.bookmakerOdds.decimalOdds.toFixed(2)}</b>
          </div>

          <div className="prob">
            <span>Last bookmaker update</span>
            <b>
              {pick.bookmakerOdds.updatedAt
                ?new Date(pick.bookmakerOdds.updatedAt).toLocaleString(
                  'en-GB',
                  {timeZone:'Africa/Lagos'}
                )+' WAT'
                :'Update time unavailable'}
            </b>
          </div>

          <p className="muted">
            Odds supplied by Sportmonks. Prices may differ from SportyBet
            and can change.
          </p>
        </>
      ):(
        <div className="notice">
          <ShieldCheck/>
          <div>
            <b>Odds unavailable</b>
            <p>No matching active bookmaker price was returned for this market.</p>
          </div>
        </div>
            )}

      {pick.oddsComparison&&(
        <>
          <hr/>
          <h3>Odds intelligence</h3>

          <div className="prob">
            <span>Raw bookmaker-implied probability</span>
            <b>{pct(pick.oddsComparison.rawImpliedProbability)}</b>
          </div>

          <div className="prob">
            <span>Model difference</span>
            <b>
              {pick.oddsComparison.modelMinusImpliedPercentagePoints>0?'+':''}
              {pick.oddsComparison.modelMinusImpliedPercentagePoints.toFixed(1)}
              {' percentage points'}
            </b>
          </div>

          <p className="muted">
            This comparison has not removed bookmaker margin.
            A positive difference does not prove value or guarantee a result.
          </p>
        </>
      )}

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
            <button
              onClick={()=>{
                setShowNotifications(!showNotifications);
                loadNotifications();
              }}
              title="Notifications"
              style={{position:'relative'}}
            >
              <Bell size={19}/>
              {notifications.filter(n=>!n.read_at).length>0&&(
                <span style={{
                  position:'absolute',
                  top:-6,
                  right:-6,
                  background:'#dc2626',
                  color:'#fff',
                  borderRadius:20,
                  fontSize:10,
                  padding:'2px 5px'
                }}>
                  {notifications.filter(n=>!n.read_at).length}
                </span>
              )}
            </button>
            <small>
              <i className={isDemo?'amber':''}/>
              {source}
            </small>
            <b>EM</b>
          </div>
        </header>
        {showNotifications&&(
          <section style={{
            position:'absolute',
            top:65,
            right:16,
            zIndex:10000,
            width:'min(360px, calc(100vw - 32px))',
            maxHeight:420,
            overflowY:'auto',
            background:'#10251d',
            border:'1px solid #d7bd72',
            borderRadius:12,
            padding:16,
            color:'#fff'
          }}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3>Notifications</h3>
              <button onClick={()=>setShowNotifications(false)}>
                <X size={18}/>
              </button>
            </div>

            {notificationsLoading&&<p>Loading notifications...</p>}
            <div style={{marginBottom:12}}>
              <button
                onClick={pushEnabled?disablePush:enablePush}
                disabled={pushLoading||!deviceId}
              >
                {pushLoading
                  ?'Please wait...'
                  :pushEnabled
                  ?'Disable phone notifications'
                  :'Enable phone notifications'}
              </button>
{pushEnabled&&(
  <button
    onClick={sendTestPush}
    disabled={pushLoading}
  >
    Send test notification
  </button>
)}
              {pushMessage&&<p>{pushMessage}</p>}
            </div>
            {!notificationsLoading&&notifications.length===0&&(
              <p>No notifications yet.</p>
            )}

            {notifications.map(item=>(
              <article key={item.id} style={{marginBottom:12,padding:10}}>
                <b>{item.title}</b>
                <p>{item.body}</p>
                <small>{new Date(item.created_at).toLocaleString()}</small>
                {!item.read_at&&(
                  <button onClick={()=>{
                    fetch(`/api/notifications/${item.id}/read`,{
                      method:'PATCH',
                      headers:{'Content-Type':'application/json'},
                      body:JSON.stringify({deviceId})
                    }).then(()=>{
                      setNotifications(current=>current.map(n=>
                        n.id===item.id?{...n,read_at:new Date().toISOString()}:n
                      ));
                    });
                  }}>
                    Mark as read
                  </button>
                )}
              </article>
            ))}
          </section>
        )}
        <section className="content">
          
{!chosen && page === 'Overview' && (
  <div className="dashboard-heading">
    <div>
      <span className="eyebrow">ELITE MATCH AI / WORKSPACE</span>
      <h1>Command Centre</h1>
      <p>
        Your football intelligence dashboard. Explore fixtures,
        statistical analysis and prediction performance.
      </p>
    </div>

    <div className={`connection-pill ${isReal ? 'connected' : 'disconnected'}`}>
      <span className="connection-dot" />
      {isReal ? 'SPORTMONKS CONNECTED' : source}
    </div>
  </div>
)}
  
          {chosen?(
            <>
              <button className="back" onClick={()=>setSelected(null)}>
                ← Back to matches
              </button>

              <div className="heading">
                <label>MATCH CENTRE · {chosen.competition}</label>
                <div className="match-centre-teams">
  <div>
    {chosen.homeLogo ? (
      <img src={chosen.homeLogo} alt={`${chosen.home} logo`} />
    ) : (
      <span>{chosen.home[0]}</span>
    )}
    <b>{chosen.home}</b>
  </div>

  <em>VS</em>

  <div>
    {chosen.awayLogo ? (
      <img src={chosen.awayLogo} alt={`${chosen.away} logo`} />
    ) : (
      <span>{chosen.away[0]}</span>
    )}
    <b>{chosen.away}</b>
  </div>
</div>
                <p>
                  Kick-off {formatKickoff(chosen.kickoff)}
                  · {statusLabel(chosen.status)}
                </p>
              </div>
{fixtureDetailsLoading&&(
  <div className="empty">
    Loading official player and fixture details…
  </div>
)}

{fixtureDetailsError&&(
  <div className="notice">
    <Activity/>
    <div>
      <b>Fixture details unavailable</b>
      <p>{fixtureDetailsError}</p>
    </div>
  </div>
)}

{fixtureDetails&&(
  <>
    <div className="section-title">
      <div>
        <label>OFFICIAL SPORTMONKS DATA</label>
        <h2>Match and player details</h2>
      </div>
    </div>


<div style={{
  display:'grid',
  gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',
  gap:18,
  marginBottom:24
}}>
  {(fixtureDetails.fixture?.participants||[]).map((team:any)=>{
    const players=(fixtureDetails.fixture?.lineups||[])
      .filter((item:any)=>
        item.team_id===team.id &&
        item.formation_field &&
        item.type?.code==='lineup'
      );

    const lines=new Map<number,any[]>();

    players.forEach((item:any)=>{
      const [line]=String(item.formation_field).split(':').map(Number);
      if(!Number.isFinite(line)) return;

      if(!lines.has(line)) lines.set(line,[]);
      lines.get(line)!.push(item);
    });

    const formation=Array.from(lines.entries())
      .filter(([line])=>line!==1)
      .sort((a,b)=>a[0]-b[0])
      .map(([,items])=>items.length)
      .join('-');

    return (
      <article key={`pitch-${team.id}`} style={{padding:14}}>
        <div style={{
          display:'flex',
          justifyContent:'space-between',
          alignItems:'center',
          marginBottom:12
        }}>
          <div>
            <b>{team.name}</b>
            <small style={{display:'block',color:'#94a3b8'}}>
              {team.meta?.location==='home'?'HOME':'AWAY'} TEAM
            </small>
          </div>
          <b style={{color:'#d7bd72',fontSize:13}}>
            {formation||'Formation unavailable'}
          </b>
        </div>

        <div style={{
          height:440,
          position:'relative',
          overflow:'hidden',
          border:'2px solid rgba(255,255,255,.65)',
          borderRadius:10,
          background:'linear-gradient(90deg,#145c39,#197447,#145c39)'
        }}>
          <div style={{
            position:'absolute',
            inset:8,
            border:'1px solid rgba(255,255,255,.55)'
          }}/>

          <div style={{
            position:'absolute',
            left:8,
            right:8,
            top:'50%',
            borderTop:'1px solid rgba(255,255,255,.55)'
          }}/>

          <div style={{
            position:'absolute',
            width:90,
            height:90,
            border:'1px solid rgba(255,255,255,.55)',
            borderRadius:'50%',
            left:'50%',
            top:'50%',
            transform:'translate(-50%,-50%)'
          }}/>

          <div style={{
            position:'absolute',
            width:130,
            height:48,
            border:'1px solid rgba(255,255,255,.55)',
            left:'50%',
            top:8,
            transform:'translateX(-50%)'
          }}/>

          <div style={{
            position:'absolute',
            width:130,
            height:48,
            border:'1px solid rgba(255,255,255,.55)',
            left:'50%',
            bottom:8,
            transform:'translateX(-50%)'
          }}/>

          {players.map((item:any,index:number)=>{
            const [line,lane]=String(item.formation_field)
              .split(':').map(Number);

            const sameLine=players.filter((p:any)=>
              Number(String(p.formation_field).split(':')[0])===line
            );

            const maxLane=Math.max(
              ...sameLine.map((p:any)=>
                Number(String(p.formation_field).split(':')[1])||1
              )
            );

            const left=((lane-0.5)/maxLane)*100;
            const top=96-((line-1)*21);

            return (
              <button
                key={item.id||item.player_id||index}
                onClick={()=>setSelectedPlayerId(String(item.player_id))}
                title={item.player?.display_name||item.player_name||'Player'}
                style={{
                  position:'absolute',
                  left:`${left}%`,
                  top:`${top}%`,
                  transform:'translate(-50%,-50%)',
                  width:64,
                  minHeight:68,
                  padding:'4px 2px',
                  display:'flex',
                  flexDirection:'column',
                  alignItems:'center',
                  gap:2,
                  border:'1px solid #d7bd72',
                  borderRadius:9,
                  background:'rgba(5,20,16,.94)',
                  color:'#fff',
                  zIndex:2
                }}
              >
                {item.player?.image_path?(
                  <img
                    src={item.player.image_path}
                    alt=""
                    style={{
                      width:32,
                      height:32,
                      borderRadius:'50%',
                      objectFit:'cover',
                      border:'1px solid #d7bd72'
                    }}
                  />
                ):(
                  <span style={{
                    width:32,
                    height:32,
                    display:'grid',
                    placeItems:'center',
                    borderRadius:'50%',
                    background:'#34483d'
                  }}>
                    {item.jersey_number||'—'}
                  </span>
                )}

                <b style={{fontSize:10}}>
                  #{item.jersey_number||'—'}
                </b>

                <small style={{
                  width:'100%',
                  fontSize:9,
                  overflow:'hidden',
                  textOverflow:'ellipsis',
                  whiteSpace:'nowrap',
                  textAlign:'center'
                }}>
                  {item.player?.display_name||item.player_name||'Player'}
                </small>
              </button>
            );
          })}
        </div>

        <p className="muted" style={{fontSize:11}}>
          Tactical positions supplied by Sportmonks.
          Formation calculated from the returned player coordinates.
        </p>
      </article>
    );
  })}
</div>

          
<article>
  <h3>Players returned by Sportmonks</h3>
  <p className="muted">
    These players have been checked against club registration records.
    VERIFIED confirms club registration only; it does not confirm
    the starting XI or matchday squad.
  </p>
    {verificationError&&(
    <div className="notice">
      <ShieldCheck/>
      <div>
        <b>Registration verification unavailable</b>
        <p>{verificationError}</p>
        <p>Player registration has not been confirmed. Please try again later.</p>
      </div>
    </div>
  )}
  {verification?.checkedAt&&(
  <p className="muted">
    Last checked: {new Date(verification.checkedAt).toLocaleString()}
  </p>
)}
  {(fixtureDetails.fixture?.participants||[]).map((team:any)=>(
    <div key={team.id} style={{marginBottom:24}}>
      <div className="prob">
        <b>{team.name}</b>
        <small>{team.meta?.location==='home'?'HOME':'AWAY'}</small>
      </div>

      {(fixtureDetails.fixture?.lineups||[])
        .filter((item:any)=>item.team_id===team.id)
        .map((item:any,index:number)=>(
          <div
            className="score"
            key={item.id||index}
            style={{alignItems:'center',gap:12}}
          >
            {item.player?.image_path?(
              <img
                src={item.player.image_path}
                alt={item.player.display_name||item.player.name||'Player'}
                style={{
                  width:48,
                  height:48,
                  borderRadius:'50%',
                  objectFit:'cover',
                  background:'#202938'
                }}
              />
            ):(
              <div style={{
                width:48,
                height:48,
                borderRadius:'50%',
                background:'#202938'
              }}/>
            )}

            <span style={{flex:1}}>
              <b>
                {item.player?.display_name||item.player?.name||'Player'}
              </b>
              <small style={{display:'block'}}>
                {item.position?.name||'Position unavailable'}
              </small>
              {(()=>{
  const playerCheck=verification?.players?.find(
    (p:any)=>String(p.playerId)===String(item.player_id)
  );

  return (
    <>
      <small style={{
        display:'block',
        marginTop:5,
        color:
          playerCheck?.status==='VERIFIED'
            ?'#22c55e'
            :playerCheck?.status==='MISMATCH'
            ?'#ef4444'
            :'#f59e0b'
      }}>
        {verificationLoading
          ?'Checking registration...'
          :verificationError
          ?'Verification unavailable'
          :playerCheck?.status==='VERIFIED'
          ?'✓ VERIFIED'
          :playerCheck?.status==='MISMATCH'
          ?'⚠ TEAM MISMATCH'
          :'UNVERIFIED'}
      </small>

      {playerCheck?.registeredTeam&&(
  <small style={{display:'block',marginTop:3}}>
    Registered club: {playerCheck.registeredTeam}
  </small>
)}

{playerCheck?.reason&&(
  <small style={{
    display:'block',
    marginTop:3,
    color:'#94a3b8'
  }}>
    Audit: {playerCheck.reason}
  </small>
)}
    </>
  );
})()}
            </span>

            <b>
              {item.jersey_number?`#${item.jersey_number}`:'—'}
            </b>
            <button
  onClick={()=>setSelectedPlayerId(String(item.player_id))}
>View Profile
</button>
          </div>
        ))}
    </div>
  ))}

  {(fixtureDetails.fixture?.lineups||[]).length===0&&(
    <p className="muted">Player lineups are not available yet.</p>
  )}
</article>
{selectedPlayerId&&(
  <div
    role="presentation"
    onClick={()=>setSelectedPlayerId(null)}
    style={{
      position:'fixed',
      inset:0,
      zIndex:9999,
      background:'rgba(0,0,0,0.82)',
      display:'flex',
      justifyContent:'center',
      alignItems:'center',
      padding:12
    }}
  >
    <article
      role="dialog"
      aria-modal="true"
      aria-label="Player Profile"
      onClick={e=>e.stopPropagation()}
      style={{
        width:'100%',
        maxWidth:650,
        maxHeight:'90vh',
        overflowY:'auto',
        position:'relative',
        margin:0
      }}
    >
      <button
        onClick={()=>setSelectedPlayerId(null)}
        style={{
          display:'flex',
          alignItems:'center',
          gap:6,
          marginBottom:16
        }}
      >
        <X size={18}/>
        Close Profile
      </button>
    <h3>Player Profile</h3>
{(()=>{
  const player=(fixtureDetails.fixture?.lineups||[])
    .find((item:any)=>String(item.player_id)===String(selectedPlayerId));

  if(!player) return null;

  const team=(fixtureDetails.fixture?.participants||[])
    .find((item:any)=>item.id===player.team_id);

  return (
    <div className="prob" style={{alignItems:'center',gap:14}}>
      {player.player?.image_path&&(
        <img
          src={player.player.image_path}
          alt={player.player.display_name||player.player.name||'Player'}
          style={{
            width:76,
            height:76,
            borderRadius:'50%',
            objectFit:'cover'
          }}
        />
      )}
      <div>
        <b>{player.player?.display_name||player.player?.name||'Player'}</b>
        <span style={{
  display:'inline-block',
  marginTop:6,
  padding:'4px 10px',
  borderRadius:20,
  background:'#2563eb',
  color:'#fff',
  fontSize:12,
  fontWeight:700
}}>
  {player.position?.name||'Position unavailable'}
</span>
        <small style={{display:'block'}}>
          {team?.name||'Team unavailable'}
        </small>
        <small style={{display:'block'}}>
          Shirt number: {player.jersey_number||'—'}
        </small>
      </div>
    </div>
  );
})()}
    {playerSeasonLoading&&(
      <p className="muted">Loading player statistics...</p>
    )}

    {playerSeasonError&&(
      <p className="muted">{playerSeasonError}</p>
    )}

    {playerSeasonStats&&(
      <>
       {playerSeasonStats.cached&&(
  <p className="muted">
    Statistics loaded from saved cache (24-hour validity).
  </p>
)} 
        <h3>Season Performance Dashboard</h3>
        {(()=>{
  const details=(playerSeasonStats.player?.statistics||[])
    .flatMap((stat:any)=>stat.details||[]);

  const getStat=(name:string)=>{
    const item=details.find((d:any)=>
      (d.type?.name||'').toLowerCase()===name.toLowerCase()
    );
    return item?.value?.total;
  };

  return (
  <>
    <h4>Season totals</h4>
    <div style={{
      display:'grid',
      gridTemplateColumns:'repeat(2,minmax(0,1fr))',
      gap:10,
      marginBottom:16
    }}>
      {[
        ['Appearances','Appearances'],
        ['Goals','Goals'],
        ['Assists','Assists'],
        ['Minutes','Minutes Played']
      ].map(([label,key])=>(
        <div className="prob" key={key}>
          <span>{label}</span>
          <b>{getStat(key)??'—'}</b>
        </div>
      ))}
    </div>
  </>);
})()}
        
{(()=>{
  const selectedLineupPlayer=(fixtureDetails.fixture?.lineups||[])
    .find((item:any)=>
      String(item.player_id)===String(selectedPlayerId)
    );

  const positionName=(selectedLineupPlayer?.position?.name||'')
    .toLowerCase();

  const isGoalkeeper=positionName.includes('goalkeeper');

const isForward=
  positionName.includes('forward')||
  positionName.includes('striker')||
  positionName.includes('attacker')||
  positionName.includes('winger');

const isMidfielder=
  positionName.includes('midfield')||
  positionName.includes('midfielder');
const isDefender=
  positionName.includes('defender')||
  positionName.includes('back')||
  positionName.includes('wing-back')||
  positionName.includes('wingback');
const positionCategory=isGoalkeeper
  ?'Goalkeeper'
  :isForward
  ?'Forward'
  :isMidfielder
  ?'Midfielder'
  :isDefender
  ?'Defender'
  :'Player';
  const summaryStats=[
  'appearances',
  'goals',
  'assists',
  'minutes played',
  'team wins',
  'team lost',
  'lineups'
];

  const goalkeeperOnly=[
    'goals conceded',
    'cleansheets',
    'saves'
  ];

  const allDetails=(playerSeasonStats.player?.statistics||[])
    .flatMap((stat:any)=>stat.details||[]);

  const visibleDetails=allDetails.filter((detail:any)=>{
  const name=(detail.type?.name||'')
    .trim()
    .toLowerCase();

  return !summaryStats.includes(name)&&
    (isGoalkeeper||!goalkeeperOnly.includes(name));
});

  return (
  <>
    <p className="muted">
      Player category: <b>{positionCategory}</b>
    </p>

    <h3>{positionCategory} Season Statistics</h3>
      {visibleDetails.length===0?(
        <p className="muted">
          No additional relevant statistics are available yet.
        </p>
      ):visibleDetails.map((detail:any,index:number)=>(
        <div className="prob" key={detail.id||index}>
          <span>{detail.type?.name||'Statistic'}</span>
          <b>{detail.value?.total??'Not available'}</b>
        </div>
      ))}
    </>
  );
})()}


    <div className="notice">
      <ShieldCheck/>
      <div>
        <b>Player statistics status</b>
        <p>
          Goals, assists, ratings and other match statistics will appear
          when Sportmonks makes them available. Missing statistics are
          not treated as zero.
        </p>
      </div>
    </div>
  </>
)}
                </article>
      </div>
)}
  </>
)}
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
              {page !== 'Overview' && (
  <div className="welcome">
    <div>
      <label>● FOOTBALL INTELLIGENCE PLATFORM</label>
      <h1>
        {page}
      </h1>
      <p>
        {page === 'AI Best Picks'
          ? 'Automatically ranked statistical estimates from real fixtures.'
          : page === 'Performance'
          ? 'Honest tracking starts with recording every prediction.'
          : 'Explore fixtures and match information.'}
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
)}

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
              {page==='Overview'&&(
                <section style={{marginBottom:28}}>
                  <div className="section-title">
                    <div>
                      <label>MARKET COMPARISON · EXPERIMENTAL</label>
                      <h2>Odds Intelligence</h2>
                    </div>
                    <button onClick={loadBestPicks} disabled={bestLoading}>
                      {bestLoading?'Updating…':'Refresh odds'}
                    </button>
                  </div>

                  {bestError?(
                    <div className="notice">
                      <ShieldCheck/>
                      <div>
                        <b>Odds intelligence unavailable</b>
                        <p>{bestError}</p>
                      </div>
                    </div>
                  ):(
                    <>
                      <div className="stats">
                        <article>
                          <div><ChartNoAxesCombined/>Comparisons available</div>
                          <strong>{bestPicks.filter(p=>p.oddsComparison).length}</strong>
                          <small>Current experimental picks</small>
                        </article>
                        <article>
                          <div><Target/>Positive model gaps</div>
                          <strong>{bestPicks.filter(p=>p.oddsComparison&&p.oddsComparison.modelMinusImpliedPercentagePoints>0).length}</strong>
                          <small>Before bookmaker-margin adjustment</small>
                        </article>
                        <article>
                          <div><Activity/>Bookmaker prices</div>
                          <strong>{bestPicks.filter(p=>p.bookmakerOdds).length}</strong>
                          <small>Prices returned by Sportmonks</small>
                        </article>
                        <article>
                          <div><ShieldCheck/>Validation status</div>
                          <strong style={{fontSize:15}}>Experimental</strong>
                          <small>Not calibrated or backtested</small>
                        </article>
                      </div>

                      <article className="match">
                        <h3>Largest positive model-price gaps</h3>
                        {bestPicks
                          .filter(p=>p.oddsComparison!==null)
                          .sort((a,b)=>
                            (b.oddsComparison?.modelMinusImpliedPercentagePoints??-Infinity)-
                            (a.oddsComparison?.modelMinusImpliedPercentagePoints??-Infinity)
                          )
                          .slice(0,3)
                          .map(p=>(
                            <div className="score" key={p.matchId}>
                              <span>
                                <b>{p.home} vs {p.away}</b>
                                <small style={{display:'block',marginTop:4}}>
                                  {p.market} · {p.bookmakerOdds?.bookmaker||'Bookmaker unavailable'}
                                </small>
                              </span>
                              <b>
                                {p.oddsComparison!.modelMinusImpliedPercentagePoints>0?'+':''}
                                {p.oddsComparison!.modelMinusImpliedPercentagePoints.toFixed(1)} pp
                              </b>
                            </div>
                          ))}
                        {bestPicks.length===0&&(
                          <p className="muted">Loading current odds comparisons…</p>
                        )}
                      </article>

                      <div className="notice">
                        <ShieldCheck/>
                        <div>
                          <b>Comparison is not a value-bet signal</b>
                          <p>
                            Implied probabilities are raw calculations from decimal odds.
                            Bookmaker margin has not been removed, and the model is not validated.
                            Prices may differ from SportyBet and can change.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </section>
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
                            ):page==='Football Live'?(
                <>
                  <div className="section-title">
                    <div>
                      <label>LIVE FOOTBALL CENTRE</label>
                      <h2>Matches happening now</h2>
                    </div>
                    <button onClick={loadLiveMatches}>
                      <RefreshCw/>
                      Refresh
                    </button>
                  </div>

                  <div className="notice">
                    <Wifi/>
                    <div>
                      <b>Live match data · Sportmonks</b>
                      <p>
                        Live scores and match status update when you refresh.
                        Select a match to open its Match Centre.
                      </p>
                    </div>
                  </div>

                  <div className="matches">
                    {liveMatches.filter(m =>
                      /(LIVE|INPLAY|1ST_HALF|2ND_HALF|HALF_TIME|EXTRA_TIME|PENALTY)/i.test(m.status)
                    ).map(m=>(
                      <button
                        className="match"
                        key={m.id}
                        onClick={()=>setSelected(m.id)}
                      >
                        <div className="meta">
                          <span>{m.competition}</span>
                          <i>● LIVE</i>
                        </div>

                        <div className="teams">
                          <b className="team-with-logo">
                            {m.homeLogo
                              ? <img src={m.homeLogo} alt={`${m.home} logo`}/>
                              : <span>{m.home[0]}</span>}
                            {m.home}
                          </b>

                          <div>
                            <strong>{m.score||'LIVE'}</strong>
                            <small>Match Centre</small>
                          </div>

                          <b className="away team-with-logo">
                            {m.away}
                            {m.awayLogo
                              ? <img src={m.awayLogo} alt={`${m.away} logo`}/>
                              : <span>{m.away[0]}</span>}
                          </b>
                        </div>
                      </button>
                    ))}
                  </div>

                  {liveMatches.filter(m =>
                    /(LIVE|INPLAY|1ST_HALF|2ND_HALF|HALF_TIME|EXTRA_TIME|PENALTY)/i.test(m.status)
                  ).length===0&&(
                    <div className="empty">
                      <Wifi/>
                      <h3>No live matches found right now</h3>
                      <p>
                        Refresh later when matches are in progress.
                        Upcoming fixtures are still available in Fixtures.
                      </p>
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
                        'Settled accuracy',
                        '—',
                        'Accuracy based on settled results'
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
                    <div className="section-actions">
  {page === 'Overview' && (
    <button onClick={() => setPage('Fixtures')}>
      View all fixtures →
    </button>
  )}

  <button onClick={loadFixtures}>
    Refresh fixtures
  </button>
</div>
                  </div>

                  {page==='Performance'?(
                    <div>
  <div className="section-title">
    <div>
      <label>SUPABASE RECORDS</label>
      <h2>Prediction Performance</h2>
    </div>

    <button onClick={loadPerformance} disabled={performanceLoading}>
      <RefreshCw/>
      {performanceLoading?'Loading...':'Refresh'}
    </button>
  </div>

  {performanceLoading&&(
    <div className="empty">Loading performance records...</div>
  )}

  {performanceError&&(
    <div className="notice">
      <Activity/>
      <div>
        <b>Unable to load performance</b>
        <p>{performanceError}</p>
      </div>
    </div>
  )}

  {performance&&(
    <>
      <div className="details">
        <article>
          <h3>Unique predictions</h3>
          <h2>{performance.total}</h2>
        </article>
        <article>
          <h3>All saved entries</h3>
          <h2>{performance.entries}</h2>
        </article>
        <article>
          <h3>Pending</h3>
          <h2>{performance.pending}</h2>
        </article>

        <article>
          <h3>Won</h3>
          <h2>{performance.won}</h2>
        </article>

        <article>
          <h3>Lost</h3>
          <h2>{performance.lost}</h2>
        </article>

        <article>
          <h3>Accuracy</h3>
          <h2>
            {performance.accuracy===null
              ?'Not available'
              :pct(performance.accuracy)}
          </h2>
        </article>
      </div>

      <div className="notice">
  <ShieldCheck/>
  <div>
    <b>Early results — small sample</b>
    <p>
      Current accuracy is based on {performance.settled} settled
      predictions: {performance.won} won and {performance.lost} lost.
      This is an early sample, not proof of long-term performance.
    </p>
  </div>
</div>
<div className="notice">
  <ShieldCheck/>
  <div>
    <b>How prediction records are counted</b>
    <p>
      This response contains {performance.entries} saved database entries,
      grouped into {performance.total} unique predictions by match and market.
      Duplicate saved copies are not counted as separate predictions.
    </p>
  </div>
</div>
<div className="section-title">
  <div>
    <label>DATABASE HISTORY</label>
    <h2>Recorded predictions</h2>
  </div>
</div>

      {performance.records.length===0?(
        <div className="empty">No prediction records found.</div>
      ):performance.records.map(record=>(
        <article className="match" key={`${record.match_id}-${record.market}`}>
          <div className="teams">
            <b>{record.home_team}</b>
            <div>VS</div>
            <b className="away">{record.away_team}</b>
          </div>

          <div className="prob">
            <span>Market</span>
            <b>{record.market}</b>
          </div>

          <div className="meta">
            <span>Prediction status</span>
            <i>{record.status}</i>
          </div>
        </article>
      ))}

      <div className="notice">
        <ShieldCheck/>
        <div>
          <b>Transparent performance tracking</b>
          <p>
  Accuracy is calculated only from settled wins and losses.
  Pending predictions are not counted. Results are checked
  automatically after matches finish, when official scores
  are available.
</p>
        </div>
      </div>
    </>
  )}
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
                        <div className={`matches ${page === 'Overview' ? 'overview-matches' : ''}`}>
                          {visibleMatches.map(m=>(
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
  <b className="team-with-logo">
    {m.homeLogo ? (
      <img src={m.homeLogo} alt={`${m.home} logo`} />
    ) : (
      <span>{m.home[0]}</span>
    )}
    {m.home}
  </b>

  <div>
    {m.status==='NS'?'VS':m.score||'VS'}
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

  <b className="away team-with-logo">
    {m.away}
    {m.awayLogo ? (
      <img src={m.awayLogo} alt={`${m.away} logo`} />
    ) : (
      <span>{m.away[0]}</span>
    )}
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
