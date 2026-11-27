// ============================================================================
// ALL sample data for the Owner portal lives in this one file.
// Screens that import from here show a "Demo data" badge. To make a screen live, replace
// its import from this file with a Supabase query that returns the same shape.
// ============================================================================

const day = 86_400_000;
const iso = (offsetDays: number, hour = 9) => {
  const d = new Date(Date.now() + offsetDays * day);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const dateOnly = (offsetDays: number) => iso(offsetDays).slice(0, 10);
const months = (() => {
  const out: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(d.toLocaleString("en-GB", { month: "short" }));
  }
  return out;
})();

// ---------------------------------------------------------------- overview

const monthlyIncome = [62, 58, 71, 66, 80, 77, 85, 92, 88, 96, 104, 99].map((k) => k * 1000);
const monthlyExpense = [48, 47, 55, 52, 61, 60, 63, 70, 69, 72, 78, 74].map((k) => k * 1000);

export const overviewDemo = {
  kpis: {
    revenue: monthlyIncome.reduce((a, b) => a + b, 0),
    revenueTrend: 8,
    expenses: monthlyExpense.reduce((a, b) => a + b, 0),
    expensesTrend: 5,
    cash: 18_450,
    bank: 142_300,
    receivable: 64_900,
    payable: 27_350,
  },
  projects: { active: 7, completed: 23, delayed: 2 },
  projectProgress: [
    { name: "Axmed family villa", progress: 64, planned: 70 },
    { name: "Khadra commercial block", progress: 31, planned: 28 },
    { name: "Primary school extension", progress: 88, planned: 100 },
    { name: "Jigjiga Yar apartments B", progress: 45, planned: 50 },
    { name: "Masalaha clinic", progress: 12, planned: 10 },
    { name: "Shacab warehouse", progress: 73, planned: 75 },
  ],
  budgetVsActual: [
    { project: "Villa", budget: 73_900, actual: 47_100 },
    { project: "Comm. block", budget: 118_600, actual: 36_800 },
    { project: "School", budget: 55_300, actual: 52_900 },
    { project: "Apartments B", budget: 210_000, actual: 98_400 },
    { project: "Clinic", budget: 64_000, actual: 7_200 },
    { project: "Warehouse", budget: 41_500, actual: 30_100 },
  ],
  attendance: { present: 38, absent: 4, onLeave: 3, labourers: 61 },
  payroll: { total: 31_840, staff: 45, paid: 0, month: months[11] },
  construction: { onSchedule: 71, stagesDone: 4, avgProgress: 52 },
  realEstate: { occupancy: 83, rentCollected: 9_450, rentDue: 1_400, unitsSold: 3 },
  procurement: { openRequests: 6, awaitingDelivery: 3, ordersThisMonth: 11 },
  lowStock: [
    { item: "Rebar 16 mm", onHand: 38, reorder: 80, unit: "bar" },
    { item: "Cement 42.5N", onHand: 168, reorder: 200, unit: "bag" },
    { item: "Paint white 20 L", onHand: 6, reorder: 15, unit: "bucket" },
    { item: "Tile adhesive", onHand: 12, reorder: 40, unit: "bag" },
  ],
  monthly: months.map((m, i) => ({ month: m, income: monthlyIncome[i]!, expenses: monthlyExpense[i]!, profit: monthlyIncome[i]! - monthlyExpense[i]! })),
};

// ---------------------------------------------------------------- finance

