import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const DEFAULT_DEPARTMENTS = [
  { name: "Clinical Chemistry", code: "CC", type: "lab" },
  { name: "Hematology", code: "HEM", type: "lab" },
  { name: "Microbiology", code: "MIC", type: "lab" },
  { name: "Histopathology", code: "HIST", type: "lab" },
  { name: "Molecular Biology", code: "MOL", type: "lab" },
  { name: "Radiology", code: "RAD", type: "radiology" },
  { name: "Ultrasound", code: "US", type: "radiology" },
  { name: "Cardiology", code: "CAR", type: "clinical" },
  { name: "Outpatient Department", code: "OPD", type: "opd" },
  { name: "Pharmacy", code: "PHAR", type: "pharmacy" },
  { name: "Administration", code: "ADMIN", type: "admin" },
];

const DEFAULT_COA = [
  { code: "1000", name: "Current Assets", type: "asset", is_group: true },
  { code: "1100", name: "Cash", type: "asset" },
  { code: "1110", name: "Bank", type: "asset" },
  { code: "1200", name: "Accounts Receivable", type: "asset" },
  { code: "1300", name: "Inventory", type: "asset" },
  { code: "1400", name: "Prepaid Expenses", type: "asset" },
  { code: "1500", name: "Fixed Assets", type: "asset", is_group: true },
  { code: "1510", name: "Equipment", type: "asset" },
  { code: "1520", name: "Furniture & Fixtures", type: "asset" },
  { code: "2000", name: "Current Liabilities", type: "liability", is_group: true },
  { code: "2100", name: "Accounts Payable", type: "liability" },
  { code: "2200", name: "Accrued Expenses", type: "liability" },
  { code: "2300", name: "Bank Overdraft", type: "liability" },
  { code: "3000", name: "Equity", type: "equity", is_group: true },
  { code: "3100", name: "Owner Capital", type: "equity" },
  { code: "3200", name: "Retained Earnings", type: "equity" },
  { code: "4000", name: "Revenue", type: "revenue", is_group: true },
  { code: "4100", name: "Lab Revenue", type: "revenue" },
  { code: "4200", name: "Radiology Revenue", type: "revenue" },
  { code: "4300", name: "OPD Revenue", type: "revenue" },
  { code: "4400", name: "Pharmacy Revenue", type: "revenue" },
  { code: "4500", name: "Other Revenue", type: "revenue" },
  { code: "5000", name: "Expenses", type: "expense", is_group: true },
  { code: "5100", name: "Salary Expense", type: "expense" },
  { code: "5200", name: "Rent Expense", type: "expense" },
  { code: "5300", name: "Utility Expense", type: "expense" },
  { code: "5400", name: "Material Cost", type: "expense" },
  { code: "5500", name: "Outsource Cost", type: "expense" },
  { code: "5600", name: "Marketing Expense", type: "expense" },
  { code: "5900", name: "Other Expenses", type: "expense" },
];

const DEFAULT_DESIGNATIONS = [
  "Chief Executive Officer",
  "Medical Director",
  "Laboratory Manager",
  "Senior Pathologist",
  "Consultant Radiologist",
  "Medical Officer",
  "Lab Technician",
  "Radiology Technician",
  "Pharmacist",
  "Receptionist",
  "Accountant",
  "HR Officer",
  "Store Manager",
  "IT Administrator",
];

