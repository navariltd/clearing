frappe.require("/assets/clearing/js/stage_journal.js");

frappe.ui.form.on("TRA Clearance", {
  refresh(frm) {
    // Check TRA documents status on refresh
    check_tra_documents_status(frm);

    // Fetch the Clearing File document to get its status
    if (frm.doc.clearing_file) {
      frappe.call({
        method: "frappe.client.get",
        args: {
          doctype: "Clearing File",
          name: frm.doc.clearing_file,
        },
        callback: function (r) {
          if (r.message) {
            const clearing_file_status = r.message.status;
            const mode_of_transport = r.message.mode_of_transport;

            // Add conditional buttons based on the Clearing File status
            if (
              mode_of_transport !== "Air" &&
              (clearing_file_status === "Pre-Lodged" ||
                clearing_file_status === "On Process")
            ) {
              handle_clearance_creation(
                "Shipping Line Clearance",
                "Shipping Line Clearance",
                { clearing_file: frm.doc.clearing_file },
                {
                  doctype: "Shipping Line Clearance",
                  clearing_file: frm.doc.clearing_file,
                  customer: frm.doc.customer,
                  status: "Unpaid",
                },
                "Shipping Line Clearance created successfully"
              );
            }
            // Port Clearance button
            let port_clearance_data = {
              doctype: "Port Clearance",
              clearing_file: frm.doc.clearing_file,
              customer: frm.doc.customer,
              status: "Unpaid",
            };

            // Physical Verification button
            handle_clearance_creation(
              "Physical Verification",
              "Physical Verification",
              { clearing_file: frm.doc.clearing_file },
              {
                doctype: "Physical Verification",
                clearing_file: frm.doc.clearing_file,
                customer: frm.doc.customer,
                status: "Payment Pending",
              },
              "Physical Verification created successfully"
            );

            // Auto-check has_transit_bond for IM8 declaration type
            if (r.message.declaration_type === "IM8 TRANSIT AND TRANSHIPMENT") {
              port_clearance_data.has_transit_bond = 1;
            }

            handle_clearance_creation(
              "Port Clearance",
              "Port Clearance",
              { clearing_file: frm.doc.clearing_file },
              port_clearance_data,
              "Port Clearance created successfully"
            );

            // Refresh buttons display
            frm.refresh_fields();
          }
        },
      });
    }

    // Update the "Attach Documents" button to be primary
    const container = document.querySelector(
      '[data-fieldname="attach_documents"]'
    );
    if (container) {
      const button = container.querySelector("button");
      if (button) {
        button.className = "btn btn-xs btn-default bold btn-primary";
      }
    }

    // Helper function to create or redirect to documents
    function handle_clearance_creation(
      doctype,
      label,
      filters,
      new_doc_data,
      success_message
    ) {
      frm.add_custom_button(
        __(label),
        function () {
          frappe.call({
            method: "frappe.client.get_list",
            args: {
              doctype: doctype,
              filters: filters,
              limit: 1,
            },
            callback: function (r) {
              if (r.message && r.message.length > 0) {
                // Document exists, open it
                frappe.set_route("Form", doctype, r.message[0].name);
              } else {
                // Create a new unsaved document
                let new_doc = frappe.model.get_new_doc(doctype);

                // Set the basic fields
                Object.assign(new_doc, new_doc_data);

                // Open the new document form without saving
                frappe.set_route("Form", doctype, new_doc.name);

                frappe.msgprint(
                  __(
                    success_message +
                      " Please fill in the required fields and save."
                  )
                );
              }
            },
          });
        },
        null,
        "primary"
      ); // Make the button primary
    }
  },

  clearing_file: function (frm) {
    // Refresh document status when clearing file changes
    check_tra_documents_status(frm);
  },

  async make_journal(frm) {
    await frappe.require("/assets/clearing/js/stage_journal.js");
    await clearing.stageJournal.handle(frm, {
      tableField: "tra_charges",
      serverMethod:
        "clearing.clearing.doctype.tra_clearance.tra_clearance.make_journal_entries",
    });
  },

  attach_documents: function (frm) {
    if (frm.doc.__unsaved) {
      frappe.msgprint(
        __("Please save the document before attaching documents.")
      );
      return;
    }

    // Create the dialog for document attachment
    let d = new frappe.ui.Dialog({
      title: "Attach Clearing Document",
      fields: [
        {
          label: "Document Type",
          fieldname: "document_type",
          fieldtype: "Link",
          options: "Clearing Document Type",
          change: function () {
            let document_type = d.get_value("document_type");
            if (document_type) {
              frappe.call({
                method: "frappe.client.get",
                args: {
                  doctype: "Clearing Document Type",
                  name: document_type,
                },
                callback: function (r) {
                  if (r.message && r.message.clearing_document_attribute) {
                    let attributes_table = d.get_field(
                      "document_attributes"
                    ).grid;
                    attributes_table.df.data = []; // Clear existing data
                    attributes_table.refresh();

                    // Populate table with attributes
                    r.message.clearing_document_attribute.forEach(
                      (aattribute) => {
                        d.fields_dict.document_attributes.df.data.push({
                          attribute: aattribute.document_attribute,
                          mandatory: aattribute.mandatory,
                          value: "",
                        });
                      }
                    );
                    attributes_table.refresh();
                  } else {
                    frappe.msgprint(
                      __("No attributes found for the selected document type.")
                    );
                  }
                },
                error: function (err) {
                  console.error(
                    "Error fetching document type attributes:",
                    err
                  );
                  frappe.msgprint(
                    __(
                      "Failed to retrieve document attributes. Please try again."
                    )
                  );
                },
              });
            }
          },
        },
        { fieldname: "attach_document", fieldtype: "Column Break" },
        {
          label: "Attach Document",
          fieldname: "attach_document",
          fieldtype: "Attach",
        },
        { fieldname: "attach_document", fieldtype: "Section Break" },
        {
          label: "Document Attributes",
          fieldname: "document_attributes",
          fieldtype: "Table",
          options: "Clearing Document Attribute",
          fields: [
            {
              fieldname: "attribute",
              label: "Attribute",
              fieldtype: "Data",
              in_list_view: 1,
            },
            {
              fieldname: "value",
              label: "Value",
              fieldtype: "Data",
              in_list_view: 1,
            },
            {
              fieldname: "mandatory",
              label: "Mandatory",
              fieldtype: "Check",
              in_list_view: 1,
              read_only: 1,
            },
          ],
        },
      ],
      size: "large",
      primary_action_label: "Submit",
      primary_action(values) {
        let attachment_url = document
          .querySelector(".attached-file-link")
          .getAttribute("href");

        // Validate mandatory fields - ADD SAFETY CHECK
        let invalid = false;
        const attributes = values.document_attributes || []; // Default to empty array

        attributes.forEach((attr) => {
          if (attr.mandatory && !attr.value) {
            invalid = true;
            frappe.msgprint({
              title: __("Missing Value"),
              message: __("Please fill the value for {0} as it is mandatory.", [
                attr.attribute,
              ]),
              indicator: "red",
            });
          }
        });

        // If validation fails, stop submission
        if (invalid) return;

        // Prepare the child table data
        let clearing_document_attributes = attributes.map((attr) => ({
          document_attribute: attr.attribute,
          document_attribute_value: attr.value,
          mandatory: attr.mandatory,
        }));

        // Use Frappe API to create the document
        frappe.call({
          method: "frappe.client.insert",
          args: {
            doc: {
              doctype: "Clearing Document",
              clearing_file: frm.doc.clearing_file,
              document_attachment: attachment_url,
              clearing_document_type: values.document_type,
              linked_file: "TRA Clearance",
              document_type: values.document_type,
              clearing_document_attributes: clearing_document_attributes,
            },
          },
          callback: function (response) {
            if (response && response.message) {
              frappe.msgprint(__("Clearing Document created successfully."));
              d.hide();

              // Update has_any_doc_attachments field to 1
              frappe.call({
                method: "frappe.client.set_value",
                args: {
                  doctype: "TRA Clearance",
                  name: frm.doc.name,
                  fieldname: "has_any_doc_attachments",
                  value: 1,
                },
                callback: function () {
                  frm.reload_doc();

                  // Check document status after successful attachment
                  setTimeout(() => check_tra_documents_status(frm), 500);
                },
              });
            } else {
              console.error("Failed to create Clearing Document.");
              frappe.msgprint(
                __(
                  "There was an issue creating the Clearing Document. Please try again."
                )
              );
            }
          },
          error: function (err) {
            console.error("Error during document creation:", err);
            frappe.msgprint(
              __("Failed to create Clearing Document. Please try again.")
            );
          },
        });
      },
    });

    // Set a query to filter "Document Type" where linked_document = "TRA Clearance"
    d.fields_dict.document_type.get_query = function () {
      return {
        filters: {
          linked_document: "TRA Clearance",
        },
      };
    };

    d.show();
  },
});

