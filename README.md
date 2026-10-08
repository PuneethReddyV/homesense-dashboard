# HomeSense Dashboard

Two time-series graphs: **Temperature vs timestamp** and **Humidity vs timestamp**.

Flow:
ESP32 → AWS IoT Core → DynamoDB → API Gateway HTTP API → Lambda → React dashboard.

The dashboard polls the API every 5 seconds. No AWS credentials are placed in the browser.

## Run frontend
npm install
cp .env.example .env
# edit VITE_API_URL
npm run dev

## Lambda
Use backend/lambda.mjs. Set TABLE_NAME=HomeSenseReadings and DEFAULT_DEVICE_ID=homesense-room-01.
Grant the Lambda `dynamodb:Query` on the HomeSenseReadings table.
Expose Lambda with API Gateway HTTP API at GET /readings and enable CORS.

## Public hosting
Deploy this Vite/React app with AWS Amplify Hosting. Build: `npm run build`; output: `dist`.