export const financeDemo = {
  accounts: [
    { id: "a1", name: "Main bank account", kind: "bank", bank: "Bank (demo)", number: "****4410", balance: 118_900 },
    { id: "a2", name: "Projects bank account", kind: "bank", bank: "Bank (demo)", number: "****7731", balance: 23_400 },
    { id: "a3", name: "Office cash", kind: "cash", bank: "—", number: "—", balance: 6_250 },
    { id: "a4", name: "Site petty cash", kind: "cash", bank: "—", number: "—", balance: 2_100 },
    { id: "a5", name: "Zaad merchant", kind: "mobile_money", bank: "Mobile money", number: "****0090", balance: 10_100 },
  ],
  monthly: months.map((m, i) => ({ month: m, income: monthlyIncome[i]!, expenses: monthlyExpense[i]! })),
  expenseByCategory: [
    { name: "Materials", value: 412_000 },
    { name: "Labour", value: 198_000 },
    { name: "Salaries", value: 121_000 },
    { name: "Equipment & fuel", value: 38_500 },
    { name: "Transport", value: 21_200 },
    { name: "Office & admin", value: 18_900 },
    { name: "Marketing", value: 9_400 },
  ],
  transactions: [
    { id: "t1", date: iso(-1), description: "Milestone — Columns (Villa)", category: "Construction revenue", type: "income", project: "Axmed family villa", amount: 8_000 },
    { id: "t2", date: iso(-1), description: "Cement 200 bags", category: "Materials", type: "expense", project: "Khadra commercial block", amount: 1_500 },
    { id: "t3", date: iso(-2), description: "Labour wages week 47", category: "Labour", type: "expense", project: "Axmed family villa", amount: 2_340 },
    { id: "t4", date: iso(-3), description: "Rent — Jigjiga Yar A1, A2", category: "Rental income", type: "income", project: "—", amount: 700 },
    { id: "t5", date: iso(-4), description: "Generator fuel", category: "Equipment & fuel", type: "expense", project: "Primary school extension", amount: 320 },
    { id: "t6", date: iso(-5), description: "Deposit — Masalaha clinic", category: "Client deposits", type: "income", project: "Masalaha clinic", amount: 12_800 },
    { id: "t7", date: iso(-6), description: "Truck hire", category: "Transport", type: "expense", project: "Shacab warehouse", amount: 450 },
    { id: "t8", date: iso(-7), description: "Office rent", category: "Office & admin", type: "expense", project: "—", amount: 900 },
    { id: "t9", date: iso(-8), description: "Facebook ads — November", category: "Marketing", type: "expense", project: "—", amount: 300 },
    { id: "t10", date: iso(-9), description: "Steel bars 310", category: "Materials", type: "expense", project: "Khadra commercial block", amount: 3_038 },
    { id: "t11", date: iso(-10), description: "Plot 14 final payment", category: "Property sales", type: "income", project: "—", amount: 14_000 },
    { id: "t12", date: iso(-12), description: "Salaries October", category: "Salaries", type: "expense", project: "—", amount: 31_200 },
  ],
  receivable: [
    { id: "r1", client: "Axmed Cali", project: "Axmed family villa", current: 2_400, d30: 9_000, d60: 0, d90: 0 },
    { id: "r2", client: "Khadra Xuseen", project: "Khadra commercial block", current: 28_000, d30: 0, d60: 0, d90: 0 },
    { id: "r3", client: "Hargeisa Schools Trust", project: "Primary school extension", current: 0, d30: 0, d60: 7_400, d90: 0 },
    { id: "r4", client: "Masalaha Health Group", project: "Masalaha clinic", current: 12_800, d30: 0, d60: 0, d90: 0 },
    { id: "r5", client: "Ubax Trading", project: "Shacab warehouse", current: 0, d30: 2_300, d60: 0, d90: 3_000 },
  ],
  payable: [
    { id: "p1", supplier: "Berbera Cement Traders", current: 4_500, d30: 7_500, d60: 0, d90: 0, dueNext: dateOnly(6) },
    { id: "p2", supplier: "Hargeisa Steel & Iron", current: 3_900, d30: 0, d60: 0, d90: 0, dueNext: dateOnly(3) },
    { id: "p3", supplier: "Gacan Libaax Blocks", current: 1_850, d30: 2_100, d60: 0, d90: 0, dueNext: dateOnly(12) },
    { id: "p4", supplier: "Sahal Plumbing Supplies", current: 0, d30: 0, d60: 4_100, d90: 0, dueNext: dateOnly(-2) },
    { id: "p5", supplier: "Nuur Electrical", current: 3_400, d30: 0, d60: 0, d90: 0, dueNext: dateOnly(20) },
  ],
  invoices: [
    { id: "i1", no: "INV-2026-0141", client: "Axmed Cali", project: "Axmed family villa", type: "milestone", issue: dateOnly(-20), due: dateOnly(-5), amount: 17_000, paid: 8_000, status: "overdue" },
    { id: "i2", no: "INV-2026-0142", client: "Axmed Cali", project: "Axmed family villa", type: "extra", issue: dateOnly(-15), due: dateOnly(15), amount: 2_400, paid: 0, status: "pending" },
    { id: "i3", no: "INV-2026-0143", client: "Khadra Xuseen", project: "Khadra commercial block", type: "milestone", issue: dateOnly(-8), due: dateOnly(7), amount: 28_000, paid: 0, status: "pending" },
    { id: "i4", no: "INV-2026-0144", client: "Hargeisa Schools Trust", project: "Primary school extension", type: "milestone", issue: dateOnly(-55), due: dateOnly(-40), amount: 12_400, paid: 5_000, status: "overdue" },
    { id: "i5", no: "INV-2026-0145", client: "Masalaha Health Group", project: "Masalaha clinic", type: "deposit", issue: dateOnly(-6), due: dateOnly(4), amount: 12_800, paid: 12_800, status: "paid" },
    { id: "i6", no: "INV-2026-0146", client: "Ubax Trading", project: "Shacab warehouse", type: "milestone", issue: dateOnly(-100), due: dateOnly(-90), amount: 9_000, paid: 6_000, status: "overdue" },
    { id: "i7", no: "INV-2026-0147", client: "Ubax Trading", project: "Shacab warehouse", type: "extra", issue: dateOnly(-35), due: dateOnly(-25), amount: 2_300, paid: 0, status: "overdue" },
    { id: "i8", no: "INV-2026-0148", client: "Khadra Xuseen", project: "Khadra commercial block", type: "milestone", issue: "", due: "", amount: 28_000, paid: 0, status: "draft" },
    { id: "i9", no: "INV-2026-0139", client: "Axmed Cali", project: "Axmed family villa", type: "deposit", issue: dateOnly(-125), due: dateOnly(-115), amount: 17_000, paid: 17_000, status: "paid" },
    { id: "i10", no: "INV-2026-0140", client: "Axmed Cali", project: "Axmed family villa", type: "milestone", issue: dateOnly(-88), due: dateOnly(-78), amount: 17_000, paid: 17_000, status: "paid" },
    { id: "i11", no: "INV-2026-0137", client: "Khadra Xuseen", project: "Khadra commercial block", type: "deposit", issue: dateOnly(-65), due: dateOnly(-55), amount: 28_000, paid: 28_000, status: "paid" },
    { id: "i12", no: "INV-2026-0130", client: "Old client", project: "Boundary wall", type: "milestone", issue: dateOnly(-250), due: dateOnly(-240), amount: 9_000, paid: 0, status: "cancelled" },
  ],
  payments: [
    { id: "pm1", ref: "ZAAD-88231", date: iso(-3), client: "Axmed Cali", project: "Axmed family villa", method: "zaad", amount: 8_000, status: "confirmed" },
    { id: "pm2", ref: "BNK-55102", date: iso(-6), client: "Masalaha Health Group", project: "Masalaha clinic", method: "bank", amount: 12_800, status: "confirmed" },
    { id: "pm3", ref: "SIF-10293", date: iso(-1), client: "Khadra Xuseen", project: "Khadra commercial block", method: "sifalo_pay", amount: 5_000, status: "pending" },
    { id: "pm4", ref: "CASH-0441", date: iso(-35), client: "Hargeisa Schools Trust", project: "Primary school extension", method: "cash", amount: 5_000, status: "confirmed" },
    { id: "pm5", ref: "EDH-77310", date: iso(-60), client: "Khadra Xuseen", project: "Khadra commercial block", method: "edahab", amount: 28_000, status: "confirmed" },
    { id: "pm6", ref: "ZAAD-80022", date: iso(-80), client: "Axmed Cali", project: "Axmed family villa", method: "zaad", amount: 17_000, status: "confirmed" },
    { id: "pm7", ref: "EVC-31002", date: iso(-91), client: "Ubax Trading", project: "Shacab warehouse", method: "evc", amount: 6_000, status: "confirmed" },
  ],
  receipts: [
    { id: "rc1", no: "RCT-2026-0211", date: iso(-3), client: "Axmed Cali", method: "zaad", amount: 8_000, payment: "ZAAD-88231" },
    { id: "rc2", no: "RCT-2026-0210", date: iso(-6), client: "Masalaha Health Group", method: "bank", amount: 12_800, payment: "BNK-55102" },
    { id: "rc3", no: "RCT-2026-0207", date: iso(-35), client: "Hargeisa Schools Trust", method: "cash", amount: 5_000, payment: "CASH-0441" },
    { id: "rc4", no: "RCT-2026-0199", date: iso(-60), client: "Khadra Xuseen", method: "edahab", amount: 28_000, payment: "EDH-77310" },
    { id: "rc5", no: "RCT-2026-0190", date: iso(-80), client: "Axmed Cali", method: "zaad", amount: 17_000, payment: "ZAAD-80022" },
  ],
  pl: {
    revenue: [
      { label: "Construction revenue", amount: 812_000 },
      { label: "Rental income", amount: 38_400 },
      { label: "Property sales", amount: 127_000 },
    ],
    costOfWork: [
      { label: "Materials", amount: 412_000 },
      { label: "Labour", amount: 198_000 },
      { label: "Equipment & fuel", amount: 38_500 },
    ],
    operating: [
      { label: "Salaries", amount: 121_000 },
      { label: "Transport", amount: 21_200 },
      { label: "Office & admin", amount: 18_900 },
      { label: "Marketing", amount: 9_400 },
    ],
  },
  cashflow: (() => {
    let closing = 96_000;
    return months.map((m, i) => {
      const inflow = monthlyIncome[i]! + (i % 3 === 0 ? 9_000 : 0);
      const outflow = monthlyExpense[i]! + (i % 4 === 0 ? 6_000 : 0);
      const opening = closing;
      closing = opening + inflow - outflow;
      return { month: m, opening, inflow, outflow, closing };
    });
  })(),
};

