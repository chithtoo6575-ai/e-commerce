import 'package:flutter/foundation.dart';

import '../models/banner.dart';
import '../services/api_service.dart';
import '../services/supabase_service.dart';

class BannerProvider extends ChangeNotifier {
  BannerProvider({SupabaseService? service, ApiService? apiService})
      : _service = service ?? SupabaseService.instance,
        _apiService = apiService ?? ApiService();

  final SupabaseService _service;
  final ApiService _apiService;

  List<BannerItem> _banners = [];
  bool _loading = false;
  String? _error;

  List<BannerItem> get banners => _banners;
  bool get loading => _loading;
  String? get error => _error;

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      final response = await _apiService.get('/api/banners');
      final rows = response['banners'];
      if (rows is! List) {
        throw const FormatException('The banners API returned invalid data.');
      }
      _banners = rows
          .whereType<Map<String, dynamic>>()
          .map(BannerItem.fromJson)
          .toList();
    } catch (apiError) {
      debugPrint('[banners] Storefront API load failed: $apiError');
      try {
        _banners = await _service.getBanners();
      } catch (supabaseError) {
        debugPrint('[banners] Supabase fallback failed: $supabaseError');
        _error = 'Unable to load banners from the storefront API or Supabase: '
            '$apiError; $supabaseError';
      }
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
