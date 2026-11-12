"""Figures from results/*.pkl. Usage: python3 figs.py"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from an import load, group, ser, endmean, flows

C = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"]
GREY = "#8a8985"
plt.rcParams.update({"font.size": 9, "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True,
                     "grid.color": "#e6e5e1", "grid.linewidth": 0.6, "axes.edgecolor": "#8a8985", "lines.linewidth": 2,
                     "figure.facecolor": "#fcfcfb", "axes.facecolor": "#fcfcfb", "legend.frameon": False})


def have(n):
    return os.path.exists(f"results/{n}.pkl")


def fig_budget():
    g = group(load("e1"))
    labs = list(g)
    parts = [("eaten", "eaten", C[0]), ("feasted", "feasted", C[3]), ("rotted", "rotted", C[7]), ("store", "net change in stores", C[2])]
    fig, ax = plt.subplots(figsize=(7.2, 3.4))
    y = np.arange(len(labs))
    for j, lab in enumerate(labs):
        t = flows(g[lab])
        P = t["f_produced"]
        vals = dict(eaten=(t["f_eaten"] + t["f_kin"] + t["f_lent"] + t["f_patron"]) / P, feasted=t["f_feasted"] / P, rotted=t["f_rotted"] / P)
        vals["store"] = max(0, 1 - sum(vals.values()))
        left = 0
        for k, name, col in parts:
            v = vals[k]
            ax.barh(j, v, left=left, color=col, edgecolor="#fcfcfb", linewidth=2, height=0.7, label=name if j == 0 else None)
            if v > 0.06:
                ax.text(left + v / 2, j, f"{v:.0%}", ha="center", va="center", fontsize=8, color="white" if k != "feasted" else "#0b0b0b")
            left += v
        gap = t["f_hunger_gap"] / t["f_need"]
        ax.text(1.01, j, f"unmet need {gap:.1%}", va="center", fontsize=8, color="#52514e")
    ax.set_yticks(y, [l.replace("feast=True", "feasting on").replace("feast=False", "feasting off").replace("R=", "R ") for l in labs])
    ax.set_xlim(0, 1.25)
    ax.set_xticks([0, .25, .5, .75, 1], ["0", "25%", "50%", "75%", "100%"])
    ax.invert_yaxis()
    ax.set_title("Where the harvest (net of seed) goes, extraction off, years 20-150, 4 seeds", loc="left")
    ax.legend(ncol=4, loc="lower left", bbox_to_anchor=(0, -0.28))
    fig.tight_layout()
    fig.savefig("fig1_budget.png", dpi=150)


def fig_base():
    runs = group(load("e2base"))["base"]
    fig, axs = plt.subplots(2, 2, figsize=(9, 6))
    yrs = np.arange(1, 151)
    for ax, keys, title in [(axs[0, 0], [("gini", "land Gini", C[0]), ("tenancy", "tenancy share (fields)", C[1]), ("landless", "landless households", C[2])], "Concentration, loans on, no brakes (8 seeds)"),
                            (axs[0, 1], [("big15", "estates (>= 15 fields)", C[0]), ("landed_half", "rent >= half of need", C[1]), ("landed_rent", "rent >= need", C[2])], "Landed households per 200, by three rules")]:
        for k, name, col in keys:
            s = ser(runs, k)
            ax.fill_between(yrs, np.percentile(s, 10, 0), np.percentile(s, 90, 0), color=col, alpha=0.15, lw=0)
            ax.plot(yrs, s.mean(0), color=col, label=name)
        ax.set_title(title, loc="left")
        ax.legend(loc="upper left")
        ax.set_xlabel("year")
    axs[0, 1].axhspan(12, 15, color=GREY, alpha=0.15, lw=0)
    axs[0, 1].text(2, 13.5, "target 12-15", fontsize=8, color="#52514e", va="center")
    # Lorenz
    ax = axs[1, 0]
    lz = runs[0]["lorenz"]
    for j, yr in enumerate(sorted(lz)):
        x = np.sort(lz[yr])
        c = np.concatenate([[0], np.cumsum(x) / x.sum()])
        ax.plot(np.linspace(0, 1, len(c)), c, color=C[j], label=f"year {yr}")
    ax.plot([0, 1], [0, 1], color=GREY, lw=1, ls="--")
    ax.set_title("Lorenz curve of land (seed 0)", loc="left")
    ax.set_xlabel("share of households, poorest first")
    ax.set_ylabel("share of fields")
    ax.legend(loc="upper left")
    # trajectories
    ax = axs[1, 1]
    tr = runs[0]["traj"]
    final = {i: v[-1][1] for i, v in tr.items() if v[-1][0] == 150}
    top = sorted(final, key=lambda i: -final[i])[:10]
    cm = plt.get_cmap("viridis")
    for i in top:
        v = tr[i]
        ax.plot([a[0] for a in v], [a[1] for a in v], color=cm(v[-1][2]), lw=1.5)
    ax.axhline(15, color=GREY, lw=1, ls="--")
    ax.set_title("Holdings of the 10 largest at year 150 (colour: generosity)", loc="left")
    ax.set_xlabel("year")
    ax.set_ylabel("fields owned")
    sm = plt.cm.ScalarMappable(cmap=cm)
    fig.colorbar(sm, ax=ax, fraction=0.04, label="generosity 0..1")
    fig.tight_layout()
    fig.savefig("fig2_concentration.png", dpi=150)


def fig_tornado():
    g = group(load("e2sens"))
    lc = group(load("lc"))
    g["lifecycle=False"] = lc["lifecycle=False"]  # rerun with the fixed household at the mean composition
    g["collateral=True"] = lc["collateral"]
    base = group(load("e2base"))["base"]
    b = endmean(base, "big15")
    bg = endmean(base, "gini")
    rows = []
    for lab, runs in g.items():
        rows.append((lab, endmean(runs, "big15") - b, endmean(runs, "gini") - bg))
    rows.sort(key=lambda r: abs(r[1]))
    fig, axs = plt.subplots(1, 2, figsize=(9, 6), sharey=True)
    y = np.arange(len(rows))
    axs[0].barh(y, [r[1] for r in rows], color=[C[0] if r[1] > 0 else C[1] for r in rows], height=0.65)
    axs[1].barh(y, [r[2] for r in rows], color=[C[0] if r[2] > 0 else C[1] for r in rows], height=0.65)
    axs[0].set_yticks(y, [r[0] for r in rows])
    axs[0].set_title(f"Estates per 200 at years 130-150\nchange from base ({b:.1f})", loc="left")
    axs[1].set_title(f"Land Gini at years 130-150\nchange from base ({bg:.2f})", loc="left")
    for ax in axs:
        ax.axvline(0, color=GREY, lw=1)
    fig.suptitle("One-at-a-time sensitivity, loans on, no brakes (4 seeds each)", x=0.01, ha="left")
    fig.tight_layout()
    fig.savefig("fig3_sensitivity.png", dpi=150)
    return rows, b, bg


def fig_regime():
    g = group(load("regime"))
    Rs = (1.2, 1.4, 1.67, 2.0, 2.4)
    ws = (0.05, 0.15, 0.25, 0.35)
    M = np.zeros((len(ws), len(Rs)))
    S = np.zeros_like(M)
    G = np.zeros_like(M)
    for i, w in enumerate(ws):
        for j, R in enumerate(Rs):
            runs = g[f"R={R} wsd={w}"]
            M[i, j] = endmean(runs, "big15")
            s = ser(runs, "big15").mean(0)
            S[i, j] = (s[140:150].mean() - s[90:100].mean()) * 2  # per century
            G[i, j] = endmean(runs, "gini")
    fig, ax = plt.subplots(figsize=(6.4, 4))
    ax.grid(False)
    im = ax.imshow(M, cmap="Blues", origin="lower", aspect="auto", vmin=0, vmax=max(30, M.max()))
    for i in range(len(ws)):
        for j in range(len(Rs)):
            reg = "no elite" if M[i, j] < 5 else ("mass estates" if M[i, j] > 25 else "elite")
            ax.text(j, i, f"{M[i, j]:.0f}  ({S[i, j]:+.0f}/c)\nGini {G[i, j]:.2f}\n{reg}", ha="center", va="center", fontsize=7,
                    color="white" if M[i, j] > 18 else "#0b0b0b")
    ax.set_xticks(range(len(Rs)), [str(r) for r in Rs])
    ax.set_yticks(range(len(ws)), [str(w) for w in ws])
    ax.set_xlabel("food produced / need (R)")
    ax.set_ylabel("village weather sd")
    ax.set_title("Regime map, loans on, no brakes: estates per 200 at years 130-150\n(trend per century, years 95 to 145, noise about +-4; 3 seeds)", loc="left")
    fig.colorbar(im, ax=ax, label="estates per 200")
    fig.tight_layout()
    fig.savefig("fig4_regime.png", dpi=150)
    return M, S, G


def fig_brakes():
    g = group(load("e3single"))
    base = group(load("e2base"))["base"]
    fig, axs = plt.subplots(1, 3, figsize=(11, 3.4), sharey=True)
    yrs = np.arange(1, 151)
    for ax, pref, title in [(axs[0], "partible=", "Partible inheritance (share split)"), (axs[1], "leave=", "Indebted tenants leave (chance/yr)"),
                            (axs[2], "politics=", "Debtors' politics (switch threshold)")]:
        ax.plot(yrs, ser(base, "big15").mean(0), color=GREY, label="no brake")
        labs = [l for l in g if l.startswith(pref) and "split2" not in l]
        for j, l in enumerate(labs):
            ax.plot(yrs, ser(g[l], "big15").mean(0), color=C[j], label=l.split("=")[1])
        ax.axhspan(12, 15, color=GREY, alpha=0.15, lw=0)
        ax.set_title(title, loc="left")
        ax.set_xlabel("year")
        ax.legend(loc="upper left")
    axs[0].set_ylabel("estates (>= 15 fields) per 200")
    fig.tight_layout()
    fig.savefig("fig5_brakes.png", dpi=150)


if __name__ == "__main__":
    fig_budget()
    fig_base()
    if have("e2sens"):
        fig_tornado()
    if have("regime"):
        fig_regime()
    if have("e3single"):
        fig_brakes()


def fig_combo():
    g = group(load("e3combo"))
    pas, pos = (0, 0.5, 1.0), (None, 0.3, 0.2)
    M = np.zeros((3, 3)); S = np.zeros_like(M); G = np.zeros_like(M)
    for i, pa in enumerate(pas):
        for j, po in enumerate(pos):
            runs = g[f"partible={pa} politics={po} leave=0"]
            M[i, j] = endmean(runs, "big15")
            S[i, j] = (ser(runs, "big15")[:, 140:150].mean() - ser(runs, "big15")[:, 90:100].mean()) * 2
            G[i, j] = endmean(runs, "gini")
    fig, ax = plt.subplots(figsize=(5.6, 3.8))
    ax.grid(False)
    im = ax.imshow(M, cmap="Blues", origin="lower", vmin=0, vmax=30, aspect="auto")
    for i in range(3):
        for j in range(3):
            inb = 11 <= M[i, j] <= 16
            ax.text(j, i, f"{M[i, j]:.1f}{'  in band' if inb else ''}\ntrend {S[i, j]:+.0f}/century\nGini {G[i, j]:.2f}", ha="center", va="center",
                    fontsize=8, color="white" if M[i, j] > 18 else "#0b0b0b", fontweight="bold" if inb else "normal")
    ax.set_xticks(range(3), ["no politics", "switch at 30%", "switch at 20%"])
    ax.set_yticks(range(3), ["impartible", "half partible", "fully partible"])
    ax.set_xlabel("debtors' politics: debtor voice share that moves the remedy to labour")
    ax.set_title("Two brakes together: estates per 200, years 130-150 (3 seeds)", loc="left")
    fig.colorbar(im, ax=ax, label="estates per 200")
    fig.tight_layout()
    fig.savefig("fig6_brake_combos.png", dpi=150)


def fig_goodwill():
    g = group(load("e4"))
    labs = list(g)
    big = [endmean(g[l], "big15") for l in labs]
    gin = [endmean(g[l], "gini") for l in labs]
    gb = [np.nanmean([r["summary"]["gen_big"] for r in g[l]]) for l in labs]
    fig, axs = plt.subplots(1, 3, figsize=(11, 3.2), sharey=True)
    y = np.arange(len(labs))
    axs[0].barh(y, big, color=C[0], height=0.6); axs[0].set_title("Estates per 200 (yrs 130-150)", loc="left")
    axs[0].axvspan(12, 15, color=GREY, alpha=0.15, lw=0)
    axs[1].barh(y, gin, color=C[2], height=0.6); axs[1].set_title("Land Gini", loc="left")
    axs[2].barh(y, gb, color=C[3], height=0.6); axs[2].axvline(0.5, color=GREY, lw=1, ls="--")
    axs[2].set_title("Generosity of estate holders (all = 0.5)", loc="left")
    axs[0].set_yticks(y, labs); axs[0].invert_yaxis()
    for ax, v, f in ((axs[0], big, "{:.1f}"), (axs[1], gin, "{:.2f}"), (axs[2], gb, "{:.2f}")):
        for k, x in enumerate(v):
            if x == x:
                ax.text(x, k, " " + f.format(x), va="center", fontsize=8, color="#52514e")
    fig.suptitle("The goodwill economy and patronage, loans on, no brakes (6 seeds)", x=0.01, ha="left")
    fig.tight_layout()
    fig.savefig("fig7_goodwill.png", dpi=150)


def fig_rent():
    g = group(load("e5"))
    rents = (0.1, 0.25, 0.4, 0.5, 0.6)
    fig, axs = plt.subplots(1, 2, figsize=(9.5, 3.4))
    from model import P
    Rr = np.linspace(0, 0.7, 50)
    for R, col in ((1.2, C[1]), (1.67, C[0]), (2.0, C[2])):
        for mul, ls, nm in ((0.98, "-", "median year"), (0.66, "--", "1-in-10 bad year")):
            axs[0].plot(Rr, (1 - Rr) * R * mul, color=col, ls=ls, lw=1.6, label=f"R {R}, {nm}")
    axs[0].axhline(1, color="#0b0b0b", lw=1)
    axs[0].text(0.01, 1.03, "subsistence", fontsize=8)
    axs[0].set_xlabel("rent share of the harvest"); axs[0].set_ylabel("tenant's kept food / need")
    axs[0].set_title("A full tenant on a full holding (analytic)", loc="left")
    axs[0].legend(fontsize=7, ncol=2, loc="upper right")
    for le, col in ((0, C[0]), (0.3, C[1])):
        sh = [endmean(g[f"rent={r} leave={le}"], "tenant_short", 20, 150) for r in rents]
        hu = [endmean(g[f"rent={r} leave={le}"], "hungry", 20, 150) for r in rents]
        axs[1].plot(rents, sh, color=col, marker="o", label=f"tenants short before help, leave {le}")
        axs[1].plot(rents, hu, color=col, marker="s", ls="--", label=f"all households hungry, leave {le}")
    axs[1].set_xlabel("rent share"); axs[1].set_ylabel("share of households")
    axs[1].set_title("Simulated (loans against collateral only, 3 seeds)", loc="left")
    axs[1].legend(fontsize=7)
    fig.tight_layout()
    fig.savefig("fig8_rent_ceiling.png", dpi=150)
