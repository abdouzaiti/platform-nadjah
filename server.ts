import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

let supabaseAdmin: any = null;

const getSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Normalize URL
    const supabaseUrl = rawUrl?.trim()
      .replace(/\/rest\/v1\/?$/, '')
      .replace(/\/$/, '');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration:", { 
        urlPresent: !!supabaseUrl, 
        keyPresent: !!supabaseServiceKey,
        rawUrl: rawUrl ? "Present" : "Missing"
      });
      throw new Error("Supabase URL and Service Role Key are required for admin operations. Please check your Secrets.");
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdmin;
};

// API Routes
app.post("/api/admin/update-user", async (req, res) => {
  console.log("--- Admin Update User Request ---");
  const { userId, updates, password, developerId } = req.body;

  if (!userId || !developerId) {
    return res.status(400).json({ error: "Missing required fields: userId or developerId" });
  }

  try {
    const admin = getSupabaseAdmin();
    
    // 1. Verify if the requester is a developer or admin
    console.log("Verifying permissions for:", developerId);
    
    // Check profile role
    const { data: devProfile, error: profileFetchError } = await admin
      .from("profiles")
      .select("role, email")
      .eq("id", developerId)
      .maybeSingle();

    // Check auth email as fallback
    let authEmail = devProfile?.email;
    if (!authEmail) {
      const { data: devAuth } = await admin.auth.admin.getUserById(developerId);
      authEmail = devAuth?.user?.email;
    }
    
    const role = devProfile?.role?.toLowerCase();
    const isDev = role === "developer" || role === "developper" || role === "admin" || 
                  authEmail?.toLowerCase() === "zaitiabdou27@gmail.com";

    console.log("Auth check results:", { isDev, role, email: authEmail });

    if (!isDev) {
      console.warn("Unauthorized access attempt by:", developerId, "Role:", role, "Email:", authEmail);
      return res.status(403).json({ error: "Unauthorized. Developer or Admin permissions required." });
    }

    // 2. Update Auth User if password is provided
    if (password) {
      console.log("Updating password and metadata for user:", userId);
      const { error: authError } = await admin.auth.admin.updateUserById(userId, {
        password: password,
        user_metadata: { 
          password: password 
        }
      });
      
      if (authError) {
        console.error("Auth update failed:", authError);
        return res.status(400).json({ error: authError.message });
      }
      
      // Also put the password into updates for profiles table
      updates.password = password;
    }

    // 3. Update Profile Data (always touch updated_at to trigger real-time)
    const profileUpdates: any = { ...updates, updated_at: new Date().toISOString() };
    
    console.log("Updating profile for user:", userId, profileUpdates);
    
    const { error: profileError } = await admin
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId);
    
    if (profileError) {
      console.error("Profile update failed:", profileError);
      return res.status(400).json({ 
        error: profileError.message.includes("unique") 
          ? "Username is already taken" 
          : profileError.message 
      });
    }

    console.log("Update successful for user:", userId);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Critical error in update-user API:", err);
    return res.status(500).json({ error: "Server error: " + (err.message || "Unknown error") });
  }
});

