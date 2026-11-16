# signal-token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/mekzibnn/signal-token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/mekzibnn/signal-token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

An offline token launch radar. Implied token values come from a log-log size curve fitted on recorded-token peers and validated three ways (time-split out-of-sample, blind holdout, leave-one-out), with bootstrap bands, a log-log scatter of the fit drawn on the board, and farm plans netted per hands-on hour with farm/thin/skip verdicts, break-even farmer counts and break-even odds. Covers every sealed-snapshot watchlist protocol. Validation is headlined as within-3× with the category baseline beside it, never within-2×.

## Run it

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts --input /path/to/snapshot.json
# Open out/dashboard/index.html in a browser.
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=1cytnb2s&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
