# Student Fees Full Workflow — Architecture & Implementation Plan

## 1. Current State

### What Exists
- **Fees.jsx** — Lists `Fees` DocType with filters, stat cards, table/card views, detail panel
- **CreateFeeModal** — 2-step modal: (1) student/program/year/dates, (2) fee components with category + amount
- **Fee Categories** — 3 exist: Exam Fee, Tuition Fee, TestFee99
- **Fee Structure** — 1 exists: EDU-FST-2026-00001 (1st Standard, 2026-27, ₹5000 Tuition)
- **No Fees documents** — Zero `Fees` invoices in the system yet

### What's Missing (the full workflow)
1. No Fee Structure management UI (create/edit/view templates)
2. No batch fee generation (Fee Schedule)
3. No payment recording workflow
4. No fee waiver/discount system
5. No receipt/invoice generation
6. No student-level fee ledger
7. No bulk operations (bulk generate, bulk remind)

---

## 2. ERPNext Fee Data Model

```
Fee Category (master)
  ├── category_name: "Tuition Fee"
  ├── description
  └── item (linked Item for accounting)

Fee Structure (template per Program + Year)
  ├── program: "1st Standard"
  ├── academic_year: "2026-27"
  ├── total_amount: 5000
  ├── receivable_account, cost_center, company
  └── components[] (child table: Fee Component)
       ├── fees_category → Fee Category
       ├── amount, discount, total
       └── item

Fee Schedule (batch generation tool)
  ├── based_on: "Fee Structure" or "Student Group"
  ├── Fee Structure reference
  ├── student_groups[] (which groups to generate for)
  ├── due_date, posting_date
  └── → generates Fees documents for each student

Fees (individual invoice per student)
  ├── student, student_name, program
  ├── academic_year, due_date, posting_date
  ├── grand_total, outstanding_amount
  ├── components[] (fees_category, amount, discount, total)
  └── (submitted → creates GL entries)

Payment Entry (ERPNext core — records payment)
  ├── payment_type: "Receive"
  ├── party_type: "Customer", party: student's customer
  ├── paid_amount, references[] → Sales Invoice
  └── → reduces outstanding
```

### Entity Flow
```
Fee Category → Fee Structure → Fee Schedule → Fees (per student)
                                                    ↓
                                              Payment Entry
                                                    ↓
                                              GL Entry (accounting)
```

---

## 3. Proposed Frontend Architecture

### 3.1 Page Structure — Tabbed Fees Page

Replace current single-list Fees page with a tabbed layout:

```
+----------------------------------------------------------+
|  Fees                                    [+ New Invoice]  |
|  +--------+------------+----------+----------+----------+ |
|  |Overview|Structures  |Invoices  |Payments  | Students | |
|  +--------+------------+----------+----------+----------+ |
|                                                            |
|  (tab content here)                                        |
+----------------------------------------------------------+
```

| Tab | Purpose | Key Features |
|-----|---------|--------------|
| **Overview** | Dashboard with stats | Collection rate, overdue count, monthly trend chart, recent payments |
| **Structures** | Fee template management | CRUD Fee Structures, clone, components editor |
| **Invoices** | Current Fees list (existing) | Current table/card view, filters, status, detail panel |
| **Payments** | Record & track payments | Payment list, record payment modal, receipt download |
| **Students** | Per-student fee ledger | Student selector → full fee history, balance, payments |

### 3.2 Component Architecture

```
src/pages/Fees.jsx (main page with tabs)
├── FeesOverview.jsx        — stat cards, charts, recent activity
├── FeeStructures.jsx       — structures list + CRUD
│   ├── StructureCard.jsx   — structure preview card
│   └── StructureModal.jsx  — create/edit structure with components
├── FeeInvoices.jsx         — current Fees list (moved from Fees.jsx)
│   ├── InvoiceTable.jsx    — table view
│   ├── InvoiceCards.jsx    — card view
│   └── InvoiceDetail.jsx   — side panel detail
├── FeePayments.jsx         — payments list + recording
│   ├── PaymentTable.jsx    — payments list
│   └── RecordPaymentModal.jsx — record payment form
├── FeeStudentView.jsx      — per-student ledger
│   ├── StudentSelector.jsx — searchable student picker
│   └── StudentLedger.jsx   — fee history + payments timeline
├── GenerateFeesModal.jsx   — batch generate from structure
└── FeeWaiverModal.jsx      — apply discount/waiver
```

### 3.3 New API Hooks Needed

```javascript
// src/hooks/useFees.js

// Fee Structures
useFeeStructures(filters)          // list Fee Structures
useFeeStructure(name)              // single structure with components
useCreateFeeStructure()            // mutation
useUpdateFeeStructure()            // mutation

// Fee Schedule (batch generation)
useGenerateFees()                  // mutation: call Fee Schedule creation

// Payments
usePayments(filters)               // list Payment Entries for students
useRecordPayment()                 // mutation: create Payment Entry
usePaymentReceipt(name)            // fetch receipt data

// Student ledger
useStudentFees(studentId)          // all Fees for a student
useStudentPayments(studentId)      // all Payments for a student
useStudentFeeBalance(studentId)    // computed balance

// Fee Categories
useFeeCategories()                 // list Fee Categories
useCreateFeeCategory()             // mutation

// Bulk operations
useBulkGenerateFees()              // generate fees for multiple students
useBulkReminders()                 // send payment reminders
```

