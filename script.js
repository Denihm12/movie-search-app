const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('searchbutton');
const favoritesButton = document.getElementById('favoritesbutton');
const homeButton = document.getElementById('homebutton');
const searchResults = document.getElementById('search-results');
const brandLink = document.getElementById('brand-link');
const appHeader = document.getElementById('app-header');
const hero = document.getElementById('hero');
const genreBar = document.getElementById('genre-bar');
const movieModal = document.getElementById('movie-modal');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const modalScrim = document.getElementById('modal-scrim');
const toast = document.getElementById('toast');

const IMG_CARD = 'https://image.tmdb.org/t/p/w342';
const IMG_HERO = 'https://image.tmdb.org/t/p/w1280';
const IMG_PANEL = 'https://image.tmdb.org/t/p/w780';
const NO_POSTER = 'https://placehold.co/342x513/12121f/9a9ab0?text=No+Poster';

// This is THE ONE LINE to change depending on where the backend runs.
// - Testing in a desktop browser: 'http://localhost:5000' works fine.
// - Testing on a real phone (via Capacitor) on the same WiFi as your
//   computer: replace with your computer's local network IP, e.g.
//   'http://192.168.1.42:5000'.
// - A published app: this must point to a real, always-on server address
//   (e.g. Render, Railway).
const API_BASE = 'https://movie-search-app-q1x1.onrender.com';

// ---------------------------------------------------------------------
// Categories. To add a new row/genre chip, add one line here.
// `genre` is a TMDB genre id; `lang` filters by original language
// (that is how "Anime" works: Animation + Japanese).
// ---------------------------------------------------------------------
const FEATURED_ROWS = [
    { id: 'popular', title: 'Popular Right Now', path: '/popular' },
    { id: 'top-rated', title: 'Top Rated', path: '/top-rated' }
];

const GENRES = [
    { id: 'anime', title: 'Anime', genre: 16, lang: 'ja' },
    { id: 'action', title: 'Action', genre: 28 },
    { id: 'adventure', title: 'Adventure', genre: 12 },
    { id: 'comedy', title: 'Comedy', genre: 35 },
    { id: 'drama', title: 'Drama', genre: 18 },
    { id: 'scifi', title: 'Sci-Fi', genre: 878 },
    { id: 'horror', title: 'Horror', genre: 27 },
    { id: 'thriller', title: 'Thriller', genre: 53 },
    { id: 'romance', title: 'Romance', genre: 10749 },
    { id: 'fantasy', title: 'Fantasy', genre: 14 },
    { id: 'animation', title: 'Animation', genre: 16 },
    { id: 'crime', title: 'Crime', genre: 80 },
    { id: 'documentary', title: 'Documentary', genre: 99 }
];

function categoryPath(cat, page = 1) {
    if (cat.path) return cat.path;
    const lang = cat.lang ? `&lang=${cat.lang}` : '';
    return `/discover?genre=${cat.genre}${lang}&page=${page}`;
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
async function api(path) {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
}

// Movie data comes from an outside API, so escape it before putting it in HTML.
function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

const yearOf = movie => (movie.release_date || '').slice(0, 4) || 'Unknown year';
const ratingOf = movie => (movie.rating ? Number(movie.rating).toFixed(1) : 'NR');

// /discover returns {results, page, total_pages}; the other routes return a plain list.
const resultsOf = data => (Array.isArray(data) ? data : data.results);

let toastTimer;
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function setLoading(isLoading) {
    searchButton.disabled = isLoading;
    favoritesButton.disabled = isLoading;
}

function setActiveNav(name) {
    homeButton.classList.toggle('active', name === 'home');
    favoritesButton.classList.toggle('active', name === 'favorites');
}

function setActiveChip(id) {
    genreBar.querySelectorAll('.genre-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.id === id);
    });
}

// Glass nav gets its frosted background once you scroll.
window.addEventListener('scroll', () => {
    appHeader.classList.toggle('scrolled', window.scrollY > 24);
}, { passive: true });

