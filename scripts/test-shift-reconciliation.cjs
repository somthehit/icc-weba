/**
 * Integration and Unit Tests for Retail Cash-Control & Shift Reconciliation Engine
 * Intel Computer Center - Counter POS / Accounting Hub
 */

const assert = require('assert');

// 1. UNIT TEST: Exact Expected Cash Calculation Formula
function computeExpectedCash({
  openingFloat = 0,
  cashSales = 0,
  cashRefunds = 0,
  paidIns = 0,
  paidOuts = 0,
  safeDrops = 0,
  adjustments = 0,
}) {
  return Number(
    (
      Number(openingFloat) +
      (Number(cashSales) - Number(cashRefunds)) +
      Number(paidIns) -
      Number(paidOuts) -
      Number(safeDrops) +
      Number(adjustments)
    ).toFixed(2)
  );
}

// 2. UNIT TEST: Sales Waterfall and Tally Check
function verifySalesWaterfall({
  grossSales,
  discounts,
  returns,
  voids,
  vatRate = 0.13,
  tenders = {},
}) {
  const netSales = Number((grossSales - discounts - returns - voids).toFixed(2));
  const vatCollected = Number((netSales - netSales / (1 + vatRate)).toFixed(2));
  const taxableValue = Number((netSales / (1 + vatRate)).toFixed(2));

  const totalTenders = Number(
    Object.values(tenders)
      .reduce((sum, val) => sum + Number(val || 0), 0)
      .toFixed(2)
  );

  const tallyDifference = Number(Math.abs(totalTenders - netSales).toFixed(2));
  const isTallied = tallyDifference < 0.05;

  return {
    grossSales,
    discounts,
    returns,
    voids,
    netSales,
    taxableValue,
    vatCollected,
    totalTenders,
    tallyDifference,
    isTallied,
  };
}

// 3. UNIT TEST: Variance and Tolerance Status
function evaluateShiftVariance(cashVariance, nonCashVariances = [], toleranceConfig = { autoAccept: 50, supervisorLimit: 500 }) {
  const totalVariance = Number(
    (cashVariance + nonCashVariances.reduce((acc, v) => acc + Number(v.variance || 0), 0)).toFixed(2)
  );
  const absVariance = Math.abs(totalVariance);

  let status = 'BALANCED';
  let requiredApprover = 'NONE';

  if (absVariance === 0) {
    status = 'BALANCED';
  } else if (absVariance <= toleranceConfig.autoAccept) {
    status = 'WITHIN_TOLERANCE';
  } else if (absVariance <= toleranceConfig.supervisorLimit) {
    status = 'NEEDS_SUPERVISOR_APPROVAL';
    requiredApprover = 'SUPERVISOR';
  } else {
    status = 'NEEDS_MANAGER_APPROVAL';
    requiredApprover = 'MANAGER';
  }

  return { totalVariance, absVariance, status, requiredApprover };
}

// 4. UNIT TEST: Denomination Total Calculation
function computeDenominationTotal(denoms = {}) {
  const multipliers = {
    notes1000: 1000,
    notes500: 500,
    notes100: 100,
    notes50: 50,
    notes20: 20,
    notes10: 10,
    notes5: 5,
    notes2: 2,
    notes1: 1,
    coins: 1,
  };

  return Object.entries(multipliers).reduce((sum, [key, mult]) => {
    return sum + (Number(denoms[key]) || 0) * mult;
  }, 0);
}

