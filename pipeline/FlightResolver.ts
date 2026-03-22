/**
 * pipeline/FlightResolver.ts
 *
 * Resolves a flight number to real route metadata using two free APIs
 * with graceful degradation:
 *
 * Tier 1 — AviationStack (free tier, 500 req/month)
 *   GET https://api.aviationstack.com/v1/flights?flight_iata=AI101&access_key=KEY
 *   Returns origin IATA, destination IATA, aircraft type, scheduled times.
 *   Requires a free API key from aviationstack.com — set in env or pass at call site.
 *   Tries today + yesterday to handle recently-landed flights (live endpoint
 *   drops flights shortly after landing; flight_date queries historical data).
 *
 * Tier 2 — AeroDataBox via RapidAPI (free tier, 150 req/month)
 *   GET https://aerodatabox.p.rapidapi.com/flights/number/AI101/{date}
 *   Richer data: gate, terminal, actual times.
 *   Requires RapidAPI key — set in env or pass at call site.
 *   Also tries today + yesterday for the same reason as Tier 1.
 *
 * Tier 3 — local airports.ts table
 *   If both APIs fail or return nothing, fall back to our known ICAO pairs.
 *   Unknown flights get VIDP→VABB with a warning rather than crashing.
 *
 * Keys are read from process.env (Expo exposes EXPO_PUBLIC_* vars):
 *   EXPO_PUBLIC_AVIATIONSTACK_KEY
 *   EXPO_PUBLIC_RAPIDAPI_KEY
 *
 * The caller (DataPipeline) doesn't need to know which tier resolved —
 * it just gets a ResolvedFlight or null.
 */