// ---------------------------------------------------------------- CRM

export const crmDemo = {
  clients: [
    {
      id: "c1", name: "Axmed Cali", phone: "+252 63 410 0001", email: "axmed@example.com", address: "Masalaha, Hargeisa", since: dateOnly(-140),
      projects: [{ code: "PRJ-2026-0007", name: "Axmed family villa", status: "active", progress: 64 }, { code: "PRJ-2025-0031", name: "Boundary wall", status: "handed_over", progress: 100 }],
      contractValue: 94_000, paid: 50_000,
      contracts: [{ no: "CON-2026-0007", value: 85_000, signed: dateOnly(-125), status: "signed" }, { no: "CON-2025-0031", value: 9_000, signed: dateOnly(-305), status: "completed" }],
      payments: [{ date: iso(-3), amount: 8_000, method: "zaad" }, { date: iso(-80), amount: 17_000, method: "zaad" }, { date: iso(-120), amount: 17_000, method: "bank" }],
      complaints: [],
      messages: [{ from: "Axmed Cali", body: "When will the walls be finished?", date: iso(-2) }, { from: "Maxamed (PM)", body: "About two more weeks. Photos are in today's report.", date: iso(-2, 11) }],
    },
    {
      id: "c2", name: "Khadra Xuseen", phone: "+252 63 410 0002", email: "khadra@example.com", address: "Shacab, Hargeisa", since: dateOnly(-70),
      projects: [{ code: "PRJ-2026-0009", name: "Khadra commercial block", status: "active", progress: 31 }],
      contractValue: 140_000, paid: 33_000,
      contracts: [{ no: "CON-2026-0009", value: 140_000, signed: dateOnly(-65), status: "signed" }],
      payments: [{ date: iso(-1), amount: 5_000, method: "sifalo_pay" }, { date: iso(-60), amount: 28_000, method: "edahab" }],
      complaints: [{ subject: "Noise in the evening", status: "open", date: iso(-4) }],
      messages: [{ from: "Khadra Xuseen", body: "Please send the updated BOQ.", date: iso(-5) }],
    },
    {
      id: "c3", name: "Hargeisa Schools Trust", phone: "+252 63 410 0009", email: "office@schools.example", address: "26 June, Hargeisa", since: dateOnly(-210),
      projects: [{ code: "PRJ-2026-0003", name: "Primary school extension", status: "active", progress: 88 }],
      contractValue: 62_000, paid: 42_200,
      contracts: [{ no: "CON-2026-0003", value: 62_000, signed: dateOnly(-205), status: "signed" }],
      payments: [{ date: iso(-35), amount: 5_000, method: "cash" }, { date: iso(-110), amount: 12_400, method: "bank" }],
      complaints: [{ subject: "Delay on roof", status: "in_progress", date: iso(-12) }],
      messages: [],
    },
    {
      id: "c4", name: "Masalaha Health Group", phone: "+252 63 410 0012", email: "admin@clinic.example", address: "Masalaha, Hargeisa", since: dateOnly(-12),
      projects: [{ code: "PRJ-2026-0012", name: "Masalaha clinic", status: "active", progress: 12 }],
      contractValue: 64_000, paid: 12_800,
      contracts: [{ no: "CON-2026-0012", value: 64_000, signed: dateOnly(-10), status: "signed" }],
      payments: [{ date: iso(-6), amount: 12_800, method: "bank" }],
      complaints: [], messages: [],
    },
    {
      id: "c5", name: "Ubax Trading", phone: "+252 63 410 0015", email: "ubax@example.com", address: "Shacab, Hargeisa", since: dateOnly(-180),
      projects: [{ code: "PRJ-2026-0005", name: "Shacab warehouse", status: "active", progress: 73 }],
      contractValue: 46_000, paid: 33_700,
      contracts: [{ no: "CON-2026-0005", value: 46_000, signed: dateOnly(-175), status: "signed" }],
      payments: [{ date: iso(-91), amount: 6_000, method: "evc" }],
      complaints: [{ subject: "Gate size different from drawing", status: "resolved", date: iso(-40) }],
      messages: [],
    },
  ],
  leads: [
    { id: "l1", name: "Ismaaciil Faarax", phone: "+252 63 410 0003", source: "website", status: "new", interest: "construction", budget: 60_000, assigned: "Deeqa", created: iso(-1) },
    { id: "l2", name: "Sucaad Maxamed", phone: "+252 63 410 0021", source: "whatsapp", status: "new", interest: "construction", budget: 45_000, assigned: "Deeqa", created: iso(0) },
    { id: "l3", name: "Fadumo Jaamac", phone: "+252 63 410 0004", source: "whatsapp", status: "contacted", interest: "property_rent", budget: 400, assigned: "Bashiir", created: iso(-6) },
    { id: "l4", name: "Cabdi Nuur", phone: "+252 63 410 0022", source: "referral", status: "contacted", interest: "construction", budget: 120_000, assigned: "Deeqa", created: iso(-9) },
    { id: "l5", name: "Mustafe Cabdi", phone: "+252 63 410 0005", source: "walk_in", status: "visiting", interest: "property_buy", budget: 95_000, assigned: "Bashiir", created: iso(-14) },
    { id: "l6", name: "Hodan Ciise", phone: "+252 63 410 0023", source: "facebook", status: "visiting", interest: "construction", budget: 70_000, assigned: "Deeqa", created: iso(-16) },
    { id: "l7", name: "Masalaha Health Group", phone: "+252 63 410 0012", source: "referral", status: "signed", interest: "construction", budget: 64_000, assigned: "Deeqa", created: iso(-30) },
    { id: "l8", name: "Khadra Xuseen", phone: "+252 63 410 0002", source: "referral", status: "signed", interest: "construction", budget: 140_000, assigned: "Deeqa", created: iso(-80) },
    { id: "l9", name: "Hibo Maxamuud", phone: "+252 63 410 0006", source: "facebook", status: "lost", interest: "construction", budget: 30_000, assigned: "Deeqa", created: iso(-40), lostReason: "Budget too low" },
    { id: "l10", name: "Warsame Yuusuf", phone: "+252 63 410 0024", source: "website", status: "lost", interest: "property_buy", budget: 50_000, assigned: "Bashiir", created: iso(-45), lostReason: "Bought elsewhere" },
  ],
};

