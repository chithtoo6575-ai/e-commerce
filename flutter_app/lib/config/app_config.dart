import 'package:flutter/material.dart';

class AppConfig {
  AppConfig._();

  static const String appName = 'HTOO Shop';
  static const String appVersion = '1.0.0';

  // Backend API (custom Node/Hono). Reads API_BASE_URL from .env.
  static const double mobileBreakpoint = 600;
  static const double tabletBreakpoint = 900;

  static ThemeData lightTheme() {
    return ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF1A1A2E),
        brightness: Brightness.light,
      ),
      scaffoldBackgroundColor: const Color(0xFFF7F7F9),
      appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
      cardTheme: CardThemeData(
        elevation: 2,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }
}
