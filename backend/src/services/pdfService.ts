import puppeteer from "puppeteer";
import { analyticsService } from "./domains/analyticsService";

interface CallbackAnalyticsData {
  summary: {
    totalCallbacks: number;
    totalCompleted: number;
    totalPending: number;
    overallAvgCompletionTimeHours: number | null;
    overallLongestCompletionTimeHours: number | null;
    completionRate: number;
  };
  staffPerformance: Array<{
    staffId: number;
    staffName: string;
    totalCallbacks: number;
    completedCallbacks: number;
    pendingCallbacks: number;
    completionRate: number;
    avgCompletionTimeHours: number | null;
    longestCompletionTimeHours: number | null;
    priorityBreakdown: {
      low: number;
      medium: number;
      high: number;
      urgent: number;
    };
  }>;
  statusBreakdown: {
    pending: number;
    completed: number;
    archived: number;
  };
  priorityDistribution: {
    low: number;
    medium: number;
    high: number;
    urgent: number;
  };
  dailyTrends: Array<{
    date: string;
    created: number;
    completed: number;
  }>;
  dateRange: {
    from: string | null;
    to: string | null;
  };
}

interface PaymentReceiptData {
  receiptNumber: string;
  paidAt: string;
  amount: string;
  paymentMethod: string;
  paymentReference: string;
  stripeReceiptUrl?: string;
  paymentDescription?: string;
  jobId?: string;
  machineMake?: string;
  machineModel?: string;
  machineDescription?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  businessEmail?: string;
}

