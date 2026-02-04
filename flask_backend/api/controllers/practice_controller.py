"""
Practice API endpoints
"""

from flask import Blueprint, jsonify

bp = Blueprint("practice", __name__, url_prefix="/practice")


@bp.route("/test", methods=["GET"])
def practice_test():
    """
    GET /practice/test
    Returns a JSON object with course information
    """
    return jsonify({"course": "cosc 224"}), 200
