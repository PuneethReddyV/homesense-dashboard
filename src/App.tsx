import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ScatterChart,
  Scatter,
} from 'recharts';

type Reading = {
  timestamp: string;
  temperature: number;
  humidity: number;
};

type Range = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

type ApiResponse = {
  deviceId: string;
  range: Range;
  granularity: string;
  readings: Reading[];
};

const API_URL = import.meta.env.VITE_API_URL as string;

const DEVICE_ID =
  (import.meta.env.VITE_DEVICE_ID as string | undefined) ??
  'homesense-room-01';

const RANGES: { value: Range; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

function dateOf(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/
  );

  if (!match) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }

  const [, year, month, day, hour, minute, second] = match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    ) - 330 * 60 * 1000
  );
}

function timeOf(value: string, range: Range) {
  const date = dateOf(value);

  if (range === 'hourly' || range === 'daily') {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    });
  }

  if (range === 'weekly' || range === 'monthly') {
    return date.toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    });
  }

  return date.toLocaleDateString([], {
    month: 'short',
    year: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

function dateTimeOf(value: string) {
  return dateOf(value).toLocaleString([], {
    timeZone: 'Asia/Kolkata',
  });
}

export default function App() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [range, setRange] = useState<Range>('daily');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!API_URL) {
      setError('VITE_API_URL is not configured.');
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const url =
        `${API_URL}/readings?deviceId=${encodeURIComponent(DEVICE_ID)}` +
        `&range=${range}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = (await response.json()) as ApiResponse;

      setReadings(result.readings ?? []);
      setError('');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Unable to load readings'
      );
    } finally {
      setLoading(false);
    }
  }, [range]);

  // Fetch on initial load and when the selected range changes.
  // No automatic polling.
  useEffect(() => {
    void load();
  }, [load]);

  const data = useMemo(
    () =>
      readings
        .slice()
        .sort(
          (a, b) =>
            dateOf(a.timestamp).getTime() -
            dateOf(b.timestamp).getTime()
        )
        .map((reading) => ({
          ...reading,
          time: timeOf(reading.timestamp, range),
        })),
    [readings, range]
  );

  const latest = data.at(-1);

  const chart = (
    key: 'temperature' | 'humidity',
    unit: string,
    label: string
  ) => (
    <article className="card">
      <div className="heading">
        <div>
          <h2>{label}</h2>
          <p>{label} — {range} view</p>
        </div>
        <b>{unit}</b>
      </div>

      <div className="chart">
        {loading && !data.length ? (
          <div className="empty">Loading readings…</div>
        ) : !data.length ? (
          <div className="empty">
            No readings for this time range yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" minTickGap={32} />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip
                labelFormatter={(_, payload) => {
                  const timestamp = payload?.[0]?.payload?.timestamp;
                  return timestamp ? dateTimeOf(timestamp) : 'Time';
                }}
                formatter={(value) => [
                  `${Number(value).toFixed(1)} ${unit}`,
                  label,
                ]}
              />
              <Line
                type="monotone"
                dataKey={key}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </article>
  );

  // Correlation chart uses the same readings as the line charts.
  const correlationChart = (
    <article className="card">
      <div className="heading">
        <div>
          <h2>Temperature vs Humidity</h2>
          <p>Relationship between both measurements</p>
        </div>
      </div>

      <div className="chart">
        {loading && !data.length ? (
          <div className="empty">Loading readings…</div>
        ) : !data.length ? (
          <div className="empty">
            No readings for this time range yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 15, right: 20, bottom: 25, left: 15 }}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                type="number"
                dataKey="temperature"
                name="Temperature"
                unit=" °C"
                domain={['auto', 'auto']}
                label={{
                  value: 'Temperature (°C)',
                  position: 'insideBottom',
                  offset: -15,
                }}
              />

              <YAxis
                type="number"
                dataKey="humidity"
                name="Humidity"
                unit="%"
                domain={['auto', 'auto']}
                label={{
                  value: 'Humidity (%)',
                  angle: -90,
                  position: 'insideLeft',
                }}
              />

              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value, name) => [
                  `${Number(value).toFixed(1)}${
                    name === 'Temperature' ? ' °C' : '%'
                  }`,
                  name,
                ]}
                labelFormatter={(_, payload) => {
                  const timestamp = payload?.[0]?.payload?.timestamp;
                  return timestamp ? dateTimeOf(timestamp) : '';
                }}
              />

              <Scatter
                name="Sensor readings"
                data={data}
                fill="#2563eb"
              />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </article>
  );

  return (
    <main className="page">
      <header>
        <div>
          <small>HOMESENSE</small>
          <h1>Room environment</h1>
          <p>
            DHT11 readings from <strong>{DEVICE_ID}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Loading…' : '↻ Refresh'}
        </button>
      </header>

      <section className="card range-selector">
        <h2>Time range</h2>
        <div className="range-options">
          {RANGES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={range === option.value ? 'active' : ''}
              aria-pressed={range === option.value}
              onClick={() => setRange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {error && <div className="error">{error}</div>}

      <section className="summary">
        <div className="metric">
          <span>Temperature</span>
          <strong>
            {latest ? `${latest.temperature.toFixed(1)} °C` : '--'}
          </strong>
        </div>

        <div className="metric">
          <span>Humidity</span>
          <strong>
            {latest ? `${latest.humidity.toFixed(1)} %` : '--'}
          </strong>
        </div>

        <div className="metric">
          <span>Last bucket</span>
          <strong>
            {latest ? dateTimeOf(latest.timestamp) : '--'}
          </strong>
        </div>
      </section>

      <section className="charts">
        {chart('temperature', '°C', 'Temperature')}
        {chart('humidity', '%', 'Humidity')}
        {correlationChart}
      </section>

      <footer>
        ESP32 / DHT11 → DynamoDB → Aggregation Lambda → API → HomeSense
      </footer>
    </main>
  );
}