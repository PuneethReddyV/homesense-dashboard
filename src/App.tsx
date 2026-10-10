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


type ComfortAssessment = {
  status: string;
  color: string;
  textColor: string;
  explanation: string;
  actions: string[];
};

function assessComfort(
  temperature: number,
  humidity: number
): ComfortAssessment {
  // Check the most serious conditions first.
  if (temperature > 35 && humidity > 60) {
    return {
      status: 'Heat Danger',
      color: '#dc2626',
      textColor: '#ffffff',
      explanation:
        'Temperature and humidity are both high. Reduce heat exposure promptly.',
      actions: [
        'Turn AC or an appropriate cooling system on.',
        'Move to a cooler area and drink water.',
        'Recheck temperature and humidity after cooling.',
      ],
    };
  }

  if (temperature < 18 && humidity > 75) {
    return {
      status: 'Cold and Damp',
      color: '#eab308',
      textColor: '#422006',
      explanation:
        'Cool conditions combined with high humidity may encourage condensation and mould.',
      actions: [
        'Use a dehumidifier or improve ventilation if outdoor air is drier.',
        'Use a heater if needed to reach a comfortable temperature.',
        'Check walls and windows for condensation.',
      ],
    };
  }

  if (humidity < 25) {
    return {
      status: 'Too Dry',
      color: '#f8fafc',
      textColor: '#1f2937',
      explanation:
        'Humidity is below your preferred range, regardless of temperature.',
      actions: [
        'Consider using a humidifier.',
        'Avoid excessive humidification; monitor humidity as it rises.',
      ],
    };
  }

  if (
    temperature >= 28 &&
    temperature <= 35 &&
    humidity >= 60 &&
    humidity <= 85
  ) {
    return {
      status: 'Hot and Muggy',
      color: '#2563eb',
      textColor: '#ffffff',
      explanation:
        'Warm temperatures and high humidity can make the room feel sticky.',
      actions: [
        'Turn AC on if available.',
        'Use a fan for air movement when appropriate.',
        'Monitor humidity; AC may also remove moisture.',
      ],
    };
  }

  if (
    temperature >= 18 &&
    temperature <= 24 &&
    humidity >= 30 &&
    humidity <= 50
  ) {
    return {
      status: 'Comfortable',
      color: '#16a34a',
      textColor: '#ffffff',
      explanation:
        'Temperature and humidity are both within your defined comfort ranges.',
      actions: [
        'Keep heating and cooling systems idle.',
        'Continue monitoring the room.',
      ],
    };
  }

  // Handle combinations that match more than one partial condition,
  // or fall between the ranges in the supplied table.
  if (temperature > 35) {
    return {
      status: 'Very Hot',
      color: '#dc2626',
      textColor: '#ffffff',
      explanation:
        'Temperature exceeds 35°C, even though the full Heat Danger combination is not present.',
      actions: [
        'Prioritize moving to a cooler environment.',
        'Use suitable cooling and recheck the readings.',
      ],
    };
  }

  if (humidity > 75) {
    return {
      status: 'Very Humid',
      color: '#eab308',
      textColor: '#422006',
      explanation:
        'Humidity is very high and may increase condensation or mould risk.',
      actions: [
        'Consider a dehumidifier.',
        'Check ventilation and condensation.',
      ],
    };
  }

  if (temperature < 18) {
    return {
      status: 'Too Cold',
      color: '#64748b',
      textColor: '#ffffff',
      explanation:
        'Temperature is below your preferred comfort range.',
      actions: [
        'Consider using a heater.',
        'Recheck the room temperature after heating.',
      ],
    };
  }

  if (temperature > 24 && humidity < 60) {
    return {
      status: 'Warm',
      color: '#f59e0b',
      textColor: '#422006',
      explanation:
        'Temperature is above your comfort range, without the full hot-and-muggy combination.',
      actions: [
        'Consider a fan or AC according to how the room feels.',
        'Monitor temperature and humidity.',
      ],
    };
  }

  if (humidity < 30) {
    return {
      status: 'Low Humidity',
      color: '#f8fafc',
      textColor: '#1f2937',
      explanation:
        'Humidity is below your preferred comfort range.',
      actions: [
        'Consider a humidifier if the air feels too dry.',
        'Monitor humidity to avoid excessive moisture.',
      ],
    };
  }

  return {
    status: 'Near Comfort Range',
    color: '#64748b',
    textColor: '#ffffff',
    explanation:
      'The readings do not match one of the specific categories in your rules.',
    actions: [
      'Keep monitoring temperature and humidity.',
      'Adjust ventilation or climate controls based on room conditions.',
    ],
  };
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
  const assessment = latest
  ? assessComfort(latest.temperature, latest.humidity)
  : null;

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


<section className="comfort-assessment">
  <div
    className="comfort-banner"
    style={{
      backgroundColor: assessment?.color ?? '#64748b',
      color: assessment?.textColor ?? '#ffffff',
    }}
  >
    <div>
      <span className="comfort-eyebrow">
        CURRENT ENVIRONMENT
      </span>

      <h2>
        {assessment?.status ??
          (loading ? 'Checking conditions…' : 'No readings available')}
      </h2>

      <p>
        {assessment?.explanation ??
          'Refresh the dashboard to retrieve the latest sensor reading.'}
      </p>
    </div>

    {latest && (
      <div className="comfort-reading">
        Temperature: <strong>{latest.temperature.toFixed(1)}°C</strong> <tr/>
        Humidity: <strong>{latest.humidity.toFixed(1)}%</strong>
      </div>
    )}
  </div>

  <article className="card resolution-card">
    <h2>Recommended resolution</h2>

    {assessment ? (
      <ul>
        {assessment.actions.map((action, index) => (
          <li key={`${assessment.status}-${index}`}>
            {action}
          </li>
        ))}
      </ul>
    ) : (
      <p>Waiting for valid temperature and humidity readings.</p>
    )}

    <p className="resolution-note">
      Recommendations only — this dashboard does not directly operate
      your AC, heater, fan, humidifier, or dehumidifier.
    </p>
  </article>
</section>


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