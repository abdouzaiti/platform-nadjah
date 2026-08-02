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

    const prefixClean = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    let base = "User";
    if (prefixClean.length >= 3) {
      const lettersOnly = prefixClean.replace(/[^a-zA-Z]/g, "");
      if (lettersOnly.length >= 3) base = lettersOnly;
    }
    const capitalized = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
    const finalPassword = customPassword || `${capitalized}2026`;

    let userId: string;
    const { data: { users } } = await admin.auth.admin.listUsers();
    const existingAuthUser = users.find((u: any) => u.email?.toLowerCase() === cleanEmail.toLowerCase());

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password: finalPassword,
        email_confirm: true,
        user_metadata: { fullname: fullname.trim(), password: finalPassword }
      });
      if (updateErr) throw updateErr;
    } else {
      const { data: createData, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: finalPassword,
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

    const prefixClean = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    let base = "User";
    if (prefixClean.length >= 3) {
      const lettersOnly = prefixClean.replace(/[^a-zA-Z]/g, "");
      if (lettersOnly.length >= 3) base = lettersOnly;
    }
    const capitalized = base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
    const finalPassword = reqData.password || `${capitalized}2026`;

    let userId: string;
    const { data: { users } } = await admin.auth.admin.listUsers();
    const existingAuthUser = users.find((u: any) => u.email?.toLowerCase() === cleanEmail.toLowerCase());

    if (existingAuthUser) {
      userId = existingAuthUser.id;
      await admin.auth.admin.updateUserById(userId, {
        password: finalPassword,
        email_confirm: true,
        user_metadata: { fullname: fullNameToSignUp, password: finalPassword }
      });
    } else {
      const { data: createData, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: finalPassword,
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
