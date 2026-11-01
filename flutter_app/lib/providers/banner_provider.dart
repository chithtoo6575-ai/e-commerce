import 'package:flutter/foundation.dart';

import '../models/banner.dart';
import '../services/supabase_service.dart';

class BannerProvider extends ChangeNotifier {
  BannerProvider({SupabaseService? service}) : _service = service ?? SupabaseService.instance;

  final SupabaseService _service;

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
      _banners = await _service.getBanners();
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}
