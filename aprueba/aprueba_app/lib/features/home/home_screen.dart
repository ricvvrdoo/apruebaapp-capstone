import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/network/api_exception.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/async_value_view.dart';
import '../../core/widgets/brand_logo.dart';
import '../../core/widgets/common_widgets.dart';
import '../../core/widgets/medal_coin.dart';
import '../../data/models/models.dart';
import '../../providers/data_providers.dart';
import '../../providers/practice_session.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return Scaffold(
      body: SafeArea(
        child: AsyncValueView<User>(
          value: me,
          onRetry: () => ref.invalidate(meProvider),
          data: (user) => RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(meProvider);
              ref.invalidate(quotaProvider);
              ref.invalidate(progressSummaryProvider);
              ref.invalidate(medalWalletProvider);
              ref.invalidate(plansProvider);
            },
            child: ListView(padding: const EdgeInsets.all(16), children: [
              const BrandLogo(showName: true, size: 24),
              const SizedBox(height: 12),
              _PracticeCard(user: user),
              const SizedBox(height: 10),
              _StreakCard(user: user),
              const SizedBox(height: 10),
              if (user.isPaid) const _ActivityCard() else const _QuotaCard(),
              const SizedBox(height: 10),
              _MedalsCard(user: user),
              if (!user.isPaid) ...[
                const SizedBox(height: 10),
                const _UpgradeBanner(),
              ],
              const SizedBox(height: 16),
              Text(context.s('progress'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(height: 2),
              Text(context.s('progress_hint'), style: TextStyle(fontSize: 11, color: context.tokens.muted)),
              const SizedBox(height: 8),
              const _ProgressList(),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Texto de "se reinicia en": horas y minutos que faltan.
String _untilReset(BuildContext context, DateTime resetsAt) {
  final mins = resetsAt.difference(DateTime.now()).inMinutes.clamp(0, 24 * 60);
  final h = mins ~/ 60;
  return h > 0 ? context.sp('time_h_min', {'h': h, 'm': mins % 60}) : context.sp('time_min', {'m': mins});
}

/// Marcador de carga con la forma de una tarjeta, para que la pantalla no salte al cargar.
class _CardSkeleton extends StatelessWidget {
  const _CardSkeleton({this.height = 64});
  final double height;
  @override
  Widget build(BuildContext context) => Container(
        height: height,
        width: double.infinity,
        decoration: BoxDecoration(color: context.tokens.chip, borderRadius: BorderRadius.circular(14)),
      );
}

/// Error de una sola tarjeta: el resto de la pantalla sigue funcionando.
class _CardError extends StatelessWidget {
  const _CardError({required this.onRetry});
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => SoftCard(
        child: Row(children: [
          Icon(Icons.cloud_off, size: 20, color: context.tokens.muted),
          const SizedBox(width: 10),
          Expanded(child: Text(context.s('error_generic'), style: TextStyle(fontSize: 12, color: context.tokens.muted))),
          TextButton(onPressed: onRetry, child: Text(context.s('retry'))),
        ]),
      );
}

/// Acción principal: retoma la última prueba o invita a empezar.
class _PracticeCard extends ConsumerWidget {
  const _PracticeCard({required this.user});
  final User user;

  Future<void> _start(BuildContext context, WidgetRef ref, String? testId) async {
    final router = GoRouter.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await ref.read(practiceSessionProvider.notifier).start(testId: testId);
      router.push('/practice/question');
    } on ApiException catch (e) {
      if (e.isQuotaExhausted) {
        router.push('/paywall');
      } else {
        messenger.showSnackBar(SnackBar(content: Text(e.message)));
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final summary = ref.watch(progressSummaryProvider);
    final quota = ref.watch(quotaProvider).valueOrNull;
    if (summary.isLoading && !summary.hasValue) return const _CardSkeleton(height: 110);

    final s = summary.valueOrNull;
    final last = s?.lastItem;
    final isNew = s != null && s.lastTestId == null;
    final left = quota == null || quota.unlimited ? null : (quota.max - quota.used).clamp(0, quota.max);

    String? note;
    if (isNew) {
      note = context.s('continue_new_p');
    } else if (left == 0) {
      note = context.s('continue_out');
    } else if (left != null && last != null) {
      note = context.sp('continue_left', {'n': left});
    }

    final label = isNew
        ? context.s('continue_new_h')
        : last != null
            ? context.sp('continue_btn', {'test': last.label})
            : context.s('cont'); // sin saber la última prueba (error o prueba retirada)

    return SoftCard(
      borderColor: t.brand,
      background: AppColors.azul.withValues(alpha: .05),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (note != null) ...[
          Text(note, style: TextStyle(fontSize: 12, color: t.muted)),
          const SizedBox(height: 10),
        ],
        PrimaryButton(
          label: label,
          icon: Icons.play_arrow_rounded,
          onPressed: () => _start(context, ref, isNew ? null : last?.testId),
        ),
      ]),
    );
  }
}

class _StreakCard extends StatelessWidget {
  const _StreakCard({required this.user});
  final User user;
  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final n = user.streak;
    final message = switch (user.streakStatus) {
      'done_today' => context.s('streak_done_today'),
      'at_risk' => n == 1 ? context.s('streak_at_risk_one') : context.sp('streak_at_risk', {'n': n}),
      _ => context.s('streak_none'),
    };
    final active = user.streakStatus != 'none';
    return SoftCard(
      child: Row(children: [
        Icon(Icons.local_fire_department_rounded, size: 30, color: active ? const Color(0xFFEA580C) : t.muted),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('$n ${context.s('days')}', style: const TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 16)),
            Text(message, style: TextStyle(fontSize: 11, color: t.muted)),
          ]),
        ),
      ]),
    );
  }
}

