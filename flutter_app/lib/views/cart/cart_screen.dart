import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/cart_provider.dart';

class CartScreen extends StatelessWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final cart = context.watch<CartProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Cart')),
      body: cart.isEmpty
          ? const Center(child: Text('Your cart is empty'))
          : ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: cart.items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final line = cart.items[index];
                return Card(
                  child: ListTile(
                    leading: line.product.image != null
                        ? Image.network(line.product.image!, width: 56, height: 56, fit: BoxFit.cover)
                        : const Icon(Icons.shopping_bag),
                    title: Text(line.product.name),
                    subtitle: Text('Ks ${line.product.effectivePrice.toStringAsFixed(0)} x ${line.quantity}'),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.remove),
                          onPressed: () => context
                              .read<CartProvider>()
                              .updateQuantity(line.key, line.quantity - 1),
                        ),
                        IconButton(
                          icon: const Icon(Icons.add),
                          onPressed: () => context
                              .read<CartProvider>()
                              .updateQuantity(line.key, line.quantity + 1),
                        ),
                        IconButton(
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () => context.read<CartProvider>().remove(line.key),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
      bottomNavigationBar: cart.isEmpty
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Total: Ks ${cart.subtotal.toStringAsFixed(0)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    ElevatedButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Checkout not wired yet')),
                        );
                      },
                      child: const Text('Checkout'),
                    ),
                  ],
                ),
              ),
            ),
    );
  }
}
