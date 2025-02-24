# Copyright (c) 2025, aet and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import add_days

class reservation(Document):
    pass
@frappe.whitelist()
def create_reservation_details(reservation_id):
    reservation = frappe.get_doc("reservation", reservation_id)
    
    if not reservation:
        frappe.throw("Reservation not found")

    for row in reservation.reserva_detalle:
        current_date = reservation.fecha_entrada
        while current_date < reservation.fecha_salida:
            doc = frappe.get_doc({
                "doctype": "reservation_detail_daily",
                "reserva_dia_id": reservation.name,
                "habitacion": row.habitacion,
                "reserva_fecha": current_date
            })
            doc.insert(ignore_permissions=True)
            current_date = add_days(current_date, 1)

    return {"message": "Reservation details added successfully"}
