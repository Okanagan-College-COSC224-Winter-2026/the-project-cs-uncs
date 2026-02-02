"""
Practice controller for lab testing
"""

from flask import Blueprint, jsonify

bp = Blueprint('practice', __name__, url_prefix='/practice')


@bp.route('/test', methods=['GET'])
def practice_test():
    return jsonify({"course": "cosc 224"}), 200