import axios from 'axios';
import {getAirport, getAirportByIata} from './airports';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResolvedFlight {
    flightNumber: string;
    origin: string;   // ICAO
    destination: string;   // ICAO
    originLat: number;
    originLng: number;
    destLat: number;
    destLng: number;
    aircraftType: string | null;
    airline: string | null;
    /** ISO8601 scheduled departure, or null */
    scheduledDep: string | null;
    /** Which tier actually resolved this */
    source: 'aviationstack' | 'aerodatabox' | 'local' | 'fallback';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const http = axios.create({timeout: 10_000});

/** Normalise "AI 101" / "ai101" / "AI101" → "AI101" */
function normalise(raw: string): string {
    return raw.replace(/\s+/g, '').toUpperCase();
}

/** Returns today's date as "YYYY-MM-DD" in UTC */
function todayUtc(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Returns yesterday's date as "YYYY-MM-DD" in UTC */
function yesterdayUtc(): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

/**
 * IATA → ICAO lookup.
 * We prefer the local airports table (instant, offline).
 * Falls back to a simple heuristic prefix map for common regions.
 */
function iataToIcao(iata: string): string | null {
    const airport = getAirportByIata(iata);
    if (airport) return airport.icao;

    // Coarse regional heuristic for airports not in our table
    // Covers the most common cases without an API call
    const REGION_PREFIX: Record<string, string> = {
        // India
        BOM: 'VABB', DEL: 'VIDP', MAA: 'VOMM', BLR: 'VOBL', CCU: 'VECC',
        HYD: 'VOHS', GOI: 'VAGO', AMD: 'VAAH', COK: 'VOCI', JAI: 'VEJH',
        // Gulf
        DXB: 'OMDB', AUH: 'OMAA', DOH: 'OTHH', KWI: 'OKBK', MCT: 'OOMS',
        // UK/EU
        LHR: 'EGLL', LGW: 'EGKK', MAN: 'EGCC', CDG: 'LFPG', AMS: 'EHAM',
        FRA: 'EDDF', MAD: 'LEMD', BCN: 'LEBL', FCO: 'LIRF', MXP: 'LIMC',
        // US
        JFK: 'KJFK', LAX: 'KLAX', ORD: 'KORD', ATL: 'KATL', DFW: 'KDFW',
        SFO: 'KSFO', MIA: 'KMIA', BOS: 'KBOS', SEA: 'KSEA', DEN: 'KDEN',
        // Asia-Pacific
        SIN: 'WSSS', HKG: 'VHHH', NRT: 'RJAA', ICN: 'RKSI', BKK: 'VTBS',
        KUL: 'WMKK', SYD: 'YSSY', MEL: 'YMML',
    };
    return REGION_PREFIX[iata.toUpperCase()] ?? null;
}

function coordsForIcao(icao: string): { lat: number; lng: number } | null {
    const a = getAirport(icao);
    return a ? {lat: a.latitude, lng: a.longitude} : null;
}

// ─── Tier 1: AviationStack ────────────────────────────────────────────────────

interface AvStackFlight {
    flight: { iata: string };
    departure: { iata: string; icao: string; scheduled: string | null };
    arrival: { iata: string; icao: string; scheduled: string | null };
    aircraft: { iata: string | null } | null;
    airline: { name: string | null } | null;
}

async function resolveViaAviationStack(
    flightNumber: string,
    apiKey: string,
): Promise<ResolvedFlight | null> {
    // Try today first, then yesterday.
    // The live /flights endpoint drops flights shortly after landing, but
    // passing flight_date switches to historical data which includes them.
    const datesToTry = [todayUtc(), yesterdayUtc()];

    for (const date of datesToTry) {
        try {
            const {data} = await http.get<{ data: AvStackFlight[] }>(
                'https://api.aviationstack.com/v1/flights',
                {
                    params: {
                        access_key: apiKey,
                        flight_iata: flightNumber,
                        flight_date: date,
                        limit: 1,
                    },
                },
            );

            const flight = data?.data?.[0];
            if (!flight) continue;

            // Prefer ICAO from response, fall back to IATA→ICAO lookup
            const originIcao = flight.departure.icao?.toUpperCase()
                || iataToIcao(flight.departure.iata) || null;
            const destIcao = flight.arrival.icao?.toUpperCase()
                || iataToIcao(flight.arrival.iata) || null;

            if (!originIcao || !destIcao) continue;

            const originCoords = coordsForIcao(originIcao);
            const destCoords = coordsForIcao(destIcao);
            if (!originCoords || !destCoords) continue;

            return {
                flightNumber,
                origin: originIcao,
                destination: destIcao,
                originLat: originCoords.lat,
                originLng: originCoords.lng,
                destLat: destCoords.lat,
                destLng: destCoords.lng,
                aircraftType: flight.aircraft?.iata ?? null,
                airline: flight.airline?.name ?? null,
                scheduledDep: flight.departure.scheduled ?? null,
                source: 'aviationstack',
            };
        } catch {
            // continue to next date
        }
    }

    return null;
}

// ─── Tier 2: AeroDataBox ──────────────────────────────────────────────────────

interface AeroFlight {
    departure: { airport: { iata: string; icao?: string } };
    arrival: { airport: { iata: string; icao?: string } };
    aircraft?: { reg?: string; modeS?: string };
    airline?: { name?: string };
}

async function resolveViaAeroDataBox(
    flightNumber: string,
    rapidApiKey: string,
): Promise<ResolvedFlight | null> {
    // AeroDataBox supports /flights/number/{num}/{date} for historical lookups.
    // Try today first, then yesterday to catch recently-landed flights.
    const datesToTry = [todayUtc(), yesterdayUtc()];

    for (const date of datesToTry) {
        try {
            const {data} = await http.get<AeroFlight[]>(
                `https://aerodatabox.p.rapidapi.com/flights/number/${flightNumber}/${date}`,
                {
                    headers: {
                        'X-RapidAPI-Key': rapidApiKey,
                        'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com',
                    },
                },
            );

            const flight = Array.isArray(data) ? data[0] : null;
            if (!flight) continue;

            const originIcao = flight.departure.airport.icao?.toUpperCase()
                || iataToIcao(flight.departure.airport.iata) || null;
            const destIcao = flight.arrival.airport.icao?.toUpperCase()
                || iataToIcao(flight.arrival.airport.iata) || null;

            if (!originIcao || !destIcao) continue;

            const originCoords = coordsForIcao(originIcao);
            const destCoords = coordsForIcao(destIcao);
            if (!originCoords || !destCoords) continue;

            return {
                flightNumber,
                origin: originIcao,
                destination: destIcao,
                originLat: originCoords.lat,
                originLng: originCoords.lng,
                destLat: destCoords.lat,
                destLng: destCoords.lng,
                aircraftType: null,   // AeroDataBox doesn't reliably return IATA aircraft type
                airline: flight.airline?.name ?? null,
                scheduledDep: null,
                source: 'aerodatabox',
            };
        } catch {
            // continue to next date
        }
    }

    return null;
}

// ─── Tier 3: Local table ──────────────────────────────────────────────────────

// Expanded hardcoded table — covers Indian domestic + common international
const LOCAL_ROUTES: Record<string, { origin: string; destination: string; aircraft?: string }> = {
    // Air India domestic
    AI101: {origin: 'VIDP', destination: 'VABB', aircraft: 'B77W'},
    AI102: {origin: 'VABB', destination: 'VIDP', aircraft: 'B77W'},
    AI191: {origin: 'VIDP', destination: 'VOMM', aircraft: 'A320'},
    AI192: {origin: 'VOMM', destination: 'VIDP', aircraft: 'A320'},
    AI401: {origin: 'VIDP', destination: 'VOBL', aircraft: 'A320'},
    AI402: {origin: 'VOBL', destination: 'VIDP', aircraft: 'A320'},
    AI501: {origin: 'VIDP', destination: 'VECC', aircraft: 'A320'},
    AI9601: {origin: 'VABB', destination: 'VOMM', aircraft: 'A320'},
    // IndiGo
    '6E201': {origin: 'VIDP', destination: 'VABB', aircraft: 'A20N'},
    '6E202': {origin: 'VABB', destination: 'VIDP', aircraft: 'A20N'},
    '6E501': {origin: 'VIDP', destination: 'VOBL', aircraft: 'A20N'},
    '6E301': {origin: 'VIDP', destination: 'VOMM', aircraft: 'A20N'},
    '6E2646': {origin: 'VIDP', destination: 'VABB', aircraft: 'A20N'},
    // International
    BA234: {origin: 'EGLL', destination: 'KJFK', aircraft: 'B744'},
    BA117: {origin: 'EGLL', destination: 'VIDP', aircraft: 'B788'},
    EK500: {origin: 'OMDB', destination: 'VIDP', aircraft: 'A388'},
    EK501: {origin: 'VIDP', destination: 'OMDB', aircraft: 'A388'},
    SQ226: {origin: 'WSSS', destination: 'VIDP', aircraft: 'A359'},
};

function resolveViaLocalTable(flightNumber: string): ResolvedFlight | null {
    const entry = LOCAL_ROUTES[flightNumber];
    if (!entry) return null;

    const originCoords = coordsForIcao(entry.origin);
    const destCoords = coordsForIcao(entry.destination);
    if (!originCoords || !destCoords) return null;

    return {
        flightNumber,
        origin: entry.origin,
        destination: entry.destination,
        originLat: originCoords.lat,
        originLng: originCoords.lng,
        destLat: destCoords.lat,
        destLng: destCoords.lng,
        aircraftType: entry.aircraft ?? null,
        airline: null,
        scheduledDep: null,
        source: 'local',
    };
}

// ─── Tier 4: Hard fallback ────────────────────────────────────────────────────

function fallbackResolution(flightNumber: string): ResolvedFlight {
    console.warn(`[FlightResolver] Could not resolve "${flightNumber}" — using VIDP→VABB fallback`);
    return {
        flightNumber,
        origin: 'VIDP',
        destination: 'VABB',
        originLat: 28.5562,
        originLng: 77.1000,
        destLat: 19.0896,
        destLng: 72.8656,
        aircraftType: null,
        airline: null,
        scheduledDep: null,
        source: 'fallback',
    };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ResolveOptions {
    /** AviationStack free API key. If omitted, tier 1 is skipped. */
    aviationStackKey?: string;
    /** RapidAPI key for AeroDataBox. If omitted, tier 2 is skipped. */
    rapidApiKey?: string;
    /** Skip remote APIs entirely (useful in tests or offline mode). */
    localOnly?: boolean;
}

/**
 * Resolve a flight number to full route metadata.
 * Tries API tiers in order, falls back gracefully.
 * Never throws — always returns a ResolvedFlight.
 */
export async function resolveFlightNumber(
    raw: string,
    opts: ResolveOptions = {},
): Promise<ResolvedFlight> {
    const flightNumber = normalise(raw);

    const aviationStackKey = opts.aviationStackKey
        ?? process.env.EXPO_PUBLIC_AVIATIONSTACK_KEY;
    const rapidApiKey = opts.rapidApiKey
        ?? process.env.EXPO_PUBLIC_RAPIDAPI_KEY;

    // Tier 1 — AviationStack (tries today + yesterday)
    if (!opts.localOnly && aviationStackKey) {
        const result = await resolveViaAviationStack(flightNumber, aviationStackKey);
        if (result) return result;
    }

    // Tier 2 — AeroDataBox (tries today + yesterday)
    if (!opts.localOnly && rapidApiKey) {
        const result = await resolveViaAeroDataBox(flightNumber, rapidApiKey);
        if (result) return result;
    }

    // Tier 3 — Local table
    const local = resolveViaLocalTable(flightNumber);
    if (local) return local;

    // Tier 4 — Hard fallback
    return fallbackResolution(flightNumber);
}