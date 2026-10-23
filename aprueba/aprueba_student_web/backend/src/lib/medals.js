// Logica de gamificacion de medallas.
// Niveles y ruta de canje: 5 de un nivel = 1 del siguiente.
export const TIERS = ['bronze', 'silver', 'gold', 'diamond', 'platinum'];
export const NEXT = { bronze: 'silver', silver: 'gold', gold: 'diamond', diamond: 'platinum' };

export function emptyWallet() {
  return { bronze: 0, silver: 0, gold: 0, diamond: 0, platinum: 0 };
}

export function award(wallet, tier, amount) {
  wallet[tier] = (wallet[tier] || 0) + amount;
  return wallet;
}

// Que mostrar en la tarjeta de canje de Inicio. Devuelve un solo nivel:
//   { [nivel]: { have, needed, next, exchangeable, missing } }
// - have: medallas hacia el siguiente canje (maximo needed)
// - exchangeable: canjes que ya se pueden hacer con ese saldo
// - missing: medallas que faltan para el primer canje (0 si ya se puede)
// Nivel elegido: el mas bajo que ya se puede canjear; si ninguno, el mas cercano a poder
// canjear (en empate, el mas bajo). Platino no se canjea.
export const EXCHANGE_COST = 5;
export function walletProgress(wallet) {
  const tiers = TIERS.filter((t) => NEXT[t]);
  const info = (t) => {
    const balance = wallet[t] || 0;
    return {
      have: Math.min(balance, EXCHANGE_COST),
      needed: EXCHANGE_COST,
      next: NEXT[t],
      exchangeable: Math.floor(balance / EXCHANGE_COST),
      missing: Math.max(0, EXCHANGE_COST - balance),
    };
  };
  const ready = tiers.find((t) => info(t).exchangeable > 0);
  const chosen = ready ?? tiers.reduce((best, t) => (info(t).have > info(best).have ? t : best), tiers[0]);
  return { [chosen]: info(chosen) };
}
