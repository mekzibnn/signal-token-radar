# signal-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mekzibnn/signal-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mekzibnn/signal-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

An offline token launch radar. Implied token values come from a log-log size curve fitted on recorded-token peers and validated three ways (time-split out-of-sample, blind holdout, leave-one-out), with bootstrap bands, a log-log scatter of the fit drawn on the board, and farm plans netted per hands-on hour with farm/thin/skip verdicts, break-even farmer counts and break-even odds. Covers every sealed-snapshot watchlist protocol. Validation is headlined as within-3× with the category baseline beside it, never within-2×.

v4: the board now surfaces the eight best farms by net $/hour ("Farm next"), an "Early finds" panel (new ≤180 days or rising +25% TVL in 7 days), the set-aside count with its rule breakdown (CEX, bridge families, staking derivatives, chain identities and wrapped/staked/versioned names are set aside; the watchlist is always ranked), and a reproducibility digest — this page is board.json, re-running main.ts on the snapshot reproduces board.json, dossier.json and data.js byte for byte. The pure size curve is kept deliberately: a family factor (shrunken category residuals, k=2..160), joint OLS with category dummies under ridge, a quadratic log-log curve, Theil-Sen, IRLS-robust and trimmed fits, bounded growth and age factors, and curve/category blends were all tested on the fixed splits and none beat the pure curve on blind + out-of-sample + leave-one-out at once (the quadratic won out-of-sample ×2.82 but lost the blind holdout ×4.12); the pure curve also wins the 5-fold cross-validation mean. Note: the snapshot's 7D TVL change is already in percent (median −8.2%), so it is shown as-is, not multiplied by 100. Growth was re-tested at the correct scale and its fitted slope is negative (−3.7) — fast recent TVL growth predicts a lower multiple on this snapshot, the opposite of the usual growth assumption.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
# Open out/dashboard/index.html in a browser.
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=1cytnb2s&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
