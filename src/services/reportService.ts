import * as Print   from 'expo-print';
import * as Sharing from 'expo-sharing';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function fmt(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildHTML(
  transactions: any[],
  analytics: any,
  month: number,
  year: number,
  groupName = 'My Group',
  periodLabel?: string,
): string {
  const monthName    = periodLabel ?? MONTHS[month - 1];
  const totalIncome  = analytics?.totalIncome  || 0;
  const totalExpense = analytics?.totalExpense || 0;
  const balance      = totalIncome - totalExpense;
  const savingsRate  = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : '—';

  const categoryRows = (analytics?.categoryBreakdown || [])
    .map((c: any) => `
      <tr>
        <td>${c.category}</td>
        <td style="text-align:right; color:#F55345;">₹${fmt(c.amount)}</td>
        <td style="text-align:right; color:#71717A;">${c.percentage}%</td>
      </tr>
    `).join('');

  const txRows = [...transactions]
    .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
    .map(tx => {
      const d = new Date(tx.date || tx.createdAt);
      const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      const color = tx.type === 'income' ? '#1999FC' : '#F55345';
      const sign  = tx.type === 'income' ? '+' : '−';
      const noteTd = tx.note ? `<td style="color:#A1A1AA;font-size:11px;">${tx.note}</td>` : '<td></td>';
      return `
        <tr>
          <td style="color:#71717A;white-space:nowrap;">${dateStr}</td>
          <td>${tx.category}</td>
          ${noteTd}
          <td style="text-align:right;color:${color};font-weight:700;white-space:nowrap;">${sign}₹${fmt(tx.amount)}</td>
        </tr>
      `;
    }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #18181B; background: #fff; padding: 32px; font-size: 13px; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; }
    .header-left h1 { font-size: 22px; font-weight: 800; color: #18181B; }
    .header-left p  { font-size: 13px; color: #71717A; margin-top: 4px; }
    .header-badge { background: #E5E7EB; color: #18181B; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; }
    .summary { display: flex; gap: 12px; margin-bottom: 28px; }
    .sum-card { flex: 1; border-radius: 12px; padding: 14px 16px; }
    .sum-card.income  { background: #F0FDF4; }
    .sum-card.expense { background: #FEF2F2; }
    .sum-card.balance { background: #F3F4F6; }
    .sum-card .label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; margin-bottom: 4px; color: #71717A; }
    .sum-card .amount { font-size: 20px; font-weight: 900; }
    .sum-card.income  .amount { color: #1999FC; }
    .sum-card.expense .amount { color: #F55345; }
    .sum-card.balance .amount { color: #18181B; }
    .sum-card .sub { font-size: 11px; color: #A1A1AA; margin-top: 3px; }
    h2 { font-size: 14px; font-weight: 800; color: #18181B; margin-bottom: 10px; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #71717A; border-bottom: 2px solid #E5E7EB; padding: 6px 8px; text-align: left; }
    td { padding: 7px 8px; border-bottom: 1px solid #F3F4F6; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 40px; border-top: 1px solid #E5E7EB; padding-top: 12px; display: flex; justify-content: space-between; color: #A1A1AA; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Monthly Report</h1>
      <p>${periodLabel ? monthName : `${monthName} ${year}`} · ${groupName}</p>
    </div>
    <div class="header-badge">Savings rate: ${savingsRate}%</div>
  </div>

  <div class="summary">
    <div class="sum-card income">
      <div class="label">Total Income</div>
      <div class="amount">₹${fmt(totalIncome)}</div>
    </div>
    <div class="sum-card expense">
      <div class="label">Total Expenses</div>
      <div class="amount">₹${fmt(totalExpense)}</div>
    </div>
    <div class="sum-card balance">
      <div class="label">Net Balance</div>
      <div class="amount" style="color:${balance >= 0 ? '#1999FC' : '#F55345'};">${balance >= 0 ? '+' : '−'}₹${fmt(Math.abs(balance))}</div>
    </div>
  </div>

  ${categoryRows ? `
  <h2>Expense Categories</h2>
  <table>
    <thead><tr><th>Category</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Share</th></tr></thead>
    <tbody>${categoryRows}</tbody>
  </table>` : ''}

  <h2>Transactions (${transactions.length})</h2>
  <table>
    <thead><tr><th>Date</th><th>Category</th><th>Note</th><th style="text-align:right;">Amount</th></tr></thead>
    <tbody>${txRows || '<tr><td colspan="4" style="text-align:center;color:#A1A1AA;padding:20px;">No transactions this month</td></tr>'}</tbody>
  </table>

  <div class="footer">
    <span>Expense Tracker · ${groupName}</span>
    <span>Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
  </div>
</body>
</html>`;
}

export async function generateMonthlyPDF(
  transactions: any[],
  analytics: any,
  month: number,
  year: number,
  groupName?: string,
  periodLabel?: string,
): Promise<void> {
  const html      = buildHTML(transactions, analytics, month, year, groupName, periodLabel);
  const { uri }   = await Print.printToFileAsync({ html });
  const available = await Sharing.isAvailableAsync();

  if (available) {
    await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
  } else {
    throw new Error('Sharing not available on this device');
  }
}
