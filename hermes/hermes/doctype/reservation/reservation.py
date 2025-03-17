# Copyright (c) 2025, aet and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import add_days

class reservation(Document):
    def on_cancel(self):
        delete_related_reservation_details(self.name)
    
    def on_update(self):
        records = frappe.get_all("reservation_detail_daily", filters={"reserva_dia_id": self.name})
        for record in records:
            frappe.db.set_value("reservation_detail_daily", record,"reservation_status" , self.estado_reserva)
        frappe.db.commit()



    def before_submit(self):
        allowed_statuses = ["RESERVA SIN PAGO", "RESERVA PAGADA"]
        
        if self.estado_reserva not in allowed_statuses:
            frappe.throw("You can only submit the document if 'estado_reserva' is 'RESERVA SIN PAGO' or 'RESERVA PAGADA'.")


    





def delete_related_reservation_details(reservation_id):
    frappe.db.delete("reservation_detail_daily", {"reserva_dia_id": reservation_id})
    frappe.db.commit()




@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_available_rooms(doctype, txt, searchfield, start, page_len, filters):
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")

    if not from_date or not to_date:
        return []

    return frappe.db.sql("""
        SELECT DISTINCT habitacion 
        FROM `tabreservation_detail_daily` 
        WHERE reserva_fecha BETWEEN %s AND %s
        AND reservation_status IN ('RESERVA SIN PAGO', 'TENTATIVO')
        
        UNION 
        
        SELECT DISTINCT name 
        FROM `tabroom`
        WHERE name NOT IN (
            SELECT DISTINCT habitacion 
            FROM `tabreservation_detail_daily` 
            WHERE reserva_fecha BETWEEN %s AND %s
        )
        
        ORDER BY habitacion ASC
    """, (from_date, to_date, from_date, to_date), as_list=True)







@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_available_rooms_without_status(doctype, txt, searchfield, start, page_len, filters):
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")

    if not from_date or not to_date:
        return []
    
    return frappe.db.sql("""
        SELECT DISTINCT habitacion 
        FROM `tabreservation_detail_daily` 
        WHERE reserva_fecha BETWEEN %s AND %s
        AND reservation_status = 'RESERVA PAGADA'
        
        UNION 
        
        SELECT DISTINCT name 
        FROM `tabroom`
        WHERE name NOT IN (
            SELECT DISTINCT habitacion 
            FROM `tabreservation_detail_daily` 
            WHERE reserva_fecha BETWEEN %s AND %s
        )
        
        ORDER BY habitacion ASC
    """, (from_date, to_date, from_date, to_date), as_list=True)






@frappe.whitelist()
def create_reservation_details(reservation_id):
    reservation = frappe.get_doc("reservation", reservation_id)
    
    if not reservation:
        frappe.throw("Reservation not found")

    # Pehle purane records delete karein jo iss reservation_id ke hain
    delete_related_reservation_details(reservation.name)

    # Naye records insert karain
    for row in reservation.reserva_detalle:
        current_date = reservation.fecha_entrada
        while current_date < reservation.fecha_salida:
            doc = frappe.get_doc({
                "doctype": "reservation_detail_daily",
                "reserva_dia_id": reservation.name,
                "habitacion": row.habitacion,
                "reserva_fecha": current_date,
                "reservation_status": reservation.estado_reserva
            })
            doc.insert(ignore_permissions=True)
            current_date = add_days(current_date, 1)

@frappe.whitelist()
def delete_reservation_daily(reserva_dia_id, habitacion):

    if not reserva_dia_id or not habitacion:
        return "Missing parameters"

    reservations = frappe.get_all("reservation_detail_daily", filters={"reserva_dia_id": reserva_dia_id, "habitacion": habitacion}, fields=["name"])
    if reservations:
        for res in reservations:
            frappe.delete_doc("reservation_detail_daily", res.name, force=True)
        return f"Deleted {len(reservations)} records for habitacion: {habitacion}"
    
    return "No records found"



# @frappe.whitelist()
# @frappe.validate_and_sanitize_search_inputs
# def get_available_rooms_without_status(doctype, txt, searchfield, start, page_len, filters):
#     from_date = filters.get("from_date")
#     to_date = filters.get("to_date")

#     if not from_date or not to_date:
#         return []

#     # Fetch booked rooms with status "RESERVA PAGADA"
#     booked_rooms = frappe.db.sql("""
#         SELECT DISTINCT habitacion 
#         FROM `tabreservation_detail_daily` 
#         WHERE reserva_fecha BETWEEN %s AND %s
#         AND reservation_status = 'RESERVA PAGADA'
#     """, (from_date, to_date), as_list=True)

#     booked_room_list = [row[0] for row in booked_rooms] if booked_rooms else []

#     query = "SELECT name FROM `tabroom`"
#     params = []

#     if booked_room_list:
#         placeholders = ", ".join(["%s"] * len(booked_room_list))
#         query += f" WHERE name NOT IN ({placeholders})"
#         params.extend(booked_room_list)

#     query += " ORDER BY name ASC"

#     return frappe.db.sql(query, tuple(params), as_list=True)