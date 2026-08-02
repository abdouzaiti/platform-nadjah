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
