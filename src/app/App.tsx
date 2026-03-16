import { RouterProvider } from "react-router";
import { router } from "./routes";

export default function App() {
  return (
    <div className="flex justify-center min-h-screen bg-black text-white selection:bg-[#4A9EFF]/30">
      <div className="w-full max-w-[390px] h-[100dvh] relative overflow-hidden bg-flight-bg shadow-2xl shadow-[#4A9EFF]/5 sm:border-x sm:border-white/10 sm:rounded-3xl sm:h-[844px] sm:my-auto">
        <RouterProvider router={router} />
      </div>
    </div>
  );
}
