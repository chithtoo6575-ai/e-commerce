import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';

import 'config/app_config.dart';
import 'config/env.dart';
import 'config/supabase_config.dart';
import 'providers/auth_provider.dart';
import 'providers/banner_provider.dart';
import 'providers/cart_provider.dart';
import 'providers/product_provider.dart';
import 'views/main_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load .env securely before anything else.
  await dotenv.load(fileName: '.env');

  // Validate config early so misconfiguration surfaces immediately.
  if (!Env.isConfigured) {
    // Still allow running with a clear error screen.
  } else {
    await SupabaseConfig.initialize();
  }

  runApp(const HtooShopApp());
}

class HtooShopApp extends StatelessWidget {
  const HtooShopApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => CartProvider()),
        ChangeNotifierProvider(create: (_) => ProductProvider()),
        ChangeNotifierProvider(create: (_) => BannerProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()),
      ],
      child: MaterialApp(
        title: AppConfig.appName,
        debugShowCheckedModeBanner: false,
        theme: AppConfig.lightTheme(),
        home: const _Bootstrap(),
      ),
    );
  }
}

class _Bootstrap extends StatefulWidget {
  const _Bootstrap();

  @override
  State<_Bootstrap> createState() => _BootstrapState();
}

class _BootstrapState extends State<_Bootstrap> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!Env.isConfigured) return;
      context.read<ProductProvider>().load();
      context.read<BannerProvider>().load();
      context.read<AuthProvider>().refresh();
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!Env.isConfigured) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }
    return const MainShell();
  }
}
