import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/async_value_view.dart';
import '../../core/widgets/common_widgets.dart';
import '../../data/models/models.dart';
import '../../providers/catalog_providers.dart';
import '../../providers/data_providers.dart';

/// "Mis datos y privacidad": los datos del alumno y qué pasa al eliminar la cuenta.
class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

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
          const _DataCard(),
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

/// Los datos del perfil tal como los guarda la API; el país y el grado se muestran con su nombre.
class _DataCard extends ConsumerWidget {
  const _DataCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);
    final t = context.tokens;
    return SoftCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.person_outline, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(context.s('priv_data_h'), style: const TextStyle(fontWeight: FontWeight.w700))),
        ]),
        const SizedBox(height: 6),
        AsyncValueView<User>(
          value: me,
          onRetry: () => ref.invalidate(meProvider),
          data: (u) {
            final countries = ref.watch(countriesProvider).valueOrNull ?? const <Country>[];
            final grades = u.country == null ? const <GradeGroup>[] : (ref.watch(gradesProvider(u.country!)).valueOrNull ?? const <GradeGroup>[]);
            String? countryName;
            for (final c in countries) {
              if (c.code == u.country) countryName = c.name;
            }
            String? gradeName;
            for (final g in grades) {
              for (final i in g.items) {
                if (i.id == u.gradeId) gradeName = i.label;
              }
            }
            final rows = <(String, String?)>[
              ('priv_f_name', u.name),
              ('priv_f_email', u.email),
              ('priv_f_phone', u.phone == null ? null : '${u.phone} (${context.s(u.phoneVerified ? 'priv_f_verified' : 'priv_f_unverified')})'),
              ('priv_f_country', u.country == null ? null : (countryName ?? u.country)),
              ('priv_f_grade', u.gradeId == null ? null : (gradeName ?? u.gradeId)),
              ('priv_f_school', u.school),
              ('priv_f_age', u.age?.toString()),
              ('priv_f_region', u.region),
              ('priv_f_lang', u.language == 'en' ? 'English' : 'Español'),
              ('priv_f_tz', u.timezone),
              ('priv_f_plan', u.isPaid ? u.plan.toUpperCase() : context.s('priv_f_plan_free')),
            ];
            return Column(children: [
              for (final (key, value) in rows)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(context.s(key), style: TextStyle(fontSize: 12, color: t.muted)),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Text(
                        (value == null || value.isEmpty) ? context.s('priv_f_empty') : value,
                        textAlign: TextAlign.right,
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: (value == null || value.isEmpty) ? t.muted : null),
                      ),
                    ),
                  ]),
                ),
            ]);
          },
        ),
      ]),
    );
  }
}
