import { InsertPaymentRequest } from "@shared/schema";
import {
  customerRepository,
  jobRepository,
  paymentRepository,
} from "../../repositories";
import { storage } from "../../storage";
import StripeService, { FRONTEND_ORIGIN } from "../../stripe-service";
import {
  sendPaymentRequestEmail,
  sendPaymentRequestEmailNoLink,
  sendProofOfPaymentEmail,
} from "../emailService";
import { getActivityDescription, logActivity } from "../activityService";
import { pdfService } from "../pdfService";

interface CreatePaymentRequestInput extends InsertPaymentRequest {
  amount: number; // pounds
}

interface CreateJobPaymentRequestInput {
  amount: number;
  description?: string;
  customerEmail?: string;
  customSubject?: string;
  customBody?: string;
}

interface RecordPaymentInput {
  paymentAmount: number;
  invoiceNumber?: string;
  paymentMethod: string;
  paymentNotes?: string;
}

class PaymentService {
  listPaymentRequests(businessId: number) {
    return paymentRepository.findAll(businessId);
  }

  listPaymentRequestsByJob(jobId: number, businessId: number) {
    return paymentRepository.findByJob(jobId, businessId);
  }

  getPaymentRequestById(id: number, businessId: number) {
    return paymentRepository.findById(id, businessId);
  }

  /**
   * Initialize payment for embedded Boltdown Pay page.
   * Called when customer visits /pay/:ref. Creates PaymentIntent and returns client_secret.
   */
  async initPaymentForCheckout(checkoutReference: string): Promise<{
    clientSecret: string;
    amount: number;
    currency: string;
    description: string;
    businessName?: string;
  } | { error: string }> {
    const stripeService = StripeService.fromEnvironment();
    if (!stripeService) {
      return {
        error:
          "Online payment is not set up for this platform. Please contact the business to pay by another method (e.g. bank transfer or in person).",
      };
    }

    const refTrimmed = checkoutReference.trim();
    let paymentRequest = await paymentRepository.findByReferenceOnly(refTrimmed);
    if (!paymentRequest && !refTrimmed.includes("-")) {
      paymentRequest = await paymentRepository.findByReferenceOnly("PAY-" + refTrimmed);
    }
    if (!paymentRequest && /^pay-/i.test(refTrimmed)) {
      paymentRequest = await paymentRepository.findByReferenceOnly("PAY-" + refTrimmed.slice(4));
    }
    if (!paymentRequest) {
      return { error: "Payment request not found. The link may be invalid or expired." };
    }
    if (paymentRequest.status !== "pending") {
      return { error: paymentRequest.status === "paid" ? "Payment already completed" : "Payment request is no longer valid" };
    }

    const business = await storage.getBusiness(paymentRequest.businessId);
    let connect: { stripeAccountId: string; businessId: number } | undefined;
    if (business?.stripeAccountId) {
      try {
        const account = await stripeService.retrieveConnectAccount(business.stripeAccountId);
        if (account.charges_enabled) {
          connect = { stripeAccountId: business.stripeAccountId, businessId: paymentRequest.businessId };
        }
      } catch (e) {
        console.error("Stripe Connect account check failed:", e);
      }
    }
    if (!connect) {
      return {
        error:
          "This business has not completed payment setup yet. Please contact them to pay by another method (e.g. bank transfer or in person).",
      };
    }

    const paymentIntent = await stripeService.createPaymentIntent({
      amount: paymentRequest.amount,
      currency: paymentRequest.currency || "GBP",
      description: paymentRequest.description,
      checkoutReference: paymentRequest.checkoutReference,
      customerEmail: paymentRequest.customerEmail || undefined,
      businessId: paymentRequest.businessId,
      paymentRequestId: paymentRequest.id,
      jobId: paymentRequest.jobId ?? undefined,
      connect,
    });

    await paymentRepository.update(paymentRequest.id, {
      checkoutId: paymentIntent.id,
    }, paymentRequest.businessId);

    return {
      clientSecret: paymentIntent.client_secret!,
      amount: paymentRequest.amount,
      currency: paymentRequest.currency || "GBP",
      description: paymentRequest.description,
      businessName: business?.name,
    };
  }

