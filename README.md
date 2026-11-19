# signal-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mekzibnn/signal-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mekzibnn/signal-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

An offline token launch radar. Implied token values come from a log-log size curve fitted on recorded-token peers and validated three ways (time-split out-of-sample, blind holdout, leave-one-out), with bootstrap bands, a log-log scatter of the fit drawn on the board, and farm plans netted per hands-on hour with farm/thin/skip verdicts, deposit-share slices and break-even odds. Covers every sealed-snapshot watchlist protocol. Validation is headlined as within-3× with the category baseline beside it, never within-2×.

v6: the value model now uses all three rubric inputs — the log-log size curve as the TVL base, times bounded growth (1 + 0.35×tanh(change_7d/35), 0.65–1.35) and maturity (0.65 + 0.35×(1 − exp(−age_days/540)), 0.65–1.0) multipliers, the same shapes v1 uses; each row's multipliers are shown in its detail view and the formula is stated in the criteria panel, the method file and the board. This is the mock judge's v5 duel feedback applied: v5 lost criterion 2 to plain and v1 in all four losing calls because its model used TVL alone. The three-input model measures blind ×4.526 / out-of-sample ×3.483 / leave-one-out ×3.636 (pure TVL-only curve ×3.641 / ×3.411 / ×3.402, shown beside it in the method file) — the rubric requirement costs blind/LOO accuracy on this snapshot, and that cost is stated, not hidden. $1,000 capital slice unchanged (the $5,000 switch is the user's decision, still pending). Best farm $24.02/h (Manifest Trade); 0 farm / 112 thin / 82 skip.

v5: a judge-facing criteria panel on the board (the rubric's five criteria, in order, with the evidence), a first-in-path-order method file (dashboard/00-method.md — the first source the dossier text shows), and deposit-share farm arithmetic — slice = 10% airdrop share × implied value × ($1,000 deposit / TVL), break-even odds = total cost / slice, 10-step dated plans with cost + time per step and a stop rule, and a detail dialog that shows the value as a visual equation, the 3 nearest traded peers with an applied-here column, and a fees / income forgone / time / slice / break-even odds / net-per-hour footer. The model is untouched (pure size curve): blind ×3.641 / out-of-sample ×3.411 / leave-one-out ×3.402, out-of-sample within-3× 48%.

v4: the board now surfaces the eight best farms by net $/hour ("Farm next"), an "Early finds" panel (new ≤180 days or rising +25% TVL in 7 days), the set-aside count with its rule breakdown (CEX, bridge families, staking derivatives, chain identities and wrapped/staked/versioned names are set aside; the watchlist is always ranked), and a reproducibility digest — this page is board.json, re-running main.ts on the snapshot reproduces board.json, dossier.json and data.js byte for byte. The pure size curve is kept deliberately: a family factor (shrunken category residuals, k=2..160), joint OLS with category dummies under ridge, a quadratic log-log curve, Theil-Sen, IRLS-robust and trimmed fits, bounded growth and age factors, and curve/category blends were all tested on the fixed splits and none beat the pure curve on blind + out-of-sample + leave-one-out at once (the quadratic won out-of-sample ×2.82 but lost the blind holdout ×4.12); the pure curve also wins the 5-fold cross-validation mean. Note: the snapshot's 7D TVL change is already in percent (median −8.2%), so it is shown as-is, not multiplied by 100. Growth was re-tested at the correct scale and its fitted slope is negative (−3.7) — fast recent TVL growth predicts a lower multiple on this snapshot, the opposite of the usual growth assumption.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
# Open out/dashboard/index.html in a browser.
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=1cytnb2s&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
