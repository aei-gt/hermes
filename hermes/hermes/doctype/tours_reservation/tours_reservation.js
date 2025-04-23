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

    refresh: function(frm) {
        frm.set_query('tour', 'tours_detail', () => {
            return {
                filters: {
                    active: 1
                }
            };
        });
    },

    customer: function(frm) {
        frm.set_query('link_psta', () => {
            return {
                filters: {
                    cliente: frm.doc.customer
                }
            };
        });
    },

    after_save: function(frm) {
        if (!frm.is_new()) {
            frappe.call({
                method: "hermes.hermes.doctype.tours_reservation.tours_reservation.create_reservation_details",
                args: { reservation_id: frm.doc.name },
                callback: function(response) {
                    if (!response.exc) {
                        // frappe.msgprint(__('Reservation Details Updated successfully'));
                        frm.reload_doc();
                    }
                }
            });
        }
    },
    validate: function(frm) {
        if (!frm.doc.amount_paid) {
            frappe.msgprint(__('Amount Paid is required before saving the document.'));
            frappe.validated = false;
        }
    }


});

frappe.ui.form.on('Tour Detail', {
    total_tour_price(frm, cdt, cdn) {
        calculate_total(frm);
    },

    tour_count: function(frm, cdt, cdn) {
        let row = locals[cdt] && locals[cdt][cdn];

        let count = row.tour_count || 0;
        let price = row.price_per_tour || 0;
        let total = count * price;

        frappe.model.set_value(cdt, cdn, 'total_tour_price', total);
    },
    before_tours_detail_remove: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row && row.tour) {
            
            frappe.call({
                method: "hermes.hermes.doctype.tours_reservation.tours_reservation.delete_reservation_daily",
                args: {
                    reserva_dia_id: frm.doc.name,
                    tour: row.tour
                },
                callback: function (response) {
                    
                }
            });
        }
        
    },tours_detail_remove:function(frm){
        calculate_total(frm);
    }
});

function calculate_total(frm) {
    let total = 0;

    (frm.doc.tours_detail || []).forEach(row => {
        total += flt(row.total_tour_price);
    });

    frm.set_value('total_cost', total);
}

function calculate_total_pending(frm) {
    let total_amount = flt(frm.doc.total_cost);
    let total_paid = flt(frm.doc.amount_paid);
    let pending_amount = total_amount - total_paid;

    frm.set_value('outstanding_balance', pending_amount);
}

