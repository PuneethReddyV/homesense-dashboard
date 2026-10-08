import {useCallback,useEffect,useMemo,useState} from 'react';
import {CartesianGrid,Line,LineChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';

type Reading={timestamp:string;temperature:number;humidity:number};
type ApiResponse={deviceId:string;readings:Reading[]};
const API_URL=import.meta.env.VITE_API_URL as string;
const DEVICE_ID=(import.meta.env.VITE_DEVICE_ID as string|undefined)??'homesense-room-01';

function dateOf(v:string){const d=new Date(v.replace(' ','T'));return Number.isNaN(d.getTime())?new Date(0):d}
function timeOf(v:string){return dateOf(v).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
function dateTimeOf(v:string){return dateOf(v).toLocaleString()}

export default function App(){
 const [readings,setReadings]=useState<Reading[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 const load=useCallback(async()=>{if(!API_URL){setError('VITE_API_URL is not configured.');setLoading(false);return}
  try{const r=await fetch(`${API_URL}/readings?deviceId=${encodeURIComponent(DEVICE_ID)}&limit=100`);
   if(!r.ok)throw new Error(`API returned ${r.status}`); const d=await r.json() as ApiResponse; setReadings(d.readings??[]);setError('')
  }catch(e){setError(e instanceof Error?e.message:'Unable to load readings')}finally{setLoading(false)}
 },[]);
 useEffect(()=>{load();const id=window.setInterval(load,5000);return()=>window.clearInterval(id)},[load]);
 const data=useMemo(()=>readings.slice().sort((a,b)=>dateOf(a.timestamp).getTime()-dateOf(b.timestamp).getTime()).map(r=>({...r,time:timeOf(r.timestamp)})),[readings]);
 const latest=data.at(-1);
 const chart=(key:'temperature'|'humidity',unit:string,label:string)=>(
  <article className="card"><div className="heading"><div><h2>{label}</h2><p>{label} over time</p></div><b>{unit}</b></div>
   <div className="chart">{loading&&!data.length?<div className="empty">Loading readings…</div>:!data.length?<div className="empty">No readings yet.</div>:
    <ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="time" minTickGap={32}/><YAxis domain={['auto','auto']}/><Tooltip labelFormatter={v=>`Time: ${v}`} formatter={v=>[`${Number(v).toFixed(1)} ${unit}`,label]}/><Line type="monotone" dataKey={key} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>}</div>
  </article>);
 return <main className="page">
  <header><div><small>HOMESENSE</small><h1>Room environment</h1><p>Live DHT11 readings from <strong>{DEVICE_ID}</strong></p></div><span className="status">● Refreshing every 5 seconds</span></header>
  {error&&<div className="error">{error}</div>}
  <section className="summary"><div className="metric"><span>Temperature</span><strong>{latest?`${latest.temperature.toFixed(1)} °C`:'--'}</strong></div><div className="metric"><span>Humidity</span><strong>{latest?`${latest.humidity.toFixed(1)} %`:'--'}</strong></div><div className="metric"><span>Last reading</span><strong>{latest?dateTimeOf(latest.timestamp):'--'}</strong></div></section>
  <section className="charts">{chart('temperature','°C','Temperature')}{chart('humidity','%','Humidity')}</section>
  <footer>AWS IoT → DynamoDB → API Gateway/Lambda → HomeSense dashboard</footer>
 </main>
}