import axios from 'axios';
import { config } from '../config';
import { TrafficAssessment, TrafficStatus } from '../types';

const MAPS_BASE = 'https://maps.googleapis.com/maps/api';

export interface GeocodeResult { lat: number; lng: number; formattedAddress?: string }

export class GoogleMapsClient {
  constructor(private apiKey: string) {}

  async geocode(address: string): Promise<GeocodeResult> {
    const url = `${MAPS_BASE}/geocode/json`;
    const { data } = await axios.get(url, { params: { address, key: this.apiKey } });
    if (data.status !== 'OK' || !data.results?.length) {
      throw new Error(`Geocoding failed for address: ${address}, status: ${data.status}`);
    }
    const r = data.results[0];
    return {
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      formattedAddress: r.formatted_address,
    };
  }

  async assessTraffic(origin: string, destination: string): Promise<TrafficAssessment> {
    // We use Directions API with departure_time=now to get duration_in_traffic
    const url = `${MAPS_BASE}/directions/json`;
    const params = {
      origin,
      destination,
      key: this.apiKey,
      departure_time: 'now',
      traffic_model: 'best_guess',
      alternatives: true,
      mode: 'driving',
      units: 'metric',
      region: 'nl',
    } as const;
    const { data } = await axios.get(url, { params });
    if (data.status !== 'OK' || !data.routes?.length) {
      throw new Error(`Directions failed: ${data.status}`);
    }
    // choose the route with minimal duration_in_traffic
    let best: { base: number; traffic: number; summary?: string } | undefined;
    for (const route of data.routes) {
      const leg = route.legs?.[0];
      if (!leg) continue;
      const base = leg.duration?.value ?? 0;
      const traffic = leg.duration_in_traffic?.value ?? base;
      if (!best || traffic < best.traffic) {
        best = { base, traffic, summary: route.summary };
      }
    }
    if (!best) {
      throw new Error('No route legs found');
    }
    const delay = Math.max(0, best.traffic - best.base);
    const ratio = best.base > 0 ? best.traffic / best.base : 1;
    const status: TrafficStatus = ratio >= 1.25 || delay >= 900 ? 'heavy' : 'regular'; // heavy if 25% slower or 15+ min delay
    return {
      status,
      baseDurationSec: best.base,
      trafficDurationSec: best.traffic,
      delaySec: delay,
      ratio,
      routeSummary: best.summary,
    };
  }
}

export const mapsClient = new GoogleMapsClient(config.mapsApiKey);
