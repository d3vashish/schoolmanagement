import { client } from '../api/frappe';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getList, getDoc, getListStrict, getDocStrict, createDoc, updateDoc, deleteDoc, callMethod } from '../api/frappe';

// ── Fee Categories ──────────────────────────────────────────────────────────

export function useFeeCategories(options = {}) {
  return useQuery({
    queryKey: ['Fee Category', 'list'],
    queryFn: () => getListStrict('Fee Category', [], ['name', 'category_name', 'description', 'item'], 100),
    ...options,
  });
}

export function useCreateFeeCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createDoc('Fee Category', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Category'] }),
  });
}

// ── Fee Structures ──────────────────────────────────────────────────────────

export function useFeeStructures(filters = [], options = {}) {
  return useQuery({
    queryKey: ['Fee Structure', 'list', { filters }],
    queryFn: () => getListStrict('Fee Structure', filters, [
      'name', 'program', 'academic_year', 'academic_term', 'collection_frequency',
      'student_category', 'total_amount', 'company', 'docstatus',
      'enable_late_fee', 'late_fee_type', 'late_fee_amount', 'late_fee_percent',
      'late_fee_grace_period_days', 'late_fee_category',
    ], 100),
    ...options,
  });
}

export function useFeeStructure(name, options = {}) {
  return useQuery({
    queryKey: ['Fee Structure', name],
    queryFn: () => getDocStrict('Fee Structure', name),
    enabled: !!name,
    ...options,
  });
}

export function useCreateFeeStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createDoc('Fee Structure', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Structure'] }),
  });
}

export function useUpdateFeeStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }) => updateDoc('Fee Structure', name, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['Fee Structure'] });
      qc.invalidateQueries({ queryKey: ['Fee Structure', vars.name] });
    },
  });
}

export function useSubmitFeeStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name) => callMethod('run_doc_method', { dt: 'Fee Structure', dn: name, method: 'submit' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Structure'] }),
  });
}

// ── Fees (Invoices) ─────────────────────────────────────────────────────────

export function useFees(filters = [], options = {}) {
  return useQuery({
    queryKey: ['Fees', 'list', { filters }],
    queryFn: () => getListStrict('Fees', filters, [
      'name', 'student', 'student_name', 'program', 'academic_year',
      'outstanding_amount', 'grand_total', 'due_date', 'posting_date', 'docstatus', 'fee_structure',
    ], 500),
    ...options,
  });
}

// Fees with effective outstanding computed from submitted payments.
// ERPNext doesn't update Fees.outstanding_amount after payment,
// so we subtract submitted Payment Entry amounts from grand_total.
export function useFeesWithPayments(filters = [], options = {}) {
  const feesQuery = useFees(filters, options);
  const { data: payments = [] } = usePayments(
    [['payment_type', '=', 'Receive'], ['docstatus', '=', 1]],
    { enabled: feesQuery.isSuccess }
  );

  const feesWithOutstanding = (feesQuery.data || []).map(fee => {
    const paidForStudent = payments
      .filter(p => p.party === fee.student_name || p.party_name === fee.student_name)
      .reduce((sum, p) => sum + (p.paid_amount || 0), 0);
    const effective = Math.max(0, (fee.grand_total || 0) - paidForStudent);
    return { ...fee, effective_outstanding: effective };
  });

  return { ...feesQuery, data: feesWithOutstanding };
}

export function useFeeDoc(name, options = {}) {
  return useQuery({
    queryKey: ['Fees', name],
    queryFn: () => getDocStrict('Fees', name),
    enabled: !!name,
    ...options,
  });
}

export function useCreateFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createDoc('Fees', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fees'] }),
  });
}

export function useUpdateFee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }) => updateDoc('Fees', name, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['Fees'] });
      qc.invalidateQueries({ queryKey: ['Fees', vars.name] });
    },
  });
}

// ── Fee Schedule (Batch Generation) ─────────────────────────────────────────

export function useFeeSchedules(filters = [], options = {}) {
  return useQuery({
    queryKey: ['Fee Schedule', 'list', { filters }],
    queryFn: () => getListStrict('Fee Schedule', filters, [
      'name', 'based_on', 'fee_structure', 'due_date', 'posting_date', 'docstatus',
    ], 100),
    retry: false,
    ...options,
  });
}

