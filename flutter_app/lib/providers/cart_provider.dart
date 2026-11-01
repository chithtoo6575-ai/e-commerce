import 'package:flutter/foundation.dart';

import '../models/product.dart';

class CartLine {
  final Product product;
  final String size;
  final String color;
  int quantity;
  bool selected;

  CartLine({
    required this.product,
    this.size = '',
    this.color = '',
    this.quantity = 1,
    this.selected = true,
  });

  String get key => '${product.id}:$size:$color';

  double get lineTotal => product.effectivePrice * quantity;
}

class CartProvider extends ChangeNotifier {
  final List<CartLine> _items = [];

  List<CartLine> get items => List.unmodifiable(_items);
  int get count => _items.fold(0, (sum, line) => sum + line.quantity);
  double get subtotal => _items.fold(0.0, (sum, line) => sum + line.lineTotal);
  bool get isEmpty => _items.isEmpty;

  void add(Product product, {String size = '', String color = '', int quantity = 1}) {
    final key = '${product.id}:$size:$color';
    final existing = _items.firstWhere(
      (line) => line.key == key,
      orElse: () => CartLine(product: product, size: size, color: color, quantity: 0),
    );
    if (existing.quantity == 0 && !_items.contains(existing)) {
      existing.quantity = quantity;
      _items.add(existing);
    } else {
      existing.quantity += quantity;
    }
    notifyListeners();
  }

  void remove(String key) {
    _items.removeWhere((line) => line.key == key);
    notifyListeners();
  }

  void updateQuantity(String key, int quantity) {
    final idx = _items.indexWhere((line) => line.key == key);
    if (idx < 0) return;
    if (quantity <= 0) {
      _items.removeAt(idx);
    } else {
      _items[idx].quantity = quantity;
    }
    notifyListeners();
  }

  void toggleSelected(String key) {
    final idx = _items.indexWhere((line) => line.key == key);
    if (idx < 0) return;
    _items[idx].selected = !_items[idx].selected;
    notifyListeners();
  }

  void clear() {
    _items.clear();
    notifyListeners();
  }
}
