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
            "fieldname": "name",
            "label": _("Clearing File"),
            "fieldtype": "Link",
            "options": "Clearing File",
            "width": 150,
        },
        {
            "fieldname": "status",
            "label": _("Status"),
            "fieldtype": "Data",
            "width": 100,
        },
        {
            "fieldname": "customer",
            "label": _("Customer"),
            "fieldtype": "Link",
            "options": "Customer",
            "width": 150,
        },
        {
            "fieldname": "tancis_lodging_date",
            "label": _("Lodging Date"),
            "fieldtype": "Date",
            "width": 150,
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
            "fieldname": "total_weight",
            "label": _("Total Weight (Kg)"),
            "fieldtype": "Float",
            "width": 120,
        },
        {
            "fieldname": "total_volume",
            "label": _("Total Volume (CBM)"),
            "fieldtype": "Float",
            "width": 130,
        },
        {
            "fieldname": "clearing_charges",
            "label": _("Clearing Charges"),
            "fieldtype": "Link",
            "options": "Clearing Charges",
            "width": 200,
        },
        {
            "fieldname": "currency",
            "label": _("Currency"),
            "fieldtype": "Data",
            "width": 100,
        },
        {
            "fieldname": "total_debit",
            "label": _("Total Invoice Charges"),
            "fieldtype": "Currency",
            "width": 150,
        },
        {
            "fieldname": "custom_t1_ref__no",
            "label": _("T1 Ref No"),
            "fieldtype": "Data",
            "width": 100,
        },
    ]


def get_data(filters):
    conditions = get_conditions(filters)

    data = frappe.db.sql(
        """
        SELECT 
            cf.name,
            cf.tancis_lodging_date,
            cf.tansad_no,
            cf.status,
            cf.customer,
            cf.road_consignment,
            cf.cargo_description,
            cf.total_weight,
            cf.total_volume,
            cc.currency,
            cc.name as clearing_charges,
            cc.total_debit,
            tc.custom_t1_ref__no
        FROM 
            `tabClearing File` cf
        LEFT JOIN 
            `tabClearing Charges` cc ON cc.clearing_file = cf.name
        LEFT JOIN 
            `tabTRA Clearance` tc ON tc.clearing_file = cf.name
        WHERE 
            cc.docstatus = 1
            {conditions}
        ORDER BY 
            cf.tancis_lodging_date DESC, cf.name DESC
        """.format(
            conditions=conditions
        ),
        filters,
        as_dict=1,
    )

    return data


def get_conditions(filters):
    conditions = []

    if filters.get("company"):
        conditions.append("cf.company = %(company)s")

    if filters.get("from_date"):
        conditions.append("cf.tancis_lodging_date >= %(from_date)s")

    if filters.get("to_date"):
        conditions.append("cf.tancis_lodging_date <= %(to_date)s")

    if filters.get("status"):
        conditions.append("cf.status = %(status)s")

    if filters.get("customer"):
        conditions.append("cf.customer = %(customer)s")

    if filters.get("clearing_file"):
        conditions.append("cf.name = %(clearing_file)s")

    if filters.get("road_consignment"):
        conditions.append("cf.road_consignment LIKE %(road_consignment)s")

    return " AND " + " AND ".join(conditions) if conditions else ""
