"use client";

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  AlertTriangle, 
  Activity, 
  Shield, 
  Rss, 
  BrainCircuit, 
  ShieldAlert,
  Globe,
  Clock,
  Radio,
  Terminal,
  TrendingDown,
  TrendingUp,
  Minus
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';

interface Signal {
  id: string;
  title: string;
  content: string;
  source: string;
  sentiment: number;
  timestamp: string;
  type?: string;
}

interface Narrative {
  id: string;
  title: string;
  description: string;
  sentiment: number;
  aiSummary: string | null;
  updatedAt: string;
  signals: Signal[];
}

interface Alert {
  type: string;
  narrativeId: string;
  title: string;
  message: string;
  timestamp: string;
}

const LIVE_CHANNELS = [
  { id: 'channels', name: 'Channels TV', embedUrl: 'https://www.youtube.com/embed/W8nThq62Vb4?autoplay=1&mute=1' },
  { id: 'arise', name: 'Arise News', embedUrl: 'https://www.youtube.com/embed/TJ5V8KRSu9Y?autoplay=1&mute=1' },
  { id: 'tvc', name: 'TVC News', embedUrl: 'https://www.youtube.com/embed/b-Yzp0l8cAM?autoplay=1&mute=1' },
  { id: 'nta', name: 'NTA News', embedUrl: 'https://www.youtube.com/embed/UzbdGEarrCo?autoplay=1&mute=1' },
  { id: 'aljazeera', name: 'Al Jazeera (Global)', embedUrl: 'https://www.youtube.com/embed/live_stream?channel=UCNye-wNBqNL5ZzHSJj3l8Bg&autoplay=1&mute=1' },
];

