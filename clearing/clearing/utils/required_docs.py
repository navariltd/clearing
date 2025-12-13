import frappe


# TODO: Refactore to a single function with document type as parameter
@frappe.whitelist()
def get_required_document_types_by_mode(mode: str) -> list:
    if not mode:
        return []

    clearing_file_documents = frappe.get_all(
        "Mode of Transport Detail",
        filters={
            "parent": mode,
            "parenttype": "Mode of Transport",
            "parentfield": "clearing_file_document",
        },
        fields=["clearing_document_type"],
        pluck="clearing_document_type",
    )

    return clearing_file_documents


@frappe.whitelist()
def get_required_tra_clearing_documents(mode: str) -> list:
    if not mode:
        return []

    tra_clearing_documents = frappe.get_all(
        "Mode of Transport Detail",
        filters={
            "parent": mode,
            "parenttype": "Mode of Transport",
            "parentfield": "tra_clearance_document",
        },
        fields=["clearing_document_type"],
        pluck="clearing_document_type",
    )
    return tra_clearing_documents

@frappe.whitelist()
def get_required_physical_verification_documents(mode: str) -> list:
    if not mode:
        return []

    tra_clearing_documents = frappe.get_all(
        "Mode of Transport Detail",
        filters={
            "parent": mode,
            "parenttype": "Mode of Transport",
            "parentfield": "physical_verification_document",
        },
        fields=["clearing_document_type"],
        pluck="clearing_document_type",
    )
    return tra_clearing_documents
