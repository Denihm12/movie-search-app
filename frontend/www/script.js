const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('searchbutton');
const favoritesButton = document.getElementById('favoritesbutton');
const searchResults = document.getElementById('search-results');
const brandLink = document.querySelector('.brand');
const movieModal = document.getElementById('movie-modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w200';

// This is THE ONE LINE to change depending on where the backend runs.
// - Testing in a desktop browser: 'http://localhost:5000' works fine.
// - Testing on a real phone (via Capacitor) on the same WiFi as your
//   computer: replace with your computer's local network IP, e.g.
//   'http://192.168.1.42:5000' — find yours by running `ipconfig getifaddr en0`
//   (Mac Wi-Fi) in a terminal.
// - A published app: this must point to a real, always-on server address
//   (e.g. Render, Railway) — a phone can never reach your laptop's
//   localhost or home network from outside.
const API_BASE = 'http://localhost:5000';

searchButton.addEventListener('click', (event) => {
    event.preventDefault();
    searchMovies();
});

searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        searchMovies();
    }
});

favoritesButton.addEventListener('click', showFavorites);

// Clicking the logo brings you back to the homepage sections.
brandLink.addEventListener('click', () => {
    searchInput.value = '';
    loadHomepage();
});

async function searchMovies() {
    const query = searchInput.value.trim();

    if (!query) {
        searchResults.innerHTML = '<p class="status-message">Please enter a movie title.</p>';
        return;
    }

    setLoading(true);
    searchResults.innerHTML = '<p class="status-message">Searching...</p>';

    try {
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);

        if (!response.ok) {
            searchResults.innerHTML = '<p class="status-message">Error fetching movie data. Please try again later.</p>';
            return;
        }

        const movies = await response.json();

        if (movies.length === 0) {
            searchResults.innerHTML = '<p class="status-message">No results found.</p>';
            return;
        }

        displayResults(movies);
    } catch (error) {
        searchResults.innerHTML = '<p class="status-message">Could not reach the server. Is the backend running?</p>';
    } finally {
        setLoading(false);
    }
}

async function showFavorites() {
    setLoading(true);
    searchResults.innerHTML = '<p class="status-message">Loading favorites...</p>';

    try {
        const response = await fetch(`${API_BASE}/favorites`);

        if (!response.ok) {
            searchResults.innerHTML = '<p class="status-message">Could not load favorites.</p>';
            return;
        }

        const favorites = await response.json();

        if (favorites.length === 0) {
            searchResults.innerHTML = '<p class="status-message">No favorites saved yet.</p>';
            return;
        }

        displayResults(favorites);
    } catch (error) {
        searchResults.innerHTML = '<p class="status-message">Could not reach the server. Is the backend running?</p>';
    } finally {
        setLoading(false);
    }
}

function setLoading(isLoading) {
    searchButton.disabled = isLoading;
    favoritesButton.disabled = isLoading;
}

function movieCardsHTML(movies) {
    return movies.map(movie => {
        const posterUrl = movie.poster_path
            ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
            : 'https://placehold.co/200x300?text=No+Poster';

        return `
            <div class="movie-card" data-movie-id="${movie.id}">
                <img src="${posterUrl}" alt="${movie.title} poster" loading="lazy">
                <div class="movie-info">
                    <strong>${movie.title}</strong> (${movie.release_date || 'unknown date'})<br>
                    Rating: ${movie.rating}<br>
                    <p>${movie.overview || 'No overview available.'}</p>
                </div>
            </div>
        `;
    }).join('');
}

function displayResults(movies) {
    searchResults.innerHTML = `<div class="results-grid">${movieCardsHTML(movies)}</div>`;
}

async function loadHomepage() {
    setLoading(true);
    searchResults.innerHTML = '<p class="status-message">Loading movies...</p>';

    try {
        // Promise.all runs both requests at the same time instead of one
        // after the other — the page loads roughly twice as fast as it
        // would fetching them sequentially.
        const [popularResponse, topRatedResponse] = await Promise.all([
            fetch(`${API_BASE}/popular`),
            fetch(`${API_BASE}/top-rated`)
        ]);

        if (!popularResponse.ok || !topRatedResponse.ok) {
            searchResults.innerHTML = '<p class="status-message">Could not load movies.</p>';
            return;
        }

        const popular = await popularResponse.json();
        const topRated = await topRatedResponse.json();

        searchResults.innerHTML = `
            <div class="section">
                <h2 class="section-title">🔥 Popular Right Now</h2>
                <div class="results-grid">${movieCardsHTML(popular)}</div>
            </div>
            <div class="section">
                <h2 class="section-title">⭐ Top Rated</h2>
                <div class="results-grid">${movieCardsHTML(topRated)}</div>
            </div>
        `;
    } catch (error) {
        searchResults.innerHTML = '<p class="status-message">Could not reach the server. Is the backend running?</p>';
    } finally {
        setLoading(false);
    }
}

searchResults.addEventListener('click', (event) => {
    const card = event.target.closest('.movie-card');
    if (!card) return;

    const movieId = card.dataset.movieId;
    showMovieDetail(movieId);
});

