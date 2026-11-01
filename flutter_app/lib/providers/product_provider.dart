import 'package:flutter/foundation.dart';

import '../models/product.dart';
import '../services/supabase_service.dart';

class ProductProvider extends ChangeNotifier {
  ProductProvider({SupabaseService? service}) : _service = service ?? SupabaseService.instance;

  final SupabaseService _service;

  List<Product> _products = [];
  bool _loading = false;
  String? _error;

  List<Product> get products => _products;
  bool get loading => _loading;
  String? get error => _error;

  List<Product> get featured => _products.where((p) => p.featured).toList();

  Future<void> load() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      _products = await _service.getProducts();
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Product? byId(String id) {
    try {
      return _products.firstWhere((p) => p.id == id);
    } catch (_) {
      return null;
    }
  }
}
