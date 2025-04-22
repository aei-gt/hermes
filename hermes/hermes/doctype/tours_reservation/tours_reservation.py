# Copyright (c) 2025, aet and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ToursReservation(Document):
	pass


@frappe.whitelist()
def get_tours():
    # Fetch tours where active = 1
    data = frappe.get_all('Tour', filters={'active': 1}, fields=['tour_name'])
    return data
