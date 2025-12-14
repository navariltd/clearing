import frappe


@frappe.whitelist()
def get_required_documents_by_type(mode: str, document_type: str) -> list:
    """
    Generic function to fetch required documents based on mode of transport and document type.

    Args:
        mode: Mode of transport (e.g., "Air", "Sea")
        document_type: The parentfield value (e.g., "clearing_file_document", "tra_clearance_document")

    Returns:
        List of required clearing document types
    """
    if not mode or not document_type:
        return []

    required_documents = frappe.get_all(
        "Mode of Transport Detail",
        filters={
            "parent": mode,
            "parenttype": "Mode of Transport",
            "parentfield": document_type,
        },
        fields=["clearing_document_type"],
        pluck="clearing_document_type",
    )

    return required_documents


@frappe.whitelist()
def get_required_document_types_by_mode(mode: str) -> list:
    """Get required clearing file documents by mode of transport."""
    return get_required_documents_by_type(mode, "clearing_file_document")


@frappe.whitelist()
def get_required_tra_clearing_documents(mode: str) -> list:
    """Get required TRA clearance documents by mode of transport."""
    return get_required_documents_by_type(mode, "tra_clearance_document")


@frappe.whitelist()
def get_required_physical_verification_documents(mode: str) -> list:
    """Get required physical verification documents by mode of transport."""
    return get_required_documents_by_type(mode, "physical_verification_document")


@frappe.whitelist()
def get_required_port_clearance_documents(mode: str) -> list:
    """Get required port clearance documents by mode of transport."""
    return get_required_documents_by_type(mode, "port_clearance_document")


@frappe.whitelist()
def get_required_shipping_line_clearance_documents(mode: str) -> list:
    """Get required shipping line clearance documents by mode of transport."""
    return get_required_documents_by_type(mode, "shipping_line_clearance_document")
