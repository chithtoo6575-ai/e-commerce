import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';

import '../config/env.dart';
import '../models/banner.dart';

/// Dynamic banner image slider with auto-play, infinite loop, manual swipe,
/// and indicator dots. Configured to animate reliably on mobile viewports.
class BannerSlider extends StatefulWidget {
  const BannerSlider({
    super.key,
    required this.banners,
    this.height,
    this.onTap,
  });

  final List<BannerItem> banners;
  final double? height;
  final void Function(BannerItem banner)? onTap;

  @override
  State<BannerSlider> createState() => _BannerSliderState();
}

class _BannerSliderState extends State<BannerSlider> {
  int _current = 0;
  final CarouselSliderController _controller = CarouselSliderController();

  Widget _buildBannerImage(BannerItem banner) {
    final source = banner.image.trim();
    final uri = Uri.tryParse(source);
    if (uri == null) {
      return _brokenImage();
    }

    if (uri.scheme == 'data') {
      try {
        return Image.memory(
          UriData.fromUri(uri).contentAsBytes(),
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _brokenImage(),
        );
      } on FormatException catch (error) {
        debugPrint('[banners] Invalid banner image data: $error');
        return _brokenImage();
      }
    }

    final imageUri = uri.hasScheme
        ? uri
        : Uri.parse(Env.apiBaseUrl).resolve(source);
    return Image.network(
      imageUri.toString(),
      fit: BoxFit.cover,
      errorBuilder: (_, __, error) {
        debugPrint('[banners] Unable to render ${imageUri.path}: $error');
        return _brokenImage();
      },
    );
  }

  Widget _brokenImage() => Container(
        color: Colors.grey.shade300,
        alignment: Alignment.center,
        child: const Icon(Icons.broken_image, size: 40),
      );

  @override
  Widget build(BuildContext context) {
    if (widget.banners.isEmpty) {
      return const SizedBox.shrink();
    }

    final height = widget.height ??
        (MediaQuery.of(context).size.width < 600 ? 180.0 : 260.0);

    return Column(
      children: [
        CarouselSlider.builder(
          carouselController: _controller,
          itemCount: widget.banners.length,
          options: CarouselOptions(
            height: height,
            autoPlay: true,
            autoPlayInterval: const Duration(seconds: 4),
            autoPlayAnimationDuration: const Duration(milliseconds: 900),
            autoPlayCurve: Curves.fastOutSlowIn,
            enlargeCenterPage: true,
            viewportFraction: 0.92,
            aspectRatio: 16 / 9,
            enableInfiniteScroll: true,
            scrollPhysics: const BouncingScrollPhysics(),
            pauseAutoPlayOnTouch: true,
            onPageChanged: (index, reason) {
              setState(() => _current = index);
            },
          ),
          itemBuilder: (context, index, realIndex) {
            final banner = widget.banners[index];
            return GestureDetector(
              onTap: () => widget.onTap?.call(banner),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    _buildBannerImage(banner),
                    if (banner.altText != null && banner.altText!.isNotEmpty)
                      Positioned(
                        left: 16,
                        bottom: 16,
                        right: 16,
                        child: Text(
                          banner.altText!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            shadows: [Shadow(blurRadius: 6, color: Colors.black54)],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            );
          },
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: widget.banners.asMap().entries.map((entry) {
            final active = entry.key == _current;
            return GestureDetector(
              onTap: () => _controller.animateToPage(entry.key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 300),
                width: active ? 20 : 8,
                height: 8,
                margin: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  color: active ? Theme.of(context).colorScheme.primary : Colors.grey.shade400,
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
