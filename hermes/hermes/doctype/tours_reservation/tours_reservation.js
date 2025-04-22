// Copyright (c) 2025, aet and contributors
// For license information, please see license.txt

frappe.ui.form.on("Tours Reservation", {
	amount_paid: function(frm) {
		calculate_total_pending(frm);        
	},
    tours_detail: {
        tour: function(frm, cdt, cdn) {
            let tour_field = frm.fields_dict['Tour Detail'].grid.get_field('tour');

            tour_field.get_query = function(doc, cdt, cdn) {
                return {
                    filters: {
                        'active': 1
                    }
                };
            };
        }
    },

    reservation_room: function(frm) {
        if (frm.doc.customer) {
            console.log("working");
            
            // Use frappe.db.get_value to fetch a related document from Reservation based on the customer
            frappe.db.get_value('reservation', { 'cliente': frm.doc.customer }, 'name', function(value) {
                if (value && value.name) {
                    console.log("working2");
                    frm.set_value('link_psta', value.name);
                } else {
                    console.log("working3");
                    frm.set_value('link_psta', '');
                }
            });
        } else {
            frm.set_value('link_psta', '');
        }
    }
});

frappe.ui.form.on('Tour Detail', {
	price_per_tour(frm, cdt, cdn) {
		calculate_total(frm);
	},
    
});

function calculate_total(frm) {
	let total = 0;
	(frm.doc.tours_detail || []).forEach(row => {
		total += flt(row.price_per_tour);
	});
	frm.set_value('total_cost', total);

}
function calculate_total_pending(frm) {
    let total_amount = flt(frm.doc.total_cost);
    let total_paid = flt(frm.doc.amount_paid);
    let pending_amount = total_amount - total_paid;
    frm.set_value('outstanding_balance', pending_amount);
}

