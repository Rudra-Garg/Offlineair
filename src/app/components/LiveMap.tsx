import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Mountain } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";

export function LiveMap() {
  const navigate = useNavigate();
  const { id } = useParams();
  const flightId = id || "AI 101";

  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowNotification(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const data = [
    { name: "Start", alt: 0 },
    { name: "Climb", alt: 15000 },
    { name: "Cruise", alt: 35000 },
    { name: "Descent", alt: 20000 },
    { name: "End", alt: 0 },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] text-white relative overflow-hidden">
      {/* Map Background */}
      <div 
        className="absolute top-0 left-0 w-full h-[65%] bg-cover bg-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1634176866089-b633f4aec882?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWFwJTIwZWFydGglMjBuaWdodHxlbnwxfHx8fDE3NzM2NTMwNDJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')` }}
      >
        <div className="absolute inset-0 bg-black/40" />

        {/* SVG Route Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 390 550">
          <path 
            d="M 50 450 Q 150 200, 300 150" 
            stroke="#4A9EFF" strokeWidth="4" fill="none" 
            strokeLinecap="round" strokeDasharray="6 4"
            className="drop-shadow-[0_0_8px_rgba(74,158,255,0.6)]"
          />
          <polygon points="120,300 200,280 250,330 150,350" fill="rgba(255,0,0,0.2)" stroke="rgba(255,0,0,0.4)" />
          {/* Airplane Icon */}
          <g transform="translate(150, 275) rotate(45)">
            <circle cx="0" cy="0" r="16" fill="rgba(74,158,255,0.2)" />
            <path d="M-8,8 L0,-12 L8,8 Z" fill="#FFF" className="drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
          </g>
          {/* Pin */}
          <circle cx="200" cy="200" r="4" fill="#FF9800" stroke="#FFF" strokeWidth="2" />
        </svg>

        {/* Top Controls */}
        <div className="absolute top-12 left-6 right-6 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-black/30 bg-black/20 backdrop-blur-md text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="bg-black/40 backdrop-blur-md rounded-full px-4 py-2 flex items-center gap-3 border border-white/10">
            <span className="font-semibold">{flightId}</span>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#00E676]">Live</span>
              <div className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse glow-green" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div className="absolute bottom-0 left-0 w-full h-[38%] glass-panel rounded-t-3xl pt-2 px-6 flex flex-col pb-8 z-10">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6 mt-2" />
        
        {/* Row 1: Stats */}
        <div className="flex gap-3 mb-6">
          <StatTile label="ALT" value="35,000 ft" />
          <StatTile label="SPD" value="487 kts" />
          <StatTile label="ETA" value="1h 24m" />
        </div>

        {/* Row 2: Altitude Graph */}
        <div className="h-16 w-full mb-6 relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorAlt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4A9EFF" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4A9EFF" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="alt" stroke="#FFF" fillOpacity={1} fill="url(#colorAlt)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="absolute top-[20%] left-[45%] w-3 h-3 bg-[#4A9EFF] border-2 border-white rounded-full drop-shadow-[0_0_6px_rgba(74,158,255,1)]" />
        </div>

        {/* Row 3: Phase & Actions */}
        <div className="flex items-center justify-between mt-auto">
          <div className="px-3 py-1.5 rounded-full bg-[#4A9EFF]/20 border border-[#4A9EFF]/30 text-[#4A9EFF] text-xs font-semibold uppercase tracking-wider">
            Cruise Phase
          </div>
          <button onClick={() => navigate(`/complete/${flightId}`)} className="text-[#8E8E93] text-sm font-medium hover:text-white transition-colors">
            Nudge Position
          </button>
        </div>
      </div>

      {/* Landmark Notification Modal */}
      <AnimatePresence>
        {showNotification && (
          <motion.div 
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="absolute bottom-6 left-4 right-4 bg-[#1C1C2E] rounded-3xl p-6 border-t-2 border-[#4A9EFF] z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-[#FF9800]/20 flex items-center justify-center shrink-0">
                <Mountain className="w-6 h-6 text-[#FF9800]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-1">Crossing the Himalayas</h3>
                <p className="text-[#8E8E93] text-sm">Estimated position · 8,848m peak range below</p>
              </div>
            </div>
            
            <div className="h-px w-full bg-white/10 my-4" />
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#8E8E93]">Distance from route</span>
                <span className="font-medium">12 km south</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[#8E8E93]">Elevation</span>
                <span className="font-medium">8,848 m</span>
              </div>
            </div>

            <button 
              onClick={() => {
                setShowNotification(false);
                setTimeout(() => navigate(`/complete/${flightId}`), 1000);
              }}
              className="w-full bg-[#4A9EFF] text-white rounded-full py-3.5 text-base font-semibold glow-blue transition-transform active:scale-[0.98]"
            >
              Got it
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatTile({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex-1 bg-black/40 rounded-2xl p-3 flex flex-col items-center justify-center border border-white/5">
      <span className="text-[11px] font-medium text-[#8E8E93] mb-1">{label}</span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
