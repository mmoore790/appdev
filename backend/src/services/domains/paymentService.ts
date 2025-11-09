import { InsertPaymentRequest } from "@shared/schema";
import {
  customerRepository,
  jobRepository,
  paymentRepository,
} from "../../repositories";
import StripeService from "../../stripe-service";
import {
  sendPaymentRequestEmail,
  sendPaymentRequestEmailNoLink,
} from "../emailService";
import { getActivityDescription, logActivity } from "../activityService";

interface CreatePaymentRequestInput extends InsertPaymentRequest {
  amount: number; // pounds
}

interface CreateJobPaymentRequestInput {
  amount: number;
  description?: string;
  customerEmail?: string;
}

interface RecordPaymentInput {
  paymentAmount: number;
  invoiceNumber?: string;
  paymentMethod: string;
  paymentNotes?: string;
}

class PaymentService {
  listPaymentRequests() {
    return paymentRepository.findAll();
  }

  listPaymentRequestsByJob(jobId: number) {
    return paymentRepository.findByJob(jobId);
  }

  getPaymentRequestById(id: number) {
    return paymentRepository.findById(id);
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
        const session = await stripeService.createCheckoutSession({
          amount: amountInPence,
          currency: data.currency || "GBP",
          description: data.description,
          customerEmail: data.customerEmail || "",
          checkoutReference,
        });

        const paymentLink = session.url!;

        const finalPaymentRequest =
          (await paymentRepository.update(paymentRequest.id, {
            checkoutId: session.id,
            paymentLink,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })) ?? paymentRequest;

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

  async updatePaymentRequest(id: number, data: Partial<InsertPaymentRequest>) {
    const normalisedData = { ...data } as Partial<InsertPaymentRequest>;

    if (normalisedData.amount != null) {
      normalisedData.amount = Math.round(normalisedData.amount * 100);
    }

    return paymentRepository.update(id, normalisedData);
  }

  async getPaymentStatus(id: number) {
    const paymentRequest = await paymentRepository.findById(id);
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
    actorUserId: number
  ) {
    const job = await jobRepository.findById(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const payload = { ...data };

    if (!payload.customerEmail && job.customerId) {
      const customer = await customerRepository.findById(job.customerId);
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

    if (stripeService) {
      try {
        const session = await stripeService.createCheckoutSession({
          description: payload.description || `Service payment for job ${job.jobId}`,
          customerEmail: payload.customerEmail,
          amount: Math.round(payload.amount * 100),
          currency: "GBP",
          checkoutReference: paymentRequest.checkoutReference,
        });

        await paymentRepository.update(paymentRequest.id, {
          checkoutId: session.id,
        });

        await sendPaymentRequestEmail(
          payload.customerEmail,
          session.url || "",
          payload.description || `Service payment for job ${job.jobId}`,
          payload.amount.toString(),
          paymentRequest.checkoutReference
        );

        return {
          paymentRequest: {
            ...paymentRequest,
            checkoutId: session.id,
            checkoutUrl: session.url,
          },
          error: null,
        };
      } catch (stripeError) {
        console.error("Stripe error, falling back to email-only:", stripeError);

        await sendPaymentRequestEmailNoLink(
          payload.customerEmail,
          payload.description || `Service payment for job ${job.jobId}`,
          payload.amount.toString(),
          paymentRequest.checkoutReference
        );

        return {
          paymentRequest,
          error: "Stripe link unavailable, fallback email sent",
        };
      }
    }

    await sendPaymentRequestEmailNoLink(
      payload.customerEmail,
      payload.description || `Service payment for job ${job.jobId}`,
      payload.amount.toString(),
      paymentRequest.checkoutReference
    );

    return {
      paymentRequest,
      error: "Stripe integration not configured",
    };
  }

  async getJobPaymentHistory(jobId: number) {
    const job = await jobRepository.findById(jobId);
    if (!job) {
      return null;
    }

    const paymentRequests = await paymentRepository.findByJob(jobId);

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
      paymentRequests: paymentRequests.map((pr) => ({
        ...pr,
        amount: pr.amount / 100,
      })),
    };
  }

  async refreshJobPaymentStatuses(jobId: number) {
    const job = await jobRepository.findById(jobId);
    if (!job) {
      throw new Error("Job not found");
    }

    const paymentRequests = await paymentRepository.findByJob(jobId);
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
          const session = await stripeService.getCheckoutSession(paymentRequest.checkoutId);
          const newStatus = stripeService.getPaymentStatus(session);

          if (newStatus !== paymentRequest.status) {
            await paymentRepository.updateStatus(
              paymentRequest.id,
              newStatus,
              session.payment_intent
                ? {
                    transactionId: session.payment_intent.toString(),
                    transactionCode: session.id,
                    authCode: session.payment_intent.toString(),
                  }
                : undefined
            );

            updatedCount++;

            if (newStatus === "paid") {
              paidRequests++;

              await jobRepository.update(jobId, {
                paymentStatus: "paid",
                paymentAmount: paymentRequest.amount,
                paymentMethod: "stripe",
                paymentNotes: `Paid via Stripe - Session: ${session.id}`,
                paidAt: new Date().toISOString(),
              });
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

  async getStripeSessionDetails(sessionId: string) {
    const stripeService = StripeService.fromEnvironment();
    if (!stripeService) {
      throw new Error("Stripe integration not configured");
    }

    const session = await stripeService.getCheckoutSession(sessionId);
    const paymentRequests = await paymentRepository.findAll();
    const paymentRequest = paymentRequests.find((pr) => pr.checkoutId === sessionId);

    if (paymentRequest) {
      const newStatus = stripeService.getPaymentStatus(session);

      if (newStatus !== paymentRequest.status) {
        await paymentRepository.updateStatus(
          paymentRequest.id,
          newStatus,
          session.payment_intent
            ? {
                transactionId: session.payment_intent.toString(),
                transactionCode: session.id,
                authCode: session.payment_intent.toString(),
              }
            : undefined
        );
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

        const paymentRequests = await paymentRepository.findAll();
        const matchingRequest = paymentRequests.find(
          (pr) => pr.checkoutId === session.id
        );

        if (!matchingRequest) {
          return { received: true };
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

        const amountInPence = matchingRequest.amount ?? 0;
        await paymentRepository.updateStatus(matchingRequest.id, "paid", {
          transactionId: session.payment_intent?.toString() || session.id,
          transactionCode: session.id,
          authCode: session.payment_intent?.toString() || session.id,
          stripeVerification: verificationDetails
            ? JSON.stringify(verificationDetails)
            : undefined,
          verifiedAt: new Date().toISOString(),
        });

        if (matchingRequest.jobId) {
          const job = await jobRepository.findById(matchingRequest.jobId);
          if (job) {
            const paymentNotesParts = [
              "✅ VERIFIED Stripe Payment",
              `Session: ${session.id}`,
              verificationDetails?.payment_intent_id
                ? `Payment Intent: ${verificationDetails.payment_intent_id}`
                : "",
              verificationDetails?.receipt_url
                ? `Receipt: ${verificationDetails.receipt_url}`
                : "",
              verificationDetails?.last_4
                ? `Card: ****${verificationDetails.last_4} (${verificationDetails.brand})`
                : "",
              `Verified: ${new Date().toLocaleString("en-GB", {
                timeZone: "Europe/London",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}`,
            ].filter(Boolean);

            await jobRepository.update(matchingRequest.jobId, {
              paymentStatus: "paid",
              paymentAmount: amountInPence,
              paymentMethod: "stripe",
              paymentNotes: paymentNotesParts.join(" | "),
              paidAt: new Date().toLocaleString("en-GB", {
                timeZone: "Europe/London",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
            });

            await logActivity({
              userId: 1,
              activityType: "job_payment_completed",
              description: `✅ VERIFIED Stripe Payment: ${job.jobId} - £${(amountInPence / 100).toFixed(
                2
              )} ${
                verificationDetails?.receipt_url ? `| Receipt: ${verificationDetails.receipt_url}` : ""
              }`,
              entityType: "job",
              entityId: job.id,
              metadata: {
                jobId: matchingRequest.jobId,
                paymentAmount: amountInPence,
                stripeSessionId: session.id,
                paymentIntentId: verificationDetails?.payment_intent_id,
                receiptUrl: verificationDetails?.receipt_url,
                verified: true,
                verificationDate: new Date().toISOString(),
              },
            });
          }
        }

        return { received: true };
      }

      case "payment_intent.succeeded": {
        return { received: true };
      }

      case "payment_intent.payment_failed": {
        const failedIntent = event.data.object;
        const paymentRequests = await paymentRepository.findAll();
        const failedRequest = paymentRequests.find(
          (pr) => pr.checkoutId && pr.checkoutId.includes(failedIntent.id)
        );

        if (failedRequest) {
          await paymentRepository.updateStatus(failedRequest.id, "failed");
        }

        return { received: true };
      }

      default:
        return { received: true };
    }
  }

  async handleLegacyWebhook(payload: { paymentRequestId?: number }) {
    if (!payload.paymentRequestId) {
      throw new Error("Missing paymentRequestId");
    }

    const paymentRequest = await paymentRepository.findById(payload.paymentRequestId);
    if (!paymentRequest || !paymentRequest.jobId) {
      throw new Error("Payment request not found or not linked to job");
    }

    await paymentRepository.completeJobPaymentFromStripe(payload.paymentRequestId);
    await paymentRepository.updateStatus(payload.paymentRequestId, "paid");

    return { message: "Job payment completed successfully" };
  }
}

export const paymentService = new PaymentService();
