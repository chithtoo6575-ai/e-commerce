import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/product.dart';
import '../providers/banner_provider.dart';
import '../providers/product_provider.dart';
import '../widgets/banner_slider.dart';
import 'product/product_detail_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final banners = context.watch<BannerProvider>();
    final products = context.watch<ProductProvider>();

    return RefreshIndicator(
      onRefresh: () async {
        await banners.load();
        await products.load();
      },
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: banners.loading
                  ? const SizedBox(height: 180, child: Center(child: CircularProgressIndicator()))
                  : BannerSlider(
                      banners: banners.banners,
                      onTap: (b) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(b.altText ?? 'Banner tapped')),
                        );
                      },
                    ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverToBoxAdapter(
              child: Text(
                'Featured Products',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
              ),
            ),
          ),
          if (products.loading)
            const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
          else if (products.error != null)
            SliverFillRemaining(child: Center(child: Text('Error: ${products.error}')))
          else
            SliverPadding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              sliver: _ProductGrid(products: products.products),
            ),
        ],
      ),
    );
  }
}

class _ProductGrid extends StatelessWidget {
  const _ProductGrid({required this.products});
  final List<Product> products;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final crossAxisCount = width >= 900 ? 4 : (width >= 600 ? 3 : 2);
    return SliverGrid(
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: crossAxisCount,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.72,
      ),
      delegate: SliverChildBuilderDelegate(
        (context, index) {
          final product = products[index];
          return _ProductCard(product: product);
        },
        childCount: products.length,
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product});
  final Product product;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ProductDetailScreen(product: product)),
      ),
      child: Card(
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: product.image != null
                  ? Image.network(product.image!, fit: BoxFit.cover, width: double.infinity)
                  : Container(color: Colors.grey.shade200),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name, maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text('Ks ${product.effectivePrice.toStringAsFixed(0)}',
                      style: TextStyle(color: Theme.of(context).colorScheme.primary)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