// ---------------------------------------------------------------- procurement

export const procurementDemo = {
  requests: [
    { id: "mr1", no: "MR-2026-0031", project: "Axmed family villa", stage: "roof", requestedBy: "Xasan (Engineer)", neededBy: dateOnly(7), items: 2, total: 8_600, status: "submitted" },
    { id: "mr2", no: "MR-2026-0030", project: "Khadra commercial block", stage: "columns", requestedBy: "Muna (Engineer)", neededBy: dateOnly(3), items: 4, total: 14_200, status: "sourcing" },
    { id: "mr3", no: "MR-2026-0029", project: "Shacab warehouse", stage: "roof", requestedBy: "Yuusuf (Supervisor)", neededBy: dateOnly(2), items: 1, total: 3_100, status: "ordered" },
    { id: "mr4", no: "MR-2026-0028", project: "Primary school extension", stage: "finishing", requestedBy: "Xasan (Engineer)", neededBy: dateOnly(-1), items: 6, total: 5_450, status: "delivered" },
    { id: "mr5", no: "MR-2026-0027", project: "Masalaha clinic", stage: "foundation", requestedBy: "Muna (Engineer)", neededBy: dateOnly(5), items: 3, total: 9_800, status: "pm_approved" },
    { id: "mr6", no: "MR-2026-0026", project: "Axmed family villa", stage: "walls", requestedBy: "Xasan (Engineer)", neededBy: dateOnly(-12), items: 2, total: 6_900, status: "issued" },
    { id: "mr7", no: "MR-2026-0025", project: "Khadra commercial block", stage: "foundation", requestedBy: "Muna (Engineer)", neededBy: dateOnly(-30), items: 2, total: 2_200, status: "rejected" },
  ],
  quotes: [
    { id: "q1", request: "MR-2026-0030", supplier: "Hargeisa Steel & Iron", total: 13_900, validUntil: dateOnly(10), selected: true },
    { id: "q2", request: "MR-2026-0030", supplier: "Berbera Steel Co.", total: 14_600, validUntil: dateOnly(6), selected: false },
    { id: "q3", request: "MR-2026-0030", supplier: "Burao Metals", total: 15_250, validUntil: dateOnly(14), selected: false },
    { id: "q4", request: "MR-2026-0027", supplier: "Berbera Cement Traders", total: 9_450, validUntil: dateOnly(8), selected: false },
    { id: "q5", request: "MR-2026-0027", supplier: "Gacan Libaax Blocks", total: 9_900, validUntil: dateOnly(8), selected: false },
    { id: "q6", request: "MR-2026-0029", supplier: "Berbera Cement Traders", total: 3_050, validUntil: dateOnly(-1), selected: true },
  ],
  orders: [
    { id: "po1", no: "PO-2026-0058", supplier: "Hargeisa Steel & Iron", project: "Khadra commercial block", total: 13_900, created: dateOnly(-2), expected: dateOnly(3), status: "waiting" },
    { id: "po2", no: "PO-2026-0057", supplier: "Berbera Cement Traders", project: "Shacab warehouse", total: 3_050, created: dateOnly(-4), expected: dateOnly(1), status: "ordered" },
    { id: "po3", no: "PO-2026-0056", supplier: "Gacan Libaax Blocks", project: "Axmed family villa", total: 5_900, created: dateOnly(-14), expected: dateOnly(-9), status: "delivered" },
    { id: "po4", no: "PO-2026-0055", supplier: "Sahal Plumbing Supplies", project: "Primary school extension", total: 4_100, created: dateOnly(-20), expected: dateOnly(-12), status: "delivered" },
    { id: "po5", no: "PO-2026-0054", supplier: "Nuur Electrical", project: "Shacab warehouse", total: 3_400, created: dateOnly(-6), expected: dateOnly(4), status: "approved" },
    { id: "po6", no: "PO-2026-0053", supplier: "Berbera Cement Traders", project: "Masalaha clinic", total: 12_500, created: dateOnly(-1), expected: dateOnly(9), status: "waiting" },
  ],
  suppliers: [
    { id: "s1", name: "Berbera Cement Traders", contact: "Cabdi", phone: "+252 63 420 0001", category: "Cement", terms: "30 days", orders: 24, spent: 96_400, status: "active" },
    { id: "s2", name: "Hargeisa Steel & Iron", contact: "Warsame", phone: "+252 63 420 0002", category: "Steel", terms: "On delivery", orders: 18, spent: 121_300, status: "active" },
    { id: "s3", name: "Gacan Libaax Blocks", contact: "Nuur", phone: "+252 63 420 0003", category: "Blocks", terms: "15 days", orders: 15, spent: 48_700, status: "active" },
    { id: "s4", name: "Sahal Plumbing Supplies", contact: "Sahal", phone: "+252 63 420 0004", category: "Plumbing", terms: "30 days", orders: 9, spent: 22_900, status: "active" },
    { id: "s5", name: "Nuur Electrical", contact: "Nuur", phone: "+252 63 420 0005", category: "Electrical", terms: "15 days", orders: 11, spent: 31_600, status: "active" },
    { id: "s6", name: "Burao Metals", contact: "Jaamac", phone: "+252 63 420 0006", category: "Steel", terms: "On delivery", orders: 2, spent: 4_100, status: "inactive" },
  ],
  historySeries: [{ key: "cement", label: "Cement" }, { key: "steel", label: "Steel" }, { key: "other", label: "Other materials" }],
  history: months.slice(6).map((m, i) => ({ month: m, cement: [14, 12, 18, 16, 21, 17][i]! * 1000, steel: [19, 22, 17, 25, 23, 28][i]! * 1000, other: [8, 9, 7, 11, 10, 12][i]! * 1000 })),
};

// ---------------------------------------------------------------- inventory