export default function OSINTDashboard() {
  const [narratives, setNarratives] = useState<Narrative[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [activeChannel, setActiveChannel] = useState(LIVE_CHANNELS[0]);

  // Hydration-safe clock: only set on client
  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Data & Sockets
  useEffect(() => {
    fetch('http://localhost:4000/api/narratives')
      .then(res => res.json())
      .then(data => setNarratives(data))
      .catch(err => console.error("Failed to load narratives:", err));

    const socket: Socket = io('http://localhost:4000');

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('alert', (alertData: Alert) => {
      setAlerts(prev => [alertData, ...prev].slice(0, 20));
    });

    const interval = setInterval(() => {
      fetch('http://localhost:4000/api/narratives')
        .then(res => res.json())
        .then(data => setNarratives(data));
    }, 15000);

    return () => {
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  // Aggregate all signals from all narratives to simulate a master raw feed
  const allSignals = narratives.flatMap(n => n.signals).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Helper for sentiment styling
  const getSentimentColor = (score: number) => {
    if (score < -0.3) return 'text-red-500';
    if (score > 0.3) return 'text-green-500';
    return 'text-yellow-500';
  };

  const getSentimentIcon = (score: number) => {
    if (score < -0.3) return <TrendingDown className="w-3 h-3 text-red-500 inline" />;
    if (score > 0.3) return <TrendingUp className="w-3 h-3 text-green-500 inline" />;
    return <Minus className="w-3 h-3 text-yellow-500 inline" />;
  };

  // Helper for generating signal URLs
  const getSignalUrl = (sig: Signal) => {
    if (sig.type === 'tweet') {
      return `https://twitter.com/i/web/status/${sig.id}`;
    }
    // RSS feeds usually store the URL in the ID field
    if (sig.id.startsWith('http')) {
      return sig.id;
    }
    return '#';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-300 font-mono text-xs overflow-hidden flex flex-col selection:bg-green-900 selection:text-white">
      {/* TOP COMMAND BAR */}
      <header className="h-10 border-b border-[#1a1a1a] flex justify-between items-center px-4 bg-[#0a0a0a] shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-white font-bold tracking-widest uppercase">
            <Globe className="w-4 h-4 text-green-500" />
            NGR OSINT Command
          </div>
          <div className="h-4 w-[1px] bg-gray-800"></div>
          <div className="flex items-center gap-2 text-gray-500">
            <Radio className="w-3 h-3 animate-pulse text-red-500" />
            LIVE
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-green-500">
            <Activity className="w-3 h-3" />
            <span>SYS: {isConnected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
          <div className="flex items-center gap-2 text-yellow-500">
            <Clock className="w-3 h-3" />
            <span>
              {currentTime ? currentTime.toISOString().replace('T', ' ').substring(0, 19) + ' UTC' : ''}
            </span>
          </div>
        </div>
      </header>

      {/* MAIN GRID LAYOUT - DENSE PANELS */}
      <div className="flex-1 grid grid-cols-12 gap-1 p-1 bg-black overflow-hidden h-[calc(100vh-2.5rem-2rem)]">
        
        {/* LEFT COLUMN: AI & STRATEGIC OUTLOOK (Cols: 3) */}
        <div className="col-span-3 flex flex-col gap-1 overflow-hidden">
          
          <div className="panel flex-1 flex flex-col overflow-hidden">
            <div className="panel-header">
              <BrainCircuit className="w-4 h-4" />
              <span>AI Strategic Summaries</span>
            </div>
            <div className="panel-content overflow-y-auto space-y-4">
              {narratives.map(n => (
                <div key={n.id} className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 hover:border-green-900/50 transition-colors">
                  <div className="flex justify-between items-center mb-2 border-b border-[#1a1a1a] pb-1">
                    <span className="font-bold text-white uppercase">{n.title}</span>
                    <span className="text-[10px] text-gray-500">Upd: {new Date(n.updatedAt).toLocaleTimeString()}</span>
                  </div>
                  {n.aiSummary ? (
                    <p className="text-gray-400 leading-relaxed text-[11px]">{n.aiSummary}</p>
                  ) : (
                    <p className="text-yellow-600/50 italic animate-pulse">Awaiting AI Assessment...</p>
                  )}
                  <div className="mt-3 pt-2 border-t border-[#1a1a1a] flex justify-between text-[10px]">
                    <span className="text-gray-600">Vol: {n.signals.length} sigs</span>
                    <span className={getSentimentColor(n.sentiment)}>
                      {getSentimentIcon(n.sentiment)} {n.sentiment.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* CENTER COLUMN: LIVE MEDIA & METRICS (Cols: 6) */}
        <div className="col-span-6 flex flex-col gap-1 overflow-hidden">
          
          {/* TOP CENTER: MULTI-LAYER VIDEO FEED */}
          <div className="panel h-2/3 flex flex-col">
            <div className="panel-header flex-col items-stretch gap-2 py-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                  <span>Live Intelligence Feed</span>
                </div>
                <span className="text-[10px] bg-red-900/30 text-red-500 px-2 rounded border border-red-900">
                  {activeChannel.name.toUpperCase()}
                </span>
              </div>
              
              {/* Channel Selector */}
              <div className="flex gap-2">
                {LIVE_CHANNELS.map(ch => (
                  <button 
                    key={ch.id}
                    onClick={() => setActiveChannel(ch)}
                    className={`px-3 py-1 text-[10px] uppercase font-bold border transition-colors ${activeChannel.id === ch.id ? 'bg-[#00ff41]/20 text-[#00ff41] border-[#00ff41]' : 'bg-transparent text-gray-500 border-[#1a1a1a] hover:bg-[#111] hover:text-gray-300'}`}
                  >
                    {ch.name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="panel-content p-0 relative bg-[#0a0a0a] flex-1">
               {/* Embed Live News Channel */}
               <iframe 
                  className="w-full h-full object-cover" 
                  src={activeChannel.embedUrl} 
                  title={activeChannel.name}
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                ></iframe>

                {/* OVERLAY HUD DATA */}
                <div className="absolute top-4 left-4 bg-black/70 border border-white/10 p-2 backdrop-blur-sm pointer-events-none">
                  <div className="text-[10px] text-gray-400 uppercase mb-1">Active Monitors</div>
                  <div className="text-green-500 font-bold text-lg">{allSignals.length} <span className="text-[10px] text-gray-500 font-normal">nodes</span></div>
                </div>
                
                <div className="absolute bottom-4 right-4 bg-black/70 border border-white/10 p-2 backdrop-blur-sm pointer-events-none">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                    <span className="text-white">REC</span>
                  </div>
                </div>
            </div>
          </div>

          {/* BOTTOM CENTER: SYSTEM METRICS CHART */}
          <div className="panel flex-1 flex flex-col min-h-[200px]">
            <div className="panel-header">
              <Activity className="w-4 h-4" />
              <span>Volume & Sentiment Telemetry</span>
            </div>
            <div className="panel-content relative min-h-[180px]">
              {/* Fake chart data based on active narratives for visual density */}
              <ResponsiveContainer width="100%" height={180} minWidth={0} minHeight={0}>
                <AreaChart data={narratives.map(n => ({ name: n.title.substring(0, 6), volume: n.signals.length, sentiment: n.sentiment * 100 }))}>
                  <defs>
                    <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff41" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#00ff41" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="name" stroke="#555" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#000', borderColor: '#333', fontSize: '10px' }}
                    itemStyle={{ color: '#00ff41' }}
                  />
                  <Area type="monotone" dataKey="volume" stroke="#00ff41" fillOpacity={1} fill="url(#colorVol)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: ALERTS & RAW FEED (Cols: 3) */}
        <div className="col-span-3 flex flex-col gap-1 overflow-hidden">
          
          {/* TOP RIGHT: CRITICAL ALERTS */}
          <div className="panel h-1/2 flex flex-col">
            <div className="panel-header text-red-500 border-b border-red-900/50 bg-red-950/10">
              <ShieldAlert className="w-4 h-4" />
              <span>Priority Intel Alerts</span>
            </div>
            <div className="panel-content overflow-y-auto space-y-2">
              {alerts.length === 0 ? (
                <div className="text-gray-600 text-center py-4 italic">No critical anomalies detected.</div>
              ) : (
                alerts.map((a, i) => (
                  <div key={i} className="bg-red-950/20 border-l-2 border-red-600 p-2 hover:bg-red-900/30 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-red-400 uppercase">[{a.type}]</span>
                      <span className="text-[9px] text-red-800">{new Date(a.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-gray-300">{a.message}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* BOTTOM RIGHT: RAW INGESTION FEED */}
          <div className="panel h-1/2 flex flex-col">
            <div className="panel-header">
              <Terminal className="w-4 h-4" />
              <span>Raw Signal Ingestion</span>
            </div>
            <div className="panel-content overflow-y-auto p-0">
              <table className="w-full text-[10px] text-left border-collapse">
                <thead className="bg-[#0a0a0a] sticky top-0 border-b border-[#1a1a1a] shadow-md shadow-black z-10">
                  <tr>
                    <th className="p-2 font-normal text-gray-500 w-16">TIME</th>
                    <th className="p-2 font-normal text-gray-500 w-16">SRC</th>
                    <th className="p-2 font-normal text-gray-500">CONTENT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1a1a1a]">
                  {allSignals.slice(0, 50).map(sig => {
                    const signalUrl = getSignalUrl(sig);
                    return (
                      <tr key={sig.id} className="hover:bg-[#111] transition-colors group">
                        <td className="p-2 text-gray-600 whitespace-nowrap">{new Date(sig.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</td>
                        <td className="p-2">
                          <span className="bg-gray-900 text-gray-400 px-1 py-0.5 rounded border border-gray-800 uppercase">
                            {sig.source.replace('https://', '').replace('www.', '').split('/')[0].substring(0, 6)}
                          </span>
                        </td>
                        <td className="p-2 truncate max-w-[150px]">
                          {signalUrl !== '#' ? (
                            <a href={signalUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 group-hover:text-green-400 hover:underline transition-colors block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                              {sig.title}
                            </a>
                          ) : (
                            <span className="text-gray-400 group-hover:text-gray-200 block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                              {sig.title}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

      {/* FOOTER GLOBAL TICKER */}
      <footer className="h-8 border-t border-[#1a1a1a] bg-[#000] shrink-0 flex items-center overflow-hidden text-[10px]">
        <div className="bg-green-900/20 text-green-500 px-4 h-full flex items-center border-r border-[#1a1a1a] font-bold uppercase shrink-0">
          GLOBAL SITREP
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap px-4 text-gray-400">
          <div className="animate-[marquee_60s_linear_infinite] inline-block">
            {allSignals.slice(0, 20).map(sig => (
              <span key={sig.id} className="mx-8">
                <span className="text-gray-600 mr-2">[{sig.source.toUpperCase()}]</span>
                {sig.title}
              </span>
            ))}
          </div>
        </div>
      </footer>

      <style jsx global>{`
        /* Custom Scrollbar for dense UI */
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #00ff41; }
        
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* Reusable panel styles for the grid */
        .panel {
          background-color: #000;
          border: 1px solid #1a1a1a;
        }
        .panel-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background-color: #050505;
          border-bottom: 1px solid #1a1a1a;
          color: #aaa;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          font-size: 10px;
        }
        .panel-content {
          padding: 0.75rem;
        }
      `}</style>
    </div>
  );
}
