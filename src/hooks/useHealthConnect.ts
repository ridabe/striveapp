import { useCallback, useRef } from 'react';
import {
  getSdkStatus,
  initialize,
  requestPermission,
  readRecords,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export interface WearableMetrics {
  heartRateAvg: number | null;
  heartRateMax: number | null;
  heartRateMin: number | null;
  caloriesActive: number | null;
  spo2Avg: number | null;
  steps: number | null;
  source: 'health_connect';
}

const PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'OxygenSaturation' as const },
  { accessType: 'read' as const, recordType: 'Steps' as const },
];

export function useHealthConnect() {
  const available = useRef<boolean | null>(null);

  const checkAvailability = useCallback(async (): Promise<boolean> => {
    if (available.current !== null) return available.current;
    try {
      const status = await getSdkStatus();
      available.current = status === SdkAvailabilityStatus.SDK_AVAILABLE;
    } catch {
      available.current = false;
    }
    return available.current;
  }, []);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const isAvailable = await checkAvailability();
    if (!isAvailable) return false;
    try {
      await initialize();
      const granted = await requestPermission(PERMISSIONS);
      return granted.length > 0;
    } catch {
      return false;
    }
  }, [checkAvailability]);

  const getWorkoutMetrics = useCallback(
    async (startedAt: Date, finishedAt: Date): Promise<WearableMetrics | null> => {
      const isAvailable = await checkAvailability();
      if (!isAvailable) return null;

      try {
        await initialize();

        const timeRangeFilter = {
          operator: 'between' as const,
          startTime: startedAt.toISOString(),
          endTime: finishedAt.toISOString(),
        };

        const [hrRes, calRes, spo2Res, stepsRes] = await Promise.allSettled([
          readRecords('HeartRate', { timeRangeFilter }),
          readRecords('ActiveCaloriesBurned', { timeRangeFilter }),
          readRecords('OxygenSaturation', { timeRangeFilter }),
          readRecords('Steps', { timeRangeFilter }),
        ]);

        // Heart rate
        let heartRateAvg: number | null = null;
        let heartRateMax: number | null = null;
        let heartRateMin: number | null = null;

        if (hrRes.status === 'fulfilled' && hrRes.value.records.length > 0) {
          const samples = hrRes.value.records.flatMap((r: any) =>
            r.samples?.map((s: any) => s.beatsPerMinute) ?? []
          );
          if (samples.length > 0) {
            heartRateAvg = Math.round(samples.reduce((a: number, b: number) => a + b, 0) / samples.length);
            heartRateMax = Math.max(...samples);
            heartRateMin = Math.min(...samples);
          }
        }

        // Calories
        let caloriesActive: number | null = null;
        if (calRes.status === 'fulfilled' && calRes.value.records.length > 0) {
          const total = calRes.value.records.reduce(
            (sum: number, r: any) => sum + (r.energy?.inKilocalories ?? 0),
            0
          );
          if (total > 0) caloriesActive = Math.round(total);
        }

        // SpO₂
        let spo2Avg: number | null = null;
        if (spo2Res.status === 'fulfilled' && spo2Res.value.records.length > 0) {
          const vals = spo2Res.value.records.map((r: any) => r.percentage ?? 0).filter((v: number) => v > 0);
          if (vals.length > 0) {
            spo2Avg = parseFloat(
              (vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1)
            );
          }
        }

        // Steps
        let steps: number | null = null;
        if (stepsRes.status === 'fulfilled' && stepsRes.value.records.length > 0) {
          const total = stepsRes.value.records.reduce(
            (sum: number, r: any) => sum + (r.count ?? 0),
            0
          );
          if (total > 0) steps = total;
        }

        const hasAnyData =
          heartRateAvg !== null || caloriesActive !== null || spo2Avg !== null || steps !== null;

        if (!hasAnyData) return null;

        return { heartRateAvg, heartRateMax, heartRateMin, caloriesActive, spo2Avg, steps, source: 'health_connect' };
      } catch {
        return null;
      }
    },
    [checkAvailability]
  );

  return { requestPermissions, getWorkoutMetrics, checkAvailability };
}
