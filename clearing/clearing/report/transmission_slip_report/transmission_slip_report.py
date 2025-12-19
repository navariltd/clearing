# Copyright (c) 2025, Nelson Mpanju and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
    columns, data = get_columns(), get_data(filters)
    return columns, data


def get_columns():
    return [
        {
            "fieldname": "name",  # Clearing file name/document id
            "label": _("Clearing File"),
            "fieldtype": "Link",
            "options": "Clearing File",
            "width": 150,
        },
        {
            "fieldname": "tancis_lodging_date",
            "label": _("Lodging Date"),
            "fieldtype": "Date",
            "width": 100,
        },
        {
            "fieldname": "tansad_no",
            "label": _("TR8 Ref No."),
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "fieldname": "road_consignment",
            "label": _("Track Number"),
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "fieldname": "cargo_description",
            "label": _("Product"),
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "fieldname": "currency",
            "label": _("Currency"),
            "fieldtype": "Data",
            "width": 50,
        },
        {
            "fieldname": "clearing_charges",
            "label": _("Clearing Charges"),
            "fieldtype": "Link",
            "options": "Clearing Charges",
            "width": 50,
        },
        {
            "fieldname": "total_debit",
            "label": _("Total Invoice Charges"),
            "fieldtype": "Currency",
            "width": 50,
        },
        {
            "fieldname": "total_debit",
            "label": _("Total Invoice Charges"),
            "fieldtype": "Currency",
            "width": 50,
        },
        {
            "fieldname": "custom_t1_ref__no",
            "label": _("T1 Ref No"),
            "fieldtype": "Data",
            "width": 50,
        },
    ]


def get_data(filters):
    return []
