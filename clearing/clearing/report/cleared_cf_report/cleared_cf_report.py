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
            "fieldname": "arrival_date",
            "label": _("Arrival Date (ETA)"),
            "fieldtype": "Date",
            "width": 150,    
        },
        {
            "fieldname": "name",
            "label": _("Clearing File"),
            "fieldtype": "Link",
            "options": "Clearing File",
            "width": 150,
        },
        {
            "fieldname": "status",
            "label": _("CF Status"),
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
            "fieldname": "custom_t1_ref__no",
            "label": _("T1 Ref No"),
            "fieldtype": "Data",
            "width": 100,
        },
        {
            "fieldname": "physical_verification",
            "label": _("Physical Verification"),
            "fieldtype": "Link",
            "options": "Physical Verification",
            "width": 150,
        },
        {
            "fieldname": "physical_verification_date",
            "label": _("Physical Verification Date"),
            "fieldtype": "Date",
            "width": 150,
        },
    ]


def get_data(filters):
    conditions = get_conditions(filters)
    where_clause = "WHERE " + conditions if conditions else ""

    data = frappe.db.sql(
        """
        SELECT 
            cf.arrival_date,
            cf.name,
            cf.tancis_lodging_date,
            cf.tansad_no,
            cf.status,
            cf.customer,
            cf.road_consignment,
            cf.cargo_description,
            cf.total_weight,
            cf.total_volume,
            tc.custom_t1_ref__no,
            pv.name AS physical_verification,
            pv.posting_date AS physical_verification_date
        FROM 
            `tabClearing File` cf
        LEFT JOIN 
            `tabTRA Clearance` tc ON tc.clearing_file = cf.name
        LEFT JOIN 
            `tabPhysical Verification` pv ON pv.clearing_file = cf.name
        {where_clause}
        ORDER BY 
            cf.tancis_lodging_date DESC, cf.name DESC
        """.format(
            where_clause=where_clause
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

    return " AND ".join(conditions) if conditions else ""
