"""
Fake API endpoints for testing/development
"""

from flask import Blueprint, jsonify, request

fake = Blueprint("fake", __name__, url_prefix="/api/v1")


@fake.route("/scanners", methods=("POST", "GET"))
def get_scanner():
    if request.method == "GET":
        return (
            jsonify(
                [
                    {
                        "active": True,
                        "checked_at": "2020-03-24T06:30:03.169640+00:00",
                        "disk_usage": 59931932204,
                        "duration_average": 184.874061683141,
                        "id": "132d2f68-bc8a-4024-8deb-1d82f17bc080",
                        "kiosk_serial": "66576b696f736b4d41566e6f32a",
                        "license": None,
                        "license_expires_at": "2020-12-26T00:00:00+00:00",
                        "name": "padvish",
                        "port": 8080,
                        "result_distribution": {},
                        "scanned_files_count": 1703,
                        "sequence": 14,
                        "source": 1,
                        "started_at": "2019-04-27T07:25:35.463545+00:00",
                        "updated_at": "2020-02-17T10:47:01.774983+00:00",
                        "version": None,
                    }
                ]
            ),
            200,
        )


@fake.route("/scanner/update", methods=("POST",))
def update_scanner():
    if request.method == "POST":
        return (
            jsonify(
                {
                    "result": True,
                }
            ),
            200,
        )


@fake.route("/scanner/file/", methods=("POST",))
def scan_file():
    if request.method == "POST":
        return (
            jsonify(
                {
                    "apk_detail": None,
                    "comment": None,
                    "date": "2020-03-28",
                    "datetime": "2020-03-28T12:37:44.986927+00:00",
                    "display_name": "file.txt",
                    "ext_match": True,
                    "extension": ".txt",
                    "id": 851632,
                    "md5": "9a0364b9e99bb480dd25e1f0284c8555",
                    "mimetype": "text/plain",
                    "name": "file.txt.9a0364b9e99bb480dd25e1f0284c8555",
                    "public": True,
                    "scanned": False,
                    "scans": [
                        {
                            "date": "2020-03-28",
                            "duration": 0,
                            "finished": False,
                            "finished_at": None,
                            "id": 856899,
                            "result_error": 0,
                            "result_infected": 0,
                            "result_suspicious": 0,
                            "scan_items": [],
                            "started_at": "2020-03-28T12:37:45.023925+00:00",
                            "threats": None,
                        }
                    ],
                    "sha1": "040f06fd774092478d450774f5ba30c5da78acc8",
                    "sha256": "ed7002b439e9ac845f22357d822bac1444730fbdb6016d3ec9432297b9ec9f73",
                    "size": 7,
                    "tags": [],
                    "user": {"username": "viruskav"},
                    "username": "viruskav",
                }
            ),
            200,
        )


@fake.route("/result/md5/<md5>/", methods=["GET"])
def check_result_md5(md5):
    if request.method == "GET":
        return (
            jsonify(
                {
                    "apk_detail": None,
                    "comment": None,
                    "date": "2020-03-28",
                    "datetime": "2020-03-28T12:37:44.986927+00:00",
                    "display_name": "file.txt",
                    "ext_match": True,
                    "extension": ".txt",
                    "id": 851632,
                    "md5": "9a0364b9e99bb480dd25e1f0284c8555",
                    "mimetype": "text/plain",
                    "name": "file.txt.9a0364b9e99bb480dd25e1f0284c8555",
                    "public": True,
                    "scanned": False,
                    "scans": [
                        {
                            "date": "2020-03-28",
                            "duration": 0,
                            "finished": True,
                            "finished_at": None,
                            "id": 856899,
                            "result_error": 0,
                            "result_infected": 0,
                            "result_suspicious": 0,
                            "scan_items": [],
                            "started_at": "2020-03-28T12:37:45.023925+00:00",
                            "threats": None,
                        }
                    ],
                    "sha1": "040f06fd774092478d450774f5ba30c5da78acc8",
                    "sha256": "ed7002b439e9ac845f22357d822bac1444730fbdb6016d3ec9432297b9ec9f73",
                    "size": 7,
                    "tags": [],
                    "user": {"username": "viruskav"},
                    "username": "viruskav",
                }
            ),
            200,
        )

@fake.route("/practice/test", methods=["GET"]) # Make sure there's a leading slash
def practice_test():
    return {"course": "cosc 224"}, 200