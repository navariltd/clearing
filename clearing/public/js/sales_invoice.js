frappe.ui.form.on("Sales Invoice", {
  validate: function (frm) {
    // Group and deduplicate sales invoice items
    if (frm.doc.items && frm.doc.items.length > 0) {
      let items_dict = {};

      // Group items by item_code
      frm.doc.items.forEach((item) => {
        if (items_dict[item.item_code]) {
          items_dict[item.item_code].qty += item.qty || 0;
        } else {
          items_dict[item.item_code] = {
            item_code: item.item_code,
            item_name: item.item_name,
            qty: item.qty || 0,
            rate: item.rate || 0,
            uom: item.uom,
            income_account: item.income_account,
            expense_account: item.expense_account,
            conversion_factor: item.conversion_factor || 1,
            custom_clearing_file: item.custom_clearing_file || "",
            custom_truck_number: item.custom_truck_number || "",
          };
        }
      });

      // Check if grouping actually removed duplicates
      let unique_items = Object.keys(items_dict).length;
      if (unique_items < frm.doc.items.length) {
        frm.clear_table("items");

        Object.values(items_dict).forEach((item) => {
          let new_row = frm.add_child("items");
          new_row.item_code = item.item_code;
          new_row.item_name = item.item_name;
          new_row.qty = item.qty;
          new_row.rate = item.rate;
          new_row.uom = item.uom;
          new_row.income_account = item.income_account;
          new_row.expense_account = item.expense_account;
          new_row.conversion_factor = item.conversion_factor;
          new_row.custom_clearing_file = item.custom_clearing_file;
          new_row.custom_truck_number = item.custom_truck_number;
        });

        frm.refresh_field("items");
      }
    }
  },

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
