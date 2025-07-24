import os
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
# Allow all origins; for production you may want to lock this down
CORS(app)

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "ok", "message": "Flask backend is up!"})

@app.route("/echo", methods=["POST"])
def echo():
    """
    Example POST endpoint. Your JS can do:
      fetch('/echo', { method: 'POST', body: JSON.stringify({ foo: 'bar' }), headers: {'Content-Type':'application/json'} })
    """
    data = request.get_json(force=True)
    return jsonify(data)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