class _QuotaCard extends ConsumerWidget {
  const _QuotaCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quota = ref.watch(quotaProvider);
    final t = context.tokens;
    return quota.when(
      data: (q) {
        final left = (q.max - q.used).clamp(0, q.max);
        final bonusAll = q.schoolBonus && q.addressBonus;
        final more = (q.schoolBonus ? 0 : 5) + (q.addressBonus ? 0 : 5);
        final status = left > 0 ? context.sp('quota_left', {'n': left}) : context.s('quota_empty');
        return SoftCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(context.s('quota'), style: const TextStyle(fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('${q.used} / ${q.max}', style: TextStyle(fontSize: 12, color: t.muted)),
            ]),
            const SizedBox(height: 8),
            ProgressBar(value: q.max == 0 ? 0 : q.used / q.max, label: context.s('quota')),
            const SizedBox(height: 6),
            Text(
              q.resetsAt == null ? status : '$status · ${context.sp('quota_resets', {'t': _untilReset(context, q.resetsAt!)})}',
              style: TextStyle(fontSize: 11, color: t.muted),
            ),
            const SizedBox(height: 2),
            Text(bonusAll ? context.s('quota_bonus_all') : context.sp('quota_bonus_more', {'n': more}),
                style: TextStyle(fontSize: 11, color: t.muted)),
          ]),
        );
      },
      loading: () => const _CardSkeleton(),
      error: (_, __) => _CardError(onRetry: () => ref.invalidate(quotaProvider)),
    );
  }
}

/// Plan de pago: sin tope diario, así que se muestra cuánto practicó en vez de la cuota.
class _ActivityCard extends ConsumerWidget {
  const _ActivityCard();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(progressSummaryProvider);
    return summary.when(
      data: (s) => SoftCard(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(context.s('activity_h'), style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _Stat(value: s.answeredToday, label: context.s('activity_today'))),
            Expanded(child: _Stat(value: s.answeredThisWeek, label: context.s('activity_week'))),
          ]),
        ]),
      ),
      loading: () => const _CardSkeleton(),
      error: (_, __) => _CardError(onRetry: () => ref.invalidate(progressSummaryProvider)),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final int value;
  final String label;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('$value', style: const TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 22)),
        Text(label, style: TextStyle(fontSize: 11, color: context.tokens.muted)),
      ]);
}

class _MedalsCard extends ConsumerWidget {
  const _MedalsCard({required this.user});
  final User user;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final wallet = ref.watch(medalWalletProvider);
    return SoftCard(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Text(context.s('home_medals'), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: t.muted)),
          const Spacer(),
          Semantics(
            button: true,
            child: GestureDetector(
              onTap: () => GoRouter.of(context).go('/medals'),
              child: Text(context.s('view_all'), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: t.brand)),
            ),
          ),
        ]),
        const SizedBox(height: 8),
        Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
          for (final tier in Medals.tiers)
            Opacity(
              opacity: user.medals.byTier(tier) > 0 ? 1 : .4,
              child: Column(children: [
                MedalCoin(tier, size: 28),
                const SizedBox(height: 2),
                Text('${user.medals.byTier(tier)}',
                    style: const TextStyle(fontFamily: 'Montserrat', fontWeight: FontWeight.w800, fontSize: 12)),
              ]),
            ),
        ]),
        const SizedBox(height: 10),
        wallet.when(
          data: (w) => _Exchange(state: w),
          loading: () => const _CardSkeleton(height: 32),
          error: (_, __) => _CardError(onRetry: () => ref.invalidate(medalWalletProvider)),
        ),
      ]),
    );
  }
}

