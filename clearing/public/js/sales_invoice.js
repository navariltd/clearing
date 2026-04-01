frappe.ui.form.on("Sales Invoice", {
  refresh: function (frm) {
    // Custom button to fetch items from Clearing Charges
    if (frm.doc.docstatus === 0) {
      frm.add_custom_button(
        __("Clearing Charges"),
        function () {
          // Open a dialog to select Clearing Charges using MultiSelectDialog
          new frappe.ui.form.MultiSelectDialog({
            doctype: "Clearing Charges",
            target: frm,
            setters: {
              consigee: frm.doc.customer || "",
              clearing_file: "",
              custom_product: "",
              status: "To Bill",
            },
            add_filters_group: 1,
            date_field: "modified",
            get_query() {
              let filters = {
                docstatus: 1, // Only submitted Clearing Charges
                status: "To Bill", // Only those not yet billed
              };

              // Add customer filter if set in the invoice
              if (frm.doc.customer) {
                filters.consigee = frm.doc.customer;
              }

              return {
                filters: filters,
              };
            },
            action(selections) {
              if (selections && selections.length > 0) {
                if (!frm.doc.company) {
                  frappe.msgprint({
                    title: __("Error"),
                    indicator: "red",
                    message: __("Please set the Company first"),
                  });
                  return;
                }

                // Dictionary to aggregate items across all selections
                let all_items = [];
                let clearing_details_list = [];
                let processed_count = 0;

                // Process each selected Clearing Charges document
                selections.forEach(function (clearing_charges) {
                  frappe.call({
                    method:
                      "clearing.clearing.controllers.sales_invoice.get_items_from_selected_clearing_charges",
                    args: {
                      clearing_charges: clearing_charges,
                      company: frm.doc.company,
                      price_list: frm.doc.selling_price_list || "",
                      currency: frm.doc.currency || "",
                    },
                    callback: function (response) {
                      if (response && response.message) {
                        const data = response.message;

                        // Store clearing details
                        clearing_details_list.push(data.clearing_details);

                        // Collect all items without grouping
                        data.sales_invoice_items.forEach((item) => {
                          all_items.push(item);
                        });

                        processed_count++;

                        // Once all selections are processed, add items to invoice
                        if (processed_count === selections.length) {
                          // Add all items to Sales Invoice
                          all_items.forEach((item) => {
                            var new_item = frm.add_child("items");
                            new_item.item_code = item.item_code;
                            new_item.item_name = item.item_name;
                            new_item.qty = item.qty;
                            new_item.rate = item.rate;
                            new_item.uom = item.uom;
                            new_item.income_account = item.income_account;
                            new_item.expense_account = item.expense_account;
                            new_item.conversion_factor = 1;
                            new_item.custom_clearing_file =
                              item.custom_clearing_file || "";
                            new_item.custom_truck_number =
                              item.custom_truck_number || "";
                          });

                          // Set clearing details from first selection
                          if (clearing_details_list.length > 0) {
                            const first_details = clearing_details_list[0];

                            // Set customer if not already set
                            if (!frm.doc.customer && first_details.customer) {
                              frm.set_value("customer", first_details.customer);
                            }

                            // Set currency if not already set
                            if (!frm.doc.currency && first_details.currency) {
                              frm.set_value("currency", first_details.currency);
                            }

                            // Store reference to first Clearing Charges for status update
                            if (frm.fields_dict.custom_clearing_charges) {
                              frm.set_value(
                                "custom_clearing_charges",
                                first_details.clearing_charges,
                              );
                            }
                          }

                          frm.refresh_field("items");
                          frm.refresh();

                          frappe.show_alert({
                            message: __(
                              "Items fetched from {0} Clearing Charges document(s)",
                              [selections.length],
                            ),
                            indicator: "green",
                          });
                        }
                      } else {
                        frappe.msgprint({
                          title: __("Error"),
                          indicator: "red",
                          message: __("Failed to fetch items from {0}", [
                            clearing_charges,
                          ]),
                        });
                      }
                    },
                    error: function (err) {
                      frappe.msgprint({
                        title: __("Error"),
                        indicator: "red",
                        message: __("Error fetching items from {0}: {1}", [
                          clearing_charges,
                          err.message || "Unknown error",
                        ]),
                      });
                    },
                  });
                });
              } else {
                frappe.msgprint(__("No Clearing Charges selected"));
              }
              cur_dialog.hide();
            },
          });
        },
        __("Get Items From"),
      );

      // Custom button to fetch service charges from Clearing Files
      frm.add_custom_button(
        __("Clearing Files"),
        function () {
          // Open a dialog to select Clearing Files using MultiSelectDialog
          new frappe.ui.form.MultiSelectDialog({
            doctype: "Clearing File",
            target: frm,
            setters: {
              customer: frm.doc.customer || "",
              status: ["in", ["Cleared", "Delivered", "Charges Pending"]],
            },
            add_filters_group: 1,
            date_field: "modified",
            get_query() {
              let filters = {
                docstatus: ["<", 2], // Draft or submitted
                status: ["in", ["Cleared", "Delivered", "Charges Pending"]],
              };

              // Add customer filter if set in the invoice
              if (frm.doc.customer) {
                filters.customer = frm.doc.customer;
              }

              return {
                filters: filters,
              };
            },
            action(selections) {
              if (selections && selections.length > 0) {
                if (!frm.doc.company) {
                  frappe.msgprint({
                    title: __("Error"),
                    indicator: "red",
                    message: __("Please set the Company first"),
                  });
                  return;
                }

                frappe.call({
                  method:
                    "clearing.clearing.controllers.sales_invoice.get_items_from_selected_clearing_files",
                  args: {
                    clearing_files: selections,
                    company: frm.doc.company,
                    price_list: frm.doc.selling_price_list || "",
                    currency: frm.doc.currency || "",
                  },
                  callback: function (response) {
                    if (response && response.message) {
                      const data = response.message;
                      const items = data.sales_invoice_items || [];
                      const clearing_details = data.clearing_details || {};

                      if (items.length === 0) {
                        frappe.msgprint({
                          title: __("No Items"),
                          indicator: "blue",
                          message: __(
                            "No service charges found in the selected Clearing Files",
                          ),
                        });
                        return;
                      }

                      // Add all items to Sales Invoice
                      items.forEach((item) => {
                        var new_item = frm.add_child("items");
                        new_item.item_code = item.item_code;
                        new_item.item_name = item.item_name;
                        new_item.qty = item.qty;
                        new_item.rate = item.rate;
                        new_item.uom = item.uom;
                        new_item.income_account = item.income_account;
                        new_item.expense_account = item.expense_account;
                        new_item.conversion_factor = 1;
                        new_item.custom_clearing_file =
                          item.custom_clearing_file || "";
                        new_item.custom_truck_number =
                          item.custom_truck_number || "";
                      });

                      // Set clearing details from first selection
                      if (clearing_details && clearing_details.clearing_file) {
                        // Set customer if not already set
                        if (!frm.doc.customer && clearing_details.customer) {
                          frm.set_value("customer", clearing_details.customer);
                        }

                        // Set currency if not already set
                        if (!frm.doc.currency && clearing_details.currency) {
                          frm.set_value("currency", clearing_details.currency);
                        }
                      }

                      frm.refresh_field("items");
                      frm.refresh();

                      frappe.show_alert({
                        message: __(
                          "Service charges fetched from {0} Clearing File(s)",
                          [selections.length],
                        ),
                        indicator: "green",
                      });
                    } else {
                      frappe.msgprint({
                        title: __("Error"),
                        indicator: "red",
                        message: __(
                          "Failed to fetch items from Clearing Files",
                        ),
                      });
                    }
                  },
                  error: function (err) {
                    frappe.msgprint({
                      title: __("Error"),
                      indicator: "red",
                      message: __(
                        "Error fetching items from Clearing Files: {0}",
                        [err.message || "Unknown error"],
                      ),
                    });
                  },
                });
              } else {
                frappe.msgprint(__("No Clearing Files selected"));
              }
              cur_dialog.hide();
            },
          });
        },
        __("Get Items From"),
      );
    }
  },
});