export const inventoryDemo = {
  items: [
    { id: "it1", sku: "CEM-425", name: "Cement 42.5N", category: "Cement", unit: "bag", onHand: 168, reorder: 200, unitCost: 7.5, location: "Main yard" },
    { id: "it2", sku: "STL-12", name: "Rebar 12 mm", category: "Steel", unit: "bar", onHand: 90, reorder: 150, unitCost: 9.8, location: "Main yard" },
    { id: "it3", sku: "STL-16", name: "Rebar 16 mm", category: "Steel", unit: "bar", onHand: 38, reorder: 80, unitCost: 16.5, location: "Main yard" },
    { id: "it4", sku: "BLK-20", name: "Concrete block 20 cm", category: "Blocks", unit: "pcs", onHand: 1_400, reorder: 2_000, unitCost: 0.65, location: "Main yard" },
    { id: "it5", sku: "BLK-15", name: "Concrete block 15 cm", category: "Blocks", unit: "pcs", onHand: 3_900, reorder: 1_500, unitCost: 0.55, location: "Main yard" },
    { id: "it6", sku: "SND-01", name: "Sand", category: "Aggregates", unit: "m3", onHand: 15, reorder: 20, unitCost: 18, location: "Main yard" },
    { id: "it7", sku: "AGG-20", name: "Gravel 20 mm", category: "Aggregates", unit: "m3", onHand: 42, reorder: 20, unitCost: 22, location: "Main yard" },
    { id: "it8", sku: "PNT-WH", name: "Paint white 20 L", category: "Finishing", unit: "bucket", onHand: 6, reorder: 15, unitCost: 38, location: "Store room" },
    { id: "it9", sku: "TIL-AD", name: "Tile adhesive", category: "Finishing", unit: "bag", onHand: 12, reorder: 40, unitCost: 9, location: "Store room" },
    { id: "it10", sku: "PIP-50", name: "PVC pipe 50 mm", category: "Plumbing", unit: "length", onHand: 85, reorder: 30, unitCost: 6.2, location: "Store room" },
    { id: "it11", sku: "WIR-25", name: "Electric wire 2.5 mm", category: "Electrical", unit: "roll", onHand: 22, reorder: 10, unitCost: 31, location: "Store room" },
    { id: "it12", sku: "TIM-PL", name: "Formwork plywood", category: "Timber", unit: "sheet", onHand: 64, reorder: 40, unitCost: 24, location: "Main yard" },
  ],
  movements: [
    { id: "m1", date: iso(0, 8), item: "Cement 42.5N", direction: "out", qty: 60, unit: "bag", project: "Khadra commercial block", stage: "columns", condition: "ok", by: "Cumar (Store)" },
    { id: "m2", date: iso(-1, 15), item: "Rebar 12 mm", direction: "in", qty: 200, unit: "bar", project: "—", stage: "—", condition: "ok", by: "Cumar (Store)" },
    { id: "m3", date: iso(-1, 10), item: "Concrete block 20 cm", direction: "out", qty: 1_800, unit: "pcs", project: "Axmed family villa", stage: "walls", condition: "ok", by: "Cumar (Store)" },
    { id: "m4", date: iso(-2, 9), item: "Cement 42.5N", direction: "out", qty: 12, unit: "bag", project: "Axmed family villa", stage: "walls", condition: "damaged", by: "Cumar (Store)" },
    { id: "m5", date: iso(-3, 14), item: "Sand", direction: "out", qty: 45, unit: "m3", project: "Primary school extension", stage: "roof", condition: "ok", by: "Cumar (Store)" },
    { id: "m6", date: iso(-4, 11), item: "Paint white 20 L", direction: "out", qty: 2, unit: "bucket", project: "—", stage: "—", condition: "missing", by: "Cumar (Store)" },
    { id: "m7", date: iso(-5, 9), item: "Formwork plywood", direction: "in", qty: 40, unit: "sheet", project: "—", stage: "—", condition: "ok", by: "Cumar (Store)" },
    { id: "m8", date: iso(-6, 13), item: "Rebar 16 mm", direction: "out", qty: 40, unit: "bar", project: "Shacab warehouse", stage: "roof", condition: "ok", by: "Cumar (Store)" },
    { id: "m9", date: iso(-7, 10), item: "PVC pipe 50 mm", direction: "out", qty: 3, unit: "length", project: "Primary school extension", stage: "finishing", condition: "damaged", by: "Cumar (Store)" },
    { id: "m10", date: iso(-8, 16), item: "Tile adhesive", direction: "adjust", qty: -4, unit: "bag", project: "—", stage: "—", condition: "missing", by: "Cumar (Store)" },
  ],
};

// ---------------------------------------------------------------- HR

