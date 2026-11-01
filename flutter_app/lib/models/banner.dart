class BannerItem {
  final String id;
  final String image;
  final String? altText;
  final String? link;
  final int sortOrder;
  final bool enabled;

  const BannerItem({
    required this.id,
    required this.image,
    this.altText,
    this.link,
    this.sortOrder = 0,
    this.enabled = true,
  });

  factory BannerItem.fromJson(Map<String, dynamic> json) {
    return BannerItem(
      id: (json['id'] ?? '').toString(),
      image: (json['image'] ?? json['image_url'] ?? '').toString(),
      altText: json['altText']?.toString() ?? json['alt_text']?.toString(),
      link: json['link']?.toString(),
      sortOrder: (json['sortOrder'] ?? json['sort_order'] ?? 0) as int? ?? 0,
      enabled: (json['enabled'] ?? true) as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'image': image,
        'altText': altText,
        'link': link,
        'sortOrder': sortOrder,
        'enabled': enabled,
      };
}
