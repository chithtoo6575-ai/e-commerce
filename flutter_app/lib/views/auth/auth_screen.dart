import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _register = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: Text(_register ? 'Register' : 'Sign In')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            if (_register)
              TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name')),
            TextField(controller: _email, decoration: const InputDecoration(labelText: 'Email')),
            TextField(
              controller: _password,
              decoration: const InputDecoration(labelText: 'Password'),
              obscureText: true,
            ),
            const SizedBox(height: 16),
            if (auth.error != null)
              Text(auth.error!, style: const TextStyle(color: Colors.red)),
            ElevatedButton(
              onPressed: auth.loading
                  ? null
                  : () async {
                      if (_register) {
                        await context.read<AuthProvider>().signUp(
                              email: _email.text.trim(),
                              password: _password.text,
                              name: _name.text.trim(),
                            );
                      } else {
                        await context.read<AuthProvider>().signIn(
                              email: _email.text.trim(),
                              password: _password.text,
                            );
                      }
                      if (context.mounted && context.read<AuthProvider>().isSignedIn) {
                        Navigator.of(context).pop();
                      }
                    },
              child: Text(_register ? 'Create Account' : 'Sign In'),
            ),
            TextButton(
              onPressed: () => setState(() => _register = !_register),
              child: Text(_register ? 'Already have an account? Sign in' : 'New here? Register'),
            ),
          ],
        ),
      ),
    );
  }
}