export function useCreateFeeSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const doc = await createDoc('Fee Schedule', data);
      // Submit to trigger fee generation — use run_doc_method so server fetches+submits atomically
      if (doc?.name) {
        await callMethod('run_doc_method', { dt: 'Fee Schedule', dn: doc.name, method: 'submit' });
      }
      return doc;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fees'] }),
  });
}

// ── Payments ────────────────────────────────────────────────────────────────

export function usePayments(filters = [], options = {}) {
  return useQuery({
    queryKey: ['Payment Entry', 'list', { filters }],
    queryFn: () => getListStrict('Payment Entry', filters, [
      'name', 'posting_date', 'party', 'party_name', 'paid_amount',
      'payment_type', 'mode_of_payment', 'reference_no', 'docstatus',
    ], 200),
    ...options,
  });
}

// ── Student Fee Ledger ──────────────────────────────────────────────────────

export function useStudentFees(studentId, options = {}) {
  return useQuery({
    queryKey: ['Fees', 'student', studentId],
    queryFn: () => getListStrict('Fees', [['student', '=', studentId]], [
      'name', 'student', 'student_name', 'program', 'academic_year',
      'outstanding_amount', 'grand_total', 'due_date', 'posting_date', 'docstatus',
    ], 100),
    enabled: !!studentId,
    ...options,
  });
}

export function useStudentPayments(customerName, options = {}) {
  return useQuery({
    queryKey: ['Payment Entry', 'customer', customerName],
    queryFn: () => getListStrict('Payment Entry', [
      ['party', '=', customerName],
      ['payment_type', '=', 'Receive'],
    ], [
      'name', 'posting_date', 'paid_amount', 'mode_of_payment', 'reference_no', 'docstatus',
    ], 100),
    enabled: !!customerName,
    ...options,
  });
}

// ── Program Enrollments ─────────────────────────────────────────────────────

export function useProgramEnrollment(student, academicYear, options = {}) {
  return useQuery({
    queryKey: ['Program Enrollment', student, academicYear],
    queryFn: async () => {
      const filters = [['student', '=', student]];
      if (academicYear) filters.push(['academic_year', '=', academicYear]);
      const list = await getListStrict('Program Enrollment', filters, [
        'name', 'student', 'program', 'academic_year', 'enrollment_date', 'docstatus',
      ], 10);
      // Prefer submitted enrollments (docstatus=1) over drafts
      const submitted = list.find(e => e.docstatus === 1);
      return submitted || list[0] || null;
    },
    enabled: !!student,
    ...options,
  });
}

export function useStudentEnrollments(student, options = {}) {
  return useQuery({
    queryKey: ['Program Enrollments', student],
    queryFn: () => getListStrict('Program Enrollment', [['student', '=', student]], [
      'name', 'student', 'program', 'academic_year', 'enrollment_date', 'docstatus',
    ], 50),
    enabled: !!student,
    ...options,
  });
}

export function useCreateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      // Create draft
      const doc = await createDoc('Program Enrollment', data);
      // Submit immediately — use run_doc_method so server fetches+submits in one request
      if (doc?.name) {
        await callMethod('run_doc_method', {
          dt: 'Program Enrollment',
          dn: doc.name,
          method: 'submit',
        });
      }
      return doc;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['Program Enrollment'] });
      qc.invalidateQueries({ queryKey: ['Program Enrollments'] });
    },
  });
}

export function useEnrollmentsWithConcession(program, academicYear, options = {}) {
  return useQuery({
    queryKey: ['Program Enrollment', 'with-concession', program, academicYear],
    queryFn: async () => {
      const filters = [['program', '=', program], ['docstatus', '=', 1]];
      if (academicYear) filters.push(['academic_year', '=', academicYear]);
      return getListStrict('Program Enrollment', filters, [
        'name', 'student', 'student_name', 'concession_percent',
      ], 500);
    },
    enabled: !!program,
    ...options,
  });
}

// ── Students (for selectors) ────────────────────────────────────────────────

