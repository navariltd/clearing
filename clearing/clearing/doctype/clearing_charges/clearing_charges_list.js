frappe.listview_settings["Clearing Charges"] = {
  add_fields: ["status", "docstatus"],
  has_indicator_for_draft: true,
  get_indicator: function (doc) {
    const status_map = {
      "To Bill": "orange",
      Billed: "green",
    };

    return [__(doc.status), status_map[doc.status], "status,=," + doc.status];
  },
};
