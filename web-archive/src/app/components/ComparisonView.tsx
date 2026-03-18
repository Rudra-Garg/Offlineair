import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";

export function ComparisonView() {
  const navigate = useNavigate();
  const { id } = useParams();
  const flightId = id || "AI 101";
  
  const [activeTab, setActiveTab] = useState("Both");

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] text-white relative overflow-hidden">
      {/* Map Background */}
      <div 
        className="absolute top-0 left-0 w-full h-[65%] bg-cover bg-center"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1634176866089-b633f4aec882?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYXJrJTIwbWFwJTIwZWFydGglMjBuaWdodHxlbnwxfHx8fDE3NzM2NTMwNDJ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')` }}
      >
        <div className="absolute inset-0 bg-black/50" />

        {/* SVG Route Overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 390 550">
          
          {/* Haze Gradient */}
          <path 
            d="M 50 450 Q 150 200, 300 150 L 300 130 Q 150 160, 50 450 Z" 
            fill="rgba(74,158,255,0.1)" 
          />
          
          {/* Estimated Route */}
          {(activeTab === "Estimated" || activeTab === "Both") && (
            <path 
              d="M 50 450 Q 150 200, 300 150" 
              stroke="#4A9EFF" strokeWidth="3" fill="none" 
              strokeLinecap="round" strokeDasharray="6 4"
            />
          )}
          
          {/* Actual Route */}
          {(activeTab === "Actual" || activeTab === "Both") && (
            <path 
              d="M 50 450 Q 150 160, 300 130" 
              stroke="#00E676" strokeWidth="4" fill="none" 
              strokeLinecap="round" 
              className="drop-shadow-[0_0_8px_rgba(0,230,118,0.6)]"
            />
          )}

          {/* Deviation Dots along Estimated Route */}
          {(activeTab === "Estimated" || activeTab === "Both") && (
            <g>
              <circle cx="100" cy="315" r="4" fill="#00E676" />
              <circle cx="150" cy="245" r="4" fill="#FF9800" />
              <circle cx="200" cy="200" r="4" fill="#F44336" />
              <circle cx="250" cy="170" r="4" fill="#FF9800" />
            </g>
          )}
        </svg>

        {/* Top Controls */}
        <div className="absolute top-12 left-6 right-6 flex items-center justify-between z-10">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-black/30 bg-black/20 backdrop-blur-md text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <div className="bg-black/40 backdrop-blur-md rounded-full p-1 flex items-center border border-white/10">
            {["Estimated", "Actual", "Both"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeTab === tab 
                    ? "bg-[#4A9EFF] text-white shadow-lg shadow-[#4A9EFF]/30" 
                    : "text-[#8E8E93] hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div className="absolute bottom-0 left-0 w-full h-[40%] glass-panel rounded-t-3xl pt-2 px-6 flex flex-col pb-6 z-10">
        <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-5 mt-2" />
        
        {/* Title Row */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">Flight Comparison</h2>
          <div className="px-3 py-1 rounded-lg bg-[#4A9EFF]/20 border border-[#4A9EFF]/30 text-[#4A9EFF] font-bold text-sm glow-blue-text">
            Score: 84
          </div>
        </div>

        {/* Deviation Legend */}
        <div className="flex justify-between items-center mb-6 bg-white/5 rounded-xl p-3 border border-white/5">
          <LegendItem color="bg-[#00E676]" label="< 10km" />
          <LegendItem color="bg-[#FF9800]" label="10–50km" />
          <LegendItem color="bg-[#F44336]" label="> 50km" />
        </div>

        {/* Timeline Scrubber */}
        <div className="mb-6 relative">
          <div className="h-1 w-full bg-white/10 rounded-full" />
          <div className="absolute top-1/2 -translate-y-1/2 left-[40%] w-4 h-4 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
          <div className="flex justify-between mt-2 text-[10px] font-medium text-[#8E8E93]">
            <span>08:45 DEL</span>
            <span>10:52 BOM</span>
          </div>
        </div>

        {/* Phase Accuracy Row */}
        <div className="flex gap-3 mb-6">
          <PhaseAccuracy label="Climb" score={91} color="#00E676" />
          <PhaseAccuracy label="Cruise" score={82} color="#4A9EFF" />
          <PhaseAccuracy label="Descent" score={79} color="#FF9800" />
        </div>

        {/* View Report Button */}
        <button 
          onClick={() => navigate(`/report/${flightId}`)}
          className="mt-auto flex items-center justify-center gap-2 w-full text-white bg-white/10 hover:bg-white/15 rounded-xl py-3 font-semibold transition-colors"
        >
          View Full Report <ChevronRight className="w-5 h-5 text-[#8E8E93]" />
        </button>
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string, label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-[11px] font-medium text-[#8E8E93]">{label}</span>
    </div>
  );
}

function PhaseAccuracy({ label, score, color }: { label: string, score: number, color: string }) {
  const dash = 2 * Math.PI * 14; 
  const offset = dash - (score / 100) * dash;
  
  return (
    <div className="flex-1 bg-black/40 rounded-2xl p-2.5 flex items-center gap-3 border border-white/5">
      <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
        <svg className="w-full h-full -rotate-90">
          <circle cx="16" cy="16" r="14" stroke="rgba(255,255,255,0.05)" strokeWidth="3" fill="none" />
          <circle 
            cx="16" cy="16" r="14" 
            stroke={color} strokeWidth="3" fill="none" 
            strokeDasharray={dash} strokeDashoffset={offset} strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-[10px] font-bold">{score}</span>
      </div>
      <span className="text-[11px] font-medium text-[#8E8E93]">{label}</span>
    </div>
  );
}