// ---------------------------------------------------------------------
// Cards, rows, grids
// ---------------------------------------------------------------------
function movieCardHTML(movie) {
    const poster = movie.poster_path ? `${IMG_CARD}${movie.poster_path}` : NO_POSTER;
    return `
        <div class="movie-card" data-movie-id="${movie.id}" tabindex="0" role="button" aria-label="${esc(movie.title)}">
            <img src="${poster}" alt="${esc(movie.title)} poster" loading="lazy">
            <span class="card-rating">★ ${ratingOf(movie)}</span>
            <div class="card-overlay">
                <p class="card-title">${esc(movie.title)}</p>
                <span class="card-meta">${yearOf(movie)}</span>
            </div>
        </div>
    `;
}

function cardsHTML(movies) {
    return movies.map(movieCardHTML).join('');
}

function skeletonRow() {
    return '<div class="skeleton-card"></div>'.repeat(8);
}

function rowSectionHTML(cat) {
    return `
        <section class="row-section" data-cat-id="${cat.id}">
            <h2 class="row-title">${esc(cat.title)}</h2>
            <div class="row-wrap">
                <button class="row-arrow left" aria-label="Scroll left">‹</button>
                <div class="row">${skeletonRow()}</div>
                <button class="row-arrow right" aria-label="Scroll right">›</button>
            </div>
        </section>
    `;
}

// Rows load when they get close to the screen, so opening the app
// doesn't fire a dozen requests at once.
let rowObserver;

async function fillRow(section) {
    const cat = [...FEATURED_ROWS, ...GENRES].find(c => c.id === section.dataset.catId);
    const row = section.querySelector('.row');

    try {
        const movies = resultsOf(await api(categoryPath(cat)));
        if (movies.length === 0) {
            section.remove();
            return;
        }
        row.innerHTML = cardsHTML(movies);
    } catch (error) {
        row.innerHTML = '<p class="status-message">Could not load this row.</p>';
    }
}

function observeRows() {
    if (rowObserver) rowObserver.disconnect();

    rowObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                rowObserver.unobserve(entry.target);
                fillRow(entry.target);
            }
        });
    }, { rootMargin: '500px 0px' });

    searchResults.querySelectorAll('.row-section').forEach(section => rowObserver.observe(section));
}

// ---------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------
function renderGenreBar() {
    const chips = [{ id: 'all', title: 'All' }, ...GENRES];
    genreBar.innerHTML = chips.map(c =>
        `<button class="genre-chip${c.id === 'all' ? ' active' : ''}" data-id="${c.id}">${esc(c.title)}</button>`
    ).join('');
}

function goHome() {
    searchInput.value = '';
    setActiveNav('home');
    setActiveChip('all');
    hero.classList.remove('hidden');
    searchResults.innerHTML = [...FEATURED_ROWS, ...GENRES].map(rowSectionHTML).join('');
    observeRows();
    window.scrollTo({ top: 0 });
}

function leaveHome() {
    hero.classList.add('hidden');
    if (rowObserver) rowObserver.disconnect();
}

let genreState = { cat: null, page: 1, totalPages: 1 };

async function showGenre(cat) {
    leaveHome();
    setActiveNav('');
    setActiveChip(cat.id);
    searchResults.innerHTML = `
        <h2 class="view-title">${esc(cat.title)}</h2>
        <div class="results-grid" id="genre-grid"></div>
        <div class="load-more-wrap" id="load-more-wrap"></div>
    `;
    document.getElementById('genre-grid').innerHTML = '<p class="status-message">Loading...</p>';
    window.scrollTo({ top: 0 });

    genreState = { cat, page: 0, totalPages: 1 };
    document.getElementById('genre-grid').innerHTML = '';
    await loadMoreGenre();
}