/// Avance hacia el siguiente canje y acceso directo a canjear cuando ya se puede.
class _Exchange extends StatelessWidget {
  const _Exchange({required this.state});
  final MedalWalletState state;
  @override
  Widget build(BuildContext context) {
    final f = state.featured;
    final tier = state.featuredTier;
    if (f == null || tier == null) return const SizedBox.shrink();
    final t = context.tokens;
    final vars = <String, Object>{
      'n': f.exchangeable > 0 ? f.exchangeable : f.missing,
      'tier': context.s('med_$tier').toLowerCase(),
      'next': context.s('med_${f.next}').toLowerCase(),
    };
    final text = f.exchangeable == 1
        ? context.sp('medals_exchange_one', vars)
        : f.exchangeable > 1
            ? context.sp('medals_exchange_many', vars)
            : f.missing == 1
                ? context.sp('medals_missing_one', vars)
                : context.sp('medals_missing', vars);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ProgressBar(
        value: f.needed == 0 ? 0 : f.have / f.needed,
        color: switch (tier) {
          'silver' => AppColors.silver,
          'gold' => AppColors.gold,
          'diamond' => AppColors.diamond,
          'platinum' => AppColors.platinum,
          _ => AppColors.bronze,
        },
        height: 6,
        label: context.s('home_medals'),
      ),
      const SizedBox(height: 6),
      Text(text, style: TextStyle(fontSize: 11, color: t.muted)),
      if (f.exchangeable > 0)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: () => GoRouter.of(context).push('/medals/exchange'),
            child: Text(context.s('medals_go_exchange')),
          ),
        ),
    ]);
  }
}

/// Invita a mejorar el plan, con el precio mensual más bajo que informa el servidor.
class _UpgradeBanner extends ConsumerWidget {
  const _UpgradeBanner();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = context.tokens;
    final prices = [
      for (final p in ref.watch(plansProvider).valueOrNull ?? const <Plan>[])
        if (p.priceMonthly > 0) p.priceMonthly,
    ];
    String? price;
    if (prices.isNotEmpty) {
      final min = prices.reduce((a, b) => a < b ? a : b);
      price = 'US\$${min == min.roundToDouble() ? min.toInt() : min.toStringAsFixed(2)}';
    }
    return SoftCard(
      borderColor: t.brand,
      background: AppColors.azul.withValues(alpha: .05),
      onTap: () => context.push('/paywall'),
      child: Row(children: [
        Icon(Icons.rocket_launch_outlined, size: 24, color: t.brand),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(context.s('up_banner_h'), style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            Text(price == null ? context.s('up_banner_p') : context.sp('upgrade_p_price', {'price': price}),
                style: TextStyle(fontSize: 11, color: t.muted)),
          ]),
        ),
        Tag('${context.s('up_cta')} ›', variant: 'g'),
      ]),
    );
  }
}

class _ProgressList extends ConsumerWidget {
  const _ProgressList();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final summary = ref.watch(progressSummaryProvider);
    return summary.when(
      data: (s) => Column(children: [
        for (final p in s.items)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: SoftCard(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(p.label)),
                  Text(p.hasData ? '${p.percent}%' : context.s('progress_no_data'),
                      style: TextStyle(fontSize: 12, color: context.tokens.muted)),
                ]),
                const SizedBox(height: 8),
                ProgressBar(
                  value: p.hasData ? p.percent / 100 : 0,
                  color: AppColors.testColors[p.testId],
                  label: p.label,
                ),
                if (!p.hasData) ...[
                  const SizedBox(height: 6),
                  Text(
                    p.missingForData == 1
                        ? context.s('progress_need_one')
                        : context.sp('progress_need_more', {'n': p.missingForData}),
                    style: TextStyle(fontSize: 11, color: context.tokens.muted),
                  ),
                ],
              ]),
            ),
          ),
      ]),
      loading: () => const Column(children: [_CardSkeleton(height: 70), SizedBox(height: 10), _CardSkeleton(height: 70)]),
      error: (_, __) => _CardError(onRetry: () => ref.invalidate(progressSummaryProvider)),
    );
  }
}
