from flask import Blueprint, jsonify

bp = Blueprint("practice", __name__, url_prefix="/practice")


@bp.route("/test", methods=["GET"])
def test():
    """
    Test endpoint that returns a JSON object with course as the key and cosc 224 as the value.
    """
    return jsonify({"course": "cosc 224"}), 200
