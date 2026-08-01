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
    const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase URL and Service Role Key are required for admin operations");
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
  console.log("Received admin update request:", req.body);
  const { userId, updates, password, developerId } = req.body;

  try {
    const admin = getSupabaseAdmin();
    console.log("Supabase admin client initialized");
    
    // 1. Verify if the requester is a developer
    const { data: devProfile, error: devError } = await admin
      .from("profiles")
      .select("role, email")
      .eq("id", developerId)
      .single();

    if (devError) {
      console.error("Developer profile fetch error:", devError);
      return res.status(500).json({ error: "Failed to verify developer permissions" });
    }

    const isDev = (devProfile?.role === "developer" || devProfile?.role === "developper") || 
                  (devProfile?.email?.toLowerCase() === "zaitiabdou27@gmail.com");

    console.log("Auth check results:", { isDev, role: devProfile?.role, email: devProfile?.email });

    if (!isDev) {
      return res.status(403).json({ error: "Unauthorized. Only developers can use this API." });
    }

    // 2. Update Auth User if password or email is provided
    if (password) {
      console.log("Updating password for user:", userId);
      const { error: authError } = await admin.auth.admin.updateUserById(userId, {
        password: password
      });
      if (authError) {
        console.error("Auth update error:", authError);
        throw authError;
      }
      console.log("Password updated successfully");
    }

    // 3. Update Profile Data
    if (updates) {
      console.log("Updating profile for user:", userId, updates);
      const { error: profileError } = await admin
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      
      if (profileError) {
        console.error("Profile update error:", profileError);
        throw profileError;
      }
      console.log("Profile updated successfully");
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error("Admin update error:", err);
    res.status(500).json({ error: err.message });
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
