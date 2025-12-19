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
                let items_dict = {};
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
                    },
                    callback: function (response) {
                      if (response && response.message) {
                        const data = response.message;

                        // Store clearing details
                        clearing_details_list.push(data.clearing_details);

                        // Aggregate items by item_code
                        data.sales_invoice_items.forEach((item) => {
                          if (items_dict[item.item_code]) {
                            // Item already exists, increment qty and add to total amount
                            items_dict[item.item_code].qty += item.qty;
                            items_dict[item.item_code].total_amount +=
                              item.amount;
                            // Track clearing files
                            if (
                              item.custom_clearing_file &&
                              !items_dict[
                                item.item_code
                              ].clearing_files.includes(
                                item.custom_clearing_file
                              )
                            ) {
                              items_dict[item.item_code].clearing_files.push(
                                item.custom_clearing_file
                              );
                            }
                          } else {
                            // New item, initialize
                            items_dict[item.item_code] = {
                              item_code: item.item_code,
                              item_name: item.item_name,
                              qty: item.qty,
                              total_amount: item.amount,
                              uom: item.uom,
                              income_account: item.income_account,
                              expense_account: item.expense_account,
                              clearing_files: item.custom_clearing_file
                                ? [item.custom_clearing_file]
                                : [],
                            };
                          }
                        });

                        processed_count++;

                        // Once all selections are processed, add aggregated items to invoice
                        if (processed_count === selections.length) {
                          // Add aggregated items to Sales Invoice
                          for (let item_code in items_dict) {
                            let item_data = items_dict[item_code];
                            let total_amount = item_data.total_amount;

                            var new_item = frm.add_child("items");
                            new_item.item_code = item_data.item_code;
                            new_item.item_name = item_data.item_name;
                            new_item.qty = 1;
                            new_item.rate = total_amount;
                            new_item.uom = item_data.uom;
                            new_item.income_account = item_data.income_account;
                            new_item.expense_account =
                              item_data.expense_account;
                            new_item.conversion_factor = 1;

                            // Set clearing file (first one if multiple)
                            if (item_data.clearing_files.length > 0) {
                              new_item.custom_clearing_file =
                                item_data.clearing_files[0];
                            }
                          }

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
                                first_details.clearing_charges
                              );
                            }
                          }

                          frm.refresh_field("items");
                          frm.refresh();

                          frappe.show_alert({
                            message: __(
                              "Items fetched from {0} Clearing Charges document(s)",
                              [selections.length]
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
        __("Get Items From")
      );
    }
  },
});
