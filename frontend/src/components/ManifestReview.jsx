/**
 * ManifestReview — Review screen for manifest orders before submit.
 *
 * Shows all orders in a list. Each must be individually "Reviewed"
 * (specimen type + volume validated). Only reviewed+valid orders
 * can be submitted. Invalid orders are flagged for correction.
 */
import { useState } from "react";
import { MV } from "../theme";
import { validateOrder } from "../services/specimenValidator";

export default function ManifestReview({
  orders,
  orderType,
  onBack,
  onSubmitApproved,
}) {
  // Track review status per order: null (not reviewed), "valid", "invalid"
  const [reviewStatus, setReviewStatus] = useState(
    orders.map(() => ({ status: null, errors: [] })),
  );

  const handleReview = (index) => {
    const result = validateOrder(orders[index], orderType);
    const updated = [...reviewStatus];
    updated[index] = {
      status: result.valid ? "valid" : "invalid",
      errors: result.errors,
    };
    setReviewStatus(updated);
  };

  const isVet = orderType === "veterinary";
  const approvedCount = reviewStatus.filter((r) => r.status === "valid").length;
  const invalidCount = reviewStatus.filter((r) => r.status === "invalid").length;
  const unreviewedCount = reviewStatus.filter((r) => r.status === null).length;
  const allReviewed = unreviewedCount === 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold m-0" style={{ color: MV.text }}>
            Review Orders ({orders.length})
          </h3>
          <div className="text-xs mt-1 flex gap-3" style={{ color: MV.textMuted }}>
            {approvedCount > 0 && (
              <span style={{ color: MV.success }}>{"\u2713"} {approvedCount} approved</span>
            )}
            {invalidCount > 0 && (
              <span style={{ color: MV.danger }}>{"\u2717"} {invalidCount} invalid</span>
            )}
            {unreviewedCount > 0 && (
              <span>{"\u25CB"} {unreviewedCount} pending review</span>
            )}
          </div>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-md text-sm font-semibold cursor-pointer"
          style={{ backgroundColor: MV.white, color: MV.textMuted, border: `1px solid ${MV.gray200}` }}
        >
          Back to Orders
        </button>
      </div>

      {/* Order review list */}
      <div className="flex flex-col gap-3 mb-5">
        {orders.map((order, i) => {
          const review = reviewStatus[i];
          const borderColor =
            review.status === "valid" ? MV.successBorder :
            review.status === "invalid" ? MV.dangerBorder :
            MV.gray200;
          const bgColor =
            review.status === "valid" ? MV.successLight :
            review.status === "invalid" ? MV.dangerLight :
            MV.white;

          return (
            <div
              key={i}
              className="rounded-lg p-4"
              style={{ border: `1px solid ${borderColor}`, backgroundColor: bgColor }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Order number */}
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{
                      backgroundColor: review.status === "valid" ? MV.success : review.status === "invalid" ? MV.danger : MV.gray300,
                      color: "#fff",
                    }}
                  >
                    {review.status === "valid" ? "\u2713" : review.status === "invalid" ? "\u2717" : i + 1}
                  </span>

                  {/* Patient summary */}
                  <div>
                    <div className="text-sm font-semibold" style={{ color: MV.text }}>
                      {isVet
                        ? `${order.patient.owner_name || "?"} — ${order.patient.name || "?"} (${order.patient.species || "?"})`
                        : `${order.patient.name || "?"}, ${order.patient.first_name || "?"}`
                      }
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: MV.textMuted }}>
                      {order.tests.length} test{order.tests.length !== 1 ? "s" : ""}:
                      {" "}{order.tests.map((t) => t.code).join(", ") || "none"}
                    </div>
                  </div>
                </div>

                {/* Review button */}
                <div className="flex items-center gap-2">
                  {review.status === "valid" && (
                    <span className="text-xs font-bold" style={{ color: MV.success }}>Approved</span>
                  )}
                  {review.status === "invalid" && (
                    <span className="text-xs font-bold" style={{ color: MV.danger }}>Invalid</span>
                  )}
                  <button
                    onClick={() => handleReview(i)}
                    className="px-3 py-1.5 rounded-md text-xs font-bold cursor-pointer border-none"
                    style={{
                      backgroundColor: review.status === null ? MV.teal : MV.gray200,
                      color: review.status === null ? "#fff" : MV.textMuted,
                    }}
                  >
                    {review.status === null ? "Review" : "Re-check"}
                  </button>
                </div>
              </div>

              {/* Validation errors */}
              {review.status === "invalid" && review.errors.length > 0 && (
                <div className="mt-3 pl-10">
                  {review.errors.map((e, j) => (
                    <div key={j} className="text-xs" style={{ color: MV.danger }}>
                      {"\u2717"} {e.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit approved orders */}
      <div
        className="flex items-center justify-between px-5 py-4 rounded-lg"
        style={{ backgroundColor: MV.white, border: `1px solid ${MV.gray200}`, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        <div className="text-sm" style={{ color: MV.textMuted }}>
          {approvedCount} of {orders.length} orders ready to submit
        </div>
        <button
          onClick={() => {
            const approvedOrders = orders.filter((_, i) => reviewStatus[i].status === "valid");
            onSubmitApproved(approvedOrders);
          }}
          disabled={approvedCount === 0}
          className="px-8 py-2.5 rounded-md border-none cursor-pointer text-[15px] font-bold disabled:opacity-50"
          style={{ background: MV.greenGrad, color: "#fff", boxShadow: "0 2px 10px rgba(40, 111, 31, 0.3)" }}
        >
          Submit {approvedCount} Approved Order{approvedCount !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
