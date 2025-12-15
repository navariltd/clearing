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
            item_name = frappe.db.get_value("Item", charge.charge_type, "item_name")

            # Create item dictionary for sales invoice
            item_details = {
                "item_code": charge.charge_type,
                "item_name": item_name or charge.charge_type,
                "qty": 1,  # Charges typically have qty of 1
                "rate": amount,
                "amount": amount,
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
