
frappe.ui.form.on("Calendar View", {
	reference_doctype: function (frm) {
		const { reference_doctype } = frm.doc;
		if (!reference_doctype) return;
        console.log("Aasds");
        

		frappe.model.with_doctype(reference_doctype, () => {
			const meta = frappe.get_meta(reference_doctype);

            const subject_options = meta.fields
				.filter((df) => !frappe.model.no_value_type.includes(df.fieldtype))
				.map((df) => df.fieldname);

			frm.fields_dict.custom_extra_fields.grid.update_docfield_property("field_name", "options", [""].concat(subject_options));

			frm.refresh();
		});
	},
});