---

## 4. Detailed Feature Specifications

### 4.1 Overview Tab (Dashboard)

**Stat Cards** (enhanced from current):
- Total Billed (current academic year)
- Collected Amount + collection rate %
- Outstanding Amount + overdue count
- This Month's Collection

**Visual Elements**:
- Monthly collection trend bar chart (last 6 months)
- Status distribution donut chart (Paid/Unpaid/Partial/Overdue)
- Recent payments list (last 10)
- Overdue alerts list (top 10 longest overdue)

### 4.2 Fee Structures Tab

**List View**: Cards showing structure name, program, year, total amount, component count

**Create/Edit Structure Modal**:
```
Step 1: Basic Info
  - Program (dropdown, required)
  - Academic Year (dropdown, required)
  - Academic Term (optional)
  - Student Category (optional)

Step 2: Fee Components
  - Dynamic rows: [Fee Category v] [Amount Rs] [Discount %] [Total]
  - Add/Remove component buttons
  - Grand total display
  - Pre-fill from existing Fee Category defaults

Step 3: Accounts (auto-filled from Education Settings)
  - Receivable Account
  - Cost Center
  - Company

Actions: Save Draft, Submit
```

**Clone Structure**: Copy existing structure to new program/year

### 4.3 Invoices Tab (Current + Enhanced)

Keep existing functionality, add:
- **Bulk Select** → Generate payments, send reminders, export
- **Status quick-filters** as pills (current)
- **Generate from Structure** button → opens GenerateFeesModal
- **Record Payment** action on each invoice row

### 4.4 Payments Tab

**Payment List Table**:
| Date | Student | Invoice | Amount | Mode | Reference | Status |

**Record Payment Modal**:
```
Fields:
  - Student (searchable dropdown, required)
  - Fee Invoice (auto-populated based on student, dropdown of unpaid)
  - Amount (pre-filled with outstanding, editable for partial)
  - Payment Mode (Cash/UPI/Bank Transfer/Cheque)
  - Reference Number (for non-cash)
  - Posting Date
  - Notes (optional)

On Save:
  -> Create Payment Entry in ERPNext
  -> Update Fee outstanding_amount
  -> Invalidate queries
```

**Receipt Generation**: Download/print payment receipt (PDF via ERPNext Print Format)

### 4.5 Student View Tab

**Student Selector**: Searchable dropdown with student name, class, section

**Student Fee Ledger**:
```
+---------------------------------------------------+
|  Devashish Devashish - 1st Standard                |
|  Total Billed: Rs15,000  |  Paid: Rs10,000        |
|  Outstanding: Rs5,000    |  Status: Partial        |
+---------------------------------------------------+
|  Fee History                                       |
|  +----------+----------+---------+----------+      |
|  | Invoice  | Category | Amount  | Status   |      |
|  +----------+----------+---------+----------+      |
|  | INV-001  | Tuition  | Rs5,000 | Paid     |      |
|  | INV-002  | Exam     | Rs2,000 | Partial  |      |
|  | INV-003  | Lab      | Rs3,000 | Unpaid   |      |
|  +----------+----------+---------+----------+      |
|                                                     |
|  Payment History                                    |
|  +----------+---------+----------+----------+      |
|  | Date     | Amount  | Mode     | Ref #    |      |
|  +----------+---------+----------+----------+      |
|  | 15-May   | Rs5,000 | UPI      | TXN123   |      |
|  | 20-May   | Rs2,000 | Cash     | --       |      |
|  +----------+---------+----------+----------+      |
+---------------------------------------------------+
```

### 4.6 Generate Fees Modal (Batch)

```
Triggered by: "Generate Fees" button on Invoices tab

Step 1: Source
  - Fee Structure (dropdown) OR Manual

Step 2: Target Students
  - By Student Group (multi-select checkboxes)
  - By Program + Year (auto-resolves students)
  - Preview: shows student count + total amount

Step 3: Configuration
  - Due Date (required)
  - Posting Date (default: today)
  - Override amounts? (checkbox -> per-component overrides)

Step 4: Review & Generate
  - Summary: X students x Y components = Z total invoices
  - [Generate] button
  -> Creates Fee Schedule in ERPNext
  -> ERPNext generates Fees documents
  -> Show success count + any errors
```

### 4.7 Fee Waiver / Discount

```
Accessed from: Invoice detail panel -> "Apply Waiver" button

Modal:
  - Waiver Type: Percentage / Fixed Amount
  - Value (% or Rs)
  - Reason (dropdown: Scholarship, Sibling Discount, Staff Concession, Financial Hardship, Other)
  - Notes
  - Applies to: All components / Specific components

On Save:
  -> Update Fee components with discount
  -> Recalculate grand_total and outstanding_amount
  -> Log waiver in comments/activity
```