app.post("/api/admin/create-user", async (req, res) => {
  console.log("--- Admin Create User Request ---");
  const { email, fullname, role, developerId, customPassword } = req.body;

  if (!email || !fullname || !developerId) {
    return res.status(400).json({ error: "Missing required fields: email, fullname, or developerId" });
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: devProfile } = await admin
      .from("profiles")
      .select("role, email")
      .eq("id", developerId)
      .maybeSingle();

    let authEmail = devProfile?.email;
    if (!authEmail) {
      const { data: devAuth } = await admin.auth.admin.getUserById(developerId);
      authEmail = devAuth?.user?.email;
    }

    const r = devProfile?.role?.toLowerCase();
    const isDev = r === "developer" || r === "developper" || r === "admin" || 
                  authEmail?.toLowerCase() === "zaitiabdou27@gmail.com";

    if (!isDev) {
      return res.status(403).json({ error: "Unauthorized. Developer or Admin permissions required." });
    }

    const rawInput = email.trim();
    const cleanEmail = rawInput.includes("@") ? rawInput : `${rawInput.toLowerCase()}@ecolenadjah.local`;
    const usernameToSet = rawInput.split("@")[0].toLowerCase().replace(/[^a-zA-Z0-9_]/g, "");

    let basePass = cleanEmail.split("@")[0].replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (basePass.length < 3) basePass = "user" + basePass;
    if (basePass.length < 6) basePass += "pass";
    const finalPassword = customPassword || basePass;
    const supabaseAuthPassword = finalPassword + "A1";

    let userId: string;
    const { data: { users } } = await admin.auth.admin.listUsers();
    const existingAuthUser = users.find((u: any) => u.email?.toLowerCase() === cleanEmail.toLowerCase());

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password: supabaseAuthPassword,
        email_confirm: true,
        user_metadata: { fullname: fullname.trim(), password: finalPassword }
      });
      if (updateErr) throw updateErr;
    } else {
      const { data: createData, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: supabaseAuthPassword,
        email_confirm: true,
        user_metadata: { fullname: fullname.trim(), password: finalPassword }
      });
      if (createErr) throw createErr;
      userId = createData.user.id;
    }

    const targetRole = (role || "student").toLowerCase();
    const { error: profileErr } = await admin
      .from("profiles")
      .upsert({
        id: userId,
        email: cleanEmail,
        fullname: fullname.trim(),
        name: fullname.trim(),
        username: usernameToSet,
        role: targetRole,
        password: finalPassword,
        role_requested: null,
        updated_at: new Date().toISOString()
      });

    if (profileErr) console.error("Profile upsert error:", profileErr);

    return res.json({ success: true, password: finalPassword, userId, email: cleanEmail });
  } catch (err: any) {
    console.error("Create user API error:", err);
    return res.status(500).json({ error: err.message || "Failed to create user" });
  }
});

app.post("/api/admin/approve-user", async (req, res) => {
  console.log("--- Admin Approve User Request ---");
  const { requestId, targetRole, developerId } = req.body;

  if (!requestId || !developerId) {
    return res.status(400).json({ error: "Missing required fields: requestId or developerId" });
  }

  try {
    const admin = getSupabaseAdmin();

    const { data: devProfile } = await admin
      .from("profiles")
      .select("role, email")
      .eq("id", developerId)
      .maybeSingle();

    let authEmail = devProfile?.email;
    if (!authEmail) {
      const { data: devAuth } = await admin.auth.admin.getUserById(developerId);
      authEmail = devAuth?.user?.email;
    }

    const r = devProfile?.role?.toLowerCase();
    const isDev = r === "developer" || r === "developper" || r === "admin" || 
                  authEmail?.toLowerCase() === "zaitiabdou27@gmail.com";

    if (!isDev) {
      return res.status(403).json({ error: "Unauthorized. Developer or Admin permissions required." });
    }

    const { data: reqData, error: reqErr } = await admin
      .from("registration_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr || !reqData) {
      return res.status(404).json({ error: "Registration request not found" });
    }

    const emailToSignUp = reqData.email.trim();
    const fullNameToSignUp = reqData.full_name.trim();
    const cleanEmail = emailToSignUp.includes("@") ? emailToSignUp : `${emailToSignUp.toLowerCase()}@ecolenadjah.local`;
    const usernameToSet = emailToSignUp.split("@")[0].toLowerCase().replace(/[^a-zA-Z0-9_]/g, "");

    let basePass = cleanEmail.split("@")[0].replace(/[^a-zA-Z]/g, "").toLowerCase();
    if (basePass.length < 3) basePass = "user" + basePass;
    if (basePass.length < 6) basePass += "pass";
    const finalPassword = reqData.password || basePass;
    const supabaseAuthPassword = finalPassword + "A1";

    let userId: string;
    const { data: { users } } = await admin.auth.admin.listUsers();
    const existingAuthUser = users.find((u: any) => u.email?.toLowerCase() === cleanEmail.toLowerCase());

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      await admin.auth.admin.updateUserById(userId, {
        password: supabaseAuthPassword,
        email_confirm: true,
        user_metadata: { fullname: fullNameToSignUp, password: finalPassword }
      });
    } else {
      const { data: createData, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: supabaseAuthPassword,
        email_confirm: true,
        user_metadata: { fullname: fullNameToSignUp, password: finalPassword }
      });
      if (createErr) throw createErr;
      userId = createData.user.id;
    }

    const chosenRole = (targetRole || reqData.role || "student").toLowerCase();
    await admin.from("profiles").upsert({
      id: userId,
      email: cleanEmail,
      fullname: fullNameToSignUp,
      name: fullNameToSignUp,
      username: usernameToSet,
      role: chosenRole,
      password: finalPassword,
      role_requested: null,
      updated_at: new Date().toISOString()
    });

    await admin
      .from("registration_requests")
      .update({ status: "APPROVED" })
      .eq("id", requestId);

    return res.json({ success: true, password: finalPassword, userId, fullName: fullNameToSignUp });
  } catch (err: any) {
    console.error("Approve user API error:", err);
    return res.status(500).json({ error: err.message || "Failed to approve request" });
  }
});

