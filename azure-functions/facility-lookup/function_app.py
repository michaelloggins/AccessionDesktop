"""Azure Function: Facility Lookup

Endpoints:
  GET /api/facility/search?q=<name or address fragment>&limit=20
    → Search RASCLIENTS by facility name or address (autocomplete)

  GET /api/facility/lookup?id=<ExternalClientID>
    → Lookup a single facility by ExternalClientID, returns full record

  GET /api/facility/validate?name=<name>&address=<addr>&city=<city>&state=<st>&zip=<zip>
    → Match a facility by name + address, returns ExternalClientID candidates
"""

import json
import logging
import os

import azure.functions as func
import pyodbc

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


def get_connection():
    """Get a pyodbc connection to StarLIMS_DATA."""
    conn_str = os.environ.get("SQL_CONNECTION_STRING", "")
    return pyodbc.connect(conn_str)


def rows_to_dicts(cursor):
    """Convert pyodbc cursor rows to list of dicts."""
    columns = [col[0] for col in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


# ─── Search by name or address (autocomplete) ───

@app.route(route="facility/search", methods=["GET"])
def facility_search(req: func.HttpRequest) -> func.HttpResponse:
    """Search RASCLIENTS by facility name or address fragment."""
    query = req.params.get("q", "").strip()
    limit = int(req.params.get("limit", "20"))

    if len(query) < 1:
        return func.HttpResponse(
            json.dumps([]),
            mimetype="application/json",
        )

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Search by name or address — parameterized to prevent SQL injection
        search_param = f"%{query}%"
        cursor.execute(
            """
            SELECT TOP (?)
                ExternalClientID,
                ClientName,
                Address1,
                Address2,
                City,
                State,
                ZipCode,
                Country,
                Phone,
                Fax,
                Email,
                ContactName
            FROM RASCLIENTS
            WHERE ClientName LIKE ?
               OR Address1 LIKE ?
               OR City LIKE ?
               OR ExternalClientID LIKE ?
            ORDER BY ClientName
            """,
            limit, search_param, search_param, search_param, search_param,
        )

        results = rows_to_dicts(cursor)
        conn.close()

        return func.HttpResponse(
            json.dumps(results, default=str),
            mimetype="application/json",
        )

    except Exception as e:
        logging.error("facility_search error: %s", str(e))
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


# ─── Lookup by ExternalClientID ───

@app.route(route="facility/lookup", methods=["GET"])
def facility_lookup(req: func.HttpRequest) -> func.HttpResponse:
    """Lookup a single facility by ExternalClientID."""
    client_id = req.params.get("id", "").strip()

    if not client_id:
        return func.HttpResponse(
            json.dumps({"error": "id parameter required"}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        conn = get_connection()
        cursor = conn.cursor()

        cursor.execute(
            """
            SELECT
                ExternalClientID,
                ClientName,
                Address1,
                Address2,
                City,
                State,
                ZipCode,
                Country,
                Phone,
                Fax,
                Email,
                ContactName
            FROM RASCLIENTS
            WHERE ExternalClientID = ?
            """,
            client_id,
        )

        results = rows_to_dicts(cursor)
        conn.close()

        if not results:
            return func.HttpResponse(
                json.dumps({"error": "Facility not found"}),
                status_code=404,
                mimetype="application/json",
            )

        return func.HttpResponse(
            json.dumps(results[0], default=str),
            mimetype="application/json",
        )

    except Exception as e:
        logging.error("facility_lookup error: %s", str(e))
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )


# ─── Validate / match by name + address ───

@app.route(route="facility/validate", methods=["GET"])
def facility_validate(req: func.HttpRequest) -> func.HttpResponse:
    """Match facilities by name and/or address to find ExternalClientID candidates."""
    name = req.params.get("name", "").strip()
    address = req.params.get("address", "").strip()
    city = req.params.get("city", "").strip()
    state = req.params.get("state", "").strip()
    zip_code = req.params.get("zip", "").strip()

    if not name and not address:
        return func.HttpResponse(
            json.dumps({"error": "name or address parameter required"}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        conn = get_connection()
        cursor = conn.cursor()

        # Build dynamic WHERE clause based on provided fields
        conditions = []
        params = []

        if name:
            conditions.append("ClientName LIKE ?")
            params.append(f"%{name}%")
        if address:
            conditions.append("Address1 LIKE ?")
            params.append(f"%{address}%")
        if city:
            conditions.append("City LIKE ?")
            params.append(f"%{city}%")
        if state:
            conditions.append("State = ?")
            params.append(state)
        if zip_code:
            conditions.append("ZipCode LIKE ?")
            params.append(f"{zip_code}%")

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        cursor.execute(
            f"""
            SELECT TOP 10
                ExternalClientID,
                ClientName,
                Address1,
                Address2,
                City,
                State,
                ZipCode,
                Country,
                Phone,
                Fax,
                Email,
                ContactName
            FROM RASCLIENTS
            WHERE {where_clause}
            ORDER BY ClientName
            """,
            *params,
        )

        results = rows_to_dicts(cursor)
        conn.close()

        return func.HttpResponse(
            json.dumps({
                "matches": len(results),
                "results": results,
            }, default=str),
            mimetype="application/json",
        )

    except Exception as e:
        logging.error("facility_validate error: %s", str(e))
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500,
            mimetype="application/json",
        )
