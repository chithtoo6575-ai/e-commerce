import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/env.dart';

/// Thin wrapper around the custom Node/Hono backend (localhost:8787 or deployed URL).
/// All backend calls read API_BASE_URL from .env via [Env].
class ApiService {
  ApiService({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Uri _uri(String path) {
    final base = Env.apiBaseUrl.endsWith('/')
        ? Env.apiBaseUrl.substring(0, Env.apiBaseUrl.length - 1)
        : Env.apiBaseUrl;
    final normalized = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$base$normalized');
  }

  Future<Map<String, dynamic>> get(String path) async {
    final response = await _client.get(_uri(path));
    return _decode(response);
  }

  Future<Map<String, dynamic>> post(String path, Map<String, dynamic> body) async {
    final response = await _client.post(
      _uri(path),
      headers: const {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final decoded = response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    if (response.statusCode >= 400) {
      final message = decoded is Map ? (decoded['error'] ?? decoded['message']) : null;
      throw ApiException(message?.toString() ?? 'Request failed (${response.statusCode})');
    }
    return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{'data': decoded};
  }

  void close() => _client.close();
}

class ApiException implements Exception {
  ApiException(this.message);
  final String message;
  @override
  String toString() => message;
}