export function useStudentsForProgram(program, academicYear, options = {}) {
  return useQuery({
    queryKey: ['Students', 'for-program', program, academicYear],
    queryFn: async () => {
      const filters = [['program', '=', program]];
      if (academicYear) filters.push(['academic_year', '=', academicYear]);
      const groups = await getListStrict('Student Group', filters, ['name'], 50);
      const allStudents = [];
      await Promise.all(groups.map(async (g) => {
        try {
          const doc = await getDocStrict('Student Group', g.name);
          (doc.students || []).filter(s => s.active).forEach(s => {
            if (!allStudents.find(x => x.student === s.student))
              allStudents.push({ student: s.student, student_name: s.student_name });
          });
        } catch (e) { /* skip */ }
      }));
      return allStudents.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));
    },
    enabled: !!program,
    ...options,
  });
}

export function useFeeStructureFor(program, academicYear, options = {}) {
  return useQuery({
    queryKey: ['Fee Structure', 'for', program, academicYear],
    queryFn: async () => {
      const filters = [['program', '=', program], ['docstatus', '=', 1]];
      if (academicYear) filters.push(['academic_year', '=', academicYear]);
      const list = await getListStrict('Fee Structure', filters, [
        'name', 'program', 'academic_year', 'total_amount',
      ], 5);
      return list[0] || null;
    },
    enabled: !!program,
    ...options,
  });
}

export function useAllStudents(options = {}) {
  return useQuery({
    queryKey: ['Student', 'all'],
    queryFn: () => getListStrict('Student', [['enabled', '=', 1]], [
      'name', 'student_name', 'customer',
    ], 500),
    ...options,
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getFeeStatus(fee) {
  const out = fee.effective_outstanding ?? fee.outstanding_amount ?? 0;
  const total = fee.grand_total || 0;
  if (out === 0 && total > 0) return 'Paid';
  if (fee.due_date && new Date(fee.due_date) < new Date() && out > 0) return 'Overdue';
  if (out < total && out > 0) return 'Partial';
  return 'Unpaid';
}

export const FEE_STATUS_STYLES = {
  Paid:    { pill: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', row: '' },
  Unpaid:  { pill: 'bg-red-100 text-red-700 border-red-200',             dot: 'bg-red-400',     row: '' },
  Overdue: { pill: 'bg-orange-100 text-orange-700 border-orange-200',    dot: 'bg-orange-400',  row: 'bg-orange-50/40' },
  Partial: { pill: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-400',   row: '' },
};

export const INR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function calcLateFee(feeStructure, outstandingAmount) {
  if (!feeStructure?.enable_late_fee) return 0;
  if (feeStructure.late_fee_type === 'Fixed Amount') {
    return feeStructure.late_fee_amount || 0;
  }
  if (feeStructure.late_fee_type === 'Percentage of Outstanding') {
    return Math.round(outstandingAmount * (feeStructure.late_fee_percent || 0) / 100);
  }
  return 0;
}

export function isLateFeeApplicable(fee, feeStructure) {
  if (!feeStructure?.enable_late_fee) return false;
  if (!fee.due_date) return false;
  if ((fee.effective_outstanding ?? fee.outstanding_amount ?? 0) <= 0) return false;
  const graceDays = feeStructure.late_fee_grace_period_days || 0;
  const dueWithGrace = new Date(fee.due_date);
  dueWithGrace.setDate(dueWithGrace.getDate() + graceDays);
  return new Date() > dueWithGrace;
}

export function hasLateFeeApplied(fee, feeStructure) {
  if (!feeStructure?.late_fee_category) return false;
  return (fee.components || []).some(c => c.fees_category === feeStructure.late_fee_category);
}

export function calcConcessionAmount(type, value, invoiceTotal) {
  if (!value || value <= 0) return 0;
  if (type === 'Percentage') return Math.round(invoiceTotal * value / 100);
  return value;
}

// ── Fee Concession Requests ─────────────────────────────────────────────────

export function useConcessionRequests(filters = [], options = {}) {
  return useQuery({
    queryKey: ['Fee Concession Request', 'list', { filters }],
    queryFn: () => getListStrict('Fee Concession Request', filters, [
      'name', 'student', 'student_name', 'fees', 'concession_type',
      'concession_value', 'concession_amount', 'reason_category', 'reason',
      'requested_by', 'approved_by', 'approval_date', 'status', 'rejection_reason',
      'creation', 'docstatus',
    ], 200),
    ...options,
  });
}

export function useCreateConcessionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => createDoc('Fee Concession Request', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Concession Request'] }),
  });
}

export function useUpdateConcessionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }) => updateDoc('Fee Concession Request', name, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Concession Request'] }),
  });
}

