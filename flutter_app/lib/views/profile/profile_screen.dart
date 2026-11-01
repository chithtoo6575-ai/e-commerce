import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import 'auth/auth_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final profile = auth.profile;
    return Scaffold(
      appBar: AppBar(title: const Text('Profile')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (auth.loading) const CircularProgressIndicator(),
            if (profile != null) ...[
              Text('Name: ${profile['full_name'] ?? ''}'),
              Text('Email: ${profile['email'] ?? ''}'),
              Text('Phone: ${profile['phone'] ?? ''}'),
            ] else
              const Text('Not signed in'),
            const SizedBox(height: 16),
            if (profile == null)
              ElevatedButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AuthScreen()),
                ),
                child: const Text('Sign In / Register'),
              )
            else
              ElevatedButton(
                onPressed: () => context.read<AuthProvider>().signOut(),
                child: const Text('Sign Out'),
              ),
          ],
        ),
      ),
    );
  }
}
