const API_URL = "https://openlibrary.org/search.json";
const STORAGE_KEY = "bookscout-reading-list";
const searchForm = document.getElementById("searchForm");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");
const searchStatus = document.getElementById("searchStatus");
const results = document.getElementById("results");
const savedList = document.getElementById("savedList");
const listStats = document.getElementById("listStats");
const statusFilter = document.getElementById("statusFilter");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const quickButtons = document.querySelectorAll(".quick-btn");
let lastResults = [];
let readingList = loadReadingList();
renderReadingList();
searchForm.addEventListener("submit", handleSearch);
results.addEventListener("click", handleResultClick);
savedList.addEventListener("click", handleSavedClick);
savedList.addEventListener("change", handleSavedChange);
savedList.addEventListener("input", handleSavedInput);
statusFilter.addEventListener("change", renderReadingList);
exportBtn.addEventListener("click", exportReadingList);
importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", importReadingList);
quickButtons.forEach((button) => {
button.addEventListener("click", () => {
searchInput.value = button.dataset.query;
searchForm.requestSubmit();
});
});
async function handleSearch(event) {
event.preventDefault();
const query = searchInput.value.trim();
const sort = sortSelect.value;
if (!query) {
showStatus("Type something to search for.", true);
return;
}
showStatus("Searching Open Library...");
results.innerHTML = "";
try {
const url = buildSearchUrl(query, sort);
const response = await fetch(url);
if (!response.ok) {
throw new Error(`Open Library returned status ${response.status}`);
}
const data = await response.json();
lastResults = data.docs || [];
renderResults(lastResults, data.numFound || 0);
} catch (error) {
console.error(error);
showStatus("Something went wrong. Check your internet connection and try again.", true);
}
}
function buildSearchUrl(query, sort) {
const params = new URLSearchParams({
q: query,
limit: "12",
fields: "key,title,author_name,first_publish_year,cover_i,edition_count"
});
if (sort !== "relevance") {
params.set("sort", sort);
}
return `${API_URL}?${params.toString()}`;
}
function renderResults(books, totalFound) {
if (books.length === 0) {
showStatus("No books found. Try a different search.");
results.innerHTML = `<div class="empty-state">No results yet.</div>`;
return;
}
showStatus(`Showing ${books.length} results. Open Library found about ${totalFound} matches.`);
results.innerHTML = books.map((book) => {
const title = book.title || "Untitled book";
const authors = formatAuthors(book.author_name);
const year = book.first_publish_year || "Unknown year";
const editions = book.edition_count || "?";
const cover = getCoverHtml(book.cover_i, "cover");
const alreadySaved = readingList.some((item) => item.key === book.key);
return `
<article class="book-card">
${cover}
<div>
<p class="book-title">${escapeHtml(title)}</p>
<p class="book-meta">${escapeHtml(authors)}</p>
<p class="book-meta">First published: ${escapeHtml(year)}</p>
<p class="book-meta">Editions: ${escapeHtml(editions)}</p>
</div>
<button data-action="save" data-key="${escapeHtml(book.key)}" ${alreadySaved ? "disabled" : ""}>
${alreadySaved ? "Saved" : "Save to List"}
</button>
</article>
`;
}).join("");
}
function handleResultClick(event) {
const button = event.target.closest("button[data-action='save']");
if (!button) return;
const key = button.dataset.key;
const book = lastResults.find((item) => item.key === key);
if (!book) return;
addBookToReadingList(book);
renderResults(lastResults, lastResults.length);
}
function addBookToReadingList(book) {
if (readingList.some((item) => item.key === book.key)) return;
const savedBook = {
key: book.key,
title: book.title || "Untitled book",
authors: formatAuthors(book.author_name),
year: book.first_publish_year || "Unknown year",
coverId: book.cover_i || null,
editionCount: book.edition_count || null,
status: "Want to Read",
notes: "",
addedAt: new Date().toISOString()
};
readingList.unshift(savedBook);
saveReadingList();
renderReadingList();
}
function renderReadingList() {
const filter = statusFilter.value;
const visibleBooks = filter === "all"
? readingList
: readingList.filter((book) => book.status === filter);
updateStats();
if (visibleBooks.length === 0) {
savedList.innerHTML = `<li class="empty-state">No books match this filter yet.</li>`;
return;
}
savedList.innerHTML = visibleBooks.map((book) => {
const cover = getCoverHtml(book.coverId, "saved-cover");
return `
<li class="saved-book">
<div class="saved-top">
${cover}
<div>
<p class="book-title">${escapeHtml(book.title)}</p>
<p class="book-meta">${escapeHtml(book.authors)} · ${escapeHtml(book.year)}</p>
</div>
</div>
<div class="saved-controls">
<select data-action="status" data-key="${escapeHtml(book.key)}">
${statusOption("Want to Read", book.status)}
${statusOption("Reading", book.status)}
${statusOption("Finished", book.status)}
</select>
<textarea data-action="notes" data-key="${escapeHtml(book.key)}" placeholder="Add a note about this
book">${escapeHtml(book.notes)}</textarea>
<button class="danger" data-action="remove" data-key="${escapeHtml(book.key)}">Remove</button>
</div>
</li>
`;
}).join("");
}
function statusOption(value, currentStatus) {
return `<option value="${value}" ${value === currentStatus ? "selected" : ""}>${value}</option>`;
}
function handleSavedClick(event) {
const button = event.target.closest("button[data-action='remove']");
if (!button) return;
const key = button.dataset.key;
readingList = readingList.filter((book) => book.key !== key);
saveReadingList();
renderReadingList();
renderResults(lastResults, lastResults.length);
}
function handleSavedChange(event) {
const select = event.target.closest("select[data-action='status']");
if (!select) return;
const book = readingList.find((item) => item.key === select.dataset.key);
if (!book) return;
book.status = select.value;
saveReadingList();
renderReadingList();
}
function handleSavedInput(event) {
const textarea = event.target.closest("textarea[data-action='notes']");
if (!textarea) return;
const book = readingList.find((item) => item.key === textarea.dataset.key);
if (!book) return;
book.notes = textarea.value;
saveReadingList();
updateStats();
}
function updateStats() {
const total = readingList.length;
const want = readingList.filter((book) => book.status === "Want to Read").length;
const reading = readingList.filter((book) => book.status === "Reading").length;
const finished = readingList.filter((book) => book.status === "Finished").length;
listStats.textContent = `${total} saved · ${want} want · ${reading} reading · ${finished} finished`;
}
function exportReadingList() {
const json = JSON.stringify(readingList, null, 2);
const blob = new Blob([json], { type: "application/json" });
const url = URL.createObjectURL(blob);
const link = document.createElement("a");
link.href = url;
link.download = "bookscout-reading-list.json";
link.click();
URL.revokeObjectURL(url);
}
async function importReadingList(event) {
const file = event.target.files[0];
if (!file) return;
try {
const text = await file.text();
const importedBooks = JSON.parse(text);
if (!Array.isArray(importedBooks)) {
throw new Error("Imported file must contain an array of books.");
}
importedBooks.forEach((book) => {
if (book.key && !readingList.some((item) => item.key === book.key)) {
readingList.push(book);
}
});
saveReadingList();
renderReadingList();
showStatus("Imported reading list successfully.");
} catch (error) {
console.error(error);
alert("Could not import that file. Make sure it is a BookScout JSON export.");
}
importFile.value = "";
}
function loadReadingList() {
const saved = localStorage.getItem(STORAGE_KEY);
return saved ? JSON.parse(saved) : [];
}

