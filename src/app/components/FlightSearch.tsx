import { useNavigate } from "react-router";
import { Search, Plane } from "lucide-react";
import { motion } from "motion/react";

export function FlightSearch() {
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate("/download/AI101");
  };

  return (
    <div className="flex flex-col h-full bg-[#0A0A0F] p-6 text-white overflow-hidden relative">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="mt-12 mb-8"
      >
        <h1 className="text-4xl font-semibold mb-2 tracking-tight">Where are<br/>you flying?</h1>
        <p className="text-[#8E8E93] text-lg">Search your flight number</p>
      </motion.div>

      <motion.form 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        onSubmit={handleSearch} 
        className="mb-10"
      >
        <div className="relative group">
          <div className="absolute inset-0 bg-[#4A9EFF]/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative glass-panel rounded-full flex items-center px-5 py-4 shadow-lg border border-white/10">
            <Search className="w-6 h-6 text-[#4A9EFF] mr-3" />
            <input 
              type="text" 
              placeholder="e.g. AI101" 
              className="bg-transparent border-none outline-none text-white text-lg w-full placeholder:text-[#8E8E93]/70 font-medium"
              required
            />
          </div>
        </div>
      </motion.form>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
        className="flex-1"
      >
        <h3 className="text-[#8E8E93] text-sm font-medium mb-4 uppercase tracking-wider">Recent Flights</h3>
        <div className="space-y-4">
          <FlightCard 
            flightNum="AI 101"
            route="DEL → BOM"
            time="08:45 AM"
            status="On Time"
            statusColor="text-[#00E676]"
            onClick={() => navigate("/download/AI101")}
          />
          <FlightCard 
            flightNum="BA 234"
            route="LHR → JFK"
            time="14:20 PM"
            status="Delayed"
            statusColor="text-[#FF9800]"
            onClick={() => navigate("/download/BA234")}
          />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        className="mt-auto pt-6 pb-4"
      >
        <button 
          onClick={handleSearch}
          className="w-full bg-[#4A9EFF] text-white rounded-full py-4 text-lg font-semibold glow-blue transition-transform active:scale-[0.98]"
        >
          Find Flight
        </button>
      </motion.div>
    </div>
  );
}

function FlightCard({ flightNum, route, time, status, statusColor, onClick }: { flightNum: string, route: string, time: string, status: string, statusColor: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full text-left glass-panel rounded-2xl p-4 flex items-center gap-4 transition-all hover:bg-white/5 active:scale-[0.98]"
    >
      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
        <Plane className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1">
        <h4 className="text-white font-semibold text-lg">{flightNum}</h4>
        <p className="text-[#8E8E93] text-sm">{route}</p>
      </div>
      <div className="text-right">
        <div className="text-[#4A9EFF] font-semibold">{time}</div>
        <div className={`text-xs font-medium ${statusColor} bg-white/5 px-2 py-0.5 rounded-full inline-block mt-1`}>{status}</div>
      </div>
    </button>
  );
}
