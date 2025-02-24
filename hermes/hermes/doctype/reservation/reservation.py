# Copyright (c) 2025, aet and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class reservation(Document):
	def validate(self):
		for row in self.reserva_detalle:
			current_date = self.fecha_entrada
			while current_date < self.fecha_salida:
				frappe.get_doc({
					"doctype": "reservation_detail_daily",
					"reserva_dia_id": self.name,
					"habitacion": row.habitacion,
					"reserva_fecha": current_date
				}).insert(ignore_permissions=True)
				current_date = frappe.utils.add_days(current_date, 1)
