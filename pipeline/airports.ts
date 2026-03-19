/**
 * OfflineAir — Airport lookup
 * Provides lat/lng for ICAO codes so DataPipeline can seed the map
 * and compute corridor bounding boxes without a round-trip API call.
 *
 * Sourced from OurAirports open data (public domain).
 * Expand this list as needed — or swap for a full OurAirports CSV fetch.
 */

export interface AirportInfo {
  icao: string;
  iata: string;
  name: string;
  latitude: number;
  longitude: number;
  elevationFt: number;
}

const AIRPORTS: Record<string, AirportInfo> = {
  // ── India ──────────────────────────────────────────────────────────────────
  VIDP: { icao: 'VIDP', iata: 'DEL', name: 'Indira Gandhi International',   latitude: 28.5562,  longitude: 77.1000,  elevationFt: 777  },
  VABB: { icao: 'VABB', iata: 'BOM', name: 'Chhatrapati Shivaji Maharaj',    latitude: 19.0896,  longitude: 72.8656,  elevationFt: 37   },
  VOMM: { icao: 'VOMM', iata: 'MAA', name: 'Chennai International',          latitude: 12.9941,  longitude: 80.1709,  elevationFt: 52   },
  VOBL: { icao: 'VOBL', iata: 'BLR', name: 'Kempegowda International',       latitude: 13.1979,  longitude: 77.7063,  elevationFt: 3000 },
  VECC: { icao: 'VECC', iata: 'CCU', name: 'Netaji Subhas Chandra Bose',     latitude: 22.6547,  longitude: 88.4467,  elevationFt: 16   },
  VOCI: { icao: 'VOCI', iata: 'COK', name: 'Cochin International',           latitude: 10.1520,  longitude: 76.3919,  elevationFt: 30   },
  VAAH: { icao: 'VAAH', iata: 'AMD', name: 'Sardar Vallabhbhai Patel',       latitude: 23.0772,  longitude: 72.6347,  elevationFt: 189  },
  VEGY: { icao: 'VEGY', iata: 'GAU', name: 'Lokpriya Gopinath Bordoloi',     latitude: 26.1061,  longitude: 91.5859,  elevationFt: 162  },
  VEJH: { icao: 'VEJH', iata: 'JAI', name: 'Jaipur International',           latitude: 26.8242,  longitude: 75.8122,  elevationFt: 1263 },
  VILD: { icao: 'VILD', iata: 'LUH', name: 'Ludhiana Airport',               latitude: 30.8547,  longitude: 75.9526,  elevationFt: 834  },
  VOPB: { icao: 'VOPB', iata: 'IXZ', name: 'Vir Savarkar International',    latitude: 11.6412,  longitude: 92.7297,  elevationFt: 14   },
  VEBN: { icao: 'VEBN', iata: 'VNS', name: 'Lal Bahadur Shastri',           latitude: 25.4524,  longitude: 82.8593,  elevationFt: 266  },
  VOHB: { icao: 'VOHB', iata: 'HBX', name: 'Hubli Airport',                 latitude: 15.3617,  longitude: 75.0849,  elevationFt: 2171 },
  VEPB: { icao: 'VEPB', iata: 'PAT', name: 'Jay Prakash Narayan',           latitude: 25.5913,  longitude: 85.0880,  elevationFt: 170  },

  // ── International hubs (common connections) ────────────────────────────────
  OMDB: { icao: 'OMDB', iata: 'DXB', name: 'Dubai International',           latitude: 25.2532,  longitude: 55.3657,  elevationFt: 62   },
  EGLL: { icao: 'EGLL', iata: 'LHR', name: 'London Heathrow',               latitude: 51.4775,  longitude: -0.4614,  elevationFt: 83   },
  KJFK: { icao: 'KJFK', iata: 'JFK', name: 'John F. Kennedy International', latitude: 40.6413,  longitude: -73.7781, elevationFt: 13   },
  WSSS: { icao: 'WSSS', iata: 'SIN', name: 'Singapore Changi',              latitude: 1.3644,   longitude: 103.9915, elevationFt: 22   },
  VHHH: { icao: 'VHHH', iata: 'HKG', name: 'Hong Kong International',       latitude: 22.3080,  longitude: 113.9185, elevationFt: 28   },
  YSSY: { icao: 'YSSY', iata: 'SYD', name: 'Sydney Kingsford Smith',        latitude: -33.9399, longitude: 151.1753, elevationFt: 21   },
};

/**
 * Look up an airport by ICAO code.
 * Returns null if not found (caller should fall back to API or prompt user).
 */
export function getAirport(icao: string): AirportInfo | null {
  return AIRPORTS[icao.toUpperCase()] ?? null;
}

/**
 * Look up by IATA code (3-letter). Linear scan — only use at setup time.
 */
export function getAirportByIata(iata: string): AirportInfo | null {
  const upper = iata.toUpperCase();
  return Object.values(AIRPORTS).find(a => a.iata === upper) ?? null;
}

/**
 * Build PipelineInput coordinates from two ICAO codes.
 * Falls back to 0,0 if an airport is unknown (pipeline will still run
 * but SIGMET corridor filtering will be inaccurate).
 */
export function airportCoords(originIcao: string, destIcao: string) {
  const org = getAirport(originIcao);
  const dst = getAirport(destIcao);
  return {
    originLat: org?.latitude  ?? 0,
    originLng: org?.longitude ?? 0,
    destLat:   dst?.latitude  ?? 0,
    destLng:   dst?.longitude ?? 0,
  };
}