import 'package:flutter/foundation.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';

/// Centralized, typed access to environment variables.
/// All backend/API calls must read through this class so that
/// .env loading and validation happen in one place.
class Env {
  Env._();

  static String get supabaseUrl => _required('SUPABASE_URL');
  static String get supabaseAnonKey => _required('SUPABASE_ANON_KEY');
  static String get apiBaseUrl {
    final configuredUrl = dotenv.env['API_BASE_URL']?.trim();
    final url = configuredUrl?.isNotEmpty == true
        ? configuredUrl!
        : 'http://localhost:8787';
    final uri = Uri.parse(url);
    if (!kIsWeb &&
        defaultTargetPlatform == TargetPlatform.android &&
        (uri.host == 'localhost' || uri.host == '127.0.0.1')) {
      return uri.replace(host: '10.0.2.2').toString();
    }
    return url;
  }
  static String get telegramBotToken => _required('TELEGRAM_BOT_TOKEN');
  static String get telegramBotUsername {
    final raw = _required('TELEGRAM_BOT_USERNAME');
    // Guard against an accidental leading "@" which breaks the
    // Telegram Auth Widget / OAuth flow ("bot_id required").
    return raw.startsWith('@') ? raw.substring(1) : raw;
  }

  static String get telegramChatId => _required('TELEGRAM_CHAT_ID');
  static String get telegramAdminChatId =>
      dotenv.env['TELEGRAM_ADMIN_CHAT_ID']?.trim() ?? '';
  static String get telegramAdminUserId =>
      dotenv.env['TELEGRAM_ADMIN_USER_ID']?.trim() ?? '';

  static String _required(String key) {
    final value = dotenv.env[key]?.trim();
    if (value == null || value.isEmpty) {
      throw StateError('Missing required environment variable: $key');
    }
    return value;
  }

  static bool get isConfigured =>
      (dotenv.env['SUPABASE_URL']?.trim().isNotEmpty ?? false) &&
      (dotenv.env['SUPABASE_ANON_KEY']?.trim().isNotEmpty ?? false);
}