// Trigger document check when documents are added/removed
frappe.ui.form.on("TRA Clearance Document", {
  document_name: function (frm) {
    check_tra_documents_status(frm);
  },

  tra_clearance_document_remove: function (frm) {
    setTimeout(() => check_tra_documents_status(frm), 100);
  },
});

function get_required_tra_documents_js(mode_of_transport, callback) {
  if (!mode_of_transport) {
    if (callback) callback([]);
    return;
  }

  frappe.call({
    method:
      "clearing.clearing.utils.required_docs.get_required_tra_clearing_documents",
    args: {
      mode: mode_of_transport,
    },
    callback: function (r) {
      const required_docs = r.message || [];
      if (callback) callback(required_docs);
    },
  });
}

function check_tra_documents_status(frm) {
  if (!frm || !frm.doc) {
    return;
  }

  // Only show after TRA Clearance is saved
  if (frm.is_new && frm.is_new()) {
    clear_tra_document_alert(frm);
    return;
  }

  if (!frm.doc.clearing_file) {
    clear_tra_document_alert(frm);
    return;
  }

  // Use callback to handle async response
  get_required_tra_documents_js(
    frm.doc.mode_of_transport,
    function (requiredDocs) {
      const attachedDocs = (frm.doc.document || [])
        .map((row) => row.document_name)
        .filter(Boolean);

      const missingDocs = requiredDocs.filter(
        (doc) => !attachedDocs.includes(doc)
      );

      if (missingDocs.length) {
        show_tra_document_alert(
          frm,
          __("Attach the following TRA clearance documents: {0}", [
            missingDocs.join(", "),
          ]),
          "yellow"
        );
        frm.__all_tra_docs_alert_shown = false;
      } else {
        clear_tra_document_alert(frm);
        if (!frm.__all_tra_docs_alert_shown) {
          frappe.show_alert(
            {
              message: __("All required TRA clearance documents are attached."),
              indicator: "green",
            },
            5
          );
          frm.__all_tra_docs_alert_shown = true;
        }
      }
    }
  );
}

function show_tra_document_alert(frm, message, indicator = "yellow") {
  if (!frm || !frm.dashboard) {
    return;
  }

  frm.dashboard.clear_headline();
  frm.dashboard.set_headline_alert(`<div>${message}</div>`, indicator);
}

function clear_tra_document_alert(frm) {
  if (!frm || !frm.dashboard) {
    return;
  }

  frm.dashboard.clear_headline();
  frm.dashboard.clear_comment && frm.dashboard.clear_comment();
}
