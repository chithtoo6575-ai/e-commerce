import 'dart:convert';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';

import '../config/env.dart';

/// Telegram integration:
/// - Launches the Telegram Login Widget / OAuth flow via the backend.
/// - Sends admin notifications through the Bot API using TELEGRAM_BOT_TOKEN.
/// - TELEGRAM_BOT_USERNAME is used WITHOUT the leading "@" (required by the widget).
class TelegramService {
  TelegramService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  String get botUsername => Env.telegramBotUsername; // no @
  String get botToken => Env.telegramBotToken;
  String get chatId => Env.telegramChatId;

  /// Build the Telegram Login Widget URL. The widget requires the bot username
  /// without the "@" prefix; otherwise it fails with "bot_id required".
  Uri loginWidgetUri({required String redirectUrl, String? origin}) {
    return Uri.parse(
      'https://oauth.telegram.org/auth?bot_id=${_botIdFromToken()}'
      '&origin=${Uri.encodeComponent(origin ?? redirectUrl)}'
      '&redirect_url=${Uri.encodeComponent(redirectUrl)}'
      '&request_access=write',
    );
  }

  /// Derive the numeric bot id from the bot token (part before the colon).
  String _botIdFromToken() {
    final token = Env.telegramBotToken;
    final idx = token.indexOf(':');
    if (idx <= 0) {
      throw StateError('Invalid TELEGRAM_BOT_TOKEN: expected "<bot_id>:<secret>".');
    }
    return token.substring(0, idx);
  }

  /// Ask the backend to start a Telegram OAuth/login flow and open the returned URL.
  Future<void> startLogin({required String backendStartUrl}) async {
    final response = await _client.get(Uri.parse(backendStartUrl));
    if (response.statusCode >= 400) {
      throw Exception('Telegram login unavailable (${response.statusCode})');
    }
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    final url = (data['url'] ?? data['authUrl'])?.toString();
    if (url == null || url.isEmpty) {
      throw Exception('Backend did not return a Telegram auth URL.');
    }
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  /// Send a message to the configured admin/chat via the Bot API.
  Future<bool> sendMessage({required String text, String? chatId}) async {
    final target = chatId ?? Env.telegramChatId;
    final uri = Uri.parse('https://api.telegram.org/bot$botToken/sendMessage');
    final response = await _client.post(
      uri,
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode({'chat_id': target, 'text': text, 'parse_mode': 'HTML'}),
    );
    if (response.statusCode >= 400) return false;
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    return data['ok'] == true;
  }

  /// Notify admin about a new order.
  Future<void> notifyNewOrder({
    required String orderId,
    required String customerName,
    required double total,
  }) async {
    final text =
        '<b>New order</b>\nID: $orderId\nCustomer: $customerName\nTotal: ${total.toStringAsFixed(0)} Ks';
    await sendMessage(text: text);
  }

  void close() => _client.close();
}
