const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');

const newRoutes = `
// ==================== AGORA CLOUD RECORDING ====================
import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

// Helper for Agora API Auth
const getAgoraAuthHeader = () => {
  const customerId = process.env.AGORA_CUSTOMER_ID || "";
  const customerCert = process.env.AGORA_CUSTOMER_CERTIFICATE || "";
  return "Basic " + Buffer.from(customerId + ":" + customerCert).toString("base64");
};

app.post("/api/agora/start-recording", async (req, res) => {
  try {
    const { channel, uid } = req.body;
    const appId = process.env.AGORA_APP_ID;
    
    if (!appId || !process.env.AGORA_CUSTOMER_ID) {
      return res.status(400).json({ error: "Agora credentials missing" });
    }

    // 1. Acquire resource ID
    const acquireRes = await fetch(\`https://api.agora.io/v1/apps/\${appId}/cloud_recording/acquire\`, {
      method: "POST",
      headers: {
        "Authorization": getAgoraAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        cname: channel,
        uid: String(uid),
        clientRequest: {
          resourceExpiredHour: 24,
          scene: 0
        }
      })
    });
    
    const acquireData = await acquireRes.json();
    if (!acquireRes.ok) {
      console.error("Agora acquire failed:", acquireData);
      return res.status(acquireRes.status).json({ error: "Failed to acquire resourceId" });
    }
    
    const resourceId = acquireData.resourceId;
    const fileNamePrefix = ["recordings", channel, String(Date.now())];

    // 2. Start recording
    const startRes = await fetch(\`https://api.agora.io/v1/apps/\${appId}/cloud_recording/resourceid/\${resourceId}/mode/mix/start\`, {
      method: "POST",
      headers: {
        "Authorization": getAgoraAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        cname: channel,
        uid: String(uid),
        clientRequest: {
          recordingConfig: {
            maxIdleTime: 120,
            streamTypes: 2,
            channelType: 0,
            videoStreamType: 0,
            transcodingConfig: {
              height: 720,
              width: 1280,
              bitrate: 2000,
              fps: 30,
              mixedVideoLayout: 1,
              backgroundColor: "#000000"
            }
          },
          storageConfig: {
            vendor: 1, // AWS
            region: parseInt(process.env.AGORA_AWS_REGION_CODE || "0"),
            bucket: process.env.AWS_BUCKET_NAME || "",
            accessKey: process.env.AWS_ACCESS_KEY_ID || "",
            secretKey: process.env.AWS_SECRET_ACCESS_KEY || "",
            fileNamePrefix
          }
        }
      })
    });

    const startData = await startRes.json();
    if (!startRes.ok) {
      console.error("Agora start failed:", startData);
      return res.status(startRes.status).json({ error: "Failed to start recording", details: startData });
    }

    const m3u8Url = \`https://\${process.env.AWS_BUCKET_NAME}.s3.\${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/\${fileNamePrefix.join("/")}_\${channel}.m3u8\`;

    return res.json({ 
      success: true, 
      resourceId, 
      sid: startData.sid, 
      prefix: fileNamePrefix.join("/"),
      m3u8Url
    });

  } catch (err: any) {
    console.error("Agora start exception:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/agora/stop-recording", async (req, res) => {
  try {
    const { channel, uid, resourceId, sid } = req.body;
    const appId = process.env.AGORA_APP_ID;

    const stopRes = await fetch(\`https://api.agora.io/v1/apps/\${appId}/cloud_recording/resourceid/\${resourceId}/sid/\${sid}/mode/mix/stop\`, {
      method: "POST",
      headers: {
        "Authorization": getAgoraAuthHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        cname: channel,
        uid: String(uid),
        clientRequest: {}
      })
    });

    const stopData = await stopRes.json();
    if (!stopRes.ok) {
      console.error("Agora stop failed:", stopData);
      return res.status(stopRes.status).json({ error: "Failed to stop recording" });
    }

    return res.json({ success: true, serverResponse: stopData.serverResponse });
  } catch (err: any) {
    console.error("Agora stop exception:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/recordings/delete-s3", async (req, res) => {
  try {
    const { prefix } = req.body;
    if (!prefix) return res.status(400).json({ error: "Prefix is required" });

    const s3 = new S3Client({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ""
      }
    });
    const bucket = process.env.AWS_BUCKET_NAME || "";

    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix
    });
    
    const listData = await s3.send(listCommand);
    if (!listData.Contents || listData.Contents.length === 0) {
      return res.json({ success: true, message: "No objects found to delete" });
    }

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: listData.Contents.map(c => ({ Key: c.Key })),
        Quiet: true
      }
    });

    await s3.send(deleteCommand);
    return res.json({ success: true, deletedCount: listData.Contents.length });
  } catch (err: any) {
    console.error("S3 delete exception:", err);
    return res.status(500).json({ error: err.message });
  }
});
// ===============================================================
`;

const insertIndex = content.indexOf('async function startServer()');
const newContent = content.slice(0, insertIndex) + newRoutes + '\n' + content.slice(insertIndex);
fs.writeFileSync('server.ts', newContent);
console.log("Routes added!");
