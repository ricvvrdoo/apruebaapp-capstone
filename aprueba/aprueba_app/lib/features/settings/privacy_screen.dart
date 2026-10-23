import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/common_widgets.dart';
import '../../providers/app_providers.dart';

/// "Mis datos y privacidad": qué se guarda, copiar una copia de los datos y qué pasa al eliminar la cuenta.
class PrivacyScreen extends ConsumerStatefulWidget {
  const PrivacyScreen({super.key});
  @override
  ConsumerState<PrivacyScreen> createState() => _PrivacyScreenState();
}

class _PrivacyScreenState extends ConsumerState<PrivacyScreen> {
  bool _busy = false;

  Future<void> _copy() async {
    final messenger = ScaffoldMessenger.of(context);
    // Los textos se resuelven antes del await para no usar el contexto después.
    final doneMsg = context.s('priv_copied');
    final failMsg = context.s('error_generic');
    setState(() => _busy = true);
    try {
      final data = await ref.read(profileRepositoryProvider).exportData();
      await Clipboard.setData(ClipboardData(text: const JsonEncoder.withIndent('  ').convert(data)));
      messenger.showSnackBar(SnackBar(content: Text(doneMsg)));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      messenger.showSnackBar(SnackBar(content: Text(failMsg)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    Widget bullets(List<String> keys) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final k in keys)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('•  ', style: TextStyle(fontSize: 12, color: t.muted)),
                  Expanded(child: Text(context.s(k), style: TextStyle(fontSize: 12, color: t.muted))),
                ]),
              ),
          ],
        );
    Widget title(IconData icon, String key) => Row(children: [
          Icon(icon, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(context.s(key), style: const TextStyle(fontWeight: FontWeight.w700))),
        ]);

    return Scaffold(
      appBar: AppBar(title: Text(context.s('set_privacy'))),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.all(16), children: [
          Text(context.s('priv_intro'), style: TextStyle(fontSize: 12, color: t.muted)),
          const SizedBox(height: 12),
          SoftCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              title(Icons.shield_outlined, 'priv_stored_h'),
              const SizedBox(height: 4),
              bullets(['priv_stored_1', 'priv_stored_2', 'priv_stored_3', 'priv_stored_4']),
            ]),
          ),
          const SizedBox(height: 10),
          SoftCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              title(Icons.copy_all_outlined, 'priv_download_h'),
              const SizedBox(height: 6),
              Text(context.s('priv_copy_p'), style: TextStyle(fontSize: 12, color: t.muted)),
              const SizedBox(height: 12),
              PrimaryButton(
                label: _busy ? context.s('priv_downloading') : context.s('priv_copy_btn'),
                icon: Icons.copy_all_outlined,
                onPressed: _busy ? null : _copy,
              ),
            ]),
          ),
          const SizedBox(height: 10),
          SoftCard(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              title(Icons.delete_outline, 'priv_delete_h'),
              const SizedBox(height: 4),
              bullets(['priv_delete_1', 'priv_delete_2', 'priv_delete_3']),
              const SizedBox(height: 12),
              OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: AppColors.error, side: const BorderSide(color: AppColors.error)),
                onPressed: () => context.go('/settings'),
                child: Text(context.s('priv_delete_btn')),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