async function loadMoreGenre() {
    const grid = document.getElementById('genre-grid');
    const wrap = document.getElementById('load-more-wrap');
    if (!grid || !wrap) return;

    const { cat } = genreState;
    const nextPage = genreState.page + 1;
    wrap.innerHTML = '';

    try {
        const data = await api(categoryPath(cat, nextPage));
        genreState.page = data.page;
        genreState.totalPages = data.total_pages;

        if (data.results.length === 0 && nextPage === 1) {
            grid.innerHTML = '<p class="status-message">Nothing found in this genre.</p>';
            return;
        }

        grid.insertAdjacentHTML('beforeend', cardsHTML(data.results));

        // TMDB caps discover at 500 pages; we stop well before that.
        if (genreState.page < Math.min(genreState.totalPages, 10)) {
            wrap.innerHTML = '<button class="btn-glass" id="load-more-btn">Load more</button>';
            document.getElementById('load-more-btn').addEventListener('click', loadMoreGenre);
        }
    } catch (error) {
        wrap.innerHTML = '<p class="status-message">Could not load movies. Is the backend running?</p>';
    }
}

async function searchMovies() {
    const query = searchInput.value.trim();

    if (!query) {
        searchInput.focus();
        showToast('Type a movie title to search.');
        return;
    }

    leaveHome();
    setActiveNav('');
    setActiveChip('');
    setLoading(true);
    searchResults.innerHTML = '<p class="status-message">Searching...</p>';

    try {
        const movies = await api(`/search?q=${encodeURIComponent(query)}`);

        if (movies.length === 0) {
            searchResults.innerHTML = `<p class="status-message">No results for “${esc(query)}”. Try a different title.</p>`;
            return;
        }

        searchResults.innerHTML = `
            <h2 class="view-title">Results for “${esc(query)}”</h2>
            <div class="results-grid">${cardsHTML(movies)}</div>
        `;
        window.scrollTo({ top: 0 });
    } catch (error) {
        searchResults.innerHTML = '<p class="status-message">Could not reach the server. Is the backend running?</p>';
    } finally {
        setLoading(false);
    }
}

function showFavorites() {
    leaveHome();
    setActiveNav('favorites');
    setActiveChip('');

    const favorites = readFavorites();
    favoriteIds = new Set(favorites.map(f => f.id));

    if (favorites.length === 0) {
        searchResults.innerHTML = '<p class="status-message">No favorites yet. Open any movie and choose Add to Favorites.</p>';
        return;
    }

    searchResults.innerHTML = `
        <h2 class="view-title">My Favorites</h2>
        <div class="results-grid">${cardsHTML(favorites)}</div>
    `;
    window.scrollTo({ top: 0 });
}

// ---------------------------------------------------------------------
// Hero banner (a random pick from the top of "Popular")
// ---------------------------------------------------------------------
async function loadHero() {
    try {
        const popular = await api('/popular');
        const candidates = popular.slice(0, 8).filter(m => m.backdrop_path);
        if (candidates.length === 0) return;

        const movie = candidates[Math.floor(Math.random() * candidates.length)];

        hero.style.backgroundImage = `url(${IMG_HERO}${movie.backdrop_path})`;
        hero.innerHTML = `
            <div class="hero-content">
                <span class="hero-tag">Popular right now</span>
                <h1 class="hero-title">${esc(movie.title)}</h1>
                <div class="hero-meta">${yearOf(movie)} &nbsp;•&nbsp; ★ ${ratingOf(movie)}</div>
                <p class="hero-overview">${esc(movie.overview || 'No overview available.')}</p>
                <button class="btn-primary" id="hero-info-btn">More info</button>
            </div>
        `;
        document.getElementById('hero-info-btn').addEventListener('click', () => showMovieDetail(movie.id));
        hero.classList.remove('hidden');
    } catch (error) {
        // The hero is decorative; if it fails, the rows below still work.
        hero.classList.add('hidden');
    }
}

// ---------------------------------------------------------------------
// Favorites state
// ---------------------------------------------------------------------
const FAV_KEY = 'denihm-favorites';
let favoriteIds = new Set();

