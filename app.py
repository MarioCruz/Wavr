import os

from flask import Flask, render_template

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


def env_flag(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


if __name__ == "__main__":
    host = os.getenv("WAVR_HOST", "127.0.0.1")
    port = int(os.getenv("WAVR_PORT", "5050"))
    app.run(host=host, port=port, debug=env_flag("WAVR_DEBUG"))