// ── Fee Ledger ─────────────────────────────────────────────────────────────

export function useStudentLedger(studentId, options = {}) {
  return useQuery({
    queryKey: ['Fees', 'ledger', studentId],
    queryFn: async () => {
      const res = await client.get(`/fees/ledger/${studentId}`, {
        params: { limit: 100, offset: 0 },
      });
      return res.data;
    },
    enabled: !!studentId,
    ...options,
  });
}

export function useLedgerSummary(studentId, options = {}) {
  return useQuery({
    queryKey: ['Fees', 'ledger-summary', studentId],
    queryFn: async () => {
      const res = await client.get(`/fees/ledger/${studentId}/summary`);
      return res.data;
    },
    enabled: !!studentId,
    ...options,
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      // data: { student_id, academic_year_id, amount, mode, reference_no, notes }
      const res = await client.post('/fees/receipts', data);
      return res.data; // FeeReceiptResponse — includes receipt_number
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['Fees'] });
      qc.invalidateQueries({ queryKey: ['Fees', 'ledger', vars.student_id] });
      qc.invalidateQueries({ queryKey: ['Fees', 'ledger-summary', vars.student_id] });
      qc.invalidateQueries({ queryKey: ['Fees', 'receipts', vars.student_id] });
      qc.invalidateQueries({ queryKey: ['Fees', 'class-summary'] });
      qc.invalidateQueries({ queryKey: ['Fees', 'defaulters'] });
      qc.invalidateQueries({ queryKey: ['Fees', 'collections'] });
    },
  });
}

export function useReceipts(studentId, academicYearId, options = {}) {
  return useQuery({
    queryKey: ['Fees', 'receipts', studentId, academicYearId],
    queryFn: async () => {
      const params = {};
      if (studentId) params.student_id = studentId;
      if (academicYearId) params.academic_year_id = academicYearId;
      const res = await client.get('/fees/receipts', { params });
      return res.data;
    },
    enabled: !!studentId,
    ...options,
  });
}

// Payment modes for the Record Payment form's dropdown.
export function usePaymentModes(options = {}) {
  return useQuery({
    queryKey: ['Fees', 'payment-modes'],
    queryFn: async () => {
      const res = await client.get('/fees/payment-modes');
      return res.data;
    },
    staleTime: Infinity,
    ...options,
  });
}

export function useCreateJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await client.post('/fees/journal-entries', data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['Fees', 'ledger'] });
    },
  });
}

export function useJournalEntries(studentId, filters = {}, options = {}) {
  return useQuery({
    queryKey: ['Fees', 'journal-entries', studentId, filters],
    queryFn: async () => {
      const params = {};
      if (studentId) params.student_id = studentId;
      if (filters.status) params.status = filters.status;
      const res = await client.get('/fees/journal-entries', { params });
      return res.data;
    },
    ...options,
  });
}

export function useApproveJournalEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ entryId, status }) => {
      const res = await client.post(`/fees/journal-entries/${entryId}/approve`, { status });
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['Fees', 'ledger'] });
      qc.invalidateQueries({ queryKey: ['Fees', 'journal-entries'] });
    },
  });
}

export function useDefaulterReport(filters = {}, options = {}) {
  return useQuery({
    queryKey: ['Fees', 'defaulters', filters],
    queryFn: async () => {
      const res = await client.get('/fees/reports/defaulters', { params: filters });
      return res.data;
    },
    ...options,
  });
}

export function useCollectionReport(filters = {}, options = {}) {
  return useQuery({
    queryKey: ['Fees', 'collections', filters],
    queryFn: async () => {
      const res = await client.get('/fees/reports/collections', { params: filters });
      return res.data;
    },
    ...options,
  });
}
// ── Class/Section Dashboard ─────────────────────────────────────────────────
// Add this block to hooks/useFees.js (e.g. right after useCollectionReport).

