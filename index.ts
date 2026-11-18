import express from 'express';import cors from 'cors';import {z} from 'zod';import {demoMatches,type Match} from './sampleData';import {predictMatch} from './prediction';
const app=express();app.use(cors());app.use(express.json());const PORT=Number(process.env.PORT||3001);
app.get('/api/health',(_q,r)=>r.json({ok:true,service:'elite-match-ai-api'}));
app.get('/api/matches',(_q,r)=>r.json({source:'DEMO_DATA',live:false,matches:demoMatches}));
app.get('/api/predictions',(_q,r)=>r.json({source:'DEMO_DATA',disclaimer:'Illustrative output using sample fixtures; not a live betting tip.',predictions:demoMatches.map(m=>({matchId:m.id,...predictMatch(m)}))}));
const schema=z.object({home:z.string().min(1).max(80),away:z.string().min(1).max(80),homeGoalsFor:z.number().min(0).max(8),homeGoalsAgainst:z.number().min(0).max(8),awayGoalsFor:z.number().min(0).max(8),awayGoalsAgainst:z.number().min(0).max(8)});
app.post('/api/analyze',(req,res)=>{const p=schema.safeParse(req.body);if(!p.success)return res.status(400).json({error:'Invalid match inputs',details:p.error.flatten()});const v=p.data;const m:Match={id:'custom',competition:'Custom analysis',kickoff:new Date().toISOString(),home:v.home,away:v.away,status:'SCHEDULED',score:null,homeForm:[],awayForm:[],homeGF:v.homeGoalsFor,homeGA:v.homeGoalsAgainst,awayGF:v.awayGoalsFor,awayGA:v.awayGoalsAgainst,dataLabel:'DEMO'};return res.json({source:'MODEL_FROM_USER_INPUT',...predictMatch(m)});});
app.listen(PORT,'0.0.0.0',()=>console.log(`Elite Match AI API listening on ${PORT}`));
