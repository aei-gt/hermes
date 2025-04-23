# Copyright (c) 2025, aet and contributors
# For license information, please see license.txt

import frappe
from datetime import datetime, timedelta
from frappe.utils import add_days
from frappe.model.document import Document


class ToursReservation(Document):
    def on_cancel(self):
        delete_related_reservation_details(self.name)

    def on_update(self):
        records = frappe.get_all("Tour Reservation Detail Daily", filters={"reserva_dia_id": self.name})
        for record in records:
            frappe.db.set_value("Tour Reservation Detail Daily", record, "reservation_status", self.reservation_status)
            frappe.db.set_value("Tour Reservation Detail Daily", record, "customer", self.customer)
            frappe.db.set_value("Tour Reservation Detail Daily", record, "customer_name", self.customer_name)
            frappe.db.set_value("Tour Reservation Detail Daily", record, "phone_number", self.phone)
        frappe.db.commit()

    def before_submit(self):
        if self.reservation_status == "RESERVA PAGADA" and self.amount_paid <= 0:
            frappe.throw("If the reservation is marked as 'RESERVA PAGADA', Amount Paid must be greater than 0.")

def delete_related_reservation_details(reservation_id): #//?:
    frappe.db.delete("Tour Reservation Detail Daily", {"reserva_dia_id": reservation_id})
    frappe.db.commit()



@frappe.whitelist()
def get_tours():
    data = frappe.get_all('Tour', filters={'active': 1}, fields=['tour_name'])
    return data

def delete_related_reservation_details(reservation_id):  #????
    frappe.db.delete("Tour Reservation Detail Daily", {"reserva_dia_id": reservation_id})
    frappe.db.commit()

@frappe.whitelist()
def create_reservation_details(reservation_id):
    reservation = frappe.get_doc("Tours Reservation", reservation_id)    
    if not reservation:
        frappe.throw("Reservation not found")
    delete_related_reservation_details(reservation.name)

    for row in reservation.tours_detail:
        current_date = reservation.entry_date
        while current_date < reservation.departure_date:
            exists = frappe.db.exists(
                "Tour Reservation Detail Daily",
                {
                    "tour": row.tour,
                    "reserva_fecha": current_date
                }
            )
            if exists:
                frappe.throw(f"Tour {row.tour} is already reserved on {current_date}")

            doc = frappe.get_doc({
                "doctype": "Tour Reservation Detail Daily",
                "reserva_dia_id": reservation.name,
                "tour": row.tour,
                "reserva_fecha": current_date,
                "reservation_status": reservation.reservation_status,
                "customer": reservation.customer,
                "customer_name": reservation.customer_name,
                "phone_number": reservation.phone
            })
            doc.insert(ignore_permissions=True)
            current_date = add_days(current_date, 1)