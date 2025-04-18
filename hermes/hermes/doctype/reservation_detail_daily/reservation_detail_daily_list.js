frappe.listview_settings['reservation_detail_daily'] = {
    add_fields: ["reservation_status"],
    get_indicator: function (doc) {
        console.log(doc.reservation_status);
        if (doc.reservation_status === "RESERVA PAGADA") {
            return [__("Reserva Pagada"), "green", "estado_reserva,=,RESERVA PAGADA"];
        } else if (doc.reservation_status === "RESERVA SIN PAGO") {
            return [__("RESERVA SIN PAGO"), "yellow", "estado_reserva,=,RESERVA SIN PAGO"];
        } else if (doc.reservation_status === "TENTATIVO") {
            return [__("Tentativo"), "red", "estado_reserva,=,TENTATIVO"];
        } else {
          
        }
    }
};