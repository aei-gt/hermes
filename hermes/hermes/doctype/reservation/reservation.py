# Copyright (c) 2025, aet and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import add_days

class reservation(Document):
    def on_cancel(self):
        delete_related_reservation_details(self.name)

def delete_related_reservation_details(reservation_id):
    """Delete all linked reservation_detail_daily records before deleting the reservation."""
    frappe.db.delete("reservation_detail_daily", {"reserva_dia_id": reservation_id})
    frappe.db.commit()
        
@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_available_rooms(doctype, txt, searchfield, start, page_len, filters):
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")

    if not from_date or not to_date:
        return []

    booked_rooms = frappe.db.sql("""
        SELECT DISTINCT habitacion 
        FROM `tabreservation_detail_daily` 
        WHERE reserva_fecha BETWEEN %s AND %s
    """, (from_date, to_date), as_list=True)

    booked_room_list = [row[0] for row in booked_rooms] if booked_rooms else [""]

    return frappe.db.sql("""
        SELECT name FROM `tabroom` 
        WHERE name NOT IN (%s)
        ORDER BY name ASC
    """ % ", ".join(["%s"] * len(booked_room_list)), tuple(booked_room_list), as_list=True)


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