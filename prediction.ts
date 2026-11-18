import type {Match} from './sampleData';
function poisson(lambda:number,g:number){let f=1;for(let i=2;i<=g;i++)f*=i;return Math.exp(-lambda)*Math.pow(lambda,g)/f;}
const clamp=(n:number)=>Math.max(.15,Math.min(4.2,n));
export function predictMatch(m:Match){
 const h=clamp(((m.homeGF+m.awayGA)/2)*1.08),a=clamp((m.awayGF+m.homeGA)/2);let hw=0,d=0,aw=0,o25=0,btts=0;const scores:{score:string;probability:number}[]=[];
 for(let x=0;x<=6;x++)for(let y=0;y<=6;y++){const p=poisson(h,x)*poisson(a,y);if(x>y)hw+=p;else if(x===y)d+=p;else aw+=p;if(x+y>=3)o25+=p;if(x>0&&y>0)btts+=p;scores.push({score:`${x}-${y}`,probability:p});}
 scores.sort((x,y)=>y.probability-x.probability);const pc=(v:number)=>Math.round(v*1000)/10;return {model:'Poisson baseline v1',status:'ILLUSTRATIVE_NOT_VALIDATED',expectedGoals:{home:+h.toFixed(2),away:+a.toFixed(2)},probabilities:{homeWin:pc(hw),draw:pc(d),awayWin:pc(aw),over25:pc(o25),under25:pc(1-o25),bttsYes:pc(btts),bttsNo:pc(1-btts)},topScores:scores.slice(0,5).map(s=>({score:s.score,probability:pc(s.probability)})),confidence:'Not calibrated — not betting confidence',dataLimitations:['Sample/demo averages only','No verified injuries, lineups or live xG feed','Not backtested or calibrated'],strongestOutcome:Math.max(hw,d,aw)===hw?'Home win':Math.max(hw,d,aw)===d?'Draw':'Away win',disclaimer:'Illustrative model estimates, not guarantees or betting advice.'};
}