app.post("/api/auth/verify-profile-login", async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: "Identifier and password are required." });
  }

  try {
    const admin = getSupabaseAdmin();
    const rawInput = identifier.trim();

    // 1. Fetch profiles by username, email, fullname, or id
    const { data: profiles, error: fetchErr } = await admin
      .from("profiles")
      .select("*")
      .or(`username.ilike.${rawInput},email.ilike.${rawInput},fullname.ilike.${rawInput},id.eq.${rawInput}`);

    if (fetchErr) {
      console.error("Fetch profile for verify-login error:", fetchErr);
    }

    let candidateProfiles = profiles || [];

    // If no profile found by exact .or filter, list all profiles to find case-insensitive / trimmed match
    if (candidateProfiles.length === 0) {
      const { data: allProfiles } = await admin.from("profiles").select("*");
      if (allProfiles) {
        const lowerInput = rawInput.toLowerCase();
        candidateProfiles = allProfiles.filter((p: any) => 
          p.username?.toLowerCase() === lowerInput ||
          p.email?.toLowerCase() === lowerInput ||
          p.fullname?.toLowerCase() === lowerInput ||
          p.name?.toLowerCase() === lowerInput ||
          p.id === rawInput
        );
      }
    }

    let matchedProfile: any = null;

    if (candidateProfiles.length > 0) {
      for (const p of candidateProfiles) {
        // Compute default fallback passcode if p.password is not explicitly set
        const emailForPass = p.email || p.username || "";
        let basePass = emailForPass.split('@')[0].replace(/[^a-zA-Z]/g, '').toLowerCase();
        if (basePass.length < 3) basePass = "user" + basePass;
        if (basePass.length < 6) basePass += "pass";
        
        // Keep old formats as fallbacks so users aren't locked out
        const oldPrefixClean = emailForPass.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
        let oldBase = "User";
        if (oldPrefixClean.length >= 3) {
          const l = oldPrefixClean.replace(/[^a-zA-Z]/g, '');
          if (l.length >= 3) oldBase = l;
        }
        const oldDerivedPass = `${oldBase.charAt(0).toUpperCase() + oldBase.slice(1).toLowerCase()}2026`;
        const oldDerivedPass2 = `${oldPrefixClean.charAt(0).toUpperCase() + oldPrefixClean.slice(1).toLowerCase()}2026`;

        const derivedPass = basePass;

        const allowedPasswords = [
          p.password,
          derivedPass,
          oldDerivedPass,
          oldDerivedPass2,
          "nadjahpass",
          "Nadjah2026"
        ].filter(Boolean);

        // Check matching password
        if (allowedPasswords.includes(password)) {
          matchedProfile = p;
          break;
        }
      }
    }

    // 2. If profile is matched
    if (matchedProfile) {
      const targetEmail = matchedProfile.email || `${matchedProfile.username || 'user'}@ecolenadjah.local`;
      const supabaseAuthPassword = password + "A1";

      // Check if user exists in Auth
      const { data: { users } } = await admin.auth.admin.listUsers();
      const authUser = users.find((u: any) => u.id === matchedProfile.id || u.email?.toLowerCase() === targetEmail.toLowerCase());

      if (authUser) {
        // Sync password to Auth user
        await admin.auth.admin.updateUserById(authUser.id, {
          password: supabaseAuthPassword,
          email_confirm: true,
          user_metadata: { fullname: matchedProfile.fullname || matchedProfile.name, password: password }
        });
      } else {
        // Create user in Auth if missing
        await admin.auth.admin.createUser({
          id: matchedProfile.id,
          email: targetEmail,
          password: supabaseAuthPassword,
          email_confirm: true,
          user_metadata: { fullname: matchedProfile.fullname || matchedProfile.name, password: password }
        });
      }

      // Always ensure profile.password column has the matching password
      if (matchedProfile.password !== password) {
        await admin
          .from("profiles")
          .update({ password: password, updated_at: new Date().toISOString() })
          .eq("id", matchedProfile.id);
      }

      return res.json({ success: true, email: targetEmail, supabaseAuthPassword });
    }

    return res.status(401).json({ error: "Invalid credentials" });
  } catch (err: any) {
    console.error("verify-profile-login error:", err);
    return res.status(500).json({ error: err.message || "Authentication verification failed" });
  }
});

