// Copyright (c) 2025, aet and contributors
// For license information, please see license.txt

frappe.ui.form.on('reservation', {
    refresh: function(frm) {
        frm.add_custom_button(__('Check Room Availability'), function () {
            // Check if 'From Date' and 'To Date' are selected
            if (!frm.doc.fecha_entrada || !frm.doc.fecha_salida) {
                frappe.msgprint("Please select 'From Date' and 'To Date' first.");
                return;
            }

            // Call the backend function to fetch room availability
            frappe.call({
                method: "hermes.hermes.doctype.reservation.reservation.get_availability",  // Replace with the correct path
                args: {
                    from_date: frm.doc.fecha_entrada,
                    to_date: frm.doc.fecha_salida
                },
                callback: function (r) {
                    if (r.message) {
                        console.log("Room availability data:", r.message);
                        
                        open_room_date_range_dialog(r.message.rooms, r.message.dates);
                    }
                }
            }); 
        });
        set_available_rooms_query(frm);
    },
    cliente:function(frm){
        if (frm.doc.cliente){
            frappe.db.get_doc('Customer', frm.doc.cliente).then(cust_doc => {
            if(cust_doc.custom_customer_phone) {
                    frm.set_value('telefono', cust_doc.custom_customer_phone)
            }
            });    
        }
    },
    fecha_entrada: function(frm) {
        if (frm.doc.fecha_entrada) {
            let next_day = frappe.datetime.add_days(frm.doc.fecha_entrada, 1);
            frm.set_value('fecha_salida', next_day);
        }
        console.log("aaaa");
        
        set_available_rooms_query(frm);
    },
    fecha_salida: function(frm) {
        if (frm.doc.fecha_entrada && frm.doc.fecha_salida) {
            let entry_date = new Date(frm.doc.fecha_entrada);
            let departure_date = new Date(frm.doc.fecha_salida);

            if (departure_date < entry_date) {
                frappe.msgprint(__('Departure date cannot be before entry date'));
                frm.set_value('fecha_salida', frappe.datetime.add_days(frm.doc.fecha_entrada, 1));
            }
            let nights = frappe.datetime.get_day_diff(frm.doc.fecha_salida, frm.doc.fecha_entrada);
            frm.set_df_property('total_global', 'label', `Total Nights: ${nights}`);
            frm.fields_dict.total_global.$wrapper.css('color', 'red');
        }
        console.log("bbbb");

        set_available_rooms_query(frm);
    },
    total_abonado: function(frm) {
        frm.set_value('total_pendiente', frm.doc.total_global - frm.doc.total_abonado);
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
    },
    show_room_not_payedtentative: function(frm) {
        console.log("Checkbox clicked.");
        set_available_rooms_query(frm);
        frm.refresh_field('reserva_detalle');
        frm.refresh();
        
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


function set_available_rooms_query(frm) {    
    if (frm.doc.fecha_entrada && frm.doc.fecha_salida) {
        if(frm.doc.show_room_not_payedtentative) {
        frappe.call({
            method: "hermes.hermes.doctype.reservation.reservation.set_query_for_habitacion",
            args: {
                from_date: frm.doc.fecha_entrada,
                to_date: frm.doc.fecha_salida,
                tantativo_pagado: frm.doc.show_room_not_payedtentative
            },
            callback: function (active_res) {
                const active_rooms = (active_res.message || []).map(room => room.name);
                console.log("Filtered Room Names:", active_rooms);

                frm.fields_dict.reserva_detalle.grid.get_field('habitacion').get_query = function () {
                    return {
                        filters: [
                            ['name', 'in', active_rooms],
                            ['habilitado', '=', 1]
                        ]
                    };
                };
                let updated_rows = frm.doc.reserva_detalle.filter(row => row.habitacion);
                frm.doc.reserva_detalle = updated_rows;

                frm.refresh_field('reserva_detalle');
                console.log("Empty rows removed and grid refreshed.");
                
            }
        });
    }
    else 
        {
            frappe.call({
                method: "hermes.hermes.doctype.reservation.reservation.set_query_for_habitacion",
                args: {
                    from_date: frm.doc.fecha_entrada,
                    to_date: frm.doc.fecha_salida
                },
                callback: function (available_res) {
                    const available_rooms = (available_res.message || []).map(room => room.name);
                    console.log("Filtered Room Names:", available_rooms);

                    frm.fields_dict.reserva_detalle.grid.get_field('habitacion').get_query = function () {
                        return {
                            filters: [
                                ['name', 'in', available_rooms],
                                ['habilitado', '=', 1]
                            ]
                        };
                    };
                    let updated_rows = frm.doc.reserva_detalle.filter(row => row.habitacion);
                    frm.doc.reserva_detalle = updated_rows;

                    frm.refresh_field('reserva_detalle');
                    console.log("Empty rows removed and grid refreshed.");
                }
            });
        }
    }
}


function open_room_date_range_dialog(rooms, dateRange) {
    frappe.dom.set_style(`
        .modal-xl {
            max-width: 1500px !important;
        }
        .available-cell {
            background-color: #d4edda !important;
            color: #155724 !important;
        }
        .reserved-cell {
            background-color: #f8d7da !important;
            color: #721c24 !important;
        }
    `);
    
    // Create the dialog
    let d = new frappe.ui.Dialog({
        title: 'Room Availability',
        size: 'extra-large',
        fields: [{
            label: 'Room Availability',
            fieldname: 'table',
            fieldtype: 'Table',
            cannot_add_rows: true,
            cannot_delete_rows: true,
            in_place_edit: true,
        data: (rooms || []).map(room => {
            let row = {
                room: room.room
            };
            dateRange.forEach((date, index) => {
                row['date_' + index] = room.dates[date] || "";
            });
            return row;
        }),
        fields: [
            {
                label: 'Room',
                fieldname: 'room',
                fieldtype: 'Link',
                options: 'room',
                in_list_view: 1,
                read_only: 1,
                columns: 1,
                colsize: 1
            }
        ].concat(dateRange.map((date, index) => {
            return {
                label: date,
                fieldname: 'date_' + index,
                fieldtype: 'Data',
                in_list_view: 1,
                read_only: 1,
                columns: 1,
                colsize: 1
            };
        }))
        }],
        primary_action_label: 'Save',
        primary_action(values) {
            console.log(values);
            d.hide();
        },
    });
    const grid = d.fields_dict.table.grid;
    grid.grid_rows.forEach(row => {
        const doc = row.doc;
        dateRange.forEach((date, index) => {
            const fieldname = 'date_' + index;
            const $cell = row.row.find(`[data-fieldname="${fieldname}"]`);
            const value = doc[fieldname];
            if (value === "Reserved") {
                $cell.addClass('reserved-cell');
            } else if (value === "Available") {
                $cell.addClass('available-cell');
            }
        });
    });
    d.show();
}