async function showMovieDetail(movieId) {
    modalBody.innerHTML = '<p class="status-message">Loading...</p>';
    movieModal.classList.remove('hidden');

    try {
        const response = await fetch(`${API_BASE}/movie/${movieId}`);

        if (!response.ok) {
            modalBody.innerHTML = '<p class="status-message">Could not load movie details.</p>';
            return;
        }

        const movie = await response.json();

        const posterUrl = movie.poster_path
            ? `${TMDB_IMAGE_BASE}${movie.poster_path}`
            : 'https://placehold.co/200x300?text=No+Poster';

        const castLine = movie.cast.length > 0
            ? movie.cast.join(', ')
            : 'Not available';

        const trailerEmbed = movie.trailer_key
            ? `<iframe width="100%" height="220"
                 src="https://www.youtube.com/embed/${movie.trailer_key}"
                 allowfullscreen></iframe>`
            : '<p>No trailer available.</p>';

        modalBody.innerHTML = `
            <img src="${posterUrl}" alt="${movie.title} poster" class="modal-poster">
            <h2>${movie.title} (${movie.release_date || 'unknown date'})</h2>
            <p><strong>Rating:</strong> ${movie.rating}</p>
            <p><strong>Cast:</strong> ${castLine}</p>
            <p>${movie.overview || 'No overview available.'}</p>
            ${trailerEmbed}
            <div class="modal-actions">
                <button id="add-favorite-btn">☆ Add to Favorites</button>
                <button id="remove-favorite-btn">Remove from Favorites</button>
            </div>

            <div id="watch-section" class="detail-section">
                <h3>Where to Watch</h3>
                <p class="status-message">Loading...</p>
            </div>

            <div id="cinemas-section" class="detail-section">
                <h3>Cinemas Near You</h3>
                <button id="find-cinemas-btn">📍 Find Nearby Cinemas</button>
                <div id="cinemas-list"></div>
            </div>
        `;

        document.getElementById('add-favorite-btn').addEventListener('click', () => addFavorite(movie));
        document.getElementById('remove-favorite-btn').addEventListener('click', () => removeFavorite(movie.id));
        document.getElementById('find-cinemas-btn').addEventListener('click', findNearbyCinemas);

        loadWatchProviders(movieId);
    } catch (error) {
        modalBody.innerHTML = '<p class="status-message">Could not reach the server.</p>';
    }
}

async function loadWatchProviders(movieId) {
    const section = document.getElementById('watch-section');

    try {
        const response = await fetch(`${API_BASE}/movie/${movieId}/watch`);

        if (!response.ok) {
            section.innerHTML = '<h3>Where to Watch</h3><p class="status-message">Could not load streaming info.</p>';
            return;
        }

        const data = await response.json();
        const hasAnyOption = data.streaming.length || data.rent.length || data.buy.length;

        if (!hasAnyOption) {
            section.innerHTML = '<h3>Where to Watch</h3><p class="status-message">Not currently available to stream, rent, or buy.</p>';
            return;
        }

        // Build one line per category, only if that category has options.
        const categoryLine = (label, list) =>
            list.length ? `<p><strong>${label}:</strong> ${list.join(', ')}</p>` : '';

        section.innerHTML = `
            <h3>Where to Watch</h3>
            ${categoryLine('Stream', data.streaming)}
            ${categoryLine('Rent', data.rent)}
            ${categoryLine('Buy', data.buy)}
            ${data.link ? `<a href="${data.link}" target="_blank" rel="noopener">See all options on TMDB</a>` : ''}
            <p class="attribution">Streaming data provided by JustWatch</p>
        `;
    } catch (error) {
        section.innerHTML = '<h3>Where to Watch</h3><p class="status-message">Could not load streaming info.</p>';
    }
}

function findNearbyCinemas() {
    const listDiv = document.getElementById('cinemas-list');

    if (!navigator.geolocation) {
        listDiv.innerHTML = '<p class="status-message">Location is not supported by your browser.</p>';
        return;
    }

    listDiv.innerHTML = '<p class="status-message">Getting your location...</p>';

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            listDiv.innerHTML = '<p class="status-message">Searching nearby cinemas...</p>';

            try {
                const response = await fetch(`${API_BASE}/cinemas?lat=${latitude}&lon=${longitude}`);

                if (!response.ok) {
                    listDiv.innerHTML = '<p class="status-message">Could not load nearby cinemas.</p>';
                    return;
                }

                const cinemas = await response.json();

                if (cinemas.length === 0) {
                    listDiv.innerHTML = '<p class="status-message">No cinemas found nearby.</p>';
                    return;
                }

                listDiv.innerHTML = cinemas.map(cinema => `
                    <div class="cinema-item">
                        <strong>${cinema.name}</strong>
                        ${cinema.address ? `<div class="cinema-address">${cinema.address}</div>` : ''}
                        ${cinema.rating ? `<div class="cinema-rating">⭐ ${cinema.rating}</div>` : ''}
                        <a href="https://www.google.com/maps?q=${cinema.lat},${cinema.lon}" target="_blank" rel="noopener">
                            View on map
                        </a>
                    </div>
                `).join('');
            } catch (error) {
                listDiv.innerHTML = '<p class="status-message">Could not reach the server.</p>';
            }
        },
        () => {
            // Runs if the user denies the location permission prompt.
            listDiv.innerHTML = '<p class="status-message">Location permission denied. Enable it to find nearby cinemas.</p>';
        }
    );
}

async function addFavorite(movie) {
    await fetch(`${API_BASE}/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id: movie.id,
            title: movie.title,
            poster_path: movie.poster_path,
            release_date: movie.release_date,
            rating: movie.rating
        })
    });

    alert(`${movie.title} added to favorites!`);
}

async function removeFavorite(movieId) {
    await fetch(`${API_BASE}/favorites/${movieId}`, {
        method: 'DELETE'
    });

    alert('Removed from favorites.');
    movieModal.classList.add('hidden');
    showFavorites();
}

modalClose.addEventListener('click', () => {
    movieModal.classList.add('hidden');
});

movieModal.addEventListener('click', (event) => {
    if (event.target === movieModal) {
        movieModal.classList.add('hidden');
    }
});

// Show Popular / Top Rated the moment the page first loads, instead of
// leaving the results area empty until a search happens.
loadHomepage();