function saveReadingList() {
localStorage.setItem(STORAGE_KEY, JSON.stringify(readingList));
}
function getCoverHtml(coverId, className) {
if (!coverId) {
return `<div class="${className}" aria-label="No cover"> </div>`;
}
const src = `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`;
return `<img class="${className}" src="${src}" alt="Book cover" loading="lazy" />`;
}
function formatAuthors(authorArray) {
if (!authorArray || authorArray.length === 0) {
return "Unknown author";
}
return authorArray.slice(0, 2).join(", ");
}
function showStatus(message, isError = false) {
searchStatus.textContent = message;
searchStatus.style.color = isError ? "#dc2626" : "#667085";
}
function escapeHtml(value) {
return String(value)
.replaceAll("&", "&amp;")
.replaceAll("<", "&lt;")
.replaceAll(">", "&gt;")
.replaceAll('"', "&quot;")
.replaceAll("'", "&#039;");
}
const savedBook = {
  key: book.key,
  title: book.title || "Untitled book",
  authors: formatAuthors(book.author_name),
  year: book.first_publish_year || "Unknown year",
  coverId: book.cover_i || null,
  editionCount: book.edition_count || null,
  status: "Want to Read",
  notes: "",
  rating: 0,  // Add this line
  addedAt: new Date().toISOString()
};
*****
  savedList.addEventListener("click", handleStarClick);
function handleStarClick(event) {
  const star = event.target.closest(".star");
  if (!star) return;
  const rating = parseInt(star.dataset.value);
  const ratingContainer = star.closest(".star-rating");
  const key = ratingContainer.dataset.key;
  const book = readingList.find((item) => item.key === key);
  if (!book) return;
  book.rating = rating;
  saveReadingList();
  renderReadingList();
}
