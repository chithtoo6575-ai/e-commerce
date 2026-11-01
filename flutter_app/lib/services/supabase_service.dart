import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/supabase_config.dart';
import '../models/banner.dart';
import '../models/product.dart';

/// Supabase data access. Mirrors src/lib/supabase.js shopData.
class SupabaseService {
  SupabaseService._();
  static final SupabaseService instance = SupabaseService._();

  SupabaseClient get _client => SupabaseConfig.client;

  Future<List<Product>> getProducts() async {
    final response = await _client
        .from('products')
        .select('*, categories(name, storefront_group), product_images(url, alt_text, sort_order)')
        .eq('status', 'published')
        .order('created_at', ascending: false);
    return (response as List).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Map<String, dynamic>> getSettings() async {
    final response = await _client.from('store_settings').select('key, value');
    return {for (final row in response as List) (row as Map)['key'].toString(): row['value']};
  }

  Future<List<BannerItem>> getBanners() async {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final response = await _client
        .from('banners')
        .select('*')
        .eq('enabled', true)
        .or('starts_on.is.null,starts_on.lte.$today')
        .or('ends_on.is.null,ends_on.gte.$today')
        .order('sort_order');
    return (response as List).map((e) => BannerItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<Map<String, dynamic>>> getPromotions() async {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final response = await _client
        .from('promotions')
        .select('*')
        .eq('enabled', true)
        .or('starts_on.is.null,starts_on.lte.$today')
        .or('ends_on.is.null,ends_on.gte.$today');
    return (response as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<List<Map<String, dynamic>>> getSupportChannels() async {
    final response = await _client
        .from('support_channels')
        .select('*')
        .eq('enabled', true)
        .order('sort_order');
    return (response as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<Map<String, dynamic>?> getProfile() async {
    final user = _client.auth.currentUser;
    if (user == null) return null;
    final response = await _client
        .from('profiles')
        .select('id, full_name, phone, language_preference')
        .eq('id', user.id)
        .maybeSingle();
    if (response == null) return null;
    return {...Map<String, dynamic>.from(response), 'email': user.email};
  }

  Future<AuthResponse> signUp({
    required String email,
    required String password,
    String? name,
    String? phone,
  }) {
    return _client.auth.signUp(
      email: email,
      password: password,
      data: {'full_name': name, 'phone': phone},
    );
  }

  Future<AuthResponse> signIn({required String email, required String password}) {
    return _client.auth.signInWithPassword(email: email, password: password);
  }

  Future<void> signOut() => _client.auth.signOut();

  Future<void> requestPasswordReset(String email) {
    return _client.auth.resetPasswordForEmail(email);
  }
}
