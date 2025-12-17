import frappe


def execute():
    """
    Add custom field to Sales Invoice to store Clearing Charges reference.
    This enables automatic status update when invoice is submitted.
    """
    if frappe.db.exists("Custom Field", "Sales Invoice-custom_clearing_charges"):
        return

    custom_field = frappe.get_doc(
        {
            "doctype": "Custom Field",
            "dt": "Sales Invoice",
            "fieldname": "custom_clearing_charges",
            "label": "Clearing Charges",
            "fieldtype": "Link",
            "options": "Clearing Charges",
            "insert_after": "customer",
            "read_only": 1,
            "allow_on_submit": 0,
            "hidden": 0,
            "print_hide": 1,
            "report_hide": 0,
            "module": "Clearing",
        }
    )

    custom_field.insert(ignore_permissions=True)
    frappe.db.commit()

    frappe.msgprint("Custom field 'Clearing Charges' added to Sales Invoice")
