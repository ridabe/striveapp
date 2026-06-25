import { useCallback, useRef } from 'react';
import {
  getSdkStatus,
  initialize,
  readRecords,
  getGrantedPermissions,
  openHealthConnectSettings,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';

export interface WearableMetrics {
  heartRateAvg:    number | null;
  heartRateMax:    number | null;
  heartRateMin:    number | null;
  caloriesActive:  number | null;
  spo2Avg:         number | null;
  steps:           number | null;
  distanceMeters:  number | null;
  wearableDevice:  string | null;
  source:          'health_connect';
}

// Mapeamento de packageName → nome amigável do app/dispositivo
const KNOWN_SOURCES: Record<string, string> = {
  'com.sec.android.app.shealth':    'Samsung Health',
  'com.samsung.shealth':            'Samsung Health',
  'com.google.android.apps.fitness':'Google Fit',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.wahoo.android':              'Wahoo',
  'com.polar.flow.app':             'Polar Flow',
  'com.fitbit.FitbitMobile':        'Fitbit',
  'com.xiaomi.hm.health':          'Zepp (Amazfit)',
  'nodomain.freeyourgadget.gadgetbridge': 'Gadget Bridge',
};

const REQUIRED_PERMISSIONS = [
  'READ_HEART_RATE',
  'READ_ACTIVE_CALORIES_BURNED',
  'READ_TOTAL_CALORIES_BURNED',
  'READ_OXYGEN_SATURATION',
  'READ_STEPS',
  'READ_DISTANCE',
];

function detectDevice(records: any[]): string | null {
  for (const r of records) {
    const pkg = r.metadata?.dataOrigin?.packageName;
    if (pkg && KNOWN_SOURCES[pkg]) return KNOWN_SOURCES[pkg];
  }
  return null;
}

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

  // Verifica se as permissões necessárias já foram concedidas
  const checkPermissionsGranted = useCallback(async (): Promise<boolean> => {
    const isAvailable = await checkAvailability();
    if (!isAvailable) return false;
    try {
      await initialize();
      const granted = await getGrantedPermissions();
      const grantedTypes = granted.map((p: any) => p.recordType);
      return REQUIRED_PERMISSIONS.some(p => grantedTypes.includes(p));
    } catch {
      return false;
    }
  }, [checkAvailability]);

  // Abre o Health Connect para o usuário conceder permissões manualmente.
  // NÃO usa requestPermission() — causa crash nativo com "lateinit property
  // requestPermission has not been initialized" (HealthConnectPermissionDelegate.kt:45)
  // porque o ActivityResultLauncher não é registrado corretamente no Expo.
  const openPermissionsSettings = useCallback(async (): Promise<void> => {
    const isAvailable = await checkAvailability();
    if (!isAvailable) return;
    try {
      await openHealthConnectSettings();
    } catch {}
  }, [checkAvailability]);

  const getWorkoutMetrics = useCallback(
    async (startedAt: Date, finishedAt: Date): Promise<WearableMetrics | null> => {
      const isAvailable = await checkAvailability();
      if (!isAvailable) return null;

      try {
        await initialize();

        // Samsung Health pode levar alguns segundos para sincronizar com o
        // Health Connect após o fim do treino — aguarda 2s antes de ler.
        await new Promise(resolve => setTimeout(resolve, 2000));

        const timeRangeFilter = {
          operator: 'between' as const,
          startTime: startedAt.toISOString(),
          endTime:   finishedAt.toISOString(),
        };

        const [hrRes, calActiveRes, calTotalRes, spo2Res, stepsRes, distRes] =
          await Promise.allSettled([
            readRecords('HeartRate',            { timeRangeFilter }),
            readRecords('ActiveCaloriesBurned', { timeRangeFilter }),
            readRecords('TotalCaloriesBurned',  { timeRangeFilter }),
            readRecords('OxygenSaturation',     { timeRangeFilter }),
            readRecords('Steps',                { timeRangeFilter }),
            readRecords('Distance',             { timeRangeFilter }),
          ]);

        // ── Heart rate ────────────────────────────────────────────────────────
        let heartRateAvg: number | null = null;
        let heartRateMax: number | null = null;
        let heartRateMin: number | null = null;
        let deviceFromHR: string | null = null;

        if (hrRes.status === 'fulfilled' && hrRes.value.records.length > 0) {
          const samples = hrRes.value.records.flatMap((r: any) =>
            r.samples?.map((s: any) => s.beatsPerMinute) ?? []
          );
          if (samples.length > 0) {
            heartRateAvg = Math.round(
              samples.reduce((a: number, b: number) => a + b, 0) / samples.length
            );
            heartRateMax = Math.max(...samples);
            heartRateMin = Math.min(...samples);
          }
          deviceFromHR = detectDevice(hrRes.value.records);
        }

        // ── Calories — preferência para ActiveCalories, fallback Total ────────
        let caloriesActive: number | null = null;

        if (calActiveRes.status === 'fulfilled' && calActiveRes.value.records.length > 0) {
          const total = calActiveRes.value.records.reduce(
            (sum: number, r: any) => sum + (r.energy?.inKilocalories ?? 0), 0
          );
          if (total > 0) caloriesActive = Math.round(total);
        }

        if (caloriesActive === null && calTotalRes.status === 'fulfilled' && calTotalRes.value.records.length > 0) {
          const total = calTotalRes.value.records.reduce(
            (sum: number, r: any) => sum + (r.energy?.inKilocalories ?? 0), 0
          );
          if (total > 0) caloriesActive = Math.round(total);
        }

        // ── SpO₂ ──────────────────────────────────────────────────────────────
        let spo2Avg: number | null = null;

        if (spo2Res.status === 'fulfilled' && spo2Res.value.records.length > 0) {
          const vals = spo2Res.value.records
            .map((r: any) => r.percentage ?? 0)
            .filter((v: number) => v > 0);
          if (vals.length > 0) {
            spo2Avg = parseFloat(
              (vals.reduce((a: number, b: number) => a + b, 0) / vals.length).toFixed(1)
            );
          }
        }

        // ── Steps ─────────────────────────────────────────────────────────────
        let steps: number | null = null;

        if (stepsRes.status === 'fulfilled' && stepsRes.value.records.length > 0) {
          const total = stepsRes.value.records.reduce(
            (sum: number, r: any) => sum + (r.count ?? 0), 0
          );
          if (total > 0) steps = total;
        }

        // ── Distance ─────────────────────────────────────────────────────────
        let distanceMeters: number | null = null;

        if (distRes.status === 'fulfilled' && distRes.value.records.length > 0) {
          const total = distRes.value.records.reduce(
            (sum: number, r: any) => sum + (r.distance?.inMeters ?? 0), 0
          );
          if (total > 0) distanceMeters = Math.round(total);
        }

        // ── Device detection ─────────────────────────────────────────────────
        const wearableDevice =
          deviceFromHR ??
          (spo2Res.status  === 'fulfilled' ? detectDevice(spo2Res.value.records)  : null) ??
          (stepsRes.status === 'fulfilled' ? detectDevice(stepsRes.value.records)  : null) ??
          (distRes.status  === 'fulfilled' ? detectDevice(distRes.value.records)   : null);

        const hasAnyData =
          heartRateAvg !== null || caloriesActive !== null ||
          spo2Avg !== null || steps !== null || distanceMeters !== null;

        if (!hasAnyData) return null;

        return {
          heartRateAvg, heartRateMax, heartRateMin,
          caloriesActive, spo2Avg, steps, distanceMeters,
          wearableDevice,
          source: 'health_connect',
        };
      } catch {
        return null;
      }
    },
    [checkAvailability]
  );

  return { openPermissionsSettings, checkPermissionsGranted, getWorkoutMetrics, checkAvailability };
}
