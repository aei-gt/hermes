frappe.listview_settings['reservation'] = {
    add_fields: ["estado_reserva"],
    get_indicator: function (doc) {
        if (doc.estado_reserva === "RESERVA PAGADA") {
            return [__("Reserva Pagada"), "green", "estado_reserva,=,RESERVA PAGADA"];
        } else if (doc.estado_reserva === "RESERVA SIN PAGO") {
            return [__("RESERVA SIN PAGO"), "yellow", "estado_reserva,=,RESERVA SIN PAGO"];
        } else if (doc.estado_reserva === "TENTATIVO") {
            return [__("Tentativo"), "red", "estado_reserva,=,TENTATIVO"];
        } else {
        }
    }
};