function readFavorites() {
    try {
        const saved = JSON.parse(localStorage.getItem(FAV_KEY));
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        return [];
    }
}

function writeFavorites(list) {
    localStorage.setItem(FAV_KEY, JSON.stringify(list));
    favoriteIds = new Set(list.map(f => f.id));
}

function loadFavoriteIds() {
    favoriteIds = new Set(readFavorites().map(f => f.id));
}

function favoriteButtonLabel(movieId) {
    return favoriteIds.has(movieId) ? '★ In Favorites' : '☆ Add to Favorites';
}

function toggleFavorite(movie, button) {
    try {
        const list = readFavorites();

        if (favoriteIds.has(movie.id)) {
            writeFavorites(list.filter(f => f.id !== movie.id));
            showToast(`Removed ${movie.title} from favorites`);
        } else {
            writeFavorites([{
                id: movie.id,
                title: movie.title,
                poster_path: movie.poster_path,
                release_date: movie.release_date,
                rating: movie.rating
            }, ...list]);
            showToast(`Added ${movie.title} to favorites`);
        }

        button.textContent = favoriteButtonLabel(movie.id);
        button.className = favoriteIds.has(movie.id) ? 'btn-glass' : 'btn-primary';
    } catch (error) {
        showToast('Could not save favorites in this browser.');
    }
}

// ---------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------
function openModal() {
    movieModal.classList.remove('hidden');
    movieModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
}

function closeModal() {
    movieModal.classList.add('hidden');
    movieModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    modalBody.innerHTML = ''; // also stops any playing trailer
}

async function showMovieDetail(movieId) {
    modalBody.innerHTML = '<p class="status-message">Loading...</p>';
    openModal();

    try {
        const movie = await api(`/movie/${movieId}`);

        const backdrop = movie.backdrop_path
            ? `<div class="modal-backdrop" style="background-image:url(${IMG_PANEL}${movie.backdrop_path})"></div>`
            : '';

        const metaParts = [
            (movie.release_date || '').slice(0, 4),
            movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : '',
            `★ ${ratingOf(movie)}`
        ].filter(Boolean);

        const pills = (movie.genres || []).map(g => `<span class="genre-pill">${esc(g)}</span>`).join('');
        const castLine = movie.cast.length > 0 ? movie.cast.map(esc).join(', ') : 'Not available';

        const trailerEmbed = movie.trailer_key
            ? `<iframe width="100%" height="220"
                 src="https://www.youtube.com/embed/${esc(movie.trailer_key)}"
                 title="Trailer" allowfullscreen></iframe>`
            : '<p>No trailer available.</p>';

        const isFav = favoriteIds.has(movie.id);

        modalBody.innerHTML = `
            ${backdrop}
            <div class="modal-info${backdrop ? '' : ' no-backdrop'}">
                <h2>${esc(movie.title)}</h2>
                <div class="modal-meta">${metaParts.join(' &nbsp;•&nbsp; ')}</div>
                <div class="genre-pills">${pills}</div>

                <div class="modal-actions">
                    <button id="favorite-btn" class="${isFav ? 'btn-glass' : 'btn-primary'}">${favoriteButtonLabel(movie.id)}</button>
                </div>

                <p>${esc(movie.overview || 'No overview available.')}</p>
                <p><strong>Cast:</strong> ${castLine}</p>
                ${trailerEmbed}

                <div id="watch-section" class="detail-section">
                    <h3>Where to Watch</h3>
                    <p class="status-message">Loading...</p>
                </div>

                <div id="cinemas-section" class="detail-section">
                    <h3>Cinemas Near You</h3>
                    <button id="find-cinemas-btn">📍 Find Nearby Cinemas</button>
                    <div id="cinemas-list"></div>
                </div>
            </div>
        `;

        document.getElementById('favorite-btn').addEventListener('click', (e) => toggleFavorite(movie, e.currentTarget));
        document.getElementById('find-cinemas-btn').addEventListener('click', findNearbyCinemas);
        modalBody.parentElement.scrollTop = 0;

        loadWatchProviders(movieId);
    } catch (error) {
        modalBody.innerHTML = '<p class="status-message">Could not load movie details. Is the backend running?</p>';
    }
}

