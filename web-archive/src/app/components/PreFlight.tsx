import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, CheckCircle2, Loader2, Map, Navigation, Thermometer, Minus, Activity } from "lucide-react";
import { motion } from "motion/react";

export function PreFlight() {
  const navigate = useNavigate();
  const { id } = useParams();
  const flightId = id?.replace("%20", " ") || "AI 101";

  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 2;
      setProgress((prev) => {
        const next = prev + 2;
        if (next > 100) return 100;
        return next;
      });
      
      if (currentProgress >= 25) setStep(1);
      if (currentProgress >= 50) setStep(2);
      if (currentProgress >= 75) setStep(3);
      if (currentProgress >= 100) {
        setStep(4);
        clearInterval(interval);
      }
    }, 40);

    return () => clearInterval(interval);
  }, []);

  const steps = [
    { label: "Route & Waypoints", icon: Navigation },
    { label: "Speed Profile", icon: Activity },
    { label: "Weather SIGMETs", icon: Thermometer },
    { label: "Offline Map Tiles", icon: Map },
  ];

  const circumference = 2 * Math.PI * 90; // r=90

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] text-white overflow-hidden relative p-6">
      <div className="flex items-center mb-12">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors text-white">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="flex-1 text-center font-semibold text-lg mr-6 tracking-wide">{flightId} · DEL → BOM</h1>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-sm mx-auto">
        <div className="relative w-56 h-56 mb-12 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform absolute inset-0 text-[#4A9EFF]">
            <circle 
              cx="112" cy="112" r="90" 
              stroke="rgba(255,255,255,0.05)" strokeWidth="12" fill="none"
            />
            <circle 
              cx="112" cy="112" r="90" 
              stroke="currentColor" strokeWidth="12" fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (progress / 100) * circumference}
              strokeLinecap="round"
              className="transition-all duration-300 ease-linear drop-shadow-[0_0_12px_rgba(74,158,255,0.6)]"
            />
          </svg>
          <div className="text-center relative z-10">
            <motion.span 
              className="text-5xl font-bold tracking-tighter"
            >
              {Math.round(progress)}
            </motion.span>
            <span className="text-2xl text-[#8E8E93] ml-1">%</span>
          </div>
        </div>

        <div className="w-full glass-panel rounded-3xl p-6 space-y-5">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${i < step ? "bg-[#4A9EFF]/20 text-[#4A9EFF]" : i === step ? "bg-white/10 text-white" : "bg-white/5 text-[#8E8E93]"}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <span className={`text-[15px] font-medium ${i < step ? "text-white" : i === step ? "text-white/90" : "text-[#8E8E93]"}`}>
                  {s.label}
                </span>
              </div>
              <div className="flex items-center">
                {i < step ? (
                  <CheckCircle2 className="w-5 h-5 text-[#00E676]" />
                ) : i === step ? (
                  <Loader2 className="w-5 h-5 text-[#4A9EFF] animate-spin" />
                ) : (
                  <Minus className="w-5 h-5 text-[#8E8E93]/50" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-6 pb-4 w-full">
        <div className="flex justify-center mb-6">
          <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-[#8E8E93]">
            {step === 4 ? "All steps complete" : `Downloading... ${step} of 4`}
          </div>
        </div>
        <button 
          disabled={step < 4}
          onClick={() => navigate(`/track/${flightId.replace(" ", "")}`)}
          className={`w-full py-4 text-lg font-semibold rounded-full transition-all duration-300 ${
            step === 4 
              ? "bg-[#4A9EFF] text-white glow-blue active:scale-[0.98]" 
              : "bg-white/10 text-[#8E8E93] cursor-not-allowed"
          }`}
        >
          Ready to Fly
        </button>
      </div>
    </div>
  );
}
