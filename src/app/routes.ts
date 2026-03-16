import { createBrowserRouter } from "react-router";
import { FlightSearch } from "./components/FlightSearch";
import { PreFlight } from "./components/PreFlight";
import { LiveMap } from "./components/LiveMap";
import { FlightComplete } from "./components/FlightComplete";
import { ComparisonView } from "./components/ComparisonView";
import { AccuracyReport } from "./components/AccuracyReport";

export const router = createBrowserRouter([
  {
    path: "/",
    children: [
      { index: true, Component: FlightSearch },
      { path: "download/:id", Component: PreFlight },
      { path: "track/:id", Component: LiveMap },
      { path: "complete/:id", Component: FlightComplete },
      { path: "compare/:id", Component: ComparisonView },
      { path: "report/:id", Component: AccuracyReport },
    ],
  },
]);
