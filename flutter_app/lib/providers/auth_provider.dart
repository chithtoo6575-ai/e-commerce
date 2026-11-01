import 'package:flutter/foundation.dart';

import '../services/supabase_service.dart';

class AuthProvider extends ChangeNotifier {
  AuthProvider({SupabaseService? service}) : _service = service ?? SupabaseService.instance;

  final SupabaseService _service;

  Map<String, dynamic>? _profile;
  bool _loading = false;
  String? _error;

  Map<String, dynamic>? get profile => _profile;
  bool get loading => _loading;
  String? get error => _error;
  bool get isSignedIn => _profile != null;

  Future<void> refresh() async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      _profile = await _service.getProfile();
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> signUp({
    required String email,
    required String password,
    String? name,
    String? phone,
  }) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      await _service.signUp(email: email, password: password, name: name, phone: phone);
      await refresh();
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> signIn({required String email, required String password}) async {
    _loading = true;
    _error = null;
    notifyListeners();
    try {
      await _service.signIn(email: email, password: password);
      await refresh();
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> signOut() async {
    await _service.signOut();
    _profile = null;
    notifyListeners();
  }
}
