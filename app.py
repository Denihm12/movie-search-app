from flask import Flask, jsonify, request
from flask_cors import CORS
import requests
import sqlite3
import os

app = Flask(__name__)
CORS(app)

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "YOUR_NEW_TMDB_API_KEY_HERE")
GOOGLE_MAPS_API_KEY = os.environ.get(
    "GOOGLE_MAPS_API_KEY", "YOUR_GOOGLE_MAPS_API_KEY_HERE")
DB_PATH = "favorites.db"
TMDB = "https://api.themoviedb.org/3"


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY,
            title TEXT,
            poster_path TEXT,
            release_date TEXT,
            rating REAL
        )
    """)
    conn.commit()
    conn.close()


init_db()


def simplify_movie_list(raw_movies):
    """Shared by every route that returns a list of movies, so the shape
    stays identical everywhere (search, popular, top rated, discover)."""
    return [
        {
            "id": movie.get("id"),
            "title": movie.get("title"),
            "overview": movie.get("overview"),
            "release_date": movie.get("release_date"),
            "poster_path": movie.get("poster_path"),
            "backdrop_path": movie.get("backdrop_path"),
            "rating": movie.get("vote_average"),
        }
        for movie in raw_movies
    ]


@app.route("/search")
def search_movies():
    query = request.args.get("q")
    if not query:
        return jsonify({"error": "missing search query. use /search?q=blackpanther"}), 400

    tmdb_response = requests.get(
        f"{TMDB}/search/movie",
        params={"api_key": TMDB_API_KEY, "query": query},
        timeout=15,
    )
    if tmdb_response.status_code != 200:
        return jsonify({"error": "failed to fetch data from TMDB"}), 502

    data = tmdb_response.json()
    return jsonify(simplify_movie_list(data.get("results", [])))


@app.route("/popular")
def popular_movies():
    tmdb_response = requests.get(
        f"{TMDB}/movie/popular",
        params={"api_key": TMDB_API_KEY},
        timeout=15,
    )
    if tmdb_response.status_code != 200:
        return jsonify({"error": "failed to fetch popular movies"}), 502

    data = tmdb_response.json()
    return jsonify(simplify_movie_list(data.get("results", [])))


@app.route("/top-rated")
def top_rated_movies():
    tmdb_response = requests.get(
        f"{TMDB}/movie/top_rated",
        params={"api_key": TMDB_API_KEY},
        timeout=15,
    )
    if tmdb_response.status_code != 200:
        return jsonify({"error": "failed to fetch top rated movies"}), 502

    data = tmdb_response.json()
    return jsonify(simplify_movie_list(data.get("results", [])))


@app.route("/discover")
def discover_movies():
    """Powers the genre rows and genre pages.
    /discover?genre=28            -> Action
    /discover?genre=16&lang=ja    -> Anime (Animation made in Japanese)
    /discover?genre=35&page=2     -> Comedy, second page
    """
    params = {
        "api_key": TMDB_API_KEY,
        "sort_by": "popularity.desc",
        "include_adult": "false",
        "vote_count.gte": 100,  # filters out obscure titles with a handful of votes
    }

    genre = request.args.get("genre")
    if genre:
        params["with_genres"] = genre

    lang = request.args.get("lang")
    if lang:
        params["with_original_language"] = lang

    try:
        params["page"] = max(1, int(request.args.get("page", 1)))
    except ValueError:
        params["page"] = 1

    tmdb_response = requests.get(
        f"{TMDB}/discover/movie", params=params, timeout=15)
    if tmdb_response.status_code != 200:
        return jsonify({"error": "failed to discover movies"}), 502

    data = tmdb_response.json()
    return jsonify({
        "results": simplify_movie_list(data.get("results", [])),
        "page": data.get("page", 1),
        "total_pages": data.get("total_pages", 1),
    })


@app.route("/movie/<int:movie_id>")
def movie_detail(movie_id):
    tmdb_response = requests.get(
        f"{TMDB}/movie/{movie_id}",
        params={"api_key": TMDB_API_KEY,
                "append_to_response": "credits,videos"},
        timeout=15,
    )
    if tmdb_response.status_code != 200:
        return jsonify({"error": "failed to fetch movie details"}), 502

    data = tmdb_response.json()

    cast_list = data.get("credits", {}).get("cast", [])
    top_cast = [person.get("name") for person in cast_list[:5]]

    videos = data.get("videos", {}).get("results", [])
    trailer_key = None
    for video in videos:
        if video.get("type") == "Trailer" and video.get("site") == "YouTube":
            trailer_key = video.get("key")
            break

    detail = {
        "id": data.get("id"),
        "title": data.get("title"),
        "overview": data.get("overview"),
        "release_date": data.get("release_date"),
        "poster_path": data.get("poster_path"),
        "backdrop_path": data.get("backdrop_path"),
        "rating": data.get("vote_average"),
        "runtime": data.get("runtime"),
        "genres": [g.get("name") for g in data.get("genres", [])],
        "cast": top_cast,
        "trailer_key": trailer_key,
    }
    return jsonify(detail)


@app.route("/movie/<int:movie_id>/watch")
def watch_providers(movie_id):
    # region is a 2-letter country code. Hardcoded to US for now — could
    # later be made dynamic based on the user's actual location.
    region = request.args.get("region", "US")

    tmdb_response = requests.get(
        f"{TMDB}/movie/{movie_id}/watch/providers",
        params={"api_key": TMDB_API_KEY},
        timeout=15,
    )
    if tmdb_response.status_code != 200:
        return jsonify({"error": "failed to fetch watch providers"}), 502

    data = tmdb_response.json()
    region_data = data.get("results", {}).get(region, {})

    def names_only(provider_list):
        return [p.get("provider_name") for p in provider_list]

    return jsonify({
        "region": region,
        "link": region_data.get("link"),  # TMDB's own page listing all options
        "streaming": names_only(region_data.get("flatrate", [])),
        "rent": names_only(region_data.get("rent", [])),
        "buy": names_only(region_data.get("buy", [])),
    })


@app.route("/cinemas")
def nearby_cinemas():
    # Expects the user's coordinates, gathered via the browser's
    # Geolocation API on the frontend.
    lat = request.args.get("lat")
    lon = request.args.get("lon")

    if not lat or not lon:
        return jsonify({"error": "missing lat/lon"}), 400

    response = requests.get(
        "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
        params={
            "location": f"{lat},{lon}",
            "radius": 10000,  # meters (10km)
            "type": "movie_theater",
            "key": GOOGLE_MAPS_API_KEY,
        },
        timeout=15,
    )

    if response.status_code != 200:
        return jsonify({"error": "failed to fetch nearby cinemas"}), 502

    data = response.json()

    # Google always returns HTTP 200, even on failure — the REAL success/
    # failure indicator is this "status" field inside the JSON body.
    status = data.get("status")
    if status not in ("OK", "ZERO_RESULTS"):
        return jsonify({"error": f"Google Places error: {status}"}), 502

    cinemas = []
    for place in data.get("results", []):
        location = place.get("geometry", {}).get("location", {})
        cinemas.append({
            "name": place.get("name", "Unnamed Cinema"),
            "address": place.get("vicinity"),
            "rating": place.get("rating"),
            "lat": location.get("lat"),
            "lon": location.get("lng"),
        })

    return jsonify(cinemas)


@app.route("/favorites", methods=["GET"])
def get_favorites():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM favorites").fetchall()
    conn.close()
    return jsonify([dict(row) for row in rows])


@app.route("/favorites", methods=["POST"])
def add_favorite():
    movie = request.get_json()

    if not movie or "id" not in movie:
        return jsonify({"error": "missing movie data"}), 400

    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """INSERT OR REPLACE INTO favorites (id, title, poster_path, release_date, rating)
           VALUES (?, ?, ?, ?, ?)""",
        (movie.get("id"), movie.get("title"), movie.get("poster_path"),
         movie.get("release_date"), movie.get("rating")),
    )
    conn.commit()
    conn.close()
    return jsonify({"status": "added"}), 201


@app.route("/favorites/<int:movie_id>", methods=["DELETE"])
def remove_favorite(movie_id):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM favorites WHERE id = ?", (movie_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "removed"})


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1",
            port=int(os.environ.get("PORT", 5000)))
