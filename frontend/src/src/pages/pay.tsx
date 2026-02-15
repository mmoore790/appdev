import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, CreditCard, Loader2, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";

const envStripeKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY?.trim();

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function CheckoutForm({
  clientSecret,
  amount,
  currency,
  description,
  businessName,
  onSuccess,
}: {
  clientSecret: string;
  amount: number;
  currency: string;
  description: string;
  businessName?: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payments/success`,
        receipt_email: undefined,
        payment_method_data: {
          billing_details: {
            address: { country: "GB" },
          },
        },
      },
    });

    if (submitError) {
      setError(submitError.message || "Payment failed");
      setIsLoading(false);
      return;
    }

    onSuccess();
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="rounded-lg border bg-slate-50 p-4">
        <p className="text-sm font-medium text-slate-700">{description}</p>
        <p className="mt-2 text-2xl font-bold text-emerald-700">
          {formatAmount(amount, currency)}
        </p>
        {businessName && (
          <p className="mt-1 text-sm text-slate-600">Pay {businessName}</p>
        )}
      </div>

      <PaymentElement options={{ layout: "tabs" }} />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-700"
        disabled={!stripe || isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            Pay {formatAmount(amount, currency)}
          </>
        )}
      </Button>
    </form>
  );
}

export default function Pay() {
  const [, params] = useRoute<{ ref: string }>("/pay/:ref");
  const ref = params?.ref ?? "";
  const [status, setStatus] = useState<"loading" | "form" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [paymentData, setPaymentData] = useState<{
    clientSecret: string;
    amount: number;
    currency: string;
    description: string;
    businessName?: string;
  } | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(
    () => (envStripeKey ? loadStripe(envStripeKey) : null)
  );
  const [keyLoadFailed, setKeyLoadFailed] = useState(false);

  useEffect(() => {
    if (!ref) {
      setStatus("error");
      setError("Invalid payment link");
      return;
    }

    const init = async () => {
      try {
        const result = await api.post<{ clientSecret?: string; amount?: number; currency?: string; description?: string; businessName?: string; error?: string }>(
          "/api/payments/init",
          { checkoutReference: decodeURIComponent(ref) }
        );

        if ("error" in result && result.error) {
          setError(result.error);
          setStatus("error");
          return;
        }

        if (result.clientSecret && result.amount != null) {
          setPaymentData({
            clientSecret: result.clientSecret,
            amount: result.amount,
            currency: result.currency || "GBP",
            description: result.description || "Payment",
            businessName: result.businessName,
          });
          setStatus("form");
        } else {
          setError("Invalid payment data");
          setStatus("error");
        }
      } catch (err: unknown) {
        const msg = err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to load payment";
        setError(msg);
        setStatus("error");
      }
    };

    init();
  }, [ref]);

  // When we have payment data but no Stripe key from env, try to get it from the backend
  useEffect(() => {
    if (status !== "form" || !paymentData || stripePromise || keyLoadFailed) return;

    let cancelled = false;
    (async () => {
      try {
        const config = await api.get<{ stripePublishableKey?: string }>("/api/payments/config");
        const key = config?.stripePublishableKey?.trim();
        if (cancelled) return;
        if (key) {
          setStripePromise(loadStripe(key));
        } else {
          setKeyLoadFailed(true);
        }
      } catch {
        if (!cancelled) setKeyLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, paymentData, stripePromise, keyLoadFailed]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800">Loading payment…</h2>
            <p className="mt-2 text-sm text-slate-600">Please wait a moment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800">Payment unavailable</h2>
            <p className="mt-2 text-slate-600">{error}</p>
            <p className="mt-4 text-sm text-slate-500">
              You can contact the business to pay by another method (e.g. bank transfer or in person).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/50 to-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
            <CardTitle className="text-2xl text-emerald-800">Payment successful</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-slate-600">
              Thank you for your payment. Your transaction has been completed successfully.
            </p>
            <p className="text-sm text-slate-500">
              A receipt has been sent to your email if provided.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!paymentData) {
    return null;
  }

  if (!stripePromise && !keyLoadFailed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800">Loading payment form…</h2>
            <p className="mt-2 text-sm text-slate-600">Please wait a moment.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stripePromise || keyLoadFailed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/30 to-slate-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-slate-800">Payment unavailable</h2>
            <p className="mt-2 text-slate-600">
              The payment form could not be loaded. Please contact the business to pay by another method (e.g. bank transfer or in person).
            </p>
            {paymentData.businessName && (
              <p className="mt-3 text-sm text-slate-500">Pay {paymentData.businessName}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const options = {
    clientSecret: paymentData.clientSecret,
    appearance: {
      theme: "stripe" as const,
      variables: {
        colorPrimary: "#059669",
        colorBackground: "#f8fafc",
        borderRadius: "8px",
      },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white pb-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Boltdown Pay</CardTitle>
              <p className="text-sm text-emerald-100">Secure card payment</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Elements stripe={stripePromise} options={options}>
            <CheckoutForm
              clientSecret={paymentData.clientSecret}
              amount={paymentData.amount}
              currency={paymentData.currency}
              description={paymentData.description}
              businessName={paymentData.businessName}
              onSuccess={() => setStatus("success")}
            />
          </Elements>
          <p className="mt-4 text-center text-xs text-slate-500">
            Powered by Boltdown Pay · Secured by Stripe
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
