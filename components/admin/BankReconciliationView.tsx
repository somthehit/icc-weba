'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Wallet,
  Building2,
  RefreshCw,
  Search,
  Filter,
  Upload,
  Download,
  Calendar,
  DollarSign,
  FileText,
  Lock,
  Unlock,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Copy,
  Plus,
  Trash2,
  ShieldCheck,
  Sliders,
  Sparkles,
  Clock,
  ExternalLink,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  QrCode,
  CreditCard,
  Layers,
  FileCheck,
  Scale,
  Receipt,
  Landmark,
  Edit2,
  Settings2,
  ArrowRightLeft,
  FileSpreadsheet,
} from 'lucide-react';
import { formatNpr, sanitizeNumericAmount } from '@/lib/nepal/money';
import { adToBs } from '@/lib/nepal/date';

interface BankReconciliationViewProps {
  bankData: any;
  useBsDate: boolean;
  onRefresh: () => Promise<void>;
  showToast: (type: 'success' | 'error', message: string) => void;
}

type ReconTab = 'feed' | 'suggested' | 'unreconciled' | 'reconciled' | 'imports' | 'statements' | 'cheques' | 'anomalies';

export const BankReconciliationView: React.FC<BankReconciliationViewProps> = ({
  bankData,
  useBsDate,
  onRefresh,
  showToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ReconTab>('feed');
  const [selectedAccountId, setSelectedAccountId] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNRECONCILED' | 'MATCHED'>('ALL');
  const [isSyncing, setIsSyncing] = useState(false);

  // Tabs scroll navigation
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -200 : 200,
        behavior: 'smooth',
      });
    }
  };

  // Reconcile Drawer State
  const [activeReconcileLine, setActiveReconcileLine] = useState<any | null>(null);
  const [selectedLedgerEntryId, setSelectedLedgerEntryId] = useState<number | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  // Adjustment Modal State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'bank_charge' | 'interest_income' | 'rounding'>('bank_charge');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');

  // Import Statement Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importAccountId, setImportAccountId] = useState<number>(bankData?.bankAccounts?.[0]?.id || 1);
  const [importFilename, setImportFilename] = useState('');
  const [importRawCsv, setImportRawCsv] = useState('');
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Period Close Modal State (Maker-Checker with PIN)
  const [isPeriodCloseModalOpen, setIsPeriodCloseModalOpen] = useState(false);
  const [closeAccountId, setCloseAccountId] = useState<number>(bankData?.bankAccounts?.[0]?.id || 1);
  const [closeMonth, setCloseMonth] = useState<number>(6); // Ashwin
  const [closeYear, setCloseYear] = useState<number>(2082);
  const [supervisorPin, setSupervisorPin] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosingPeriod, setIsClosingPeriod] = useState(false);

  // Rule Creation State
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [rulePattern, setRulePattern] = useState('');

  // Add Bank / Digital Wallet Modal State
  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [newBankType, setNewBankType] = useState<string>('bank');
  const [newBankName, setNewBankName] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newBranch, setNewBranch] = useState('');
  const [newOpeningBalance, setNewOpeningBalance] = useState('0');
  const [coaLinkMode, setCoaLinkMode] = useState<'existing' | 'new'>('existing');
  const [selectedCoaId, setSelectedCoaId] = useState<number | ''>('');
  const [newCoaCode, setNewCoaCode] = useState('');
  const [newCoaName, setNewCoaName] = useState('');
  const [isSubmittingBank, setIsSubmittingBank] = useState(false);

  // Edit / Link COA Modal State
  const [isEditCoaModalOpen, setIsEditCoaModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [editCoaId, setEditCoaId] = useState<number | ''>('');
  const [editCoaMode, setEditCoaMode] = useState<'existing' | 'new'>('existing');
  const [editNewCoaCode, setEditNewCoaCode] = useState('');
  const [editNewCoaName, setEditNewCoaName] = useState('');
  const [isUpdatingCoa, setIsUpdatingCoa] = useState(false);

  // ---------------------------------------------------------------------------
  // COMPUTED DATA & FILTERS
  // ---------------------------------------------------------------------------
  const accounts = bankData?.bankAccounts || [];
  const chartOfAccounts = bankData?.chartOfAccounts || [];
  const rawStatements = bankData?.statements || [];
  const candidateLedgerEntries = bankData?.candidateLedgerEntries || [];
  const recentImports = bankData?.recentImports || [];
  const chequesList = bankData?.cheques || [];
  const periodReconciliations = bankData?.periodReconciliations || [];
  const anomalies = bankData?.anomalies || [];
  const summary = bankData?.summary || {};

  // Suggest next numerical code under 10xx (Cash & Bank Equivalents in Asset group)
  const suggestedNextCoaCode = useMemo(() => {
    let max = 1044;
    for (const c of chartOfAccounts) {
      const num = parseInt(c.code, 10);
      if (!isNaN(num) && num >= 1000 && num < 1100 && num > max) {
        max = num;
      }
    }
    return String(max + 1);
  }, [chartOfAccounts]);

  const filteredStatements = useMemo(() => {
    return rawStatements.filter((s: any) => {
      // Account filter
      if (selectedAccountId !== 'ALL' && s.bankAccountId !== selectedAccountId) {
        return false;
      }
      // Status filter
      if (statusFilter === 'UNRECONCILED' && s.isReconciled) return false;
      if (statusFilter === 'MATCHED' && !s.isReconciled) return false;
      // Search query (reference, description, amount)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const refMatch = String(s.referenceNo || '').toLowerCase().includes(q);
        const descMatch = String(s.description || '').toLowerCase().includes(q);
        const amtMatch = String(s.depositAmount || '').includes(q) || String(s.withdrawalAmount || '').includes(q);
        if (!refMatch && !descMatch && !amtMatch) return false;
      }
      return true;
    });
  }, [rawStatements, selectedAccountId, statusFilter, searchQuery]);

  // Suggested matches (unreconciled with high similarity or rule match)
  const suggestedMatches = useMemo(() => {
    return filteredStatements
      .filter((s: any) => !s.isReconciled)
      .map((stmt: any) => {
        const stmtAmt = parseFloat(stmt.depositAmount) > 0 ? parseFloat(stmt.depositAmount) : parseFloat(stmt.withdrawalAmount);
        // Find best candidate from GL
        let bestCandidate = null;
        let score = 0;
        let reason = '';

        for (const c of candidateLedgerEntries) {
          const cAmt = parseFloat(stmt.depositAmount) > 0 ? parseFloat(c.debit || '0') : parseFloat(c.credit || '0');
          const refClean = String(stmt.referenceNo || '').trim().toLowerCase();
          const cNumClean = String(c.entryNumber || '').toLowerCase();
          const cDescClean = String(c.description || '').toLowerCase();

          if (refClean && (cNumClean.includes(refClean) || cDescClean.includes(refClean))) {
            bestCandidate = c;
            score = 100;
            reason = `Exact Reference #${stmt.referenceNo} matched in GL voucher ${c.entryNumber}`;
            break;
          }

          if (Math.abs(stmtAmt - cAmt) < 0.01) {
            bestCandidate = c;
            score = 95;
            reason = `Exact amount NPR ${stmtAmt.toFixed(2)} matching voucher ${c.entryNumber}`;
            break;
          }

          // Net fee tolerance check (e.g. 1.5% gateway charge)
          if (Math.abs(stmtAmt - cAmt * 0.985) <= cAmt * 0.02) {
            bestCandidate = c;
            score = 85;
            reason = `Gateway net payout tolerance (~1.5% fee) on ${c.entryNumber}`;
          }
        }

        return {
          statement: stmt,
          candidate: bestCandidate,
          score: bestCandidate ? score : 45,
          reason: bestCandidate ? reason : 'Awaiting manual match or adjustment entry',
        };
      });
  }, [filteredStatements, candidateLedgerEntries]);

  // Unreconciled Aging groups
  const agingGroups = useMemo(() => {
    const now = new Date().getTime();
    const g1: any[] = []; // 0-3 days
    const g2: any[] = []; // 4-7 days
    const g3: any[] = []; // 8-30 days
    const g4: any[] = []; // 30+ days

    for (const s of rawStatements.filter((x: any) => !x.isReconciled)) {
      const stmtTime = new Date(s.statementDate).getTime();
      const ageDays = Math.max(0, Math.floor((now - stmtTime) / (1000 * 3600 * 24)));
      if (ageDays <= 3) g1.push(s);
      else if (ageDays <= 7) g2.push(s);
      else if (ageDays <= 30) g3.push(s);
      else g4.push(s);
    }

    return { '0-3': g1, '4-7': g2, '8-30': g3, '30+': g4 };
  }, [rawStatements]);

  // ---------------------------------------------------------------------------
  // ACTIONS & HANDLERS
  // ---------------------------------------------------------------------------
  const handleSyncGl = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_GL' }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'GL balances synchronized successfully.');
        await onRefresh();
      } else {
        showToast('error', data.error || 'Failed to sync GL.');
      }
    } catch (e: any) {
      showToast('error', e.message || 'Network error syncing GL.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRunAutoMatch = async () => {
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'AUTO_MATCH',
          bankAccountId: selectedAccountId !== 'ALL' ? selectedAccountId : undefined,
          autoCommitThreshold: 90,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        await onRefresh();
      } else {
        showToast('error', data.error || 'Auto-match failed.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleReconcileSelected = async () => {
    if (!activeReconcileLine) return;
    setIsReconciling(true);
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RECONCILE_LINE',
          statementId: activeReconcileLine.id,
          matchedJournalId: selectedLedgerEntryId || undefined,
          matchType: selectedLedgerEntryId ? 'manual' : 'direct',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Line reconciled successfully.');
        setActiveReconcileLine(null);
        setSelectedLedgerEntryId(null);
        await onRefresh();
      } else {
        showToast('error', data.error || 'Reconciliation failed.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleUnreconcileLine = async (statementId: number) => {
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UNRECONCILE_LINE',
          statementId,
          reason: 'Manual unreconciliation by accountant',
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Line un-matched successfully.');
        await onRefresh();
      } else {
        showToast('error', data.error || 'Failed to un-match line.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReconcileLine) return;
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_ADJUSTMENT',
          statementId: activeReconcileLine.id,
          adjustmentType,
          notes: adjustmentNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        setIsAdjustmentModalOpen(false);
        setActiveReconcileLine(null);
        setAdjustmentNotes('');
        await onRefresh();
      } else {
        showToast('error', data.error || 'Adjustment posting failed.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleDryRunImport = async () => {
    setIsDryRunning(true);
    try {
      const parsedRows = parseCsvText(importRawCsv);
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'IMPORT_STATEMENT',
          bankAccountId: importAccountId,
          filename: importFilename || 'Uploaded_Statement.csv',
          rawCsvContent: importRawCsv,
          rows: parsedRows,
          dryRun: true,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDryRunResult(data);
      } else {
        showToast('error', data.error || 'Dry run validation failed.');
      }
    } catch (e: any) {
      showToast('error', e.message || 'CSV parse error');
    } finally {
      setIsDryRunning(false);
    }
  };

  const handleCommitImport = async () => {
    setIsImporting(true);
    try {
      const parsedRows = parseCsvText(importRawCsv);
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'IMPORT_STATEMENT',
          bankAccountId: importAccountId,
          filename: importFilename || 'Statement_Import.csv',
          rawCsvContent: importRawCsv,
          rows: parsedRows,
          dryRun: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        setIsImportModalOpen(false);
        setImportRawCsv('');
        setImportFilename('');
        setDryRunResult(null);
        await onRefresh();
      } else {
        showToast('error', data.error || 'Import failed.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handlePeriodClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorPin) {
      showToast('error', 'Supervisor PIN is required to close and lock the period.');
      return;
    }
    setIsClosingPeriod(true);
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLOSE_PERIOD',
          bankAccountId: closeAccountId,
          periodYear: closeYear,
          periodMonth: closeMonth,
          supervisorPin,
          notes: closeNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        setIsPeriodCloseModalOpen(false);
        setSupervisorPin('');
        setCloseNotes('');
        await onRefresh();
      } else {
        showToast('error', data.error || 'Failed to close period.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    } finally {
      setIsClosingPeriod(false);
    }
  };

  const handleUnlockPeriod = async (periodId: number) => {
    const pin = prompt('Enter Chief Accountant / Manager PIN (e.g. 1234 or 9999) to unlock period:');
    if (!pin) return;
    const reason = prompt('State business reason for unlocking closed period:') || 'Adjustment correction';

    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UNRECONCILE_PERIOD',
          periodId,
          supervisorPin: pin,
          reason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        await onRefresh();
      } else {
        showToast('error', data.error || 'Failed to unlock period.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  const handleChequeAction = async (chequeId: number, status: string) => {
    let bounceReason = undefined;
    if (status === 'bounced') {
      bounceReason = prompt('Enter Cheque Bounce Reason (e.g., Insufficient Funds, Signature Mismatch):') || 'Insufficient Funds';
    }
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_CHEQUE',
          chequeId,
          status,
          bounceReason,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message);
        await onRefresh();
      } else {
        showToast('error', data.error || 'Failed to update cheque.');
      }
    } catch (e: any) {
      showToast('error', e.message);
    }
  };

  // Popular Nepal Commercial Banks & Digital Wallets Presets
  const bankPresets = [
    { name: 'Global IME Bank Ltd', type: 'bank', accountName: 'Global IME Corporate Operating A/C', coaName: 'Bank - Global IME Corporate' },
    { name: 'Nabil Bank Ltd', type: 'bank', accountName: 'Nabil Bank Operating A/C', coaName: 'Bank - Nabil Primary' },
    { name: 'Nepal Investment Mega Bank', type: 'bank', accountName: 'NIMB Corporate A/C', coaName: 'NIMB Bank Operating A/C' },
    { name: 'NIC Asia Bank Ltd', type: 'bank', accountName: 'NIC Asia Operating A/C', coaName: 'Bank - NIC Asia' },
    { name: 'Rastriya Banijya Bank', type: 'bank', accountName: 'RBB Corporate A/C', coaName: 'Bank - Rastriya Banijya' },
    { name: 'Sanima Bank Ltd', type: 'bank', accountName: 'Sanima Bank Current A/C', coaName: 'Bank - Sanima' },
    { name: 'eSewa Fonepay Pvt Ltd', type: 'esewa', accountName: 'eSewa Merchant Wallet', coaName: 'Digital Wallet - eSewa Merchant' },
    { name: 'Khalti Digital Wallet', type: 'khalti', accountName: 'Khalti Merchant Wallet', coaName: 'Khalti Merchant Wallet' },
    { name: 'Fonepay Payment Service', type: 'fonepay', accountName: 'Fonepay QR Dynamic Clearing', coaName: 'Fonepay QR Clearing' },
    { name: 'Nepal Clearing House (NCHL)', type: 'connect_ips', accountName: 'ConnectIPS Clearing Account', coaName: 'Clearing - ConnectIPS Online Gateway' },
    { name: 'Intel Computer Center Safe', type: 'vault', accountName: 'Cash Drawer & Vault Safe', coaName: 'Shop Vault Cash' },
  ];

  const handleSelectBankPreset = (p: typeof bankPresets[0]) => {
    setNewBankType(p.type);
    setNewBankName(p.name);
    setNewAccountName(p.accountName);
    setNewCoaName(p.coaName);
    if (!newCoaCode) setNewCoaCode(suggestedNextCoaCode);

    // If an existing COA account matches the preset, link to it automatically
    const existing = chartOfAccounts.find(
      (c: any) =>
        c.name.toLowerCase().includes(p.name.toLowerCase()) ||
        c.name.toLowerCase().includes(p.coaName.toLowerCase())
    );
    if (existing) {
      setSelectedCoaId(existing.id);
      setCoaLinkMode('existing');
    } else {
      setCoaLinkMode('new');
    }
  };

  const handleCreateBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim() || !newAccountNumber.trim() || !newBankName.trim()) {
      showToast('error', 'Please provide Account Name, Bank/Provider Name, and Account Number.');
      return;
    }

    if (coaLinkMode === 'existing' && !selectedCoaId) {
      showToast('error', 'Please select a Chart of Accounts (COA) ledger account to link.');
      return;
    }

    setIsSubmittingBank(true);
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_BANK_ACCOUNT',
          accountName: newAccountName.trim(),
          bankName: newBankName.trim(),
          provider: newBankName.trim(),
          accountNumber: newAccountNumber.trim(),
          branch: newBranch.trim() || undefined,
          accountType: newBankType,
          openingBalance: newOpeningBalance || '0.00',
          chartAccountId: coaLinkMode === 'existing' ? selectedCoaId : undefined,
          autoCreateCoa: coaLinkMode === 'new',
          coaCode: coaLinkMode === 'new' ? (newCoaCode.trim() || suggestedNextCoaCode) : undefined,
          coaName: coaLinkMode === 'new' ? (newCoaName.trim() || `Bank - ${newAccountName.trim()}`) : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Bank account created and linked to Chart of Accounts.');
        setIsAddBankModalOpen(false);
        // Reset form
        setNewAccountName('');
        setNewAccountNumber('');
        setNewBankName('');
        setNewBranch('');
        setNewOpeningBalance('0');
        setSelectedCoaId('');
        await onRefresh();
      } else {
        showToast('error', data.error || 'Failed to create bank account.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error creating bank account.');
    } finally {
      setIsSubmittingBank(false);
    }
  };

  const openEditCoaModal = (acc: any) => {
    setEditingAccount(acc);
    setEditCoaId(acc.chartAccountId || '');
    setEditCoaMode('existing');
    setEditNewCoaCode(suggestedNextCoaCode);
    setEditNewCoaName(`Bank - ${acc.accountName}`);
    setIsEditCoaModalOpen(true);
  };

  const handleUpdateCoaLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    if (editCoaMode === 'existing' && !editCoaId) {
      showToast('error', 'Please select a Chart of Accounts (COA) ledger account.');
      return;
    }

    setIsUpdatingCoa(true);
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'LINK_COA_ACCOUNT',
          bankAccountId: editingAccount.id,
          chartAccountId: editCoaMode === 'existing' ? editCoaId : undefined,
          autoCreateCoa: editCoaMode === 'new',
          coaCode: editCoaMode === 'new' ? editNewCoaCode.trim() : undefined,
          coaName: editCoaMode === 'new' ? editNewCoaName.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Chart of Accounts linkage updated.');
        setIsEditCoaModalOpen(false);
        setEditingAccount(null);
        await onRefresh();
      } else {
        showToast('error', data.error || 'Failed to update COA linkage.');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error updating COA linkage.');
    } finally {
      setIsUpdatingCoa(false);
    }
  };

  const handleDeleteBankAccount = async (bankId: number, bankName: string) => {
    if (!confirm(`Are you sure you want to remove bank account '${bankName}'?`)) return;
    try {
      const res = await fetch('/api/accounting/bank-reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_BANK_ACCOUNT',
          bankAccountId: bankId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('success', data.message || 'Bank account removed.');
        await onRefresh();
      } else {
        showToast('error', data.error || 'Failed to remove bank account.');
      }
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  // Helper to parse simple CSV text into rows
  function parseCsvText(csv: string): any[] {
    const lines = csv.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/["']/g, ''));
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/["']/g, ''));
      const obj: any = {};
      headers.forEach((h, idx) => {
        obj[h] = cols[idx] || '';
      });
      rows.push(obj);
    }
    return rows;
  }

  // Dual Date Formatter
  const renderDate = (adDateStr: string) => {
    if (!adDateStr) return '—';
    const bs = adToBs(adDateStr);
    const adFormatted = adDateStr.slice(0, 10);

    if (useBsDate) {
      return (
        <span title={`${adFormatted} AD`} className="cursor-help hover:text-white transition-colors">
          {bs.formattedBS} <span className="text-[10px] text-purple-400 font-bold">BS</span>
        </span>
      );
    }

    return (
      <span title={`${bs.formattedBS} BS (${bs.monthName})`} className="cursor-help hover:text-white transition-colors">
        {adFormatted} <span className="text-[10px] text-blue-400 font-bold">AD</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. BANK & DIGITAL WALLET ACCOUNT CARDS (DUAL BALANCES + COA LINK)         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {accounts.map((b: any) => {
          const isSelected = selectedAccountId === b.id;
          const diffPaisa = Math.abs(parseFloat(b.difference || '0'));
          const isBalanced = b.isBalanced ?? (diffPaisa < 0.01);

          return (
            <div
              key={b.id}
              onClick={() => setSelectedAccountId(isSelected ? 'ALL' : b.id)}
              className={`cursor-pointer rounded-2xl p-4 transition-all duration-200 border shadow-lg flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-900 border-blue-500 ring-2 ring-blue-500/20 shadow-blue-900/20'
                  : 'bg-slate-900/90 hover:bg-slate-900 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800/90 text-slate-300 font-semibold border border-slate-700/50">
                    {b.provider || b.accountType}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-mono text-slate-400">
                      {b.maskedAccountNumber || (b.accountNumber ? `...${b.accountNumber.slice(-4)}` : '')}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditCoaModal(b);
                      }}
                      className="text-slate-500 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition-colors"
                      title="Edit Account / Link COA"
                    >
                      <Settings2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="font-bold text-sm text-white mt-1.5 truncate" title={b.accountName}>
                  {b.accountName}
                </div>

                {/* Linked Chart of Accounts (COA) Indicator */}
                <div className="mt-1 flex items-center gap-1 text-[11px]">
                  {b.chartAccountId ? (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditCoaModal(b);
                      }}
                      title="Linked to General Ledger Asset Account. Click to edit."
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 hover:text-white hover:bg-blue-900 border border-blue-800/50 text-[10px] font-mono transition-colors max-w-full truncate cursor-pointer"
                    >
                      <Layers className="w-2.5 h-2.5 text-blue-400 shrink-0" />
                      <span className="truncate">COA: [{b.coaCode || b.chartAccountId}] {b.coaName || 'Asset Ledger'}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditCoaModal(b);
                      }}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 hover:text-amber-200 hover:bg-amber-900 border border-amber-700/50 text-[10px] font-semibold transition-colors"
                    >
                      <AlertTriangle className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      <span>Not linked to COA • Click to link</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                {/* Dual Balances: Statement vs Book */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] uppercase font-mono">Statement (Bank):</span>
                    <span className="font-mono font-bold text-slate-200">
                      {formatNpr(b.statementBalance || b.currentBalance)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-[10px] uppercase font-mono">Book (General Ledger):</span>
                    <span className="font-mono font-bold text-slate-300">
                      {formatNpr(b.bookBalance)}
                    </span>
                  </div>
                </div>

                {/* Variance Indicator */}
                <div className="mt-2 flex items-center justify-between pt-1">
                  {isBalanced ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" /> Balanced
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/30">
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      Diff: {formatNpr(b.difference)}
                    </span>
                  )}

                  {b.unmatchedCount > 0 && (
                    <span className="text-[10px] font-mono text-amber-400 font-semibold bg-amber-950/50 px-1.5 py-0.5 rounded border border-amber-500/20">
                      {b.unmatchedCount} unrec
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 2. RECONCILIATION COMMAND BAR (ACTIONS & SUMMARY METRICS)                  */}
      {/* ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
        {/* Left: Summary Metrics with Defined Match Rate */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800">
            <span className="text-slate-400 uppercase text-[10px]">Match Rate:</span>
            <span className="text-emerald-400 font-bold font-sans">
              {summary.matchCountRate || '0.0'}% count ({summary.matchedCount || 0}/{summary.totalStatements || 0})
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-blue-400 font-bold font-sans">
              {summary.matchAmountRate || '0.0'}% amount
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-slate-300">
            <span className="text-slate-400 text-[10px] uppercase">Unmatched:</span>
            <span className="text-amber-400 font-bold">
              {formatNpr(summary.unmatchedAmount)} ({summary.unmatchedCount || 0} rows)
            </span>
          </div>

          {selectedAccountId !== 'ALL' && (
            <button
              onClick={() => setSelectedAccountId('ALL')}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-sans"
            >
              Clear Account Filter
            </button>
          )}
        </div>

        {/* Right: Primary Reconcile Actions */}
        <div className="flex items-center gap-2">
          {/* Add Bank Account Button */}
          <button
            onClick={() => {
              setNewCoaCode(suggestedNextCoaCode);
              setIsAddBankModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950/40 border border-emerald-400/30 transition-all"
            title="Register a new Bank or Digital Wallet and link with General Ledger"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Bank</span>
          </button>

          {/* Run Auto-Match */}
          <button
            onClick={handleRunAutoMatch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-900/30 transition-all"
            title="Execute Rule 1-4 Auto-Match Engine"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Run Auto-Match</span>
          </button>

          {/* Import Statement */}
          <button
            onClick={() => {
              setImportAccountId(typeof selectedAccountId === 'number' ? selectedAccountId : accounts[0]?.id || 1);
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition-all"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import Statement</span>
          </button>

          {/* Period Close */}
          <button
            onClick={() => {
              setCloseAccountId(typeof selectedAccountId === 'number' ? selectedAccountId : accounts[0]?.id || 1);
              setIsPeriodCloseModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition-all"
          >
            <Lock className="w-3.5 h-3.5 text-purple-400" />
            <span>Close Period (BRS)</span>
          </button>

          {/* Sync GL Button with Visual Spinner */}
          <button
            onClick={handleSyncGl}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 transition-all disabled:opacity-50"
            title="Recalculate Book Balances from Double-Entry Journal Lines"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync GL'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. RECONCILIATION SUB-TABS NAVIGATION                                    */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-2 shadow-xl backdrop-blur-md space-y-2">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Scrollable Sub-Tabs with Previous/Next Controls */}
          <div className="flex items-center min-w-0 flex-1 relative gap-1">
            <button
              type="button"
              onClick={() => scrollTabs('left')}
              aria-label="Scroll tabs left"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div
              ref={tabsContainerRef}
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scrollbar-none py-0.5 px-0.5 min-w-0 flex-1 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {[
                { id: 'feed', label: 'Statement Feed', count: filteredStatements.length, icon: FileSpreadsheet },
                { id: 'suggested', label: 'Suggested Matches', count: suggestedMatches.length, icon: Sparkles },
                { id: 'unreconciled', label: 'Unreconciled Aging', count: summary.unmatchedCount || 0, icon: Clock },
                { id: 'reconciled', label: 'Reconciled History', count: summary.matchedCount || 0, icon: CheckCircle2 },
                { id: 'statements', label: 'BRS Statements & Closes', count: periodReconciliations.length, icon: FileCheck },
                { id: 'cheques', label: 'Cheque Lifecycle', count: chequesList.length, icon: CreditCard },
                { id: 'imports', label: 'Import Batches', count: recentImports.length, icon: Download },
                { id: 'anomalies', label: 'Anomaly Alerts', count: anomalies.length, alert: anomalies.length > 0, icon: AlertTriangle },
              ].map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id as ReconTab)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25 ring-1 ring-blue-400/40'
                        : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-slate-800/60'
                    }`}
                  >
                    <TabIcon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                    {typeof tab.count === 'number' && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono leading-none ${
                          tab.alert
                            ? 'bg-rose-500 text-white font-bold animate-pulse'
                            : isActive
                            ? 'bg-blue-900/90 text-blue-100 border border-blue-400/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollTabs('right')}
              aria-label="Scroll tabs right"
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors flex-shrink-0"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Global Search & Filters Toolbar */}
          <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-auto w-full lg:w-auto pt-1 lg:pt-0 border-t lg:border-t-0 border-slate-800/60">
            <div className="relative flex-1 lg:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search reference, desc, amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer transition-colors"
            >
              <option value="ALL">All Statuses</option>
              <option value="UNRECONCILED">Unreconciled Only</option>
              <option value="MATCHED">Matched Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. SUB-TAB CONTENT: FEED                                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'feed' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Bank Statement Auto-Match Feed</h3>
              <span className="text-xs text-slate-400 font-mono">
                Showing {filteredStatements.length} transactions
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Dates displayed in {useBsDate ? 'Bikram Sambat (BS)' : 'Gregorian (AD)'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Reference #</th>
                  <th className="p-3">Date ({useBsDate ? 'BS' : 'AD'})</th>
                  <th className="p-3">Account</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Deposit / Withdrawal</th>
                  <th className="p-3">Running Balance</th>
                  <th className="p-3">Status / Match Details</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredStatements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                      No statement transactions found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStatements.map((s: any) => {
                    const isMatched = s.isReconciled;
                    const hasDeposit = parseFloat(s.depositAmount || '0') > 0;

                    return (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                        {/* Reference # */}
                        <td className="p-3 font-bold text-white whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{s.referenceNo}</span>
                            {s.referenceNo !== '—' && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(s.referenceNo);
                                  showToast('success', `Copied ${s.referenceNo}`);
                                }}
                                className="text-slate-500 hover:text-slate-300"
                                title="Copy reference"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Date (BS / AD with dual tooltip) */}
                        <td className="p-3 whitespace-nowrap">
                          {renderDate(s.statementDate)}
                        </td>

                        {/* Account Name */}
                        <td className="p-3 text-slate-300 font-sans whitespace-nowrap">
                          <span className="text-[11px] text-slate-300 font-semibold">
                            {s.accountName || `Account #${s.bankAccountId}`}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="p-3 font-sans max-w-xs truncate" title={s.description}>
                          {s.description}
                        </td>

                        {/* Deposit / Withdrawal (Safe Numeric - NO NaN) */}
                        <td className="p-3 whitespace-nowrap">
                          {hasDeposit ? (
                            <span className="text-emerald-400 font-bold">
                              + {formatNpr(s.depositAmount)}
                            </span>
                          ) : (
                            <span className="text-rose-400 font-bold">
                              - {formatNpr(s.withdrawalAmount)}
                            </span>
                          )}
                        </td>

                        {/* Running Balance */}
                        <td className="p-3 text-slate-200 whitespace-nowrap font-bold">
                          {formatNpr(s.runningBalance)}
                        </td>

                        {/* Status & Linked Voucher */}
                        <td className="p-3 font-sans">
                          {isMatched ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> MATCHED
                              </span>
                              {s.matchedJournalNumber && (
                                <div className="text-[10px] text-blue-400 font-mono font-semibold">
                                  Voucher: #{s.matchedJournalNumber}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-500/30">
                              <Clock className="w-3 h-3 text-amber-400" /> UNRECONCILED
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-3 text-right whitespace-nowrap">
                          {!isMatched ? (
                            <button
                              onClick={() => {
                                setActiveReconcileLine(s);
                                setSelectedLedgerEntryId(null);
                              }}
                              className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-900/20 transition-all"
                            >
                              Reconcile
                            </button>
                          ) : (
                            <button
                              onClick={() => handleUnreconcileLine(s.id)}
                              className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-300 font-medium text-xs transition-colors"
                              title="Un-match this statement row"
                            >
                              Unmatch
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. SUB-TAB CONTENT: SUGGESTED MATCHES                                    */}
      {/* ========================================================================= */}
      {activeSubTab === 'suggested' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 p-4 rounded-2xl border border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Suggested Matches Queue</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Calculated candidate matches based on exact reference, amount proximity, and fee tolerances.
              </p>
            </div>
            <button
              onClick={handleRunAutoMatch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Approve All High-Confidence</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {suggestedMatches.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
                All statement items are reconciled! No candidates pending in suggested queue.
              </div>
            ) : (
              suggestedMatches.map(({ statement: s, candidate: c, score, reason }: any) => (
                <div
                  key={s.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  {/* Left: Statement Line */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                        Statement #{s.id}
                      </span>
                      <span className="text-xs font-bold text-white">{s.description}</span>
                    </div>
                    <div className="text-xs font-mono text-slate-400 flex items-center gap-3">
                      <span>Date: {renderDate(s.statementDate)}</span>
                      <span>Ref: {s.referenceNo}</span>
                      <span className="font-bold text-emerald-400">
                        {parseFloat(s.depositAmount) > 0
                          ? `+ ${formatNpr(s.depositAmount)}`
                          : `- ${formatNpr(s.withdrawalAmount)}`}
                      </span>
                    </div>
                  </div>

                  {/* Middle: Candidate Match Reasoning & Score */}
                  <div className="flex-1 px-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">
                        {c ? `GL Match: #${c.entryNumber}` : 'No Direct GL Candidate'}
                      </span>
                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                          score >= 90
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-950 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {score}% Confidence
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans">{reason}</p>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    {c && (
                      <button
                        onClick={async () => {
                          const res = await fetch('/api/accounting/bank-reconciliation', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'RECONCILE_LINE',
                              statementId: s.id,
                              matchedJournalId: c.journalEntryId,
                              matchType: 'suggested_approval',
                            }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            showToast('success', 'Match approved!');
                            await onRefresh();
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow"
                      >
                        Approve Match
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setActiveReconcileLine(s);
                        setSelectedLedgerEntryId(c ? c.journalEntryId : null);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                    >
                      Inspect / Edit
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. SUB-TAB CONTENT: UNRECONCILED AGING                                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'unreconciled' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { label: '0-3 Days (Current)', items: agingGroups['0-3'], color: 'text-emerald-400', border: 'border-emerald-500/30' },
              { label: '4-7 Days (Follow-up)', items: agingGroups['4-7'], color: 'text-blue-400', border: 'border-blue-500/30' },
              { label: '8-30 Days (Overdue)', items: agingGroups['8-30'], color: 'text-amber-400', border: 'border-amber-500/30' },
              { label: '30+ Days (Critical)', items: agingGroups['30+'], color: 'text-rose-400', border: 'border-rose-500/30' },
            ].map((col) => {
              const totalAmt = col.items.reduce((acc, x) => acc + (parseFloat(x.depositAmount) || parseFloat(x.withdrawalAmount) || 0), 0);
              return (
                <div key={col.label} className={`bg-slate-900 border ${col.border} rounded-2xl p-4 shadow-lg`}>
                  <div className="text-[11px] font-mono uppercase text-slate-400">{col.label}</div>
                  <div className={`text-lg font-bold font-mono mt-1 ${col.color}`}>
                    {formatNpr(totalAmt)}
                  </div>
                  <div className="text-xs text-slate-400 font-sans mt-0.5">
                    {col.items.length} unreconciled transactions
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h4 className="text-sm font-bold text-white mb-3">Unreconciled Items Drill-Down</h4>
            <div className="space-y-2">
              {filteredStatements
                .filter((s: any) => !s.isReconciled)
                .map((s: any) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <span className="font-bold text-white">{s.referenceNo}</span>
                      <span className="text-slate-400 ml-3 font-sans">{s.description}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-slate-400">{renderDate(s.statementDate)}</span>
                      <span className="font-bold text-emerald-400">
                        {parseFloat(s.depositAmount) > 0 ? `+ ${formatNpr(s.depositAmount)}` : `- ${formatNpr(s.withdrawalAmount)}`}
                      </span>
                      <button
                        onClick={() => setActiveReconcileLine(s)}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold"
                      >
                        Reconcile
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. SUB-TAB CONTENT: BRS STATEMENTS & PERIOD CLOSE                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'statements' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Bank Reconciliation Statements (BRS)</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Maker-checker monthly statutory sign-offs with cryptographic hash lock.
              </p>
            </div>
            <button
              onClick={() => setIsPeriodCloseModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Prepare & Close Period</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {periodReconciliations.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
                No formal monthly period closes recorded yet. Click &ldquo;Prepare &amp; Close Period&rdquo; to lock a reconciliation period.
              </div>
            ) : (
              periodReconciliations.map((p: any) => (
                <div
                  key={p.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-950 text-purple-300 font-mono text-xs font-bold border border-purple-500/30">
                        {p.periodMonthName} {p.periodYear} ({p.fiscalYear || '2082/83'})
                      </span>
                      <span className="text-sm font-bold text-white">{p.accountName}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          p.status === 'approved_closed'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {p.status === 'approved_closed' ? 'LOCKED & CLOSED' : 'PREPARED'}
                      </span>

                      {p.status === 'approved_closed' && (
                        <button
                          onClick={() => handleUnlockPeriod(p.id)}
                          className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline"
                        >
                          Unlock with PIN
                        </button>
                      )}
                    </div>
                  </div>

                  {/* BRS 4-Pillar Mathematical Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] uppercase text-slate-400">Book Ending Balance:</div>
                      <div className="font-bold text-white mt-1">{formatNpr(p.bookEndingBalance)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] uppercase text-slate-400">Deposits In Transit:</div>
                      <div className="font-bold text-emerald-400 mt-1">+ {formatNpr(p.depositsInTransit)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] uppercase text-slate-400">Outstanding Cheques:</div>
                      <div className="font-bold text-rose-400 mt-1">- {formatNpr(p.outstandingCheques)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                      <div className="text-[10px] uppercase text-slate-400">Statement Ending:</div>
                      <div className="font-bold text-blue-400 mt-1">{formatNpr(p.statementEndingBalance)}</div>
                    </div>
                  </div>

                  {/* Sign-off Block */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-4">
                      <span>Prepared by: <strong className="text-slate-200">{p.preparedByName || 'Accountant'}</strong></span>
                      <span>Approved by: <strong className="text-slate-200">{p.approvedByName || 'Manager'}</strong></span>
                    </div>
                    {p.notes && <span className="italic text-slate-400">{p.notes}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. SUB-TAB CONTENT: CHEQUE LIFECYCLE                                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'cheques' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Cheque Lifecycle Management (Inward &amp; Outward)</h3>
            <span className="text-xs text-slate-400 font-mono">{chequesList.length} tracked cheques</span>
          </div>

          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="p-3">Cheque #</th>
                <th className="p-3">Type</th>
                <th className="p-3">Payee / Drawer</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Issue Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Update Lifecycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {chequesList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                    No cheques in transit.
                  </td>
                </tr>
              ) : (
                chequesList.map((ch: any) => (
                  <tr key={ch.id} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white">{ch.chequeNumber}</td>
                    <td className="p-3 uppercase text-[10px] text-slate-400">{ch.chequeType}</td>
                    <td className="p-3 font-sans">{ch.payeeOrDrawer}</td>
                    <td className="p-3 font-bold text-slate-200">{formatNpr(ch.amount)}</td>
                    <td className="p-3">{renderDate(ch.issueDate)}</td>
                    <td className="p-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          ch.status === 'cleared'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : ch.status === 'bounced'
                            ? 'bg-rose-950 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {ch.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {ch.status !== 'cleared' && (
                        <button
                          onClick={() => handleChequeAction(ch.id, 'cleared')}
                          className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px]"
                        >
                          Clear
                        </button>
                      )}
                      {ch.status !== 'bounced' && (
                        <button
                          onClick={() => handleChequeAction(ch.id, 'bounced')}
                          className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-bold text-[10px]"
                        >
                          Bounce
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. SUB-TAB CONTENT: ANOMALIES & AUDIT ALERTS                              */}
      {activeSubTab === 'anomalies' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-white">Reconciliation Anomaly &amp; Fraud Sentinel</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Automated heuristics scanning for duplicate reference numbers, high-value unmatched items, and ledger drift.
            </p>
          </div>

          <div className="space-y-3">
            {anomalies.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-emerald-400 font-sans">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                All clear! No anomalies detected across statement feeds and ledger accounts.
              </div>
            ) : (
              anomalies.map((a: any) => (
                <div
                  key={a.id}
                  className={`p-4 rounded-2xl border flex items-start gap-3 shadow-lg ${
                    a.severity === 'danger'
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : a.severity === 'warning'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                      : 'bg-blue-950/40 border-blue-500/40 text-blue-200'
                  }`}
                >
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold text-sm text-white">{a.title}</div>
                    <p className="text-xs text-slate-300 font-sans">{a.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. RECONCILE SIDE-BY-SIDE DRAWER (STATEMENT VS CANDIDATE GL ENTRIES)    */}
      {/* ========================================================================= */}
      {activeReconcileLine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-3xl bg-slate-950 border-l border-slate-800 p-6 overflow-y-auto space-y-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-blue-400" />
                    Side-by-Side Match &amp; Adjust
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Match statement line against general ledger entries or post an adjusting journal.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveReconcileLine(null);
                    setSelectedLedgerEntryId(null);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Side-by-Side Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Side: Statement Line */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      Statement Line (Bank)
                    </span>
                    <span className="text-xs font-mono text-slate-400">
                      ID #{activeReconcileLine.id}
                    </span>
                  </div>

                  <div className="text-lg font-bold text-white font-mono">
                    {parseFloat(activeReconcileLine.depositAmount) > 0 ? (
                      <span className="text-emerald-400">+ {formatNpr(activeReconcileLine.depositAmount)}</span>
                    ) : (
                      <span className="text-rose-400">- {formatNpr(activeReconcileLine.withdrawalAmount)}</span>
                    )}
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                    <div>Ref: <strong className="text-white">{activeReconcileLine.referenceNo}</strong></div>
                    <div>Date: {renderDate(activeReconcileLine.statementDate)}</div>
                    <div className="font-sans text-slate-400">{activeReconcileLine.description}</div>
                  </div>
                </div>

                {/* Right Side: Running Difference */}
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                      Reconciliation Difference
                    </span>
                    {selectedLedgerEntryId ? (
                      <div className="mt-2 text-xs font-mono text-slate-300 space-y-1">
                        <div>Matched to Voucher: <strong className="text-blue-400">#{selectedLedgerEntryId}</strong></div>
                        <div className="text-emerald-400 font-bold">Difference: NPR 0.00 (Ready to Match)</div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs font-mono text-amber-300">
                        Select a candidate ledger item below or create an adjusting entry.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => setIsAdjustmentModalOpen(true)}
                      className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-400" />
                      <span>Post GL Adjusting Entry</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Candidate Ledger Entries List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">
                  Candidate General Ledger Postings
                </h4>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {candidateLedgerEntries.map((c: any) => {
                    const isSelected = selectedLedgerEntryId === c.journalEntryId;
                    const cAmt = parseFloat(c.debit || '0') > 0 ? c.debit : c.credit;

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedLedgerEntryId(isSelected ? null : c.journalEntryId)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-xs font-mono ${
                          isSelected
                            ? 'bg-blue-950/60 border-blue-500 ring-1 ring-blue-500/40 text-white'
                            : 'bg-slate-900 hover:bg-slate-850 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">#{c.entryNumber}</span>
                            <span className="text-[10px] text-slate-400 uppercase font-sans">
                              {c.sourceType || 'manual'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 font-sans">{c.description}</p>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-slate-200">{formatNpr(cAmt)}</div>
                          <div className="text-[10px] text-slate-400">{c.entryDate}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Match Button */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setActiveReconcileLine(null);
                  setSelectedLedgerEntryId(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleReconcileSelected}
                disabled={isReconciling}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
              >
                {isReconciling ? 'Reconciling...' : 'Confirm Match'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 11. GL ADJUSTING ENTRY MODAL (BANK CHARGES, INTEREST, TDS)               */}
      {/* ========================================================================= */}
      {isAdjustmentModalOpen && activeReconcileLine && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateAdjustment}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-400" />
                Post Balanced Adjusting Journal
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <div>Transaction: <strong className="text-white">{activeReconcileLine.description}</strong></div>
              <div>Amount: <strong className="text-emerald-400">{formatNpr(activeReconcileLine.amount)}</strong></div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Adjustment Type</label>
              <select
                value={adjustmentType}
                onChange={(e: any) => setAdjustmentType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                <option value="bank_charge">Bank Charge / Commission (Dr. 5020 / Cr. Bank)</option>
                <option value="interest_income">Interest Income (Dr. Bank / Cr. 4010)</option>
                <option value="rounding">Rounding / Minor Tolerance (Dr/Cr 5020)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Remarks / Reference</label>
              <input
                type="text"
                placeholder="e.g. Nabil monthly SMS & ledger charges"
                value={adjustmentNotes}
                onChange={(e) => setAdjustmentNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
              >
                Post Balanced Entry &amp; Match
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 12. STATEMENT IMPORT MODAL WITH DRY-RUN & DUPLICATE PROTECTION           */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-400" />
                Import Bank / Wallet Statement
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Target Account</label>
                <select
                  value={importAccountId}
                  onChange={(e) => setImportAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                >
                  {accounts.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.accountName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Filename / Batch Name</label>
                <input
                  type="text"
                  placeholder="e.g. Nabil_Oct_2026.csv"
                  value={importFilename}
                  onChange={(e) => setImportFilename(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                CSV Statement Content (Date, Reference, Description, Deposit, Withdrawal, Balance)
              </label>
              <textarea
                rows={6}
                placeholder="date,referenceNo,description,debit,credit,runningBalance&#10;2026-10-04,TXN-99881,POS Counter 01 Settlement,45000,0,145000&#10;2026-10-04,CHQ-4401,Supplier Ocean Tech Cheque,0,15000,130000"
                value={importRawCsv}
                onChange={(e) => setImportRawCsv(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Dry Run Preview Banner */}
            {dryRunResult && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono space-y-1">
                <div className="font-bold text-emerald-400">Dry-Run Validation Result:</div>
                <div className="text-slate-300">
                  Total Rows: {dryRunResult.totalRows} | Valid: <strong className="text-emerald-400">{dryRunResult.validRows}</strong> | Duplicates Skipped: <strong className="text-amber-400">{dryRunResult.skippedDuplicates}</strong>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={handleDryRunImport}
                disabled={isDryRunning || !importRawCsv.trim()}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700"
              >
                {isDryRunning ? 'Validating...' : 'Dry-Run Preview'}
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitImport}
                  disabled={isImporting || !importRawCsv.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30"
                >
                  {isImporting ? 'Importing...' : 'Confirm & Commit Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 13. PERIOD CLOSE MODAL (MAKER-CHECKER PIN)                               */}
      {/* ========================================================================= */}
      {isPeriodCloseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handlePeriodClose}
            className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-purple-400" />
                Maker-Checker Period Close &amp; Lock
              </h3>
              <button type="button" onClick={() => setIsPeriodCloseModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Account</label>
              <select
                value={closeAccountId}
                onChange={(e) => setCloseAccountId(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
              >
                {accounts.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.accountName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Nepali Month (BS)</label>
                <select
                  value={closeMonth}
                  onChange={(e) => setCloseMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
                >
                  <option value={4}>Shrawan (Period 1)</option>
                  <option value={5}>Bhadra (Period 2)</option>
                  <option value={6}>Ashwin (Period 3)</option>
                  <option value={7}>Kartik (Period 4)</option>
                  <option value={8}>Mangsir (Period 5)</option>
                  <option value={9}>Poush (Period 6)</option>
                  <option value={10}>Magh (Period 7)</option>
                  <option value={11}>Falgun (Period 8)</option>
                  <option value={12}>Chaitra (Period 9)</option>
                  <option value={1}>Baisakh (Period 10)</option>
                  <option value={2}>Jestha (Period 11)</option>
                  <option value={3}>Ashadh (Period 12)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Fiscal Year</label>
                <input
                  type="text"
                  disabled
                  value="2082/83"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-amber-300 flex items-center justify-between">
                <span>Supervisor / Manager Approval PIN</span>
                <span className="text-[10px] text-slate-400">(e.g. 1234 or 9999)</span>
              </label>
              <input
                type="password"
                maxLength={6}
                placeholder="Enter 4-6 digit supervisor PIN"
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500/50 text-xs text-white tracking-widest font-mono focus:border-amber-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Close Notes / Audit Sign-off</label>
              <input
                type="text"
                placeholder="e.g. Month-end BRS verified with bank statement & ledger"
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200"
              />
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPeriodCloseModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isClosingPeriod || !supervisorPin}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs disabled:opacity-50"
              >
                {isClosingPeriod ? 'Locking...' : 'Authorize & Lock Period'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 14. ADD BANK / DIGITAL WALLET MODAL (LINKED TO CHART OF ACCOUNTS)         */}
      {/* ========================================================================= */}
      {isAddBankModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateBankAccount}
            className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 my-8"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Bank / Digital Wallet Account</h3>
                  <p className="text-xs text-slate-400">Register bank or gateway and link directly to General Ledger COA</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBankModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Nepal Preset Chips */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1.5 uppercase font-mono">
                Quick Preset (Commercial Banks &amp; Wallets in Nepal)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {bankPresets.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => handleSelectBankPreset(p)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                      newBankName === p.name
                        ? 'bg-emerald-600 text-white border-emerald-400 font-bold'
                        : 'bg-slate-950/70 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800'
                    }`}
                  >
                    {p.name.replace(' Ltd', '').replace(' Pvt Ltd', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Account Type Selector */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Account Category</label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { id: 'bank', label: 'Bank', icon: Landmark },
                  { id: 'esewa', label: 'eSewa', icon: Wallet },
                  { id: 'khalti', label: 'Khalti', icon: Wallet },
                  { id: 'fonepay', label: 'Fonepay', icon: QrCode },
                  { id: 'connect_ips', label: 'ConnectIPS', icon: ArrowRightLeft },
                  { id: 'vault', label: 'Safe/Vault', icon: ShieldCheck },
                ].map((t) => {
                  const Icon = t.icon;
                  const isCur = newBankType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setNewBankType(t.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-medium border transition-all ${
                        isCur
                          ? 'bg-blue-600 text-white border-blue-400 font-bold shadow-md shadow-blue-900/30'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[10px]">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Bank / Institution Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Global IME Bank Ltd"
                  value={newBankName}
                  onChange={(e) => setNewBankName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Account Display Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Global IME Corporate Operating A/C"
                  value={newAccountName}
                  onChange={(e) => {
                    setNewAccountName(e.target.value);
                    if (coaLinkMode === 'new' && !newCoaName) {
                      setNewCoaName(`Bank - ${e.target.value}`);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Account # / Merchant ID / Mobile <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 0401010008899 or 9801234567"
                  value={newAccountNumber}
                  onChange={(e) => setNewAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Branch / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Dhangadhi Main Branch, Kailali"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block mb-1">Opening Balance (NPR)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newOpeningBalance}
                  onChange={(e) => setNewOpeningBalance(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* General Ledger (COA) Linking Section */}
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-white">Link with Chart of Accounts (COA)</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="coaLinkMode"
                      checked={coaLinkMode === 'existing'}
                      onChange={() => setCoaLinkMode('existing')}
                      className="accent-blue-500"
                    />
                    <span>Select Existing</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                    <input
                      type="radio"
                      name="coaLinkMode"
                      checked={coaLinkMode === 'new'}
                      onChange={() => {
                        setCoaLinkMode('new');
                        if (!newCoaCode) setNewCoaCode(suggestedNextCoaCode);
                        if (!newCoaName) setNewCoaName(`Bank - ${newAccountName || newBankName}`);
                      }}
                      className="accent-emerald-500"
                    />
                    <span>Auto-create New Account</span>
                  </label>
                </div>
              </div>

              {coaLinkMode === 'existing' ? (
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">
                    Select General Ledger Asset Account (Double-Entry Posting Target)
                  </label>
                  <select
                    value={selectedCoaId}
                    onChange={(e) => setSelectedCoaId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Choose Account from Chart of Accounts --</option>
                    {chartOfAccounts
                      .filter((c: any) => c.type === 'asset' || String(c.code).startsWith('10'))
                      .map((c: any) => (
                        <option key={c.id} value={c.id}>
                          [{c.code}] {c.name} ({c.type})
                        </option>
                      ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">New COA Account Code</label>
                    <input
                      type="text"
                      placeholder={suggestedNextCoaCode}
                      value={newCoaCode}
                      onChange={(e) => setNewCoaCode(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-slate-500">Asset Account in Range 1000-1099</span>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">New COA Account Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Bank - Global IME Corporate"
                      value={newCoaName}
                      onChange={(e) => setNewCoaName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-slate-500">Will be created in General Ledger</span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddBankModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingBank}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isSubmittingBank ? 'Registering...' : 'Register & Link Bank'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 15. EDIT BANK ACCOUNT / RE-LINK COA MODAL                                 */}
      {/* ========================================================================= */}
      {isEditCoaModalOpen && editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleUpdateCoaLink}
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Configure Chart of Accounts Linkage</h3>
                  <p className="text-xs text-slate-400">{editingAccount.accountName} ({editingAccount.accountNumber})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditCoaModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Account Details Summary */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Institution:</span>
                <span className="text-slate-200 font-bold">{editingAccount.bankName || editingAccount.provider}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Account Number:</span>
                <span className="text-slate-200">{editingAccount.accountNumber}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Current COA Link:</span>
                <span className="text-blue-400 font-bold">
                  {editingAccount.coaCode ? `[${editingAccount.coaCode}] ${editingAccount.coaName}` : 'None (Unlinked)'}
                </span>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center gap-3 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="editCoaMode"
                  checked={editCoaMode === 'existing'}
                  onChange={() => setEditCoaMode('existing')}
                  className="accent-blue-500"
                />
                <span>Link to Existing Account</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="radio"
                  name="editCoaMode"
                  checked={editCoaMode === 'new'}
                  onChange={() => setEditCoaMode('new')}
                  className="accent-emerald-500"
                />
                <span>Create New COA Account</span>
              </label>
            </div>

            {editCoaMode === 'existing' ? (
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Select General Ledger Account
                </label>
                <select
                  value={editCoaId}
                  onChange={(e) => setEditCoaId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Disconnect / Unlink COA --</option>
                  {chartOfAccounts
                    .filter((c: any) => c.type === 'asset' || String(c.code).startsWith('10'))
                    .map((c: any) => (
                      <option key={c.id} value={c.id}>
                        [{c.code}] {c.name} ({c.type})
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">New Account Code</label>
                  <input
                    type="text"
                    value={editNewCoaCode}
                    onChange={(e) => setEditNewCoaCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">New Account Title</label>
                  <input
                    type="text"
                    value={editNewCoaName}
                    onChange={(e) => setEditNewCoaName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setIsEditCoaModalOpen(false);
                  handleDeleteBankAccount(editingAccount.id, editingAccount.accountName);
                }}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Account</span>
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditCoaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingCoa}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-900/30 disabled:opacity-50"
                >
                  {isUpdatingCoa ? 'Saving...' : 'Save COA Linkage'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
