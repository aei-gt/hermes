// Copyright (c) 2025, aet and contributors
// For license information, please see license.txt

frappe.ui.form.on('reservation', {
    refresh: function(frm) {
        frm.add_custom_button(__('Check Room Availability'), function () {
            if (!frm.doc.fecha_entrada || !frm.doc.fecha_salida) {
                frappe.msgprint("Please select 'From Date' and 'To Date' first.");
                return;
            }
            frappe.call({
                method: "hermes.hermes.doctype.reservation.reservation.get_availability",
                args: {
                    from_date: frm.doc.fecha_entrada,
                    to_date: frm.doc.fecha_salida
                },
                callback: function (r) {
                    if (r.message) {                        
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
                }
            });
        }
    }
}


function open_room_date_range_dialog(rooms, dateRange) {
    let dialogSize = 'small';
    if (dateRange.length > 3 && dateRange.length <= 5) {
        dialogSize = 'large';
    } else if (dateRange.length > 5) {
        dialogSize = 'extra-large';
    }
    col = 3;
    if (dateRange.length > 2 && dateRange.length <= 4) {
        col = 2;
    } else if (dateRange.length > 4) {
        col = 1;
    }
    frappe.dom.set_style(`
        .modal-sm {
            max-width: 780px !important;
        }
        .modal-lg {
            max-width: 1150px !important;
        }
        .modal-xl {
            max-width: 1700px !important;
        }
        .available-cell {
            background-color:rgb(140, 233, 162) !important;
            color:rgb(0, 150, 35) !important;
        }
        .reserved-cell {
            background-color:rgb(255, 137, 147) !important;
            color:rgb(156, 0, 16) !important;
        }
    `);
    
    // Create the dialog
    let d = new frappe.ui.Dialog({
        title: 'Room Availability',
        size: dialogSize,
        fields: [{
            label: 'Room Availability',
            fieldname: 'table',
            fieldtype: 'Table',
            cannot_add_rows: true,
            cannot_delete_rows: true,
            in_place_edit: true,
            allow_child_item_selection: true,
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
                columns: col,
                colsize: col
            }
        ].concat(dateRange.map((date, index) => {
            return {
                label: date,
                fieldname: 'date_' + index,
                fieldtype: 'Data',
                in_list_view: 1,
                read_only: 1,
                columns: col,
                colsize: col
            };
        }))
        }],
        primary_action_label: 'Fetch Rooms',
        primary_action(values) {
            let selectedRows = d.fields_dict.table.grid.get_selected_children();
        
            if (selectedRows && selectedRows.length > 0) {
                selectedRows.forEach(row => {
                    let newRow = frappe.model.add_child(cur_frm.doc, "reservation_detail", "reserva_detalle");
                    newRow.habitacion = row.room;
                    if (newRow.habitacion) {
                        frappe.call({
                            method: 'frappe.client.get_value',
                            args: {
                                doctype: 'room',
                                filters: { name: newRow.habitacion },
                                fieldname: 'costo'
                            },
                            callback: function(response) {
                                if (response.message) {
                                    // Set the 'costo' field in the child table
                                    frappe.model.set_value(newRow.doctype, newRow.name, 'precio_base', response.message.costo);
                                }
                            }
                        });
                    }
                });
                cur_frm.refresh_field("reserva_detalle");
            } else {
                frappe.msgprint(__('Please select at least one row.'));
            }
        
            // Hide the dialog
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