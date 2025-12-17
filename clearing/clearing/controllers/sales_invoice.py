import frappe
from clearing.api.utils import get_expense_account


@frappe.whitelist()
def get_items_from_selected_clearing_charges(clearing_charges, company):
    """
    Fetch items from a Clearing Charges document and format them for a Sales Invoice.

    Args:
        clearing_charges: Name of the Clearing Charges document
        company: Company name for account lookups

    Returns:
        dict: Contains sales_invoice_items and clearing_details
    """
    sales_invoice_items = []
    default_income_account = frappe.db.get_value(
        "Company", company, "default_income_account"
    )

    try:
        clearing_charges_doc = frappe.get_doc("Clearing Charges", clearing_charges)

        # Iterate over charges in the Clearing Charges document
        for charge in clearing_charges_doc.charges:
            # Only include charges marked as invoice items
            if not charge.is_invoice:
                continue

            amount = charge.amount or 0

            # Get the expense account for this charge type (item)
            expense_account = get_expense_account(
                "Clearing Charges", company, currency=clearing_charges_doc.currency
            )

            # Get item details - charge_type is linked to Item doctype
            item_name, uom = frappe.db.get_value(
                "Item", charge.charge_type, ["item_name", "stock_uom"]
            )

            # Create item dictionary for sales invoice
            item_details = {
                "item_code": charge.charge_type,
                "item_name": item_name or charge.charge_type,
                "qty": 1,  # Charges typically have qty of 1
                "rate": amount,
                "amount": amount,
                "uom": uom or "Nos",
                "income_account": default_income_account,
                "expense_account": expense_account,
                "custom_clearing_file": clearing_charges_doc.clearing_file,
                "custom_truck_number": charge.vehicle_number or "",
            }

            sales_invoice_items.append(item_details)

        # Fetch clearing file details if available
        clearing_file_name = clearing_charges_doc.clearing_file or ""
        track_number = clearing_charges_doc.track_number or ""
        customer = clearing_charges_doc.consigee or ""
        currency = clearing_charges_doc.currency or ""

        # Prepare clearing details
        clearing_details = {
            "clearing_file": clearing_file_name,
            "track_number": track_number,
            "customer": customer,
            "currency": currency,
            "clearing_charges": clearing_charges,
        }

        # Prepare response
        response_data = {
            "sales_invoice_items": sales_invoice_items,
            "clearing_details": clearing_details,
        }

        frappe.response["message"] = response_data

    except Exception as e:
        frappe.throw(
            f"Error fetching items from Clearing Charges {clearing_charges}: {e}"
        )


def update_clearing_charges_status_on_invoice_submit(sales_invoice, method=None):
    """
    Update Clearing Charges status to 'Billed' when Sales Invoice is submitted.

    This function is called via document hook on Sales Invoice submit.
    It checks if the invoice has a custom_clearing_charges field and updates
    the status accordingly.
    """
    # Check if custom field exists and has a value
    clearing_charges_ref = sales_invoice.get("custom_clearing_charges")

    if not clearing_charges_ref:
        # Try to find clearing charges from items
        clearing_charges_from_items = set()
        for item in sales_invoice.get("items", []):
            clearing_file = item.get("custom_clearing_file")
            if clearing_file:
                # Find Clearing Charges by clearing_file
                cc_list = frappe.get_all(
                    "Clearing Charges",
                    filters={"clearing_file": clearing_file, "docstatus": ["<", 2]},
                    pluck="name",
                )
                clearing_charges_from_items.update(cc_list)

        if not clearing_charges_from_items:
            return

        # Update all found Clearing Charges
        for cc_name in clearing_charges_from_items:
            _update_single_clearing_charges_status(cc_name, sales_invoice.name)
    else:
        # Direct reference exists
        _update_single_clearing_charges_status(clearing_charges_ref, sales_invoice.name)


def _update_single_clearing_charges_status(clearing_charges_name, invoice_name):
    """Update a single Clearing Charges document status to Billed."""
    try:
        cc_doc = frappe.get_doc("Clearing Charges", clearing_charges_name)

        # Only update if status is 'To Bill'
        if cc_doc.status == "To Bill":
            cc_doc.status = "Billed"
            cc_doc.add_comment(
                "Info", f"Status updated to 'Billed' via Sales Invoice: {invoice_name}"
            )
            cc_doc.save(ignore_permissions=True)

            frappe.msgprint(
                f"Clearing Charges {clearing_charges_name} status updated to 'Billed'",
                alert=True,
            )
    except Exception as e:
        frappe.log_error(
            f"Failed to update Clearing Charges {clearing_charges_name}: {str(e)}",
            "Clearing Charges Status Update Error",
        )


def reset_clearing_charges_status_on_invoice_cancel(sales_invoice, method=None):
    """
    Reset Clearing Charges status to 'To Bill' when Sales Invoice is cancelled.

    This function is called via document hook on Sales Invoice cancel.
    """
    clearing_charges_ref = sales_invoice.get("custom_clearing_charges")

    if not clearing_charges_ref:
        # Try to find from items
        clearing_charges_from_items = set()
        for item in sales_invoice.get("items", []):
            clearing_file = item.get("custom_clearing_file")
            if clearing_file:
                cc_list = frappe.get_all(
                    "Clearing Charges",
                    filters={"clearing_file": clearing_file, "docstatus": ["<", 2]},
                    pluck="name",
                )
                clearing_charges_from_items.update(cc_list)

        if not clearing_charges_from_items:
            return

        for cc_name in clearing_charges_from_items:
            _reset_single_clearing_charges_status(cc_name, sales_invoice.name)
    else:
        _reset_single_clearing_charges_status(clearing_charges_ref, sales_invoice.name)


def _reset_single_clearing_charges_status(clearing_charges_name, invoice_name):
    """Reset a single Clearing Charges document status to To Bill."""
    try:
        cc_doc = frappe.get_doc("Clearing Charges", clearing_charges_name)

        # Only reset if status is 'Billed'
        if cc_doc.status == "Billed":
            cc_doc.status = "To Bill"
            cc_doc.add_comment(
                "Info",
                f"Status reset to 'To Bill' due to Sales Invoice cancellation: {invoice_name}",
            )
            cc_doc.save(ignore_permissions=True)

            frappe.msgprint(
                f"Clearing Charges {clearing_charges_name} status reset to 'To Bill'",
                alert=True,
            )
    except Exception as e:
        frappe.log_error(
            f"Failed to reset Clearing Charges {clearing_charges_name}: {str(e)}",
            "Clearing Charges Status Reset Error",
        )