export const hrDemo = {
  employees: [
    { id: "e1", no: "EMP-001", name: "Hodan Axmed", job: "General manager", department: "Management", hired: dateOnly(-1200), salary: 2_400, phone: "+252 63 400 0002", status: "active" },
    { id: "e2", no: "EMP-002", name: "Faarax Cumar", job: "Finance officer", department: "Finance", hired: dateOnly(-900), salary: 1_350, phone: "+252 63 400 0003", status: "active" },
    { id: "e3", no: "EMP-003", name: "Ayaan Saleebaan", job: "Accountant", department: "Finance", hired: dateOnly(-700), salary: 1_100, phone: "+252 63 400 0004", status: "active" },
    { id: "e4", no: "EMP-004", name: "Sahra Diiriye", job: "HR officer", department: "HR", hired: dateOnly(-650), salary: 1_000, phone: "+252 63 400 0005", status: "active" },
    { id: "e5", no: "EMP-005", name: "Maxamed Jaamac", job: "Project manager", department: "Construction", hired: dateOnly(-1100), salary: 1_900, phone: "+252 63 400 0008", status: "active" },
    { id: "e6", no: "EMP-006", name: "Xasan Cilmi", job: "Site engineer", department: "Construction", hired: dateOnly(-500), salary: 1_300, phone: "+252 63 400 0009", status: "active" },
    { id: "e7", no: "EMP-007", name: "Muna Faarax", job: "Site engineer", department: "Construction", hired: dateOnly(-300), salary: 1_250, phone: "+252 63 400 0019", status: "active" },
    { id: "e8", no: "EMP-008", name: "Yuusuf Warsame", job: "Site supervisor", department: "Construction", hired: dateOnly(-800), salary: 950, phone: "+252 63 400 0010", status: "on_leave" },
    { id: "e9", no: "EMP-009", name: "Nimco Xirsi", job: "Quantity surveyor", department: "Construction", hired: dateOnly(-420), salary: 1_200, phone: "+252 63 400 0011", status: "active" },
    { id: "e10", no: "EMP-010", name: "Ilhaan Maxamuud", job: "Architect", department: "Design", hired: dateOnly(-380), salary: 1_450, phone: "+252 63 400 0012", status: "active" },
    { id: "e11", no: "EMP-011", name: "Cumar Aadan", job: "Storekeeper", department: "Supply", hired: dateOnly(-950), salary: 700, phone: "+252 63 400 0007", status: "active" },
    { id: "e12", no: "EMP-012", name: "Deeqa Yaasiin", job: "Marketing officer", department: "Sales", hired: dateOnly(-260), salary: 850, phone: "+252 63 400 0013", status: "active" },
    { id: "e13", no: "EMP-013", name: "Bashiir Cali", job: "Real estate officer", department: "Sales", hired: dateOnly(-190), salary: 900, phone: "+252 63 400 0014", status: "active" },
    { id: "e14", no: "EMP-014", name: "Jaamac Ismaaciil", job: "Procurement officer", department: "Supply", hired: dateOnly(-560), salary: 1_050, phone: "+252 63 400 0006", status: "active" },
  ],
  attendance: [
    { id: "at1", name: "Xasan Cilmi", kind: "employee", project: "Axmed family villa", checkIn: iso(0, 6), checkOut: null, lat: 9.5625, lng: 44.0769, status: "present" },
    { id: "at2", name: "Guuleed (mason)", kind: "labourer", project: "Axmed family villa", checkIn: iso(0, 7), checkOut: null, lat: 9.5624, lng: 44.077, status: "present" },
    { id: "at3", name: "Rooble (helper)", kind: "labourer", project: "Axmed family villa", checkIn: iso(0, 7), checkOut: null, lat: 9.5624, lng: 44.0771, status: "present" },
    { id: "at4", name: "Barkhad (steel fixer)", kind: "labourer", project: "Axmed family villa", checkIn: null, checkOut: null, lat: null, lng: null, status: "absent" },
    { id: "at5", name: "Muna Faarax", kind: "employee", project: "Khadra commercial block", checkIn: iso(0, 7), checkOut: null, lat: 9.558, lng: 44.065, status: "present" },
    { id: "at6", name: "Sharmaarke (carpenter)", kind: "labourer", project: "Khadra commercial block", checkIn: iso(0, 7), checkOut: null, lat: 9.5581, lng: 44.0651, status: "present" },
    { id: "at7", name: "Yuusuf Warsame", kind: "employee", project: "—", checkIn: null, checkOut: null, lat: null, lng: null, status: "on_leave" },
    { id: "at8", name: "Cali Xuseen", kind: "employee", project: "Primary school extension", checkIn: iso(0, 7), checkOut: null, lat: 9.5512, lng: 44.0603, status: "present" },
  ],
  labourers: [
    { id: "lb1", name: "Guuleed", trade: "Mason", phone: "+252 63 430 0001", dailyRate: 15, daysWorked: 21, project: "Axmed family villa", status: "active" },
    { id: "lb2", name: "Rooble", trade: "Helper", phone: "+252 63 430 0002", dailyRate: 8, daysWorked: 22, project: "Axmed family villa", status: "active" },
    { id: "lb3", name: "Barkhad", trade: "Steel fixer", phone: "+252 63 430 0003", dailyRate: 14, daysWorked: 17, project: "Axmed family villa", status: "active" },
    { id: "lb4", name: "Sharmaarke", trade: "Carpenter", phone: "+252 63 430 0004", dailyRate: 14, daysWorked: 20, project: "Khadra commercial block", status: "active" },
    { id: "lb5", name: "Cawil", trade: "Helper", phone: "+252 63 430 0005", dailyRate: 8, daysWorked: 19, project: "Khadra commercial block", status: "active" },
    { id: "lb6", name: "Ciise", trade: "Plumber", phone: "+252 63 430 0006", dailyRate: 16, daysWorked: 9, project: "Primary school extension", status: "active" },
    { id: "lb7", name: "Liibaan", trade: "Electrician", phone: "+252 63 430 0007", dailyRate: 17, daysWorked: 11, project: "Shacab warehouse", status: "active" },
  ],
  leave: [
    { id: "lv1", name: "Cali Xuseen", type: "annual", start: dateOnly(10), end: dateOnly(14), days: 5, reason: "Family visit in Burco", status: "pending" },
    { id: "lv2", name: "Yuusuf Warsame", type: "sick", start: dateOnly(-2), end: dateOnly(3), days: 6, reason: "Doctor's note", status: "approved" },
    { id: "lv3", name: "Deeqa Yaasiin", type: "annual", start: dateOnly(20), end: dateOnly(27), days: 8, reason: "Wedding", status: "pending" },
    { id: "lv4", name: "Cumar Aadan", type: "unpaid", start: dateOnly(-30), end: dateOnly(-28), days: 3, reason: "Personal", status: "rejected" },
    { id: "lv5", name: "Ayaan Saleebaan", type: "annual", start: dateOnly(-60), end: dateOnly(-55), days: 6, reason: "Holiday", status: "approved" },
  ],
  payroll: [
    { id: "py1", name: "Hodan Axmed", gross: 2_400, allowances: 100, deductions: 60, status: "draft" },
    { id: "py2", name: "Faarax Cumar", gross: 1_350, allowances: 50, deductions: 35, status: "draft" },
    { id: "py3", name: "Ayaan Saleebaan", gross: 1_100, allowances: 50, deductions: 30, status: "draft" },
    { id: "py4", name: "Sahra Diiriye", gross: 1_000, allowances: 50, deductions: 25, status: "draft" },
    { id: "py5", name: "Maxamed Jaamac", gross: 1_900, allowances: 100, deductions: 50, status: "draft" },
    { id: "py6", name: "Xasan Cilmi", gross: 1_300, allowances: 80, deductions: 35, status: "draft" },
    { id: "py7", name: "Muna Faarax", gross: 1_250, allowances: 80, deductions: 35, status: "draft" },
    { id: "py8", name: "Yuusuf Warsame", gross: 950, allowances: 50, deductions: 20, status: "draft" },
    { id: "py9", name: "Nimco Xirsi", gross: 1_200, allowances: 50, deductions: 30, status: "draft" },
    { id: "py10", name: "Ilhaan Maxamuud", gross: 1_450, allowances: 50, deductions: 40, status: "draft" },
    { id: "py11", name: "Cumar Aadan", gross: 700, allowances: 30, deductions: 15, status: "draft" },
    { id: "py12", name: "Deeqa Yaasiin", gross: 850, allowances: 30, deductions: 20, status: "draft" },
  ].map((p) => ({ ...p, net: p.gross + p.allowances - p.deductions })),
};

