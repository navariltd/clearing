// Copyright (c) 2025, Nelson Mpanju and contributors
// For license information, please see license.txt

(function () {
  // Wrapped in IIFE to avoid global scope pollution (Frappe v16 best practice)
  frappe.query_reports["Transmission Slip Report"] = {
    filters: [
      {
        fieldname: "company",
        label: __("Company"),
        fieldtype: "Link",
        options: "Company",
        default: frappe.defaults.get_user_default("Company"),
        reqd: 1,
      },
      {
        fieldname: "from_date",
        label: __("From Date"),
        fieldtype: "Date",
        default: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
        reqd: 1,
      },
      {
        fieldname: "to_date",
        label: __("To Date"),
        fieldtype: "Date",
        default: frappe.datetime.get_today(),
        reqd: 1,
      },
      {
        fieldname: "status",
        label: __("Status"),
        fieldtype: "Select",
        options: [
          { value: "", label: __("") },
          { value: "Open", label: __("Open") },
          { value: "Pre-Lodged", label: __("Pre-Lodged") },
          { value: "On Process", label: __("On Process") },
          { value: "Cleared", label: __("Cleared") },
          { value: "Delivered", label: __("Delivered") },
          { value: "Charges Pending", label: __("Charges Pending") },
          { value: "Payment Received", label: __("Payment Received") },
          { value: "Closed", label: __("Closed") },
        ],
      },
      {
        fieldname: "customer",
        label: __("Consignee"),
        fieldtype: "Link",
        options: "Customer",
      },
      {
        fieldname: "clearing_file",
        label: __("Clearing File"),
        fieldtype: "Link",
        options: "Clearing File",
      },
      {
        fieldname: "road_consignment",
        label: __("Track Number"),
        fieldtype: "Data",
      },
    ],
  };
})();
