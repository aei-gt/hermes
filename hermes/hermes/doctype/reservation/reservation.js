// Copyright (c) 2025, aet and contributors
// For license information, please see license.txt

frappe.ui.form.on('reservation', {
    fecha_entrada: function(frm) {
        if (frm.doc.fecha_entrada) {
            let next_day = frappe.datetime.add_days(frm.doc.fecha_entrada, 1);
            frm.set_value('fecha_salida', next_day);
        }
        estado_reserva(frm);
    },
    fecha_salida: function(frm) {
        if (frm.doc.fecha_entrada && frm.doc.fecha_salida) {
            let entry_date = new Date(frm.doc.fecha_entrada);
            let departure_date = new Date(frm.doc.fecha_salida);

            if (departure_date < entry_date) {
                frappe.msgprint(__('Departure date cannot be before entry date'));
                frm.set_value('fecha_salida', frappe.datetime.add_days(frm.doc.fecha_entrada, 1));
            } else if (departure_date.getTime() === entry_date.getTime()) {
                frappe.msgprint(__('Please confirm departure date'));
            }
            let nights = frappe.datetime.get_day_diff(frm.doc.fecha_salida, frm.doc.fecha_entrada);
            frm.set_df_property('total_global', 'label', `Total Nights: ${nights}`);
            frm.fields_dict.total_global.$wrapper.css('color', 'red');
            estado_reserva(frm);
        }
    },
    total_abonado: function(frm) {
        frm.set_value('total_pendiente', frm.doc.total_global - frm.doc.total_abonado);
    },
    refresh: function(frm) {
        estado_reserva(frm);
    },
    after_save:function(frm){
            if(!frm.is_new()) {
                frappe.call({
                    method: "hermes.hermes.doctype.reservation.reservation.create_reservation_details",
                    args: { reservation_id: frm.doc.name },
                    callback: function(response) {
                        if (!response.exc) {
                            // frappe.msgprint(__('Reservation Details Updated successfully'));
                            frm.reload_doc();
                        }
                    }
                });
        }
        update_totals
    },show_room_not_payedtentative: function(frm) {
        console.log("Checkbox clicked.");
        estado_reserva(frm);
    },
});

frappe.ui.form.on('reservation_detail', {
    habitacion: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row.habitacion) {
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'room',
                    filters: { name: row.habitacion },
                    fieldname: 'costo'
                },
                callback: function(response) {
                    if (response.message) {
                        frappe.model.set_value(cdt, cdn, 'precio_base', response.message.costo);
                        calculate_total(frm, cdt, cdn);
                    }
                }
            });
        }
    },
    precio_base: function(frm, cdt, cdn) {
        calculate_total(frm, cdt, cdn);
    },
    before_reserva_detalle_remove: function (frm, cdt, cdn) {
        let row = locals[cdt][cdn];
        if (row && row.habitacion) {
            frappe.call({
                method: "hermes.hermes.doctype.reservation.reservation.delete_reservation_daily",
                args: {
                    reserva_dia_id: frm.doc.name,
                    habitacion: row.habitacion
                },
                callback: function (response) {
                    console.log(response.message);  // Debugging output
                }
            });
        }
        
    },reserva_detalle_remove:function(frm){
        update_totals(frm);
    }
});

function calculate_total(frm, cdt, cdn) {
    let row = locals[cdt][cdn];
    if (frm.doc.fecha_entrada && frm.doc.fecha_salida && row.precio_base) {
        let nights = frappe.datetime.get_day_diff(frm.doc.fecha_salida, frm.doc.fecha_entrada);
        frappe.model.set_value(cdt, cdn, 'total_estadia', row.precio_base * nights);
        update_totals(frm);
    }
}

function update_totals(frm) {
    let total_cost = 0;
    frm.doc.reserva_detalle.forEach(row => {
        total_cost += row.total_estadia || 0;
    });
    frm.set_value('total_global', total_cost);
    frm.set_value('total_pendiente', total_cost - frm.doc.total_abonado);
}
// function delete_Res_daily(frm) {
//     frm.doc.reserva_detalle.forEach(row => {
//         frm.call({
//             method: "hermes.hermes.doctype.reservation.reservation.delete_reservation_daily",
//             args: {
//                 reserva_dia_id: frm.doc.name,
//                 habitacion: row.habitacion
//             },
//             callback: function(response) {
//                 if (response.message) {
//                     console.log("Deleted reservation details for:", row.habitacion);
//                 }
//             }
//         });
//     });
// }


function estado_reserva(frm) {    
    if (!frm.doc.show_room_not_payedtentative) {
        console.log("Showing only fully free rooms.");
        frm.fields_dict.reserva_detalle.grid.get_field("habitacion").get_query = function() {
            return {
                query: "hermes.hermes.doctype.reservation.reservation.get_available_rooms_without_status",
                filters: {
                    from_date: frm.doc.fecha_entrada,
                    to_date: frm.doc.fecha_salida
                }
            };
        };
    } else {
        console.log("Showing free rooms + rooms with 'TENTATIVO' & 'RESERVA SIN PAGO'.");

        frm.fields_dict.reserva_detalle.grid.get_field("habitacion").get_query = function() {
            return {
                query: "hermes.hermes.doctype.reservation.reservation.get_available_rooms",
                filters: {
                    from_date: frm.doc.fecha_entrada,
                    to_date: frm.doc.fecha_salida
                }
            };
        };
    }
}