// ---------------------------------------------------------------- real estate

export const realEstateDemo = {
  properties: [
    { id: "pr1", title: "Jigjiga Yar apartments", type: "apartment_block", listing: "rent", location: "Jigjiga Yar, Hargeisa", price: 0, rent: 400, units: 8, occupied: 7, status: "available" },
    { id: "pr2", title: "Masalaha townhouse", type: "house", listing: "sale", location: "Masalaha, Hargeisa", price: 95_000, rent: 0, units: 1, occupied: 0, status: "reserved" },
    { id: "pr3", title: "Plot 14 — New Hargeisa", type: "land", listing: "sale", location: "New Hargeisa", price: 28_000, rent: 0, units: 1, occupied: 1, status: "sold" },
    { id: "pr4", title: "Shacab shops row", type: "shop", listing: "rent", location: "Shacab, Hargeisa", price: 0, rent: 250, units: 6, occupied: 5, status: "available" },
    { id: "pr5", title: "Villa 3 — Ga'an Libah", type: "house", listing: "both", location: "Ga'an Libah, Hargeisa", price: 135_000, rent: 1_100, units: 1, occupied: 0, status: "available" },
  ],
  tenants: [
    { id: "tn1", name: "Abshir Cabdi", phone: "+252 63 440 0001", property: "Jigjiga Yar apartments", unit: "A1", rent: 350, since: dateOnly(-150), balance: 0, status: "active" },
    { id: "tn2", name: "Ubah Maxamed", phone: "+252 63 440 0002", property: "Jigjiga Yar apartments", unit: "A2", rent: 350, since: dateOnly(-60), balance: 350, status: "active" },
    { id: "tn3", name: "Cabdiraxiim Shop", phone: "+252 63 440 0003", property: "Shacab shops row", unit: "S1", rent: 250, since: dateOnly(-300), balance: 0, status: "active" },
    { id: "tn4", name: "Nasra Pharmacy", phone: "+252 63 440 0004", property: "Shacab shops row", unit: "S2", rent: 250, since: dateOnly(-200), balance: 500, status: "active" },
    { id: "tn5", name: "Liban Electronics", phone: "+252 63 440 0005", property: "Shacab shops row", unit: "S4", rent: 250, since: dateOnly(-90), balance: 0, status: "active" },
  ],
  buyers: [
    { id: "by1", name: "Mustafe Cabdi", phone: "+252 63 410 0005", property: "Masalaha townhouse", price: 95_000, paid: 10_000, status: "reserved" },
    { id: "by2", name: "Plot buyer", phone: "+252 63 440 0010", property: "Plot 14 — New Hargeisa", price: 28_000, paid: 28_000, status: "completed" },
    { id: "by3", name: "Ruqiya Xasan", phone: "+252 63 440 0011", property: "Villa 3 — Ga'an Libah", price: 135_000, paid: 0, status: "visiting" },
  ],
  agreements: [
    { id: "ag1", no: "RA-2026-0012", kind: "rental", party: "Abshir Cabdi", property: "Jigjiga Yar apartments · A1", start: dateOnly(-150), end: dateOnly(215), value: 350, status: "active" },
    { id: "ag2", no: "RA-2026-0018", kind: "rental", party: "Ubah Maxamed", property: "Jigjiga Yar apartments · A2", start: dateOnly(-60), end: dateOnly(305), value: 350, status: "active" },
    { id: "ag3", no: "RA-2025-0041", kind: "rental", party: "Nasra Pharmacy", property: "Shacab shops row · S2", start: dateOnly(-200), end: dateOnly(165), value: 250, status: "active" },
    { id: "ag4", no: "SA-2026-0004", kind: "sale", party: "Plot buyer", property: "Plot 14 — New Hargeisa", start: dateOnly(-40), end: "", value: 28_000, status: "completed" },
    { id: "ag5", no: "SA-2026-0006", kind: "sale", party: "Mustafe Cabdi", property: "Masalaha townhouse", start: "", end: "", value: 95_000, status: "draft" },
  ],
  rentPayments: [
    { id: "rp1", tenant: "Abshir Cabdi", unit: "A1", period: dateOnly(-5), amount: 350, method: "zaad", paidAt: iso(-3), status: "confirmed" },
    { id: "rp2", tenant: "Ubah Maxamed", unit: "A2", period: dateOnly(-5), amount: 350, method: "zaad", paidAt: null, status: "pending" },
    { id: "rp3", tenant: "Cabdiraxiim Shop", unit: "S1", period: dateOnly(-5), amount: 250, method: "cash", paidAt: iso(-4), status: "confirmed" },
    { id: "rp4", tenant: "Nasra Pharmacy", unit: "S2", period: dateOnly(-5), amount: 250, method: "edahab", paidAt: null, status: "overdue" },
    { id: "rp5", tenant: "Liban Electronics", unit: "S4", period: dateOnly(-5), amount: 250, method: "evc", paidAt: iso(-2), status: "confirmed" },
    { id: "rp6", tenant: "Abshir Cabdi", unit: "A1", period: dateOnly(-35), amount: 350, method: "zaad", paidAt: iso(-33), status: "confirmed" },
  ],
  viewings: [
    { id: "vw1", visitor: "Fadumo Jaamac", phone: "+252 63 410 0004", property: "Jigjiga Yar apartments · B1", when: iso(1, 10), agent: "Bashiir", status: "scheduled" },
    { id: "vw2", visitor: "Ruqiya Xasan", phone: "+252 63 440 0011", property: "Villa 3 — Ga'an Libah", when: iso(2, 16), agent: "Bashiir", status: "scheduled" },
    { id: "vw3", visitor: "Mustafe Cabdi", phone: "+252 63 410 0005", property: "Masalaha townhouse", when: iso(-2, 11), agent: "Bashiir", status: "done" },
    { id: "vw4", visitor: "Warsame Yuusuf", phone: "+252 63 410 0024", property: "Villa 3 — Ga'an Libah", when: iso(-6, 15), agent: "Bashiir", status: "no_show" },
  ],
};

// ---------------------------------------------------------------- marketing