async function loadWatchProviders(movieId) {
    const section = document.getElementById('watch-section');

    try {
        const data = await api(`/movie/${movieId}/watch`);
        const hasAnyOption = data.streaming.length || data.rent.length || data.buy.length;

        if (!hasAnyOption) {
            section.innerHTML = '<h3>Where to Watch</h3><p class="status-message">Not currently available to stream, rent, or buy.</p>';
            return;
        }

        const categoryLine = (label, list) =>
            list.length ? `<p><strong>${label}:</strong> ${list.map(esc).join(', ')}</p>` : '';

        section.innerHTML = `
            <h3>Where to Watch</h3>
            ${categoryLine('Stream', data.streaming)}
            ${categoryLine('Rent', data.rent)}
            ${categoryLine('Buy', data.buy)}
            ${data.link ? `<a href="${esc(data.link)}" target="_blank" rel="noopener">See all options on TMDB</a>` : ''}
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
                const cinemas = await api(`/cinemas?lat=${latitude}&lon=${longitude}`);

                if (cinemas.length === 0) {
                    listDiv.innerHTML = '<p class="status-message">No cinemas found nearby.</p>';
                    return;
                }

                listDiv.innerHTML = cinemas.map(cinema => `
                    <div class="cinema-item">
                        <strong>${esc(cinema.name)}</strong>
                        ${cinema.address ? `<div class="cinema-address">${esc(cinema.address)}</div>` : ''}
                        ${cinema.rating ? `<div class="cinema-rating">⭐ ${esc(cinema.rating)}</div>` : ''}
                        <a href="https://www.google.com/maps?q=${cinema.lat},${cinema.lon}" target="_blank" rel="noopener">
                            View on map
                        </a>
                    </div>
                `).join('');
            } catch (error) {
                listDiv.innerHTML = '<p class="status-message">Could not load nearby cinemas.</p>';
            }
        },
        () => {
            listDiv.innerHTML = '<p class="status-message">Location permission denied. Enable it to find nearby cinemas.</p>';
        }
    );
}

// ---------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------
searchButton.addEventListener('click', searchMovies);

searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') searchMovies();
});

favoritesButton.addEventListener('click', showFavorites);
homeButton.addEventListener('click', goHome);

brandLink.addEventListener('click', (event) => {
    event.preventDefault();
    goHome();
});

genreBar.addEventListener('click', (event) => {
    const chip = event.target.closest('.genre-chip');
    if (!chip) return;

    if (chip.dataset.id === 'all') {
        goHome();
        return;
    }
    showGenre(GENRES.find(g => g.id === chip.dataset.id));
});

// One listener handles card clicks and row arrows for every view.
searchResults.addEventListener('click', (event) => {
    const arrow = event.target.closest('.row-arrow');
    if (arrow) {
        const row = arrow.parentElement.querySelector('.row');
        const direction = arrow.classList.contains('left') ? -1 : 1;
        row.scrollBy({ left: direction * row.clientWidth * 0.85, behavior: 'smooth' });
        return;
    }

    const card = event.target.closest('.movie-card');
    if (card) showMovieDetail(card.dataset.movieId);
});

// Cards are focusable, so Enter / Space opens them from the keyboard too.
searchResults.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const card = event.target.closest('.movie-card');
    if (card) {
        event.preventDefault();
        showMovieDetail(card.dataset.movieId);
    }
});

modalClose.addEventListener('click', closeModal);
modalScrim.addEventListener('click', closeModal);

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !movieModal.classList.contains('hidden')) closeModal();
});

// ---------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------
renderGenreBar();
loadFavoriteIds();
loadHero();
goHome();