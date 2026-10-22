import 'package:flutter/material.dart';
import '../l10n/app_strings.dart';
import '../theme/app_colors.dart';

const medalEmoji = {
  'bronze': '🥉',
  'silver': '🥈',
  'gold': '🥇',
  'diamond': '💎',
  'platinum': '⬡',
};

class MedalCoin extends StatelessWidget {
  const MedalCoin(this.tier, {super.key, this.size = 28});
  final String tier;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.medalColor(tier);
    return Semantics(label: context.s('med_$tier'), image: true, excludeSemantics: true, child: Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white.withValues(alpha: .5), width: 2),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: .15), blurRadius: 6, offset: const Offset(0, 2))],
      ),
      child: Text(medalEmoji[tier] ?? '🏅', style: TextStyle(fontSize: size * 0.46)),
    ));
  }
}