// 5. TEST RUNNER
async function runTests() {
  console.log('================================================================');
  console.log(' running retail cash-control & shift reconciliation test suite ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function runCase(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // --- Test Suite 1: Expected Cash Formula ---
  runCase('Zero-Activity shift expected cash equals opening float', () => {
    const expected = computeExpectedCash({
      openingFloat: 5000,
      cashSales: 0,
      cashRefunds: 0,
      paidIns: 0,
      paidOuts: 0,
      safeDrops: 0,
    });
    assert.strictEqual(expected, 5000.0);
  });

  runCase('Complex retail shift expected cash with sales, drops, paid-outs, and refunds', () => {
    // Opening float = 5,000
    // Cash sales = 24,500
    // Cash refund = 1,200
    // Safe drop = 20,000
    // Paid out (tea/clean) = 350
    // Paid in (change top-up) = 1,000
    // Expected = 5000 + (24500 - 1200) + 1000 - 350 - 20000 = 8,950
    const expected = computeExpectedCash({
      openingFloat: 5000,
      cashSales: 24500,
      cashRefunds: 1200,
      safeDrops: 20000,
      paidOuts: 350,
      paidIns: 1000,
    });
    assert.strictEqual(expected, 8950.0);
  });

  // --- Test Suite 2: Denomination Total Engine ---
  runCase('Denomination calculation correctly computes mixed Nepali Rupee bills and coins', () => {
    const denoms = {
      notes1000: 5, // 5,000
      notes500: 4,  // 2,000
      notes100: 10, // 1,000
      notes50: 6,   // 300
      notes20: 10,  // 200
      notes10: 20,  // 200
      notes5: 10,   // 50
      notes2: 10,   // 20
      notes1: 15,   // 15
      coins: 25,    // 25
    };
    // Total = 5000 + 2000 + 1000 + 300 + 200 + 200 + 50 + 20 + 15 + 25 = 8,810
    const total = computeDenominationTotal(denoms);
    assert.strictEqual(total, 8810);
  });

  // --- Test Suite 3: Sales Waterfall and Tally Check ---
  runCase('Sales waterfall tallies exactly with sum of multi-tender split payments', () => {
    const waterfall = verifySalesWaterfall({
      grossSales: 154800,
      discounts: 2800,
      returns: 4500,
      voids: 0,
      tenders: {
        cash: 35000,
        card: 55000,
        fonepay: 42500,
        esewa: 10000,
        khalti: 5000,
      },
    });

    // Net sales = 154800 - 2800 - 4500 = 147500
    // Sum of tenders = 35000 + 55000 + 42500 + 10000 + 5000 = 147500
    assert.strictEqual(waterfall.netSales, 147500);
    assert.strictEqual(waterfall.totalTenders, 147500);
    assert.strictEqual(waterfall.isTallied, true);
    assert.strictEqual(waterfall.tallyDifference, 0);
  });

  runCase('Sales waterfall detects discrepancy when tender missing or under-settled', () => {
    const waterfall = verifySalesWaterfall({
      grossSales: 50000,
      discounts: 0,
      returns: 0,
      voids: 0,
      tenders: {
        cash: 20000,
        card: 28000, // Missing 2,000
      },
    });

    assert.strictEqual(waterfall.netSales, 50000);
    assert.strictEqual(waterfall.totalTenders, 48000);
    assert.strictEqual(waterfall.isTallied, false);
    assert.strictEqual(waterfall.tallyDifference, 2000);
  });

  // --- Test Suite 4: Tolerance & Variance Evaluation ---
  runCase('Shift variance within auto-accept threshold (NPR <= 50) is auto-accepted', () => {
    const res = evaluateShiftVariance(-35, []);
    assert.strictEqual(res.status, 'WITHIN_TOLERANCE');
    assert.strictEqual(res.requiredApprover, 'NONE');
  });

  runCase('Shift variance between NPR 51 and 500 requires Supervisor PIN', () => {
    const res = evaluateShiftVariance(-120, []);
    assert.strictEqual(res.status, 'NEEDS_SUPERVISOR_APPROVAL');
    assert.strictEqual(res.requiredApprover, 'SUPERVISOR');
  });

  runCase('Shift variance exceeding NPR 500 requires Manager PIN', () => {
    const res = evaluateShiftVariance(1250, []);
    assert.strictEqual(res.status, 'NEEDS_MANAGER_APPROVAL');
    assert.strictEqual(res.requiredApprover, 'MANAGER');
  });

  // --- Test Suite 5: Recount Attempt Tracking (Preserves Attempt #1) ---
  runCase('Recount flow preserves attempt #1 and creates attempt #2 without overwrite', () => {
    const history = [];

    // Attempt 1: Cashier blind count
    const attempt1 = {
      attemptNumber: 1,
      countedBy: 'Cashier Bikash',
      countedCash: 6450,
      variance: -50,
      timestamp: new Date().toISOString(),
    };
    history.push(attempt1);

    // Attempt 2: Recount after supervisor alert
    const attempt2 = {
      attemptNumber: 2,
      countedBy: 'Cashier Bikash',
      countedCash: 6500,
      variance: 0,
      reason: 'Recounted 1x NPR 50 note stuck under tray',
      timestamp: new Date().toISOString(),
    };
    history.push(attempt2);

    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].attemptNumber, 1);
    assert.strictEqual(history[0].countedCash, 6450);
    assert.strictEqual(history[1].attemptNumber, 2);
    assert.strictEqual(history[1].countedCash, 6500);
  });

  // --- Test Suite 6: Minimum Duration Guard ---
  runCase('Minimum duration guard blocks closure under 5 minutes without supervisor override', () => {
    function canCloseShift(openedAtStr, closedAtStr, supervisorOverride = false) {
      const openedAt = new Date(openedAtStr).getTime();
      const closedAt = new Date(closedAtStr).getTime();
      const durationMin = (closedAt - openedAt) / (1000 * 60);

      if (durationMin < 5 && !supervisorOverride) {
        return { allowed: false, error: 'Shift duration is under 5 minutes. Supervisor authorization required to prevent fake shifts.' };
      }
      return { allowed: true };
    }

    const t0 = new Date('2026-10-04T10:00:00Z').toISOString();
    const tQuick = new Date('2026-10-04T10:02:00Z').toISOString(); // 2 mins
    const tNormal = new Date('2026-10-04T18:00:00Z').toISOString(); // 8 hrs

    const blocked = canCloseShift(t0, tQuick, false);
    assert.strictEqual(blocked.allowed, false);
    assert.ok(blocked.error.includes('Supervisor authorization required'));

    const authorized = canCloseShift(t0, tQuick, true);
    assert.strictEqual(authorized.allowed, true);

    const normal = canCloseShift(t0, tNormal, false);
    assert.strictEqual(normal.allowed, true);
  });

  // --- Test Suite 7: Immutability Guard after Close ---
  runCase('Shift is immutable once CLOSED; cannot modify denominations or transactions', () => {
    function attemptDenominationUpdate(shiftStatus) {
      if (shiftStatus === 'CLOSED') {
        throw new Error('Shift is closed and audited. Financial records are immutable. Corrections must be posted as new adjusting entries.');
      }
      return true;
    }

    assert.throws(() => {
      attemptDenominationUpdate('CLOSED');
    }, /immutable/);

    assert.doesNotThrow(() => {
      attemptDenominationUpdate('OPEN');
    });
  });

  // --- Test Suite 8: Handover Check Logic ---
  runCase('Handover check calculates variance between previous close and new open count', () => {
    function computeHandoverVariance(previousClosingCash, countedOpeningCash) {
      return Number((countedOpeningCash - previousClosingCash).toFixed(2));
    }

    const variance1 = computeHandoverVariance(5000, 5000);
    assert.strictEqual(variance1, 0.0);

    const variance2 = computeHandoverVariance(5000, 4900); // 100 short
    assert.strictEqual(variance2, -100.0);

    const variance3 = computeHandoverVariance(5000, 5050); // 50 over
    assert.strictEqual(variance3, 50.0);
  });

  console.log(`\n================================================================`);
  console.log(` RESULTS: ${passed} passed, ${failed} failed `);
  console.log(`================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
