import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/product.dart';
import '../../providers/cart_provider.dart';

class ProductDetailScreen extends StatefulWidget {
  const ProductDetailScreen({super.key, required this.product});
  final Product product;

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  int quantity = 1;
  String? size;
  String? color;

  @override
  Widget build(BuildContext context) {
    final product = widget.product;
    return Scaffold(
      appBar: AppBar(title: Text(product.name)),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AspectRatio(
              aspectRatio: 1,
              child: product.image != null
                  ? Image.network(product.image!, fit: BoxFit.cover, width: double.infinity)
                  : Container(color: Colors.grey.shade200),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name, style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 8),
                  Text('Ks ${product.effectivePrice.toStringAsFixed(0)}',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            color: Theme.of(context).colorScheme.primary,
                            fontWeight: FontWeight.bold,
                          )),
                  const SizedBox(height: 12),
                  if (product.description != null) Text(product.description!),
                  const SizedBox(height: 16),
                  if (product.sizes.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      children: product.sizes
                          .map((s) => ChoiceChip(
                                label: Text(s),
                                selected: size == s,
                                onSelected: (_) => setState(() => size = s),
                              ))
                          .toList(),
                    ),
                  if (product.colors.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      children: product.colors
                          .map((c) => ChoiceChip(
                                label: Text(c),
                                selected: color == c,
                                onSelected: (_) => setState(() => color = c),
                              ))
                          .toList(),
                    ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      IconButton(
                        onPressed: quantity > 1 ? () => setState(() => quantity--) : null,
                        icon: const Icon(Icons.remove),
                      ),
                      Text('$quantity', style: const TextStyle(fontSize: 18)),
                      IconButton(
                        onPressed: () => setState(() => quantity++),
                        icon: const Icon(Icons.add),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: ElevatedButton(
            onPressed: () {
              context.read<CartProvider>().add(
                    product,
                    size: size ?? '',
                    color: color ?? '',
                    quantity: quantity,
                  );
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Added to cart')),
              );
            },
            child: const Text('Add to Cart'),
          ),
        ),
      ),
    );
  }
}
