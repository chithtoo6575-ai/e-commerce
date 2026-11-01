import 'package:supabase_flutter/supabase_flutter.dart';

import 'env.dart';

class SupabaseConfig {
  SupabaseConfig._();

  static Future<void> initialize() async {
    if (!Env.isConfigured) {
      // Surface missing config instead of crashing silently.
      throw StateError(
        'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.',
      );
    }
    await Supabase.initialize(
      url: Env.supabaseUrl,
      anonKey: Env.supabaseAnonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
        autoRefreshToken: true,
      ),
      realtimeClientOptions: const RealtimeClientOptions(eventsPerSecond: 2),
    );
  }

  static SupabaseClient get client => Supabase.instance.client;
}
