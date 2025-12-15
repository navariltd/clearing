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
              clearing_file: "",
              status: "Pending Payment",
            },
            add_filters_group: 1,
            date_field: "modified",
            get_query() {
              return {
                filters: {
                  status: "Pending Payment", // Only submitted Clearing Charges
                },
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

                // Process each selected Clearing Charges document
                selections.forEach(function (clearing_charges) {
                  frappe.call({
                    method:
                      "clearing.clearing.controllers.sales_invoice.get_items_from_selected_clearing_charges",
                    args: {
                      clearing_charges: clearing_charges,
                      company: frm.doc.company,
                    },
                    callback: function (response) {
                      if (response && response.message) {
                        const data = response.message;

                        // Add items to Sales Invoice
                        data.sales_invoice_items.forEach((item) => {
                          var new_item = frm.add_child("items");
                          new_item.item_code = item.item_code;
                          new_item.item_name = item.item_name;
                          new_item.qty = item.qty;
                          new_item.rate = item.rate;
                          new_item.amount = item.amount;
                          new_item.expense_account = item.expense_account;
                          new_item.custom_clearing_file =
                            item.custom_clearing_file;
                          new_item.truck_number =
                            item.truck_number;
                        });

                        // Set clearing details on the Sales Invoice header
                        const clearing_details = data.clearing_details;

                        // Set customer if not already set
                        if (!frm.doc.customer && clearing_details.customer) {
                          frm.set_value("customer", clearing_details.customer);
                        }

                        // Set currency if not already set
                        if (!frm.doc.currency && clearing_details.currency) {
                          frm.set_value("currency", clearing_details.currency);
                        }

                        frm.refresh_field("items");
                        frm.refresh();

                        frappe.show_alert({
                          message: __("Items fetched from {0}", [
                            clearing_charges,
                          ]),
                          indicator: "green",
                        });
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
        __("Get Items From")
      );
    }
  },
});
