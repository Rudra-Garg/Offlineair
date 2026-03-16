import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Share } from "lucide-react";
import { motion } from "motion/react";

export function AccuracyReport() {
  const navigate = useNavigate();
  const { id } = useParams();
  const flightId = id || "AI 101";

  const dash = 2 * Math.PI * 64; 
  const score = 84;
  const offset = dash - (score / 100) * dash;

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] text-white p-6 relative overflow-hidden">
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold tracking-wide">Accuracy Report</h1>
        <button className="p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors">
          <Share className="w-5 h-5" />
        </button>
      </div>

      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="flex flex-col items-center justify-center mb-10"
      >
        <div className="relative w-40 h-40 mb-6 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90">
            <circle cx="80" cy="80" r="64" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="none" />
            <motion.circle 
              initial={{ strokeDashoffset: dash }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
              cx="80" cy="80" r="64" 
              stroke="#4A9EFF" strokeWidth="8" fill="none" 
              strokeDasharray={dash} strokeLinecap="round"
              className="drop-shadow-[0_0_12px_rgba(74,158,255,0.6)]"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-2">
            <span className="text-5xl font-bold tracking-tighter">{score}</span>
            <span className="text-sm font-medium text-[#8E8E93]">/ 100</span>
          </div>
        </div>
        <div className="px-4 py-1.5 rounded-full bg-[#4A9EFF]/20 text-[#4A9EFF] border border-[#4A9EFF]/30 text-sm font-semibold tracking-wider uppercase">
          Good Accuracy
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-2 gap-3 mb-8"
      >
        <StatCard label="Avg Deviation" value="18.4 km" />
        <StatCard label="Max Deviation" value="41.2 km" />
        <StatCard label="RMSE" value="21.7 km" />
        <StatCard label="Track Points" value="248" />
      </motion.div>

      {/* Phase Breakdown */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="space-y-5 flex-1"
      >
        <h3 className="text-[#8E8E93] text-xs font-semibold uppercase tracking-wider mb-2">Phase Breakdown</h3>
        <PhaseBar label="Climb" score={91} color="bg-[#00E676]" glow="shadow-[0_0_10px_rgba(0,230,118,0.4)]" />
        <PhaseBar label="Cruise" score={82} color="bg-[#4A9EFF]" glow="shadow-[0_0_10px_rgba(74,158,255,0.4)]" />
        <PhaseBar label="Descent" score={79} color="bg-[#FF9800]" glow="shadow-[0_0_10px_rgba(255,152,0,0.4)]" />
      </motion.div>

      {/* Bottom Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-auto pt-6 pb-2"
      >
        <div className="text-center text-[#8E8E93] text-sm mb-6 font-medium">
          {flightId} · DEL → BOM · Mar 14 2026
        </div>
        <button 
          className="w-full bg-[#4A9EFF] text-white rounded-full py-4 text-lg font-semibold glow-blue transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Share className="w-5 h-5" /> Share Report
        </button>
      </motion.div>
    </div>
  );
}

function StatCard({ label, value }: { label: string, value: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col justify-center">
      <span className="text-xs font-medium text-[#8E8E93] mb-1">{label}</span>
      <span className="text-lg font-semibold text-white">{value}</span>
    </div>
  );
}

function PhaseBar({ label, score, color, glow }: { label: string, score: number, color: string, glow: string }) {
  return (
    <div className="flex items-center justify-between group">
      <span className="w-16 text-sm font-medium text-[#8E8E93] group-hover:text-white transition-colors">{label}</span>
      <div className="flex-1 mx-4 h-2 bg-white/5 rounded-full overflow-hidden flex">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
          className={`h-full rounded-full ${color} ${glow}`}
        />
      </div>
      <span className="w-8 text-right font-semibold">{score}</span>
    </div>
  );
}
