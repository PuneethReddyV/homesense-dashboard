import {DynamoDBClient,QueryCommand} from "@aws-sdk/client-dynamodb";
const client=new DynamoDBClient({});
const TABLE_NAME=process.env.TABLE_NAME||"HomeSenseReadings";
const DEFAULT_DEVICE_ID=process.env.DEFAULT_DEVICE_ID||"homesense-room-01";
export const handler=async(event)=>{
 const deviceId=event?.queryStringParameters?.deviceId||DEFAULT_DEVICE_ID;
 const limit=Math.min(Math.max(Number(event?.queryStringParameters?.limit||100),1),500);
 const result=await client.send(new QueryCommand({
  TableName:TABLE_NAME,
  KeyConditionExpression:"deviceId = :deviceId",
  ExpressionAttributeValues:{":deviceId":{S:deviceId}},
  ScanIndexForward:true,Limit:limit,
  ProjectionExpression:"deviceId,#ts,temperature,humidity,sensorName,sensorType,temperatureUnit,humidityUnit",
  ExpressionAttributeNames:{"#ts":"timestamp"}
 }));
 const readings=(result.Items||[]).map(i=>({timestamp:i.timestamp?.S??"",temperature:Number(i.temperature?.N??0),humidity:Number(i.humidity?.N??0)}));
 return {statusCode:200,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,OPTIONS","Cache-Control":"no-store"},body:JSON.stringify({deviceId,readings})};
};