  async createPaymentRequest(
    data: CreatePaymentRequestInput,
    actorUserId: number
  ) {
    const amountInPence = Math.round(data.amount * 100);
    const checkoutReference =
      data.checkoutReference ||
      `MH-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const paymentRequest = await paymentRepository.create({
      ...data,
      amount: amountInPence,
      checkoutReference,
      createdBy: actorUserId,
    });

    const stripeService = StripeService.fromEnvironment();

    if (stripeService) {
      try {
        const baseUrl = FRONTEND_ORIGIN.replace(/\/$/, "");
        const paymentLink = `${baseUrl}/pay/${encodeURIComponent(checkoutReference)}`;

        const finalPaymentRequest =
          (await paymentRepository.update(paymentRequest.id, {
            paymentLink,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }, paymentRequest.businessId)) ?? paymentRequest;

        if (data.customerEmail) {
          try {
            await sendPaymentRequestEmail(
              data.customerEmail,
              paymentLink,
              data.description,
              data.amount.toFixed(2),
              checkoutReference
            );
          } catch (emailError) {
            console.error("Failed to send payment request email:", emailError);
          }
        }

        await logActivity({
          businessId: paymentRequest.businessId,
          userId: actorUserId,
          activityType: "job_payment_request_created",
          description: getActivityDescription(
            "job_payment_request_created",
            "payment_request",
            finalPaymentRequest.id,
            {
              jobId: finalPaymentRequest.jobId || "N/A",
              amount: amountInPence,
              customerEmail: data.customerEmail,
            }
          ),
          entityType: "payment_request",
          entityId: finalPaymentRequest.id,
          metadata: {
            jobId: finalPaymentRequest.jobId,
            amount: amountInPence,
            customerEmail: data.customerEmail,
            checkoutReference,
            description: data.description,
          },
        });

        return { paymentRequest: finalPaymentRequest, error: null };
      } catch (stripeError) {
        console.error("Stripe checkout creation failed:", stripeError);

        if (data.customerEmail) {
          try {
            await sendPaymentRequestEmailNoLink(
              data.customerEmail,
              data.description,
              data.amount.toFixed(2),
              checkoutReference
            );
          } catch (emailError) {
            console.error("Failed to send payment request notification email:", emailError);
          }
        }

        return {
          paymentRequest: paymentRequest,
          error: "Payment link generation failed - Stripe integration unavailable",
        };
      }
    } else {
      if (data.customerEmail) {
        try {
          await sendPaymentRequestEmailNoLink(
            data.customerEmail,
            data.description,
            data.amount.toFixed(2),
            checkoutReference
          );
        } catch (emailError) {
          console.error("Failed to send payment request notification email:", emailError);
        }
      }

      return {
        paymentRequest,
        error: "Stripe integration not configured",
      };
    }
  }

  async updatePaymentRequest(id: number, data: Partial<InsertPaymentRequest>, businessId: number) {
    const normalisedData = { ...data } as Partial<InsertPaymentRequest>;

    if (normalisedData.amount != null) {
      normalisedData.amount = Math.round(normalisedData.amount * 100);
    }

    return paymentRepository.update(id, normalisedData, businessId);
  }

  async getPaymentStatus(id: number, businessId: number) {
    const paymentRequest = await paymentRepository.findById(id, businessId);
    if (!paymentRequest) {
      return null;
    }

    if (paymentRequest.checkoutId) {
      const stripeService = StripeService.fromEnvironment();
      if (stripeService) {
        try {
          const session = await stripeService.getCheckoutSession(paymentRequest.checkoutId);
          const newStatus = stripeService.getPaymentStatus(session);

          if (newStatus !== paymentRequest.status) {
            await paymentRepository.updateStatus(
              id,
              newStatus,
              businessId,
              session.payment_intent
                ? {
                    transactionId: session.payment_intent.toString(),
                    transactionCode: session.id,
                    authCode: session.payment_intent.toString(),
                  }
                : undefined
            );
          }

          return {
            ...paymentRequest,
            status: newStatus,
            stripeStatus: session.payment_status,
            sessionId: session.id,
          };
        } catch (error) {
          console.error("Error checking Stripe status:", error);
          return paymentRequest;
        }
      }
    }

    return paymentRequest;
  }

  async recordJobPayment(
    jobId: number,
    paymentData: RecordPaymentInput,
    actorUserId: number
  ) {
    return paymentRepository.recordJobPayment(jobId, paymentData, actorUserId);
  }

  async createJobPaymentRequest(
    jobId: number,
    data: CreateJobPaymentRequestInput,
    businessId: number,
    actorUserId: number
  ) {
    const job = await jobRepository.findById(jobId, businessId);
    if (!job) {
      throw new Error("Job not found");
    }

    const payload = { ...data, businessId };

    if (!payload.customerEmail && job.customerId) {
      const customer = await customerRepository.findById(job.customerId, businessId);
      if (customer?.email) {
        payload.customerEmail = customer.email;
      }
    }

    if (!payload.customerEmail) {
      throw new Error("Customer email is required for payment request");
    }

    const paymentRequest = await paymentRepository.createJobPaymentRequest(
      jobId,
      payload,
      actorUserId
    );

    const stripeService = StripeService.fromEnvironment();
    const business = await storage.getBusiness(businessId);
    const customerName = job.customerName || (job.customerId
      ? (await customerRepository.findById(job.customerId, businessId))?.name
      : null) || "Valued Customer";
    const description = payload.description || `Service payment for job ${job.jobId}`;
    const amountStr = typeof payload.amount === "number" ? payload.amount.toFixed(2) : String(payload.amount);
    const jobSummary = [
      job.jobId && `Job reference: ${job.jobId}`,
      (job.equipmentDescription || job.equipmentMake || job.equipmentModel) &&
        `Equipment: ${[job.equipmentDescription, job.equipmentMake, job.equipmentModel].filter(Boolean).join(" · ") || "—"}`,
      job.description && `Work: ${job.description}`,
    ]
      .filter(Boolean)
      .join("\n");
    const emailOptions = {
      business,
      customSubject: payload.customSubject,
      customBody: payload.customBody,
      customerName,
      jobId: job.jobId,
      jobSummary: jobSummary || undefined,
      businessId,
      metadata: { jobId: job.id, paymentRequestId: paymentRequest.id },
    };

    if (stripeService) {
      try {
        const baseUrl = FRONTEND_ORIGIN.replace(/\/$/, "");
        const paymentLink = `${baseUrl}/pay/${encodeURIComponent(paymentRequest.checkoutReference)}`;

        await paymentRepository.update(paymentRequest.id, {
          paymentLink,
        }, businessId);

        await sendPaymentRequestEmail(
          payload.customerEmail,
          paymentLink,
          description,
          amountStr,
          paymentRequest.checkoutReference,
          emailOptions
        );

        return {
          paymentRequest: {
            ...paymentRequest,
            paymentLink,
          },
          error: null,
        };
      } catch (stripeError) {
        console.error("Stripe error, falling back to email-only:", stripeError);

        await sendPaymentRequestEmailNoLink(
          payload.customerEmail,
          description,
          amountStr,
          paymentRequest.checkoutReference,
          emailOptions
        );

        return {
          paymentRequest,
          error: "Stripe link unavailable, fallback email sent",
        };
      }
    }

    await sendPaymentRequestEmailNoLink(
      payload.customerEmail,
      description,
      amountStr,
      paymentRequest.checkoutReference,
      emailOptions
    );

    return {
      paymentRequest,
      error: "Stripe integration not configured",
    };
  }

  async getJobPaymentHistory(jobId: number, businessId: number) {
    const job = await jobRepository.findById(jobId, businessId);
    if (!job) {
      return null;
    }

    const [paymentRequests, payments, totalCostPence] = await Promise.all([
      paymentRepository.findByJob(jobId, businessId),
      paymentRepository.getPaymentsByJobId(jobId, businessId),
      paymentRepository.getJobTotalCost(jobId, businessId),
    ]);
    const totalPaidPence = payments.reduce((sum, p) => sum + p.amount, 0);
    const balanceRemainingPence = Math.max(0, totalCostPence - totalPaidPence);

    return {
      job: {
        id: job.id,
        jobId: job.jobId,
        paymentStatus: job.paymentStatus,
        paymentAmount: job.paymentAmount ? job.paymentAmount / 100 : null,
        paymentMethod: job.paymentMethod,
        paymentNotes: job.paymentNotes,
        invoiceNumber: job.invoiceNumber,
        paidAt: job.paidAt,
      },
      totalCost: totalCostPence / 100,
      totalPaid: totalPaidPence / 100,
      balanceRemaining: balanceRemainingPence / 100,
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount / 100,
        paymentMethod: p.paymentMethod,
        stripeReceiptUrl: p.stripeReceiptUrl ?? undefined,
        stripePaymentIntentId: p.stripePaymentIntentId ?? undefined,
        paidAt: p.paidAt,
        notes: p.notes,
        createdAt: p.createdAt,
      })),
      paymentRequests: paymentRequests.map((pr) => ({
        ...pr,
        amount: pr.amount / 100,
      })),
    };
  }

  async getJobPaymentProofUrl(jobId: number, paymentId: number, businessId: number) {
    const payment = await paymentRepository.getPaymentById(paymentId, businessId);
    if (!payment || payment.jobId !== jobId) {
      throw new Error("Payment not found");
    }
    if (payment.paymentMethod !== "stripe") {
      throw new Error("Proof of payment is only available for Stripe payments");
    }
    if (payment.stripeReceiptUrl) {
      return { url: payment.stripeReceiptUrl };
    }

    const stripeService = StripeService.fromEnvironment();
    if (!stripeService) {
      throw new Error("Stripe integration not configured");
    }

    let paymentIntentId = payment.stripePaymentIntentId ?? undefined;

    if (!paymentIntentId && payment.paymentRequestId) {
      const request = await paymentRepository.findById(payment.paymentRequestId, businessId);
      if (request?.checkoutId) {
        if (request.checkoutId.startsWith("pi_")) {
          paymentIntentId = request.checkoutId;
        } else if (request.checkoutId.startsWith("cs_")) {
          const session = await stripeService.getCheckoutSession(request.checkoutId);
          paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;
        }
      }
    }

    if (!paymentIntentId) {
      throw new Error("Proof of payment is not available for this transaction yet");
    }

    const pi = await stripeService.retrievePaymentIntent(paymentIntentId);
    const charge = (pi as any).charges?.data?.[0];
    const receiptUrl: string | undefined = charge?.receipt_url;
    if (!receiptUrl) {
      throw new Error("Receipt not available yet. Please try again in a moment.");
    }

    await paymentRepository.updatePaymentById(
      payment.id,
      {
        stripeReceiptUrl: receiptUrl,
        stripePaymentIntentId: paymentIntentId,
      },
      businessId
    );

    return { url: receiptUrl };
  }

  async getJobPaymentDetails(jobId: number, paymentId: number, businessId: number) {
    const payment = await paymentRepository.getPaymentById(paymentId, businessId);
    if (!payment || payment.jobId !== jobId) {
      throw new Error("Payment not found");
    }

    const paymentRequest = payment.paymentRequestId
      ? await paymentRepository.findById(payment.paymentRequestId, businessId)
      : null;

    const stripeService = StripeService.fromEnvironment();
    let paymentIntentId = payment.stripePaymentIntentId ?? undefined;
    let proofUrl = payment.stripeReceiptUrl ?? undefined;
    let stripe: any = null;

    if (!paymentIntentId && paymentRequest?.checkoutId) {
      if (paymentRequest.checkoutId.startsWith("pi_")) {
        paymentIntentId = paymentRequest.checkoutId;
      } else if (paymentRequest.checkoutId.startsWith("cs_") && stripeService) {
        try {
          const session = await stripeService.getCheckoutSession(paymentRequest.checkoutId);
          paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id;
        } catch {
          /* best effort only */
        }
      }
    }

    if (payment.paymentMethod === "stripe" && stripeService && paymentIntentId) {
      try {
        const pi = await stripeService.retrievePaymentIntent(paymentIntentId);
        const charge = (pi as any).charges?.data?.[0];
        const card = charge?.payment_method_details?.card;
        const billing = charge?.billing_details;
        const chargeReceipt = charge?.receipt_url;
        proofUrl = proofUrl || chargeReceipt || undefined;

        stripe = {
          paymentIntentId: pi.id,
          paymentIntentStatus: pi.status,
          chargeId: charge?.id,
          amount: typeof pi.amount === "number" ? pi.amount / 100 : null,
          currency: pi.currency?.toUpperCase?.() ?? null,
          cardBrand: card?.brand ?? null,
          cardLast4: card?.last4 ?? null,
          cardExpMonth: card?.exp_month ?? null,
          cardExpYear: card?.exp_year ?? null,
          cardFunding: card?.funding ?? null,
          cardCountry: card?.country ?? null,
          cardNetwork: card?.network ?? null,
          cardWalletType: card?.wallet?.type ?? null,
          billingName: billing?.name ?? null,
          billingEmail: billing?.email ?? null,
          billingPhone: billing?.phone ?? null,
          receiptUrl: proofUrl ?? null,
        };

        const patch: any = {};
        if (proofUrl && !payment.stripeReceiptUrl) patch.stripeReceiptUrl = proofUrl;
        if (paymentIntentId && !payment.stripePaymentIntentId) patch.stripePaymentIntentId = paymentIntentId;
        if (Object.keys(patch).length > 0) {
          await paymentRepository.updatePaymentById(payment.id, patch, businessId);
        }
      } catch {
        /* keep base details even if Stripe enrichment fails */
      }
    }

    return {
      id: payment.id,
      amount: payment.amount / 100,
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
      notes: payment.notes,
      paymentRequestId: payment.paymentRequestId ?? null,
      proofUrl: proofUrl ?? null,
      request: paymentRequest
        ? {
            id: paymentRequest.id,
            checkoutReference: paymentRequest.checkoutReference,
            description: paymentRequest.description,
            customerEmail: paymentRequest.customerEmail,
            status: paymentRequest.status,
            transactionId: paymentRequest.transactionId ?? null,
            transactionCode: paymentRequest.transactionCode ?? null,
            authCode: paymentRequest.authCode ?? null,
          }
        : null,
      stripe,
    };
  }

  async generatePublicPaymentReceipt(sessionId: string): Promise<{ buffer: Buffer; filename: string }> {
    const stripeService = StripeService.fromEnvironment();
    if (!stripeService) {
      throw new Error("Stripe integration not configured");
    }

    const session = await stripeService.getCheckoutSession(sessionId);
    if (session.payment_status !== "paid") {
      throw new Error("Payment is not marked as paid yet");
    }

    let paymentRequest: any = null;
    let businessId: number | null = null;

    const metaBusinessId = session.metadata?.businessId ? parseInt(session.metadata.businessId) : null;
    const metaPaymentRequestId = session.metadata?.paymentRequestId ? parseInt(session.metadata.paymentRequestId) : null;
    const checkoutReference = session.metadata?.checkoutReference;

    if (metaBusinessId && metaPaymentRequestId) {
      paymentRequest = await paymentRepository.findById(metaPaymentRequestId, metaBusinessId);
      if (paymentRequest) businessId = metaBusinessId;
    }

    if (!paymentRequest && checkoutReference) {
      paymentRequest = await paymentRepository.findByReferenceOnly(checkoutReference);
      if (paymentRequest) businessId = paymentRequest.businessId;
    }

    if (!paymentRequest || !businessId) {
      for (let bid = 1; bid <= 100; bid++) {
        try {
          const prs = await paymentRepository.findAll(bid);
          const found = prs.find((pr) => pr.checkoutId === sessionId);
          if (found) {
            paymentRequest = found;
            businessId = bid;
            break;
          }
        } catch {
          /* continue */
        }
      }
    }

    if (!paymentRequest || !businessId) {
      throw new Error("Payment request could not be resolved for this session");
    }

    const business = await storage.getBusiness(businessId);
    const job = paymentRequest.jobId
      ? await jobRepository.findById(paymentRequest.jobId, businessId)
      : null;
    const customer = job?.customerId
      ? await customerRepository.findById(job.customerId, businessId)
      : null;

    const payments = paymentRequest.jobId
      ? await paymentRepository.getPaymentsByJobId(paymentRequest.jobId, businessId)
      : [];
    const linkedPayment =
      payments.find((p) => p.paymentRequestId === paymentRequest.id) ??
      payments.find((p) => p.stripePaymentIntentId && p.stripePaymentIntentId === (typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id));

    let receiptUrl = linkedPayment?.stripeReceiptUrl ?? undefined;
    let paymentReference = linkedPayment?.stripePaymentIntentId ?? "";
    let paidAt = linkedPayment?.paidAt ?? undefined;

    const paymentIntentId =
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (paymentIntentId) {
      paymentReference = paymentReference || paymentIntentId;
      try {
        const pi = await stripeService.retrievePaymentIntent(paymentIntentId);
        const charge = (pi as any).charges?.data?.[0];
        receiptUrl = receiptUrl || charge?.receipt_url || undefined;
        paidAt = paidAt || (charge?.created ? new Date(charge.created * 1000).toISOString() : undefined);
      } catch {
        /* best effort */
      }
    }

    if (linkedPayment?.id && (receiptUrl || paymentReference)) {
      await paymentRepository.updatePaymentById(
        linkedPayment.id,
        {
          stripeReceiptUrl: receiptUrl,
          stripePaymentIntentId: paymentReference || linkedPayment.stripePaymentIntentId || undefined,
          paidAt: paidAt || linkedPayment.paidAt || undefined,
        },
        businessId
      );
    }

    const amountPounds =
      linkedPayment?.amount != null
        ? (linkedPayment.amount / 100).toFixed(2)
        : (paymentRequest.amount / 100).toFixed(2);

    const receipt = await pdfService.generatePaymentReceipt({
      receiptNumber: `PAY-${paymentRequest.id}-${session.id.slice(-6)}`,
      paidAt: paidAt || new Date().toISOString(),
      amount: amountPounds,
      paymentMethod: linkedPayment?.paymentMethod || "stripe",
      paymentReference: paymentReference || session.id,
      stripeReceiptUrl: receiptUrl,
      paymentDescription: paymentRequest.description,
      jobId: job?.jobId || undefined,
      machineMake: job?.equipmentMake || undefined,
      machineModel: job?.equipmentModel || undefined,
      machineDescription: job?.equipmentDescription || undefined,
      customerName: job?.customerName || customer?.name || undefined,
      customerPhone: job?.customerPhone || customer?.phone || undefined,
      customerEmail: job?.customerEmail || customer?.email || paymentRequest.customerEmail || undefined,
      businessName: business?.name || undefined,
      businessAddress: business?.address || undefined,
      businessPhone: business?.phone || undefined,
      businessEmail: business?.email || undefined,
    });

    const safeJobId = (job?.jobId || "payment").replace(/[^a-zA-Z0-9-_]/g, "");
    return {
      buffer: receipt,
      filename: `payment-receipt-${safeJobId}.pdf`,
    };
  }

  async generatePublicPaymentReceiptByPaymentIntent(paymentIntentId: string): Promise<{ buffer: Buffer; filename: string }> {
    const stripeService = StripeService.fromEnvironment();
    if (!stripeService) {
      throw new Error("Stripe integration not configured");
    }

    const pi = await stripeService.retrievePaymentIntent(paymentIntentId);
    if (pi.status !== "succeeded") {
      throw new Error("Payment is not marked as paid yet");
    }

    let paymentRequest: any = null;
    let businessId: number | null = null;

    const metaBusinessId = pi.metadata?.businessId ? parseInt(pi.metadata.businessId) : null;
    const metaPaymentRequestId = pi.metadata?.paymentRequestId ? parseInt(pi.metadata.paymentRequestId) : null;
    const checkoutReference = pi.metadata?.checkoutReference;

    if (metaBusinessId && metaPaymentRequestId) {
      paymentRequest = await paymentRepository.findById(metaPaymentRequestId, metaBusinessId);
      if (paymentRequest) businessId = metaBusinessId;
    }

    if (!paymentRequest && checkoutReference) {
      paymentRequest = await paymentRepository.findByReferenceOnly(checkoutReference);
      if (paymentRequest) businessId = paymentRequest.businessId;
    }

    if (!paymentRequest) {
      for (let bid = 1; bid <= 100; bid++) {
        try {
          const prs = await paymentRepository.findAll(bid);
          const found = prs.find((pr) => pr.checkoutId === paymentIntentId);
          if (found) {
            paymentRequest = found;
            businessId = bid;
            break;
          }
        } catch {
          /* continue */
        }
      }
    }

    if (!paymentRequest || !businessId) {
      throw new Error("Payment request could not be resolved for this payment");
    }

    const business = await storage.getBusiness(businessId);
    const job = paymentRequest.jobId
      ? await jobRepository.findById(paymentRequest.jobId, businessId)
      : null;
    const customer = job?.customerId
      ? await customerRepository.findById(job.customerId, businessId)
      : null;

    const payments = paymentRequest.jobId
      ? await paymentRepository.getPaymentsByJobId(paymentRequest.jobId, businessId)
      : [];
    const linkedPayment =
      payments.find((p) => p.paymentRequestId === paymentRequest.id) ??
      payments.find((p) => p.stripePaymentIntentId === paymentIntentId);

    const charge = (pi as any).charges?.data?.[0];
    const receiptUrl = linkedPayment?.stripeReceiptUrl ?? charge?.receipt_url ?? undefined;
    const paidAt =
      linkedPayment?.paidAt ??
      (charge?.created ? new Date(charge.created * 1000).toISOString() : undefined) ??
      new Date().toISOString();

    if (linkedPayment?.id) {
      await paymentRepository.updatePaymentById(
        linkedPayment.id,
        {
          stripeReceiptUrl: receiptUrl,
          stripePaymentIntentId: paymentIntentId,
          paidAt,
        },
        businessId
      );
    }

    const amountPounds =
      linkedPayment?.amount != null
        ? (linkedPayment.amount / 100).toFixed(2)
        : (paymentRequest.amount / 100).toFixed(2);

    const receipt = await pdfService.generatePaymentReceipt({
      receiptNumber: `PAY-${paymentRequest.id}-${paymentIntentId.slice(-6)}`,
      paidAt,
      amount: amountPounds,
      paymentMethod: linkedPayment?.paymentMethod || "stripe",
      paymentReference: paymentIntentId,
      stripeReceiptUrl: receiptUrl,
      paymentDescription: paymentRequest.description,
      jobId: job?.jobId || undefined,
      machineMake: job?.equipmentMake || undefined,
      machineModel: job?.equipmentModel || undefined,
      machineDescription: job?.equipmentDescription || undefined,
      customerName: job?.customerName || customer?.name || undefined,
      customerPhone: job?.customerPhone || customer?.phone || undefined,
      customerEmail: job?.customerEmail || customer?.email || paymentRequest.customerEmail || undefined,
      businessName: business?.name || undefined,
      businessAddress: business?.address || undefined,
      businessPhone: business?.phone || undefined,
      businessEmail: business?.email || undefined,
    });

    const safeJobId = (job?.jobId || "payment").replace(/[^a-zA-Z0-9-_]/g, "");
    return {
      buffer: receipt,
      filename: `payment-receipt-${safeJobId}.pdf`,
    };
  }

  async refreshJobPaymentStatuses(jobId: number, businessId: number) {
    const job = await jobRepository.findById(jobId, businessId);
    if (!job) {
      throw new Error("Job not found");
    }

    const paymentRequests = await paymentRepository.findByJob(jobId, businessId);
    let updatedCount = 0;
    let paidRequests = 0;

    const stripeService = StripeService.fromEnvironment();

    if (!stripeService) {
      return {
        updatedCount,
        paidRequests,
      };
    }

    for (const paymentRequest of paymentRequests) {
      if (paymentRequest.checkoutId && paymentRequest.status === "pending") {
        try {
          const isPaymentIntent = paymentRequest.checkoutId.startsWith("pi_");
          let newStatus: "pending" | "paid" | "failed" = "pending";
          let receiptUrl: string | undefined;
          let paymentIntentId: string | undefined;
          let paidAtIso: string | undefined;

          if (isPaymentIntent) {
            const pi = await stripeService.getPaymentIntent(paymentRequest.checkoutId);
            newStatus = pi.status === "succeeded" ? "paid" : pi.status === "canceled" ? "failed" : "pending";
            if (newStatus === "paid") {
              const charge = (pi as any).charges?.data?.[0];
              paymentIntentId = pi.id;
              receiptUrl = charge?.receipt_url;
              paidAtIso = charge?.created
                ? new Date(charge.created * 1000).toISOString()
                : new Date().toISOString();
            }
          } else {
            const session = await stripeService.getCheckoutSession(paymentRequest.checkoutId);
            newStatus = stripeService.getPaymentStatus(session);
            paymentIntentId =
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id;
            if (newStatus === "paid" && paymentIntentId) {
              const pi = await stripeService.retrievePaymentIntent(paymentIntentId);
              const charge = (pi as any).charges?.data?.[0];
              receiptUrl = receiptUrl ?? charge?.receipt_url;
              paidAtIso = charge?.created
                ? new Date(charge.created * 1000).toISOString()
                : new Date().toISOString();
            }
          }

          if (newStatus !== paymentRequest.status) {
            await paymentRepository.updateStatus(
              paymentRequest.id,
              newStatus,
              businessId,
              {
                transactionId: paymentRequest.checkoutId,
                transactionCode: paymentRequest.checkoutId,
                authCode: paymentRequest.checkoutId,
              }
            );

            updatedCount++;

            if (newStatus === "paid" && paymentRequest.jobId) {
              paidRequests++;
              await paymentRepository.completeJobPaymentFromStripe(paymentRequest.id, {
                stripeReceiptUrl: receiptUrl,
                stripePaymentIntentId: paymentIntentId,
                paidAt: paidAtIso,
              });
              if (paymentRequest.customerEmail) {
                const business = await storage.getBusiness(businessId);
                const job = await jobRepository.findById(paymentRequest.jobId, businessId);
                const amountPounds = (paymentRequest.amount / 100).toFixed(2);
                await sendProofOfPaymentEmail({
                  customerEmail: paymentRequest.customerEmail,
                  amount: amountPounds,
                  description: paymentRequest.description || "Payment for job",
                  jobId: job?.jobId,
                  business,
                  businessId,
                });
              }
            }
          }
        } catch (error) {
          console.error(
            `Error checking Stripe status for payment request ${paymentRequest.id}:`,
            error
          );
        }
      }
    }

    return {
      updatedCount,
      paidRequests,
    };
  }

  async getStripeSessionDetails(sessionId: string, businessId: number) {
    const stripeService = StripeService.fromEnvironment();
    if (!stripeService) {
      throw new Error("Stripe integration not configured");
    }

    const session = await stripeService.getCheckoutSession(sessionId);
    const paymentRequests = await paymentRepository.findAll(businessId);
    const paymentRequest = paymentRequests.find((pr) => pr.checkoutId === sessionId);

    if (paymentRequest) {
      const newStatus = stripeService.getPaymentStatus(session);
      const previousStatus = paymentRequest.status;

      if (newStatus !== paymentRequest.status) {
        await paymentRepository.updateStatus(
          paymentRequest.id,
          newStatus,
          businessId,
          session.payment_intent
            ? {
                transactionId: session.payment_intent.toString(),
                transactionCode: session.id,
                authCode: session.payment_intent.toString(),
              }
            : undefined
        );
      }

      if (newStatus === "paid" && paymentRequest.jobId) {
        let receiptUrl: string | undefined;
        let paymentIntentId: string | undefined;
        let paidAt: string | undefined;

        if (session.payment_intent) {
          paymentIntentId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent.id;
          if (paymentIntentId) {
            try {
              const pi = await stripeService.retrievePaymentIntent(paymentIntentId);
              const charge = (pi as any).charges?.data?.[0];
              receiptUrl = charge?.receipt_url;
              paidAt = charge?.created
                ? new Date(charge.created * 1000).toISOString()
                : undefined;
            } catch (err) {
              console.error("Failed to enrich payment details from Stripe session:", err);
            }
          }
        }

        await paymentRepository.completeJobPaymentFromStripe(paymentRequest.id, {
          stripeReceiptUrl: receiptUrl,
          stripePaymentIntentId: paymentIntentId,
          paidAt,
        });

        if (previousStatus !== "paid" && paymentRequest.customerEmail) {
          const business = await storage.getBusiness(businessId);
          const job = await jobRepository.findById(paymentRequest.jobId, businessId);
          const amountPounds = (paymentRequest.amount / 100).toFixed(2);
          await sendProofOfPaymentEmail({
            customerEmail: paymentRequest.customerEmail,
            amount: amountPounds,
            description: paymentRequest.description || "Payment for job",
            jobId: job?.jobId,
            business,
            businessId,
          });
        }
      }
    }

    return {
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        amount_total: session.amount_total,
        currency: session.currency,
        customer_details: session.customer_details,
      },
      paymentRequest: paymentRequest
        ? {
            id: paymentRequest.id,
            description: paymentRequest.description,
            status: stripeService.getPaymentStatus(session),
          }
        : null,
    };
  }

  async handleStripeWebhook(event: any) {
    const stripeService = StripeService.fromEnvironment();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        if (session.payment_status !== "paid") {
          return { received: true, warning: "Session not paid" };
        }

        let matchingRequest: any = null;
        let requestBusinessId: number | null = null;

        // Preferred correlation: explicit metadata identifiers.
        const metaBusinessId = session.metadata?.businessId
          ? parseInt(session.metadata.businessId)
          : null;
        const metaPaymentRequestId = session.metadata?.paymentRequestId
          ? parseInt(session.metadata.paymentRequestId)
          : null;

        if (metaBusinessId && metaPaymentRequestId) {
          const byId = await paymentRepository.findById(metaPaymentRequestId, metaBusinessId);
          if (byId) {
            matchingRequest = byId;
            requestBusinessId = metaBusinessId;
          }
        }

        // Secondary correlation by business + checkout id.
        if (!matchingRequest && metaBusinessId) {
          requestBusinessId = metaBusinessId;
          const paymentRequests = await paymentRepository.findAll(metaBusinessId);
          matchingRequest = paymentRequests.find((pr) => pr.checkoutId === session.id);
        }

        // Legacy fallback for old records without metadata.
        if (!matchingRequest) {
          for (let bid = 1; bid <= 100; bid++) {
            try {
              const paymentRequests = await paymentRepository.findAll(bid);
              const found = paymentRequests.find((pr) => pr.checkoutId === session.id);
              if (found) {
                matchingRequest = found;
                requestBusinessId = bid;
                break;
              }
            } catch {
              /* continue */
            }
          }
        }

        if (!matchingRequest || !requestBusinessId) {
          return { received: true };
        }
        if (matchingRequest.status === "paid") {
          return { received: true, warning: "Already processed" };
        }

        let verificationDetails = null;

        if (stripeService && session.payment_intent) {
          try {
            const paymentIntentId =
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent.id;

            if (paymentIntentId) {
              const paymentIntent =
                await stripeService.retrievePaymentIntent(paymentIntentId);

              if (paymentIntent.status === "succeeded") {
                const charge = (paymentIntent as any).charges?.data?.[0];
                verificationDetails = {
                  payment_intent_id: paymentIntent.id,
                  status: paymentIntent.status,
                  amount: paymentIntent.amount,
                  currency: paymentIntent.currency,
                  created: new Date(paymentIntent.created * 1000).toISOString(),
                  receipt_url: charge?.receipt_url || null,
                  payment_method_id: paymentIntent.payment_method,
                  last_4: charge?.payment_method_details?.card?.last4 || null,
                  brand: charge?.payment_method_details?.card?.brand || null,
                };
              } else {
                return { received: true, error: "Payment not succeeded" };
              }
            }
          } catch (error) {
            console.error("Error verifying payment with Stripe:", error);
            return { received: true, error: "Failed to verify payment" };
          }
        }

        await paymentRepository.updateStatus(matchingRequest.id, "paid", requestBusinessId, {
          transactionId: session.payment_intent?.toString() || session.id,
          transactionCode: session.id,
          authCode: session.payment_intent?.toString() || session.id,
          stripeVerification: verificationDetails
            ? JSON.stringify(verificationDetails)
            : undefined,
          verifiedAt: new Date().toISOString(),
        });

        if (matchingRequest.jobId) {
          await paymentRepository.completeJobPaymentFromStripe(
            matchingRequest.id,
            {
              stripeReceiptUrl: verificationDetails?.receipt_url ?? undefined,
              stripePaymentIntentId: verificationDetails?.payment_intent_id ?? undefined,
              paidAt: verificationDetails?.created ?? undefined,
            }
          );
        }

        if (matchingRequest.customerEmail) {
          const business = await storage.getBusiness(requestBusinessId);
          const job = matchingRequest.jobId
            ? await jobRepository.findById(matchingRequest.jobId, requestBusinessId)
            : null;
          const amountPounds = (matchingRequest.amount / 100).toFixed(2);
          await sendProofOfPaymentEmail({
            customerEmail: matchingRequest.customerEmail,
            amount: amountPounds,
            description: matchingRequest.description || `Payment for job`,
            jobId: job?.jobId,
            business,
            businessId: requestBusinessId,
          });
        }

        return { received: true };
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        if (paymentIntent.status !== "succeeded") {
          return { received: true };
        }

        const checkoutReference = paymentIntent.metadata?.checkoutReference;
        const businessIdFromMeta = paymentIntent.metadata?.businessId
          ? parseInt(paymentIntent.metadata.businessId)
          : null;
        const paymentRequestIdFromMeta = paymentIntent.metadata?.paymentRequestId
          ? parseInt(paymentIntent.metadata.paymentRequestId)
          : null;

        let matchingRequest: any = null;
        let requestBusinessId: number | null = businessIdFromMeta;

        if (paymentRequestIdFromMeta && businessIdFromMeta) {
          const byId = await paymentRepository.findById(paymentRequestIdFromMeta, businessIdFromMeta);
          if (byId) {
            matchingRequest = byId;
            requestBusinessId = businessIdFromMeta;
          }
        }
        if (!matchingRequest && checkoutReference) {
          matchingRequest = await paymentRepository.findByReferenceOnly(checkoutReference);
          if (matchingRequest) {
            requestBusinessId = matchingRequest.businessId;
          }
        }
        if (!matchingRequest && paymentIntent.id) {
          for (let bid = 1; bid <= 100; bid++) {
            try {
              const paymentRequests = await paymentRepository.findAll(bid);
              const found = paymentRequests.find((pr) => pr.checkoutId === paymentIntent.id);
              if (found) {
                matchingRequest = found;
                requestBusinessId = bid;
                break;
              }
            } catch {
              /* continue */
            }
          }
        }

        if (!matchingRequest || !requestBusinessId) {
          return { received: true };
        }
        if (matchingRequest.status === "paid") {
          return { received: true, warning: "Already processed" };
        }

        let verificationDetails = null;
        if (stripeService) {
          try {
            const pi = await stripeService.retrievePaymentIntent(paymentIntent.id);
            const charge = (pi as any).charges?.data?.[0];
            verificationDetails = {
              payment_intent_id: pi.id,
              status: pi.status,
              amount: pi.amount,
              currency: pi.currency,
              created: new Date(pi.created * 1000).toISOString(),
              receipt_url: charge?.receipt_url || null,
              payment_method_id: pi.payment_method,
              last_4: charge?.payment_method_details?.card?.last4 || null,
              brand: charge?.payment_method_details?.card?.brand || null,
            };
          } catch (e) {
            console.error("Error fetching PaymentIntent:", e);
          }
        }

        await paymentRepository.updateStatus(matchingRequest.id, "paid", requestBusinessId, {
          transactionId: paymentIntent.id,
          transactionCode: paymentIntent.id,
          authCode: paymentIntent.id,
          stripeVerification: verificationDetails
            ? JSON.stringify(verificationDetails)
            : undefined,
          verifiedAt: new Date().toISOString(),
        });

        if (matchingRequest.jobId) {
          await paymentRepository.completeJobPaymentFromStripe(
            matchingRequest.id,
            {
              stripeReceiptUrl: verificationDetails?.receipt_url ?? undefined,
              stripePaymentIntentId: verificationDetails?.payment_intent_id ?? undefined,
              paidAt: verificationDetails?.created ?? undefined,
            }
          );
        }

        if (matchingRequest.customerEmail) {
          const business = await storage.getBusiness(requestBusinessId);
          const job = matchingRequest.jobId
            ? await jobRepository.findById(matchingRequest.jobId, requestBusinessId)
            : null;
          const amountPounds = (matchingRequest.amount / 100).toFixed(2);
          await sendProofOfPaymentEmail({
            customerEmail: matchingRequest.customerEmail,
            amount: amountPounds,
            description: matchingRequest.description || `Payment for job`,
            jobId: job?.jobId,
            business,
            businessId: requestBusinessId,
          });
        }

        return { received: true };
      }

      case "payment_intent.payment_failed": {
        const failedIntent = event.data.object;
        // Similar to checkout.session.completed, we need to find the business
        // In production, include businessId in webhook metadata
        let failedRequest: any = null;
        let requestBusinessId: number | null = null;
        
        if (failedIntent.metadata?.businessId) {
          requestBusinessId = parseInt(failedIntent.metadata.businessId);
          const paymentRequests = await paymentRepository.findAll(requestBusinessId);
          failedRequest = paymentRequests.find(
            (pr) => pr.checkoutId && pr.checkoutId.includes(failedIntent.id)
          );
        }
        
        if (failedRequest && requestBusinessId) {
          await paymentRepository.updateStatus(failedRequest.id, "failed", requestBusinessId);
        }

        return { received: true };
      }

      default:
        return { received: true };
    }
  }

  async handleLegacyWebhook(payload: { paymentRequestId?: number; businessId?: number }) {
    if (!payload.paymentRequestId) {
      throw new Error("Missing paymentRequestId");
    }

    // Try to get businessId from payload or find it
    let businessId = payload.businessId;
    if (!businessId) {
      // Search for the payment request across businesses
      for (let bid = 1; bid <= 100; bid++) {
        try {
          const pr = await paymentRepository.findById(payload.paymentRequestId, bid);
          if (pr) {
            businessId = bid;
            break;
          }
        } catch {
          // Continue searching
        }
      }
    }

    if (!businessId) {
      throw new Error("Could not determine business for payment request");
    }

    const paymentRequest = await paymentRepository.findById(payload.paymentRequestId, businessId);
    if (!paymentRequest || !paymentRequest.jobId) {
      throw new Error("Payment request not found or not linked to job");
    }

    await paymentRepository.completeJobPaymentFromStripe(payload.paymentRequestId);
    await paymentRepository.updateStatus(payload.paymentRequestId, "paid", businessId);

    return { message: "Job payment completed successfully" };
  }
}

export const paymentService = new PaymentService();
