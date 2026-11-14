import { useMemo, useState } from "react";
import {
  AdminPanelProps,
  applyBatchToProfile,
  batchPostFees,
  batchPostInterest,
  can,
  downloadFile,
  newId,
  nowStamp,
  todayIso,
  type BatchResult,
} from "../../banking/adminOps";
import { ClientDocument, ClientMessage, formatMoney } from "../../banking/bankingTypes";
import { Field, inputCls } from "./AdminClients";

type OpsTab = "batches" | "kyc" | "messages";

export default function AdminOperations({ ops, selectedKey, onSelectKey }: AdminPanelProps) {
  const [sub, setSub] = useState<OpsTab>("batches");
  const actor = ops.identity?.name ?? "Administration";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-nbc-navy sm:text-[24px]">Back-office operations</h2>
          <p className="mt-0.5 text-[13.5px] text-[#565656]">
            Batch processing, identity verification and client communications.
          </p>
        </div>
        <select
          value={selectedKey}
          onChange={(e) => onSelectKey(e.target.value)}
          className="rounded-[6px] border border-[#c9c3b6] bg-white px-3 py-2 text-[13px] font-semibold text-nbc-navy"
        >
          {ops.users.map((u) => (
            <option key={u.key} value={u.key}>
              {u.profile.fullName}
            </option>
          ))}
        </select>
      </div>

      <div className="scroll-tabs border-b border-[#dcd8ce]">
        {(
          [
            ["batches", "Batch processing"],
            ["kyc", "Identity verification"],
            ["messages", "Client communications"],
          ] as [OpsTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSub(id)}
            className={`border-b-[3px] px-4 py-3 text-[14px] transition ${
              sub === id ? "border-nbc-red font-semibold text-nbc-navy" : "border-transparent text-[#565656]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sub === "batches" && <BatchPanel ops={ops} actor={actor} />}
      {sub === "kyc" && <KycPanel ops={ops} selectedKey={selectedKey} actor={actor} />}
      {sub === "messages" && <MessagePanel ops={ops} selectedKey={selectedKey} actor={actor} />}
    </div>
  );
}

/* ---------------------------- batch jobs ---------------------------- */

function BatchPanel({ ops, actor }: { ops: AdminPanelProps["ops"]; actor: string }) {
  const [interestRate, setInterestRate] = useState("3");
  const [feeAmount, setFeeAmount] = useState("15.95");
  const [lastRun, setLastRun] = useState<string | null>(null);
  const permitted = can(ops.identity, "ops.run");

  const interestPreview = useMemo(
    () => batchPostInterest(ops.users, Number(interestRate) / 100),
    [ops.users, interestRate]
  );
  const feePreview = useMemo(() => batchPostFees(ops.users, Number(feeAmount)), [ops.users, feeAmount]);

  const run = (kind: "interest" | "fees") => {
    if (!permitted) {
      ops.notify("Your role cannot run batch jobs.");
      return;
    }
    const items = kind === "interest" ? interestPreview : feePreview;
    if (items.length === 0) {
      ops.notify("Nothing to process with the current settings.");
      return;
    }
    const grouped = new Map<string, BatchResult[]>();
    for (const item of items) {
      grouped.set(item.key, [...(grouped.get(item.key) ?? []), item]);
    }
    for (const [key, list] of grouped) {
      ops.onUpdateUser(
        key,
        (prev) =>
          applyBatchToProfile(
            prev,
            list.map((l) => ({
              description: l.description,
              amount: l.amount,
              type: kind === "interest" ? "credit" : "debit",
              accountMatch: (a) =>
                kind === "interest"
                  ? a.category === "savings" || a.category === "investment"
                  : a.category === "chequing",
            })),
            actor
          ),
        kind === "interest" ? "BATCH_INTEREST_POSTED" : "BATCH_FEES_POSTED",
        `${kind === "interest" ? "Interest" : "Monthly fees"} posted for ${list.length} account(s) — ${list[0]?.name ?? key}`,
        "warning"
      );
    }
    setLastRun(`${kind === "interest" ? "Interest" : "Fees"} batch · ${items.length} entries · ${nowStamp()}`);
    ops.notify(`${items.length} ${kind === "interest" ? "interest" : "fee"} entries posted.`);
  };

  const totalInterest = interestPreview.reduce((s, i) => s + i.amount, 0);
  const totalFees = feePreview.reduce((s, i) => s + i.amount, 0);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
        <h3 className="text-[17px] font-bold text-nbc-navy">Post monthly interest</h3>
        <p className="mt-1 text-[13px] text-[#565656]">
          Credits one month of interest to every savings and investment account.
        </p>
        <div className="mt-3 max-w-[180px]">
          <Field label="Annual rate (%)">
            <input className={inputCls} type="number" step="0.05" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} />
          </Field>
        </div>
        <dl className="mt-3 space-y-1.5 rounded-[6px] bg-[#faf8f3] p-3 text-[12.5px]">
          <div className="flex justify-between"><dt className="text-[#565656]">Accounts affected</dt><dd className="font-semibold tabular-nums">{interestPreview.length}</dd></div>
          <div className="flex justify-between"><dt className="text-[#565656]">Total interest to credit</dt><dd className="font-semibold tabular-nums text-[#017a33]">{formatMoney(totalInterest)}</dd></div>
        </dl>
        <button type="button" disabled={!permitted} onClick={() => run("interest")} className="mt-3 w-full rounded-full bg-nbc-red py-2.5 text-[13px] font-semibold text-white transition hover:bg-nbc-red-dark disabled:opacity-40">
          Post interest to all accounts
        </button>
      </div>

      <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5">
        <h3 className="text-[17px] font-bold text-nbc-navy">Post monthly account fees</h3>
        <p className="mt-1 text-[13px] text-[#565656]">
          Debits the monthly package fee from every chequing account.
        </p>
        <div className="mt-3 max-w-[180px]">
          <Field label="Fee per account ($)">
            <input className={inputCls} type="number" step="0.05" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} />
          </Field>
        </div>
        <dl className="mt-3 space-y-1.5 rounded-[6px] bg-[#faf8f3] p-3 text-[12.5px]">
          <div className="flex justify-between"><dt className="text-[#565656]">Accounts affected</dt><dd className="font-semibold tabular-nums">{feePreview.length}</dd></div>
          <div className="flex justify-between"><dt className="text-[#565656]">Total fees to debit</dt><dd className="font-semibold tabular-nums">{formatMoney(totalFees)}</dd></div>
        </dl>
        <button type="button" disabled={!permitted} onClick={() => run("fees")} className="mt-3 w-full rounded-full border border-nbc-navy py-2.5 text-[13px] font-semibold text-nbc-navy transition hover:bg-nbc-navy hover:text-white disabled:opacity-40">
          Post fees to all accounts
        </button>
      </div>

      <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 lg:col-span-2">
        <h3 className="text-[16px] font-bold text-nbc-navy">Batch history</h3>
        <p className="mt-1 text-[12.5px] text-[#565656]">{lastRun ?? "No batch has been run in this session."}</p>
        <p className="mt-2 text-[11.5px] leading-[17px] text-[#777]">
          Every entry created by a batch job is written to the client ledger with a <span className="font-mono">BAT-</span> reference
          and recorded in the audit log.
        </p>
      </div>
    </div>
  );
}


/* ------------------------- identity verification ------------------------- */

const DOC_TYPES: ClientDocument["type"][] = [
  "Government photo ID",
  "Proof of address",
  "Proof of income",
  "Business registration",
  "Other",
];

function KycPanel({ ops, selectedKey, actor }: { ops: AdminPanelProps["ops"]; selectedKey: string; actor: string }) {
  const entry = ops.users.find((u) => u.key === selectedKey) ?? ops.users[0];
  const [docType, setDocType] = useState<ClientDocument["type"]>(DOC_TYPES[0]);
  const [fileName, setFileName] = useState("");
  const permitted = can(ops.identity, "clients.edit");

  if (!entry) return null;
  const p = entry.profile;
  const status = p.kycStatus ?? "unverified";
  const docs = p.documents ?? [];

  const setStatus = (next: "unverified" | "pending" | "verified" | "rejected") => {
    if (!permitted) {
      ops.notify("Your role cannot change verification status.");
      return;
    }
    ops.onUpdateUser(
      entry.key,
      (prevProfile) => ({
        ...prevProfile,
        kycStatus: next,
        kycReference: next === "verified" ? `KYC-${Math.floor(100000 + Math.random() * 899999)}` : prevProfile.kycReference,
      }),
      "KYC_STATUS_CHANGED",
      `Identity verification for ${p.fullName} set to ${next}`,
      next === "rejected" ? "critical" : "info"
    );
    ops.notify(`Verification status updated to ${next}.`);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 lg:col-span-5">
        <h3 className="text-[17px] font-bold text-nbc-navy">{p.fullName}</h3>
        <p className="text-[12.5px] text-[#565656]">{p.email}</p>

        <div className="mt-4 rounded-[6px] bg-[#faf8f3] p-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#777]">Current status</span>
          <p
            className={`text-[17px] font-bold capitalize ${
              status === "verified" ? "text-[#017a33]" : status === "rejected" ? "text-nbc-red" : status === "pending" ? "text-[#8a6d3b]" : "text-[#121212]"
            }`}
          >
            {status}
          </p>
          {p.kycReference && <p className="font-mono text-[11.5px] text-[#777]">{p.kycReference}</p>}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" disabled={!permitted} onClick={() => setStatus("verified")} className="rounded-[6px] bg-[#017a33] py-2 text-[12.5px] font-semibold text-white disabled:opacity-40">Approve identity</button>
          <button type="button" disabled={!permitted} onClick={() => setStatus("rejected")} className="rounded-[6px] bg-rose-100 py-2 text-[12.5px] font-semibold text-rose-700 disabled:opacity-40">Reject</button>
          <button type="button" disabled={!permitted} onClick={() => setStatus("pending")} className="rounded-[6px] border border-[#c9c3b6] py-2 text-[12.5px] font-semibold text-nbc-navy disabled:opacity-40">Mark pending</button>
          <button type="button" disabled={!permitted} onClick={() => setStatus("unverified")} className="rounded-[6px] border border-[#c9c3b6] py-2 text-[12.5px] font-semibold text-nbc-navy disabled:opacity-40">Reset</button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!fileName.trim()) return;
            const doc: ClientDocument = {
              id: newId("doc"),
              type: docType,
              fileName: fileName.trim(),
              uploadedAt: nowStamp(),
              status: "received",
            };
            ops.onUpdateUser(entry.key, (prevProfile) => ({ ...prevProfile, documents: [doc, ...(prevProfile.documents ?? [])], kycStatus: prevProfile.kycStatus ?? "pending" }), "KYC_DOCUMENT_ADDED", `Added ${doc.type} for ${p.fullName}`, "info");
            setFileName("");
            ops.notify("Document attached to the file.");
          }}
          className="mt-4 space-y-2 border-t border-[#efefef] pt-4"
        >
          <Field label="Attach a document">
            <select className={inputCls} value={docType} onChange={(e) => setDocType(e.target.value as ClientDocument["type"])}>
              {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </Field>
          <input className={inputCls} value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="File reference, e.g. drivers-licence-2026.pdf" />
          <button type="submit" disabled={!permitted} className="w-full rounded-[6px] border border-[#c9c3b6] py-2 text-[12.5px] font-semibold text-nbc-navy disabled:opacity-40">+ Attach document</button>
        </form>
      </div>

      <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 lg:col-span-7">
        <h3 className="text-[16px] font-bold text-nbc-navy">Documents on file ({docs.length})</h3>
        <ul className="mt-2 divide-y divide-[#efefef]">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-[12.5px]">
              <div className="min-w-0">
                <p className="font-semibold text-[#121212]">{d.type}</p>
                <p className="truncate font-mono text-[11.5px] text-[#777]">{d.fileName} · {d.uploadedAt}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#f4f1ea] px-2 py-0.5 text-[10.5px] font-semibold capitalize text-[#565656]">{d.status}</span>
                <button
                  type="button"
                  onClick={() => ops.onUpdateUser(entry.key, (prevProfile) => ({ ...prevProfile, documents: (prevProfile.documents ?? []).filter((x) => x.id !== d.id) }), "KYC_DOCUMENT_REMOVED", `Removed document ${d.fileName}`, "warning")}
                  className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
          {docs.length === 0 && <li className="py-4 text-[12.5px] text-[#777]">No documents attached.</li>}
        </ul>
        <p className="mt-3 text-[11.5px] leading-[17px] text-[#777]">
          Files are referenced by name only — this console does not store document contents. Added by {actor}.
        </p>
      </div>
    </div>
  );
}

/* -------------------------- client messages -------------------------- */

function MessagePanel({ ops, selectedKey, actor }: { ops: AdminPanelProps["ops"]; selectedKey: string; actor: string }) {
  const entry = ops.users.find((u) => u.key === selectedKey) ?? ops.users[0];
  const [channel, setChannel] = useState<ClientMessage["channel"]>("Secure message");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const permitted = can(ops.identity, "clients.edit");

  if (!entry) return null;
  const messages = entry.profile.messages ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!subject.trim() || !body.trim()) {
            ops.notify("Add a subject and a message.");
            return;
          }
          const msg: ClientMessage = {
            id: newId("msg"),
            sentAt: nowStamp(),
            channel,
            subject: subject.trim(),
            body: body.trim(),
            sentBy: actor,
          };
          ops.onUpdateUser(entry.key, (prevProfile) => ({ ...prevProfile, messages: [msg, ...(prevProfile.messages ?? [])] }), "CLIENT_MESSAGE_SENT", `${channel} to ${entry.profile.fullName}: ${msg.subject}`, "info");
          setSubject("");
          setBody("");
          ops.notify(`Message recorded for ${entry.profile.fullName}.`);
        }}
        className="space-y-3 rounded-[6px] border border-[#e5e2da] bg-white p-5 lg:col-span-5"
      >
        <h3 className="text-[17px] font-bold text-nbc-navy">Send a message</h3>
        <p className="text-[12.5px] text-[#565656]">
          To {entry.profile.fullName} · {entry.profile.email}
        </p>
        <Field label="Channel">
          <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value as ClientMessage["channel"])}>
            <option>Secure message</option>
            <option>Email</option>
            <option>SMS</option>
          </select>
        </Field>
        <Field label="Subject">
          <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g., Your November statement is ready" />
        </Field>
        <Field label="Message">
          <textarea className={`${inputCls} min-h-[110px]`} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write the message the client will receive…" />
        </Field>
        <button type="submit" disabled={!permitted} className="w-full rounded-full bg-nbc-red py-2.5 text-[13px] font-semibold text-white disabled:opacity-40">Send message</button>
        {!permitted && <p className="text-[11.5px] text-[#777]">Your role has read-only access.</p>}
      </form>

      <div className="rounded-[6px] border border-[#e5e2da] bg-white p-5 lg:col-span-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[16px] font-bold text-nbc-navy">Communication history ({messages.length})</h3>
          <button type="button" onClick={() => downloadFile(`messages-${entry.profile.email}-${todayIso()}.csv`, ["Sent,Channel,Subject,Sent by", ...messages.map((m) => `"${m.sentAt}","${m.channel}","${m.subject.replace(/"/g, '""')}","${m.sentBy}"`)].join("\n"))} className="text-[12px] font-semibold text-[#1572C5] underline decoration-1 underline-offset-2">Export</button>
        </div>
        <ul className="mt-2 divide-y divide-[#efefef]">
          {messages.map((m) => (
            <li key={m.id} className="py-2.5 text-[12.5px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[#121212]">{m.subject}</p>
                <span className="text-[11px] text-[#777]">{m.sentAt}</span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[#565656]">{m.body}</p>
              <p className="mt-0.5 text-[11px] text-[#999]">{m.channel} · sent by {m.sentBy}</p>
            </li>
          ))}
          {messages.length === 0 && <li className="py-4 text-[12.5px] text-[#777]">No messages sent to this client yet.</li>}
        </ul>
      </div>
    </div>
  );
}
