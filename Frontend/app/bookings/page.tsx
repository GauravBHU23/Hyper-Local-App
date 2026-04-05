"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, MapPin, Clock, Loader2, X, Star, CreditCard, ShieldCheck, LifeBuoy, Receipt } from "lucide-react";
import { bookingsApi, paymentsApi, reviewsApi, supportApi } from "@/lib/api";
import { Navbar } from "@/components/layout/Navbar";
import type { Booking, BookingStatus, Payment, PaymentInvoice, SupportTicket } from "@/types";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "@/types";
import { formatCurrency, formatDate, getStatusColor, cn, getMapsDirectionsLink } from "@/lib/utils";
import toast from "react-hot-toast";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const STATUS_TABS: { label: string; value: BookingStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "in_progress" },
  { label: "Done", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export default function BookingsPage() {
  const [activeTab, setActiveTab] = useState<BookingStatus | "all">("all");
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rating: number; comment: string; open: boolean }>>({});
  const [rescheduleDrafts, setRescheduleDrafts] = useState<Record<string, { value: string; open: boolean }>>({});
  const [supportDrafts, setSupportDrafts] = useState<Record<string, { title: string; message: string; open: boolean }>>({});
  const queryClient = useQueryClient();

  useEffect(() => {
    if (window.Razorpay || document.querySelector('script[data-razorpay-checkout="true"]')) {
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    document.body.appendChild(script);
  }, []);

  const openInvoiceWindow = (invoice: PaymentInvoice) => {
    const popup = window.open("", "_blank", "width=900,height=700");
    if (!popup) {
      toast.error("Please allow popups to view the pay bill.");
      return;
    }
    popup.document.write(`
      <html>
        <head>
          <title>${invoice.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; }
            .box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-top: 16px; }
            h1,h2,p { margin: 0; }
            .muted { color: #64748b; }
          </style>
        </head>
        <body>
          <h1>Payment Invoice</h1>
          <p class="muted">Invoice No: ${invoice.invoice_number}</p>
          <p class="muted">Issued: ${new Date(invoice.issued_at).toLocaleString("en-IN")}</p>
          <div class="box">
            <h2>Customer</h2>
            <p>${invoice.customer.name}</p>
            <p class="muted">${invoice.customer.email}</p>
          </div>
          <div class="box">
            <h2>Provider</h2>
            <p>${invoice.provider.business_name}</p>
            <p class="muted">${invoice.provider.city || ""}</p>
          </div>
          <div class="box">
            <h2>Booking</h2>
            <p>${invoice.booking.problem_description}</p>
            <div class="row"><span>Status</span><strong>${invoice.booking.status}</strong></div>
            <div class="row"><span>Address</span><strong>${invoice.booking.service_address || "-"}</strong></div>
          </div>
          <div class="box">
            <h2>Payment</h2>
            <div class="row"><span>Method</span><strong>${invoice.payment.method}</strong></div>
            <div class="row"><span>Status</span><strong>${invoice.payment.status}</strong></div>
            <div class="row"><span>Amount</span><strong>${formatCurrency(invoice.payment.amount)}</strong></div>
            <div class="row"><span>Reference</span><strong>${invoice.payment.gateway_reference || "-"}</strong></div>
          </div>
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `);
    popup.document.close();
  };

  const openRazorpayCheckout = async (payment: Payment) => {
    if (!payment.gateway_order_id || !payment.gateway_key_id || !window.Razorpay) {
      throw new Error("Payment gateway is not ready right now.");
    }
    const RazorpayCheckout = window.Razorpay;
    return new Promise<void>((resolve, reject) => {
      const razorpay = new RazorpayCheckout({
        key: payment.gateway_key_id,
        amount: Math.round(payment.amount * 100),
        currency: "INR",
        name: "HyperLocal",
        description: "Service booking payment",
        order_id: payment.gateway_order_id,
        handler: async (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            await paymentConfirmMutation.mutateAsync({
              paymentId: payment.id,
              payload: {
                gateway_payment_id: response.razorpay_payment_id,
                gateway_signature: response.razorpay_signature,
              },
            });
            const invoiceRes = await paymentsApi.getInvoice(payment.id);
            openInvoiceWindow(invoiceRes.data as PaymentInvoice);
            resolve();
          } catch (error) {
            reject(error);
          }
        },
        modal: {
          ondismiss: () => reject(new Error("Payment popup closed")),
        },
        theme: { color: "#f97316" },
      });
      razorpay.open();
    });
  };

  const { data: bookings, isLoading } = useQuery({
    queryKey: ["bookings", activeTab],
    queryFn: () =>
      bookingsApi
        .getMy(activeTab !== "all" ? { status: activeTab } : undefined)
        .then((r) => r.data as Booking[]),
  });
  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: () => paymentsApi.getMy().then((r) => r.data as Payment[]),
  });
  const supportTicketsQuery = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => supportApi.getMy().then((r) => r.data as SupportTicket[]),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.cancel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      toast.success("Booking cancelled");
    },
    onError: () => toast.error("Could not cancel the booking"),
  });
  const rescheduleMutation = useMutation({
    mutationFn: ({ id, scheduled_at }: { id: string; scheduled_at: string }) =>
      bookingsApi.update(id, { scheduled_at }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setRescheduleDrafts((prev) => ({
        ...prev,
        [variables.id]: { value: "", open: false },
      }));
      toast.success("Booking rescheduled");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Could not reschedule booking"),
  });

  const reviewMutation = useMutation({
    mutationFn: (payload: { bookingId: string; providerId: string; rating: number; comment: string }) =>
      reviewsApi.create({
        booking_id: payload.bookingId,
        provider_id: payload.providerId,
        rating: payload.rating,
        comment: payload.comment,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setReviewDrafts((prev) => ({
        ...prev,
        [variables.bookingId]: { rating: 5, comment: "", open: false },
      }));
      toast.success("Review submitted");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Could not submit review"),
  });
  const paymentCreateMutation = useMutation({
    mutationFn: ({ bookingId, method }: { bookingId: string; method: "online" | "cod" | "manual_upi" }) =>
      paymentsApi.createForBooking(bookingId, method as "online" | "cod"),
    onSuccess: async (response) => {
      const payment = response.data as Payment;
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      if (payment.gateway_name === "razorpay" && payment.gateway_order_id && payment.gateway_key_id) {
        try {
          await openRazorpayCheckout(payment);
          return;
        } catch (err: any) {
          const message = err?.message || err?.response?.data?.detail;
          if (message && message !== "Payment popup closed") {
            toast.error(message);
          }
          return;
        }
      }
      if (payment.upi_link) {
        window.location.href = payment.upi_link;
      }
      toast.success(payment.gateway_status_message || "Payment initiated");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Could not create payment"),
  });
  const paymentConfirmMutation = useMutation({
    mutationFn: ({ paymentId, payload }: { paymentId: string; payload?: { gateway_payment_id?: string; gateway_signature?: string } }) =>
      paymentsApi.confirm(paymentId, payload),
    onSuccess: async (response) => {
      const payment = response.data as Payment;
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Payment confirmed");
      try {
        const invoiceRes = await paymentsApi.getInvoice(payment.id);
        openInvoiceWindow(invoiceRes.data as PaymentInvoice);
      } catch {
        toast.error("Payment done, but invoice could not be opened.");
      }
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Could not confirm payment"),
  });
  const supportMutation = useMutation({
    mutationFn: (payload: { booking_id: string; title: string; message: string }) =>
      supportApi.createTicket(payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      setSupportDrafts((prev) => ({
        ...prev,
        [variables.booking_id]: { title: "", message: "", open: false },
      }));
      toast.success("Support request created");
    },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Could not create support request"),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">My Bookings</h1>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0",
                activeTab === tab.value
                  ? "bg-orange-500 text-white"
                  : "bg-white border border-slate-200 text-slate-600"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-orange-500" size={32} />
          </div>
        ) : bookings?.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Calendar size={40} className="mx-auto mb-3 opacity-30" />
            <p>No bookings yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bookings?.map((booking) => (
              <div key={booking.id} className="card">
                {(() => {
                  const payment = paymentsQuery.data?.find((item) => item.booking_id === booking.id);
                  const relatedTickets = supportTicketsQuery.data?.filter((item) => item.booking_id === booking.id) || [];
                  return (
                    <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {booking.provider && (
                      <div className="w-11 h-11 rounded-2xl bg-orange-50 flex items-center justify-center text-xl shrink-0">
                        {CATEGORY_ICONS[booking.provider.category]}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm text-slate-900">
                        {booking.provider?.business_name || "Service Provider"}
                      </p>
                      {booking.provider && (
                        <p className="text-xs text-slate-500">
                          {CATEGORY_LABELS[booking.provider.category]}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className={cn("badge text-xs shrink-0", getStatusColor(booking.status))}>
                    {booking.status.replace("_", " ")}
                  </span>
                </div>

                <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                  {booking.problem_description}
                </p>

                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  {booking.scheduled_at && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock size={11} />
                      {formatDate(booking.scheduled_at)}
                    </span>
                  )}
                  {booking.service_address && (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <MapPin size={11} />
                      {booking.service_address}
                    </span>
                  )}
                  {(booking.service_address || (booking.service_latitude && booking.service_longitude)) && (
                    <a
                      href={getMapsDirectionsLink({
                        address: booking.service_address,
                        latitude: booking.service_latitude,
                        longitude: booking.service_longitude,
                      })}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-orange-600 hover:text-orange-700"
                    >
                      Open in Maps
                    </a>
                  )}
                  {(booking.estimated_cost || booking.final_cost) && (
                    <span className="text-xs font-semibold text-orange-600">
                      {formatCurrency(booking.final_cost || booking.estimated_cost!)}
                    </span>
                  )}
                </div>

                {booking.ai_suggested && (
                  <div className="mt-2">
                    <span className="badge bg-purple-50 text-purple-700 text-xs">AI Suggested</span>
                  </div>
                )}

                {booking.service_otp && ["confirmed", "in_progress"].includes(booking.status) && (
                  <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50/80 p-3">
                    <div className="flex items-start gap-2">
                      <ShieldCheck size={16} className="mt-0.5 text-emerald-600" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                          Service OTP
                        </p>
                        <p className="mt-1 text-xl font-bold tracking-[0.35em] text-emerald-900">
                          {booking.service_otp}
                        </p>
                        <p className="mt-1 text-xs text-emerald-700">
                          Share this OTP with the provider only after the job is completed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {booking.status === "pending" && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => cancelMutation.mutate(booking.id)}
                      disabled={cancelMutation.isPending}
                      className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      <X size={13} />
                      Cancel Booking
                    </button>
                  </div>
                )}

                {(booking.status === "pending" || booking.status === "confirmed") && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {rescheduleDrafts[booking.id]?.open ? (
                      <div className="space-y-3">
                        <input
                          type="datetime-local"
                          className="input"
                          value={rescheduleDrafts[booking.id]?.value || ""}
                          onChange={(e) =>
                            setRescheduleDrafts((prev) => ({
                              ...prev,
                              [booking.id]: {
                                value: e.target.value,
                                open: true,
                              },
                            }))
                          }
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const value = rescheduleDrafts[booking.id]?.value;
                              if (!value) {
                                toast.error("Please choose a new date and time");
                                return;
                              }
                              rescheduleMutation.mutate({
                                id: booking.id,
                                scheduled_at: new Date(value).toISOString(),
                              });
                            }}
                            disabled={rescheduleMutation.isPending}
                            className="btn-primary text-sm"
                          >
                            Save new slot
                          </button>
                          <button
                            onClick={() =>
                              setRescheduleDrafts((prev) => ({
                                ...prev,
                                [booking.id]: { value: "", open: false },
                              }))
                            }
                            className="btn-secondary text-sm"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setRescheduleDrafts((prev) => ({
                            ...prev,
                            [booking.id]: {
                              value: booking.scheduled_at
                                ? new Date(booking.scheduled_at).toISOString().slice(0, 16)
                                : "",
                              open: true,
                            },
                          }))
                        }
                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        Reschedule booking
                      </button>
                    )}
                  </div>
                )}

                {(booking.status === "pending" || booking.status === "confirmed" || booking.status === "in_progress" || booking.status === "completed") && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Payment options
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        Razorpay popup me card, UPI, netbanking, wallet aur EMI options milenge.
                      </p>
                    </div>
                    {payment?.status === "paid" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-600">
                          <CreditCard size={13} />
                          Payment completed
                        </span>
                        <button
                          onClick={async () => {
                            try {
                              const invoiceRes = await paymentsApi.getInvoice(payment.id);
                              openInvoiceWindow(invoiceRes.data as PaymentInvoice);
                            } catch (err: any) {
                              toast.error(err.response?.data?.detail || "Could not open invoice");
                            }
                          }}
                          className="btn-secondary text-sm"
                        >
                          <Receipt size={13} />
                          Download bill
                        </button>
                      </div>
                    ) : payment ? (
                      <div className="space-y-3">
                        {payment.payment_instructions ? (
                          <p className="text-xs text-slate-600">{payment.payment_instructions}</p>
                        ) : null}
                        {payment.upi_id ? (
                          <div className="rounded-2xl border border-green-100 bg-green-50 p-3 text-sm">
                            <p className="font-semibold text-green-800">Manual UPI</p>
                            <p className="mt-1 text-green-700">
                              Pay to: <span className="font-mono">{payment.upi_id}</span>
                            </p>
                            {payment.upi_name ? (
                              <p className="text-xs text-green-700">Name: {payment.upi_name}</p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          {payment.upi_link ? (
                            <a
                              href={payment.upi_link}
                              className="btn-secondary text-sm"
                            >
                              Open UPI app
                            </a>
                          ) : null}
                          {payment.method === "cod" ? (
                            <span className="inline-flex items-center rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                              Cash will be collected by provider
                            </span>
                          ) : (
                            <button
                              onClick={() => {
                                if (payment.gateway_name === "razorpay" && payment.gateway_order_id && payment.gateway_key_id) {
                                  openRazorpayCheckout(payment).catch((err: any) => {
                                    const message = err?.message || err?.response?.data?.detail;
                                    if (message && message !== "Payment popup closed") {
                                      toast.error(message);
                                    }
                                  });
                                  return;
                                }
                                paymentConfirmMutation.mutate({ paymentId: payment.id });
                              }}
                              disabled={paymentConfirmMutation.isPending}
                              className="btn-primary text-sm"
                            >
                              {payment.gateway_name === "razorpay" ? "Pay with card / UPI" : "I have paid"}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => paymentCreateMutation.mutate({ bookingId: booking.id, method: "manual_upi" })}
                          disabled={paymentCreateMutation.isPending}
                          className="btn-primary text-sm"
                        >
                          Pay via free UPI
                        </button>
                        <button
                          onClick={() => paymentCreateMutation.mutate({ bookingId: booking.id, method: "cod" })}
                          disabled={paymentCreateMutation.isPending}
                          className="btn-secondary text-sm"
                        >
                          Cash on delivery
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {booking.status === "completed" && !booking.has_review && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {reviewDrafts[booking.id]?.open ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              onClick={() =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [booking.id]: {
                                    rating: value,
                                    comment: prev[booking.id]?.comment || "",
                                    open: true,
                                  },
                                }))
                              }
                              className="rounded-lg p-1"
                            >
                              <Star
                                size={18}
                                className={cn(
                                  (reviewDrafts[booking.id]?.rating || 5) >= value
                                    ? "fill-orange-400 text-orange-400"
                                    : "text-slate-300"
                                )}
                              />
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={reviewDrafts[booking.id]?.comment || ""}
                          onChange={(e) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [booking.id]: {
                                rating: prev[booking.id]?.rating || 5,
                                comment: e.target.value,
                                open: true,
                              },
                            }))
                          }
                          className="input min-h-24 resize-none"
                          placeholder="How was your experience?"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const draft = reviewDrafts[booking.id] || { rating: 5, comment: "", open: true };
                              reviewMutation.mutate({
                                bookingId: booking.id,
                                providerId: booking.provider_id,
                                rating: draft.rating,
                                comment: draft.comment,
                              });
                            }}
                            disabled={reviewMutation.isPending}
                            className="btn-primary text-sm"
                          >
                            Submit review
                          </button>
                          <button
                            onClick={() =>
                              setReviewDrafts((prev) => ({
                                ...prev,
                                [booking.id]: { rating: 5, comment: "", open: false },
                              }))
                            }
                            className="btn-secondary text-sm"
                          >
                            Close
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setReviewDrafts((prev) => ({
                            ...prev,
                            [booking.id]: { rating: 5, comment: "", open: true },
                          }))
                        }
                        className="text-xs font-medium text-orange-600 hover:text-orange-700"
                      >
                        Leave a review
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-3 border-t border-slate-100 pt-3">
                  {relatedTickets.length ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {relatedTickets.map((ticket) => (
                        <span key={ticket.id} className="badge bg-slate-100 text-slate-700 text-xs">
                          Support: {ticket.status.replace("_", " ")}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {supportDrafts[booking.id]?.open ? (
                    <div className="space-y-3">
                      <input
                        className="input"
                        placeholder="Issue title"
                        value={supportDrafts[booking.id]?.title || ""}
                        onChange={(e) =>
                          setSupportDrafts((prev) => ({
                            ...prev,
                            [booking.id]: {
                              title: e.target.value,
                              message: prev[booking.id]?.message || "",
                              open: true,
                            },
                          }))
                        }
                      />
                      <textarea
                        className="input min-h-24 resize-none"
                        placeholder="Describe the issue or dispute"
                        value={supportDrafts[booking.id]?.message || ""}
                        onChange={(e) =>
                          setSupportDrafts((prev) => ({
                            ...prev,
                            [booking.id]: {
                              title: prev[booking.id]?.title || "Need help with this booking",
                              message: e.target.value,
                              open: true,
                            },
                          }))
                        }
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const draft = supportDrafts[booking.id];
                            if (!draft?.title || !draft?.message) {
                              toast.error("Please add issue title and details");
                              return;
                            }
                            supportMutation.mutate({
                              booking_id: booking.id,
                              title: draft.title,
                              message: draft.message,
                            });
                          }}
                          disabled={supportMutation.isPending}
                          className="btn-primary text-sm"
                        >
                          Submit issue
                        </button>
                        <button
                          onClick={() =>
                            setSupportDrafts((prev) => ({
                              ...prev,
                              [booking.id]: { title: "", message: "", open: false },
                            }))
                          }
                          className="btn-secondary text-sm"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        setSupportDrafts((prev) => ({
                          ...prev,
                          [booking.id]: {
                            title: "Need help with this booking",
                            message: "",
                            open: true,
                          },
                        }))
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      <LifeBuoy size={13} />
                      Raise support issue
                    </button>
                  )}
                </div>
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