export const marketingDemo = {
  campaigns: [
    { id: "cp1", name: "Ramadan villa offer", channel: "Facebook + TikTok", media: "social", budget: 1_500, spent: 920, leads: 34, signed: 2, start: dateOnly(-20), end: dateOnly(10), status: "running" },
    { id: "cp2", name: "Apartments for rent — Jigjiga Yar", channel: "Street posters", media: "poster", budget: 400, spent: 400, leads: 12, signed: 3, start: dateOnly(-90), end: dateOnly(-30), status: "ended" },
    { id: "cp3", name: "Build with Hangool — radio", channel: "Radio", media: "ad", budget: 900, spent: 300, leads: 9, signed: 0, start: dateOnly(-7), end: dateOnly(23), status: "running" },
    { id: "cp4", name: "New Year villa promo", channel: "Facebook", media: "video", budget: 1_200, spent: 0, leads: 0, signed: 0, start: dateOnly(30), end: dateOnly(60), status: "planned" },
  ],
  followUps: [
    { id: "fu1", lead: "Ismaaciil Faarax", note: "Send BOQ example", due: iso(1, 10), assigned: "Deeqa", status: "pending" },
    { id: "fu2", lead: "Cabdi Nuur", note: "Call about site visit", due: iso(0, 15), assigned: "Deeqa", status: "pending" },
    { id: "fu3", lead: "Fadumo Jaamac", note: "Confirm viewing B1", due: iso(-1, 9), assigned: "Bashiir", status: "overdue" },
    { id: "fu4", lead: "Hodan Ciise", note: "Share villa designs", due: iso(-3, 11), assigned: "Deeqa", status: "done" },
  ],
  inquiries: [
    { id: "iq1", name: "Sucaad Maxamed", channel: "whatsapp", message: "How much to build a 3-bedroom house?", received: iso(0, 8), status: "new" },
    { id: "iq2", name: "Ismaaciil Faarax", channel: "website", message: "Please send me your price list.", received: iso(-1, 19), status: "contacted" },
    { id: "iq3", name: "Anonymous", channel: "website", message: "Do you rent shops in Shacab?", received: iso(-2, 13), status: "new" },
    { id: "iq4", name: "Hodan Ciise", channel: "whatsapp", message: "I saw your Facebook video, can I visit a site?", received: iso(-16, 17), status: "visiting" },
    { id: "iq5", name: "Liibaan Cali", channel: "whatsapp", message: "Is the townhouse still available?", received: iso(-3, 10), status: "contacted" },
  ],
  leadsBySource: [
    { name: "WhatsApp", value: 41 },
    { name: "Website", value: 23 },
    { name: "Facebook", value: 19 },
    { name: "Referral", value: 14 },
    { name: "Walk-in", value: 8 },
  ],
};

// ---------------------------------------------------------------- documents

export const documentsDemo = [
  {
    id: "d1", title: "Building permit — villa", category: "permit", linkedTo: "Project · Axmed family villa", version: 2, updated: iso(-30), uploadedBy: "Maxamed (PM)", size: 820_000, expires: dateOnly(200),
    access: [{ who: "Project team", canEdit: true }, { who: "Client", canEdit: false }],
    versions: [{ v: 2, date: iso(-30), by: "Maxamed (PM)", note: "Stamped by municipality", size: 820_000 }, { v: 1, date: iso(-120), by: "Maxamed (PM)", note: "Application copy", size: 640_000 }],
  },
  {
    id: "d2", title: "Signed contract — commercial block", category: "contract", linkedTo: "Client · Khadra Xuseen", version: 1, updated: iso(-65), uploadedBy: "Owner", size: 1_400_000, expires: "",
    access: [{ who: "Owner", canEdit: true }, { who: "Finance", canEdit: false }, { who: "Client", canEdit: false }],
    versions: [{ v: 1, date: iso(-65), by: "Owner", note: "Signed by both parties", size: 1_400_000 }],
  },
  {
    id: "d3", title: "Architectural drawings set", category: "drawing", linkedTo: "Project · Masalaha clinic", version: 3, updated: iso(-4), uploadedBy: "Ilhaan (Architect)", size: 12_600_000, expires: "",
    access: [{ who: "Project team", canEdit: true }],
    versions: [{ v: 3, date: iso(-4), by: "Ilhaan (Architect)", note: "Client changes: bigger waiting room", size: 12_600_000 }, { v: 2, date: iso(-11), by: "Ilhaan (Architect)", note: "Structural review", size: 12_100_000 }, { v: 1, date: iso(-15), by: "Ilhaan (Architect)", note: "First issue", size: 11_800_000 }],
  },
  {
    id: "d4", title: "Employment contract — Xasan Cilmi", category: "contract", linkedTo: "Employee · Xasan Cilmi", version: 1, updated: iso(-500), uploadedBy: "Sahra (HR)", size: 310_000, expires: dateOnly(230),
    access: [{ who: "HR", canEdit: true }, { who: "Xasan Cilmi", canEdit: false }],
    versions: [{ v: 1, date: iso(-500), by: "Sahra (HR)", note: "", size: 310_000 }],
  },
  {
    id: "d5", title: "Supplier agreement — Berbera Cement", category: "contract", linkedTo: "Supplier · Berbera Cement Traders", version: 2, updated: iso(-90), uploadedBy: "Jaamac (Procurement)", size: 540_000, expires: dateOnly(20),
    access: [{ who: "Procurement", canEdit: true }, { who: "Finance", canEdit: false }],
    versions: [{ v: 2, date: iso(-90), by: "Jaamac (Procurement)", note: "New prices for 2026", size: 540_000 }, { v: 1, date: iso(-460), by: "Jaamac (Procurement)", note: "", size: 500_000 }],
  },
  {
    id: "d6", title: "Title deed — Plot 14", category: "certificate", linkedTo: "Property · Plot 14 — New Hargeisa", version: 1, updated: iso(-40), uploadedBy: "Bashiir (Real estate)", size: 960_000, expires: "",
    access: [{ who: "Real estate", canEdit: true }, { who: "Owner", canEdit: true }],
    versions: [{ v: 1, date: iso(-40), by: "Bashiir (Real estate)", note: "Transferred to buyer", size: 960_000 }],
  },
  {
    id: "d7", title: "Monthly site safety report — October", category: "report", linkedTo: "Project · Khadra commercial block", version: 1, updated: iso(-27), uploadedBy: "Muna (Engineer)", size: 2_200_000, expires: "",
    access: [{ who: "Project team", canEdit: true }],
    versions: [{ v: 1, date: iso(-27), by: "Muna (Engineer)", note: "", size: 2_200_000 }],
  },
  {
    id: "d8", title: "Company trade licence", category: "permit", linkedTo: "—", version: 4, updated: iso(-300), uploadedBy: "Owner", size: 450_000, expires: dateOnly(65),
    access: [{ who: "Owner", canEdit: true }, { who: "General manager", canEdit: false }],
    versions: [{ v: 4, date: iso(-300), by: "Owner", note: "Renewed 2026", size: 450_000 }],
  },
];
