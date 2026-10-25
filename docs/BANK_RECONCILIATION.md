# Bank & Digital Wallet Reconciliation Module (Nepal Enterprise ERP)

A secure, accurate, double-entry auto-matching reconciliation module for retail electronics stores in Nepal handling POS counters and e-commerce operations.

---

## 1. Supported Accounts & Gateways
| Account / Gateway | Provider | Account Code | GL Link | Currency | Function |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Nabil Bank Operating A/C** | Nabil Bank | `0101017500123` | `1020` | NPR | Principal operating account, supplier wire transfers, VAT settlements |
| **NIMB Corporate A/C** | NIMB Bank | `0010100023489` | `1031` | NPR | Corporate collections, high-value supplier payables |
| **eSewa Merchant Wallet** | eSewa Fonepay | `9801234567` | `1043` | NPR | Online checkout e-commerce orders, instant customer refunds |
| **Khalti Merchant Wallet** | Khalti Digital | `9841098765` | `1041` | NPR | E-commerce gateway payout & cash-in |
| **Fonepay QR Dynamic Clearing** | Fonepay Network | `FONEPAY-RET-01` | `1042` | NPR | In-store dynamic QR counter settlements |
| **ConnectIPS Clearing** | NCHL | `IPS-ECOM-001` | `1044` | NPR | Real-time interbank e-commerce payment clearing |
| **Main Cash Safe** | Cashier Float | `VAULT-01` | `1010` | NPR | Daily POS blind close cash drops, bank deposits |

---

## 2. Bug Fixes Applied (Phase 1)
1. **Resolved `NPR NaN` Bug**:
   - **Root cause**: The previous UI attempted `Number(s.depositAmount)` on undefined fields (`debitAmount` vs `depositAmount`).
   - **Resolution**: Created [`lib/nepal/money.ts`](../lib/nepal/money.ts) with `formatNpr()` and integer Paisa arithmetic. Sanitizes all inputs, eliminates floating-point math, and guarantees that `NaN` can never render.
2. **Populated Reference # Column**:
   - Mapped `reference_no` from database statements, populated gateway UTR / order ID / cheque numbers, and made it searchable with instant one-click copying.
3. **Derived Dual Balances for Every Account**:
   - Shows **Statement Balance (Bank)** from imported feeds.
   - Shows **Book Balance (General Ledger)** computed from double-entry `journal_lines` (`Opening + Dr - Cr`).
   - Shows **Difference / Variance** with status chips (Green "Balanced" if difference is 0; Red/Amber variance badge if out of balance).
4. **Bikram Sambat (BS) & Gregorian (AD) Date Toggle**:
   - The header switcher toggles table dates between BS (`17 Ashwin 2082`) and AD (`2026-10-03`) with tooltips displaying both.
5. **Defined Match Rate**:
   - Clarified and displayed both rates: **Count Match Rate** (`50.0% (2 of 4)`) and **Amount Match Rate** (`74.6% by value`).
6. **Live "Sync GL" Feedback**:
   - Provides live spinner feedback, recalculates book balances against active double-entry vouchers, and shows a timestamped toast notification.
7. **Linked General Ledger Entries**:
   - MATCHED rows display their linked GL voucher numbers (`#JE-2082-REC-01`).

---

## 3. Auto-Match Rules Engine (Phase 2)
The auto-matching engine evaluates unreconciled statements against candidate GL entries in priority order:
1. **Rule 1: Exact Reference Match (100% Confidence)**
   - Matches gateway transaction ID, order number (e.g. `ORD-1049`), UTR, or cheque number against GL journal references.
2. **Rule 2: Exact Amount & Date Proximity (95% Confidence)**
   - Matches identical amount posted within a configurable window (±3 business days).
3. **Rule 3: Gateway Fee Net Settlement (85% Confidence)**
   - Evaluates net deposits where the gateway deducts its commission (e.g., 1.5% eSewa/Khalti merchant fee).
4. **Rule 4: Batch Settlement (80% Confidence)**
   - Matches a lump-sum bank deposit against the daily sum of POS card or Fonepay settlements.

Transactions scoring $\ge 90\%$ are auto-reconciled; items between $60-89\%$ are queued in the **Suggested Matches** tab with visible confidence scores and explanations.

---

## 4. Reconcile Workflow & Adjustments
- **Side-by-Side Panel**:
  - Statement line on the left.
  - Candidate GL journals and payments on the right.
  - Running difference calculation that must reach `NPR 0.00` to confirm match.
- **GL Adjusting Entry Generator**:
  - Direct posting for **Bank Charges / SMS fees** (`Dr. 5020 / Cr. 1020`).
  - Direct posting for **Interest Income** (`Dr. 1020 / Cr. 4010`).
  - Direct posting for **Minor Rounding / Foreign exchange tolerance**.
  - All adjustments create balanced double-entry vouchers in the General Ledger.

---

## 5. Bank Reconciliation Statement (BRS) & Maker-Checker Close (Phase 3)
- Implements the statutory BRS equation:
  $$\text{Adjusted Book Balance} = \text{Book Balance} + \text{Deposits In Transit} - \text{Outstanding Cheques} \pm \text{Bank Adjustments}$$
  $$\text{Variance} = \text{Statement Ending Balance} - \text{Adjusted Book Balance}$$
- **Maker-Checker Close**:
  - Prepared by the Accountant.
  - Approved & cryptographically locked by the Chief Accountant / Manager using their supervisor PIN (`1234` or `9999`).
  - Once closed, statements in the period cannot be edited without an authorized unlock reason and PIN.

---

## 6. How to Test
1. **Run Money & Currency Tests**:
   ```bash
   npx tsx scripts/test-money.mjs
   ```
2. **Run Module Integration & BRS Tests**:
   ```bash
   npx tsx scripts/test-bank-reconciliation.ts
   ```
3. **Verify in Browser**:
   - Open Accounting Hub: `http://localhost:3000/admin/accounting` (or `http://localhost:3000/store-manage`).
   - Click on the **Bank & Wallet Match** tab in the sidebar.
   - Verify that all row balances display clean Nepali formatted currencies (`NPR 45,000.00`) with zero `NaN` occurrences.
   - Toggle **Bikram Sambat (BS)** to see dates switch between BS and AD.
   - Click **Run Auto-Match** to run the matching heuristics.
   - Click **Reconcile** on any unreconciled row to open the side-by-side reconciliation drawer.
