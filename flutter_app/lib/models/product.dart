class Product {
  final String id;
  final String name;
  final String? nameMy;
  final String? description;
  final double price;
  final double? salePrice;
  final String? image;
  final List<String> images;
  final String? category;
  final String? brand;
  final int stock;
  final List<String> sizes;
  final List<String> colors;
  final bool featured;

  const Product({
    required this.id,
    required this.name,
    this.nameMy,
    this.description,
    required this.price,
    this.salePrice,
    this.image,
    this.images = const [],
    this.category,
    this.brand,
    this.stock = 0,
    this.sizes = const [],
    this.colors = const [],
    this.featured = false,
  });

  double get effectivePrice => (salePrice != null && salePrice! > 0) ? salePrice! : price;

  factory Product.fromJson(Map<String, dynamic> json) {
    final variants = json['availableVariants'] ?? json['variants'] ?? {};
    final sizes = _toStringList(variants is Map ? variants['sizes'] : variants);
    final colors = _toStringList(variants is Map ? variants['colors'] : null);
    final images = _toStringList(json['images']);
    return Product(
      id: (json['id'] ?? '').toString(),
      name: (json['nameEn'] ?? json['name'] ?? '').toString(),
      nameMy: json['nameMy']?.toString(),
      description: (json['descriptionEn'] ?? json['description'])?.toString(),
      price: _toDouble(json['price']),
      salePrice: json['salePrice'] != null || json['discountPrice'] != null
          ? _toDouble(json['salePrice'] ?? json['discountPrice'])
          : null,
      image: (json['image'] ?? (images.isNotEmpty ? images.first : null))?.toString(),
      images: images,
      category: json['category']?.toString(),
      brand: json['brand']?.toString(),
      stock: (json['stock'] as num?)?.toInt() ?? 0,
      sizes: sizes,
      colors: colors,
      featured: (json['featured'] ?? false) as bool? ?? false,
    );
  }

  static double _toDouble(dynamic value) =>
      value is num ? value.toDouble() : double.tryParse(value?.toString() ?? '') ?? 0;

  static List<String> _toStringList(dynamic value) {
    if (value == null) return const [];
    if (value is List) return value.map((e) => e.toString()).toList();
    if (value is String) {
      return value.split(',').map((e) => e.trim()).where((e) => e.isNotEmpty).toList();
    }
    return const [];
  }
}
