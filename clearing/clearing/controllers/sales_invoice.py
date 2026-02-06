import frappe
from clearing.api.utils import get_expense_account


def get_item_price_from_price_list(item_code, price_list, currency=None):
    """
    Fetch item price from Item Price list.

    Args:
        item_code: Item code to fetch price for
        price_list: Price list name
        currency: Optional currency filter

    Returns:
        float: Item price or None if not found
    """
    if not price_list or not item_code:
        return None

    filters = {
        "item_code": item_code,
        "price_list": price_list,
        "selling": 1,
    }

    # Add currency filter if provided
    if currency:
        filters["currency"] = currency

    # Get the item price, ordered by valid_from date (most recent first)
    item_prices = frappe.get_all(
        "Item Price",
        filters=filters,
        fields=["price_list_rate"],
        order_by="valid_from desc",
        limit=1,
    )

    if item_prices and len(item_prices) > 0:
        return item_prices[0].get("price_list_rate")

    return None


@frappe.whitelist()
def get_items_from_selected_clearing_charges(
    clearing_charges, company, price_list=None, currency=None
):
    """
    Fetch items from a Clearing Charges document and format them for a Sales Invoice.

    Args:
        clearing_charges: Name of the Clearing Charges document
        company: Company name for account lookups
        price_list: Price list to fetch item rates from
        currency: Currency for price list filtering

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

            # Get the expense account for this charge type (item)
            expense_account = get_expense_account(
                "Clearing Charges", company, currency=clearing_charges_doc.currency
            )

            # Get item details - charge_type is linked to Item doctype
            item_name, uom, standard_rate = frappe.db.get_value(
                "Item", charge.charge_type, ["item_name", "stock_uom", "standard_rate"]
            )

            # Try to get rate from Item Price list first
            rate = get_item_price_from_price_list(
                charge.charge_type, price_list, currency
            )

            # Fall back to standard_rate if no price found in price list
            if rate is None or rate == 0:
                rate = standard_rate or 0

            # Create item dictionary for sales invoice
            item_details = {
                "item_code": charge.charge_type,
                "item_name": item_name or charge.charge_type,
                "qty": 1,  # Will be counted on client side
                "rate": rate,
                "amount": rate,  # 1 * rate
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

            # Also update the Clearing File status to "Payment Pending"
            _update_clearing_file_status(
                cc_doc.clearing_file, "Payment Pending", invoice_name
            )

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

            # Also reset the Clearing File status back to "Cleared" or appropriate status
            _update_clearing_file_status(cc_doc.clearing_file, "Cleared", invoice_name)

            frappe.msgprint(
                f"Clearing Charges {clearing_charges_name} status reset to 'To Bill'",
                alert=True,
            )
    except Exception as e:
        frappe.log_error(
            f"Failed to reset Clearing Charges {clearing_charges_name}: {str(e)}",
            "Clearing Charges Status Reset Error",
        )


def _update_clearing_file_status(clearing_file_name, new_status, reference_doc):
    """Update Clearing File status."""
    if not clearing_file_name:
        return

    try:
        cf_doc = frappe.get_doc("Clearing File", clearing_file_name)

        # Only update if the status is different
        if cf_doc.status != new_status:
            cf_doc.status = new_status
            cf_doc.add_comment(
                "Info", f"Status updated to '{new_status}' via {reference_doc}"
            )
            cf_doc.save(ignore_permissions=True)

            frappe.msgprint(
                f"Clearing File {clearing_file_name} status updated to '{new_status}'",
                alert=True,
            )
    except Exception as e:
        frappe.log_error(
            f"Failed to update Clearing File {clearing_file_name}: {str(e)}",
            "Clearing File Status Update Error",
        )


def handle_sales_invoice_payment_status(sales_invoice, method=None):
    """Handle Sales Invoice status changes, particularly when paid."""
    if not sales_invoice:
        return

    # Check if invoice is now paid
    if sales_invoice.status == "Paid" or sales_invoice.outstanding_amount <= 0:
        # Get clearing charges reference
        clearing_charges_ref = sales_invoice.get("custom_clearing_charges")

        clearing_files_to_update = set()

        if clearing_charges_ref:
            # Direct reference exists
            cc_doc = frappe.get_doc("Clearing Charges", clearing_charges_ref)
            if cc_doc.clearing_file:
                clearing_files_to_update.add(cc_doc.clearing_file)
        else:
            # Find clearing files from items
            for item in sales_invoice.get("items", []):
                clearing_file = item.get("custom_clearing_file")
                if clearing_file:
                    clearing_files_to_update.add(clearing_file)

        # Update all related Clearing Files to "Payment Received"
        for cf_name in clearing_files_to_update:
            _update_clearing_file_status(
                cf_name, "Payment Received", sales_invoice.name
            )


def handle_payment_entry_for_clearing_files(payment_entry, method=None):
    """Handle Payment Entry submission to update Clearing File status when invoice is paid."""
    if not payment_entry or payment_entry.payment_type != "Receive":
        return

    # Get all Sales Invoice references from this payment entry
    clearing_files_to_update = set()

    for reference in payment_entry.get("references", []):
        if reference.reference_doctype == "Sales Invoice":
            invoice_name = reference.reference_name

            # Check if this invoice is now fully paid
            invoice = frappe.get_doc("Sales Invoice", invoice_name)

            if invoice.outstanding_amount <= 0:
                # Invoice is fully paid, find clearing files
                clearing_charges_ref = invoice.get("custom_clearing_charges")

                if clearing_charges_ref:
                    cc_doc = frappe.get_doc("Clearing Charges", clearing_charges_ref)
                    if cc_doc.clearing_file:
                        clearing_files_to_update.add(cc_doc.clearing_file)
                else:
                    # Find from items
                    for item in invoice.get("items", []):
                        clearing_file = item.get("custom_clearing_file")
                        if clearing_file:
                            clearing_files_to_update.add(clearing_file)

    # Update all clearing files to "Payment Received"
    for cf_name in clearing_files_to_update:
        _update_clearing_file_status(cf_name, "Payment Received", payment_entry.name)


def handle_payment_entry_cancel_for_clearing_files(payment_entry, method=None):
    """Handle Payment Entry cancellation to revert Clearing File status."""
    if not payment_entry or payment_entry.payment_type != "Receive":
        return

    # Get all Sales Invoice references from this payment entry
    clearing_files_to_revert = set()

    for reference in payment_entry.get("references", []):
        if reference.reference_doctype == "Sales Invoice":
            invoice_name = reference.reference_name

            # Reload invoice to check current outstanding
            invoice = frappe.get_doc("Sales Invoice", invoice_name)

            # If invoice has outstanding amount after cancellation, revert status
            if invoice.outstanding_amount > 0:
                clearing_charges_ref = invoice.get("custom_clearing_charges")

                if clearing_charges_ref:
                    cc_doc = frappe.get_doc("Clearing Charges", clearing_charges_ref)
                    if cc_doc.clearing_file:
                        clearing_files_to_revert.add(cc_doc.clearing_file)
                else:
                    # Find from items
                    for item in invoice.get("items", []):
                        clearing_file = item.get("custom_clearing_file")
                        if clearing_file:
                            clearing_files_to_revert.add(clearing_file)

    # Revert clearing files to "Payment Pending"
    for cf_name in clearing_files_to_revert:
        _update_clearing_file_status(
            cf_name,
            "Payment Pending",
            f"Payment Entry {payment_entry.name} (Cancelled)",
        )