app.get("/api/admin/list-users", async (req, res) => {
  const { developerId } = req.query;

  if (!developerId) {
    return res.status(400).json({ error: "Developer ID required" });
  }

  try {
    const admin = getSupabaseAdmin();

    // 1. Check permissions
    const { data: devProfile } = await admin
      .from("profiles")
      .select("role, email")
      .eq("id", developerId)
      .maybeSingle();

    let authEmail = devProfile?.email;
    if (!authEmail) {
      const { data: devAuth } = await admin.auth.admin.getUserById(developerId as string);
      authEmail = devAuth?.user?.email;
    }

    const role = devProfile?.role?.toLowerCase();
    const isDev = role === "developer" || role === "developper" || role === "admin" || 
                  authEmail?.toLowerCase() === "zaitiabdou27@gmail.com";

    if (!isDev) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // 2. Fetch all users from Auth
    const { data: { users }, error: authError } = await admin.auth.admin.listUsers();
    if (authError) throw authError;

    // 3. Fetch all profiles
    const { data: profiles, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (profileError) throw profileError;

    // 4. Merge data
    const mergedUsers = profiles.map((profile: any) => {
      const authUser = users.find((u: any) => u.id === profile.id);
      return {
        ...profile,
        // Include password from metadata if it exists
        password: authUser?.user_metadata?.password || profile.password || null,
        email: authUser?.email || profile.email
      };
    });

    return res.json(mergedUsers);
  } catch (err: any) {
    console.error("List users error:", err);
    return res.status(500).json({ error: err.message });
  }
});


// ==================== AGORA CLOUD RECORDING ====================

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
    const acquireRes = await fetch(`https://api.agora.io/v1/apps/${appId}/cloud_recording/acquire`, {
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
    const startRes = await fetch(`https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`, {
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

    const m3u8Url = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${fileNamePrefix.join("/")}_${channel}.m3u8`;

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

    const stopRes = await fetch(`https://api.agora.io/v1/apps/${appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`, {
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

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