const DEFAULT_SETTINGS = [
  { key: "inventory_valuation_method", value: "fifo", category: "inventory" },
  { key: "inventory_reorder_alert_days", value: 7, category: "inventory" },
  { key: "inventory_expiry_alert_days", value: 30, category: "inventory" },
  { key: "opd_default_consultation_fee", value: 500, category: "opd" },
  { key: "opd_token_prefix", value: "OPD", category: "opd" },
  { key: "lab_sample_prefix", value: "S", category: "lab" },
  { key: "lab_result_turnaround_hours", value: 24, category: "lab" },
  { key: "lab_critical_value_alert", value: true, category: "lab" },
  { key: "pharmacy_barcode_prefix", value: "PH", category: "pharmacy" },
  { key: "pharmacy_low_stock_alert", value: true, category: "pharmacy" },
  { key: "invoice_prefix", value: "INV", category: "billing" },
  { key: "invoice_receipt_prefix", value: "RCP", category: "billing" },
  { key: "invoice_allow_partial_payment", value: true, category: "billing" },
  { key: "invoice_allow_credit", value: true, category: "billing" },
  { key: "accounting_auto_journal", value: true, category: "accounting" },
  { key: "report_show_qr_code", value: true, category: "report" },
  { key: "report_show_digital_signature", value: true, category: "report" },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { data: status } = await supabase
      .from("system_status")
      .select("setup_complete")
      .eq("id", 1)
      .maybeSingle();

    if (status?.setup_complete) {
      return new Response(
        JSON.stringify({ error: "Setup has already been completed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { company, branch, admin, settings } = body;

    if (!company?.name || !branch?.name || !branch?.code || !admin?.email || !admin?.password || !admin?.full_name) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (admin.password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: companyData, error: companyErr } = await supabase
      .from("companies")
      .insert({
        name: company.name,
        legal_name: company.legal_name || company.name,
        address: company.address || null,
        city: company.city || null,
        phone: company.phone || null,
        email: company.email || null,
        currency: company.currency || "PKR",
        currency_symbol: company.currency_symbol || "Rs",
        tax_percentage: parseFloat(company.tax_percentage) || 0,
        is_active: true,
      })
      .select()
      .single();
    if (companyErr) throw new Error(`Company: ${companyErr.message}`);
    const companyId = companyData.id;

    const { data: branchData, error: branchErr } = await supabase
      .from("branches")
      .insert({
        company_id: companyId,
        name: branch.name,
        code: branch.code,
        address: branch.address || null,
        city: branch.city || null,
        phone: branch.phone || null,
        is_head_office: true,
        is_active: true,
      })
      .select()
      .single();
    if (branchErr) throw new Error(`Branch: ${branchErr.message}`);
    const branchId = branchData.id;

    const deptRows = DEFAULT_DEPARTMENTS.map((d) => ({
      company_id: companyId,
      branch_id: branchId,
      name: d.name,
      code: d.code,
      type: d.type,
      is_active: true,
    }));
    const { error: deptErr } = await supabase.from("departments").insert(deptRows);
    if (deptErr) throw new Error(`Departments: ${deptErr.message}`);

    const desigRows = DEFAULT_DESIGNATIONS.map((name) => ({
      company_id: companyId,
      name,
      is_active: true,
    }));
    const { error: desigErr } = await supabase.from("designations").insert(desigRows);
    if (desigErr) throw new Error(`Designations: ${desigErr.message}`);

    const coaRows = DEFAULT_COA.map((c) => ({
      company_id: companyId,
      code: c.code,
      name: c.name,
      type: c.type,
      is_group: c.is_group ?? false,
      is_active: true,
    }));
    const { error: coaErr } = await supabase.from("chart_of_accounts").insert(coaRows);
    if (coaErr) throw new Error(`Chart of Accounts: ${coaErr.message}`);

    const now = new Date();
    const startMonth = parseInt(settings?.fiscal_year_start || "1") - 1;
    const fyStart = new Date(now.getFullYear(), startMonth, 1);
    const fyEnd = new Date(fyStart.getFullYear() + 1, fyStart.getMonth(), 0);
    const { error: fyErr } = await supabase.from("financial_years").insert({
      company_id: companyId,
      name: `FY ${fyStart.getFullYear()}-${fyEnd.getFullYear()}`,
      start_date: fyStart.toISOString().split("T")[0],
      end_date: fyEnd.toISOString().split("T")[0],
      is_closed: false,
    });
    if (fyErr) throw new Error(`Financial Year: ${fyErr.message}`);

    const settingsRows = DEFAULT_SETTINGS.map((s) => ({
      company_id: companyId,
      key: s.key,
      value: s.value,
      category: s.category,
    }));
    const { error: settingsErr } = await supabase.from("system_settings").insert(settingsRows);
    if (settingsErr) throw new Error(`Settings: ${settingsErr.message}`);

    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email: admin.email,
      password: admin.password,
      email_confirm: true,
    });
    if (authErr) throw new Error(`Admin user: ${authErr.message}`);
    const authUserId = authData.user?.id;
    if (!authUserId) throw new Error("Failed to create admin user");

    const { data: roleData, error: roleErr } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "super_admin")
      .maybeSingle();
    if (roleErr || !roleData) throw new Error("super_admin role not found");

    const { data: empData, error: empErr } = await supabase
      .from("employees")
      .insert({
        company_id: companyId,
        branch_id: branchId,
        employee_code: "EMP-001",
        full_name: admin.full_name,
        phone: admin.phone || null,
        email: admin.email,
        hire_date: new Date().toISOString().split("T")[0],
        is_active: true,
      })
      .select()
      .single();
    if (empErr) throw new Error(`Employee: ${empErr.message}`);

    const { error: appUserErr } = await supabase.from("app_users").insert({
      auth_user_id: authUserId,
      company_id: companyId,
      branch_id: branchId,
      role_id: roleData.id,
      employee_id: empData.id,
      full_name: admin.full_name,
      email: admin.email,
      phone: admin.phone || null,
      is_active: true,
    });
    if (appUserErr) throw new Error(`App user: ${appUserErr.message}`);

    const { error: statusErr } = await supabase
      .from("system_status")
      .update({
        setup_complete: true,
        setup_completed_at: new Date().toISOString(),
        current_company_id: companyId,
      })
      .eq("id", 1);
    if (statusErr) throw new Error(`Status: ${statusErr.message}`);

    return new Response(
      JSON.stringify({ success: true, message: "Setup completed successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
