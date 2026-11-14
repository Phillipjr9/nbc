import { useEffect, useMemo, useState } from "react";
import {
  logoNbc,
  pictoCarteCreditRed,
  pictoComptesRed,
  pictoEpargnePlacementsRed,
  pictoOrdinateur,
} from "../assets/nbcAssets";
import {
  balanceAvailability,
  BankAccount,
  ClientPreferences,
  DEFAULT_PREFERENCES,
  BankUserProfile,
  formatMoney,
  ScheduledTransfer,
  transactionNotifications,
} from "../banking/bankingTypes";
import BankCardVisual from "./BankCardVisual";
import { ArrowRight, HelpIcon, LockIcon, SearchIcon } from "./icons";
import TransactionSendOverlay, {
  AnimatedTxPayload,
  AnimatedTxPhase,
} from "./TransactionSendOverlay";

export type DashboardTab =
  | "summary"
  | "transactions"
  | "transfers"
  | "cards"
  | "goals"
  | "documents"
  | "settings";

type Props = {
  profile: BankUserProfile;
  onUpdateProfile: (updater: (prev: BankUserProfile) => BankUserProfile) => void;
  onGoPublicSite: () => void;
  onGoHelp: () => void;
  onSignOut: () => void;
};

export default function Dashboard({
  profile,
  onUpdateProfile: updateProfile,
  onGoPublicSite,
  onGoHelp,
  onSignOut,
}: Props) {
  /** Adds large-transaction alerts whenever a handler writes new ledger entries. */
  const onUpdateProfile = (updater: (prev: BankUserProfile) => BankUserProfile) => {
    updateProfile((prev) => {
      const next = updater(prev);
      if (next === prev || next.transactions === prev.transactions) return next;
      const existing = new Set(prev.transactions.map((t) => t.id));
      const fresh = next.transactions.filter((t) => !existing.has(t.id));
      if (fresh.length === 0) return next;
      const alerts = transactionNotifications(next, fresh);
      if (alerts.length === 0) return next;
      return { ...next, notifications: [...alerts, ...(next.notifications ?? [])] };
    });
  };
  const [tab, setTab] = useState<DashboardTab>("summary");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [tab]);

  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [txQuery, setTxQuery] = useState("");
  const [txCat, setTxCat] = useState<string>("All");
  const [txRange, setTxRange] = useState<"30" | "90" | "ytd" | "all" | "custom">("all");
  const [txFrom, setTxFrom] = useState("");
  const [txTo, setTxTo] = useState("");
  const [txVisible, setTxVisible] = useState(25);
  const [toast, setToast] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifications = profile.notifications ?? [];
  const unread = notifications.filter((n) => !n.read).length;
  const prefs: ClientPreferences = { ...DEFAULT_PREFERENCES, ...(profile.preferences ?? {}) };

  // Transfers & payments sub-navigation
  const [moveMode, setMoveMode] = useState<"internal" | "card" | "etransfer" | "bills" | "deposit">("internal");

  const sourceAccounts = useMemo(
    () => profile.accounts.filter((a) => a.category === "chequing" || a.category === "savings"),
    [profile.accounts]
  );
  const transferLockActive = profile.status === "frozen" || !!profile.transfersPaused;

  // Internal transfer
  const [fromId, setFromId] = useState(sourceAccounts[0]?.id ?? "");
  const [toId, setToId] = useState(profile.accounts[1]?.id ?? "");
  const [transferAmt, setTransferAmt] = useState("250.00");
  const [transferMemo, setTransferMemo] = useState("");

  // Interac e-Transfer
  const [etrSourceId, setEtrSourceId] = useState(sourceAccounts[0]?.id ?? "");
  const [recipientId, setRecipientId] = useState(profile.recipients[0]?.id ?? "");
  const [etrAmt, setEtrAmt] = useState("120.00");
  const [etrMsg, setEtrMsg] = useState("");
  const [newRecName, setNewRecName] = useState("");
  const [newRecEmail, setNewRecEmail] = useState("");

  // Bill payment
  const [billSourceId, setBillSourceId] = useState(sourceAccounts[0]?.id ?? "");
  const [payeeId, setPayeeId] = useState(profile.payees[0]?.id ?? "");
  const [billAmt, setBillAmt] = useState("95.50");
  const [newPayeeName, setNewPayeeName] = useState("");
  const [newPayeeRef, setNewPayeeRef] = useState("");

  // Cheque deposit
  const [depTargetId, setDepTargetId] = useState(sourceAccounts[0]?.id ?? "");
  const [depFrom, setDepFrom] = useState("Revenu Québec — Refund");
  const [depAmt, setDepAmt] = useState("420.00");

  // Card transfer / cash add
  const [cardTxType, setCardTxType] = useState<"transfer" | "cash" | "from-card">("transfer");
  const [cardSourceId, setCardSourceId] = useState(sourceAccounts[0]?.id ?? "");
  const [cardId, setCardId] = useState(profile.cards[0]?.id ?? "");
  const [cardAmt, setCardAmt] = useState("250.00");
  const [cardMemo, setCardMemo] = useState("");

  // Scheduled / recurring transfers
  const [schFromId, setSchFromId] = useState(sourceAccounts[0]?.id ?? "");
  const [schToId, setSchToId] = useState(profile.accounts[1]?.id ?? "");
  const [schAmount, setSchAmount] = useState("250.00");
  const [schFrequency, setSchFrequency] = useState<ScheduledTransfer["frequency"]>("monthly");
  const [schDate, setSchDate] = useState("");
  const [schDesc, setSchDesc] = useState("Automatic savings transfer");

  // Savings goal
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("5000");
  const [goalDeadline, setGoalDeadline] = useState("Dec 2026");

  // Animated transaction overlay
  const [activeAnimatedTx, setActiveAnimatedTx] = useState<AnimatedTxPayload | null>(null);
  const [animatedTxPhase, setAnimatedTxPhase] = useState<AnimatedTxPhase>("verifying");
  const [recentTxIds, setRecentTxIds] = useState<string[]>([]);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 4200);
  };

  const todayIso = () => new Date().toISOString().slice(0, 10);
  const makeReference = (prefix = "NB") =>
    `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowStamp = () =>
    new Date().toLocaleTimeString("en-CA", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const runAnimatedTransaction = (
    payload: AnimatedTxPayload,
    commit: () => string[]
  ) => {
    setActiveAnimatedTx(payload);
    setAnimatedTxPhase("verifying");
    window.setTimeout(() => setAnimatedTxPhase("sending"), 420);
    window.setTimeout(() => {
      const createdIds = commit();
      if (createdIds.length > 0) {
        setRecentTxIds((prev) => [...createdIds, ...prev].slice(0, 10));
      }
      setAnimatedTxPhase("completed");
    }, 1150);
  };

  const accountGroups = useMemo(() => {
    const bank = profile.accounts.filter((a) => a.category === "chequing" || a.category === "savings");
    const creditAndLoans = profile.accounts.filter((a) => a.category === "credit" || a.category === "loan");
    const investments = profile.accounts.filter((a) => a.category === "investment");

    const sumCad = (list: BankAccount[]) =>
      list.reduce((s, a) => s + a.balance * (a.currency === "USD" ? 1.36 : 1), 0);

    return {
      bank,
      bankTotal: sumCad(bank),
      creditAndLoans,
      creditTotal: sumCad(creditAndLoans),
      investments,
      investmentsTotal: sumCad(investments),
    };
  }, [profile.accounts]);

  const rangeBounds = useMemo(() => {
    const today = new Date();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    if (txRange === "all") return { from: "", to: "" };
    if (txRange === "custom") return { from: txFrom, to: txTo };
    if (txRange === "ytd") return { from: `${today.getFullYear()}-01-01`, to: "" };
    const days = txRange === "30" ? 30 : 90;
    const start = new Date(today);
    start.setDate(start.getDate() - days);
    return { from: iso(start), to: "" };
  }, [txRange, txFrom, txTo]);

  const filteredTransactions = useMemo(() => {
    return profile.transactions.filter((tx) => {
      if (selectedAccountId !== "all" && tx.accountId !== selectedAccountId) return false;
      if (txCat !== "All" && tx.category !== txCat) return false;
      if (rangeBounds.from && tx.date < rangeBounds.from) return false;
      if (rangeBounds.to && tx.date > rangeBounds.to) return false;
      if (txQuery.trim() && !tx.description.toLowerCase().includes(txQuery.trim().toLowerCase())) return false;
      return true;
    });
  }, [profile.transactions, selectedAccountId, txCat, txQuery, rangeBounds]);

  /** Net movement for the currently filtered set — used for the insights strip. */
  const filteredTotals = useMemo(() => {
    let moneyIn = 0;
    let moneyOut = 0;
    for (const tx of filteredTransactions) {
      if (tx.amount >= 0) moneyIn += tx.amount;
      else moneyOut += Math.abs(tx.amount);
    }
    return { moneyIn, moneyOut, net: moneyIn - moneyOut };
  }, [filteredTransactions]);

  // Handlers
  const handleInternalTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferLockActive) {
      notify(
        profile.status === "frozen"
          ? "This account is on hold and cannot send transfers."
          : "Outgoing transfers are paused for this account."
      );
      return;
    }
    const amt = Number(transferAmt);
    const src = profile.accounts.find((a) => a.id === fromId);
    const dst = profile.accounts.find((a) => a.id === toId);
    if (!src || !dst || src.id === dst.id) {
      notify("Please select two different accounts.");
      return;
    }
    if (!amt || amt <= 0) {
      notify("Please enter a valid amount.");
      return;
    }
    const srcAvail = balanceAvailability(src, profile.transactions);
    if ((src.category === "chequing" || src.category === "savings") && srcAvail.available < amt) {
      notify(
        `Insufficient available funds in ${src.name}. Available: ${formatMoney(srcAvail.available, src.currency)}.`
      );
      return;
    }

    // Enforce the monthly spend limit on any card linked to the destination credit account.
    const destCard = profile.cards.find((c) => c.linkedAccountId === dst.id);
    if (destCard?.monthlyLimit) {
      const month = new Date().toISOString().slice(0, 7);
      const spentThisMonth = profile.transactions
        .filter((t) => t.accountId === dst.id && t.date.startsWith(month) && t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);
      if (spentThisMonth + amt > destCard.monthlyLimit) {
        notify(
          `This payment exceeds the ${destCard.label} monthly limit of ${formatMoney(
            destCard.monthlyLimit
          )}. Used this month: ${formatMoney(spentThisMonth)}.`
        );
        return;
      }
    }

    const refCode = makeReference("TRF");
    const memoClean = transferMemo.trim();
    const updatedSrcBal = Math.round((src.balance - amt) * 100) / 100;

    runAnimatedTransaction(
      {
        kind: "transfer",
        amount: amt,
        currency: src.currency,
        fromLabel: src.name,
        toLabel: dst.name,
        memo: memoClean || undefined,
        reference: refCode,
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${src.name}: ${formatMoney(updatedSrcBal, src.currency)}`,
      },
      () => {
        const outId = `tx-${Date.now()}-out`;
        const inId = `tx-${Date.now()}-in`;
        onUpdateProfile((prev) => {
          const updatedAccounts = prev.accounts.map((acc) => {
            if (acc.id === src.id) {
              return { ...acc, balance: updatedSrcBal };
            }
            if (acc.id === dst.id) {
              const isDebt = acc.category === "credit" || acc.category === "loan";
              const nextBal = isDebt ? Math.max(0, acc.balance - amt) : acc.balance + amt;
              return { ...acc, balance: Math.round(nextBal * 100) / 100 };
            }
            return acc;
          });

          const note = memoClean ? ` — ${memoClean}` : "";
          return {
            ...prev,
            accounts: updatedAccounts,
            transactions: [
              {
                id: inId,
                accountId: dst.id,
                date: todayIso(),
                description: `Transfer from ${src.name}${note}`,
                category: "Transfer",
                amount: amt,
                status: "Posted",
              },
              {
                id: outId,
                accountId: src.id,
                date: todayIso(),
                description: `Transfer to ${dst.name}${note}`,
                category: "Transfer",
                amount: -amt,
                status: "Posted",
              },
              ...prev.transactions,
            ],
          };
        });
        setTransferMemo("");
        return [inId, outId];
      }
    );
  };

  const handleSendEtransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferLockActive) {
      notify(
        profile.status === "frozen"
          ? "This account is on hold and cannot send transfers."
          : "Outgoing transfers are paused for this account."
      );
      return;
    }
    const amt = Number(etrAmt);
    const src = profile.accounts.find((a) => a.id === etrSourceId) ?? sourceAccounts[0];
    const rec = profile.recipients.find((r) => r.id === recipientId) ?? profile.recipients[0];
    if (!src || !rec) {
      notify("Please select an account and recipient.");
      return;
    }
    if (!amt || amt <= 0 || amt > src.balance) {
      notify("Please enter an amount within your available balance.");
      return;
    }

    const msgClean = etrMsg.trim();
    const updatedBal = Math.round((src.balance - amt) * 100) / 100;

    runAnimatedTransaction(
      {
        kind: "etransfer",
        amount: amt,
        currency: src.currency,
        fromLabel: src.name,
        toLabel: `${rec.name} (${rec.email})`,
        memo: msgClean || undefined,
        reference: makeReference("ETR"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${src.name}: ${formatMoney(updatedBal, src.currency)}`,
      },
      () => {
        const txId = `etr-${Date.now()}`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === src.id ? { ...a, balance: updatedBal } : a
          ),
          transactions: [
            {
              id: txId,
              accountId: src.id,
              date: todayIso(),
              description: `Interac e-Transfer® — ${rec.name}${msgClean ? ` (${msgClean})` : ""}`,
              category: "Transfer",
              amount: -amt,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        setEtrMsg("");
        return [txId];
      }
    );
  };

  const handleAddRecipient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecName.trim() || !newRecEmail.trim()) return;
    const id = `rec-${Date.now()}`;
    onUpdateProfile((prev) => ({
      ...prev,
      recipients: [
        ...prev.recipients,
        { id, name: newRecName.trim(), email: newRecEmail.trim(), bank: "Interac e-Transfer®" },
      ],
    }));
    setRecipientId(id);
    setNewRecName("");
    setNewRecEmail("");
    notify(`Recipient ${newRecName.trim()} added.`);
  };

  const handlePayBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferLockActive) {
      notify(
        profile.status === "frozen"
          ? "This account is on hold and cannot send transfers."
          : "Outgoing transfers are paused for this account."
      );
      return;
    }
    const amt = Number(billAmt);
    const src = profile.accounts.find((a) => a.id === billSourceId) ?? sourceAccounts[0];
    const payee = profile.payees.find((p) => p.id === payeeId) ?? profile.payees[0];
    if (!src || !payee) return;
    if (!amt || amt <= 0 || amt > src.balance) {
      notify("Please enter a valid payment amount within your balance.");
      return;
    }

    const updatedBal = Math.round((src.balance - amt) * 100) / 100;
    runAnimatedTransaction(
      {
        kind: "bill",
        amount: amt,
        currency: src.currency,
        fromLabel: src.name,
        toLabel: `${payee.name} (${payee.accountRef})`,
        reference: makeReference("BIL"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${src.name}: ${formatMoney(updatedBal, src.currency)}`,
      },
      () => {
        const txId = `bill-${Date.now()}`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === src.id ? { ...a, balance: updatedBal } : a
          ),
          payees: prev.payees.map((p) =>
            p.id === payee.id ? { ...p, lastPaid: `${formatMoney(amt)} on ${todayIso()}` } : p
          ),
          transactions: [
            {
              id: txId,
              accountId: src.id,
              date: todayIso(),
              description: `Bill payment — ${payee.name} (${payee.accountRef})`,
              category: "Utilities",
              amount: -amt,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        return [txId];
      }
    );
  };

  const handleAddPayee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPayeeName.trim() || !newPayeeRef.trim()) return;
    const id = `pay-${Date.now()}`;
    onUpdateProfile((prev) => ({
      ...prev,
      payees: [
        ...prev.payees,
        { id, name: newPayeeName.trim(), accountRef: newPayeeRef.trim(), category: "Registered biller" },
      ],
    }));
    setPayeeId(id);
    setNewPayeeName("");
    setNewPayeeRef("");
    notify(`Payee ${newPayeeName.trim()} added.`);
  };

  const handleCardTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (transferLockActive) {
      notify(
        profile.status === "frozen"
          ? "This account is on hold and cannot send transfers."
          : "Outgoing transfers are paused for this account."
      );
      return;
    }

    const amt = Number(cardAmt);
    const card = profile.cards.find((c) => c.id === cardId) ?? profile.cards[0];
    const linked = card ? profile.accounts.find((a) => a.id === card.linkedAccountId) : undefined;
    const targetAccount = profile.accounts.find((a) => a.id === cardSourceId) ?? sourceAccounts[0];

    if (!card || !linked) {
      notify("Select a valid linked card.");
      return;
    }

    if (!targetAccount) {
      notify("Choose an account for this transfer.");
      return;
    }

    if (!amt || amt <= 0) {
      notify("Enter a valid amount to transfer.");
      return;
    }

    const memoClean = cardMemo.trim();

    if (cardTxType === "from-card") {
      if (linked.id === targetAccount.id) {
        notify("Choose a different destination account than the card's linked account.");
        return;
      }
      const updatedLinkedBalance = Math.round((linked.balance - amt) * 100) / 100;
      const updatedTargetBalance = Math.round((targetAccount.balance + amt) * 100) / 100;

      runAnimatedTransaction(
        {
          kind: "transfer",
          amount: amt,
          currency: linked.currency,
          fromLabel: `${card.label} (${linked.name})`,
          toLabel: targetAccount.name,
          memo: memoClean || undefined,
          reference: makeReference("CRD"),
          timestamp: `${todayIso()} · ${nowStamp()}`,
          updatedBalanceLabel: `${targetAccount.name}: ${formatMoney(updatedTargetBalance, targetAccount.currency)}`,
        },
        () => {
          const outTxId = `card-withdraw-${Date.now()}`;
          const inTxId = `card-credit-${Date.now()}`;
          onUpdateProfile((prev) => ({
            ...prev,
            accounts: prev.accounts.map((account) => {
              if (account.id === linked.id) return { ...account, balance: updatedLinkedBalance };
              if (account.id === targetAccount.id) return { ...account, balance: updatedTargetBalance };
              return account;
            }),
            transactions: [
              {
                id: outTxId,
                accountId: linked.id,
                date: todayIso(),
                description: `Funds from ${card.label}${memoClean ? ` — ${memoClean}` : ""}`,
                category: "Transfer",
                amount: -amt,
                status: "Posted",
              },
              {
                id: inTxId,
                accountId: targetAccount.id,
                date: todayIso(),
                description: `Card funds added to ${targetAccount.name}${memoClean ? ` — ${memoClean}` : ""}`,
                category: "Transfer",
                amount: amt,
                status: "Posted",
              },
              ...prev.transactions,
            ],
          }));
          setCardMemo("");
          return [outTxId, inTxId];
        }
      );
      return;
    }

    const src = cardTxType === "cash" ? targetAccount : targetAccount;
    if ((src.category === "chequing" || src.category === "savings") && balanceAvailability(src, profile.transactions).available < amt) {
      notify(
        `There are not enough available funds in ${src.name}. Available: ${formatMoney(
          balanceAvailability(src, profile.transactions).available,
          src.currency
        )}.`
      );
      return;
    }

    const updatedSrcBalance = Math.round((src.balance - amt) * 100) / 100;
    const updatedLinkedBalance = Math.round((linked.balance + amt) * 100) / 100;
    const label = cardTxType === "cash" ? "Cash advance" : "Card transfer";

    runAnimatedTransaction(
      {
        kind: "transfer",
        amount: amt,
        currency: src.currency,
        fromLabel: src.name,
        toLabel: `${card.label} (${linked.name})`,
        memo: memoClean || undefined,
        reference: makeReference("CRD"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${src.name}: ${formatMoney(updatedSrcBalance, src.currency)}`,
      },
      () => {
        const outTxId = `card-out-${Date.now()}`;
        const inTxId = `card-in-${Date.now()}`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((account) => {
            if (account.id === src.id) return { ...account, balance: updatedSrcBalance };
            if (account.id === linked.id) return { ...account, balance: updatedLinkedBalance };
            return account;
          }),
          transactions: [
            {
              id: outTxId,
              accountId: src.id,
              date: todayIso(),
              description: `${label} to ${card.label}${memoClean ? ` — ${memoClean}` : ""}`,
              category: "Transfer",
              amount: -amt,
              status: "Posted",
            },
            {
              id: inTxId,
              accountId: linked.id,
              date: todayIso(),
              description: `${label} • ${card.label}${memoClean ? ` — ${memoClean}` : ""}`,
              category: "Transfer",
              amount: amt,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        setCardMemo("");
        return [outTxId, inTxId];
      }
    );
  };

  const handleChequeDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(depAmt);
    const dst = profile.accounts.find((a) => a.id === depTargetId) ?? sourceAccounts[0];
    if (!dst || !amt || amt <= 0) {
      notify("Please enter a valid cheque amount.");
      return;
    }

    const payerLabel = depFrom.trim() || "Cheque deposit";
    const updatedBal = Math.round((dst.balance + amt) * 100) / 100;

    runAnimatedTransaction(
      {
        kind: "deposit",
        amount: amt,
        currency: dst.currency,
        fromLabel: payerLabel,
        toLabel: dst.name,
        reference: makeReference("DEP"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${dst.name}: ${formatMoney(updatedBal, dst.currency)}`,
      },
      () => {
        const txId = `dep-${Date.now()}`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) =>
            a.id === dst.id ? { ...a, balance: updatedBal } : a
          ),
          transactions: [
            {
              id: txId,
              accountId: dst.id,
              date: todayIso(),
              description: `Cheque deposit — ${payerLabel}`,
              category: "Income",
              amount: amt,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        return [txId];
      }
    );
  };

  const handleDownloadCsv = () => {
    const rows = [
      ["Date", "Account", "Description", "Category", "Withdrawal", "Deposit", "Status"],
      ...filteredTransactions.map((tx) => {
        const acc = profile.accounts.find((a) => a.id === tx.accountId)?.name ?? tx.accountId;
        return [
          tx.date,
          `"${acc.replace(/"/g, '""')}"`,
          `"${tx.description.replace(/"/g, '""')}"`,
          tx.category,
          tx.amount < 0 ? Math.abs(tx.amount).toFixed(2) : "",
          tx.amount >= 0 ? tx.amount.toFixed(2) : "",
          tx.status ?? "Posted",
        ];
      }),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `national-bank-statement-${todayIso()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify("Account statement downloaded (CSV).");
  };

  const toggleCardField = (
    cardId: string,
    field: "locked" | "contactless" | "international" | "onlinePurchases"
  ) => {
    onUpdateProfile((prev) => ({
      ...prev,
      cards: prev.cards.map((c) => (c.id === cardId ? { ...c, [field]: !c[field] } : c)),
    }));
    notify("Card preference saved.");
  };

  const redeemCardRewards = (cardId: string) => {
    const card = profile.cards.find((c) => c.id === cardId);
    if (!card || !card.rewardsPoints || card.rewardsPoints < 5000) {
      notify("A minimum of 5,000 points is required to redeem a statement credit.");
      return;
    }
    const ptsToRedeem = Math.min(card.rewardsPoints, 10000);
    const creditValue = ptsToRedeem / 100;
    const linked = profile.accounts.find((a) => a.id === card.linkedAccountId);

    runAnimatedTransaction(
      {
        kind: "rewards",
        amount: creditValue,
        fromLabel: `${ptsToRedeem.toLocaleString()} rewards points`,
        toLabel: card.label,
        reference: makeReference("REW"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: linked
          ? `${card.label}: ${formatMoney(Math.max(0, linked.balance - creditValue))}`
          : undefined,
      },
      () => {
        const txId = `rew-${Date.now()}`;
        onUpdateProfile((prev) => ({
          ...prev,
          cards: prev.cards.map((c) =>
            c.id === cardId ? { ...c, rewardsPoints: (c.rewardsPoints ?? 0) - ptsToRedeem } : c
          ),
          accounts: prev.accounts.map((a) =>
            a.id === card.linkedAccountId
              ? { ...a, balance: Math.max(0, Math.round((a.balance - creditValue) * 100) / 100) }
              : a
          ),
          transactions: [
            {
              id: txId,
              accountId: card.linkedAccountId,
              date: todayIso(),
              description: `Rewards credit (${ptsToRedeem.toLocaleString()} pts)`,
              category: "Income",
              amount: creditValue,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        return [txId];
      }
    );
  };

  const contributeToGoal = (goalId: string, amount: number) => {
    const goal = profile.goals.find((g) => g.id === goalId);
    const chk = sourceAccounts[0];
    if (!goal || !chk) return;
    if (chk.balance < amount) {
      notify(`Insufficient funds in ${chk.name}.`);
      return;
    }

    const updatedGoalTotal = goal.current + amount;
    runAnimatedTransaction(
      {
        kind: "goal",
        amount,
        currency: chk.currency,
        fromLabel: chk.name,
        toLabel: goal.title,
        reference: makeReference("SAV"),
        timestamp: `${todayIso()} · ${nowStamp()}`,
        updatedBalanceLabel: `${formatMoney(updatedGoalTotal)} of ${formatMoney(goal.target)}`,
      },
      () => {
        const txId = `goal-tx-${Date.now()}`;
        onUpdateProfile((prev) => ({
          ...prev,
          accounts: prev.accounts.map((a) => {
            if (a.id === chk.id) return { ...a, balance: Math.round((a.balance - amount) * 100) / 100 };
            if (a.id === goal.linkedAccountId && goal.linkedAccountId !== chk.id) {
              return { ...a, balance: Math.round((a.balance + amount) * 100) / 100 };
            }
            return a;
          }),
          goals: prev.goals.map((g) => (g.id === goalId ? { ...g, current: updatedGoalTotal } : g)),
          transactions: [
            {
              id: txId,
              accountId: chk.id,
              date: todayIso(),
              description: `Savings transfer — ${goal.title}`,
              category: "Transfer",
              amount: -amount,
              status: "Posted",
            },
            ...prev.transactions,
          ],
        }));
        return [txId];
      }
    );
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const t = Number(goalTarget);
    if (!goalTitle.trim() || !t || t <= 0) return;
    const sav = profile.accounts.find((a) => a.category === "savings") ?? sourceAccounts[0];
    onUpdateProfile((prev) => ({
      ...prev,
      goals: [
        ...prev.goals,
        {
          id: `goal-${Date.now()}`,
          title: goalTitle.trim(),
          target: t,
          current: 0,
          deadline: goalDeadline.trim() || "Dec 2026",
          linkedAccountId: sav?.id ?? "",
        },
      ],
    }));
    setGoalTitle("");
    notify(`Savings goal "${goalTitle.trim()}" created.`);
  };

  const inspectAccount = (acc: BankAccount) => {
    setSelectedAccountId(acc.id);
    setTab("transactions");
  };

  const primaryChequing = sourceAccounts[0] ?? profile.accounts[0];

  return (
    <div className="flex-1 bg-[#f8f6f1] pb-14">
      {/* Top Dark Utility Bar — Exact match to nbc.ca */}
      <div className="bg-nbc-topbar text-white">
        <div className="nbc-container flex h-[52px] items-center justify-between gap-4 text-[13.5px]">
          <div className="flex h-full items-center">
            <span className="flex h-full items-center bg-white/15 px-4 font-medium text-white">
              Personal
            </span>
            <button
              type="button"
              onClick={onGoPublicSite}
              className="flex h-full items-center px-4 text-white/90 transition hover:bg-white/10 hover:text-white"
            >
              nbc.ca Home
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  if (!notifOpen && unread > 0) {
                    onUpdateProfile((prev) => ({
                      ...prev,
                      notifications: (prev.notifications ?? []).map((n) => ({ ...n, read: true })),
                    }));
                  }
                }}
                aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
                aria-expanded={notifOpen}
                className="relative inline-flex items-center gap-1.5 text-white/90 transition hover:text-white"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4" aria-hidden>
                  <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.7 20a2 2 0 0 1-3.4 0" strokeLinecap="round" />
                </svg>
                <span className="hidden sm:inline">Alerts</span>
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-nbc-red px-1 text-[10px] font-bold text-white sm:-right-2">
                    {unread}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[300px] max-w-[85vw] overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white text-[#333] shadow-xl">
                  <div className="flex items-center justify-between border-b border-[#ececec] px-3.5 py-2.5">
                    <p className="text-[12.5px] font-bold text-nbc-navy">Notifications</p>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-[11.5px] font-semibold text-[#1572C5] hover:underline"
                    >
                      Close
                    </button>
                  </div>
                  <ul className="nice-scroll max-h-[300px] divide-y divide-[#efefef] overflow-y-auto">
                    {notifications.map((n) => (
                      <li key={n.id} className="px-3.5 py-2.5">
                        <p className="text-[12.5px] font-semibold text-[#121212]">{n.title}</p>
                        <p className="mt-0.5 text-[11.5px] leading-[17px] text-[#565656]">{n.body}</p>
                        <p className="mt-0.5 text-[10.5px] text-[#999]">{n.createdAt}</p>
                      </li>
                    ))}
                    {notifications.length === 0 && (
                      <li className="px-3.5 py-6 text-center text-[12px] text-[#777]">You have no notifications.</li>
                    )}
                  </ul>
                  <div className="border-t border-[#ececec] bg-[#faf8f3] px-3.5 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        setTab("settings");
                      }}
                      className="text-[11.5px] font-semibold text-[#1572C5] hover:underline"
                    >
                      Manage alert preferences
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onGoHelp}
              className="inline-flex items-center gap-1.5 text-white/90 transition hover:text-white"
            >
              <HelpIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Help centre</span>
            </button>
            <span className="hidden h-4 w-px bg-white/25 sm:inline-block" />
            <span className="hidden text-[13px] text-white/90 md:inline">
              {profile.fullName}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex h-8 flex-none items-center gap-1.5 whitespace-nowrap rounded-full border border-white bg-nbc-red px-3 text-[12.5px] font-semibold text-white transition hover:bg-nbc-red-dark sm:gap-2 sm:px-3.5 sm:text-[13px]"
            >
              <LockIcon className="h-3.5 w-3.5 flex-none" />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* White Main Navigation Bar — Exact match to nbc.ca */}
      <header className="sticky top-0 z-40 border-b border-[#e5e5e5] bg-white">
        <div className="nbc-container flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 py-3 lg:py-0">
            <button
              type="button"
              onClick={() => setTab("summary")}
              aria-label="Online Bank Home"
              className="flex items-center py-2"
            >
              <img src={logoNbc} alt="National Bank" width={155} height={50} className="h-[38px] w-auto lg:h-[44px]" />
            </button>

            <nav aria-label="Online bank navigation" className="hidden lg:block">
              <ul className="flex items-center">
                {(
                  [
                    ["summary", "Accounts"],
                    ["transactions", "Transactions"],
                    ["transfers", "Transfers & bills"],
                    ["cards", "Cards"],
                    ["goals", "Savings goals"],
                    ["documents", "Statements & void cheque"],
                    ["settings", "Profile & settings"],
                  ] as [DashboardTab, string][]
                ).map(([id, label]) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setTab(id)}
                      className={`border-b-[3px] px-3.5 py-[26px] text-[14px] leading-[20px] transition ${
                        tab === id
                          ? "border-nbc-red font-semibold text-nbc-navy"
                          : "border-transparent text-[#565656] hover:text-nbc-navy"
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex items-center gap-2 py-3 lg:py-0">
            <button
              type="button"
              onClick={() => {
                setMoveMode("etransfer");
                setTab("transfers");
              }}
              className="hidden rounded-full border border-[#cfc9bc] bg-white px-4 py-2 text-[13.5px] font-semibold text-nbc-navy transition hover:border-nbc-navy sm:inline-flex"
            >
              Interac e-Transfer®
            </button>
            <button
              type="button"
              onClick={() => {
                setMoveMode("internal");
                setTab("transfers");
              }}
              className="rounded-full bg-nbc-red px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-nbc-red-dark sm:px-4 sm:text-[13.5px]"
            >
              Transfer or pay
            </button>
          </div>
        </div>

        {/* Mobile horizontal tabs */}
        <div className="lg:hidden"><div className="scroll-tabs border-t border-[#efefef] px-2">
          {(
            [
              ["summary", "Accounts"],
              ["transactions", "Transactions"],
              ["transfers", "Transfers & bills"],
              ["cards", "Cards"],
              ["goals", "Savings goals"],
              ["documents", "Documents"],
              ["settings", "Settings"],
            ] as [DashboardTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`whitespace-nowrap border-b-[3px] px-3 py-3 text-[13.5px] transition ${
                tab === id
                  ? "border-nbc-red font-semibold text-nbc-navy"
                  : "border-transparent text-[#565656]"
              }`}
            >
              {label}
            </button>
          ))}
          </div>
        </div>
      </header>

      {/* Transaction Sending & Receipt Overlay */}
      <TransactionSendOverlay
        tx={activeAnimatedTx}
        phase={animatedTxPhase}
        onClose={() => setActiveAnimatedTx(null)}
        onViewActivity={() => {
          setActiveAnimatedTx(null);
          setSelectedAccountId("all");
          setTxCat("All");
          setTxQuery("");
          setTab("transactions");
        }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-[6px] bg-nbc-navy px-5 py-3 text-[13.5px] font-medium text-white shadow-lg animate-fade-up">
          {toast}
        </div>
      )}

      <main className="nbc-container pt-8">
        {(profile.status === "frozen" || profile.transfersPaused) && (
          <div className="mb-6 rounded-[6px] border border-[#f1b0b7] bg-[#fff5f5] px-5 py-4 text-[14px] text-[#842029]">
            <strong className="font-semibold">Account notice:</strong>{" "}
            {profile.status === "frozen"
              ? "Outgoing transfers are temporarily restricted on this profile. Please contact Client Services at 1-888-835-6281."
              : profile.transferPauseReason ?? "Outgoing transfers are paused pending review. Please contact Client Services at 1-888-835-6281."}
          </div>
        )}

        {/* Last sign-in banner — standard security disclosure */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[#e5e2da] bg-[#fcfbf8] px-4 py-2.5 text-[12.5px] text-[#565656]">
          <span>
            Last sign-in:{" "}
            <strong className="font-semibold text-[#333]">
              {profile.lastLogin ?? "First sign-in on this device"}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setTab("settings")}
            className="font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
          >
            Review your security preferences
          </button>
        </div>

        {/* TAB 1: REALISTIC CANADIAN PERSONAL ACCOUNTS SUMMARY */}
        {tab === "summary" && (
          <div>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-bold leading-[34px] text-nbc-navy sm:text-[32px]">
                  Hello, {profile.fullName.split(" ")[0]}
                </h1>
                <p className="mt-1 text-[14px] text-[#565656]">
                  {profile.branchName} · Client since {profile.memberSince}
                </p>
              </div>
              <p className="text-[13px] text-[#565656]">
                Balances in Canadian dollars unless noted
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              {/* Left 8 Columns: Grouped Account Tables */}
              <div className="space-y-6 lg:col-span-8">
                {/* Group 1: Bank Accounts */}
                <section className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                  <div className="flex items-center justify-between border-b border-[#ece8df] bg-[#fcfbf8] px-5 py-4">
                    <div className="flex items-center gap-3">
                      <img src={pictoComptesRed} alt="" aria-hidden className="h-7 w-7 object-contain" />
                      <h2 className="text-[18px] font-bold text-nbc-navy">Bank accounts</h2>
                    </div>
                    <div className="text-right">
                      <span className="block text-[11.5px] text-[#565656]">Total</span>
                      <span className="font-bold tabular-nums text-[16px] text-nbc-navy">
                        {formatMoney(accountGroups.bankTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-[#efefef]">
                    {accountGroups.bank.map((acc) => (
                      <div
                        key={acc.id}
                        className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#faf8f3]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => inspectAccount(acc)}
                              className="text-left text-[16px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:text-[#105797] hover:no-underline"
                            >
                              {acc.name}
                            </button>
                            {acc.rate && (
                              <span className="text-[12.5px] font-medium text-[#00314d]">
                                · {acc.rate}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[13px] text-[#565656]">
                            {acc.number} · {acc.subtitle}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
                            <button
                              type="button"
                              onClick={() => inspectAccount(acc)}
                              className="font-medium text-[#1572C5] hover:underline"
                            >
                              Transactions
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFromId(acc.id);
                                setMoveMode("internal");
                                setTab("transfers");
                              }}
                              className="font-medium text-[#1572C5] hover:underline"
                            >
                              Transfer
                            </button>
                            <button
                              type="button"
                              onClick={() => setTab("documents")}
                              className="font-medium text-[#1572C5] hover:underline"
                            >
                              Direct deposit info
                            </button>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[19px] font-bold tabular-nums text-[#121212]">
                            {formatMoney(balanceAvailability(acc, profile.transactions).available, acc.currency)}
                          </p>
                          <span className="text-[12px] text-[#565656]">Available balance</span>
                          {(() => {
                            const av = balanceAvailability(acc, profile.transactions);
                            if (Math.abs(av.pendingNet) < 0.01) return null;
                            return (
                              <span className="block text-[11.5px] text-[#8a6d3b]">
                                {formatMoney(av.current, acc.currency)} current ·{" "}
                                {formatMoney(Math.abs(av.pendingNet), acc.currency)} on hold
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Group 2: Credit Cards & Financing */}
                {accountGroups.creditAndLoans.length > 0 && (
                  <section className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between border-b border-[#ece8df] bg-[#fcfbf8] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img src={pictoCarteCreditRed} alt="" aria-hidden className="h-7 w-7 object-contain" />
                        <h2 className="text-[18px] font-bold text-nbc-navy">Credit cards and borrowing</h2>
                      </div>
                      <div className="text-right">
                        <span className="block text-[11.5px] text-[#565656]">Balance owing</span>
                        <span className="font-bold tabular-nums text-[16px] text-nbc-navy">
                          {formatMoney(accountGroups.creditTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-[#efefef]">
                      {accountGroups.creditAndLoans.map((acc) => (
                        <div
                          key={acc.id}
                          className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#faf8f3]"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => inspectAccount(acc)}
                                className="text-left text-[16px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:text-[#105797] hover:no-underline"
                              >
                                {acc.name}
                              </button>
                              {acc.rate && (
                                <span className="text-[12.5px] text-[#565656]">· {acc.rate}</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[13px] text-[#565656]">
                              {acc.number} · {acc.subtitle}
                            </p>
                            <div className="mt-2 flex items-center gap-4 text-[12.5px]">
                              <button
                                type="button"
                                onClick={() => {
                                  setToId(acc.id);
                                  setMoveMode("internal");
                                  setTab("transfers");
                                }}
                                className="font-medium text-[#1572C5] hover:underline"
                              >
                                Make a payment
                              </button>
                              {acc.category === "credit" && (
                                <button
                                  type="button"
                                  onClick={() => setTab("cards")}
                                  className="font-medium text-[#1572C5] hover:underline"
                                >
                                  Card controls
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <p className="text-[19px] font-bold tabular-nums text-[#121212]">
                              {formatMoney(acc.balance, acc.currency)}
                            </p>
                            <span className="text-[12px] text-[#565656]">Current balance</span>
                            <span className="block text-[11.5px] text-[#105797]">
                              {formatMoney(
                                Math.max(0, (acc.limit ?? 0) - balanceAvailability(acc, profile.transactions).available),
                                acc.currency
                              )}{" "}
                              available credit
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Group 3: Investments */}
                {accountGroups.investments.length > 0 && (
                  <section className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <div className="flex items-center justify-between border-b border-[#ece8df] bg-[#fcfbf8] px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img src={pictoEpargnePlacementsRed} alt="" aria-hidden className="h-7 w-7 object-contain" />
                        <h2 className="text-[18px] font-bold text-nbc-navy">Savings and investments</h2>
                      </div>
                      <div className="text-right">
                        <span className="block text-[11.5px] text-[#565656]">Market value</span>
                        <span className="font-bold tabular-nums text-[16px] text-nbc-navy">
                          {formatMoney(accountGroups.investmentsTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-[#efefef]">
                      {accountGroups.investments.map((acc) => (
                        <div
                          key={acc.id}
                          className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#faf8f3]"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => inspectAccount(acc)}
                                className="text-left text-[16px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:text-[#105797] hover:no-underline"
                              >
                                {acc.name}
                              </button>
                              {acc.rate && (
                                <span className="text-[12.5px] font-medium text-[#017a33]">· {acc.rate}</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-[13px] text-[#565656]">
                              {acc.number} · {acc.subtitle}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[19px] font-bold tabular-nums text-[#121212]">
                              {formatMoney(acc.balance, acc.currency)}
                            </p>
                            <span className="text-[12px] text-[#565656]">Portfolio value</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Recent Transactions Table */}
                <section className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                  <div className="flex items-center justify-between border-b border-[#ece8df] px-5 py-4">
                    <h2 className="text-[18px] font-bold text-nbc-navy">Latest posted transactions</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAccountId("all");
                        setTab("transactions");
                      }}
                      className="text-[14px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:text-[#105797] hover:no-underline"
                    >
                      View all transactions
                    </button>
                  </div>
                  {/* Compact Mobile Transaction List (fits 100% width — no horizontal scroll) */}
                  <ul className="divide-y divide-[#f1f1f1] sm:hidden">
                    {profile.transactions.slice(0, 6).map((tx) => {
                      const acc = profile.accounts.find((a) => a.id === tx.accountId);
                      const isNew = recentTxIds.includes(tx.id);
                      return (
                        <li
                          key={tx.id}
                          className={`flex items-start justify-between gap-3 px-3.5 py-2.5 ${
                            isNew ? "animate-tx-row-new" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-[13px] font-medium leading-[18px] text-[#121212]">
                              {tx.description}
                            </p>
                            <p className="mt-0.5 truncate text-[11.5px] text-[#666]">
                              <span className="tabular-nums">{tx.date}</span> · {acc?.name ?? tx.accountId}
                            </p>
                          </div>
                          <span
                            className={`flex-none whitespace-nowrap pt-0.5 text-right text-[13px] font-semibold tabular-nums ${
                              tx.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"
                            }`}
                          >
                            {tx.amount >= 0
                              ? `+${formatMoney(tx.amount, acc?.currency ?? "CAD")}`
                              : formatMoney(tx.amount, acc?.currency ?? "CAD")}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Tablet & Desktop Multi-Column Table */}
                  <div className="hidden sm:block">
                    <table className="w-full table-fixed text-left text-[13.5px]">
                      <thead className="border-b border-[#ececec] bg-[#faf9f6] text-[12px] font-semibold text-[#565656]">
                        <tr>
                          <th className="w-[112px] px-5 py-3">Date</th>
                          <th className="px-5 py-3">Description</th>
                          <th className="hidden w-[190px] px-5 py-3 md:table-cell">Account</th>
                          <th className="w-[125px] px-5 py-3 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f1f1f1]">
                        {profile.transactions.slice(0, 6).map((tx) => {
                          const acc = profile.accounts.find((a) => a.id === tx.accountId);
                          const isNew = recentTxIds.includes(tx.id);
                          return (
                            <tr
                              key={tx.id}
                              className={`hover:bg-[#faf8f3] ${isNew ? "animate-tx-row-new" : ""}`}
                            >
                              <td className="whitespace-nowrap px-5 py-3 tabular-nums text-[#565656]">
                                {tx.date}
                              </td>
                              <td className="break-words px-5 py-3 font-medium text-[#121212]">
                                {tx.description}
                                <span className="mt-0.5 block text-[12px] font-normal text-[#777] md:hidden">
                                  {acc?.name ?? tx.accountId}
                                </span>
                              </td>
                              <td className="hidden truncate px-5 py-3 text-[13px] text-[#565656] md:table-cell">
                                {acc?.name ?? tx.accountId}
                              </td>
                              <td
                                className={`whitespace-nowrap px-5 py-3 text-right font-semibold tabular-nums ${
                                  tx.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"
                                }`}
                              >
                                {tx.amount >= 0
                                  ? `+${formatMoney(tx.amount, acc?.currency ?? "CAD")}`
                                  : formatMoney(tx.amount, acc?.currency ?? "CAD")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              {/* Right 4 Columns: Practical Everyday Sidebar */}
              <aside className="space-y-6 lg:col-span-4">
                {/* Everyday Transactions Box */}
                <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                  <h2 className="text-[18px] font-bold text-nbc-navy">Everyday transactions</h2>
                  <ul className="mt-3 divide-y divide-[#efefef] text-[14.5px]">
                    {[
                      {
                        label: "Send an Interac e-Transfer®",
                        onClick: () => {
                          setMoveMode("etransfer");
                          setTab("transfers");
                        },
                      },
                      {
                        label: "Pay a bill",
                        onClick: () => {
                          setMoveMode("bills");
                          setTab("transfers");
                        },
                      },
                      {
                        label: "Transfer between my accounts",
                        onClick: () => {
                          setMoveMode("internal");
                          setTab("transfers");
                        },
                      },
                      {
                        label: "Deposit a cheque",
                        onClick: () => {
                          setMoveMode("deposit");
                          setTab("transfers");
                        },
                      },
                      {
                        label: "Void cheque & direct deposit",
                        onClick: () => setTab("documents"),
                      },
                    ].map((action) => (
                      <li key={action.label}>
                        <button
                          type="button"
                          onClick={action.onClick}
                          className="group flex w-full items-center justify-between py-3 text-left font-medium text-[#1572C5] transition hover:text-[#105797]"
                        >
                          <span className="underline decoration-transparent underline-offset-2 group-hover:decoration-current">
                            {action.label}
                          </span>
                          <ArrowRight className="h-3 w-3 text-[#7a7a7a] transition group-hover:translate-x-0.5 group-hover:text-[#105797]" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Primary Card Box */}
                {profile.cards[0] && (
                  <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <div className="mb-3.5 flex items-center justify-between">
                      <h2 className="text-[18px] font-bold text-nbc-navy">Your card</h2>
                      <button
                        type="button"
                        onClick={() => setTab("cards")}
                        className="text-[13.5px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                      >
                        Manage cards
                      </button>
                    </div>
                    <BankCardVisual card={profile.cards[0]} holderName={profile.fullName} compact />
                  </div>
                )}

                {/* Branch & Advisor Box */}
                <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                  <div className="flex items-start gap-3.5">
                    <img src={pictoOrdinateur} alt="" aria-hidden className="h-11 w-11 flex-none object-contain" />
                    <div>
                      <h2 className="text-[17px] font-bold text-nbc-navy">Your advisor & branch</h2>
                      <p className="mt-1 text-[14px] font-medium text-[#121212]">{profile.advisorName}</p>
                      <p className="mt-0.5 text-[13px] text-[#565656]">{profile.branchName}</p>
                      <button
                        type="button"
                        onClick={onGoHelp}
                        className="mt-3 inline-block text-[14px] font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:text-[#105797] hover:no-underline"
                      >
                        Book an appointment
                      </button>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        )}

        {/* TAB 2: TRANSACTIONS & STATEMENT LEDGER */}
        {tab === "transactions" && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="text-[28px] font-bold text-nbc-navy">Transaction history</h1>
                <p className="mt-1 text-[14px] text-[#565656]">
                  Filter by account, category, or merchant description
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadCsv}
                className="rounded-full border border-nbc-navy bg-white px-5 py-2 text-[13.5px] font-semibold text-nbc-navy transition hover:bg-nbc-navy hover:text-white"
              >
                Download CSV statement
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 rounded-[6px] border border-[#e5e2da] bg-white p-4">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="rounded-[6px] border border-[#c9c3b6] bg-white px-3.5 py-2 text-[14px] font-medium text-nbc-navy"
              >
                <option value="all">All accounts ({profile.transactions.length})</option>
                {profile.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {formatMoney(a.balance, a.currency)}
                  </option>
                ))}
              </select>

              <select
                value={txCat}
                onChange={(e) => setTxCat(e.target.value)}
                className="rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2 text-[14px] text-nbc-navy"
              >
                {[
                  "All",
                  "Income",
                  "Transfer",
                  "Groceries",
                  "Dining",
                  "Utilities",
                  "Shopping",
                  "Housing",
                  "Investments",
                ].map((c) => (
                  <option key={c} value={c}>
                    Category: {c}
                  </option>
                ))}
              </select>

              <div className="relative flex-1 min-w-[200px]">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]" />
                <input
                  type="text"
                  value={txQuery}
                  onChange={(e) => setTxQuery(e.target.value)}
                  placeholder="Search description…"
                  className="w-full rounded-[6px] border border-[#c9c3b6] py-2 pl-9 pr-3 text-[14px] text-nbc-navy"
                />
              </div>
            </div>

            {/* Statement period */}
            <div className="flex flex-wrap items-center gap-2 rounded-[6px] border border-[#e5e2da] bg-white p-3.5">
              <span className="text-[12.5px] font-semibold text-[#565656]">Period:</span>
              {([
                ["30", "Last 30 days"],
                ["90", "Last 90 days"],
                ["ytd", "Year to date"],
                ["all", "All history"],
                ["custom", "Custom"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTxRange(value);
                    setTxVisible(25);
                  }}
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold transition ${
                    txRange === value
                      ? "bg-nbc-navy text-white"
                      : "bg-[#f4f1ea] text-nbc-navy hover:bg-[#e8e3d8]"
                  }`}
                >
                  {label}
                </button>
              ))}
              {txRange === "custom" && (
                <span className="flex flex-wrap items-center gap-1.5">
                  <input
                    type="date"
                    value={txFrom}
                    onChange={(e) => setTxFrom(e.target.value)}
                    aria-label="From date"
                    className="rounded-[6px] border border-[#c9c3b6] px-2.5 py-1.5 text-[13px] text-nbc-navy"
                  />
                  <span className="text-[12px] text-[#777]">to</span>
                  <input
                    type="date"
                    value={txTo}
                    onChange={(e) => setTxTo(e.target.value)}
                    aria-label="To date"
                    className="rounded-[6px] border border-[#c9c3b6] px-2.5 py-1.5 text-[13px] text-nbc-navy"
                  />
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedAccountId("all");
                  setTxCat("All");
                  setTxQuery("");
                  setTxRange("90");
                  setTxFrom("");
                  setTxTo("");
                  setTxVisible(25);
                }}
                className="ml-auto rounded-full border border-[#c9c3b6] px-3 py-1 text-[12px] font-semibold text-nbc-navy hover:border-nbc-navy"
              >
                Clear filters
              </button>
            </div>

            {/* Money in / out for the selected period */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[6px] border border-[#e5e2da] bg-white px-4 py-3">
                <p className="text-[11.5px] text-[#777]">Money in</p>
                <p className="mt-0.5 text-[17px] font-bold tabular-nums text-[#017a33]">
                  {formatMoney(filteredTotals.moneyIn)}
                </p>
              </div>
              <div className="rounded-[6px] border border-[#e5e2da] bg-white px-4 py-3">
                <p className="text-[11.5px] text-[#777]">Money out</p>
                <p className="mt-0.5 text-[17px] font-bold tabular-nums text-[#121212]">
                  {formatMoney(filteredTotals.moneyOut)}
                </p>
              </div>
              <div className="rounded-[6px] border border-[#e5e2da] bg-white px-4 py-3">
                <p className="text-[11.5px] text-[#777]">Net change</p>
                <p
                  className={`mt-0.5 text-[17px] font-bold tabular-nums ${
                    filteredTotals.net >= 0 ? "text-[#017a33]" : "text-nbc-red"
                  }`}
                >
                  {filteredTotals.net >= 0 ? "+" : ""}
                  {formatMoney(filteredTotals.net)}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
              {/* Compact Mobile Statement List (zero horizontal scroll) */}
              <div className="sm:hidden">
                <div className="flex items-center justify-between border-b border-[#e5e2da] bg-[#fcfbf8] px-3.5 py-2.5 text-[11.5px] font-semibold text-[#565656]">
                  <span>Transaction</span>
                  <span>Amount</span>
                </div>
                {filteredTransactions.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-[#565656]">
                    No transactions match your search criteria.
                  </p>
                ) : (
                  <ul className="divide-y divide-[#efefef]">
                    {filteredTransactions.slice(0, txVisible).map((tx) => {
                      const acc = profile.accounts.find((a) => a.id === tx.accountId);
                      const isNew = recentTxIds.includes(tx.id);
                      return (
                        <li
                          key={tx.id}
                          className={`flex items-start justify-between gap-3 px-3.5 py-2.5 ${
                            isNew ? "animate-tx-row-new" : ""
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-[13px] font-medium leading-[18px] text-[#121212]">
                              {tx.description}
                            </p>
                            <p className="mt-0.5 truncate text-[11.5px] text-[#666]">
                              <span className="tabular-nums">{tx.date}</span> · {tx.category} · {acc?.name ?? tx.accountId}
                            </p>
                          </div>
                          <div className="flex-none pt-0.5 text-right">
                            <span
                              className={`block whitespace-nowrap text-[13px] font-semibold tabular-nums ${
                                tx.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"
                              }`}
                            >
                              {tx.amount >= 0
                                ? `+${formatMoney(tx.amount, acc?.currency ?? "CAD")}`
                                : formatMoney(tx.amount, acc?.currency ?? "CAD")}
                            </span>
                            <span className="block text-[10.5px] text-[#777]">
                              {tx.amount >= 0 ? "Deposit" : "Withdrawal"}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Tablet & Desktop Statement Table */}
              <div className="hidden sm:block">
                <table className="w-full table-fixed text-left text-[14px]">
                  <thead className="border-b border-[#e5e2da] bg-[#fcfbf8] text-[12px] font-semibold text-[#565656]">
                    <tr>
                      <th className="w-[112px] px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Description</th>
                      <th className="hidden w-[180px] px-5 py-3.5 md:table-cell">Account</th>
                      <th className="w-[128px] px-5 py-3.5 text-right">Withdrawal ($)</th>
                      <th className="w-[120px] px-5 py-3.5 text-right">Deposit ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efefef]">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-[#565656]">
                          No transactions match your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.slice(0, txVisible).map((tx) => {
                        const acc = profile.accounts.find((a) => a.id === tx.accountId);
                        const isNew = recentTxIds.includes(tx.id);
                        return (
                          <tr
                            key={tx.id}
                            className={`hover:bg-[#faf8f3] ${isNew ? "animate-tx-row-new" : ""}`}
                          >
                            <td className="whitespace-nowrap px-5 py-3.5 tabular-nums text-[#565656]">
                              {tx.date}
                            </td>
                            <td className="break-words px-5 py-3.5 font-medium text-[#121212]">
                              {tx.description}
                              <span className="ml-2 text-[12px] font-normal text-[#777]">
                                · {tx.category}
                              </span>
                              <span className="mt-0.5 block text-[12px] font-normal text-[#777] md:hidden">
                                {acc?.name ?? tx.accountId}
                              </span>
                            </td>
                            <td className="hidden truncate px-5 py-3.5 text-[13px] text-[#565656] md:table-cell">
                              {acc?.name ?? tx.accountId}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-[#121212]">
                              {tx.amount < 0 ? formatMoney(Math.abs(tx.amount), acc?.currency ?? "CAD") : "—"}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-semibold tabular-nums text-[#017a33]">
                              {tx.amount >= 0 ? formatMoney(tx.amount, acc?.currency ?? "CAD") : "—"}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {filteredTransactions.length > txVisible && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#efefef] px-4 py-3">
                  <p className="text-[12px] text-[#565656]">
                    Showing {txVisible} of {filteredTransactions.length} entries
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTxVisible((v) => Math.min(v + 25, filteredTransactions.length))}
                      className="rounded-full border border-[#c9c3b6] px-3.5 py-1.5 text-[12.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
                    >
                      Show 25 more
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxVisible(filteredTransactions.length)}
                      className="rounded-full border border-[#c9c3b6] px-3.5 py-1.5 text-[12.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
                    >
                      Show all
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TRANSFERS, INTERAC E-TRANSFER & BILL PAYMENTS */}
        {tab === "transfers" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-[28px] font-bold text-nbc-navy">Transfers and bill payments</h1>
              <p className="mt-1 text-[14px] text-[#565656]">
                Move funds between accounts, send an Interac e-Transfer®, pay bills, or deposit a cheque
              </p>
            </div>

            <div className="scroll-tabs rounded-t-[6px] border-b border-[#dcd8ce] bg-white px-2">
              {(
                [
                  ["internal", "Between my accounts"],
                  ["card", "Card transfer"],
                  ["etransfer", "Interac e-Transfer®"],
                  ["bills", "Pay a bill"],
                  ["deposit", "Deposit a cheque"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoveMode(m)}
                  className={`border-b-[3px] px-4 py-3.5 text-[14px] transition sm:px-5 ${
                    moveMode === m
                      ? "border-nbc-red font-semibold text-nbc-navy"
                      : "border-transparent text-[#565656] hover:text-nbc-navy"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {moveMode === "internal" && (
              <form
                onSubmit={handleInternalTransfer}
                className="max-w-[680px] space-y-5 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[20px] font-bold text-nbc-navy">Transfer between my accounts</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="tr-from" className="block text-[13px] font-semibold text-[#121212]">
                      From account
                    </label>
                    <select
                      id="tr-from"
                      value={fromId}
                      onChange={(e) => setFromId(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {sourceAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatMoney(a.balance, a.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="tr-to" className="block text-[13px] font-semibold text-[#121212]">
                      To account
                    </label>
                    <select
                      id="tr-to"
                      value={toId}
                      onChange={(e) => setToId(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {profile.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatMoney(a.balance, a.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="tr-amt" className="block text-[13px] font-semibold text-[#121212]">
                      Amount ($)
                    </label>
                    <input
                      id="tr-amt"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={transferAmt}
                      onChange={(e) => setTransferAmt(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[15px] font-semibold tabular-nums text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="tr-memo" className="block text-[13px] font-semibold text-[#121212]">
                      Reference note (optional)
                    </label>
                    <input
                      id="tr-memo"
                      type="text"
                      value={transferMemo}
                      onChange={(e) => setTransferMemo(e.target.value)}
                      placeholder="e.g., Monthly savings"
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14px] text-[#121212]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={transferLockActive}
                  className="nbc-btn nbc-btn-primary disabled:opacity-50"
                >
                  Continue and transfer
                </button>
              </form>
            )}

            {moveMode === "card" && (
              <form
                onSubmit={handleCardTransfer}
                className="max-w-[720px] space-y-5 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <div>
                  <h2 className="text-[20px] font-bold text-nbc-navy">Transfer funds to a linked card</h2>
                  <p className="mt-1 text-[14px] text-[#565656]">
                    Add cash to a linked card or move money from your account to a card that is already linked to your profile.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="card-tx-type" className="block text-[13px] font-semibold text-[#121212]">
                      Transaction type
                    </label>
                    <select
                      id="card-tx-type"
                      value={cardTxType}
                      onChange={(e) => setCardTxType(e.target.value as "transfer" | "cash" | "from-card")}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      <option value="transfer">Transfer to card</option>
                      <option value="cash">Add cash to card</option>
                      <option value="from-card">Add funds from card</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="card-source" className="block text-[13px] font-semibold text-[#121212]">
                      Funding account
                    </label>
                    <select
                      id="card-source"
                      value={cardSourceId}
                      onChange={(e) => setCardSourceId(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {sourceAccounts.map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name} ({formatMoney(account.balance, account.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="card-select" className="block text-[13px] font-semibold text-[#121212]">
                    Linked card
                  </label>
                  <select
                    id="card-select"
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                  >
                    {profile.cards.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.label} •••• {card.last4}
                      </option>
                    ))}
                  </select>
                </div>

                {profile.cards.length > 0 && (() => {
                  const selectedCard = profile.cards.find((c) => c.id === cardId) ?? profile.cards[0];
                  const linked = selectedCard ? profile.accounts.find((a) => a.id === selectedCard.linkedAccountId) : undefined;
                  return (
                    <div className="rounded-[6px] bg-[#f8f6f1] p-3 text-[12.5px] text-[#565656]">
                      <p className="font-semibold text-nbc-navy">{selectedCard?.label ?? "Selected card"}</p>
                      <p className="mt-0.5">
                        Linked to: <span className="font-semibold text-[#121212]">{linked?.name ?? "No linked account"}</span>
                      </p>
                      {selectedCard?.monthlyLimit ? (
                        <p className="mt-0.5">
                          Monthly limit: <span className="font-semibold tabular-nums text-[#121212]">{formatMoney(selectedCard.monthlyLimit)}</span>
                        </p>
                      ) : null}
                      {cardTxType === "from-card" && linked && (
                        <p className="mt-0.5">
                          Available from card: <span className="font-semibold tabular-nums text-[#121212]">{formatMoney(linked.balance, linked.currency)}</span>
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="card-amt" className="block text-[13px] font-semibold text-[#121212]">
                      Amount ($)
                    </label>
                    <input
                      id="card-amt"
                      type="number"
                      step="0.01"
                      min="1"
                      value={cardAmt}
                      onChange={(e) => setCardAmt(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[15px] font-semibold tabular-nums text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="card-memo" className="block text-[13px] font-semibold text-[#121212]">
                      Reference note (optional)
                    </label>
                    <input
                      id="card-memo"
                      type="text"
                      value={cardMemo}
                      onChange={(e) => setCardMemo(e.target.value)}
                      placeholder="e.g., Monthly top-up"
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14px] text-[#121212]"
                    />
                  </div>
                </div>

                <button type="submit" disabled={transferLockActive} className="nbc-btn nbc-btn-primary disabled:opacity-50">
                  {cardTxType === "cash"
                    ? "Add cash to card"
                    : cardTxType === "from-card"
                      ? "Add funds from card"
                      : "Transfer to card"}
                </button>
              </form>
            )}

            {moveMode === "etransfer" && (
              <div className="grid gap-6 lg:grid-cols-12">
                <form
                  onSubmit={handleSendEtransfer}
                  className="space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6 lg:col-span-7"
                >
                  <h2 className="text-[20px] font-bold text-nbc-navy">Send an Interac e-Transfer®</h2>
                  <div>
                    <label htmlFor="et-src" className="block text-[13px] font-semibold text-[#121212]">
                      From account
                    </label>
                    <select
                      id="et-src"
                      value={etrSourceId}
                      onChange={(e) => setEtrSourceId(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {sourceAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatMoney(a.balance, a.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="et-rec" className="block text-[13px] font-semibold text-[#121212]">
                      Recipient
                    </label>
                    <select
                      id="et-rec"
                      value={recipientId}
                      onChange={(e) => setRecipientId(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {profile.recipients.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="et-amt" className="block text-[13px] font-semibold text-[#121212]">
                        Amount ($)
                      </label>
                      <input
                        id="et-amt"
                        type="number"
                        step="0.01"
                        min="1"
                        value={etrAmt}
                        onChange={(e) => setEtrAmt(e.target.value)}
                        required
                        className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[15px] font-semibold tabular-nums text-[#121212]"
                      />
                    </div>
                    <div>
                      <label htmlFor="et-msg" className="block text-[13px] font-semibold text-[#121212]">
                        Message (optional)
                      </label>
                      <input
                        id="et-msg"
                        type="text"
                        value={etrMsg}
                        onChange={(e) => setEtrMsg(e.target.value)}
                        placeholder="Optional message"
                        className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[14px] text-[#121212]"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={transferLockActive}
                    className="nbc-btn nbc-btn-primary disabled:opacity-50"
                  >
                    Send Interac e-Transfer®
                  </button>
                </form>

                <form
                  onSubmit={handleAddRecipient}
                  className="h-fit space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6 lg:col-span-5"
                >
                  <h3 className="text-[18px] font-bold text-nbc-navy">Add a recipient</h3>
                  <div>
                    <label htmlFor="nr-n" className="block text-[13px] font-semibold text-[#121212]">
                      Recipient name
                    </label>
                    <input
                      id="nr-n"
                      type="text"
                      value={newRecName}
                      onChange={(e) => setNewRecName(e.target.value)}
                      placeholder="Full name"
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="nr-e" className="block text-[13px] font-semibold text-[#121212]">
                      Email address
                    </label>
                    <input
                      id="nr-e"
                      type="email"
                      value={newRecEmail}
                      onChange={(e) => setNewRecEmail(e.target.value)}
                      placeholder="name@example.ca"
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </div>
                  <button type="submit" className="nbc-btn nbc-btn-ghost w-full">
                    Save recipient
                  </button>
                </form>
              </div>
            )}

            {moveMode === "bills" && (
              <div className="grid gap-6 lg:grid-cols-12">
                <form
                  onSubmit={handlePayBill}
                  className="space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6 lg:col-span-7"
                >
                  <h2 className="text-[20px] font-bold text-nbc-navy">Pay a registered bill</h2>
                  <div>
                    <label htmlFor="bp-src" className="block text-[13px] font-semibold text-[#121212]">
                      From account
                    </label>
                    <select
                      id="bp-src"
                      value={billSourceId}
                      onChange={(e) => setBillSourceId(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {sourceAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({formatMoney(a.balance, a.currency)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="bp-pay" className="block text-[13px] font-semibold text-[#121212]">
                      Payee
                    </label>
                    <select
                      id="bp-pay"
                      value={payeeId}
                      onChange={(e) => setPayeeId(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {profile.payees.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — Ref. {p.accountRef}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="bp-amt" className="block text-[13px] font-semibold text-[#121212]">
                      Amount ($)
                    </label>
                    <input
                      id="bp-amt"
                      type="number"
                      step="0.01"
                      min="1"
                      value={billAmt}
                      onChange={(e) => setBillAmt(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3.5 py-2.5 text-[15px] font-semibold tabular-nums text-[#121212]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={transferLockActive}
                    className="nbc-btn nbc-btn-primary disabled:opacity-50"
                  >
                    Pay bill
                  </button>
                </form>

                <form
                  onSubmit={handleAddPayee}
                  className="h-fit space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6 lg:col-span-5"
                >
                  <h3 className="text-[18px] font-bold text-nbc-navy">Add a payee</h3>
                  <div>
                    <label htmlFor="np-n" className="block text-[13px] font-semibold text-[#121212]">
                      Payee name
                    </label>
                    <input
                      id="np-n"
                      type="text"
                      value={newPayeeName}
                      onChange={(e) => setNewPayeeName(e.target.value)}
                      placeholder="e.g., Hydro-Québec, Bell, Vidéotron"
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="np-r" className="block text-[13px] font-semibold text-[#121212]">
                      Account or reference number
                    </label>
                    <input
                      id="np-r"
                      type="text"
                      value={newPayeeRef}
                      onChange={(e) => setNewPayeeRef(e.target.value)}
                      placeholder="Reference number on your invoice"
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </div>
                  <button type="submit" className="nbc-btn nbc-btn-ghost w-full">
                    Add payee
                  </button>
                </form>
              </div>
            )}

            {moveMode === "deposit" && (
              <form
                onSubmit={handleChequeDeposit}
                className="max-w-[620px] space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[20px] font-bold text-nbc-navy">Deposit a cheque</h2>
                <p className="text-[14px] text-[#565656]">
                  Deposit a Canadian dollar cheque directly into your bank account.
                </p>
                <div>
                  <label htmlFor="cd-acc" className="block text-[13px] font-semibold text-[#121212]">
                    Deposit to account
                  </label>
                  <select
                    id="cd-acc"
                    value={depTargetId}
                    onChange={(e) => setDepTargetId(e.target.value)}
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                  >
                    {sourceAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({formatMoney(a.balance, a.currency)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="cd-from" className="block text-[13px] font-semibold text-[#121212]">
                      Description / payer
                    </label>
                    <input
                      id="cd-from"
                      type="text"
                      value={depFrom}
                      onChange={(e) => setDepFrom(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[14px] text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="cd-amt" className="block text-[13px] font-semibold text-[#121212]">
                      Cheque amount ($)
                    </label>
                    <input
                      id="cd-amt"
                      type="number"
                      step="0.01"
                      min="1"
                      value={depAmt}
                      onChange={(e) => setDepAmt(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[15px] font-semibold tabular-nums text-[#121212]"
                    />
                  </div>
                </div>
                <button type="submit" className="nbc-btn nbc-btn-primary">
                  Confirm deposit
                </button>
              </form>
            )}

            {/* SCHEDULED & RECURRING TRANSFERS */}
            <div className="grid gap-6 lg:grid-cols-12">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (transferLockActive) {
                    notify(
                      profile.status === "frozen"
                        ? "This account is on hold and cannot send transfers."
                        : "Outgoing transfers are paused for this account."
                    );
                    return;
                  }
                  const amt = Number(schAmount);
                  const from = profile.accounts.find((a) => a.id === schFromId);
                  const to = profile.accounts.find((a) => a.id === schToId);
                  if (!from || !to || from.id === to.id) {
                    notify("Choose two different accounts for the scheduled transfer.");
                    return;
                  }
                  if (!amt || amt <= 0) {
                    notify("Enter an amount greater than zero.");
                    return;
                  }
                  if (!schDate) {
                    notify("Choose a start date for the schedule.");
                    return;
                  }
                  const entry: ScheduledTransfer = {
                    id: `sch-${Date.now()}`,
                    fromAccountId: from.id,
                    toAccountId: to.id,
                    kind: "internal",
                    amount: Math.round(amt * 100) / 100,
                    frequency: schFrequency,
                    nextDate: schDate,
                    description: schDesc.trim() || `Scheduled transfer to ${to.name}`,
                    active: true,
                  };
                  onUpdateProfile((prev) => ({
                    ...prev,
                    scheduled: [entry, ...(prev.scheduled ?? [])],
                  }));
                  setSchDesc("");
                  notify(
                    schFrequency === "once"
                      ? `Transfer scheduled for ${schDate}.`
                      : `${schFrequency} transfer scheduled starting ${schDate}.`
                  );
                }}
                className="space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6 lg:col-span-6"
              >
                <div>
                  <h2 className="text-[20px] font-bold text-nbc-navy">Schedule a transfer</h2>
                  <p className="mt-1 text-[13px] text-[#565656]">
                    Automate savings or move funds on a date you choose.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">From account</span>
                    <select
                      value={schFromId}
                      onChange={(e) => setSchFromId(e.target.value)}
                      className="w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {sourceAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">To account</span>
                    <select
                      value={schToId}
                      onChange={(e) => setSchToId(e.target.value)}
                      className="w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      {profile.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Amount ($)</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={schAmount}
                      onChange={(e) => setSchAmount(e.target.value)}
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[15px] font-semibold tabular-nums text-[#121212]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Frequency</span>
                    <select
                      value={schFrequency}
                      onChange={(e) => setSchFrequency(e.target.value as ScheduledTransfer["frequency"])}
                      className="w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2.5 text-[14px] text-nbc-navy"
                    >
                      <option value="once">One time</option>
                      <option value="weekly">Every week</option>
                      <option value="biweekly">Every two weeks</option>
                      <option value="monthly">Every month</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Start date</span>
                    <input
                      type="date"
                      value={schDate}
                      onChange={(e) => setSchDate(e.target.value)}
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[14px] text-[#121212]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Description</span>
                    <input
                      value={schDesc}
                      onChange={(e) => setSchDesc(e.target.value)}
                      placeholder="e.g., Payday savings"
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2.5 text-[14px] text-[#121212]"
                    />
                  </label>
                </div>
                <button type="submit" disabled={transferLockActive} className="nbc-btn nbc-btn-primary disabled:opacity-50">
                  Schedule transfer
                </button>
              </form>

              <div className="space-y-3 lg:col-span-6">
                <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
                  <h2 className="text-[19px] font-bold text-nbc-navy">Scheduled transfers</h2>
                  <p className="mt-0.5 text-[13px] text-[#565656]">
                    {(profile.scheduled ?? []).length} schedule(s) on file
                  </p>
                  <ul className="mt-3 divide-y divide-[#efefef]">
                    {(profile.scheduled ?? []).map((sch) => {
                      const from = profile.accounts.find((a) => a.id === sch.fromAccountId);
                      const to = profile.accounts.find((a) => a.id === sch.toAccountId);
                      return (
                        <li key={sch.id} className="py-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[13.5px] font-semibold text-[#121212]">{sch.description}</p>
                              <p className="text-[12px] text-[#565656]">
                                {from?.name ?? "Account"} → {to?.name ?? "Account"} ·{" "}
                                {sch.frequency === "once" ? "One time" : sch.frequency}
                              </p>
                              <p className="text-[11.5px] text-[#777]">Next: {sch.nextDate}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[15px] font-bold tabular-nums text-[#121212]">
                                {formatMoney(sch.amount)}
                              </p>
                              <span
                                className={`text-[11px] font-semibold ${sch.active ? "text-[#017a33]" : "text-[#8a6d3b]"}`}
                              >
                                {sch.active ? "Active" : "Paused"}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProfile((prev) => ({
                                  ...prev,
                                  scheduled: (prev.scheduled ?? []).map((x) =>
                                    x.id === sch.id ? { ...x, active: !x.active } : x
                                  ),
                                }))
                              }
                              className="rounded-full border border-[#c9c3b6] px-3 py-1 text-[11.5px] font-semibold text-nbc-navy hover:border-nbc-navy"
                            >
                              {sch.active ? "Pause" : "Resume"}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateProfile((prev) => ({
                                  ...prev,
                                  scheduled: (prev.scheduled ?? []).filter((x) => x.id !== sch.id),
                                }))
                              }
                              className="rounded-full bg-rose-50 px-3 py-1 text-[11.5px] font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </li>
                      );
                    })}
                    {(profile.scheduled ?? []).length === 0 && (
                      <li className="py-4 text-[13px] text-[#565656]">
                        No scheduled transfers yet. Set one up to automate your savings.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CARDS & SECURITY CONTROLS */}
        {tab === "cards" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-[28px] font-bold text-nbc-navy">Cards and security settings</h1>
              <p className="mt-1 text-[14px] text-[#565656]">
                View your card details, redeem rewards points, or lock a misplaced card
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {profile.cards.map((card) => {
                const linked = profile.accounts.find((a) => a.id === card.linkedAccountId);
                return (
                  <div
                    key={card.id}
                    className="mx-auto w-full max-w-[400px] rounded-[6px] border border-[#e5e2da] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                  >
                    <BankCardVisual card={card} holderName={profile.fullName} />

                    {linked && (
                      <div className="mt-4 flex items-center justify-between rounded-[6px] bg-[#f8f6f1] px-4 py-3 text-[14px]">
                        <span className="text-[#565656]">
                          {linked.category === "credit" ? "Current card balance" : "Linked account balance"}
                        </span>
                        <span className="font-bold tabular-nums text-[#121212]">
                          {formatMoney(linked.balance, linked.currency)}
                        </span>
                      </div>
                    )}

                    {card.monthlyLimit ? (
                      (() => {
                        const month = new Date().toISOString().slice(0, 7);
                        const spent = profile.transactions
                          .filter((t) => t.accountId === card.linkedAccountId && t.date.startsWith(month) && t.amount > 0)
                          .reduce((sum, t) => sum + t.amount, 0);
                        const pct = Math.min(100, Math.round((spent / card.monthlyLimit!) * 100));
                        return (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-[12px]">
                              <span className="text-[#565656]">Monthly spend limit</span>
                              <span className="font-semibold tabular-nums text-[#121212]">
                                {formatMoney(spent)} of {formatMoney(card.monthlyLimit!)}
                              </span>
                            </div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#efece5]">
                              <div
                                className={`h-full rounded-full ${pct >= 90 ? "bg-nbc-red" : "bg-nbc-navy"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[11px] text-[#777]">
                              {formatMoney(Math.max(0, card.monthlyLimit! - spent))} remaining this month
                            </p>
                          </div>
                        );
                      })()
                    ) : null}

                    {/* Recent activity on this card */}
                    {(() => {
                      const cardTxs = profile.transactions
                        .filter((t) => t.accountId === card.linkedAccountId)
                        .slice(0, 5);
                      if (cardTxs.length === 0) return null;
                      return (
                        <div className="mt-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-[13.5px] font-bold text-nbc-navy">Recent card activity</h3>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedAccountId(card.linkedAccountId);
                                setTxRange("all");
                                setTxCat("All");
                                setTxQuery("");
                                setTxVisible(25);
                                setTab("transactions");
                              }}
                              className="text-[12px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                            >
                              See all
                            </button>
                          </div>
                          <ul className="mt-1.5 divide-y divide-[#efefef]">
                            {cardTxs.map((t) => (
                              <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-[12.5px]">
                                <span className="min-w-0">
                                  <span className="block truncate font-medium text-[#121212]">{t.description}</span>
                                  <span className="block text-[11px] text-[#777]">
                                    {t.date} · {(t.status ?? "Posted") === "Pending" ? "Pending" : "Posted"}
                                  </span>
                                </span>
                                <span
                                  className={`flex-none whitespace-nowrap font-semibold tabular-nums ${
                                    t.amount >= 0 ? "text-[#017a33]" : "text-[#121212]"
                                  }`}
                                >
                                  {formatMoney(t.amount, linked?.currency ?? "CAD")}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    {card.rewardsPoints !== undefined && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#e5e2da] p-4">
                        <div>
                          <p className="text-[12px] font-semibold text-[#565656]">Available rewards</p>
                          <p className="text-[19px] font-bold tabular-nums text-nbc-navy">
                            {card.rewardsPoints.toLocaleString()} points
                          </p>
                          <p className="text-[12.5px] text-[#565656]">{card.cashbackRate}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => redeemCardRewards(card.id)}
                          className="rounded-full border border-nbc-navy px-4 py-2 text-[13px] font-semibold text-nbc-navy transition hover:bg-nbc-navy hover:text-white"
                        >
                          Redeem credit
                        </button>
                      </div>
                    )}

                    <div className="mt-5 divide-y divide-[#efefef] text-[14px]">
                      {(
                        [
                          ["locked", "Lock card temporarily", card.locked],
                          ["contactless", "Contactless (tap) purchases", card.contactless],
                          ["international", "Transactions outside Canada", card.international],
                          ["onlinePurchases", "Online & recurring payments", card.onlinePurchases],
                        ] as const
                      ).map(([key, label, active]) => (
                        <div key={key} className="flex items-center justify-between py-3">
                          <span className="text-[#333333]">{label}</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={active}
                            onClick={() => toggleCardField(card.id, key)}
                            className={`relative h-6 w-11 rounded-full transition ${
                              active ? "bg-nbc-red" : "bg-[#cfcfcf]"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                                active ? "left-5" : "left-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 5: SAVINGS GOALS */}
        {tab === "goals" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-7">
              <h1 className="text-[28px] font-bold text-nbc-navy">Savings goals</h1>
              {profile.goals.map((goal) => {
                const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
                return (
                  <div
                    key={goal.id}
                    className="rounded-[6px] border border-[#e5e2da] bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <div>
                        <h2 className="text-[18px] font-bold text-nbc-navy">{goal.title}</h2>
                        <p className="text-[13px] text-[#565656]">Target date: {goal.deadline}</p>
                      </div>
                      <span className="text-[14px] font-semibold tabular-nums text-nbc-navy">{pct}%</span>
                    </div>

                    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#ece8df]">
                      <div className="h-full rounded-full bg-nbc-red transition-all" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[14px]">
                      <span className="tabular-nums font-semibold text-[#121212]">
                        {formatMoney(goal.current)}{" "}
                        <span className="font-normal text-[#565656]">of {formatMoney(goal.target)}</span>
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => contributeToGoal(goal.id, 250)}
                          className="rounded-full border border-nbc-navy px-4 py-1.5 text-[13px] font-semibold text-nbc-navy transition hover:bg-nbc-navy hover:text-white"
                        >
                          Transfer $250
                        </button>
                        <button
                          type="button"
                          onClick={() => contributeToGoal(goal.id, 1000)}
                          className="rounded-full bg-nbc-red px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-nbc-red-dark"
                        >
                          Transfer $1,000
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="lg:col-span-5">
              <form
                onSubmit={handleCreateGoal}
                className="space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[20px] font-bold text-nbc-navy">Create a new savings goal</h2>
                <div>
                  <label htmlFor="ng-t" className="block text-[13px] font-semibold text-[#121212]">
                    Project name
                  </label>
                  <input
                    id="ng-t"
                    type="text"
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    placeholder="e.g., Home renovation, Travel"
                    required
                    className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="ng-amt" className="block text-[13px] font-semibold text-[#121212]">
                      Target amount ($)
                    </label>
                    <input
                      id="ng-amt"
                      type="number"
                      min="100"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                      required
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] font-semibold tabular-nums text-[#121212]"
                    />
                  </div>
                  <div>
                    <label htmlFor="ng-dl" className="block text-[13px] font-semibold text-[#121212]">
                      Target date
                    </label>
                    <input
                      id="ng-dl"
                      type="text"
                      value={goalDeadline}
                      onChange={(e) => setGoalDeadline(e.target.value)}
                      className="mt-1.5 w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </div>
                </div>
                <button type="submit" className="nbc-btn nbc-btn-primary w-full">
                  Save goal
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 6: REALISTIC CANADIAN VOID CHEQUE & E-STATEMENTS */}
        {tab === "documents" && primaryChequing && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="rounded-[6px] border border-[#e5e2da] bg-white p-6 lg:col-span-7">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece8df] pb-4">
                <div>
                  <h1 className="text-[22px] font-bold text-nbc-navy">
                    Direct deposit and pre-authorized debit form
                  </h1>
                  <p className="mt-0.5 text-[13.5px] text-[#565656]">
                    Provide these details to your employer or government agency (CRA / Revenu Québec)
                  </p>
                </div>
                <img src={logoNbc} alt="National Bank" className="h-8 w-auto" />
              </div>

              {/* Authentic Canadian Specimen / Void Cheque Box */}
              <div className="mt-5 rounded-[6px] border border-dashed border-[#b9b2a3] bg-[#fcfbf8] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[14px] font-bold text-[#121212]">{profile.fullName}</p>
                    <p className="text-[12.5px] text-[#565656]">{profile.branchName}</p>
                  </div>
                  <span className="border border-[#999] px-3 py-0.5 text-[12px] font-bold tracking-[0.2em] text-[#565656]">
                    SPECIMEN — VOID
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#e5e2da] pt-4 sm:grid-cols-3">
                  <div>
                    <span className="block text-[11.5px] text-[#565656]">Transit (5 digits)</span>
                    <span className="font-mono text-[17px] font-bold text-nbc-navy">00061</span>
                  </div>
                  <div>
                    <span className="block text-[11.5px] text-[#565656]">Institution (3 digits)</span>
                    <span className="font-mono text-[17px] font-bold text-nbc-navy">006</span>
                  </div>
                  <div>
                    <span className="block text-[11.5px] text-[#565656]">Account (7 digits)</span>
                    <span className="font-mono text-[17px] font-bold text-nbc-navy">
                      {primaryChequing.number.replace(/[^0-9]/g, "").slice(-7).padStart(7, "1")}
                    </span>
                  </div>
                </div>

                <p className="mt-5 overflow-x-auto whitespace-nowrap font-mono text-[12px] tracking-[0.12em] text-[#444] sm:text-[14px] sm:tracking-[0.22em]">
                  ⑈001⑈ ⑆00061⑆006⑆ {primaryChequing.number.replace(/[^0-9]/g, "").slice(-7).padStart(7, "1")}⑈
                </p>
              </div>
            </div>

            <div className="rounded-[6px] border border-[#e5e2da] bg-white p-6 lg:col-span-5">
              <h2 className="text-[19px] font-bold text-nbc-navy">Monthly e-Statements</h2>
              <p className="mt-1 text-[13.5px] text-[#565656]">
                Paperless statements are archived for 7 years.
              </p>
              <ul className="mt-4 divide-y divide-[#efefef] text-[14px]">
                {["May 2026 — Current cycle", "April 2026 — Statement", "March 2026 — Statement", "2025 T5 Tax Slip"].map(
                  (doc) => (
                    <li key={doc} className="flex items-center justify-between py-3">
                      <span className="text-[#121212]">{doc}</span>
                      <button
                        type="button"
                        onClick={handleDownloadCsv}
                        className="font-medium text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                      >
                        Download
                      </button>
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        )}
        {/* TAB 7: PROFILE & SECURITY SETTINGS (client self-service) */}
        {tab === "settings" && (
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <div>
                <h1 className="text-[28px] font-bold text-nbc-navy">Profile and settings</h1>
                <p className="mt-1 text-[14px] text-[#565656]">
                  Keep your contact details current so we can reach you about your accounts.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget as HTMLFormElement);
                  const get = (k: string) => String(data.get(k) ?? "").trim();
                  onUpdateProfile((prev) => ({
                    ...prev,
                    fullName: get("fullName") || prev.fullName,
                    phone: get("phone"),
                    address: get("address"),
                    city: get("city"),
                    province: get("province"),
                    postalCode: get("postalCode"),
                    branchName: get("branchName") || prev.branchName,
                  }));
                  notify("Your profile details have been saved.");
                }}
                className="space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[19px] font-bold text-nbc-navy">Personal information</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Full name</span>
                    <input
                      name="fullName"
                      defaultValue={profile.fullName}
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Phone number</span>
                    <input
                      name="phone"
                      defaultValue={profile.phone ?? ""}
                      placeholder="514-555-0142"
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Street address</span>
                    <input
                      name="address"
                      defaultValue={profile.address ?? ""}
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">City</span>
                    <input
                      name="city"
                      defaultValue={profile.city ?? ""}
                      className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Province</span>
                      <select
                        name="province"
                        defaultValue={profile.province ?? "QC"}
                        className="w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2 text-[14px] text-nbc-navy"
                      >
                        {["QC", "ON", "BC", "AB", "MB", "SK", "NS", "NB", "NL", "PE"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Postal code</span>
                      <input
                        name="postalCode"
                        defaultValue={profile.postalCode ?? ""}
                        placeholder="H3B 1A7"
                        className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                      />
                    </label>
                  </div>
                  <label className="block sm:col-span-2">
                    <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">Home branch</span>
                    <select
                      name="branchName"
                      defaultValue={profile.branchName}
                      className="w-full rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2 text-[14px] text-nbc-navy"
                    >
                      {[
                        profile.branchName,
                        "Place Ville Marie — Montreal, QC",
                        "King Street West — Toronto, ON",
                        "Laurier Boulevard — Quebec City, QC",
                        "Sparks Street — Ottawa, ON",
                        "Burrard Street — Vancouver, BC",
                        "Stephen Avenue — Calgary, AB",
                      ]
                        .filter((b, i, arr) => arr.indexOf(b) === i)
                        .map((b) => (
                          <option key={b}>{b}</option>
                        ))}
                    </select>
                  </label>
                </div>
                <button type="submit" className="nbc-btn nbc-btn-primary">
                  Save changes
                </button>
              </form>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget as HTMLFormElement;
                  const current = String(new FormData(form).get("current") ?? "");
                  const next = String(new FormData(form).get("next") ?? "");
                  const confirm = String(new FormData(form).get("confirm") ?? "");
                  if (profile.password && current !== profile.password) {
                    notify("Your current password is incorrect.");
                    return;
                  }
                  if (next.length < 4) {
                    notify("Choose a new password of at least 4 characters.");
                    return;
                  }
                  if (next !== confirm) {
                    notify("The new passwords do not match.");
                    return;
                  }
                  onUpdateProfile((prev) => ({ ...prev, password: next }));
                  notify("Your password has been updated.");
                  form.reset();
                }}
                className="space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[19px] font-bold text-nbc-navy">Change your password</h2>
                <p className="text-[13px] text-[#565656]">
                  Use a unique password you do not reuse on other websites.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { name: "current", label: "Current password", ph: "••••••••" },
                    { name: "next", label: "New password", ph: "Minimum 4 characters" },
                    { name: "confirm", label: "Confirm new password", ph: "Re-enter password" },
                  ].map((f) => (
                    <label key={f.name} className="block">
                      <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">{f.label}</span>
                      <input
                        name={f.name}
                        type="password"
                        placeholder={f.ph}
                        autoComplete="new-password"
                        className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                      />
                    </label>
                  ))}
                </div>
                <button type="submit" className="nbc-btn nbc-btn-ghost">
                  Update password
                </button>
              </form>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget as HTMLFormElement;
                  const current = String(new FormData(form).get("currentPin") ?? "");
                  const next = String(new FormData(form).get("nextPin") ?? "");
                  const confirm = String(new FormData(form).get("confirmPin") ?? "");
                  const normalizedCurrent = current.replace(/\D/g, "");
                  const normalizedNext = next.replace(/\D/g, "");
                  const normalizedConfirm = confirm.replace(/\D/g, "");

                  if (profile.pin && normalizedCurrent !== profile.pin) {
                    notify("Your current security PIN is incorrect.");
                    return;
                  }
                  if (!/^\d{4}$/.test(normalizedNext)) {
                    notify("Choose a 4-digit PIN.");
                    return;
                  }
                  if (normalizedNext !== normalizedConfirm) {
                    notify("The new PINs do not match.");
                    return;
                  }
                  onUpdateProfile((prev) => ({ ...prev, pin: normalizedNext }));
                  notify("Your security PIN has been updated.");
                  form.reset();
                }}
                className="space-y-4 rounded-[6px] border border-[#e5e2da] bg-white p-6"
              >
                <h2 className="text-[19px] font-bold text-nbc-navy">Change your security PIN</h2>
                <p className="text-[13px] text-[#565656]">
                  Use a 4-digit PIN that is easy for you to remember and different from your password.
                </p>
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { name: "currentPin", label: "Current PIN", ph: "1234" },
                    { name: "nextPin", label: "New PIN", ph: "4 digits" },
                    { name: "confirmPin", label: "Confirm new PIN", ph: "Repeat PIN" },
                  ].map((f) => (
                    <label key={f.name} className="block">
                      <span className="mb-1 block text-[12.5px] font-semibold text-[#121212]">{f.label}</span>
                      <input
                        name={f.name}
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder={f.ph}
                        autoComplete="one-time-code"
                        className="w-full rounded-[6px] border border-[#c9c3b6] px-3 py-2 text-[14px] text-[#121212]"
                      />
                    </label>
                  ))}
                </div>
                <button type="submit" className="nbc-btn nbc-btn-ghost">
                  Update PIN
                </button>
              </form>
            </div>

            <div className="space-y-5 lg:col-span-5">
              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
                <h2 className="text-[17px] font-bold text-nbc-navy">Security preferences</h2>
                <p className="mt-1 text-[13px] text-[#565656]">
                  Choose how we confirm it is really you when you sign in.
                </p>
                <div className="mt-3 divide-y divide-[#efefef] text-[13.5px]">
                  {(
                    [
                      ["emailNotifications", "Email notifications", "Alerts sent to " + profile.email],
                      ["loginAlerts", "Login alerts", "Notify me when my account is accessed"],
                      ["largeTransactionAlerts", "Large transaction alerts", `Notify me for debits over ${formatMoney(prefs.largeTransactionThreshold)}`],
                      ["newPayeeAlerts", "New payee alerts", "Confirm before paying a new biller"],
                    ] as [keyof ClientPreferences, string, string][]
                  ).map(([key, label, desc]) => (
                    <div key={key} className="flex items-start justify-between gap-3 py-2.5">
                      <span>
                        <span className="block font-medium text-[#333]">{label}</span>
                        <span className="block text-[11.5px] text-[#777]">{desc}</span>
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(prefs[key])}
                        aria-label={label}
                        onClick={() =>
                          onUpdateProfile((prev) => ({
                            ...prev,
                            preferences: {
                              ...DEFAULT_PREFERENCES,
                              ...(prev.preferences ?? {}),
                              [key]: !Boolean(prefs[key]),
                            },
                          }))
                        }
                        className={`mt-0.5 relative h-5 w-9 flex-none rounded-full transition ${
                          prefs[key] ? "bg-nbc-red" : "bg-[#cfcfcf]"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                            prefs[key] ? "left-4.5" : "left-0.5"
                          }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-[6px] bg-[#faf8f3] p-3">
                  <label className="block text-[12px] font-semibold text-[#333]">
                    Large transaction threshold
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={100}
                      value={prefs.largeTransactionThreshold}
                      onChange={(e) =>
                        onUpdateProfile((prev) => ({
                          ...prev,
                          preferences: {
                            ...DEFAULT_PREFERENCES,
                            ...(prev.preferences ?? {}),
                            largeTransactionThreshold: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-full accent-[#e41c23]"
                      aria-label="Large transaction threshold"
                    />
                    <span className="flex-none text-[12.5px] font-bold tabular-nums text-nbc-navy">
                      {formatMoney(prefs.largeTransactionThreshold)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
                <h2 className="text-[17px] font-bold text-nbc-navy">Account summary</h2>
                <dl className="mt-2 space-y-1.5 text-[13px]">
                  {[
                    ["Client name", profile.fullName],
                    ["Email", profile.email],
                    ["Segment", profile.roleLabel],
                    ["Client since", profile.memberSince],
                    ["Advisor", profile.advisorName],
                    ["Home branch", profile.branchName],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-[#565656]">{k}</dt>
                      <dd className="max-w-[62%] text-right font-medium text-[#121212]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  onClick={onGoHelp}
                  className="mt-3 text-[13px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2 hover:no-underline"
                >
                  Book an appointment with your advisor
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
