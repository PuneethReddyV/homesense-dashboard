
import {
  DynamoDBClient,
  QueryCommand
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});

const AGGREGATE_TABLE =
  process.env.AGGREGATE_TABLE || "HomeSenseAggregates";

const DEFAULT_DEVICE_ID =
  process.env.DEFAULT_DEVICE_ID || "homesense-room-01";

const RANGE_CONFIG = {
  hourly:  { granularity: "5m",  durationMs: 60 * 60 * 1000 },
  daily:   { granularity: "1h",  durationMs: 24 * 60 * 60 * 1000 },
  weekly:  { granularity: "1d",  durationMs: 7 * 24 * 60 * 60 * 1000 },
  monthly: { granularity: "1d",  durationMs: 30 * 24 * 60 * 60 * 1000 },
  yearly:  { granularity: "1mo", durationMs: 365 * 24 * 60 * 60 * 1000 }
};

// Format dates as IST wall-clock strings, matching DynamoDB bucketStart.
function formatIstWallClock(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day} ` +
    `${values.hour}:${values.minute}:${values.second}`;
}

export const handler = async (event) => {
  const params = event?.queryStringParameters ?? {};

  const deviceId = params.deviceId || DEFAULT_DEVICE_ID;
  const range = (params.range || "daily").toLowerCase();
  const config = RANGE_CONFIG[range];

  if (!config) {
    return {
      statusCode: 400,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        message: "Invalid range. Use hourly, daily, weekly, monthly, or yearly."
      })
    };
  }

  const now = new Date();
  const start = new Date(now.getTime() - config.durationMs);

  const startKey = formatIstWallClock(start);
  const endKey = formatIstWallClock(now);
  const seriesKey = `${deviceId}#${config.granularity}`;

  const items = [];
  let lastEvaluatedKey;

  // Read every matching page, not just the first DynamoDB page.
  do {
    const result = await client.send(new QueryCommand({
      TableName: AGGREGATE_TABLE,
      KeyConditionExpression:
        "seriesKey = :seriesKey AND bucketStart BETWEEN :start AND :end",
      ExpressionAttributeValues: {
        ":seriesKey": { S: seriesKey },
        ":start": { S: startKey },
        ":end": { S: endKey }
      },
      ScanIndexForward: true,
      ExclusiveStartKey: lastEvaluatedKey
    }));

    items.push(...(result.Items ?? []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  const readings = items
    .map(item => {
      const count = Number(item.readingCount?.N ?? 0);
      const temperatureSum = Number(item.temperatureSum?.N ?? 0);
      const humiditySum = Number(item.humiditySum?.N ?? 0);

      if (count <= 0) return null;

      return {
        timestamp: item.bucketStart?.S ?? "",
        temperature: Number((temperatureSum / count).toFixed(1)),
        humidity: Number((humiditySum / count).toFixed(1))
      };
    })
    .filter(Boolean);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      deviceId,
      range,
      granularity: config.granularity,
      start: startKey,
      end: endKey,
      readings
    })
  };
};