class PDFService {
  async generateCallbackReport(
    businessId: number,
    filters?: { fromDate?: Date; toDate?: Date }
  ): Promise<Buffer> {
    const analytics = await analyticsService.getCallbackAnalytics(businessId, filters);
    console.log("[PDF Service] Generating report with analytics:", {
      totalCallbacks: analytics.summary?.totalCallbacks,
      staffCount: analytics.staffPerformance?.length,
    });

    const html = this.generateCallbackReportHTML(analytics);

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        margin: {
          top: "20mm",
          right: "15mm",
          bottom: "20mm",
          left: "15mm",
        },
        printBackground: true,
      });

      return Buffer.from(pdf);
    } catch (error) {
      console.error("[PDF Service] Error generating PDF:", error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async generatePaymentReceipt(data: PaymentReceiptData): Promise<Buffer> {
    const html = this.generatePaymentReceiptHTML(data);
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdf = await page.pdf({
        format: "A4",
        margin: {
          top: "15mm",
          right: "12mm",
          bottom: "15mm",
          left: "12mm",
        },
        printBackground: true,
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }

  private generateCallbackReportHTML(data: CallbackAnalyticsData): string {
    const formatDate = (dateStr: string | null) => {
      if (!dateStr) return "All Time";
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    };

    const formatHours = (hours: number | null) => {
      if (hours === null) return "N/A";
      if (hours < 24) return `${hours.toFixed(1)} hours`;
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours === 0) return `${days} day${days !== 1 ? "s" : ""}`;
      return `${days} day${days !== 1 ? "s" : ""} ${remainingHours.toFixed(1)} hours`;
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.6;
      color: #333;
      background: #fff;
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1e40af;
      font-size: 28px;
      margin-bottom: 5px;
    }
    .header .subtitle {
      color: #64748b;
      font-size: 14px;
    }
    .date-range {
      background: #f1f5f9;
      padding: 10px 15px;
      border-radius: 6px;
      margin-bottom: 25px;
      font-size: 11px;
      color: #475569;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 15px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 15px;
    }
    .summary-card h3 {
      font-size: 11px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
    }
    .summary-card .value {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 18px;
      font-weight: 700;
      color: #1e40af;
      margin-bottom: 15px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      font-size: 11px;
    }
    thead {
      background: #1e40af;
      color: white;
    }
    th {
      padding: 10px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    td {
      padding: 10px 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    tbody tr:hover {
      background: #f8fafc;
    }
    .text-right {
      text-align: right;
    }
    .text-center {
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-success {
      background: #dcfce7;
      color: #166534;
    }
    .badge-warning {
      background: #fef3c7;
      color: #92400e;
    }
    .badge-info {
      background: #dbeafe;
      color: #1e40af;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin-bottom: 25px;
    }
    .stat-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
    }
    .stat-box h4 {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 5px;
    }
    .stat-box .stat-value {
      font-size: 20px;
      font-weight: 700;
      color: #1e293b;
    }
    .footer {
      margin-top: 40px;
      padding-top: 15px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 10px;
      color: #94a3b8;
    }
    @media print {
      .section {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Customer Callback Analytics Report</h1>
    <div class="subtitle">Performance Overview & Staff Metrics</div>
  </div>

  <div class="date-range">
    <strong>Report Period:</strong> ${formatDate(data.dateRange.from)} - ${formatDate(data.dateRange.to)}
    <br>
    <strong>Generated:</strong> ${new Date().toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <h3>Total Callbacks</h3>
      <div class="value">${data.summary.totalCallbacks}</div>
    </div>
    <div class="summary-card">
      <h3>Completed</h3>
      <div class="value">${data.summary.totalCompleted}</div>
    </div>
    <div class="summary-card">
      <h3>Pending</h3>
      <div class="value">${data.summary.totalPending}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <h3>Completion Rate</h3>
      <div class="value">${data.summary.completionRate.toFixed(1)}%</div>
    </div>
    <div class="summary-card">
      <h3>Avg Completion Time</h3>
      <div class="value">${formatHours(data.summary.overallAvgCompletionTimeHours)}</div>
    </div>
    <div class="summary-card">
      <h3>Longest Completion Time</h3>
      <div class="value">${formatHours(data.summary.overallLongestCompletionTimeHours)}</div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Staff Performance</h2>
    <table>
      <thead>
        <tr>
          <th>Staff Member</th>
          <th class="text-center">Total</th>
          <th class="text-center">Completed</th>
          <th class="text-center">Pending</th>
          <th class="text-center">Completion Rate</th>
          <th class="text-center">Avg Time</th>
          <th class="text-center">Longest Time</th>
        </tr>
      </thead>
      <tbody>
        ${data.staffPerformance
          .map(
            (staff) => `
        <tr>
          <td><strong>${staff.staffName}</strong></td>
          <td class="text-center">${staff.totalCallbacks}</td>
          <td class="text-center">${staff.completedCallbacks}</td>
          <td class="text-center">${staff.pendingCallbacks}</td>
          <td class="text-center">${staff.completionRate.toFixed(1)}%</td>
          <td class="text-center">${formatHours(staff.avgCompletionTimeHours)}</td>
          <td class="text-center">${formatHours(staff.longestCompletionTimeHours)}</td>
        </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2 class="section-title">Status Breakdown</h2>
    <div class="stats-grid">
      <div class="stat-box">
        <h4>Pending</h4>
        <div class="stat-value">${data.statusBreakdown.pending}</div>
      </div>
      <div class="stat-box">
        <h4>Completed</h4>
        <div class="stat-value">${data.statusBreakdown.completed}</div>
      </div>
      <div class="stat-box">
        <h4>Archived</h4>
        <div class="stat-value">${data.statusBreakdown.archived}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2 class="section-title">Priority Distribution</h2>
    <div class="stats-grid">
      <div class="stat-box">
        <h4>Low</h4>
        <div class="stat-value">${data.priorityDistribution.low}</div>
      </div>
      <div class="stat-box">
        <h4>Medium</h4>
        <div class="stat-value">${data.priorityDistribution.medium}</div>
      </div>
      <div class="stat-box">
        <h4>High</h4>
        <div class="stat-value">${data.priorityDistribution.high}</div>
      </div>
      <div class="stat-box">
        <h4>Urgent</h4>
        <div class="stat-value">${data.priorityDistribution.urgent}</div>
      </div>
    </div>
  </div>

  <div class="footer">
    This report was generated automatically by the Workshop Operations System
  </div>
</body>
</html>
    `;
  }

  private generatePaymentReceiptHTML(data: PaymentReceiptData): string {
    const esc = (value?: string | null) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const row = (label: string, value?: string | null) =>
      `<tr><td class="label">${esc(label)}</td><td class="value">${esc(value || "—")}</td></tr>`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 0; }
    .page { padding: 24px; }
    h1 { margin: 0 0 6px 0; font-size: 24px; color: #0f172a; }
    .sub { color: #475569; font-size: 12px; margin-bottom: 18px; }
    .section { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
    .section h2 { margin: 0; padding: 10px 12px; background: #f8fafc; font-size: 13px; text-transform: uppercase; letter-spacing: .3px; color: #334155; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 12px; border-top: 1px solid #f1f5f9; vertical-align: top; }
    .label { width: 36%; font-weight: 600; color: #475569; }
    .value { width: 64%; color: #0f172a; }
    .footer { margin-top: 10px; font-size: 11px; color: #64748b; }
    a { color: #0f766e; text-decoration: none; }
  </style>
</head>
<body>
  <div class="page">
    <h1>Payment Receipt</h1>
    <div class="sub">Receipt no: ${esc(data.receiptNumber)} • Generated ${esc(new Date().toISOString())}</div>

    <div class="section">
      <h2>Payment Details</h2>
      <table>
        ${row("Amount paid", `£${data.amount}`)}
        ${row("Paid at", data.paidAt)}
        ${row("Payment method", data.paymentMethod)}
        ${row("Payment reference", data.paymentReference)}
        ${row("Description", data.paymentDescription)}
        ${row("Stripe proof link", data.stripeReceiptUrl || "Not provided")}
      </table>
    </div>

    <div class="section">
      <h2>Job & Machine Details</h2>
      <table>
        ${row("Job ID", data.jobId)}
        ${row("Machine make", data.machineMake)}
        ${row("Machine model", data.machineModel)}
        ${row("Machine details", data.machineDescription)}
      </table>
    </div>

    <div class="section">
      <h2>Customer Details</h2>
      <table>
        ${row("Customer name", data.customerName)}
        ${row("Phone number", data.customerPhone)}
        ${row("Email address", data.customerEmail)}
      </table>
    </div>

    <div class="section">
      <h2>Business Details</h2>
      <table>
        ${row("Business", data.businessName)}
        ${row("Address", data.businessAddress)}
        ${row("Phone", data.businessPhone)}
        ${row("Email", data.businessEmail)}
      </table>
    </div>

    <div class="footer">This receipt confirms payment received and is generated by the Boltdown payment system.</div>
  </div>
</body>
</html>`;
  }
}

export const pdfService = new PDFService();

