export type Company = {
  id: string;
  name: string;
  legal_name: string | null;
  registration_number: string | null;
  address: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  currency: string;
  currency_symbol: string;
  tax_number: string | null;
  tax_percentage: number;
  fiscal_year_start_month: number;
  timezone: string | null;
  language: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ShareRule = {
  id: string;
  company_id: string;
  branch_id: string | null;
  share_for: 'referral_person' | 'referral_doctor' | 'performing_doctor' | 'opd_doctor';
  doctor_id: string | null;
  doctor_type: string | null;
  referral_source_id: string | null;
  corporate_client_id: string | null;
  department_id: string | null;
  service_id: string | null;
  service_category: string | null;
  share_type: 'percentage' | 'fixed';
  share_value: number;
  calculation_basis: 'total_amount' | 'net_amount' | 'total_minus_discount' | 'cash' | 'total_minus_share';
  effective_date: string;
  effective_to: string | null;
  priority: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  in_source_share_type: string | null;
  in_source_share_value: number | null;
  in_source_calculation_basis: string | null;
  out_source_share_type: string | null;
  out_source_share_value: number | null;
  out_source_calculation_basis: string | null;
  created_at: string;
  updated_at: string;
  doctor?: { full_name: string } | null;
  department?: { name: string } | null;
  service?: { name: string } | null;
  referral_source?: { name: string } | null;
  corporate_client?: { name: string } | null;
};

export type PanelShareRule = {
  id: string;
  company_id: string;
  branch_id: string | null;
  corporate_client_id: string;
  department_id: string | null;
  section_id: string | null;
  service_id: string | null;
  share_type: 'percentage' | 'fixed';
  share_value: number;
  calculation_basis: string;
  effective_date: string;
  effective_to: string | null;
  priority: number;
  is_active: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  corporate_client?: { name: string } | null;
  department?: { name: string } | null;
  service?: { name: string } | null;
};

export type PanelSettlement = {
  id: string;
  company_id: string;
  corporate_client_id: string;
  lab_order_id: string | null;
  service_name: string;
  service_id: string | null;
  department_id: string | null;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  calculation_basis: string;
  share_type: string;
  share_percentage: number | null;
  share_amount: number;
  share_rule_id: string | null;
  settled: boolean;
  settled_at: string | null;
  settlement_period: string | null;
  created_at: string;
  updated_at: string;
};

export type ShareAuditLog = {
  id: string;
  company_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  changed_by: string | null;
  changed_at: string;
};

export type Branch = {
  id: string;
  company_id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  is_head_office: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Department = {
  id: string;
  company_id: string;
  branch_id: string;
  name: string;
  code: string;
  type: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Designation = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Role = {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type Permission = {
  id: string;
  module: string;
  action: string;
  description: string | null;
  created_at: string;
};

export type AppUser = {
  id: string;
  auth_user_id: string;
  company_id: string | null;
  branch_id: string | null;
  role_id: string;
  employee_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role?: Role;
  branch?: Branch;
};

export type Employee = {
  id: string;
  company_id: string;
  branch_id: string | null;
  department_id: string | null;
  designation_id: string | null;
  employee_code: string | null;
  full_name: string;
  gender: string | null;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  hire_date: string | null;
  salary: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ChartOfAccount = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_id: string | null;
  is_group: boolean;
  opening_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FinancialYear = {
  id: string;
  company_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SystemSetting = {
  id: string;
  company_id: string | null;
  key: string;
  value: any;
  category: string;
  created_at: string;
  updated_at: string;
};

export type SystemStatus = {
  id: number;
  setup_complete: boolean;
  setup_completed_at: string | null;
  current_company_id: string | null;
  version: string;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  old_values: Record<string, any> | null;
  new_values: Record<string, any> | null;
  user_id: string | null;
  created_at: string;
};

export type RoleName =
  | 'super_admin'
  | 'admin'
  | 'manager'
  | 'reception'
  | 'doctor'
  | 'pathologist'
  | 'radiologist'
  | 'lab_technician'
  | 'pharmacist'
  | 'cashier'
  | 'accountant'
  | 'hr'
  | 'store_manager';

export type Doctor = {
  id: string;
  company_id: string;
  branch_id: string | null;
  department_id: string | null;
  doctor_code: string;
  photo_url: string | null;
  full_name: string;
  specialization: string | null;
  qualification: string | null;
  pmc_license: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  consultation_fee: number;
  opd_share_type: 'percentage' | 'fixed';
  opd_share: number;
  lab_share_type: 'percentage' | 'fixed';
  lab_share: number;
  radiology_share_type: 'percentage' | 'fixed';
  radiology_share: number;
  procedure_share_type: 'percentage' | 'fixed';
  procedure_share: number;
  monthly_settlement: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: Department;
  branch?: Branch;
};

export type ReferralSource = {
  id: string;
  company_id: string;
  branch_id: string | null;
  type: 'doctor' | 'clinic' | 'hospital' | 'corporate' | 'agent' | 'marketing';
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  commission_type: 'percentage' | 'fixed';
  commission_value: number;
  settlement_frequency: 'weekly' | 'monthly' | 'quarterly';
  monthly_limit: number | null;
  outstanding: number;
  ledger_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CorporateClient = {
  id: string;
  company_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  contract_start: string | null;
  contract_end: string | null;
  discount_percentage: number;
  credit_limit: number;
  outstanding: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InsuranceCompany = {
  id: string;
  company_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  discount_percentage: number;
  credit_limit: number;
  outstanding: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Service = {
  id: string;
  company_id: string;
  department_id: string | null;
  code: string;
  name: string;
  arabic_name: string | null;
  short_name: string | null;
  category: 'lab' | 'radiology' | 'opd' | 'procedure' | 'package';
  price: number;
  cost: number;
  doctor_share_type: 'percentage' | 'fixed';
  doctor_share: number;
  referral_share_type: 'percentage' | 'fixed';
  referral_share: number;
  outsource_cost: number;
  outsource_lab: string | null;
  sample_type: string | null;
  container: string | null;
  method: string | null;
  machine: string | null;
  normal_range: string | null;
  critical_value: string | null;
  turnaround_time_hours: number;
  barcode_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  department?: Department;
};

export type TestPackage = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  total_tests: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Unit = {
  id: string;
  company_id: string;
  name: string;
  short_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Manufacturer = {
  id: string;
  company_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Supplier = {
  id: string;
  company_id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  outstanding: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryItem = {
  id: string;
  company_id: string;
  branch_id: string | null;
  category_id: string | null;
  unit_id: string | null;
  manufacturer_id: string | null;
  supplier_id: string | null;
  item_code: string;
  barcode: string | null;
  name: string;
  generic_name: string | null;
  description: string | null;
  item_type: 'medicine' | 'consumable' | 'reagent' | 'equipment' | 'supply';
  purchase_price: number;
  sale_price: number;
  min_stock: number;
  max_stock: number;
  reorder_level: number;
  current_stock: number;
  stock_value: number;
  valuation_method: 'fifo' | 'average';
  is_prescription_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Patient = {
  id: string;
  company_id: string;
  branch_id: string | null;
  patient_code: string;
  full_name: string;
  gender: string;
  date_of_birth: string | null;
  age: number | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  cnic: string | null;
  blood_group: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LabOrder = {
  id: string;
  company_id: string;
  branch_id: string | null;
  patient_id: string;
  doctor_id: string | null;
  referral_source_id: string | null;
  order_code: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total_amount: number;
  discount_amount: number;
  net_amount: number;
  paid_amount: number;
  payment_status: 'unpaid' | 'partial' | 'paid';
  notes: string | null;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  doctor?: Doctor | null;
};

export type LabOrderItem = {
  id: string;
  lab_order_id: string;
  service_id: string;
  service_name: string;
  price: number;
  status: 'pending' | 'sample_collected' | 'processing' | 'result_entered' | 'verified' | 'approved' | 'printed';
  sample_id: string | null;
  collected_at: string | null;
  collected_by: string | null;
  result_entered_at: string | null;
  result_entered_by: string | null;
  verified_at: string | null;
  verified_by: string | null;
  approved_at: string | null;
  approved_by: string | null;
  verified_by_doctor_id: string | null;
  created_at: string;
  updated_at: string;
  results?: LabResult[];
  service?: Pick<Service, 'category' | 'sample_type' | 'container' | 'method' | 'normal_range' | 'turnaround_time_hours'>;
};

export type LabResult = {
  id: string;
  lab_order_item_id: string;
  service_id: string;
  result_value: string | null;
  unit: string | null;
  normal_range: string | null;
  flag: 'normal' | 'low' | 'high' | 'critical';
  method: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  parameters?: LabResultParameter[];
};

export type TestParameter = {
  id: string;
  company_id: string;
  service_id: string;
  name: string;
  unit: string | null;
  normal_range: string | null;
  low_critical: number | null;
  high_critical: number | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LabResultParameter = {
  id: string;
  lab_result_id: string;
  test_parameter_id: string | null;
  parameter_name: string;
  result_value: string | null;
  unit: string | null;
  normal_range: string | null;
  flag: 'normal' | 'low' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
};

export type Appointment = {
  id: string;
  company_id: string;
  branch_id: string | null;
  patient_id: string;
  doctor_id: string | null;
  department_id: string | null;
  appointment_date: string;
  appointment_time: string | null;
  status: 'scheduled' | 'checked_in' | 'completed' | 'cancelled' | 'no_show' | 'walk_in';
  type: 'new' | 'follow_up' | 'walk_in';
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  patient?: Patient;
  doctor?: Doctor;
  department?: Department;
};

export type DoctorSchedule = {
  id: string;
  company_id: string;
  doctor_id: string;
  branch_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  room: string | null;
  created_at: string;
  updated_at: string;
};

export type DoctorSettlement = {
  id: string;
  company_id: string;
  doctor_id: string;
  lab_order_id: string | null;
  service_name: string;
  service_id: string | null;
  department_id: string | null;
  share_type: 'percentage' | 'fixed';
  share_amount: number;
  share_percentage: number | null;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  calculation_basis: string;
  doctor_type: string;
  share_rule_id: string | null;
  settled: boolean;
  settled_at: string | null;
  settlement_period: string | null;
  created_at: string;
  updated_at: string;
};

export type ReferralSettlement = {
  id: string;
  company_id: string;
  referral_source_id: string;
  lab_order_id: string | null;
  service_name: string;
  service_id: string | null;
  department_id: string | null;
  commission_type: 'percentage' | 'fixed';
  commission_amount: number;
  share_percentage: number | null;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  calculation_basis: string;
  source_type: string;
  share_rule_id: string | null;
  settled: boolean;
  settled_at: string | null;
  settlement_period: string | null;
  created_at: string;
  updated_at: string;
};

export type JournalEntry = {
  id: string;
  company_id: string;
  branch_id: string | null;
  entry_number: string;
  entry_date: string;
  description: string;
  reference_type: string;
  reference_id: string | null;
  status: 'draft' | 'posted';
  total_debit: number;
  total_credit: number;
  financial_year_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type JournalLine = {
  id: string;
  journal_entry_id: string;
  account_id: string;
  debit: number;
  credit: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryTransfer = {
  id: string;
  company_id: string;
  from_branch_id: string | null;
  to_branch_id: string | null;
  transfer_number: string;
  transfer_date: string;
  item_id: string;
  quantity: number;
  status: 'pending' | 'in_transit' | 'received' | 'cancelled';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryAdjustment = {
  id: string;
  company_id: string;
  branch_id: string | null;
  adjustment_number: string;
  adjustment_date: string;
  item_id: string;
  quantity_change: number;
  reason: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PharmacyPurchase = {
  id: string;
  company_id: string;
  branch_id: string | null;
  purchase_number: string;
  purchase_date: string;
  supplier_id: string | null;
  item_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  batch_number: string | null;
  expiry_date: string | null;
  payment_status: 'unpaid' | 'partial' | 'paid';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PharmacyReturn = {
  id: string;
  company_id: string;
  branch_id: string | null;
  return_number: string;
  return_date: string;
  supplier_id: string | null;
  purchase_id: string | null;
  item_id: string;
  quantity: number;
  unit_cost: number;
  total_amount: number;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PharmacySale = {
  id: string;
  company_id: string;
  branch_id: string | null;
  sale_number: string;
  sale_date: string;
  patient_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  net_amount: number;
  paid_amount: number;
  payment_mode: 'cash' | 'card' | 'mobile' | 'credit';
  payment_status: 'unpaid' | 'partial' | 'paid';
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  items?: PharmacySaleItem[];
};

export type PharmacySaleItem = {
  id: string;
  sale_id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
  created_at: string;
  updated_at: string;
};

export type LabOrderPayment = {
  id: string;
  company_id: string;
  branch_id: string | null;
  lab_order_id: string;
  amount: number;
  payment_method: 'cash' | 'online' | 'card';
  transaction_reference: string | null;
  received_at: string;
  received_by: string | null;
  notes: string | null;
  created_at: string;
};

export type PanelRate = {
  id: string;
  company_id: string;
  corporate_client_id: string;
  service_id: string;
  panel_price: number;
  created_at: string;
  updated_at: string;
  service?: Service;
  corporate_client?: CorporateClient;
};

export type Attendance = {
  id: string;
  company_id: string;
  branch_id: string | null;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'leave' | 'holiday';
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseOrder = {
  id: string;
  company_id: string;
  branch_id: string | null;
  po_number: string;
  po_date: string;
  supplier_id: string | null;
  status: 'draft' | 'sent' | 'partial' | 'received' | 'cancelled';
  total_amount: number;
  received_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
};

export type PurchaseOrderItem = {
  id: string;
  po_id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
  received_qty: number;
  created_at: string;
  item?: InventoryItem;
};

export type GoodsReceiptNote = {
  id: string;
  company_id: string;
  branch_id: string | null;
  grn_number: string;
  grn_date: string;
  po_id: string | null;
  supplier_id: string | null;
  status: 'received' | 'cancelled';
  total_amount: number;
  notes: string | null;
  received_by: string | null;
  created_at: string;
  updated_at: string;
  supplier?: Supplier;
  purchase_order?: PurchaseOrder;
  items?: GoodsReceiptItem[];
};

export type GoodsReceiptItem = {
  id: string;
  grn_id: string;
  item_id: string;
  po_item_id: string | null;
  quantity: number;
  unit_cost: number;
  batch_number: string | null;
  expiry_date: string | null;
  created_at: string;
  item?: InventoryItem;
};

export type InventoryIssue = {
  id: string;
  company_id: string;
  branch_id: string | null;
  issue_number: string;
  issue_date: string;
  department_id: string | null;
  issued_to: string | null;
  status: 'issued' | 'returned' | 'cancelled';
  notes: string | null;
  issued_by: string | null;
  created_at: string;
  updated_at: string;
  department?: Department;
  items?: InventoryIssueItem[];
};

export type InventoryIssueItem = {
  id: string;
  issue_id: string;
  item_id: string;
  quantity: number;
  created_at: string;
  item?: InventoryItem;
};

export type BiometricMachine = {
  id: string;
  company_id: string;
  branch_id: string | null;
  name: string;
  ip_address: string;
  port: number;
  model: string | null;
  location: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_log: string | null;
  created_at: string;
  updated_at: string;
  branch?: Branch;
};

export type Payroll = {
  id: string;
  company_id: string;
  branch_id: string | null;
  employee_id: string;
  pay_period_month: number;
  pay_period_year: number;
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  status: 'pending' | 'paid' | 'cancelled';
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