---

## 5. Implementation Phases

### Phase 1: Foundation (Structures + Categories)
**Files**: `src/pages/Fees.jsx`, `src/components/fees/StructureModal.jsx`, `src/hooks/useFees.js`

1. Create `src/hooks/useFees.js` with all fee-related hooks
2. Refactor `Fees.jsx` into tabbed layout
3. Move existing invoice list into `FeeInvoices.jsx`
4. Build `FeeStructures.jsx` — list + create/edit modal
5. Build `StructureModal.jsx` — 3-step structure creation

### Phase 2: Payments
**Files**: `src/components/fees/FeePayments.jsx`, `RecordPaymentModal.jsx`

1. Build `FeePayments.jsx` — payments list
2. Build `RecordPaymentModal.jsx` — payment form
3. Integrate with ERPNext Payment Entry creation
4. Add payment status tracking

### Phase 3: Student View + Batch Generation
**Files**: `src/components/fees/FeeStudentView.jsx`, `GenerateFeesModal.jsx`

1. Build `FeeStudentView.jsx` — student selector + ledger
2. Build `GenerateFeesModal.jsx` — batch fee generation
3. Integrate with Fee Schedule DocType

### Phase 4: Dashboard + Polish
**Files**: `src/components/fees/FeesOverview.jsx`

1. Build `FeesOverview.jsx` — enhanced stats, charts
2. Add fee waiver modal
3. Add bulk operations (select invoices -> actions)
4. Receipt generation integration

---

## 6. Key Technical Decisions

### Payment Recording Approach
**Option A**: Use ERPNext `Payment Entry` directly (standard ERPNext flow)
- Proper accounting (GL entries auto-created)
- Reconciliation built-in
- More complex (needs customer link, accounts)

**Option B**: Use `Payment Record` DocType (Education module's simpler type)
- Simpler, education-specific
- May not create proper GL entries
- Less standard

**Decision**: Use **Option A** (Payment Entry) for proper accounting. Students already have `customer` field linked.

### Batch Fee Generation
- Use ERPNext's `Fee Schedule` DocType which is designed for this
- Frontend creates a Fee Schedule, submits it, ERPNext generates individual Fees
- Handle errors per-student gracefully in the UI

### Fee Waivers
- Apply discounts directly on Fee components (discount field exists)
- Don't create separate DocType — use existing Fee Structure discount mechanism
- Log waiver reason in Fee comments

---

## 7. Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useFees.js` | CREATE | All fee-related React Query hooks |
| `src/pages/Fees.jsx` | REWRITE | Tabbed layout container |
| `src/components/fees/FeesOverview.jsx` | CREATE | Dashboard tab |
| `src/components/fees/FeeStructures.jsx` | CREATE | Structures list + CRUD |
| `src/components/fees/StructureModal.jsx` | CREATE | Structure create/edit modal |
| `src/components/fees/FeeInvoices.jsx` | CREATE | Invoice list (moved from Fees.jsx) |
| `src/components/fees/FeePayments.jsx` | CREATE | Payments list tab |
| `src/components/fees/RecordPaymentModal.jsx` | CREATE | Payment recording modal |
| `src/components/fees/FeeStudentView.jsx` | CREATE | Student fee ledger tab |
| `src/components/fees/GenerateFeesModal.jsx` | CREATE | Batch generation modal |
| `src/components/fees/FeeWaiverModal.jsx` | CREATE | Waiver/discount modal |

---

## 8. ERPNext Prerequisites

Before frontend implementation, verify in ERPNext:

1. **Fee Categories** — Ensure all fee types exist (Tuition, Exam, Lab, Library, Sports, Transport, etc.)
2. **Education Settings** — Verify receivable_account, cost_center, company are set
3. **Student -> Customer link** — Every student must have a linked Customer for Payment Entry
4. **Chart of Accounts** — Debtors account exists for receivables
5. **Fee Structures** — Create base structures for each program/year

---

## 9. API Call Patterns

```javascript
// List fees for current year
getList('Fees', [['academic_year', '=', selectedYear]], fields, 500)

// Create fee structure
createDoc('Fee Structure', { program, academic_year, components: [...] })

// Record payment (via callMethod for proper accounting)
callMethod('frappe.client.insert', {
  doc: {
    doctype: 'Payment Entry',
    payment_type: 'Receive',
    party_type: 'Customer',
    party: studentCustomer,
    paid_amount: amount,
    references: [{ reference_doctype: 'Fees', reference_name: feeId, allocated_amount: amount }]
  }
})

// Batch generate via Fee Schedule
createDoc('Fee Schedule', {
  based_on: 'Fee Structure',
  fee_structure: structureName,
  student_groups: [{ student_group: groupName }],
  due_date: date,
  posting_date: date
})
// Then submit to trigger generation
```
