import { useState } from "react";
import { AdminPanelProps, can, downloadFile, todayIso } from "../../banking/adminOps";

export default function AdminApprovals({ ops }: AdminPanelProps) {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const permitted = can(ops.identity, "approvals.act");

  const rows = ops.approvals.filter((a) => statusFilter === "all" || a.status === statusFilter);
  const pendingCount = ops.approvals.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[22px] font-bold text-nbc-navy sm:text-[24px]">Approvals queue</h2>
          <p className="mt-0.5 text-[13.5px] text-[#565656]">
            Sensitive changes are held for a second authorisation before they take effect.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            downloadFile(
              `approvals-${todayIso()}.csv`,
              [
                "Requested,Requested by,Action,Detail,Target,Status,Decided,Decided by",
                ...ops.approvals.map((a) =>
                  [a.requestedAt, a.requestedBy, a.action, a.detail, a.targetKey, a.status, a.decidedAt ?? "", a.decidedBy ?? ""]
                    .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                    .join(",")
                ),
              ].join("\n")
            )
          }
          className="rounded-full border border-[#c9c3b6] bg-white px-4 py-2 text-[13px] font-semibold text-nbc-navy hover:border-nbc-navy"
        >
          Export queue
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Awaiting decision" value={String(pendingCount)} tone={pendingCount > 0 ? "amber" : "green"} />
        <Summary label="Approved" value={String(ops.approvals.filter((a) => a.status === "approved").length)} tone="green" />
        <Summary label="Rejected" value={String(ops.approvals.filter((a) => a.status === "rejected").length)} tone="dark" />
      </div>

      <div className="flex flex-wrap gap-2 rounded-[6px] border border-[#e5e2da] bg-white p-3">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold capitalize transition ${
              statusFilter === s ? "bg-nbc-navy text-white" : "bg-[#f4f1ea] text-nbc-navy hover:bg-[#e8e3d8]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-[6px] border border-[#e5e2da] bg-white">
        <ul className="divide-y divide-[#efefef]">
          {rows.map((a) => {
            const target = ops.users.find((u) => u.key === a.targetKey)?.profile.fullName ?? a.targetKey;
            return (
              <li key={a.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#f4f1ea] px-2 py-0.5 font-mono text-[10.5px] font-bold text-[#565656]">
                        {a.action}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${
                          a.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : a.status === "rejected"
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {a.status}
                      </span>
                      <span className="text-[11.5px] text-[#777]">{a.requestedAt}</span>
                    </div>
                    <p className="mt-1 break-words text-[13.5px] font-semibold text-[#121212]">{a.label}</p>
                    <p className="break-words text-[12.5px] text-[#565656]">{a.detail}</p>
                    <p className="mt-0.5 text-[11.5px] text-[#777]">
                      Client: <strong className="font-semibold text-[#444]">{target}</strong> · requested by {a.requestedBy}
                      {a.decidedBy ? ` · decided by ${a.decidedBy} at ${a.decidedAt}` : ""}
                    </p>
                  </div>

                  {a.status === "pending" && (
                    <div className="flex flex-none gap-2">
                      <button
                        type="button"
                        disabled={!permitted}
                        onClick={() => ops.onDecideApproval(a.id, "approved")}
                        className="rounded-full bg-[#017a33] px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={!permitted}
                        onClick={() => ops.onDecideApproval(a.id, "rejected")}
                        className="rounded-full bg-rose-100 px-3.5 py-1.5 text-[12px] font-semibold text-rose-700 disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-4 py-10 text-center text-[13px] text-[#565656]">
              Nothing in this queue. Sensitive actions submitted by operations staff will appear here.
            </li>
          )}
        </ul>
      </div>

      <div className="rounded-[6px] border border-[#e5e2da] bg-[#fcfbf8] p-4 text-[12px] leading-[18px] text-[#565656]">
        <strong className="text-nbc-navy">How approvals work.</strong> Operations officers can submit balance overrides, account
        closures, card issuance and published rate changes, but those actions stay pending until a super administrator
        approves them. Rejections and approvals are both written to the audit log.
        {!permitted && " Your current role can view this queue but cannot decide items."}
      </div>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "dark" }) {
  const color = tone === "green" ? "text-[#017a33]" : tone === "amber" ? "text-[#8a6d3b]" : "text-[#121212]";
  return (
    <div className="rounded-[6px] border border-[#e5e2da] bg-white px-4 py-3">
      <p className="text-[11.5px] text-[#777]">{label}</p>
      <p className={`mt-0.5 text-[20px] font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
