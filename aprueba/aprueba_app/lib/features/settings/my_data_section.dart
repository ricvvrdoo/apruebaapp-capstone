import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/widgets/async_value_view.dart';
import '../../core/theme/app_colors.dart';
import '../../data/models/models.dart';
import '../../providers/catalog_providers.dart';
import '../../providers/data_providers.dart';

/// Los datos del alumno tal como los guarda la API (país y grado con su nombre) y lo que pasa con ellos
/// si elimina la cuenta.
class MyDataSection extends ConsumerWidget {
  const MyDataSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);
    final t = context.tokens;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
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
      const SizedBox(height: 12),
      Text(context.s('priv_delete_h'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
      for (final k in const ['priv_delete_1', 'priv_delete_2', 'priv_delete_3'])
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('•  ', style: TextStyle(fontSize: 12, color: t.muted)),
            Expanded(child: Text(context.s(k), style: TextStyle(fontSize: 12, color: t.muted))),
          ]),
        ),
    ]);
  }
}
