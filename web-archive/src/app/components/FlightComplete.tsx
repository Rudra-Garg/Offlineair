import { useNavigate, useParams } from "react-router";
import { CheckCircle2, Wifi } from "lucide-react";
import { motion } from "motion/react";

export function FlightComplete() {
  const navigate = useNavigate();
  const { id } = useParams();
  const flightId = id || "AI 101";

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] text-white p-6 relative overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="flex flex-col items-center mt-16 mb-12"
      >
        <div className="w-24 h-24 rounded-full bg-[#00E676]/20 flex items-center justify-center mb-6 relative">
          <div className="absolute inset-0 bg-[#00E676]/30 blur-2xl rounded-full" />
          <CheckCircle2 className="w-12 h-12 text-[#00E676] relative z-10" />
        </div>
        <h1 className="text-[28px] font-bold tracking-tight mb-2">Flight Complete</h1>
        <p className="text-[#8E8E93] font-medium">{flightId} · DEL → BOM · 2h 07m</p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="glass-panel rounded-3xl p-6 mb-10"
      >
        <div className="grid grid-cols-2 gap-y-6 gap-x-4">
          <div className="flex flex-col gap-1">
            <span className="text-[#8E8E93] text-sm">Departed</span>
            <span className="font-semibold text-lg">08:45 AM</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[#8E8E93] text-sm">Landed</span>
            <span className="font-semibold text-lg">10:52 AM</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[#8E8E93] text-sm">Distance</span>
            <span className="font-semibold text-lg">1,136 km</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[#8E8E93] text-sm">Est. Accuracy</span>
            <span className="font-semibold text-lg text-white/40">—</span>
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="relative mb-auto flex-1 flex flex-col justify-end"
      >
        <div className="absolute -inset-6 bg-[#4A9EFF]/5 blur-3xl -z-10" />
        
        <div className="flex items-center gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#4A9EFF]/20 flex items-center justify-center">
            <Wifi className="w-5 h-5 text-[#4A9EFF]" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Sync actual flight data</h3>
            <p className="text-[#8E8E93] text-sm leading-tight">Download real ADS-B track to<br/>compare with your estimate</p>
          </div>
        </div>
        
        <button 
          onClick={() => navigate(`/compare/${flightId}`)}
          className="w-full bg-[#4A9EFF] text-white rounded-full py-4 text-lg font-semibold glow-blue transition-transform active:scale-[0.98] mb-3"
        >
          Sync Now
        </button>
        
        <button 
          onClick={() => navigate("/")}
          className="w-full bg-transparent text-[#8E8E93] hover:bg-white/5 rounded-full py-4 text-base font-semibold transition-colors active:scale-[0.98]"
        >
          Skip for now
        </button>

        <p className="text-center text-[#8E8E93]/50 text-[11px] mt-4 font-medium">Data available ~1 hour after landing</p>
      </motion.div>
    </div>
  );
}
