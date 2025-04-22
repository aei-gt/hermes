# Copyright (c) 2025, aet and contributors
# For license information, please see license.txt

import frappe
from datetime import datetime, timedelta
from frappe.utils import add_days
from frappe.model.document import Document

class reservation(Document):
    def on_cancel(self):
        delete_related_reservation_details(self.name)
    
    def on_update(self):
        records = frappe.get_all("reservation_detail_daily", filters={"reserva_dia_id": self.name})
        for record in records:
            frappe.db.set_value("reservation_detail_daily", record,"reservation_status" , self.estado_reserva)
            frappe.db.set_value("reservation_detail_daily", record,"customer" , self.cliente)
            frappe.db.set_value("reservation_detail_daily", record,"customer_name" , self.customer_name)
            frappe.db.set_value("reservation_detail_daily", record,"phone_number" , self.telefono)
        frappe.db.commit()



    def before_submit(self):
        if self.estado_reserva == "RESERVA PAGADA" and self.total_abonado <= 0:
            frappe.throw("If the reservation is marked as 'RESERVA PAGADA', Amount Paid must be greater than 0.")
# 

    





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
    """, (from_date, to_date,page_len, start), as_list=True)



    
@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_available_rooms_without_status(doctype, txt, searchfield, start, page_len, filters):
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")

    if not from_date or not to_date:
        return []

    return frappe.db.sql("""
        SELECT name
        FROM `tabroom`
        WHERE name NOT IN (
            SELECT DISTINCT habitacion
            FROM `tabreservation_detail_daily`
            WHERE reserva_fecha BETWEEN %s AND %s
            AND reservation_status IN ('RESERVA SIN PAGO', 'TENTATIVO','RESERVA PAGADA')
        )
        ORDER BY name ASC
        LIMIT %s OFFSET %s
    """, (from_date, to_date, page_len, start), as_list=True)






@frappe.whitelist()
def create_reservation_details(reservation_id):
    reservation = frappe.get_doc("reservation", reservation_id)
    
    if not reservation:
        frappe.throw("Reservation not found")

    # Purane reservation detail records delete karo
    delete_related_reservation_details(reservation.name)

    # Naye records insert karo
    for row in reservation.reserva_detalle:
        current_date = reservation.fecha_entrada
        while current_date < reservation.fecha_salida:
            # Check agar ye room is date pe already reserved hai
            exists = frappe.db.exists(
                "reservation_detail_daily",
                {
                    "habitacion": row.habitacion,
                    "reserva_fecha": current_date
                }
            )
            if exists:
                frappe.throw(f"Room {row.habitacion} is already reserved on {current_date}")

            doc = frappe.get_doc({
                "doctype": "reservation_detail_daily",
                "reserva_dia_id": reservation.name,
                "habitacion": row.habitacion,
                "reserva_fecha": current_date,
                "reservation_status": reservation.estado_reserva,
                "customer": reservation.cliente,
                "customer_name": reservation.customer_name,
                "phone_number": reservation.telefono
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






@frappe.whitelist()
def get_room_availability(from_date, to_date):
    try:
        from_date = datetime.strptime(from_date, "%Y-%m-%d").date()
        to_date = datetime.strptime(to_date, "%Y-%m-%d").date()
    except ValueError:
        frappe.throw("Invalid date format. Please use YYYY-MM-DD.")
    date_range = get_date_range(from_date, to_date)
    availability = []
    rooms = frappe.get_all("room", filters={"habilitado": 1}, fields=["name"])
    for room in rooms:
        room_status = {"room": room.name, "dates": {}}
        for date in date_range:
            booking_exists = frappe.db.exists("reservation_detail_daily",{"reserva_fecha": date.strftime("%Y-%m-%d"), "habitacion": room.name})
            if booking_exists :
                room_status["dates"][str(date)] = "Reserved"
            else:
                room_status["dates"][str(date)]="Available"

        availability.append(room_status)
    return {
        "rooms": availability,
        "dates": [str(d) for d in date_range]
    }


def get_date_range(start_date, end_date):
    return [(start_date + timedelta(days=i)) for i in range((end_date - start_date).days + 1)]