// Class-wise, section-wise student counts + fee totals.
// Backed by GET /fees/reports/class-summary (admin/principal/accountant only).
export function useClassSummary(academicYearId, options = {}) {
  return useQuery({
    queryKey: ['Fees', 'class-summary', academicYearId],
    queryFn: async () => {
      const res = await client.get('/fees/reports/class-summary', {
        params: academicYearId ? { academic_year_id: academicYearId } : {},
      });
      return res.data;
    },
    ...options,
  });
}

// Search students by name. Backed by GET /academic/students?search=...
// Returns StudentProfile rows (the id here is the correct id for fees/invoices —
// NOT the auth User id, see note in FeesDashboard.jsx).
export function useStudentSearch(searchTerm, options = {}) {
  return useQuery({
    queryKey: ['Students', 'search', searchTerm],
    queryFn: async () => {
      const res = await client.get('/academic/students', {
        params: { search: searchTerm, page: 1, per_page: 20 },
      });
      return res.data?.data || [];
    },
    enabled: !!searchTerm && searchTerm.trim().length > 0,
    ...options,
  });
}

// Per-student fee summary (total_due, total_paid, balance).
// Backed by GET /fees/ledger/{student_id}/summary — same endpoint useLedgerSummary
// already uses, exposed here under a name that reads naturally in the dashboard.
export function useStudentFeeSummary(studentId, options = {}) {
  return useQuery({
    queryKey: ['Fees', 'ledger-summary', studentId],
    queryFn: async () => {
      const res = await client.get(`/fees/ledger/${studentId}/summary`);
      return res.data;
    },
    enabled: !!studentId,
    ...options,
  });
}
export function useStudentsBySection(sectionId, options = {}) {
  return useQuery({
    queryKey: ['Students', 'by-section', sectionId],
    queryFn: async () => {
      const res = await client.get('/academic/students', {
        params: { section_id: sectionId, page: 1, per_page: 200 },
      });
      return res.data?.data || [];
    },
    enabled: !!sectionId,
    ...options,
  });
}
 
// Fee structures, optionally filtered by academic year / class.
// Backed by GET /fees/structures (now returns class_name, fee_head_name,
// is_new_student, installment_count — see service.py/schemas.py patches).
export function useFeeStructuresDetailed(filters = {}, options = {}) {
  return useQuery({
    queryKey: ['Fee Structures', 'detailed', filters],
    queryFn: async () => {
      const params = {};
      if (filters.academicYearId) params.academic_year_id = filters.academicYearId;
      if (filters.classId) params.class_id = filters.classId;
      const res = await client.get('/fees/structures', { params });
      return res.data;
    },
    ...options,
  });
}
 
// Fee heads (Tuition, Transport, etc.) — for the structure create/edit form's dropdown.
export function useFeeHeadsList(options = {}) {
  return useQuery({
    queryKey: ['Fee Heads', 'list'],
    queryFn: async () => {
      const res = await client.get('/fees/heads');
      return res.data;
    },
    ...options,
  });
}
 
export function useCreateFeeStructureDetailed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await client.post('/fees/structures', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Structures'] }),
  });
}
 
export function useUpdateFeeStructureDetailed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await client.patch(`/fees/structures/${id}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Structures'] }),
  });
}
 
export function useDeleteFeeStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await client.delete(`/fees/structures/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Structures'] }),
  });
}
 
export function useCreateFeeInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data) => {
      const res = await client.post('/fees/installments', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Structures'] }),
  });
}
 
// Installments for one structure — needed when opening the edit modal, since
// GET /fees/structures only returns installment_count, not the rows themselves.
// NOTE: this assumes a GET /fees/structures/{id}/installments endpoint — see
// router_patch.md, it needs to be added alongside the update/delete endpoints.
export function useStructureInstallments(structureId, options = {}) {
  return useQuery({
    queryKey: ['Fee Structures', 'installments', structureId],
    queryFn: async () => {
      const res = await client.get(`/fees/structures/${structureId}/installments`);
      return res.data;
    },
    enabled: !!structureId,
    ...options,
  });
}
 
export function useUpdateFeeInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await client.patch(`/fees/installments/${id}`, data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Structures'] }),
  });
}
 
export function useDeleteFeeInstallment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await client.delete(`/fees/installments/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['Fee Structures'] }),
  });
}