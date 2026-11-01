import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
export function requireSupabase() {
  if (!supabase)
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the environment.",
    );
  return supabase;
}
function throwIfError({ data, error }) {
  if (error) throw error;
  return data;
}

export const shopData = {
  async getProducts() {
    const { data, error } = await requireSupabase()
      .from("products")
      .select(
        "*, categories(name, storefront_group), product_images(url, alt_text, sort_order)",
      )
      .eq("status", "published")
      .order("created_at", { ascending: false });
    return throwIfError({ data, error });
  },
  async getSettings() {
    const { data, error } = await requireSupabase()
      .from("store_settings")
      .select("key, value");
    throwIfError({ data, error });
    return Object.fromEntries(
      (data || []).map(({ key, value }) => [key, value]),
    );
  },
  async getBanners() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await requireSupabase()
      .from("banners")
      .select("*")
      .eq("enabled", true)
      .or(`starts_on.is.null,starts_on.lte.${today}`)
      .or(`ends_on.is.null,ends_on.gte.${today}`)
      .order("sort_order");
    return throwIfError({ data, error });
  },
  async getPromotions() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await requireSupabase()
      .from("promotions")
      .select("*")
      .eq("enabled", true)
      .or(`starts_on.is.null,starts_on.lte.${today}`)
      .or(`ends_on.is.null,ends_on.gte.${today}`);
    return throwIfError({ data, error });
  },
  async getSupportChannels() {
    const { data, error } = await requireSupabase()
      .from("support_channels")
      .select("*")
      .eq("enabled", true)
      .order("sort_order");
    return throwIfError({ data, error });
  },
  async getProfile() {
    const client = requireSupabase();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError) throw authError;
    if (!user) return null;
    const { data, error } = await client
      .from("profiles")
      .select("id, full_name, phone, language_preference")
      .eq("id", user.id)
      .single();
    return throwIfError({
      data: data ? { ...data, email: user.email } : data,
      error,
    });
  },
  async signUp({ email, password, name, phone }) {
    const { data, error } = await requireSupabase().auth.signUp({
      email,
      password,
      options: { data: { full_name: name, phone } },
    });
    return throwIfError({ data, error });
  },
  async signIn({ email, password }) {
    const { data, error } = await requireSupabase().auth.signInWithPassword({
      email,
      password,
    });
    return throwIfError({ data, error });
  },
  async signOut() {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw error;
  },
  async requestPasswordReset(email) {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(
      email,
      { redirectTo: window.location.origin },
    );
    if (error) throw error;
  },
  async updateProfile(profile) {
    const client = requireSupabase();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error("Please sign in to update your profile.");
    const { data, error } = await client
      .from("profiles")
      .update({
        full_name: profile.name,
        phone: profile.phone,
        language_preference: profile.languagePreference,
      })
      .eq("id", user.id)
      .select("id, full_name, phone, language_preference")
      .single();
    return throwIfError({
      data: data ? { ...data, email: user.email } : data,
      error,
    });
  },
};
